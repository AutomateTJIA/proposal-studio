// Marks a proposal as sent to the client. This is the moment it enters the Command Center: one
// Presented opportunity with a scheduled follow-up for the dedicated CSR. Drafts never get there.
import { send, currentUser, readBody, safeId, readJob, saveJob } from './_lib.js';
import { logProposal, markSent } from './_crm.js';
import { track } from './_stats.js';

export default async function handler(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  const { id, reviewed } = await readBody(req);
  if (!safeId(id)) return send(res, 400, { ok: false, error: 'Bad job id' });
  const j = await readJob(id);
  if (!j) return send(res, 404, { ok: false, error: 'Not found' });
  if (j.status !== 'ready') return send(res, 409, { ok: false, error: 'A licensed agent must approve this proposal before it is sent.' });
  if (j.sent_at) return send(res, 409, { ok: false, error: 'This proposal is already marked as sent.' });
  if (j.coverage_review?.length && !j.coverage_reviewed && !reviewed) {
    return send(res, 409, { ok: false, error: 'Check the coverage differences and tick the box first.' });
  }
  if (!j.coverage_reviewed && j.coverage_review?.length) j.coverage_reviewed = { by: user.full_name, at: new Date().toISOString() };
  j.sent_at = new Date().toISOString();
  j.sent_by = user.full_name;
  if (j.crm?.opportunity_id) {
    j.crm_sent = await markSent(user, j.crm.opportunity_id).catch(e => ({ status: 'error', message: e.message }));
  } else {
    j.crm = await logProposal({ user, proposal: j.proposal, clientEmail: null, proposalNumber: j.proposal_number || '', fileName: j.file_name, quotedAt: j.created_at })
      .catch(e => ({ status: 'error', message: e.message }));
  }
  await saveJob(j);
  await track('sent', j, j.prepared_by).catch(() => {});
  return send(res, 200, { ok: true, sent_at: j.sent_at, crm: j.crm });
}
