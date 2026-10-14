#!/usr/bin/env python3
"""
The Jordan Insurance Agency — proposal builder (v3).

Usage:
    python3 scripts/build_proposal.py <proposal.json> [--out DIR] [--preview]

Reads the proposal content (written by Claude from the carrier quotes) and renders it with the
LOCKED design in template/proposal.css. Everything that must never change — logo, colors, fonts,
page frame, agent block, service-team block, "Quoted Rates" bars, the final-rate box, Next Steps
wording for the agent/team, footer, proposal number, file name — is injected here from
branding.json, not written by hand.

After rendering it runs the quality checks and exits non-zero if any check fails.
"""
import argparse, base64, datetime as dt, html, importlib.util, json, os, pathlib, re, shutil, subprocess, sys

SKILL = pathlib.Path(__file__).resolve().parent.parent
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]
SECTION_DEFAULTS = {
    "note": "A Note From Your Agent", "comparison": "Bundle Comparison", "home": "Home Coverage",
    "auto": "Auto Coverage", "umbrella": "Optional Umbrella", "explained": "Coverage Explained",
    "property": "Property Profile", "payment": "Payment & Next Steps", "table": "Your Options", "exclusions": "Exclusions & Limitations",
}
PAGE_H = 1100


# ----------------------------------------------------------------------------- helpers
def b64(path):
    return base64.b64encode(pathlib.Path(path).read_bytes()).decode()


def esc_attr(s):
    return html.escape(str(s), quote=True)


def money(s):
    """'$1,234.56' / '– $92.00' / '-92' -> float"""
    t = str(s).replace("–", "-").replace("−", "-").replace("$", "").replace(",", "").replace(" ", "")
    m = re.search(r"-?\d+(\.\d+)?", t)
    if not m:
        raise ValueError(f"not a dollar amount: {s!r}")
    return float(m.group(0))


DI_QR = ("These are quoted rates. Each carrier sets your final premium and benefit after it completes medical and "
         "financial underwriting: health questions, any exam or lab work, and proof of income.")
DI_BOX = ("These quotes are based on the health, occupation and income information available to us today. Disability "
          "carriers confirm all of it during underwriting, which can include a medical questionnaire or exam, a review of "
          "medical records and proof of income. If underwriting matches what we quoted, your premium and benefit stay the "
          "same. If it finds something different, the carrier may adjust the premium or benefit, or exclude a condition. "
          "We'll go over any change with you before the policy is issued.")
DI_BIND = ("Once you choose, we complete the application together. The carrier finishes underwriting and issues the policy "
           "with your final premium for you to review before it takes effect.")


def final_words(lines):
    """(final-rate box headline, closing fine print) by line of business."""
    if "disability" in set(lines):
        return ("Your final premium is set by underwriting.",
                "These are quotes, not contracts. Final premiums and benefits are subject to each carrier's medical and "
                "financial underwriting and verification of the information provided.")
    return ("Your final premium is confirmed at binding.",
            "These are quotes, not contracts or binders of coverage. Final premiums are subject to each carrier's "
            "underwriting, the reports run at binding, and verification of the information provided.")


def step_words(lines):
    """(step iii title, closing sentence of step ii) by line of business."""
    if "disability" in set(lines):
        return "Apply &amp; final rate", "We can start your application right away."
    return "Bind &amp; final rate", "We can bind the same day."


