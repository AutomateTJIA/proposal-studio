// Shared helpers. Files starting with "_" are not exposed as routes.
import { get, put } from '@vercel/blob';
import crypto from 'node:crypto';

export const JOBS = 'jobs/';
export const QUOTES = 'quotes/';
export const OUTPUT = 'proposals/';

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

const sha = s => crypto.createHash('sha256').update(String(s)).digest();

// ---- Command Center sign-in (same accounts the team already uses)
const CC_DEFAULT = 'https://rcqhyiiywdpkndiwizxb.supabase.co';
/** The Command Center's Supabase address. A setting that isn't a Supabase project address (for example the
 *  Command Center's web address) is ignored, because sign-in and logging only work against Supabase. */
export const ccUrl = () => {
  const v = (process.env.CC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(v) ? v : CC_DEFAULT;
};
export const ccUrlSetting = () => {
  const v = (process.env.CC_SUPABASE_URL || '').trim();
  if (!v) return 'not set (using the Command Center default)';
  return /^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(v) ? 'ok' : `ignored: "${v.replace(/^https?:\/\//, '').slice(0, 60)}" is not a Supabase address`;
};
// Server-side only, never sent to the browser. Any Command Center project key works here; every data call
// still runs as the signed-in person (their token decides what they can see and do).
/** The Command Center's server key, when the configured key is one (never sent to the browser). Used only
 *  for Command Center logging after this server has verified the person is active agency staff. */
export function ccServiceKey() {
  const k = process.env.CC_SUPABASE_SERVICE_KEY || '';
  if (k.startsWith('sb_secret_')) return k;
  try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role === 'service_role' ? k : ''; } catch { return ''; }
}
export const ccApiKey = () => process.env.CC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.CC_SUPABASE_SERVICE_KEY || '';
export const STAFF_ROLES = ['csr', 'agent', 'admin', 'super_admin'];
export const APPROVER_ROLES = ['agent', 'admin', 'super_admin'];

const seen = new Map(); // token -> { user, until }
/** Returns {id, email, full_name, role, token} for an active Command Center team member, else null. */
// ---- Email-code sessions: issued by this server after a code sent to the person's agency email is
// verified. Signed with a secret derived from the Command Center server key; checked on every request.
const sessionSecret = () => crypto.createHmac('sha256', 'proposal-studio-session').update(ccServiceKey()).digest();
export const SESSION_HOURS = 12;
export function makeSession(profileId) {
  const body = Buffer.from(JSON.stringify({ u: profileId, e: Date.now() + SESSION_HOURS * 3600_000 })).toString('base64url');
  return `ps1.${body}.${crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url')}`;
}
function readSession(token) {
  const [, body, sig] = token.split('.');
  if (!body || !sig || !ccServiceKey()) return null;
  const want = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  const d = JSON.parse(Buffer.from(body, 'base64url').toString());
  return d.e > Date.now() && /^[0-9a-f-]{36}$/.test(d.u) ? d.u : null;
}
/** Looks up an active team member in the Command Center with the server key (by id or by email). */
export async function staffProfile({ id, email }) {
  const key = ccServiceKey();
  if (!key) return null;
  const q = id ? `id=eq.${id}` : `email=ilike.${encodeURIComponent(email)}`;
  const r = await fetch(`${ccUrl()}/rest/v1/profiles?select=id,email,full_name,role,status&${q}&limit=5`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const rows = r.ok ? await r.json() : [];
  const p = rows.find(x => id ? x.id === id : String(x.email || '').toLowerCase() === email);
  return p && p.status === 'active' && STAFF_ROLES.includes(p.role) ? p : null;
}

export async function userFromToken(token) {
  if (!token || !ccApiKey()) return null;
  const hit = seen.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  if (token.startsWith('ps1.')) {
    const id = readSession(token);
    const profile = id ? await staffProfile({ id }) : null;
    if (!profile) return null;
    const user = { ...profile, token };
    seen.set(token, { user, until: Date.now() + 5 * 60_000 });
    return user;
  }
  const headers = { apikey: ccApiKey(), Authorization: `Bearer ${token}` };
  const u = await fetch(`${ccUrl()}/auth/v1/user`, { headers });
  if (!u.ok) return null;
  const { id } = await u.json();
  const p = await fetch(`${ccUrl()}/rest/v1/profiles?select=id,email,full_name,role,status&id=eq.${id}`, { headers });
  const [profile] = p.ok ? await p.json() : [];
  if (!profile || profile.status !== 'active' || !STAFF_ROLES.includes(profile.role)) return null;
  const user = { ...profile, token };
  seen.set(token, { user, until: Date.now() + 5 * 60_000 });
  if (seen.size > 500) seen.clear();
  return user;
}
export async function currentUser(req) {
  const h = req.headers.authorization || '';
  return userFromToken(h.startsWith('Bearer ') ? h.slice(7) : '');
}
export const canApprove = user => !!user && APPROVER_ROLES.includes(user.role);
export const approvalRequired = () => (process.env.REQUIRE_AGENT_APPROVAL || 'true') !== 'false';

// Server-side secret for signed links and the internal builder call (derived; nothing extra to set up).
const secret = () => crypto.createHmac('sha256', 'proposal-studio').update(process.env.BLOB_READ_WRITE_TOKEN || process.env.ANTHROPIC_API_KEY || '').digest('hex');
export const internalKey = () => crypto.createHmac('sha256', secret()).update('builder').digest('hex');

/** Short-lived signed links so the PDF can open in a new tab or iframe. */
export function signPath(pathname, minutes = 12 * 60) {
  const exp = Date.now() + minutes * 60_000;
  const sig = crypto.createHmac('sha256', secret()).update(`${pathname}|${exp}`).digest('hex');
  return `/api/file?p=${encodeURIComponent(pathname)}&e=${exp}&s=${sig}`;
}
export function verifySigned(pathname, exp, sig) {
  if (!pathname || !exp || !sig || Number(exp) < Date.now()) return false;
  const want = crypto.createHmac('sha256', secret()).update(`${pathname}|${exp}`).digest('hex');
  return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}

export function newId() {
  const d = new Date();
  const stamp = d.toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return `${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}
export function safeId(id) {
  return typeof id === 'string' && /^[0-9]{14}-[0-9a-f]{6}$/.test(id);
}

export async function readBytes(pathname) {
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || !r.stream) return null;
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}
export async function readJob(id) {
  const b = await readBytes(`${JOBS}${id}.json`);
  return b ? JSON.parse(b.toString('utf8')) : null;
}
export async function saveJob(job) {
  job.updated_at = new Date().toISOString();
  await put(`${JOBS}${job.id}.json`, JSON.stringify(job, null, 1), {
    access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
  });
  return job;
}
export async function putFile(pathname, body, contentType) {
  await put(pathname, body, { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: true });
  return pathname;
}

/** Calls the Python builder (api/build.py) on this same deployment. */
export async function callBuilder(req, payload) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = host && host.startsWith('localhost') ? 'http' : 'https';
  const headers = { 'Content-Type': 'application/json', 'X-Internal-Key': internalKey() };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const r = await fetch(`${proto}://${host}/api/build`, { method: 'POST', headers, body: JSON.stringify(payload) });
  const body = await r.json().catch(() => ({ ok: false, error: `Builder returned ${r.status}` }));
  return body;
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
