// Renders the proposal HTML to PDF with headless Chromium, the same way the skill does
// (850×1100px sheets, CSS page size, backgrounds on) and measures every page for overflow.
import puppeteer from 'puppeteer-core';

async function launch() {
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox'] });
  }
  const { default: chromium } = await import('@sparticuz/chromium');
  chromium.setGraphicsMode = false;
  return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
}

export function countPdfPages(buf) {
  return (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
}

export async function renderPdf(html) {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    const heights = await page.evaluate(() =>
      [...document.querySelectorAll('.page')].map(p => Math.round(p.getBoundingClientRect().height)));
    const pdf = Buffer.from(await page.pdf({
      preferCSSPageSize: true, printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' },
    }));
    return { pdf, heights, pdfCount: countPdfPages(pdf) };
  } finally {
    await browser.close();
  }
}
