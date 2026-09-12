// Rasterise icons/icon.svg into the PNG sizes the manifest needs, using the installed Chrome.
// Small sizes get a simplified glyph so the icon stays legible at 16 px.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const full = fs.readFileSync(path.join(root, 'icons', 'icon.svg'), 'utf8');
const small = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="30" fill="#4258D6"/>
  <text x="64" y="102" text-anchor="middle" font-family="-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="104" font-weight="800" fill="#FFFFFF">1</text>
</svg>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of [16, 32, 48, 128]) {
  const svg = size <= 32 ? small : full;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg.replace(/width="128" height="128"/, `width="${size}" height="${size}"`)}</body></html>`);
  const out = path.join(root, 'icons', `icon${size}.png`);
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', path.relative(root, out));
}
await browser.close();
