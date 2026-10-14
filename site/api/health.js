// Health check: builds the bundled sample proposal (fictional client) end to end — Python builder,
// headless Chromium, and every automatic check — and reports the result. No client data, no AI call.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { send, callBuilder, ccApiKey, putFile, readBytes } from './_lib.js';
import { renderPdf } from './_render.js';
import { emailConfigured } from './_email.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  const t0 = Date.now();
  const out = { ok: false, signin_ready: Boolean(ccApiKey()), claude_ready: Boolean(process.env.ANTHROPIC_API_KEY), email_ready: emailConfigured(),
    storage_ready: false };
  try {
    // Round-trip a tiny file so "storage_ready" means storage really works, not just that a setting exists.
    const stamp = new Date().toISOString();
    await putFile('health/ping.txt', stamp, 'text/plain');
    out.storage_ready = (await readBytes('health/ping.txt'))?.toString() === stamp;
  } catch (e) {
    out.storage_error = e.message;
  }
  try {
    const proposal = JSON.parse(fs.readFileSync(path.join(here, '..', 'skill', 'examples', 'example-home-single-carrier.json'), 'utf8'));
    const built = await callBuilder(req, { mode: 'build', proposal });
    if (!built.ok) throw new Error(`builder: ${built.error}`);
    const { heights, pdfCount, pdf } = await renderPdf(built.html);
    const checked = await callBuilder(req, { mode: 'check', proposal, html: built.html, heights, pdf_count: pdfCount });
    if (!checked.ok) throw new Error(`checks: ${checked.error}`);
    Object.assign(out, { ok: checked.failed === 0, pages: pdfCount, pdf_kb: Math.round(pdf.length / 1024),
      checks_passed: checked.results.length - checked.failed, checks_total: checked.results.length,
      failed: checked.results.filter(r => !r.passed).map(r => r.name) });
  } catch (e) {
    out.error = e.message;
  }
  out.ms = Date.now() - t0;
  return send(res, out.ok ? 200 : 500, out);
}
