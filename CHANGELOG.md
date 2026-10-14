# Changelog — Proposal Studio

## 2026-10-14
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
