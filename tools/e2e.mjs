// End-to-end check: load the unpacked extension into Chrome for Testing, open several
// windows, then drive the popup page and assert that switching, moving, renaming and
// searching really change browser state. Writes screenshots to tools/out/.
//
//   npm run e2e            (headless)
//   HEADED=1 npm run e2e   (watch it; window focus events are only real when headed)
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tools', 'out');
const profile = path.join(root, 'tools', 'profile');
fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const { server, base } = await serve();
const headless = !process.env.HEADED;

// Google Chrome (branded) refuses --load-extension since 137; use Playwright's Chrome for Testing.
// channel 'chromium' selects the full build with new headless, which supports extensions.
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless,
  viewport: { width: 900, height: 700 },
  colorScheme: 'light',
  args: [
    `--disable-extensions-except=${root}`,
    `--load-extension=${root}`,
    '--no-first-run',
    '--hide-crash-restore-bubble',
  ],
});

let failures = 0;
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  if (!cond) failures++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A key that makes the popup close itself can close the page between keydown and keyup.
async function press(page, key) {
  try { await page.keyboard.press(key); } catch (err) { if (!page.isClosed()) throw err; }
}

try {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  const popupUrl = `chrome-extension://${extId}/src/popup.html`;
  console.log('extension id', extId, headless ? '(headless)' : '(headed)');

  const pageUrl = (title) => `${base}/page?title=${encodeURIComponent(title)}`;

  // Window 1: the initial window. Two content tabs plus a probe page we can evaluate chrome.* in.
  const w1a = context.pages()[0] || await context.newPage();
  await w1a.goto(pageUrl('Alpha one'));
  const w1b = await context.newPage();
  await w1b.goto(pageUrl('Alpha two'));
  const probe = await context.newPage();
  await probe.goto(`chrome-extension://${extId}/src/options.html`);

  const allWindows = () => probe.evaluate(async () => {
    const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    return wins.sort((a, b) => a.id - b.id).map((w) => ({
      id: w.id, focused: w.focused, tabs: w.tabs.map((t) => ({ title: t.title, url: t.url, active: t.active })),
    }));
  });
  const focusedId = () => probe.evaluate(async () => {
    const wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const f = wins.find((w) => w.focused);
    if (f) return f.id;
    const last = await chrome.windows.getLastFocused();
    return last && last.id;
  });
  const focus = async (id) => {
    await probe.evaluate(async (id) => chrome.windows.update(id, { focused: true }), id);
    await sleep(400);
  };

  // Windows 2 and 3 as real separate windows, filled with tabs through the extension API.
  const openWindow = async (titles) => {
    const id = await probe.evaluate(async (url) => (await chrome.windows.create({ url, focused: true })).id, pageUrl(titles[0]));
    for (const t of titles.slice(1)) {
      await probe.evaluate(async ({ id, url }) => chrome.tabs.create({ windowId: id, url, active: false }), { id, url: pageUrl(t) });
    }
    await sleep(500);
    return id;
  };
  const W2 = await openWindow(['Beta one', 'Beta two', 'Beta three']);
  const W3 = await openWindow(['Gamma one']);
  let wins = await allWindows();
  const W1 = wins[0].id;
  check('three normal windows exist', wins.length === 3 && wins[1].id === W2 && wins[2].id === W3, JSON.stringify(wins.map((w) => [w.id, w.tabs.length])));

  // Focus order: W2 then W1, so "previous" from W1 is W2.
  await focus(W2);
  await focus(W1);
  const mru = await probe.evaluate(() => chrome.storage.session.get('mru').then((r) => r.mru));
  const mruOk = Array.isArray(mru) && mru[0] === W1 && mru[1] === W2;
  check('service worker recorded focus order', mruOk, JSON.stringify(mru) + (headless && !mruOk ? ' — headless Chrome may not emit focus events; run HEADED=1' : ''));

  // Open the popup as a tab in a given window and return its Playwright page.
  const openPopup = async (windowId = W1) => {
    await probe.evaluate(async ({ windowId, url }) => chrome.tabs.create({ windowId, url, active: true }), { windowId, url: popupUrl });
    let page = null;
    for (let i = 0; i < 50 && !page; i++) {
      page = context.pages().find((p) => p.url().startsWith(popupUrl) && !p.isClosed());
      if (!page) await sleep(100);
    }
    if (!page) throw new Error('popup page did not appear');
    await page.waitForSelector('.row', { timeout: 10000 });
    await page.bringToFront();
    await sleep(250);
    return page;
  };
  const waitClosed = async (page) => {
    for (let i = 0; i < 30 && !page.isClosed(); i++) await sleep(100);
    return page.isClosed();
  };
  const rowInfo = (page) => page.evaluate(() => [...document.querySelectorAll('.row')].map((r) => ({
    id: Number(r.dataset.id),
    keys: [...r.querySelectorAll('.key')].map((k) => k.textContent),
    name: r.querySelector('.name')?.textContent,
    sel: r.classList.contains('sel'),
    cur: r.classList.contains('cur'),
    count: r.querySelector('.count')?.textContent,
    favicons: r.querySelectorAll('.favs > *').length,
    title: r.querySelector('.title')?.textContent,
  })));

  // --- default state ---
  let popup = await openPopup(W1);
  let rows = await rowInfo(popup);
  console.log(JSON.stringify(rows.map((r) => ({ id: r.id, keys: r.keys, name: r.name, sel: r.sel, cur: r.cur, count: r.count }))));
  check('rows are the three windows in id order', rows.map((r) => r.id).join() === [W1, W2, W3].join());
  check('keycaps 1 2 3 and ghost 0 on the last row', rows[0].keys[0] === '1' && rows[1].keys[0] === '2' && rows[2].keys.join() === '3,0');
  check('current window row is marked', rows[0].cur && !rows[1].cur && !rows[2].cur);
  check('previous window (W2) is preselected', rows[1].sel, `selected: ${rows.findIndex((r) => r.sel)}`);
  check('tab counts', /^3/.test(rows[1].count) && /^1/.test(rows[2].count), `${rows[1].count} / ${rows[2].count}`);
  check('favicon strips have tiles', rows.every((r) => r.favicons >= 1));
  check('default names come from the first tab site', rows[1].name === '127.0.0.1', rows[1].name);
  await popup.screenshot({ path: path.join(outDir, '1-default.png') });

  // --- digit 3 -> window 3 ---
  await press(popup, 'Digit3');
  check('popup closes itself after switching', await waitClosed(popup));
  check('digit 3 focuses window 3', (await focusedId()) === W3, `focused ${await focusedId()}`);

  // --- Enter -> previous window ---
  await focus(W1);
  popup = await openPopup(W1);
  rows = await rowInfo(popup);
  check('after switching, previous is W3', rows[2].sel, `selected: ${rows.findIndex((r) => r.sel)}`);
  await press(popup, 'Enter');
  await waitClosed(popup);
  check('Enter goes to the previous window', (await focusedId()) === W3);

  // --- digit 0 -> last window ---
  await focus(W1);
  popup = await openPopup(W1);
  await press(popup, 'Digit0');
  await waitClosed(popup);
  check('digit 0 focuses the last window', (await focusedId()) === W3);

  // --- search ---
  await focus(W1);
  popup = await openPopup(W1);
  await popup.keyboard.type('beta th');
  await sleep(200);
  rows = await rowInfo(popup);
  check('search narrows to window 2 and shows the matched tab', rows.length === 1 && rows[0].id === W2 && /Beta three/.test(rows[0].title || ''), `${rows.length} rows, "${rows[0] && rows[0].title}"`);
  check('search row keeps its real number', rows[0] && rows[0].keys[0] === '2');
  await popup.screenshot({ path: path.join(outDir, '2-search.png') });
  await press(popup, 'Enter');
  await waitClosed(popup);
  wins = await allWindows();
  const activeInW2 = wins.find((w) => w.id === W2).tabs.find((t) => t.active).title;
  check('Enter on a search hit focuses that window and activates the tab', (await focusedId()) === W2 && activeInW2 === 'Beta three', activeInW2);

  // --- digits during search still jump ---
  await focus(W1);
  popup = await openPopup(W1);
  await popup.keyboard.type('beta');
  await press(popup, 'Digit3');
  await waitClosed(popup);
  check('digit during search jumps by window number', (await focusedId()) === W3);

  // --- Escape clears the search, then closes ---
  await focus(W1);
  popup = await openPopup(W1);
  await popup.keyboard.type('zzz');
  await sleep(150);
  const emptyShown = await popup.evaluate(() => !document.getElementById('empty').hidden);
  await press(popup, 'Escape');
  await sleep(150);
  const cleared = await popup.evaluate(() => document.getElementById('search').value === '' && document.querySelectorAll('.row').length === 3);
  check('no-match message, and Escape clears the search', emptyShown && cleared);
  await press(popup, 'Escape');
  check('second Escape closes the popup', await waitClosed(popup));

  // --- rename via F2 ---
  await focus(W1);
  popup = await openPopup(W1);
  const selectedId = await popup.evaluate(() => Number(document.querySelector('.row.sel')?.dataset.id));
  await popup.keyboard.press('F2');
  await popup.waitForSelector('.rename-input');
  await popup.keyboard.type('Named window');
  await press(popup, 'Enter');
  await sleep(300);
  const saved = await probe.evaluate(() => chrome.storage.local.get('savedNames').then((r) => r.savedNames));
  check('rename saved a name entry', Array.isArray(saved) && saved.length === 1 && saved[0].name === 'Named window', JSON.stringify(saved));
  rows = await rowInfo(popup);
  check('renamed window shows its name', rows.some((r) => r.id === selectedId && r.name === 'Named window'), JSON.stringify(rows.map((r) => [r.id, r.name])));
  await popup.screenshot({ path: path.join(outDir, '3-renamed.png') });
  await press(popup, 'Escape');
  await waitClosed(popup);

  // --- rename survives a "restart": clear session bindings and reopen ---
  await probe.evaluate(() => chrome.storage.session.set({ bindings: {} }));
  popup = await openPopup(W1);
  rows = await rowInfo(popup);
  check('name re-attaches by tab fingerprint after bindings are lost', rows.some((r) => r.id === selectedId && r.name === 'Named window'));
  await press(popup, 'Escape');
  await waitClosed(popup);

  // --- Shift mode and Alt+Shift+2: move the popup's own tab into window 2 without following ---
  popup = await openPopup(W1);
  await popup.keyboard.down('Shift');
  await sleep(150);
  const shiftKeys = await popup.evaluate(() => [...document.querySelectorAll('.row .key')].map((k) => k.textContent));
  const modeText = await popup.evaluate(() => document.getElementById('mode').textContent);
  check('holding Shift relabels keycaps and shows the move prompt', shiftKeys[0] === '⇧1' && modeText.length > 0, `${shiftKeys.join(' ')} / ${modeText}`);
  await popup.screenshot({ path: path.join(outDir, '4-shift.png') });
  await popup.keyboard.down('Alt');
  await press(popup, 'Digit2');
  await popup.keyboard.up('Alt');
  await popup.keyboard.up('Shift');
  await sleep(800);
  wins = await allWindows();
  const popupTabIn = wins.find((w) => w.tabs.some((t) => t.url.startsWith(popupUrl)));
  check('Alt+Shift+2 moved the current tab into window 2 and stayed', popupTabIn && popupTabIn.id === W2 && !popup.isClosed(), popupTabIn && String(popupTabIn.id));
  rows = await rowInfo(popup);
  check('list refreshed: window 2 is now the current window', rows[1].cur && /^4/.test(rows[1].count), rows[1].count);
  await press(popup, 'Escape');
  await waitClosed(popup);

  // --- closing a window renumbers ---
  await probe.evaluate(async (W3) => chrome.windows.remove(W3), W3);
  await sleep(500);
  popup = await openPopup(W1);
  rows = await rowInfo(popup);
  check('closing a window drops it and the ghost 0 moves', rows.length === 2 && rows[1].keys.join() === '2,0', JSON.stringify(rows.map((r) => r.keys)));
  await press(popup, 'Escape');
  await waitClosed(popup);

  // --- options page ---
  await probe.reload();
  await sleep(400);
  const optTitle = await probe.evaluate(() => document.querySelector('h1').textContent);
  const shortcut = await probe.evaluate(() => document.getElementById('shortcut').textContent);
  const namesListed = await probe.evaluate(() => document.querySelectorAll('#names li').length);
  check('options page shows title, shortcut and the saved name', optTitle.length > 0 && shortcut.length > 0 && namesListed === 1, `${optTitle} / ${shortcut} / ${namesListed}`);
  await probe.screenshot({ path: path.join(outDir, '5-options.png'), fullPage: true });
} catch (err) {
  failures++;
  console.error('ERROR', err);
} finally {
  await context.close();
  server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
