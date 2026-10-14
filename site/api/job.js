// One proposal: status, checks, email, notes for the agent, and a signed link to the PDF.
import { send, isStaff, safeId, readJob, signPath } from './_lib.js';

export default async function handler(req, res) {
  if (!isStaff(req)) return send(res, 401, { ok: false, error: 'Unauthorized' });
  const id = String(req.query.id || '');
  if (!safeId(id)) return send(res, 400, { ok: false, error: 'Bad job id' });
  const j = await readJob(id);
  if (!j) return send(res, 404, { ok: false, error: 'Not found' });
  const { proposal, claude, ...rest } = j;
  return send(res, 200, { ok: true, job: { ...rest, options: proposal?.options?.map(o => ({ name: o.name, price: o.price, recommended: !!o.recommended })) || [],
    pdf_url: j.pdf_path ? signPath(j.pdf_path) : null } });
}
