// Step 1: Claude reads the uploaded quotes and writes proposal.json (saved on the job).
import { send, currentUser, readBody, newId, saveJob, readBytes, QUOTES } from './_lib.js';
import { askClaude, firstInstruction } from './_claude.js';
import { progress } from './_stream.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  const body = await readBody(req);
  const files = (body.files || []).filter(f => f && typeof f.pathname === 'string' && f.pathname.startsWith(QUOTES) && !f.pathname.includes('..'));
  if (!files.length || files.length > 8) return send(res, 400, { ok: false, error: 'Add 1 to 8 quote PDFs.' });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 500, { ok: false, error: 'The Claude API key is not set up yet (ANTHROPIC_API_KEY).' });

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const job = {
    id: newId(), status: 'reading', created_at: new Date().toISOString(), prepared_by: user.full_name, prepared_by_id: user.id, prepared_by_role: user.role,
    client_email: String(body.clientEmail || '').trim().slice(0, 200), notes: String(body.notes || '').slice(0, 2000),
    files: files.map(f => ({ pathname: f.pathname, name: String(f.name || f.pathname.split('/').pop()).slice(0, 200), size: f.size || null })),
  };
  const out = progress(res);
  try {
    await saveJob(job);
    out.say({ step: 'reading', id: job.id, message: `Reading ${files.length} quote PDF(s)…` });
    const quotes = [];
    for (const f of job.files) {
      const bytes = await readBytes(f.pathname);
      if (!bytes) throw new Error(`Could not open ${f.name}`);
      quotes.push({ name: f.name, bytes });
    }
    let last = 0;
    const { reply, usage, model } = await askClaude({
      quotes,
      instruction: firstInstruction({ today, notes: job.notes, clientEmail: job.client_email, fileNames: job.files.map(f => f.name) }),
      onProgress: chars => {
        if (chars - last > 1500) { last = chars; out.say({ step: 'writing', chars }); }
      },
    });
    if (reply.error) throw new Error(reply.error);
    if (!reply.proposal) throw new Error('Claude did not return a proposal.');
    Object.assign(job, { status: 'drafted', today, proposal: reply.proposal, agent_notes: reply.agent_notes || [], claude: { model, usage } });
    job.client_name = String(reply.proposal.client?.full_names || '').replace(/&amp;/g, '&');
    await saveJob(job);
    out.end({ step: 'drafted', id: job.id });
  } catch (e) {
    job.status = 'failed';
    job.error = e.message;
    await saveJob(job).catch(() => {});
    out.end({ step: 'error', id: job.id, message: e.message });
  }
}
