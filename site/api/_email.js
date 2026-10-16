// Emails each finished proposal to the agency team (never to the client): the PDF attached, the
// review status, anything to verify, and the client-ready email text to copy into Gmail.
// One email per proposal: guarded by job.internal_email on the job and Resend's Idempotency-Key.
// Needs RESEND_API_KEY (same Resend account and sender the Command Center uses).

const FROM = () => process.env.RESEND_FROM_ADDRESS || 'The Jordan Insurance Agency <noreply@thejordaninsuranceagency.com>';
const TEAM = () => (process.env.PROPOSAL_EMAIL_TO || 'billy@agencyhlpc.com,chelssy@agencyhlpc.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const APP_URL = () => (process.env.APP_URL || 'https://proposals.thejordaninsuranceagency.com').replace(/\/$/, '');

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

/** Asks Resend whether the key is valid without sending anything. A sending-only key is reported
 *  by Resend as "restricted", which still means it is a real, working key. */
export async function checkEmailKey() {
  if (!emailConfigured()) return { ok: false, message: 'RESEND_API_KEY is not set' };
  const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
  const body = await r.json().catch(() => ({}));
  if (r.ok) {
    const want = (FROM().match(/@([^>\s]+)/) || [])[1] || '';
    const all = (body.data || []).map(d => `${d.name} (${d.status})`).join(', ');
    const exact = (body.data || []).find(d => d.name === want);
    return { ok: exact?.status === 'verified', message: `Sending from ${want}: ${exact ? exact.status : 'not set up in this Resend account'}. Domains on this key: ${all || 'none'}` };
  }
  if (body.name === 'restricted_api_key') return { ok: true, message: 'Sending-only key works' };
  return { ok: false, message: body.message || `Resend returned ${r.status}` };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HEADLINE = {
  ready: 'Approved and ready to send',
  pending_approval: 'Waiting for a licensed agent to approve',
  needs_review: 'Needs review before it can be approved',
};

export function recipients(user) {
  const to = new Set(TEAM());
  if (user?.email) to.add(String(user.email).toLowerCase());
  return [...to];
}

/** Sends the team email for a finished job. Returns a summary to store on the job. */
export async function emailTeam({ job, user, pdf }) {
  if (!emailConfigured()) return { status: 'skipped', message: 'Team email is not set up yet (RESEND_API_KEY).' };
  if (job.internal_email?.status === 'sent') return job.internal_email;
  const to = recipients(user);
  const client = job.client_name || 'New client';
  const link = `${APP_URL()}/#job=${encodeURIComponent(job.id)}`;
  const status = HEADLINE[job.status] || job.status;
  const lines = job.email?.text || '';
  const clientSubject = (lines.split('\n')[0] || '').replace(/^Subject:\s*/, '');
  const clientBody = lines.split('\n').slice(2).join('\n');
  const verify = [...(job.checks?.failed || []), ...(job.agent_notes || [])];
  const diffs = (job.coverage_review || []).map(d => `${d.line ? d.line + ' · ' : ''}${d.coverage}: ${d.detail}`);
  const subject = `${job.status === 'ready' ? 'Proposal ready' : 'Proposal to review'}: ${client}`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#0E2650;max-width:640px">
  <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#1F5AA6;margin:0 0 6px">Proposal Studio</p>
  <h1 style="font-size:24px;margin:0 0 6px;color:#163A70">${esc(client)}</h1>
  <p style="margin:0 0 16px"><b>${esc(status)}</b> · prepared by ${esc(job.prepared_by)}${job.checks ? ` · ${job.checks.passed} of ${job.checks.total} checks passed` : ''}</p>
  ${job.status === 'ready' ? '' : `<p style="background:#E9EDF2;border-left:6px solid #E0B43B;padding:12px 14px;margin:0 0 16px"><b>Do not send to the client yet.</b> A licensed agent needs to open it and click Approve first.</p>`}
  <p style="margin:0 0 16px"><a href="${esc(link)}" style="display:inline-block;background:#163A70;color:#fff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Open in Proposal Studio</a></p>
  ${diffs.length ? `<div style="background:#E9EDF2;border-left:6px solid #E0B43B;padding:12px 14px;margin:0 0 16px"><p style="margin:0 0 6px"><b>Coverage differences between the quotes (${diffs.length})</b> · check each one; fix the quote if it's a mistake</p><ul style="margin:0;padding-left:20px">${diffs.map(v => `<li>${esc(v)}</li>`).join('')}</ul></div>` : ''}
  ${verify.length ? `<p style="margin:0 0 6px"><b>Verify before sending</b></p><ul style="margin:0 0 16px;padding-left:20px">${verify.map(v => `<li>${esc(v)}</li>`).join('')}</ul>` : ''}
  ${job.notes ? `<p style="margin:0 0 16px"><b>Instructions given:</b> ${esc(job.notes)}</p>` : ''}
  <p style="margin:0 0 6px"><b>Client email</b> (subject: ${esc(clientSubject)}). Easiest: open it in Proposal Studio and click <b>Copy email</b>.</p>
  <div style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;background:#ffffff;border:2px solid #E9EDF2;padding:16px;border-radius:10px;margin:0 0 16px">${esc(clientBody.trim())}</div>
  <p style="font-size:13px;color:#163A70;margin:0">The proposal PDF is attached. Send it to the client from your own Gmail once it's approved, then click "Mark as sent" in Proposal Studio so the Command Center follow-up stays on track.</p>
</div>`;
  const text = [`${client}: ${status}`, `Prepared by ${job.prepared_by}`, `Open: ${link}`,
    diffs.length ? `\nCoverage differences between the quotes (check each one):\n- ${diffs.join('\n- ')}` : '',
    verify.length ? `\nVerify before sending:\n- ${verify.join('\n- ')}` : '', job.notes ? `\nInstructions given: ${job.notes}` : '',
    `\nClient email, ready to copy (subject: ${clientSubject}):\n\n${clientBody}`].filter(Boolean).join('\n');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `proposal-${job.id}` },
    body: JSON.stringify({
      from: FROM(), to, subject, html, text,
      attachments: pdf ? [{ filename: job.file_name || 'Proposal.pdf', content: Buffer.from(pdf).toString('base64') }] : [],
    }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { status: 'error', message: body.message || `Email service returned ${r.status}`, to };
  return { status: 'sent', to, id: body.id, at: new Date().toISOString() };
}
