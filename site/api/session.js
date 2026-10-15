// Signs a team member in with their Command Center email and password (or refreshes the session).
// The Command Center checks the password; this only passes it along and returns the person's own session.
import { send, readBody, ccUrl, ccApiKey, userFromToken } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });
  if (!ccApiKey()) return send(res, 503, { ok: false, error: 'Sign-in is not set up yet.' });
  const body = await readBody(req);
  let grant, payload;
  if (body.grant === 'refresh_token' && typeof body.refresh_token === 'string') {
    grant = 'refresh_token'; payload = { refresh_token: body.refresh_token };
  } else if (typeof body.email === 'string' && typeof body.password === 'string') {
    grant = 'password'; payload = { email: body.email.trim().toLowerCase().slice(0, 200), password: body.password.slice(0, 200) };
  } else {
    return send(res, 400, { ok: false, error: 'Enter your email and password.' });
  }
  let r, d;
  try {
    r = await fetch(`${ccUrl()}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST', headers: { apikey: ccApiKey(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    d = await r.json().catch(() => ({}));
  } catch (e) {
    console.error('sign-in: Command Center unreachable', e.message);
    return send(res, 502, { ok: false, error: 'Proposal Studio could not reach the Command Center. Try again in a minute.' });
  }
  if (!r.ok || !d.access_token) {
    const code = d.error_code || d.error || '';
    const msg = String(d.msg || d.message || d.error_description || '');
    console.error('sign-in failed', r.status, code, msg);
    if (grant !== 'password') return send(res, 401, { ok: false, error: 'Please sign in again.' });
    if (code === 'invalid_credentials' || code === 'invalid_grant' || /invalid login credentials/i.test(msg)) {
      return send(res, 401, { ok: false, error: 'That email and password did not match a Command Center account. Use the same email and password you use for the Command Center.' });
    }
    if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) {
      return send(res, 401, { ok: false, error: 'This email has not been confirmed in the Command Center yet.' });
    }
    if (r.status === 429 || /rate limit/i.test(msg)) {
      return send(res, 429, { ok: false, error: 'Too many sign-in attempts. Wait a minute and try again.' });
    }
    return send(res, 502, { ok: false, error: 'Sign-in is not connected to the Command Center correctly (a setup issue, not your password). Billy has been told how to check it.' });
  }
  const user = await userFromToken(d.access_token);
  if (!user) return send(res, 403, { ok: false, error: 'This Command Center account is not active for Proposal Studio. Ask Billy to check your account status in the Command Center.' });
  return send(res, 200, { ok: true, access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in, name: user.full_name, role: user.role });
}
