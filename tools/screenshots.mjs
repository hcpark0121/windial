// Store screenshots (1280x800) and README images, rendered from the mock popup.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'store', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const { server, base } = await serve();
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const shots = [
  { name: 'default', q: '', shift: '', langs: ['ko', 'en'] },
  { name: 'search', q: { ko: '밤부', en: 'bambu' }, shift: '', langs: ['ko', 'en'] },
  { name: 'move', q: '', shift: '1', langs: ['ko', 'en'] },
];

for (const lang of ['ko', 'en']) {
  for (const s of shots) {
    if (!s.langs.includes(lang)) continue;
    const q = typeof s.q === 'string' ? s.q : s.q[lang];
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light' });
    const url = `${base}/store/shot.html?state=${s.name}&lang=${lang}&q=${encodeURIComponent(q)}&shift=${s.shift}`;
    await page.goto(url);
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
    await page.waitForTimeout(300);
    const out = path.join(outDir, `${lang}-${s.name}.png`);
    await page.screenshot({ path: out });
    console.log('wrote', path.relative(root, out));
    await page.close();
  }

  // bare popup for the README
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 520, height: 600 }, deviceScaleFactor: 2, colorScheme: scheme });
    await page.goto(`${base}/src/popup.html?mock=1&lang=${lang}`);
    await page.waitForSelector('.row');
    await page.waitForTimeout(300);
    const h = await page.evaluate(() => document.getElementById('app').getBoundingClientRect().height);
    const out = path.join(outDir, `popup-${lang}-${scheme}.png`);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 520, height: Math.ceil(h) } });
    console.log('wrote', path.relative(root, out));
    await page.close();
  }
}

// promo tiles for the store listing (no alpha: they are full-bleed)
for (const [name, w, h] of [['tile-small', 440, 280], ['tile-marquee', 1400, 560]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'light' });
  await page.goto(`${base}/store/tile.html?size=${name === 'tile-small' ? 'small' : 'marquee'}&lang=en`);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const out = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: out });
  console.log('wrote', path.relative(root, out));
  await page.close();
}

await browser.close();
server.close();
