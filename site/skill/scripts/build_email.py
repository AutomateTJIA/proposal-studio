#!/usr/bin/env python3
"""Client email for a proposal — locked template, filled from proposal.json + branding.json.

The structure, greeting, closing, service-team line and signature are fixed here so every email
sounds the same no matter who builds it. Only the client-specific pieces come from the
proposal's `email` block (see references/data-format.md → "email"): greeting, 1-3 reasons, and at
most one heads-up line. The email stays short on purpose; the proposal does the heavy lifting.

Called automatically by build_proposal.py; can also run alone:
    python3 build_email.py proposal.json --out <folder>
"""
import argparse, html, json, pathlib, re, sys

SKILL = pathlib.Path(__file__).resolve().parent.parent

LINE_LABEL = {"Bundle": "home & auto", "Auto": "auto", "Home": "homeowners", "Landlord": "landlord",
              "Condo": "condo", "Renters": "renters", "Disability": "disability income"}


def _plain(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def _lc(s):
    return s[:1].lower() + s[1:] if s[1:2].islower() else s


def _join(names, last="and"):
    names = list(names)
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + f" {last} " + names[-1]


MAX_REASONS = 3          # "why we recommend" bullets
MAX_HEADS_UP = 1         # one "before you decide" line, only when something is pending
MAX_WORDS = 170          # everything above the closing; the proposal does the explaining


def compose(data, brand):
    """Return (subject, blocks). blocks = list of ("p", text) / ("ul", [items]) / ("sig", [lines]).

    Short by design: the carriers and prices, the recommendation with 1-3 reasons, and a pointer to
    the proposal (side by side, coverages explained, what isn't covered). No page-by-page recap."""
    e = data.get("email") or {}
    opts = data["options"]
    names = [o["name"] for o in opts]
    di = "disability" in data["lines"]
    label = LINE_LABEL.get(data["proposal_type"], data["proposal_type"].lower())
    rec = next((o for o in opts if o.get("recommended")), None) if len(opts) > 1 else None
    # Two options from the same carrier (e.g. two National General limit levels) are told apart by tag.
    dup = {n for n in names if names.count(n) > 1}
    disp = lambda o: f'{o["name"]} ({_plain(o.get("tag", ""))})' if o["name"] in dup and o.get("tag") else o["name"]
    carriers = list(dict.fromkeys(names))
    if e.get("subject"):
        subject = _plain(e["subject"])
    elif len(carriers) == 1:
        subject = f"Your {label} proposal from {carriers[0]}"
    elif len(carriers) == 2:
        subject = f"Your {label} proposal: {carriers[0]} and {carriers[1]}, side by side"
    else:
        subject = f"Your {label} proposal: {_join(carriers)} compared"


    if len(opts) == 1:
        opening = f"Thank you for the chance to quote your {'disability coverage' if di else 'insurance'}. Your {label} proposal from {names[0]} is attached."
    else:
        what_cmp = _join(carriers) if len(carriers) > 1 else f"{len(opts)} options from {carriers[0]}"
        opening = f"Thank you for the chance to shop your {'disability coverage' if di else 'insurance'}. Your {label} proposal is attached, comparing {what_cmp}."
    blocks = [("p", f"Hi {_plain(e['greeting'])},"), ("p", opening)]

    price_lines = [_plain(x) for x in e.get("price_lines") or []] or \
                  [f'{disp(o)}: {o["price"]} ({_lc(_plain(o.get("price_label", "12 months")))})' for o in opts]
    if rec:
        i = opts.index(rec)
        if i < len(price_lines) and "recommend" not in price_lines[i].lower():
            price_lines[i] += " · our recommendation"
    blocks.append(("ul", price_lines))

    reasons = [_plain(x) for x in e.get("reasons") or []][:MAX_REASONS]
    if reasons:
        blocks += [("p", f"Why we recommend {disp(rec)}:" if rec else "What stands out:"), ("ul", reasons)]

    ex_idx = next((i for i, p in enumerate(data["pages"]) if p["type"] == "exclusions"), None)
    what = "plan" if di else "policy"
    pointer = ("The proposal lays out each option side by side and explains every coverage in plain language."
               if len(opts) > 1 else "The proposal lays out your coverage and explains it in plain language.")
    if ex_idx is not None:
        pointer += (f" Page {ex_idx + 2} shows what {'each' if len(opts) > 1 else 'this'} {what} "
                    f"{'won’t pay for' if di else 'won’t cover'}. Please read it before you decide.").replace("’", "'")
    blocks.append(("p", pointer))

    heads = [_plain(x) for x in e.get("heads_up") or []][:MAX_HEADS_UP]
    if heads:
        blocks.append(("p", heads[0]))

    a, team = brand["agent"], brand.get("service_team") or []
    close = "we can start your application right away" if di else "we can bind the same day"
    team_txt = _join([f'{m["name"]} at {m["phone"]}' for m in team], "or")
    last = f"When you're ready, reply to this email or call me at {a['phone']}, and {close}."
    if team_txt:
        last += f" If I'm not available, {team_txt} can help."
    blocks.append(("p", last))
    blocks.append(("sig", ["Thank you,", "", a["name"], brand["agency_display_name"],
                           f'{a["phone"]} · {a["email"]}', brand["website"]]))
    return subject, blocks


def body_words(text):
    """Words between the greeting and the closing line (what the client actually has to read)."""
    body = text.split("When you're ready", 1)[0]
    body = body.split("\n", 2)[-1] if body.startswith("Subject:") else body
    return len(re.findall(r"[A-Za-z0-9$][^\s]*", body))


def to_text(subject, blocks):
    out = [f"Subject: {subject}", ""]
    for kind, val in blocks:
        if kind == "p":
            out += [val, ""]
        elif kind == "ul":
            out += [f"- {x}" for x in val] + [""]
        else:
            out += val
    return "\n".join(out).rstrip() + "\n"


def to_html(subject, blocks, brand):
    c = brand["colors"]
    font = "font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:%s" % c["ink"]
    parts = []
    for kind, val in blocks:
        if kind == "p":
            parts.append(f'<p style="margin:0 0 14px">{html.escape(val)}</p>')
        elif kind == "ul":
            parts.append('<ul style="margin:0 0 14px;padding-left:22px">' +
                         "".join(f'<li style="margin:0 0 6px">{html.escape(x)}</li>' for x in val) + "</ul>")
        else:
            thanks, _, name, agency, contact, web = val
            parts.append(f'<p style="margin:18px 0 4px">{html.escape(thanks)}</p>'
                         f'<p style="margin:0;padding-top:10px;border-top:2px solid {c["gold"]};display:inline-block">'
                         f'<b style="color:{c["navy"]};font-size:16px">{html.escape(name)}</b><br>'
                         f'{html.escape(agency)}<br>{html.escape(contact)}<br>'
                         f'<a href="https://{web}" style="color:{c["royal"]}">{html.escape(web)}</a></p>')
    return (f'<!doctype html><html><head><meta charset="utf-8"><title>{html.escape(subject)}</title></head>'
            f'<body style="margin:0;background:#ffffff">'
            f'<div style="max-width:640px;margin:0 auto;padding:24px;{font}">'
            f'<div style="background:{c["navy"]};color:#ffffff;padding:14px 20px;margin-bottom:22px;'
            f'font-size:13px;letter-spacing:.12em;text-transform:uppercase;border-bottom:3px solid {c["gold"]}">'
            f'{html.escape(brand["agency_display_name"])}</div>'
            + "".join(parts) + "</div></body></html>")


def email_checks(data, brand, text):
    res = []
    ok = lambda name, cond, detail="": res.append((name, bool(cond), detail))
    e = data.get("email") or {}
    ok("Client email written (`email` block with greeting)", e.get("greeting"))
    if not e.get("greeting"):
        return res
    a = brand["agent"]
    ok("Email: agent phone + email in signature", a["phone"] in text and a["email"] in text)
    for m in brand.get("service_team") or []:
        ok(f'Email: {m["name"]} listed', m["name"] in text and m["phone"] in text)
    for o in data["options"]:
        ok(f'Email: {o["name"]} price {o["price"]} shown', o["price"] in text)
    ok(f"Email: at most {MAX_REASONS} reasons", len(e.get("reasons") or []) <= MAX_REASONS,
       f'{len(e.get("reasons") or [])} given; keep the strongest {MAX_REASONS}')
    ok(f"Email: at most {MAX_HEADS_UP} heads-up line", len(e.get("heads_up") or []) <= MAX_HEADS_UP,
       "keep only the one thing the client must act on; everything else belongs in the proposal")
    n = body_words(text)
    ok(f"Email: short (under {MAX_WORDS} words before the closing)", n <= MAX_WORDS,
       f"{n} words; shorten the reasons, the proposal does the explaining")
    rec = next((o for o in data["options"] if o.get("recommended")), None)
    if rec and len(data["options"]) > 1:
        ok(f'Email: names the recommendation ({rec["name"]})', f"recommend {rec['name']}" in text)
    for bp in brand.get("banned_phrases", []):
        hit = bp.lower() in text.lower() if bp.lower() == "full coverage" else bp in text
        ok(f'Email: banned phrase absent: "{bp}"', not hit)
    ok("Email: no placeholders left", not re.search(r"\{\{|\bTODO\b|\bXXX\b|\bREPLACE\b|lorem ipsum", text))
    return res


def write_email(data, brand, out_dir, last_name):
    subject, blocks = compose(data, brand)
    text = to_text(subject, blocks)
    out = pathlib.Path(out_dir)
    (out / f"{last_name}_Proposal_Email.txt").write_text(text)
    (out / f"{last_name}_Proposal_Email.html").write_text(to_html(subject, blocks, brand))
    return text


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("proposal_json")
    ap.add_argument("--out", default=".")
    args = ap.parse_args()
    data = json.loads(pathlib.Path(args.proposal_json).read_text())
    brand = json.loads((SKILL / "branding.json").read_text())
    pathlib.Path(args.out).mkdir(parents=True, exist_ok=True)
    text = write_email(data, brand, args.out, data["client"]["last_name"])
    fails = 0
    for name, passed, detail in email_checks(data, brand, text):
        fails += not passed
        print(f'  [{"PASS" if passed else "FAIL"}] {name}{(" — " + detail) if detail and not passed else ""}')
    print(text)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
