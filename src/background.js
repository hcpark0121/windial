// Windial service worker: remembers window focus order (for "previous window"),
// keeps name bindings tidy, and pre-computes Nano names when that option is on.

import { getSession, setSession, resolveBindings, getSettings } from './common.js';
import { refreshNanoNames, hasPromptApi } from './naming-nano.js';

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

chrome.runtime.onInstalled.addListener(() => {
  seedMru().then(rebind).then(scheduleNano).catch(() => {});
});

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
