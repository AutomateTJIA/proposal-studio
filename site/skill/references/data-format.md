# proposal.json — field reference

Everything client-facing that varies per proposal lives in this one file. Values may contain simple
HTML (`<b>`, `<br>`, `&amp;`). Money is written exactly as shown to the client (e.g. `"$3,667.06"`,
`"– $92.00"`, `"+ $231.18"`). Never put the agent, the service team (Chelssy, Gloria), the agency phone/address, notices or
Next Steps "Call or email" text here — the script adds those from `branding.json`.

## Top level

| Field | Required | Notes |
|---|---|---|
| `proposal_type` | yes | `"Bundle"`, `"Auto"`, `"Home"`, `"Landlord"`, `"Disability"` — used in the file name |
| `lines` | yes | any of `"auto"`, `"home"`, `"landlord"`, `"condo"`, `"renters"`, `"disability"` — picks the notice wording (MVR for auto; property/claims verification for home; both for bundles; medical + financial underwriting for disability, with Next Step iii "Apply &amp; final rate") |
| `prepared` | yes | `YYYY-MM-DD` (today) — proposal number and cover date |
| `term` | no | default `"12 months"` |
| `client` | yes | `last_name`, `full_names` ("Sam &amp; Pat Sample"), `address_line` (cover: "100 Example Lane · Charlotte, NC 28277"), `address_short` ("100 Example Ln, Charlotte, NC 28277") |
| `options` | yes | 1–3 entries, in the order the columns should appear (recommended first). See below |
| `cover` | yes | see below |
| `pages` | yes | ordered list of content pages; the last must be `payment` |
| `checks` | yes | math checks — see bottom |
| `no_exclusions_noted` | no | `true` only when a non-disability quote genuinely lists no exclusions or limits worth showing; otherwise the build fails without an `exclusions` page. Never allowed for disability |

### `options[]`
`name` (cover card title), `sub` (e.g. "Safeco home · American States auto"), `tag` (e.g. "Best value",
"Option", "Option 3 · Highest limits"), `price`, `price_label` ("Home + auto · 12 months",
"Paid in full · 12 months"), `col_title` / `col_sub` (comparison-table header), `recommended: true`
on exactly one option when there is more than one. The recommended option gets the gold card and
the highlighted table column.

### `cover`
`eyebrow` ("Home &amp; Auto Bundle Proposal" / "Personal Auto Proposal" / "Homeowners Proposal"),
`headline` ("Three bundles, side by side, for Sam &amp; Pat" — must fit two lines),
`subtext` (one or two sentences), optional `strip` {`tag`, `text`, `right`} for one extra callout
(re-quote needed, optional umbrella, etc.), `insured_lines` (1–3 short lines; first line is darker),
optional `insured_label` (default "Insured property &amp; vehicles"; use "Insured vehicles" for auto),
`premium_label` ("Best-value annual premium" / "12-month premium"), `premium_value`, `premium_note`.

## Pages

Every page takes `headline` (one line on inner pages), optional `section` (overrides the default
section title in the eyebrow and header), and most take optional `address`, `lede`, `fine`.

**`note`** — `headline` ("Sam &amp; Pat, thank you."), `pull_quote` (no quote marks),
`paragraphs` (3 short paragraphs: thanks + what was quoted; why the recommendation wins with real
numbers; any caveat + call to bind), `summary` {`label`, `name`, `sub`, `big`, `big_label`, `rows`
[[label, value]…], `fine`}. The navy "How your final rate is set" box is added automatically.

