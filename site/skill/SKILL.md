---
name: tjia-proposal-builder
description: "The Jordan Insurance Agency's client proposal builder (v3, locked design). Use whenever someone attaches one or more carrier quote PDFs (auto, home, landlord/dwelling, home + auto bundle, or individual disability income; one carrier or several, including multiple waiting-period/benefit-period versions) and asks for a proposal, comparison, presentation or client-ready document. Produces the agency's approved proposal: white pages, navy cover, side-by-side carrier tables, agent Billy Jordan Jr. and the full service team (Chelssy Valles and Gloria Lechuga), Quoted Rates / final-rate notices, rendered to PDF with a fixed template and verified by automatic checks."
---

# The Jordan Insurance Agency — Proposal Builder (v3)

**Version:** see `VERSION`. **What changed and why:** see `CHANGELOG.md`.

This skill is LOCKED. The design, branding, people and notices are fixed in files — your job is
only to read the quotes accurately, write the client-facing words, and run the build script.
Do not run any "first-time setup", do not ask for branding, colors, logo or the agent's email,
and do not hand-design HTML. If something looks wrong in the design, fix it in the skill files
on purpose (bump `VERSION`, add a `CHANGELOG.md` entry) — never with one-off changes.

## What is locked (never re-decide these)

| Item | Where it lives |
|---|---|
| Logo (color + white cover version), navy/royal/gold colors, fonts | `assets/`, `branding.json`, `fonts/` |
| Page design (white pages, navy cover block, tables, cards, footer, navy/gold bottom bar) | `template/proposal.css` + `scripts/build_proposal.py` |
| Agent block: **Billy Jordan Jr.** · (704) 926-7565 · billy@thejordaninsuranceagency.com — never "Billy E." or "Billy Edward" | `branding.json → agent` |
| Service team: **Chelssy Valles** (Direct (980) 285-1135 · chelssy@agencyhlpc.com) and **Gloria Lechuga** (Direct (704) 469-5290 · gloria@agencyhlpc.com), both Agency Support Specialists — every member on the cover AND in Next Steps "Call or email", on every proposal for every line | `branding.json → service_team` |
| "Quoted Rates" bar (cover, comparison page, payment page), "How your final rate is set" box (agent-note page), Next Step iii "Bind & final rate" | injected by the script; wording chosen from `lines` (auto / home / both) |
| **Exclusions & Limitations** page on every proposal: what all options exclude, then one card per carrier with its own exclusions/limits, biggest differences tagged "Key difference" | `exclusions` page in `proposal.json`; the build fails without it (disability always; other lines unless `no_exclusions_noted` is set) |
| **Client email** (subject, greeting, short version, recommendation, "a few things to know" with the exclusions page number, closing, Chelssy + Gloria line, signature) produced with every proposal as `<Last>_Proposal_Email.txt` + `.html` | `scripts/build_email.py`; the client-specific sentences come from the `email` block in `proposal.json` |
| Proposal number `P-YYYY-MMDD-<last initial>`, file name `<Last>_<Type>_Proposal_The-Jordan-Insurance-Agency.pdf` | script |

Staff changes (add/remove a CSR, new phone) = edit `branding.json → service_team` only, then bump the version. The cover and Next Steps adjust automatically for 1–3 team members.

## Workflow

1. **Read every quote PDF completely** (use `pdftotext -layout` or the Read tool). Pull every number
   listed in `references/quote-extraction.md` — including every exclusion and limitation the quote
   states (they go on the Exclusions & Limitations page). Note anything that conflicts between carriers
   (names, garage size, roof age, effective dates, driving record) — these go in your summary to
   the agent, and only into the proposal where the reference examples show them (e.g. garage
   "2-car per Safeco; 1-car per Travelers").
2. **Decide the recommendation** using the rules in `references/writing-rules.md` → "Choosing the
   recommendation". Flag anything uncertain to the agent instead of guessing.
3. **Write `proposal.json`** in a working folder, following `references/data-format.md`.
   Start from the closest example in `examples/` (bundle with 3 carriers, auto with 3 options,
   single-carrier home, disability with 3 carriers) and replace every value. Copy numbers exactly as the carrier printed them.
   Add a `checks` entry for every total, difference, discount and monthly figure you computed.
   Fill in the `email` block (greeting, intro, recommendation, reasons, heads-up items) — the build
   writes the client email from it and fails without it.
4. **Build:**
   ```
   python3 <skill-dir>/scripts/build_proposal.py proposal.json --out <output-folder> --preview
   ```
   The script renders with headless Chrome (Python Playwright → Node Playwright → Chrome CLI) and
   then runs the checks: page count / overflow, agent and every service-team member on the cover and in Next Steps,
   notices present, Exclusions & Limitations page present, banned phrases ("full coverage", "Billy E. Jordan", abbreviations of the agency
   name), placeholders, and every math check.
5. **If any check fails, fix `proposal.json` and rebuild.** Overflowing page → shorten that page's
   text or drop a low-value table row (never shrink fonts or edit the CSS for one proposal).
   Never deliver a proposal with a failing check.
6. **Look at the preview PNGs** (`<output-folder>/preview/page-N.png`) for anything the checks
   can't see: awkward wraps, a headline on three lines, a value in the wrong column.
7. **Deliver the PDF and the client email** (`<Last>_Proposal_Email.txt`, paste-ready; `.html` for sending
   tools) and give the agent a short summary: client, carriers, recommendation and
   why, page count, "all checks passed", and a bullet list of anything they must verify before
   sending (data conflicts, stale effective dates, items that need a re-quote, NC consent-to-rate
   forms when a quote's premium exceeds the approved rate).

## Page set (pick per proposal; payment is always last)

| Proposal | Pages after the cover |
|---|---|
| Bundle, several carriers | note → comparison → home → auto → (umbrella, if quoted) → exclusions → explained → property → payment |
| Auto, several options | note → comparison (`"section": "Option Comparison"`) → auto → exclusions → explained → payment |
| Home / landlord, several carriers | note → comparison → home → exclusions → explained → property → payment |
| Single carrier (any line) | note → home and/or auto → exclusions → explained → (property) → payment — no comparison page |
| Disability income, several carriers | note → comparison (`"section": "Carrier Comparison"`) → table (options grid: waiting period × benefit period, annual and monthly) → table (`"section": "Coverage Details"`, base + rider premiums) → exclusions → explained → payment |

## Files

- `references/data-format.md` — every field of `proposal.json`, page by page.
- `references/writing-rules.md` — voice, recommendation rules, what to say about driving records,
  umbrellas, re-quotes; phrases never to use.
- `references/quote-extraction.md` — what to pull from each carrier's quote and where it usually is.
- `references/coverage-explanations.md` — approved plain-language explanations for the
  "Plain language. Real protection." page.
- `examples/*.json` — complete, passing examples (fictional clients): bundle with 3 carriers, auto with
  3 options, single-carrier home, disability with 3 carriers. Build one to see the design.
