// Permanent proposal tally for the tracker. One tiny marker file per event, with everything the
// counter needs in its name (date, proposal id, who), so counting is a file listing, not thousands
// of reads. Markers are never removed, so deleting a proposal never makes the counts go backwards.
import { list } from '@vercel/blob';
import { putFile } from './_lib.js';

export const STATS = 'stats/';
const slug = name => String(name || 'Unknown').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Unknown';
export const etDate = (d = new Date()) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

/** kind: 'built' (PDF produced), 'sent' (marked as sent), 'deleted'. */
export async function track(kind, job, person) {
  await putFile(`${STATS}${kind}/${etDate()}_${job.id}_${slug(person)}`, '1', 'text/plain');
}

export async function readStats() {
  const rows = [];
  let cursor;
  do {
    const page = await list({ prefix: STATS, limit: 1000, cursor });
    for (const b of page.blobs) {
      const [kind, rest] = b.pathname.slice(STATS.length).split('/');
      const [date, id, who] = (rest || '').split('_');
      if (date && id) rows.push({ kind, date, id, who: (who || 'Unknown').replace(/-/g, ' ') });
    }
    cursor = page.hasMore ? page.cursor : null;
  } while (cursor);
  return rows;
}
