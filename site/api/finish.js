// Step 2: build the PDF with the locked template, run every check, let Claude fix any failure once,
// save the PDF and client email, and email the team. The Command Center record is created only when
// the proposal is marked as sent (api/sent.js), so drafts and redos never reach the follow-up queue.
import { send, currentUser, canApprove, approvalRequired, readBody, safeId, readJob, saveJob, readBytes, putFile, callBuilder, signPath, OUTPUT } from './_lib.js';
import { renderPdf } from './_render.js';
import { askClaude, fixInstruction } from './_claude.js';
import { emailTeam } from './_email.js';
import { progress } from './_stream.js';

export const config = { maxDuration: 300 };

async function buildAndCheck(req, proposal) {
  const built = await callBuilder(req, { mode: 'build', proposal });
  if (!built.ok) return { problems: [`The builder could not read the proposal: ${built.error}`] };
  const { pdf, heights, pdfCount } = await renderPdf(built.html);
  const checked = await callBuilder(req, { mode: 'check', proposal, html: built.html, heights, pdf_count: pdfCount });
  if (!checked.ok) return { problems: [`Checks could not run: ${checked.error}`] };
  const problems = checked.results.filter(r => !r.passed).map(r => r.detail ? `${r.name} (${r.detail})` : r.name);
  return { built, pdf, checks: checked.results, problems };
}

export default async function handler(req, res) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  const { id } = await readBody(req);
  if (!safeId(id)) return send(res, 400, { ok: false, error: 'Bad job id' });
  const job = await readJob(id);
  if (!job || !job.proposal) return send(res, 404, { ok: false, error: 'Job not found or not drafted yet' });
  const out = progress(res);
  try {
    out.say({ step: 'building', message: 'Building the PDF and running the checks…' });
    let result = await buildAndCheck(req, job.proposal);
    if (result.problems.length) {
      out.say({ step: 'fixing', message: `Fixing ${result.problems.length} item(s) the checks caught…`, problems: result.problems });
      const quotes = [];
      for (const f of job.files) quotes.push({ name: f.name, bytes: await readBytes(f.pathname) });
      const { reply } = await askClaude({ quotes, instruction: fixInstruction({ today: job.today, proposal: job.proposal, problems: result.problems }) });
      if (reply.proposal) {
        job.proposal = reply.proposal;
        job.agent_notes = reply.agent_notes || job.agent_notes;
        if (Array.isArray(reply.coverage_review)) job.coverage_review = reply.coverage_review.slice(0, 7);
        job.fixed = result.problems;
        out.say({ step: 'building', message: 'Rebuilding with the fixes…' });
        result = await buildAndCheck(req, job.proposal);
      }
    }
    const { built, pdf, checks, problems } = result;
    if (!built || !pdf) throw new Error(problems.join('; '));
    const last = String(job.proposal.client?.last_name || 'Client').replace(/[^A-Za-z0-9-]/g, '');
    const base = `${OUTPUT}${job.id}/`;
    await putFile(base + built.file_name, pdf, 'application/pdf');
    await putFile(base + `${last}_Proposal_Email.txt`, built.email.text, 'text/plain; charset=utf-8');
    await putFile(base + `${last}_Proposal_Email.html`, built.email.html, 'text/html; charset=utf-8');
    await putFile(base + 'proposal.json', JSON.stringify(job.proposal, null, 1), 'application/json');
    Object.assign(job, {
      status: problems.length ? 'needs_review' : (approvalRequired() && !canApprove(user) ? 'pending_approval' : 'ready'),
      file_name: built.file_name, pdf_path: base + built.file_name, pages: built.pages,
      proposal_number: (built.html.match(/P-\d{4}-\d{4}-[A-Z]/) || [''])[0],
      email: { subject: built.email.subject, text: built.email.text },
      checks: { passed: checks.filter(c => c.passed).length, total: checks.length, failed: problems },
    });
    if (job.status === 'ready') Object.assign(job, { approved_by: user.full_name, approved_at: new Date().toISOString() });
    await saveJob(job);
    if (job.internal_email?.status !== 'sent') {
      out.say({ step: 'emailing', message: 'Emailing the proposal to the team…' });
      job.internal_email = await emailTeam({ job, user, pdf }).catch(e => ({ status: 'error', message: e.message }));
      await saveJob(job);
    }
    out.end({ step: 'done', id: job.id, status: job.status, pdf_url: signPath(job.pdf_path) });
  } catch (e) {
    job.status = 'failed';
    job.error = e.message;
    await saveJob(job).catch(() => {});
    out.end({ step: 'error', id: job.id, message: e.message });
  }
}
