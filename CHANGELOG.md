# Changelog — Proposal Studio

## 2026-10-14
- **Fixed:** Extra carrier slots can now be removed. Every optional carrier (2 and up) has an × button;
  if it already holds PDFs it asks first. The remaining carriers renumber and the Recommend choice
  follows its carrier. Carrier 1 always stays.
- **Fixed:** Team emails now send from noreply@thejordaninsuranceagency.com, the domain verified in
  the agency's Resend account (the mail. subdomain is not set up there, so sends would have failed).
  The health check now confirms the exact sending domain with Resend.
- **Changed:** The proposal form now has a slot for each carrier (Carrier 1, 2, 3, and "+ Add another
  carrier" up to six). A slot can hold more than one PDF, for when a carrier sends home and auto
  separately. Each slot has a "Recommend" button to tell the writer which carrier to favor.
- **Changed:** "Notes" is now "Instructions for this proposal": a real instruction box, with quick-add
  buttons (umbrella quote, effective date, price vs. coverage, current carrier). The writer follows
  these in the PDF and email, but numbers always come from the quotes; conflicts are flagged.
- **Added:** Every finished proposal is emailed to Billy and Chelssy (plus whoever built it) with the
  PDF attached, the status, anything to verify, and the client email ready to copy. One email per
  proposal, guarded so it can never repeat. Nothing is ever sent to the client. Needs `RESEND_API_KEY`.
- **Removed:** The "Client email" field and the "Open in Gmail" button. The team sends to clients
  from their own Gmail.
- **Removed:** The gold "Want a proposal like this? Book a free chat" sales band. This is a working
  tool for the team, not a sales page.
- **Fixed:** On large screens the sign-in / proposal card now stays beside the four steps as you
  scroll, instead of leaving an empty navy area next to them.
- **Fixed:** File storage now uses Vercel's newer keyless connection (the one Vercel sets up by
  default), so no storage password has to be added. Quote uploads use short-lived, one-file upload
  links. The health check now really saves and reads back a tiny test file, so "storage ready"
  means storage truly works.
- **Changed:** Proposal Studio now has its own private file storage (`proposal-studio-files`), kept
  separate from Census. Uploaded quotes and finished proposals are stored there.
- **Fixed:** Sign-in now works with the keys already in Vercel. The page signs in through the
  server (new `/api/session`), which uses the Command Center key that's already set — no extra
  "anon key" to copy. The key stays on the server and never reaches the browser.
- **Changed:** New look in the same style as the Podcast Studio (navy, royal and gold only; Archivo and
  Public Sans). The page now doubles as a showcase: hero with real sample proposal pages, a gold
  carrier ticker, the proposal desk (sign-in, upload and live progress in one white card), "What the
  client receives" with sample pages, a Home & Auto carriers section (Liberty Mutual, Travelers, Chubb,
  AIG Private Client), a "Book a free chat" band for Billy and his team, and the Breakpoint Systems
  signature. Status badges use brand colors only.
- **Changed:** No separate team password. Everyone signs in with their Command Center account, and
  proposals are logged in the Command Center as the person who built them.
- **Added:** Licensed-agent approval. A CSR's proposal shows "Waiting for agent approval" until Billy
  (or another agent/admin) clicks Approve; only then can it be downloaded, opened in Gmail or marked sent.
- **Built:** Proposal Studio. Team sign-in, drag-and-drop quote PDFs, live progress, Claude reads the
  quotes and writes the proposal with the locked `tjia-proposal-builder` skill (v3.4.0), PDF built with
  the agency template and checked automatically, one automatic fix round, client email written,
  "Open in Gmail", "Mark as sent", and a recent-proposals list.
- **Built:** Command Center logging. Each proposal becomes a Quoted opportunity in the Personal Lines
  Quote Tracker, assigned to Chelssy with a follow-up; "Mark as sent" moves it to Presented.
