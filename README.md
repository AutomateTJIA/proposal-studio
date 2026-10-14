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
6. **Approve & send** — a licensed agent approves; the CSR reviews, downloads the PDF, opens the email in Gmail, attaches, sends, and clicks
   **Mark as sent** (moves the Command Center record to **Presented**).

## Sign-in
The team signs in with their **Command Center** email and password (same accounts, same Supabase
project `rcqhyiiywdpkndiwizxb`). Only active CSRs, agents, admins and owners get in. A proposal built
by a CSR waits for a licensed agent (agent/admin/owner) to click **Approve for sending** before the
download, Gmail and "Mark as sent" buttons appear — the same licensed-agent rule the Command Center's
own proposal studio enforces. Proposals built by Billy are approved as they are built.

## Settings (Vercel → Project → Settings → Environment Variables)
| Name | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (console.anthropic.com → API keys) |
| `CC_SUPABASE_SERVICE_KEY` | The Command Center's Supabase key. Used only on the server to talk to the Command Center; it is never sent to the browser. Sign-in and every Command Center change still run as the signed-in person, so their own permissions apply. (`CC_SUPABASE_ANON_KEY` works too if you ever prefer the public key.) |
| `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY` | Added automatically when the private Blob store `proposal-studio-files` is connected to this project (Vercel's keyless OIDC connection; no read-write token needed). Don't reuse the Census store |
| `CC_SUPABASE_URL` | Optional. Defaults to the Command Center project URL |
| `RESEND_API_KEY` | Resend key (same Resend account the Command Center uses). Lets Proposal Studio email each finished proposal to the team. Without it, proposals still build; the team email is skipped |
| `PROPOSAL_EMAIL_TO` | Optional. Who gets the team email. Default `billy@agencyhlpc.com,chelssy@agencyhlpc.com`; the person who built it is always added |
| `RESEND_FROM_ADDRESS` | Optional. Default `The Jordan Insurance Agency <noreply@thejordaninsuranceagency.com>` |
| `CC_ASSIGNEE_EMAIL` | Optional. When Billy builds a proposal, who gets the follow-up. Default `chelssy@agencyhlpc.com` (a CSR who builds one owns it herself) |
| `REQUIRE_AGENT_APPROVAL` | Optional. `true` (default) or `false` |
| `CLAUDE_EFFORT` | Optional. `high` (default) or `medium` if reading ever runs too long |

Command Center records are written as the signed-in person, so the Command Center's own permissions
apply. No database master key is stored in this project.

## Updating the proposal rules or design
Change the skill, then copy the whole `tjia-proposal-builder` folder over `site/skill/` (keep its
`VERSION` and `CHANGELOG.md`), commit, and push. Claude chats and the studio then use the same version.

## Deploying
Pushing to `main` deploys production automatically (Vercel project root directory: `site`).
