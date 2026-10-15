// Health check: builds the bundled sample proposal (fictional client) end to end — Python builder,
// headless Chromium, and every automatic check — and reports the result. No client data, no AI call.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { send, callBuilder, ccApiKey, ccServiceKey, ccUrl, ccUrlSetting, putFile, readBytes } from './_lib.js';
import { renderPdf } from './_render.js';
import { checkEmailKey } from './_email.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export default async function handler(req, res) {
  const t0 = Date.now();
  const out = { ok: false, signin_ready: Boolean(ccApiKey()), followups_to: ccServiceKey() ? 'dedicated CSR' : 'whoever builds it', claude_ready: Boolean(process.env.ANTHROPIC_API_KEY), email_ready: false,
    storage_ready: false };
  try {
    // Does the configured key belong to the Command Center project? (/auth/v1/settings needs a valid key.)
    const r = await fetch(`${ccUrl()}/auth/v1/settings`, { headers: { apikey: ccApiKey() } });
    const b = await r.json().catch(() => ({}));
    out.signin_ready = r.ok;
    out.signin_check = r.ok ? `Command Center sign-in reachable (${ccUrl().replace('https://', '')}); email sign-in ${b.external?.email === false ? 'DISABLED' : 'enabled'}`
      : `Command Center rejected the key (${r.status} ${b.message || ''}). Check CC_SUPABASE_SERVICE_KEY belongs to the Command Center project.`;
    out.cc_url_setting = ccUrlSetting();
  } catch (e) {
    out.signin_ready = false; out.signin_check = `Command Center unreachable: ${e.message}`;
  }
  try {
    const mail = await checkEmailKey();
    out.email_ready = mail.ok;
    out.email_check = mail.message;
  } catch (e) {
    out.email_check = e.message;
  }
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