**`comparison`** — `rows`: lists `[label, v1, v2, v3]` (one value per option) or
`{"label", "values": [...], "total": true}` for the bold total row. Optional `first_col`, `columns`
(defaults to each option's `col_title`/`col_sub`), `fine`, `why` [{`title`, `text`, `recommended`}].
"Quoted Rates" bar added automatically after the table.

**`home`** — `columns` [{`title`, `sub`}] (carrier/company names), `rows` (as above, Coverage A–F,
deductibles, roof settlement, endorsements with premiums, "12-month home premium" total row),
optional `discounts` [{`title`, `text`}] (one per carrier).

**`auto`** — `cards` [{`cap`, `name`, `sub`}] for each vehicle plus a Drivers card, `first_col`
("Coverage (same on both vehicles)"), `columns`, `rows` (limits, deductibles, per-vehicle premiums,
policy-level charges, "12-month auto premium" total, "Paid in full" row if offered), `fine`
(footnotes), `discounts`.

**`umbrella`** (only when an umbrella was actually quoted) — `summary` {`label`, `big`, `big_label`,
`rows`}, `stack` [[layer, limit]…], `included` [text…], optional `callout` {`title`, `text`}, `fine`.

**`exclusions`** (required — see `references/writing-rules.md` → "Exclusions & limitations") —
`headline` ("What these policies won't cover." / "What these plans won't pay for."), `lede`,
`common` [{`title`, `text`, `line`}] — exclusions that apply to every option (shown in two columns; use an even
number when you can), optional `common_label` (default "Applies to every option"; single carrier:
"Exclusions &amp; limits in this quote"), `carriers` [{`name`, `items` [{`title`, `text`, `key`, `line`}]}] — one card
per option, same order as `options` (`sub` defaults to the option's `sub`; the recommended card gets the
gold top). `key: true` adds a gold "Key difference" tag — use it for the one or two items that most
separate a carrier from the others. Optional `callout` {`title`, `text`} (e.g. "Closing the gaps"), `fine`.
Single carrier: put everything in `common` and leave out `carriers`.
`line` ("home", "auto", "umbrella", or "all" for something that applies to every policy) files the item
under that policy's heading on the page. **Required on every item when the proposal has more than one
line** (home + auto); the build fails if one is missing. Single-line proposals can leave it out.

**`explained`** — `sections` [{`title`: "Your home" | "Your autos", `rows`: [[name, explanation]…]}],
optional `callout` {`title`, `text`} (e.g. "Why higher limits matter without an umbrella").
Use `references/coverage-explanations.md`; only include coverages that are actually in the quotes.

**`property`** — `stats` [{`cap`, `value`, `sub`}] (reconstruction estimate first, then year built,
living area, stories), optional `photo` (path to a JPG/PNG — only if the agent supplied one),
`specs` [[label, value]…], optional `roof` {`rows`, `note`}.

**`table`** — a generic table page for anything else (disability options grid, rider-by-rider premiums).
`section` (eyebrow/header title, default "Your Options"), `headline`, `lede`, and either one table
(`first_col`, `rows`, optional `columns`) or several under `tables` [{`label`, `first_col`, `rows`}];
optional `fine`, `why` cards, `quoted_rates: true` to add the Quoted Rates bar, `roomy: true`.

**`payment`** — `cards` (one per option, same order): `title` ("Best value · Liberty Mutual"),
`best: true` on the recommended one, `rows`: `[label, value]`, `{"label", "value", "total": true}`,
`{"sub": "Monthly EFT"}`. Optional `fine`, `info` (0–2 boxes [{`title`, `text`}] — e.g. "About the
umbrella", "Future savings: add your home", "About the property damage limit"), `steps`
{`review`: step-i text, `bind_extra`: sentence appended to step iii (e.g. a carrier start date)},
`qr_extra` (sentence appended to the Quoted Rates bar, e.g. "Safeco is quoted to start October 26, 2026.").

## `email` (required)
The client email is built from a locked, **short** template (`scripts/build_email.py`). The proposal
does the heavy lifting (plans side by side, every coverage explained, what isn't covered); the email
only names the carriers, the prices and the recommendation, and points to the proposal. Subject,
thanks, price lines (recommended one marked "our recommendation"), the "Why we recommend X:" heading,
the pointer to the proposal and its "won't cover" page, the closing, the service-team line and the
signature are automatic. You supply only (plain text, no HTML):

| Field | Required | Notes |
|---|---|---|
| `greeting` | yes | first names as you'd say them: "Kamari and Sonya" |
| `reasons` | yes when 2+ options | **1–3 bullets**, one short sentence each, real numbers: why the recommended option wins. Single carrier: 1–3 bullets on what stands out. The build fails with more than 3 |
| `heads_up` | no | **at most 1** short sentence, only for something the client must know or do before deciding (a pending re-quote, a start date to confirm). Upsells, exclusions and coverage detail belong in the proposal, not here. The build fails with more than 1 |
| `price_lines` | no | one line per option, e.g. "Chubb: $10,503.01 for 12 months (home $5,179.00 + auto $5,324.01)"; default is "<name>: <price> (<price_label>)" |
| `subject` | no | override only if the automatic subject doesn't fit |

The build fails if the email runs over 170 words before the closing line. Don't write `intro`,
`recommendation` or `other` (older fields); they are ignored.

## `checks`

One entry per number you calculated (totals, differences, savings, combined payments):
`{"label": "Liberty Mutual bundle", "parts": ["$2,246.00", "$1,421.06"], "total": "$3,667.06"}`.
Use a leading minus for subtraction: `"parts": ["$3,898.24", "-$3,667.06"], "total": "$231.18"`.
The build fails if a sum is off by a cent or if the total doesn't appear in the proposal.
