// Newline-delimited JSON progress stream, so the page can show each step while the function runs.
export function progress(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  const say = obj => res.write(JSON.stringify(obj) + '\n');
  return { say, end: obj => { if (obj) say(obj); res.end(); } };
}
