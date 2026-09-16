// Windial service worker: remembers window focus order (for "previous window"),
// keeps name bindings tidy, and draws the per-tab toolbar icon with the window's number.

import { getSession, setSession, resolveBindings, keyLabel } from './common.js';
import { getShortcut } from './shortcut.js';
import { iconImageData } from './icon.js';

const MRU_LIMIT = 50;

async function pushMru(windowId) {
  const mru = await getSession('mru', []);
  const next = [windowId, ...mru.filter((id) => id !== windowId)].slice(0, MRU_LIMIT);
  await setSession({ mru: next });
}

async function forgetWindow(windowId) {
  const [mru, bindings, sessionNames] = await Promise.all([
    getSession('mru', []), getSession('bindings', {}), getSession('sessionNames', {}),
  ]);
  delete bindings[windowId];
  delete sessionNames[windowId];
  await setSession({ mru: mru.filter((id) => id !== windowId), bindings, sessionNames });
}

// The toolbar icon shows the number of the window it sits in. Icons are per tab, so every
// tab of window N carries "N"; renumbering (a window closes) redraws them all. If drawing is
// not possible the number falls back to a badge.
const BADGE_BG = '#EEF0FF';
const BADGE_INK = '#2A3BB0';
let badgeTimer = null;
const iconLabels = {}; // tabId -> label, for the e2e check
const iconErrors = []; // last few setIcon failures, for the e2e check
function scheduleBadges() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => refreshBadges().catch(() => {}), 120);
}
function iconFor(label) {
  try { return iconImageData(label); } catch (_) { return null; }
}
async function refreshBadges() {
  const wins = await normalWindows();
  wins.sort((a, b) => a.id - b.id);
  const jobs = [];
  for (const id of Object.keys(iconLabels)) delete iconLabels[id];
  wins.forEach((w, i) => {
    const label = keyLabel(i);
    const img = iconFor(label);
    for (const tab of w.tabs || []) {
      iconLabels[tab.id] = label;
      jobs.push(img
        ? chrome.action.setIcon({ tabId: tab.id, imageData: img }).catch((err) => { iconErrors.push(String(err)); if (iconErrors.length > 5) iconErrors.shift(); })
        : chrome.action.setBadgeText({ tabId: tab.id, text: label }).catch(() => {}));
    }
  });
  await Promise.all(jobs);
}
function initBadgeStyle() {
  chrome.action.setBadgeBackgroundColor({ color: BADGE_BG }).catch(() => {});
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: BADGE_INK }).catch(() => {});
}
initBadgeStyle();
scheduleBadges();

// Incognito windows are included when the user has allowed the extension in incognito
// (Chrome hides them from us otherwise). Nothing about them is persisted.
async function normalWindows() {
  return chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
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
  scheduleBadges();
});

chrome.windows.onCreated.addListener(() => {
  scheduleBadges();
});

chrome.runtime.onStartup.addListener(() => {
  initBadgeStyle();
  scheduleBadges();
  seedMru().then(rebind).catch(() => {});
});

chrome.runtime.onInstalled.addListener((details) => {
  initBadgeStyle();
  scheduleBadges();
  seedMru().then(rebind).catch(() => {});
  welcomeIfNeeded(details.reason).catch(() => {});
});

chrome.tabs.onCreated.addListener(() => scheduleBadges());

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
  if (!msg) return false;
  if (msg.type === 'iconLabels') { sendResponse({ ...iconLabels }); return false; }
  if (msg.type === 'iconStatus') { sendResponse({ labels: { ...iconLabels }, errors: [...iconErrors] }); return false; }
  if (msg.type !== 'moveTab') return false;
  moveTab(msg).then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});

async function moveTab({ tabId, windowId, follow }) {
  const tab = await chrome.tabs.get(tabId);
  const target = await chrome.windows.get(windowId);
  if (Boolean(tab.incognito) !== Boolean(target.incognito)) throw new Error('incognito-boundary');
  if (tab.pinned) await chrome.tabs.update(tabId, { pinned: false }); // pinned tabs cannot change window
  await chrome.tabs.move(tabId, { windowId, index: -1 });
  if (!follow) return;
  await chrome.tabs.update(tabId, { active: true });
  const win = await chrome.windows.get(windowId);
  if (win.state === 'minimized') await chrome.windows.update(windowId, { state: 'normal' });
  await chrome.windows.update(windowId, { focused: true });
}

chrome.tabs.onUpdated.addListener((_tabId, info) => {
  if (info.status === 'loading') scheduleBadges(); // tab-scoped icons are cleared on navigation
});
chrome.tabs.onAttached.addListener(() => scheduleBadges());

