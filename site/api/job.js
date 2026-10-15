// One proposal: status, checks, email, notes for the agent, and a signed link to the PDF.
import { send, currentUser, canApprove, safeId, readJob, signPath } from './_lib.js';

export default async function handler(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  const id = String(req.query.id || '');
  if (!safeId(id)) return send(res, 400, { ok: false, error: 'Bad job id' });
  const j = await readJob(id);
  if (!j) return send(res, 404, { ok: false, error: 'Not found' });
  const { proposal, claude, ...rest } = j;
  return send(res, 200, { ok: true, job: { ...rest, options: proposal?.options?.map(o => ({ name: o.name, price: o.price, recommended: !!o.recommended })) || [],
    pdf_url: j.pdf_path ? signPath(j.pdf_path) : null, can_approve: canApprove(user),
    can_delete: true } });
}
