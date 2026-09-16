// Drive a headed Chrome for Testing that shows the Chrome Web Store developer console, over CDP.
// 1) bash tools/devconsole-browser.sh   (opens the console; sign in yourself)
// 2) node tools/devconsole.mjs "<async body using page, ctx, pages>"   e.g. "return await page.title();"
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:9333');
const ctx = browser.contexts()[0];
const pages = ctx.pages();
const page = pages.find((p) => p.url().includes('webstore/devconsole')) || pages[pages.length - 1];
const code = process.argv[2] || 'return { url: page.url(), title: await page.title() };';
const fn = new Function('page', 'ctx', 'browser', 'pages', `return (async () => { ${code} })();`);
try {
  const out = await fn(page, ctx, browser, pages);
  if (out !== undefined) console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
} catch (err) {
  console.error('ERR', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