def notice_texts(lines):
    lines = set(lines)
    if "disability" in lines:
        return DI_QR, DI_BOX, DI_BIND
    auto, home = "auto" in lines, bool(lines & {"home", "landlord", "condo", "renters"})
    if auto and home:
        qr = ("These are quoted rates. Each carrier confirms your final premium when it runs every driver's Motor Vehicle "
              "Report (MVR) and verifies the property and claims details at the time of binding.")
        box = ("These quotes are the best rates we found, based on the driving history and property information available "
               "to us today. Every carrier orders an official Motor Vehicle Report (MVR) for each driver and verifies the "
               "home's details and claims history, and those reports are only run at the time of binding. If they match what "
               "we quoted, your rate stays the same. If they show something different, such as a ticket, accident or claim "
               "that wasn't on file, the carrier may adjust the premium. This is standard, and we'll go over any change with "
               "you right away.")
        bind = ("When we bind, the carrier runs each driver's MVR, verifies the property details and confirms your final "
                "premium. We'll line up the start date with your current policies so there's no gap.")
    elif auto:
        qr = ("These are quoted rates. Each carrier confirms your final premium when it runs every driver's Motor Vehicle "
              "Report (MVR) at the time of binding.")
        box = ("These quotes are the best rates we found, based on the driving history information available to us today. "
               "Every carrier orders an official Motor Vehicle Report (MVR) for each driver, and that report is only run at "
               "the time of binding. If the report matches what we quoted, your rate stays the same. If it shows something "
               "different, such as a ticket or accident that wasn't on file, the carrier may adjust the premium. This is "
               "standard for auto insurance, and we'll go over any change with you right away.")
        bind = ("When we bind, the carrier runs each driver's MVR and confirms your final premium. We'll line up the start "
                "date with your current policy so there's no gap.")
    else:
        qr = ("These are quoted rates. Each carrier confirms your final premium after it verifies the property details and "
              "claims history at the time of binding.")
        box = ("These quotes are the best rates we found, based on the property and claims information available to us "
               "today. Every carrier verifies the home's details (such as roof age and construction) and its claims history "
               "at the time of binding. If everything matches what we quoted, your rate stays the same. If something is "
               "different, the carrier may adjust the premium, and we'll go over any change with you right away.")
        bind = ("When we bind, the carrier verifies the property details and confirms your final premium. We'll line up the "
                "start date with your current policy so there's no gap.")
    return qr, box, bind


