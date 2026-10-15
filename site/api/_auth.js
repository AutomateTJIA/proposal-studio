// Sign-in by email code: a 6-digit code is emailed to the person's agency email (the one on their
// Command Center account). Only active team members get a code. Codes last 10 minutes, allow 5 tries,
// and an email can request at most 5 codes per 15 minutes. Needs the Command Center server key and Resend.
import crypto from 'node:crypto';
import { putFile, readBytes, ccServiceKey, staffProfile, makeSession } from './_lib.js';

const FROM = () => process.env.RESEND_FROM_ADDRESS || 'The Jordan Insurance Agency <noreply@thejordaninsuranceagency.com>';
const CODE_MINUTES = 10;
const pathFor = email => `auth/codes/${crypto.createHash('sha256').update(email).digest('hex')}.json`;
const hashCode = (email, code) => crypto.createHmac('sha256', ccServiceKey()).update(`${email}|${code}`).digest('hex');

export const codeLoginReady = () => Boolean(ccServiceKey() && process.env.RESEND_API_KEY);

async function load(email) {
  const b = await readBytes(pathFor(email)).catch(() => null);
  return b ? JSON.parse(b.toString()) : { sends: [] };
}
const save = (email, rec) => putFile(pathFor(email), JSON.stringify(rec), 'application/json');

/** Emails a code if the address belongs to an active team member. Always resolves without saying which. */
export async function requestCode(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Enter your agency email address.' };
  const profile = await staffProfile({ email });
  if (!profile) { console.warn('code request for non-staff email'); return { ok: true }; }
  const rec = await load(email);
  const recent = (rec.sends || []).filter(t => t > Date.now() - 15 * 60_000);
  if (recent.length >= 5) return { ok: false, error: 'Too many codes requested. Wait 15 minutes and try again.' };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await save(email, { hash: hashCode(email, code), exp: Date.now() + CODE_MINUTES * 60_000, tries: 0, sends: [...recent, Date.now()] });
  const first = String(profile.full_name || '').split(' ')[0] || 'there';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM(), to: [email], subject: `${code} is your Proposal Studio sign-in code`,
      text: `Hi ${first},\n\nYour Proposal Studio sign-in code is ${code}. It works for ${CODE_MINUTES} minutes.\n\nIf you didn't try to sign in, you can ignore this email.\n\nThe Jordan Insurance Agency`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;color:#0E2650"><p>Hi ${first.replace(/[<>&"]/g, '')},</p><p>Your Proposal Studio sign-in code is</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#163A70;margin:8px 0 16px">${code}</p><p>It works for ${CODE_MINUTES} minutes. If you didn't try to sign in, you can ignore this email.</p><p style="color:#1F5AA6">The Jordan Insurance Agency</p></div>`,
    }),
  });
  if (!r.ok) { console.error('code email failed', r.status, await r.text().catch(() => '')); return { ok: false, error: 'The sign-in email could not be sent. Try again in a minute.' }; }
  return { ok: true };
}

/** Checks the code and returns a session for the team member, or an error. */
export async function verifyCode(rawEmail, rawCode) {
  const email = String(rawEmail || '').trim().toLowerCase();
  const code = String(rawCode || '').replace(/\D/g, '');
  const rec = await load(email);
  if (!rec.hash || rec.exp < Date.now()) return { ok: false, error: 'That code has expired. Ask for a new one.' };
  if (rec.tries >= 5) return { ok: false, error: 'Too many wrong tries. Ask for a new code.' };
  const good = code.length === 6 && crypto.timingSafeEqual(Buffer.from(hashCode(email, code)), Buffer.from(rec.hash));
  if (!good) { rec.tries = (rec.tries || 0) + 1; await save(email, rec); return { ok: false, error: 'That code is not right. Check the email and try again.' }; }
  await save(email, { sends: rec.sends || [] });
  const profile = await staffProfile({ email });
  if (!profile) return { ok: false, error: 'This account is not active in the Command Center.' };
  return { ok: true, token: makeSession(profile.id), profile };
}
