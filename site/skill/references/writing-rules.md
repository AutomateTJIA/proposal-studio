# Writing rules

## Voice
- Warm, plain, confident. Short sentences. Talk to the client by first names ("Sam &amp; Pat").
- Every claim uses the real number from the quote ("$231.18 a year less than Travelers").
- First person singular for the agent ("Call or email me"), "we" for the agency.
- Agency name is always "The Jordan Insurance Agency" in full. Never "TJIA", "JIA", "Jordan Insurance".
- Never write "full coverage". Never promise a price: these are quotes.

## Choosing the recommendation
1. Compare like for like. If one carrier is cheaper because a limit is lower (e.g. $50,000 property
   damage vs $100,000), say so, and recommend raising it with a re-quote rather than hiding it.
2. Best value = lowest price **after** matching the important limits, with no hidden weak spot
   (low liability, separate wind/hail deductible, roof paid at actual cash value, missing water back-up).
3. Driving record: check whether each auto quote reflects the same record. Signals: an accident
   listed on one quote; an "Accident free" discount on another (that carrier saw a clean record);
   a "Violation free" discount (tickets only, not accidents). If a quote looks priced on a cleaner
   record than the others, flag it to the agent — don't assert it to the client.
4. If the answer is genuinely uncertain, recommend the safer choice and tell the agent why in your
   summary; never present a guess as fact.
5. If no option is clearly best (e.g. auto options trading price for limits), label options by what
   they're best at ("Option 2 · Lowest premium", "Option 3 · Highest limits") and highlight the one
   with the strongest protection, as in examples/example-auto-3-options.json.

## Disability income
- Compare at the same waiting period and benefit period first (usually 90 days, to age 65), then show
  every alternate the carriers priced on a `table` page (annual and monthly).
- What separates plans: monthly benefit, definition of disability (own occupation / true own
  occupation), partial/residual threshold (% income loss), noncancelable vs guaranteed renewable,
  mental-disorder/substance limitation (e.g. 24 months vs unlimited), built-in extras, future
  increase options, installment charges, discounts that depend on how they apply (e.g. eApply).
- Never state a limitation the quote doesn't show — write "See policy" and tell the agent to confirm.
- Benefits from individually paid policies are "generally income-tax free" — always add "check with
  your tax advisor"; never promise tax treatment.
- Automatic increase riders raise the premium when increases are accepted; say so.

## Required content
- The driving-record / final-rate language is automatic — don't repeat it in your own paragraphs
  beyond one natural mention where it matters.
- Umbrella: only build an umbrella page if one was quoted. If one isn't available or wasn't quoted,
  mention it in a payment-page `info` box ("About the umbrella" / "Worth a conversation").
- Re-quotes needed before binding (raised limits, corrected garage size, stale effective date):
  say so on the cover `strip` or an `info` box and in your summary to the agent.
- Data conflicts between carriers go in the property specs exactly as found
  ("Attached (2-car per Safeco; 1-car per Travelers)") and in your summary to the agent.

## Exclusions & limitations (every proposal)
- Every proposal gets its own Exclusions & Limitations page (`exclusions`), placed after the coverage
  pages and before "Plain language". The build fails without it.
- Read each quote's exclusions/limitations wording (see `references/quote-extraction.md`) and put every
  one that could change a claim on this page: what all options share in `common`, what is different in
  that carrier's card. Also list coverage that is capped low or missing compared with the other options
  (e.g. roof paid at actual cash value, no service-line coverage, $50,000 property damage).
- Tag the one or two biggest differences per carrier with `key: true` — the things a client would be
  upset to learn at claim time (a 24-month mental-health limit, no military coverage, roof at ACV).
- Only state what the quote says, plus facts that are always true for that line (homeowners policies
  never cover flood; personal auto limits rideshare/delivery use). Never invent an exclusion. If a quote
  is silent on something the others limit, say so ("The quote does not state a limit. We will confirm
  the policy wording before you apply.") and flag it to the agent.
- Plain words, one or two short sentences per item. End with the `fine` line: "This is a summary of
  what each quote lists, not the full policy. The policy contract controls."
- Where a gap can be closed (flood policy, higher water back-up, service line), say so in a `callout`.

## Client email
- Same voice as the proposal, shorter. Every number must match the proposal exactly.
- Say plainly what's pending (a re-quote, an inspection) and what you need from the client
  (start date, valuables to schedule). Never tell the client about internal data errors
  (a wrong birth date on a quote) — fix those with the carrier.
- One upsell at most in `heads_up` (umbrella/excess, flood), framed as a recommendation.

## Before delivering, tell the agent (not the client)
- Any name/spelling differences between quotes (e.g. a spouse's last name).
- Effective dates that have already passed or differ between carriers.
- NC consent-to-rate: when a quote states "our premium… would be $X… approved rates… $Y", the client
  must sign the carrier's consent form if they choose that carrier.
- Anything you recommended re-quoting.
- Any exclusion you could not confirm from the quote (e.g. a carrier whose quote doesn't state its
  mental-health limit) — the agent must check the policy wording before the client applies.
