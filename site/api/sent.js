// Marks a proposal as sent to the client and moves it to "Presented" in the Command Center.
import { send, currentUser, readBody, safeId, readJob, saveJob } from './_lib.js';
import { markSent } from './_crm.js';

export default async function handler(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  const { id } = await readBody(req);
  if (!safeId(id)) return send(res, 400, { ok: false, error: 'Bad job id' });
  const j = await readJob(id);
  if (!j) return send(res, 404, { ok: false, error: 'Not found' });
  if (j.status !== 'ready') return send(res, 409, { ok: false, error: 'A licensed agent must approve this proposal before it is sent.' });
  j.sent_at = new Date().toISOString();
  j.sent_by = user.full_name;
  j.crm_sent = await markSent(user, j.crm?.opportunity_id).catch(e => ({ status: 'error', message: e.message }));
  await saveJob(j);
  return send(res, 200, { ok: true, sent_at: j.sent_at, crm: j.crm_sent });
}
