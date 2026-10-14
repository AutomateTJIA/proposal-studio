# Changelog — tjia-proposal-builder

Rule: every change to the design, people or wording is made in these files, gets a new version
number in `VERSION`, and gets an entry here. Changes made only inside a chat are lost next session.

## 3.4.0 — 2026-10-14
- Every proposal now comes with its **client email**, built from a locked template
  (`scripts/build_email.py`): automatic subject, thanks, "The short version" price lines, the
  "Page N lists what… won't cover" line, closing ("bind the same day" / "start your application"),
  the Chelssy + Gloria line and Billy's signature. Saved as `<Last>_Proposal_Email.txt` (paste into
  Gmail) and `.html` (for sending tools).
- New required `email` block in `proposal.json` for the client-specific sentences; the build checks
  the email for prices, the recommendation, the team, banned phrases and placeholders.
- All four examples include an email block.

## 3.3.0 — 2026-10-09
- New **Exclusions & Limitations** section on every proposal (`exclusions` page): exclusions shared by
  all options in one panel, then a card per carrier with its own exclusions and limits; the biggest
  differences carry a gold "Key difference" tag. Optional "Closing the gaps" callout.
- The build now fails if a disability proposal has no exclusions page, and if any other proposal has
  none unless `no_exclusions_noted` is set on purpose.
- Writing rules, extraction notes and data format updated; all four examples include the new page.

## 3.2.0 — 2026-10-09
- Added **Gloria Lechuga**, Agency Support Specialist, Direct (704) 469-5290 · gloria@agencyhlpc.com,
  to the service team. Both Chelssy and Gloria now appear on every proposal, every line of business:
  cover ("Your service team", three columns: agent + two specialists) and Next Steps "Call or email"
  ("…or our agency support specialists, Chelssy at … or Gloria at …"). Checks verify both.
- Cover: agency website moved under the agent's address to make room for the team; header spacing
  tightened so covers with a callout strip still fit one sheet.

## 3.1.0 — 2026-10-09
- Added individual disability income proposals (`"lines": ["disability"]`): underwriting-based
  Quoted Rates / final-rate wording ("Your final premium is set by underwriting"), Next Step iii
  "Apply & final rate", and "We can start your application right away" in place of same-day binding.
- Added a generic `table` page type (options grids, rider-by-rider premiums, any extra table).
- Added disability extraction notes (The Standard, Principal, MassMutual), writing rules, plain-language
  explanations, and `examples/example-disability-3-carriers.json` (fictional client).
- Home, auto and bundle output unchanged; all examples rebuilt and passing.

## 3.0.0 — 2026-10-09
Why: the skill library held the blank vendor version (v1) instead of the agency's customized
version (v2), and the approved proposal design had never been saved into any version — it only
existed in past chats. Proposals built from the library copy came out generic.

- Locked the approved design (the approved 09/30/2026 bundle and 10/07/2026 auto proposals) as a fixed stylesheet
  (`template/proposal.css`) and page builder (`scripts/build_proposal.py`). Claude no longer
  designs pages; it fills in `proposal.json`.
- Carried forward everything from v2: agency details, "P-" proposal numbers, navy/royal/gold
  colors, logo, agent **Billy Jordan Jr.** (never "Billy E."), service contact **Chelssy Valles**
  on the cover and in Next Steps.
- Added the white cover logo, "Quoted Rates" bars, the "How your final rate is set" box and
  Next Step iii "Bind & final rate" (from the approved 10/07/2026 auto proposal) — automatic on every proposal, with
  wording for auto, home, or bundle.
- Added automatic checks run on every build: page count/overflow, agent + Chelssy present,
  notices present, banned phrases, placeholders, and every math check.
- Removed first-run setup and placeholder branding. Renamed internally to `tjia-proposal-builder`.

## 2.0.0 — 2026-10-01 (Drive: proposal-builder-skill.zip)
- Agency branding filled in, logo added, agent block and service team (Chelssy) added with the
  rule to show the service contact on the cover and in Next Steps. Design file unchanged from v1.

## 1.0.0 — 2026-09-30 (Drive: proposal-builder.zip)
- Vendor download, blank branding, cream/gold editorial design.
