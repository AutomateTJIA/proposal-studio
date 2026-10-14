# Proposal Studio — The Jordan Insurance Agency

Private team page where a CSR drops carrier quote PDFs and gets back the client-ready proposal PDF
(the locked agency design) and the matching client email. Every proposal is logged in the Command
Center's Personal Lines Quote Tracker as **Quoted**, assigned to Chelssy with a follow-up scheduled.

- Planned address: https://proposals.thejordaninsuranceagency.com
- Code: `site/` (static page in `site/public`, Vercel functions in `site/api`)
- The proposal rules, design and email template live in `site/skill/` — the same
  `tjia-proposal-builder` skill used in Claude chats (version in `site/skill/VERSION`).

## How a proposal is made
1. **Upload** — the page uploads the PDFs straight to private Vercel Blob storage.
2. **Read** (`api/extract.js`) — Claude (claude-opus-5-5) reads every page and writes `proposal.json`
   using the skill's rules, plus a "verify before sending" list for the agent.
3. **Build** (`api/finish.js` → `api/build.py`) — the skill's own Python builder makes the HTML, headless
   Chromium prints the PDF, and the skill's automatic checks run (page fit, agent + team on cover and
   Next Steps, notices, banned phrases, every math check, the email).
4. **Fix** — if any check fails, Claude gets the failures and corrects the proposal once; it is rebuilt
   and re-checked. Anything still failing is shown as **Needs review**.
5. **Log** (`api/_crm.js`) — creates a `revenue_opportunities` row (stage `quoted`, product type from the
   lines quoted, carriers, recommended premium) assigned to Chelssy and confirms its follow-up.
6. **Send** — the CSR reviews, downloads the PDF, opens the email in Gmail, attaches, sends, and clicks
   **Mark as sent** (moves the Command Center record to **Presented**).

## Settings (Vercel → Project → Settings → Environment Variables)
| Name | What it is |
|---|---|
| `STAFF_PASSWORD` | Team password for the page |
| `ANTHROPIC_API_KEY` | Claude API key (console.anthropic.com → API keys) |
| `BLOB_READ_WRITE_TOKEN` | Added automatically when the private Blob store is connected |
| `CC_SUPABASE_URL` | Command Center Supabase project URL |
| `CC_SUPABASE_SERVICE_KEY` | Command Center Supabase service-role key (server only, never in the page) |
| `CC_ASSIGNEE_EMAIL` | Optional. Who gets the follow-up. Default `chelssy@agencyhlpc.com` |
| `CLAUDE_EFFORT` | Optional. `high` (default) or `medium` if reading ever runs too long |

Without the Command Center keys the studio still works; it just skips logging and says so.

## Updating the proposal rules or design
Change the skill, then copy the whole `tjia-proposal-builder` folder over `site/skill/` (keep its
`VERSION` and `CHANGELOG.md`), commit, and push. Claude chats and the studio then use the same version.

## Deploying
Pushing to `main` deploys production automatically (Vercel project root directory: `site`).
