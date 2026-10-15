// A licensed agent (agent, admin or owner) approves a proposal before it can go to the client.
import { send, currentUser, canApprove, readBody, safeId, readJob, saveJob } from './_lib.js';

export default async function handler(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  if (!canApprove(user)) return send(res, 403, { ok: false, error: 'Only a licensed agent can approve proposals.' });
  const { id, reviewed } = await readBody(req);
  if (!safeId(id)) return send(res, 400, { ok: false, error: 'Bad job id' });
  const j = await readJob(id);
  if (!j) return send(res, 404, { ok: false, error: 'Not found' });
  if (!['pending_approval', 'needs_review'].includes(j.status)) return send(res, 409, { ok: false, error: `This proposal is ${j.status}.` });
  if (j.coverage_review?.length && !j.coverage_reviewed && !reviewed) {
    return send(res, 409, { ok: false, error: 'Check the coverage differences and tick the box first.' });
  }
  if (j.coverage_review?.length && !j.coverage_reviewed) j.coverage_reviewed = { by: user.full_name, at: new Date().toISOString() };
  Object.assign(j, { status: 'ready', approved_by: user.full_name, approved_at: new Date().toISOString() });
  await saveJob(j);
  return send(res, 200, { ok: true, approved_by: j.approved_by, approved_at: j.approved_at });
}
