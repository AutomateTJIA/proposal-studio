// Proposals for the team list, newest first, 25 at a time (?offset= for the next page).
import { list } from '@vercel/blob';
import { send, currentUser, readJob, JOBS } from './_lib.js';

export default async function handler(req, res) {
  if (!(await currentUser(req))) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  const page = await list({ prefix: JOBS, limit: 1000 });
  const all = page.blobs.sort((a, b) => b.pathname.localeCompare(a.pathname));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const recent = all.slice(offset, offset + limit);
  const items = await Promise.all(recent.map(async b => {
    const id = b.pathname.slice(JOBS.length, -5);
    try {
      const j = await readJob(id);
      return { id, status: j.status, created_at: j.created_at, client_name: j.client_name || '', file_name: j.file_name || '',
        files: (j.files || []).length, sent_at: j.sent_at || null, prepared_by: j.prepared_by || '',
        follow_up: j.crm?.assigned_to || '', differences: (j.coverage_review || []).length };
    } catch { return { id, status: 'unknown' }; }
  }));
  return send(res, 200, { ok: true, items, total: all.length, offset, more: offset + limit < all.length });
}
