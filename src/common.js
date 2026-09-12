// Shared logic for Windial: naming rules, window fingerprints, storage, i18n.
// Runs in the popup, the options page and the background service worker.

export const MAX_FAVICONS = 6;
export const MAX_NAME_LENGTH = 24;

// ---------- i18n ----------

export function t(key, ...subs) {
  try {
    const m = chrome.i18n.getMessage(key, subs.map(String));
    if (m) return m;
  } catch (_) { /* mock or unavailable */ }
  return key;
}

export function uiLanguage() {
  try { return chrome.i18n.getUILanguage() || 'en'; } catch (_) { return 'en'; }
}

// ---------- URLs and site labels ----------

const TWO_PART_SUFFIXES = new Set([
  'co.kr', 'or.kr', 'go.kr', 'ne.kr', 're.kr', 'pe.kr', 'ac.kr',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au', 'com.br', 'com.cn', 'com.tw', 'com.hk',
  'com.sg', 'co.in', 'co.nz', 'com.mx', 'co.za', 'com.ar', 'com.tr',
]);

export function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'ftp:') {
      return u.hostname.replace(/^www\./i, '').toLowerCase();
    }
    if (u.protocol === 'file:') return 'file';
    if (u.protocol === 'chrome:' || u.protocol === 'edge:') return `${u.protocol}//${u.hostname}`;
    if (u.protocol === 'chrome-extension:') return 'extension';
    return u.protocol.replace(':', '');
  } catch (_) {
    return '';
  }
}

