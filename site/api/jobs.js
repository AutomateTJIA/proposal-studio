// Recent proposals for the dashboard (newest first).
import { list } from '@vercel/blob';
import { send, currentUser, readJob, JOBS } from './_lib.js';

export default async function handler(req, res) {
  if (!(await currentUser(req))) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  const page = await list({ prefix: JOBS, limit: 1000 });
  const recent = page.blobs.sort((a, b) => b.pathname.localeCompare(a.pathname)).slice(0, 50);
  const items = await Promise.all(recent.map(async b => {
    const id = b.pathname.slice(JOBS.length, -5);
    try {
      const j = await readJob(id);
      return { id, status: j.status, created_at: j.created_at, client_name: j.client_name || '', file_name: j.file_name || '',
        files: (j.files || []).length, sent_at: j.sent_at || null, prepared_by: j.prepared_by || '' };
    } catch { return { id, status: 'unknown' }; }
  }));
  return send(res, 200, { ok: true, items });
}
