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
    grant = 'password'; payload = { email: body.email.trim().slice(0, 200), password: body.password.slice(0, 200) };
  } else {
    return send(res, 400, { ok: false, error: 'Enter your email and password.' });
  }
  const r = await fetch(`${ccUrl()}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST', headers: { apikey: ccApiKey(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) {
    return send(res, 401, { ok: false, error: grant === 'password' ? 'That email and password did not match a Command Center account.' : 'Please sign in again.' });
  }
  const user = await userFromToken(d.access_token);
  if (!user) return send(res, 403, { ok: false, error: 'This Command Center account is not set up for Proposal Studio.' });
  return send(res, 200, { ok: true, access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in, name: user.full_name, role: user.role });
}
