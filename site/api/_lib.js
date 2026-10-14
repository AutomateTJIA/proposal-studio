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

/** Staff requests carry `Authorization: Bearer <STAFF_PASSWORD>`. */
export function tokenOk(given) {
  const expected = process.env.STAFF_PASSWORD || '';
  if (!expected || !given) return false;
  return crypto.timingSafeEqual(sha(expected), sha(given));
}
export function isStaff(req) {
  const h = req.headers.authorization || '';
  return tokenOk(h.startsWith('Bearer ') ? h.slice(7) : '');
}
export function bearer(req) {
  return req.headers.authorization || '';
}

/** Short-lived signed links so the PDF can open in a new tab or iframe without the password. */
export function signPath(pathname, minutes = 60) {
  const exp = Date.now() + minutes * 60_000;
  const sig = crypto.createHmac('sha256', process.env.STAFF_PASSWORD || '').update(`${pathname}|${exp}`).digest('hex');
  return `/api/file?p=${encodeURIComponent(pathname)}&e=${exp}&s=${sig}`;
}
export function verifySigned(pathname, exp, sig) {
  if (!pathname || !exp || !sig || Number(exp) < Date.now()) return false;
  const want = crypto.createHmac('sha256', process.env.STAFF_PASSWORD || '').update(`${pathname}|${exp}`).digest('hex');
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
  const headers = { 'Content-Type': 'application/json', Authorization: bearer(req) };
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