// "map.naver.com" -> "Naver", "wiki.bambulab.com" -> "Bambulab", "chrome://newtab" -> "Chrome"
export function siteLabel(url) {
  const host = hostOf(url);
  if (!host) return '';
  if (host.startsWith('chrome://') || host.startsWith('edge://')) return 'Chrome';
  if (host === 'extension') return 'Extension';
  if (host === 'file') return 'File';
  if (host === 'localhost' || /^[\d.]+$/.test(host) || /^\[/.test(host)) return host;
  const parts = host.split('.');
  let label = parts[0];
  if (parts.length >= 2) {
    const lastTwo = parts.slice(-2).join('.');
    if (TWO_PART_SUFFIXES.has(lastTwo) && parts.length >= 3) label = parts[parts.length - 3];
    else label = parts[parts.length - 2];
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// ---------- Window fingerprints (to re-attach names after a restart) ----------

export function fingerprint(win) {
  const tabs = win.tabs || [];
  const urls = [];
  const hosts = [];
  for (const tab of tabs) {
    const url = tab.url || tab.pendingUrl || '';
    if (!url) continue;
    if (!urls.includes(url)) urls.push(url);
    const h = hostOf(url);
    if (h && !hosts.includes(h)) hosts.push(h);
  }
  return { urls: urls.slice(0, 40), hosts: hosts.slice(0, 40) };
}

function jaccard(a, b) {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  let inter = 0;
  for (const x of a) if (sb.has(x)) inter++;
  return inter / (a.length + b.length - inter);
}

export function fingerprintScore(fpA, fpB) {
  return 0.7 * jaccard(fpA.urls, fpB.urls) + 0.3 * jaccard(fpA.hosts, fpB.hosts);
}

const REBIND_THRESHOLD = 0.4;

// ---------- Storage ----------
// chrome.storage.local  : settings, savedNames[]
// chrome.storage.session: mru[], bindings{windowId->savedId}, nanoNames{windowId->{name,sig}}

export const DEFAULT_SETTINGS = {
  naming: 'rule',        // 'rule' | 'nano'
  nameLang: 'system',    // 'system' | 'ko' | 'en' | 'ja' | ...
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function setSettings(patch) {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getSavedNames() {
  const { savedNames } = await chrome.storage.local.get('savedNames');
  return Array.isArray(savedNames) ? savedNames : [];
}

export async function setSavedNames(list) {
  await chrome.storage.local.set({ savedNames: list });
}

export async function getSession(key, fallback) {
  const r = await chrome.storage.session.get(key);
  return r[key] === undefined ? fallback : r[key];
}

export async function setSession(obj) {
  await chrome.storage.session.set(obj);
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Make sure every window that has a saved name is bound to it.
// Returns { bindings, savedNames } after binding unbound windows to the best matching saved name.
export async function resolveBindings(windows) {
  const savedNames = await getSavedNames();
  const bindings = await getSession('bindings', {});
  const liveIds = new Set(windows.map((w) => String(w.id)));

  // Drop bindings for windows that no longer exist.
  let changed = false;
  for (const id of Object.keys(bindings)) {
    if (!liveIds.has(id)) { delete bindings[id]; changed = true; }
  }
  const boundSaved = new Set(Object.values(bindings));

  // Bind unbound windows to unbound saved names by fingerprint similarity.
  const candidates = [];
  for (const win of windows) {
    if (bindings[win.id]) continue;
    const fp = fingerprint(win);
    for (const saved of savedNames) {
      if (boundSaved.has(saved.id)) continue;
      const score = fingerprintScore(fp, saved.fp || { urls: [], hosts: [] });
      if (score >= REBIND_THRESHOLD) candidates.push({ score, windowId: win.id, savedId: saved.id });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const usedWin = new Set();
  for (const c of candidates) {
    if (usedWin.has(c.windowId) || boundSaved.has(c.savedId)) continue;
    bindings[c.windowId] = c.savedId;
    usedWin.add(c.windowId);
    boundSaved.add(c.savedId);
    changed = true;
  }

  // Refresh fingerprints of bound windows so they stay current.
  let savedChanged = false;
  for (const win of windows) {
    const savedId = bindings[win.id];
    if (!savedId) continue;
    const saved = savedNames.find((s) => s.id === savedId);
    if (!saved) { delete bindings[win.id]; changed = true; continue; }
    const fp = fingerprint(win);
    if (fp.urls.length && JSON.stringify(fp) !== JSON.stringify(saved.fp)) {
      saved.fp = fp;
      saved.updated = Date.now();
      savedChanged = true;
    }
  }

  if (changed) await setSession({ bindings });
  if (savedChanged) await setSavedNames(savedNames);
  return { bindings, savedNames };
}

// Save (or clear, when name is empty) the user-chosen name of a window.
export async function saveWindowName(win, name) {
  const clean = (name || '').trim().slice(0, MAX_NAME_LENGTH);
  const savedNames = await getSavedNames();
  const bindings = await getSession('bindings', {});
  const existingId = bindings[win.id];

  if (!clean) {
    if (existingId) {
      const idx = savedNames.findIndex((s) => s.id === existingId);
      if (idx >= 0) savedNames.splice(idx, 1);
      delete bindings[win.id];
      await setSavedNames(savedNames);
      await setSession({ bindings });
    }
    return null;
  }

  const fp = fingerprint(win);
  let entry = existingId ? savedNames.find((s) => s.id === existingId) : null;
  if (entry) {
    entry.name = clean;
    entry.fp = fp;
    entry.updated = Date.now();
  } else {
    entry = { id: uid(), name: clean, fp, created: Date.now(), updated: Date.now() };
    savedNames.push(entry);
    bindings[win.id] = entry.id;
    await setSession({ bindings });
  }
  await setSavedNames(savedNames);
  return entry;
}

// ---------- Naming ----------

export function defaultName(win) {
  const tabs = win.tabs || [];
  const first = tabs[0];
  if (!first) return '';
  const label = siteLabel(first.url || first.pendingUrl || '');
  return label || (first.title || '').slice(0, MAX_NAME_LENGTH);
}

// Signature used to decide whether a Nano-generated name is stale.
export function nanoSignature(win) {
  return fingerprint(win).hosts.slice().sort().join('|');
}

export function nanoSignatureStale(sigA, sigB) {
  const a = sigA ? sigA.split('|') : [];
  const b = sigB ? sigB.split('|') : [];
  return jaccard(a, b) < 0.6;
}

// Resolve the display name of each window. Order: user name > nano name > default rule.
// `nanoNames` is { windowId: { name, sig } } from session storage (may be empty).
export function displayName(win, bindings, savedNames, nanoNames, settings) {
  const savedId = bindings[win.id];
  if (savedId) {
    const saved = savedNames.find((s) => s.id === savedId);
    if (saved && saved.name) return { name: saved.name, source: 'user' };
  }
  if (settings.naming === 'nano') {
    const n = nanoNames && nanoNames[win.id];
    if (n && n.name && !nanoSignatureStale(n.sig, nanoSignature(win))) {
      return { name: n.name, source: 'nano' };
    }
  }
  return { name: defaultName(win), source: 'rule' };
}

// ---------- Misc ----------

export function colorForHost(host) {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 45% 45%)`;
}

export function faviconFallbackUrl(pageUrl, size = 32) {
  try {
    const u = new URL(chrome.runtime.getURL('/_favicon/'));
    u.searchParams.set('pageUrl', pageUrl);
    u.searchParams.set('size', String(size));
    return u.toString();
  } catch (_) {
    return '';
  }
}

export const GROUP_COLORS = {
  grey: '#5F6368', blue: '#1A73E8', red: '#D93025', yellow: '#F29900', green: '#188038',
  pink: '#D01884', purple: '#A142F4', cyan: '#007B83', orange: '#FA903E',
};
