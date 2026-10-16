// Fallback renderer (Node + Playwright). Called by build_proposal.py when Python Playwright is absent.
// Usage: node render.js <in.html> <out.pdf> [previewDir]   -> prints JSON array of page heights
const path = require('path');
function loadPlaywright() {
  const tries = ['playwright', 'playwright-core'];
  const globalRoot = (() => { try { return require('child_process').execSync('npm root -g').toString().trim(); } catch (e) { return ''; } })();
  for (const t of tries) {
    try { return require(t); } catch (e) {}
    if (globalRoot) { try { return require(path.join(globalRoot, t)); } catch (e) {} }
  }
  throw new Error('playwright not found');
}
(async () => {
  const { chromium } = loadPlaywright();
  const [, , htmlFile, pdfOut, previewDir] = process.argv;
  const opts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  const browser = await chromium.launch(opts);
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await page.goto('file://' + path.resolve(htmlFile), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const heights = await page.evaluate(() => [...document.querySelectorAll('.page')].map(p => Math.round(p.getBoundingClientRect().height)));
  if (previewDir) {
    const els = await page.$$('.page');
    for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(previewDir, `page-${i + 1}.png`) });
  }
  await page.pdf({ path: pdfOut, preferCSSPageSize: true, printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  await browser.close();
  console.log(JSON.stringify(heights));
})().catch(e => { console.error(e.message); process.exit(1); });
