// Marks a proposal as sent to the client and moves it to "Presented" in the Command Center.
import { send, isStaff, readBody, safeId, readJob, saveJob } from './_lib.js';
import { markSent } from './_crm.js';

export default async function handler(req, res) {
  if (!isStaff(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
  const { id } = await readBody(req);
  if (!safeId(id)) return send(res, 400, { ok: false, error: 'Bad job id' });
  const j = await readJob(id);
  if (!j) return send(res, 404, { ok: false, error: 'Not found' });
  j.sent_at = new Date().toISOString();
  j.crm_sent = await markSent(j.crm?.opportunity_id).catch(e => ({ status: 'error', message: e.message }));
  await saveJob(j);
  return send(res, 200, { ok: true, sent_at: j.sent_at, crm: j.crm_sent });
}
