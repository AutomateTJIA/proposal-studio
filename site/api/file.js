// Streams a private file (the proposal PDF) through a short-lived signed link.
import { readBytes, verifySigned, OUTPUT } from './_lib.js';

export default async function handler(req, res) {
  const { p, e, s, download } = req.query;
  if (typeof p !== 'string' || !p.startsWith(OUTPUT) || p.includes('..') || !verifySigned(p, e, s)) {
    res.status(403).send('This link has expired. Open the proposal again from Proposal Studio.');
    return;
  }
  const bytes = await readBytes(p);
  if (!bytes) { res.status(404).send('Not found'); return; }
  const name = p.split('/').pop();
  res.setHeader('Content-Type', name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${name.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).send(bytes);
}
