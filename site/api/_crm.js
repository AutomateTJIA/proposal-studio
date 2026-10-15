// Logs each proposal in the Command Center's Personal Lines Quote Tracker (revenue_opportunities).
// The Command Center turns each one into a scheduled follow-up for the assigned CSR (its home/auto
// follow-up trigger). Every proposal goes to the dedicated CSR (Chelssy by default), whoever built it;
// the builder is recorded as created_by. With the Command Center server key this runs server-side after
// the builder is verified as active staff; without it, it falls back to the builder's own permissions.
import { ccUrl, ccApiKey, ccServiceKey } from './_lib.js';

const ASSIGNEE = () => (process.env.CC_ASSIGNEE_EMAIL || 'chelssy@agencyhlpc.com').toLowerCase();
const LEADERS = ['admin', 'super_admin'];

async function rest(user, path, { method = 'GET', body, prefer } = {}) {
  const key = ccServiceKey();
  const headers = { apikey: key || ccApiKey(), Authorization: `Bearer ${key || user.token}`, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${ccUrl()}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error((data && (data.message || data.hint)) || `Command Center returned ${r.status}`);
  return data;
}

/** The dedicated CSR owns every proposal's follow-up. Without the server key a CSR can only assign herself. */
async function assigneeFor(user) {
  if (!ccServiceKey() && !LEADERS.includes(user.role)) return { id: user.id, full_name: user.full_name };
  const rows = await rest(user, `profiles?select=id,full_name&status=eq.active&email=ilike.${encodeURIComponent(ASSIGNEE())}&limit=1`);
  return rows && rows.length ? rows[0] : { id: user.id, full_name: user.full_name };
}

const plain = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const money = s => {
  const n = Number(String(s || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

function productType(lines) {
  const l = new Set(lines);
  if (l.has('disability')) return 'disability';
  const home = l.has('home') || l.has('landlord') || l.has('condo');
  if (home && l.has('auto')) return 'personal_lines';
  if (l.has('auto')) return 'auto';
  if (l.has('renters')) return 'renters';
  return 'home';
}

function proposalLines(lines) {
  const out = new Set();
  for (const x of lines) {
    if (['home', 'landlord', 'condo'].includes(x)) out.add('home');
    if (['auto', 'renters', 'umbrella'].includes(x)) out.add(x);
  }
  return [...out];
}

/** Creates the opportunity once the proposal has been sent to the client (stage "presented") and confirms
 *  its follow-up. Only sent proposals reach the Command Center. Returns a summary for the job. */
export async function logProposal({ user, proposal, clientEmail, proposalNumber, fileName, quotedAt }) {
  const assignee = await assigneeFor(user);
  const opts = proposal.options || [];
  const rec = opts.find(o => o.recommended) || opts[0] || {};
  const now = new Date();
  const followUp = new Date(now.getTime() + 2 * 24 * 3600 * 1000);
  const row = {
    contact_name: plain(proposal.client?.full_names) || plain(proposal.client?.last_name) || 'Proposal client',
    contact_email: clientEmail || null,
    assigned_to: assignee.id,
    created_by: user.id,
    product_type: productType(proposal.lines || []),
    source_type: 'inbound_request',
    client_type: 'new_prospect',
    stage: 'presented',
    priority: 'high',
    opportunity_reason: `Proposal ${proposalNumber} built in Proposal Studio (${fileName}). ` +
      `Carriers: ${opts.map(o => `${plain(o.name)} ${o.price}`).join(' · ')}. Recommended: ${plain(rec.name)} ${rec.price || ''}.`,
    next_action: 'Proposal sent. Follow up to answer questions and bind.',
    quoted_premium: money(rec.price),
    carrier_names: opts.map(o => plain(o.name)),
    proposal_lines: proposalLines(proposal.lines || []),
    follow_up_cadence_days: 2,
    quoted_at: quotedAt || now.toISOString(),
    presented_at: now.toISOString(),
    proposal_sent_at: now.toISOString(),
    next_follow_up_at: followUp.toISOString(),
  };
  const [opp] = await rest(user, 'revenue_opportunities', { method: 'POST', body: row, prefer: 'return=representation' });
  let followUpResult = null;
  try {
    followUpResult = await rest(user, 'rpc/queue_revenue_follow_up', { method: 'POST', body: { p_opportunity_id: opp.id } });
  } catch (e) {
    followUpResult = { error: e.message };
  }
  return { status: 'logged', opportunity_id: opp.id, assigned_to: assignee.full_name, follow_up: followUpResult, at: now.toISOString() };
}

/** Removes a proposal's Command Center record (its follow-up reminder and history go with it). */
export async function deleteOpportunity(user, opportunityId) {
  if (!opportunityId) return { status: 'none' };
  await rest(user, `revenue_opportunities?id=eq.${encodeURIComponent(opportunityId)}`, { method: 'DELETE', prefer: 'return=minimal' });
  return { status: 'deleted' };
}

/** Older proposals were logged when built; sending one of those just moves it to Presented. */
export async function markSent(user, opportunityId) {
  if (!opportunityId) return { status: 'skipped' };
  const now = new Date().toISOString();
  await rest(user, `revenue_opportunities?id=eq.${encodeURIComponent(opportunityId)}`, {
    method: 'PATCH', body: { stage: 'presented', presented_at: now, proposal_sent_at: now }, prefer: 'return=minimal',
  });
  return { status: 'presented', at: now };
}
