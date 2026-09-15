// Windial service worker: remembers window focus order (for "previous window"),
// keeps name bindings tidy, and pre-computes Nano names when that option is on.

import { getSession, setSession, resolveBindings, getSettings } from './common.js';
import { refreshNanoNames, hasPromptApi } from './naming-nano.js';
import { getShortcut } from './shortcut.js';

const MRU_LIMIT = 50;

async function pushMru(windowId) {
  const mru = await getSession('mru', []);
  const next = [windowId, ...mru.filter((id) => id !== windowId)].slice(0, MRU_LIMIT);
  await setSession({ mru: next });
}

async function forgetWindow(windowId) {
  const [mru, bindings, nanoNames] = await Promise.all([
    getSession('mru', []), getSession('bindings', {}), getSession('nanoNames', {}),
  ]);
  delete bindings[windowId];
  delete nanoNames[windowId];
  await setSession({ mru: mru.filter((id) => id !== windowId), bindings, nanoNames });
}

async function normalWindows() {
  const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  return wins.filter((w) => !w.incognito);
}

async function seedMru() {
  const wins = await normalWindows();
  const mru = await getSession('mru', []);
  if (mru.length) return;
  const focused = wins.find((w) => w.focused);
  const ordered = [...(focused ? [focused] : []), ...wins.filter((w) => !focused || w.id !== focused.id)];
  await setSession({ mru: ordered.map((w) => w.id) });
}

async function rebind() {
  const wins = await normalWindows();
  await resolveBindings(wins);
}

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  pushMru(windowId).catch(() => {});
});

chrome.windows.onRemoved.addListener((windowId) => {
  forgetWindow(windowId).catch(() => {});
});

chrome.windows.onCreated.addListener(() => {
  scheduleNano();
});

chrome.runtime.onStartup.addListener(() => {
  seedMru().then(rebind).then(scheduleNano).catch(() => {});
});

chrome.runtime.onInstalled.addListener((details) => {
  seedMru().then(rebind).then(scheduleNano).catch(() => {});
  welcomeIfNeeded(details.reason).catch(() => {});
});

// Chrome cannot be asked to set a shortcut, only to suggest one. If the suggestion was
// refused (key already taken) the user would never find out — so show them, once, right away.
async function welcomeIfNeeded(reason) {
  if (reason !== 'install' && reason !== 'update') return;
  const shortcut = await getShortcut();
  if (reason === 'update' && shortcut) return;
  await setSession({ welcomeShownAt: Date.now() });
  await chrome.tabs.create({ url: chrome.runtime.getURL('src/welcome.html') });
}

// Moving the current tab out of the popup's window closes the popup at once, so the popup
// only sends the request; the worker finishes the whole sequence (move, activate, focus).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'moveTab') return false;
  moveTab(msg).then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});

async function moveTab({ tabId, windowId, follow }) {
  await chrome.tabs.move(tabId, { windowId, index: -1 });
  if (!follow) return;
  await chrome.tabs.update(tabId, { active: true });
  const win = await chrome.windows.get(windowId);
  if (win.state === 'minimized') await chrome.windows.update(windowId, { state: 'normal' });
  await chrome.windows.update(windowId, { focused: true });
}

// Nano naming in the background is best-effort; the popup also names on demand.
let nanoTimer = null;
function scheduleNano() {
  if (!hasPromptApi()) return;
  clearTimeout(nanoTimer);
  nanoTimer = setTimeout(async () => {
    try {
      const settings = await getSettings();
      if (settings.naming !== 'nano') return;
      const wins = await normalWindows();
      await refreshNanoNames(wins, settings);
    } catch (_) { /* ignore */ }
  }, 4000);
}

chrome.tabs.onUpdated.addListener((_tabId, info) => {
  if (info.status === 'complete' || info.title) scheduleNano();
});
chrome.tabs.onAttached.addListener(() => scheduleNano());
chrome.tabs.onDetached.addListener(() => scheduleNano());
chrome.tabs.onRemoved.addListener(() => scheduleNano());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) scheduleNano();
});
