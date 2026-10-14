# Changelog — Proposal Studio

## 2026-10-14
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
