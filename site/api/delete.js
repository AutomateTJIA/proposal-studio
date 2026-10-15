// Deletes a proposal the team doesn't want to keep (a redo, a wrong quote): its record, uploaded
// quotes and generated files, plus its Command Center record if it had one. The person who built it
// or a licensed agent can delete an unsent proposal; once sent, only a licensed agent can.
import { del, list } from '@vercel/blob';
import { send, currentUser, canApprove, readBody, safeId, readJob, JOBS, OUTPUT } from './_lib.js';
import { deleteOpportunity } from './_crm.js';

export default async function handler(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  const { id } = await readBody(req);
  if (!safeId(id)) return send(res, 400, { ok: false, error: 'Bad job id' });
  const j = await readJob(id);
  if (!j) return send(res, 404, { ok: false, error: 'Not found' });
  const own = j.prepared_by_id && j.prepared_by_id === user.id;
  if (j.sent_at ? !canApprove(user) : !(own || canApprove(user))) {
    return send(res, 403, { ok: false, error: j.sent_at ? 'Only a licensed agent can delete a proposal that was sent.' : 'Only the person who built it or a licensed agent can delete this proposal.' });
  }
  let crm = { status: 'none' };
  if (j.crm?.opportunity_id) {
    try { crm = await deleteOpportunity(user, j.crm.opportunity_id); }
    catch (e) { return send(res, 502, { ok: false, error: `Could not remove it from the Command Center, so nothing was deleted: ${e.message}` }); }
  }
  const outputs = (await list({ prefix: `${OUTPUT}${id}/`, limit: 100 })).blobs.map(b => b.pathname);
  const quotes = (j.files || []).map(f => f.pathname).filter(Boolean);
  const targets = [...quotes, ...outputs];
  if (targets.length) await del(targets).catch(() => {});
  await del(`${JOBS}${id}.json`);
  return send(res, 200, { ok: true, deleted: id, crm });
}