# ----------------------------------------------------------------------------- builder
class Builder:
    def __init__(self, data, brand):
        self.d, self.B = data, brand
        self.opts = data["options"]
        self.rec = next((i for i, o in enumerate(self.opts) if o.get("recommended")), 0)
        self.qr_text, self.box_text, self.bind_text = notice_texts(data["lines"])
        self.content_pages = [p for p in data["pages"]]
        self.total = 1 + len(self.content_pages)
        self.logo, self.logo_w = b64(SKILL / brand["logo"]), b64(SKILL / brand["logo_white"])
        prep = dt.date.fromisoformat(data["prepared"])
        self.prep_txt = prep.strftime("%B ") + str(prep.day) + prep.strftime(", %Y")
        last = data["client"]["last_name"]
        self.pno = f'{brand["proposal_prefix"]}-{prep:%Y}-{prep:%m%d}-{last[0].upper()}'
        self.file_name = f'{last}_{data["proposal_type"]}_Proposal_The-Jordan-Insurance-Agency.pdf'

    # ---- shared pieces
    def qr(self, extra=""):
        return f'<div class="qr"><span class="tag">Quoted rates</span><span>{self.qr_text}{(" " + extra) if extra else ""}</span></div>'

    def frame(self, n, section, body):
        return (f'<section class="page" data-page="{n}"><div class="hdr"><img src="data:image/png;base64,{self.logo}" '
                f'alt="{esc_attr(self.B["agency_display_name"])}"><div class="meta">{section} · <b>{n} / {self.total}</b></div></div>'
                f'{body}<div class="foot"><span>{self.B["agency_display_name"]}</span><span>{self.B["phone"]} · '
                f'{self.B["website"]}</span></div><div class="bar"></div></section>')

    def title(self, roman, section, p):
        out = f'<span class="eyebrow">{roman} · {section}</span><h2 class="hl">{p["headline"]}</h2>'
        if p.get("address"):
            out += f'<span class="addr">{p["address"]}</span>'
        if p.get("lede"):
            out += f'<p class="lede">{p["lede"]}</p>'
        return out

    def table(self, first_col, cols, rows, cls="t"):
        n = len(cols)
        fw = "31%" if n >= 3 else ("36%" if n == 2 else "45%")
        head = f'<tr><th style="width:{fw}">{first_col}</th>' + "".join(
            f'<th class="{"rec" if i == self.rec and n > 1 else ""}">{c["title"]}<small>{c.get("sub", "")}</small></th>'
            for i, c in enumerate(cols)) + "</tr>"
        body = ""
        for r in rows:
            if isinstance(r, dict):
                label, vals, tot = r["label"], r["values"], r.get("total")
            else:
                label, vals, tot = r[0], r[1:], False
            if len(vals) != n:
                raise ValueError(f"row {label!r} has {len(vals)} values, expected {n}")
            body += f'<tr class="{"tot" if tot else ""}"><td>{label}</td>' + "".join(
                f'<td class="{"rec" if i == self.rec and n > 1 else ""}">{v}</td>' for i, v in enumerate(vals)) + "</tr>"
        return f'<table class="{cls}">{head}{body}</table>'

    def cols(self, p):
        return p.get("columns") or [{"title": o["col_title"], "sub": o.get("col_sub", "")} for o in self.opts]

    def rows_html(self, rows):
        out, first = "", True
        for r in rows:
            if isinstance(r, dict) and "sub" in r:
                out += f'<div class="sub">{r["sub"]}</div>'
                first = True
                continue
            if isinstance(r, dict):
                label, value, tot = r["label"], r["value"], r.get("total")
            else:
                label, value, tot = r[0], r[1], False
            cls = "rr" + (" tot" if tot else "") + (" first" if first and not tot else "")
            out += f'<div class="{cls}"><span>{label}</span><span>{value}</span></div>'
            first = False
        return out

    def discounts(self, items):
        if not items:
            return ""
        return '<div class="sl">Discounts applied</div><div class="disc">' + "".join(
            f'<div><b>{x["title"]}</b>{x["text"]}</div>' for x in items) + "</div>"

    # ---- cover
    def cover(self):
        c, cl, B = self.d["cover"], self.d["client"], self.B
        n = len(self.opts)
        cards = "".join(
            f'<div class="opt{" best" if o.get("recommended") and n > 1 else ""}"><span class="tag">{o["tag"]}</span>'
            f'<div class="n">{o["name"]}</div><div class="s">{o.get("sub", "")}</div><div class="p">{o["price"]}</div>'
            f'<div class="c">{o.get("price_label", "")}</div></div>' for o in self.opts)
        strip = ""
        if c.get("strip"):
            s = c["strip"]
            strip = (f'<div class="strip"><div><span class="tag">{s["tag"]}</span>{s["text"]}</div>'
                     f'<div class="r">{s.get("right", "")}</div></div>')
        a = B["agent"]
        team = B.get("service_team") or []
        people = (f'<div><span class="cap">Your agent</span><div class="nm">{a["name"]}</div>'
                  f'<div class="ct">{a["phone"]}<br>{a["email"]}<br>{B["address"]}</div><div class="cv-web">{B["website"]}</div></div>')
        for i, m in enumerate(team):
            cap = ("Your service team" if len(team) > 1 else "Your service contact") if i == 0 else "&nbsp;"
            people += (f'<div><span class="cap">{cap}</span><div class="nm">{m["name"]}</div><div class="ttl">{m["title"]}</div>'
                       f'<div class="ct">Direct {m["phone"]}<br>{m["email"]}</div></div>')
        n_people = 1 + len(team)
        insured = "".join(
            f'<div class="s{" dark" if i == 0 else ""}">{x}</div>' for i, x in enumerate(c["insured_lines"]))
        return f"""<section class="page cover" data-page="1">
<div class="cv-top"><img class="logo" src="data:image/png;base64,{self.logo_w}" alt="{esc_attr(B['agency_display_name'])}">
<div class="cv-meta"><div>Proposal No.<b>{self.pno}</b></div><div>Prepared<b>{self.prep_txt}</b></div><div>Term<b>{self.d.get('term', '12 months')}</b></div></div>
<span class="cv-eb"><i></i>· {c['eyebrow']}</span><h1 class="cv-hl">{c['headline']}</h1>
<span class="cv-addr">{cl['address_line']}</span><p class="cv-sub">{c['subtext']}</p></div>
<div class="cv-body"><div class="opts n{n}">{cards}</div>{strip}{self.qr()}
<div class="cv-grid"><div><span class="cap">Prepared for</span><div class="v">{cl['full_names']}</div><div class="s">{cl['address_short']}</div></div>
<div><span class="cap">{c.get('insured_label', 'Insured property &amp; vehicles')}</span>{insured}</div>
<div><span class="cap">{c['premium_label']}</span><div class="v big">{c['premium_value']}</div><div class="s">{c.get('premium_note', '')}</div></div></div>
<div class="cv-people n{n_people}">{people}</div></div><div class="bar"></div></section>"""

    # ---- content pages
    def page_note(self, roman, sec, p):
        s = p["summary"]
        rows = "".join(f'<div class="rr"><span>{r[0]}</span><span>{r[1]}</span></div>' for r in s["rows"])
        paras = "".join(f"<p>{x}</p>" for x in p["paragraphs"])
        return (f'<div class="note"><div class="body"><span class="eyebrow">{roman} · {sec}</span><h2 class="hl">{p["headline"]}</h2>'
                f'<div class="pull">"{p["pull_quote"]}"</div>{paras}</div><div style="padding-top:26px"><div class="sumbox">'
                f'<span class="cap">{s["label"]}</span><div class="n">{s["name"]}</div><div class="s">{s.get("sub", "")}</div>'
                f'<div class="big">{s["big"]}</div><div class="cap" style="margin:6px 0 12px">{s["big_label"]}</div>{rows}'
                f'<p class="fine">{s.get("fine", "Premiums are quotes, not a binder of coverage, and are subject to carrier underwriting.")}</p>'
                f'</div></div></div><div class="finalbox"><span class="cap">Please note · How your final rate is set</span>'
                f'<h3>{final_words(self.d["lines"])[0]}</h3><p>{self.box_text}</p></div>')

    def page_comparison(self, roman, sec, p):
        why = p.get("why") or []
        whyh = (f'<div class="why n{len(why)}">' + "".join(
            f'<div class="{"rec" if w.get("recommended") else ""}"><b>{w["title"]}</b>{w["text"]}</div>' for w in why) + "</div>") if why else ""
        fine = f'<p class="fine">{p["fine"]}</p>' if p.get("fine") else ""
        return (self.title(roman, sec, p) + self.table(p.get("first_col", ""), self.cols(p), p["rows"], "t roomy")
                + fine + self.qr() + whyh)

    def page_table(self, roman, sec, p):
        out = self.title(roman, sec, p)
        for t in p.get("tables") or [p]:
            if t.get("label"):
                out += f'<div class="sl">{t["label"]}</div>'
            out += self.table(t.get("first_col", ""), self.cols(t), t["rows"], "t" + (" roomy" if p.get("roomy") else ""))
        if p.get("fine"):
            out += f'<p class="fine">{p["fine"]}</p>'
        if p.get("quoted_rates"):
            out += self.qr()
        why = p.get("why") or []
        if why:
            out += (f'<div class="why n{len(why)}">' + "".join(
                f'<div class="{"rec" if w.get("recommended") else ""}"><b>{w["title"]}</b>{w["text"]}</div>' for w in why) + "</div>")
        return out

    def page_exclusions(self, roman, sec, p):
        def items(lst):
            out = "<ul>"
            for it in lst:
                flag = '<span class="tag gold">Key difference</span> ' if it.get("key") else ""
                out += f'<li>{flag}<b>{it["title"]}</b>{it["text"]}</li>'
            return out + "</ul>"
        out = self.title(roman, sec, p)
        if p.get("common"):
            out += (f'<div class="ex-common"><span class="cap">{p.get("common_label", "Applies to every option")}</span>'
                    f'{items(p["common"])}</div>')
        cards = p.get("carriers") or []
        if cards:
            out += f'<div class="ex-cards n{len(cards)}">'
            for i, c in enumerate(cards):
                rec = " rec" if (i == self.rec and len(cards) > 1) else ""
                sub = c.get("sub", self.opts[i].get("sub", "") if i < len(self.opts) else "")
                out += (f'<div class="ex-card{rec}"><div class="n">{c["name"]}</div><div class="s">{sub}</div>'
                        f'{items(c["items"])}</div>')
            out += "</div>"
        if p.get("callout"):
            out += f'<div class="callout"><b>{p["callout"]["title"]}</b>{p["callout"]["text"]}</div>'
        if p.get("fine"):
            out += f'<p class="fine">{p["fine"]}</p>'
        return out

    def page_home(self, roman, sec, p):
        fine = f'<p class="fine">{p["fine"]}</p>' if p.get("fine") else ""
        return (self.title(roman, sec, p) + self.table(p.get("first_col", "Coverage"), self.cols(p), p["rows"]) + fine
                + self.discounts(p.get("discounts")))

    def page_auto(self, roman, sec, p):
        cards = p.get("cards") or []
        ch = (f'<div class="vc n{len(cards)}">' + "".join(
            f'<div><span class="cap">{c["cap"]}</span><div class="n">{c["name"]}</div><div class="s">{c.get("sub", "")}</div></div>'
            for c in cards) + "</div>") if cards else ""
        fine = f'<p class="fine">{p["fine"]}</p>' if p.get("fine") else ""
        return (self.title(roman, sec, p) + ch + self.table(p.get("first_col", "Coverage (same on all vehicles)"),
                                                           self.cols(p), p["rows"]) + fine + self.discounts(p.get("discounts")))

    def page_umbrella(self, roman, sec, p):
        s = p["summary"]
        rows = "".join(f'<div class="rr"><span>{r[0]}</span><span>{r[1]}</span></div>' for r in s.get("rows", []))
        stack = "".join(f'<div class="rr"><span>{r[0]}</span><span>{r[1]}</span></div>' for r in p.get("stack", []))
        inc = "".join(f'<div class="rr"><span>{x}</span><span>✓</span></div>' for x in p.get("included", []))
        call = (f'<div class="callout"><b>{p["callout"]["title"]}</b>{p["callout"]["text"]}</div>') if p.get("callout") else ""
        fine = f'<p class="fine">{p["fine"]}</p>' if p.get("fine") else ""
        return (self.title(roman, sec, p) + f'<div class="umb"><div class="sumbox"><span class="cap">{s["label"]}</span>'
                f'<div class="big">{s["big"]}</div><div class="cap" style="margin:6px 0 12px">{s.get("big_label", "")}</div>{rows}</div>'
                f'<div><div class="sl" style="margin-top:0">How it stacks up</div>{stack}'
                f'{"<div class=sl>Also included</div>" + inc if inc else ""}{call}</div></div>{fine}')

    def page_explained(self, roman, sec, p):
        out = self.title(roman, sec, p)
        for s in p["sections"]:
            out += f'<div class="sl">{s["title"]}</div><table class="ex">' + "".join(
                f"<tr><td>{a}</td><td>{b}</td></tr>" for a, b in s["rows"]) + "</table>"
        if p.get("callout"):
            out += f'<div class="callout"><b>{p["callout"]["title"]}</b>{p["callout"]["text"]}</div>'
        return out

    def page_property(self, roman, sec, p):
        stats = "".join(
            f'<div><span class="cap">{s["cap"]}</span><div class="v">{s["value"]}</div>'
            f'{"<div class=s>" + s["sub"] + "</div>" if s.get("sub") else ""}</div>' for s in p["stats"])
        if p.get("photo"):
            ph = pathlib.Path(p["photo"])
            mime = "image/png" if ph.suffix.lower() == ".png" else "image/jpeg"
            top = (f'<div class="photo-row"><img src="data:{mime};base64,{b64(ph)}" alt="Home exterior">'
                   f'<div class="stats">{stats}</div></div>')
        else:
            top = f'<div class="stats">{stats}</div>'
        specs = "".join(f"<tr><td>{a}</td><td>{b}</td></tr>" for a, b in p["specs"])
        roof = ""
        if p.get("roof"):
            r = p["roof"]
            roof = ('<div class="roof"><span class="cap">Roof</span><div style="margin-top:10px">' + "".join(
                f'<div class="rr"><span>{a}</span><span>{b}</span></div>' for a, b in r["rows"]) + "</div>"
                + (f'<p>{r["note"]}</p>' if r.get("note") else "") + "</div>")
        return self.title(roman, sec, p) + top + f'<div class="prop"><table class="spec">{specs}</table>{roof}</div>'

    def page_payment(self, roman, sec, p):
        cards = p["cards"]
        ch = (f'<div class="pay n{len(cards)}">' + "".join(
            f'<div class="pc{" best" if c.get("best") else ""}"><div class="h">{c["title"]}</div>'
            f'<div class="b">{self.rows_html(c["rows"])}</div></div>' for c in cards) + "</div>")
        fine = f'<p class="fine">{p["fine"]}</p>' if p.get("fine") else ""
        info = p.get("info") or []
        infoh = ('<div class="info">' + "".join(f'<div><b>{x["title"]}</b>{x["text"]}</div>' for x in info) + "</div>") if info else ""
        a, team = self.B["agent"], self.B.get("service_team") or []
        call = f'Reach me at {a["phone"]} or {a["email"]}'
        if len(team) == 1:
            m = team[0]
            call += f', or {m["first_name"]}, our {m["title"].lower()}, directly at {m["phone"]}'
        elif team:
            titles = {m["title"] for m in team}
            who = (f'our {team[0]["title"].lower()}s' if len(titles) == 1 else "our service team")
            call += f', or {who}, ' + " or ".join(f'{m["first_name"]} at {m["phone"]}' for m in team)
        step3_title, call_close = step_words(self.d["lines"])
        call += ". " + call_close
        st = p.get("steps", {})
        bind = self.bind_text + ((" " + st["bind_extra"]) if st.get("bind_extra") else "")
        steps = (f'<div class="sl" style="margin-top:26px">Next steps</div><div class="steps">'
                 f'<div><div class="r">i.</div><div class="k">Review &amp; choose</div><p>{st.get("review", "Pick the option and payment plan that fit your budget and the protection you want.")}</p></div>'
                 f'<div><div class="r">ii.</div><div class="k">Call or email</div><p>{call}</p></div>'
                 f'<div><div class="r">iii.</div><div class="k">{step3_title}</div><p>{bind}</p></div></div>')
        closing = final_words(self.d["lines"])[1]
        return (self.title(roman, sec, p) + ch + fine + infoh + steps + self.qr(p.get("qr_extra", ""))
                + f'<p class="fine" style="margin-top:16px">{closing}</p>')

    def build(self):
        if not self.content_pages or self.content_pages[-1]["type"] != "payment":
            raise ValueError("the last page must be type 'payment'")
        pages = [self.cover()]
        for i, p in enumerate(self.content_pages):
            n, roman = i + 2, ROMAN[i]
            sec = p.get("section") or SECTION_DEFAULTS[p["type"]]
            body = getattr(self, "page_" + p["type"])(roman, sec, p)
            pages.append(self.frame(n, sec, body))
        css = (SKILL / "template" / "proposal.css").read_text()
        root = ":root{" + "".join(f"--{k}:{v};" for k, v in self.B["colors"].items()) + "}"
        faces = []
        for m in json.loads((SKILL / "fonts" / "manifest.json").read_text()):
            faces.append("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) "
                         "format('woff2');unicode-range:%s;}" % (m["family"], m["style"], m["weight"], b64(SKILL / "fonts" / m["file"]),
                                                                 m["unicode_range"]))
        title = f'{self.d["client"]["last_name"]} {self.d["proposal_type"]} Proposal · {self.B["agency_display_name"]}'
        return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, '
                f'initial-scale=1"><title>{html.escape(title)}</title><style>{"".join(faces)}{root}{css}</style></head><body>'
                + "".join(pages) + "</body></html>")


