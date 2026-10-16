// Proposal tracker: how many proposals the system built and how many went to clients,
// today / this week / this month / all time, and per team member. Dates are Eastern time.
import { send, currentUser } from './_lib.js';
import { readStats, etDate } from './_stats.js';

export default async function handler(req, res) {
  if (!(await currentUser(req))) return send(res, 401, { ok: false, error: 'Please sign in again.' });
  const rows = await readStats();
  const today = etDate();
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const week = new Date(Date.UTC(y, m - 1, d - ((dow + 6) % 7))).toISOString().slice(0, 10); // Monday
  const month = today.slice(0, 8) + '01';
  const tally = kind => {
    const r = rows.filter(x => x.kind === kind);
    return { today: r.filter(x => x.date === today).length, week: r.filter(x => x.date >= week).length,
      month: r.filter(x => x.date >= month).length, all: r.length };
  };
  const people = {};
  for (const r of rows) {
    if (r.kind === 'deleted') continue;
    const p = people[r.who] ||= { name: r.who, built_month: 0, sent_month: 0, built_all: 0, sent_all: 0 };
    p[`${r.kind}_all`]++;
    if (r.date >= month) p[`${r.kind}_month`]++;
  }
  return send(res, 200, { ok: true, today, built: tally('built'), sent: tally('sent'), deleted: tally('deleted'),
    since: rows.length ? rows.map(r => r.date).sort()[0] : null,
    people: Object.values(people).sort((a, b) => b.built_month - a.built_month || b.built_all - a.built_all) });
}
