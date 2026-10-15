// Claude reads the quote PDFs and writes proposal.json, following the locked skill in site/skill.
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(here, '..', 'skill');
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = process.env.CLAUDE_EFFORT || 'high';

const SKILL_FILES = [
  'SKILL.md',
  'references/data-format.md',
  'references/writing-rules.md',
  'references/quote-extraction.md',
  'references/coverage-explanations.md',
  'branding.json',
  'examples/example-bundle-3-carriers.json',
  'examples/example-auto-3-options.json',
  'examples/example-home-single-carrier.json',
  'examples/example-disability-3-carriers.json',
];

const APP_RULES = `You are the proposal writer for The Jordan Insurance Agency, working inside the agency's
Proposal Studio web app. A member of the agency team has uploaded carrier quote PDFs. Follow the
tjia-proposal-builder skill below exactly, with these differences for the web app:

- You do not run scripts. You write proposal.json; the app renders the PDF with the locked template,
  runs every automatic check, and writes the client email from your "email" block.
- Read every page of every quote. Copy numbers exactly as the carrier printed them. Never invent a
  number, coverage, exclusion or date. When something is unclear or conflicts between quotes, say so
  in agent_notes instead of guessing.
- "prepared" is the date given in the request.
- Include a "checks" entry for every total, difference and computed figure, an "exclusions" page,
  and the "email" block (all required by the build).
- Coverage review (required, for the agency team only, never shown to the client): compare every
  coverage line by line across all carriers/options and list each difference the CSR must check
  before the proposal is sent. Include: different limits (e.g. auto property damage $100,000 on one
  quote vs $500,000 on another; bodily injury; UM/UIM; dwelling, other structures, personal property,
  loss of use, personal liability, medical payments); different deductibles (home, wind/hail,
  comprehensive, collision); a coverage or endorsement quoted on one but missing on another (rental
  reimbursement, roadside/towing, renters, umbrella, water back-up, service line, equipment
  breakdown, identity theft, scheduled property, replacement cost); different vehicles, drivers,
  property address or year built; different effective dates or policy terms. Copy the values exactly.
  Mismatches are often quoting mistakes, so list them even when they look intentional. Use [] only
  when the quotes truly match line for line (or there is one carrier with nothing to compare).
  Keep the list short and useful: one row per coverage (put every carrier's value in that row's
  detail), most important first (missing coverages and liability limits, then deductibles, then
  the rest), and at most 10 rows. Leave out premiums, fees, discounts, payment plans, form numbers
  and wording that means the same thing. If more than 10 real differences remain, keep the 10 that
  matter most and add one agent_notes line saying how many smaller ones were left off.
- Reply with ONE JSON object and nothing else (no code fences, no commentary):
  {"proposal": { ...proposal.json... },
   "coverage_review": [{"line": "Auto|Home|Umbrella|Renters|Other", "coverage": "Property damage liability",
                        "detail": "Chubb $500,000 vs AIG $100,000", "kind": "limit|deductible|missing|vehicle_or_driver|property|dates|other"}],
   "agent_notes": ["plain sentences for the agent: data conflicts, stale or passed effective dates,
                    re-quotes needed, consent-to-rate forms, placeholder VINs, anything to verify"]}
- If the files are not insurance quotes or cannot be read, reply {"error": "<plain explanation>"}.
- The request groups the PDFs by carrier slot (Carrier 1, Carrier 2, ...). PDFs in the same slot are
  one carrier's quotes (for example a separate home quote and auto quote); combine them into that
  carrier's option. Still name each carrier exactly as its quote does.
- "Instructions from the agency team" are the agent's directions for this proposal: what to mention,
  which carrier to favor or recommend, effective dates, the client's priorities, tone. Follow them in the
  recommendation, the wording and the email. They never override the facts: never change, invent or drop
  a number, coverage or exclusion to satisfy an instruction. If an instruction conflicts with the quotes
  or the skill rules, follow the quotes and explain the conflict in agent_notes.`;

let systemText;
function systemPrompt() {
  if (!systemText) {
    const parts = [APP_RULES, '', 'The skill files follow.'];
    for (const f of SKILL_FILES) {
      parts.push(`<file path="${f}">\n${fs.readFileSync(path.join(SKILL, f), 'utf8')}\n</file>`);
    }
    systemText = parts.join('\n');
  }
  return systemText;
}

function documents(quotes) {
  const blocks = quotes.map(q => ({
    type: 'document',
    title: q.name,
    source: { type: 'base64', media_type: 'application/pdf', data: q.bytes.toString('base64') },
  }));
  // Cache through the PDFs so a fix round re-reads them at cache prices.
  blocks[blocks.length - 1].cache_control = { type: 'ephemeral' };
  return blocks;
}

function parseReply(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Claude did not return JSON');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * One Claude call. `onProgress(chars)` fires as the reply streams so the page can show progress.
 * Returns the parsed {proposal, agent_notes} (or {error}).
 */
export async function askClaude({ quotes, instruction, onProgress }) {
  const client = new Anthropic({ timeout: 280_000, maxRetries: 1 });
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: [...documents(quotes), { type: 'text', text: instruction }] }],
  });
  let chars = 0;
  stream.on('text', delta => {
    chars += delta.length;
    if (onProgress) onProgress(chars);
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined this request. Build this one in a Claude chat instead.');
  if (msg.stop_reason === 'max_tokens') throw new Error('The reply was cut off. Try again with fewer PDFs.');
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { reply: parseReply(text), usage: msg.usage, model: msg.model };
}

export function firstInstruction({ today, notes, favor, files }) {
  const slots = [...new Set(files.map(f => f.slot))].sort((a, b) => a - b);
  const groups = slots.map(n => `- Carrier ${n}: ${files.filter(f => f.slot === n).map(f => f.name).join(', ')}`);
  return [
    `Today is ${today}. Build the proposal from these ${files.length} quote PDF(s), grouped by carrier:`,
    ...groups,
    favor ? `The agency team wants to recommend Carrier ${favor}. Make it the recommended option and explain why, using only facts from the quotes. If the quotes make that recommendation hard to justify, still follow it but say why in agent_notes.` : '',
    notes ? `\nInstructions from the agency team (follow these):\n${notes}` : '',
  ].filter(Boolean).join('\n');
}

export function fixInstruction({ today, proposal, problems }) {
  return [
    `Today is ${today}. You already wrote the proposal below from these quotes, but the build reported problems.`,
    'Fix every problem and reply with the complete corrected JSON object in the same format',
    '({"proposal": ..., "coverage_review": [...], "agent_notes": [...]}). Overflowing page: shorten that page\'s text or drop a',
    'low-value row; never remove required content. Math failure: recheck the numbers against the quotes.',
    '',
    'Problems:',
    ...problems.map(p => `- ${p}`),
    '',
    'Current proposal.json:',
    JSON.stringify(proposal),
  ].join('\n');
}