# ----------------------------------------------------------------------------- rendering
MEASURE_JS = "() => [...document.querySelectorAll('.page')].map(p => Math.round(p.getBoundingClientRect().height))"


def render(html_path, pdf_path, preview_dir):
    """Returns list of page heights (or None if the engine can't measure)."""
    # 1) Python Playwright
    try:
        from playwright.sync_api import sync_playwright  # type: ignore
        with sync_playwright() as pw:
            kw = {}
            if os.environ.get("CHROME_PATH"):
                kw["executable_path"] = os.environ["CHROME_PATH"]
            br = pw.chromium.launch(**kw)
            pg = br.new_page(viewport={"width": 900, "height": 1200})
            pg.goto(pathlib.Path(html_path).resolve().as_uri(), wait_until="load")
            pg.evaluate("document.fonts.ready")
            heights = pg.evaluate(MEASURE_JS)
            if preview_dir:
                for i, el in enumerate(pg.query_selector_all(".page")):
                    el.screenshot(path=str(pathlib.Path(preview_dir) / f"page-{i + 1}.png"))
            pg.pdf(path=str(pdf_path), prefer_css_page_size=True, print_background=True,
                   margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
            br.close()
            return heights, "python-playwright"
    except ImportError:
        pass
    # 2) Node Playwright
    node = shutil.which("node")
    if node:
        js = SKILL / "scripts" / "render.js"
        r = subprocess.run([node, str(js), str(html_path), str(pdf_path), str(preview_dir or "")],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return json.loads(r.stdout.strip().splitlines()[-1]), "node-playwright"
    # 3) Chrome / Chromium command line (no measuring; page count check still applies)
    cands = [os.environ.get("CHROME_PATH"), "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
             "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
             "/Applications/Chromium.app/Contents/MacOS/Chromium"]
    cands += sorted(str(p) for p in pathlib.Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"))
    for c in cands:
        if not c:
            continue
        exe = shutil.which(c) or (c if os.path.exists(c) else None)
        if not exe:
            continue
        r = subprocess.run([exe, "--headless=new", "--no-pdf-header-footer", "--virtual-time-budget=4000",
                            f"--print-to-pdf={pdf_path}", pathlib.Path(html_path).resolve().as_uri()],
                           capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(pdf_path):
            return None, "chrome-cli"
    raise RuntimeError("No Chrome/Chromium renderer found. Install Google Chrome or Playwright, or set CHROME_PATH.")


def pdf_pages(path):
    data = pathlib.Path(path).read_bytes()
    return len(re.findall(rb"/Type\s*/Page(?![s\w])", data))


# ----------------------------------------------------------------------------- checks
def run_checks(data, brand, html_doc, n_pages, heights, pdf_count):
    res = []
    ok = lambda name, cond, detail="": res.append((name, bool(cond), detail))
    text = re.sub(r"<style.*?</style>", " ", html_doc, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    text = re.sub(r"\s+", " ", text)
    pages = re.findall(r'<section class="page[^"]*" data-page="\d+">.*?</section>', html_doc, flags=re.S)
    plain = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", p))) for p in pages]
    cover, last = plain[0], plain[-1]
    a = brand["agent"]
    ok("Page count matches design (no overflow sheet)", pdf_count == n_pages, f"PDF sheets {pdf_count} vs pages {n_pages}")
    if heights is not None:
        over = [i + 1 for i, h in enumerate(heights) if h > PAGE_H]
        ok("Every page fits its 1100px sheet", not over, f"overflowing pages: {over}" if over else "")
    ok("Agent name on cover", a["name"] in cover, a["name"])
    ok("Agent email + phone on cover", a["email"] in cover and a["phone"] in cover)
    ok("Agent in Next Steps", a["phone"] in last and a["email"] in last)
    for m in brand.get("service_team") or []:
        ok(f'Service contact {m["name"]} on cover', m["name"] in cover and m["phone"] in cover and m["email"] in cover)
        ok(f'{m["first_name"]} in Next Steps (Call or email)', m["first_name"] in last and m["phone"] in last)
    ok("'Quoted rates' bar on cover", "Quoted rates" in cover)
    ok("'Quoted rates' bar on payment page", "Quoted rates" in last)
    for i, p in enumerate(data["pages"]):
        if p["type"] == "comparison":
            ok("'Quoted rates' bar on comparison page", "Quoted rates" in plain[i + 1])
        if p["type"] == "note":
            ok("Final-rate box on agent-note page", "How your final rate is set" in plain[i + 1])
    want3 = html.unescape(step_words(data["lines"])[0])
    ok(f"Step iii is '{want3}'", want3 in last)
    for bp in brand.get("banned_phrases", []):
        hit = bp.lower() in text.lower() if bp.lower() == "full coverage" else bp in text
        ok(f'Banned phrase absent: "{bp}"', not hit)
    has_ex = any(pg["type"] == "exclusions" for pg in data["pages"])
    if "disability" in data["lines"]:
        ok("Exclusions & Limitations section present (required for disability)", has_ex)
    else:
        ok("Exclusions & Limitations section present (or no_exclusions_noted set)", has_ex or data.get("no_exclusions_noted"))
    ok("Brand name never shortened", not re.search(r"(?<!The )Jordan Insurance(?! Agency)", text))
    ok("No placeholders left", not re.search(r"\{\{|\bTODO\b|\bXXX\b|\bREPLACE\b|lorem ipsum", text))
    for c in data.get("checks", []):
        total = sum(money(x) for x in c["parts"])
        want = money(c["total"])
        ok(f'Math: {c["label"]}', abs(total - want) < 0.005, f"parts sum {total:,.2f} vs shown {want:,.2f}")
        ok(f'Math value appears in proposal: {c["total"]}', c["total"].replace("– ", "").strip() in text or c.get("hidden"))
    return res


# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("proposal_json")
    ap.add_argument("--out", default=".")
    ap.add_argument("--preview", action="store_true", help="also save page PNGs for visual review")
    args = ap.parse_args()
    data = json.loads(pathlib.Path(args.proposal_json).read_text())
    brand = json.loads((SKILL / "branding.json").read_text())
    b = Builder(data, brand)
    doc = b.build()
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    html_path = out / b.file_name.replace(".pdf", ".html")
    pdf_path = out / b.file_name
    html_path.write_text(doc)
    prev = None
    if args.preview:
        prev = out / "preview"
        prev.mkdir(exist_ok=True)
    heights, engine = render(html_path, pdf_path, prev)
    n_pdf = pdf_pages(pdf_path)
    results = run_checks(data, brand, doc, b.total, heights, n_pdf)
    spec = importlib.util.spec_from_file_location("build_email", SKILL / "scripts" / "build_email.py")
    em = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(em)
    email_text = em.write_email(data, brand, out, data["client"]["last_name"]) if (data.get("email") or {}).get("greeting") else ""
    results += em.email_checks(data, brand, email_text)
    print(f"Rendered with {engine}: {pdf_path}")
    if email_text:
        print(f'Client email: {out / (data["client"]["last_name"] + "_Proposal_Email.txt")} (+ .html)')
    fails = 0
    for name, passed, detail in results:
        fails += not passed
        print(f'  [{"PASS" if passed else "FAIL"}] {name}{(" — " + detail) if detail and not passed else ""}')
    print(f"{len(results) - fails}/{len(results)} checks passed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
