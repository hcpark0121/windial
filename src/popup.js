import {
  t, uiLanguage, MAX_FAVICONS, hostOf, colorForHost, faviconFallbackUrl, GROUP_COLORS, keyLabel,
  getSettings, getSession, resolveBindings, saveWindowName, displayName,
} from './common.js';
import { refreshNanoNames, hasPromptApi } from './naming-nano.js';
import { getShortcut, openShortcutsPage, parseShortcut, matchesShortcut } from './shortcut.js';

const $ = (id) => document.getElementById(id);
const els = {
  searchbox: $('searchbox'), search: $('search'), mode: $('mode'),
  list: $('list'), empty: $('empty'), foot: $('foot'), banner: $('banner'),
};

const state = {
  windows: [], currentId: null, previousId: null, groups: {},
  bindings: {}, savedNames: [], nanoNames: {}, settings: null,
  names: {}, rows: [], selected: 0, query: '', shift: false, renaming: null, activeTab: null,
  ownShortcut: null,
};

// ---------- data ----------

async function load() {
  const [all, current, mru, settings, nanoNames] = await Promise.all([
    chrome.windows.getAll({ populate: true, windowTypes: ['normal'] }),
    chrome.windows.getCurrent(),
    getSession('mru', []),
    getSettings(),
    getSession('nanoNames', {}),
  ]);
  const wins = all.filter((w) => !w.incognito).sort((a, b) => a.id - b.id);
  for (const w of wins) w.tabs = w.tabs || [];
  state.windows = wins;
  state.currentId = current.id;
  state.settings = settings;
  state.nanoNames = nanoNames;
  const live = new Set(wins.map((w) => w.id));
  state.previousId = mru.find((id) => id !== current.id && live.has(id)) ?? null;

  const cur = wins.find((w) => w.id === current.id);
  state.activeTab = cur ? cur.tabs.find((tab) => tab.active) || null : null;

  const groups = {};
  const hasGroups = wins.some((w) => w.tabs.some((tab) => tab.groupId !== undefined && tab.groupId >= 0));
  if (hasGroups && chrome.tabGroups) {
    try { for (const g of await chrome.tabGroups.query({})) groups[g.id] = g; } catch (_) { /* no permission */ }
  }
  state.groups = groups;

  const { bindings, savedNames } = await resolveBindings(wins);
  state.bindings = bindings;
  state.savedNames = savedNames;
  computeNames();
}

function computeNames() {
  state.names = {};
  for (const win of state.windows) {
    state.names[win.id] = displayName(win, state.bindings, state.savedNames, state.nanoNames, state.settings);
  }
}

function groupsOf(win) {
  const seen = [];
  for (const tab of win.tabs) {
    const gid = tab.groupId;
    if (gid === undefined || gid < 0 || seen.includes(gid)) continue;
    seen.push(gid);
  }
  return seen.map((gid) => state.groups[gid]).filter(Boolean);
}

function buildRows() {
  const q = state.query.trim().toLowerCase();
  const rows = [];
  state.windows.forEach((win, index) => {
    if (!q) { rows.push({ win, index, matchedTabs: [], nameHit: false, score: 0 }); return; }
    const name = state.names[win.id].name.toLowerCase();
    const nameHit = name.includes(q) || groupsOf(win).some((g) => (g.title || '').toLowerCase().includes(q));
    const matchedTabs = win.tabs.filter((tab) =>
      (tab.title || '').toLowerCase().includes(q) || (tab.url || '').toLowerCase().includes(q));
    if (!nameHit && !matchedTabs.length) return;
    const prefix = name.startsWith(q) ? 50 : 0;
    rows.push({ win, index, matchedTabs, nameHit, score: (nameHit ? 100 : 0) + prefix + matchedTabs.length });
  });
  if (q) rows.sort((a, b) => b.score - a.score || a.index - b.index);
  state.rows = rows;
}

function selectDefault() {
  if (state.query.trim()) { state.selected = 0; return; }
  let i = state.rows.findIndex((r) => r.win.id === state.previousId);
  if (i < 0) i = state.rows.findIndex((r) => r.win.id !== state.currentId);
  state.selected = Math.max(0, i);
}

function matchedTabFor(win) {
  const row = state.rows.find((r) => r.win.id === win.id);
  return row && row.matchedTabs.length ? row.matchedTabs[0] : null;
}

// ---------- actions ----------

async function activate(win, tab) {
  try {
    if (tab) await chrome.tabs.update(tab.id, { active: true });
    if (win.id === state.currentId && !tab) { window.close(); return; }
    if (win.state === 'minimized') await chrome.windows.update(win.id, { state: 'normal' });
    await chrome.windows.update(win.id, { focused: true });
  } catch (err) {
    console.warn('[windial] activate failed', err);
  }
  window.close();
}

async function moveActiveTab(target, follow) {
  const tab = state.activeTab;
  if (!tab || tab.windowId === target.id) return;
  // Chrome closes this popup the moment its window's active tab changes, so the service
  // worker performs the whole move. We must wait for its reply before closing ourselves:
  // closing right after sendMessage tears the page down before the message is delivered.
  try {
    await chrome.runtime.sendMessage({ type: 'moveTab', tabId: tab.id, windowId: target.id, follow });
  } catch (err) {
    console.warn('[windial] move failed', err);
  }
  if (follow) { window.close(); return; }
  await refresh();
}

async function refresh() {
  await load();
  buildRows();
  if (state.selected >= state.rows.length) state.selected = Math.max(0, state.rows.length - 1);
  render();
}

function setQuery(q) {
  state.query = q;
  if (els.search.value !== q) els.search.value = q;
  buildRows();
  selectDefault();
  render();
}

function setSelected(i) {
  if (!state.rows.length) return;
  state.selected = Math.min(Math.max(0, i), state.rows.length - 1);
  renderSelection();
}

function startRename() {
  const row = state.rows[state.selected];
  if (!row) return;
  state.renaming = row.win.id;
  state.shift = false;
  render();
}

async function commitRename(value) {
  const win = state.windows.find((w) => w.id === state.renaming);
  state.renaming = null;
  if (win) {
    await saveWindowName(win, value);
    const { bindings, savedNames } = await resolveBindings(state.windows);
    state.bindings = bindings;
    state.savedNames = savedNames;
    computeNames();
  }
  buildRows();
  render();
  els.search.focus();
}

function cancelRename() {
  state.renaming = null;
  render();
  els.search.focus();
}

// ---------- rendering ----------

function highlight(text, q) {
  const frag = document.createDocumentFragment();
  if (!q) { frag.append(text); return frag; }
  const lower = text.toLowerCase();
  let pos = 0;
  for (;;) {
    const i = lower.indexOf(q, pos);
    if (i < 0) break;
    if (i > pos) frag.append(text.slice(pos, i));
    const m = document.createElement('mark');
    m.textContent = text.slice(i, i + q.length);
    frag.append(m);
    pos = i + q.length;
  }
  if (pos < text.length) frag.append(text.slice(pos));
  return frag;
}

function tile(text, bg) {
  const s = document.createElement('span');
  s.className = 'tile';
  s.textContent = text;
  if (bg) s.style.background = bg;
  return s;
}

function favicon(tab) {
  const host = hostOf(tab.url || tab.pendingUrl || '');
  const fallback = () => tile(host ? host[0] : '?', colorForHost(host || '?'));
  const src = tab.favIconUrl || faviconFallbackUrl(tab.url || tab.pendingUrl || '');
  if (!src) return fallback();
  const img = document.createElement('img');
  img.className = 'fav';
  img.alt = '';
  img.width = 16;
  img.height = 16;
  img.decoding = 'async';
  img.src = src;
  img.addEventListener('error', () => img.replaceWith(fallback()), { once: true });
  return img;
}

function faviconStrip(win) {
  const wrap = document.createElement('span');
  wrap.className = 'favs';
  const seen = new Set();
  const picked = [];
  for (const tab of win.tabs) {
    const host = hostOf(tab.url || tab.pendingUrl || '') || `tab${tab.id}`;
    if (seen.has(host)) continue;
    seen.add(host);
    picked.push(tab);
  }
  for (const tab of picked.slice(0, MAX_FAVICONS)) wrap.append(favicon(tab));
  if (picked.length > MAX_FAVICONS) {
    const more = tile(`+${picked.length - MAX_FAVICONS}`);
    more.classList.add('more');
    wrap.append(more);
  }
  return wrap;
}

function chipsOf(win) {
  const groups = groupsOf(win);
  if (!groups.length) return null;
  const wrap = document.createElement('span');
  wrap.className = 'chips';
  for (const g of groups) {
    const c = document.createElement('span');
    c.className = 'chip' + (g.title ? '' : ' dot');
    c.style.background = GROUP_COLORS[g.color] || GROUP_COLORS.grey;
    c.textContent = g.title || '';
    c.title = g.title || t('untitledGroup');
    wrap.append(c);
  }
  return wrap;
}

function pill(text, cls) {
  const p = document.createElement('span');
  p.className = 'pill' + (cls ? ` ${cls}` : '');
  p.textContent = text;
  return p;
}

function tabCount(n) {
  return n === 1 ? t('tabCountOne') : t('tabCount', n);
}

function buildRow(row, q) {
  const { win, index, matchedTabs } = row;
  const isCur = win.id === state.currentId;
  const isPrev = win.id === state.previousId;
  const isLast = index === state.windows.length - 1 && state.windows.length > 1;
  const nameInfo = state.names[win.id];

  const el = document.createElement('div');
  el.className = 'row' + (isCur ? ' cur' : '');
  el.id = `win-${win.id}`;
  el.dataset.id = String(win.id);
  el.setAttribute('role', 'option');

  // keys
  const keys = document.createElement('div');
  keys.className = 'keys';
  const label = keyLabel(index);
  const k = document.createElement('span');
  k.className = 'key' + (index >= 9 ? ' shift' : '') + (label ? '' : ' none');
  k.textContent = (state.shift && index < 9 ? '⇧' : '') + (index >= 9 ? '⇧' : '') + label;
  keys.append(k);
  if (isLast) {
    const g = document.createElement('span');
    g.className = 'key ghost';
    g.textContent = (state.shift ? '⇧' : '') + '0';
    keys.append(g);
  }
  el.append(keys);

  // name line
  const nameLine = document.createElement('div');
  nameLine.className = 'name-line';
  if (state.renaming === win.id) {
    const input = document.createElement('input');
    input.className = 'rename-input';
    input.type = 'text';
    input.maxLength = 24;
    input.placeholder = t('renamePlaceholder');
    input.value = nameInfo.source === 'user' ? nameInfo.name : nameInfo.name;
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); commitRename(input.value); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
    });
    input.addEventListener('blur', () => { if (state.renaming === win.id) commitRename(input.value); });
    nameLine.append(input);
    queueMicrotask(() => { input.focus(); input.select(); });
  } else {
    const name = document.createElement('span');
    name.className = 'name';
    name.append(highlight(nameInfo.name || '', row.nameHit ? q : ''));
    name.title = nameInfo.name;
    nameLine.append(name);
    const chips = chipsOf(win);
    if (chips) nameLine.append(chips);
    if (isCur) nameLine.append(pill(state.shift ? `${t('currentWindow')} · ${t('alreadyHere')}` : t('currentWindow'), 'here'));
    else if (isPrev && !q && !state.shift) nameLine.append(pill(`↵ ${t('previousWindow')}`, 'ret'));
    if (win.state === 'minimized') nameLine.append(pill(t('minimized')));
    const btn = document.createElement('button');
    btn.className = 'rename-btn';
    btn.type = 'button';
    btn.title = `${t('rename')} (F2)`;
    btn.setAttribute('aria-label', `${t('rename')} (F2)`);
    btn.tabIndex = -1;
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.selected = state.rows.indexOf(row);
      startRename();
    });
    nameLine.append(btn);
  }
  el.append(nameLine);

  // count
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = tabCount(win.tabs.length) +
    (q && matchedTabs.length ? ` · ${matchedTabs.length === 1 ? t('matchCountOne') : t('matchCount', matchedTabs.length)}` : '');
  el.append(count);

  // sub line
  const sub = document.createElement('div');
  sub.className = 'sub-line';
  const title = document.createElement('span');
  title.className = 'title';
  if (q && matchedTabs.length) {
    const favs = document.createElement('span');
    favs.className = 'favs';
    favs.append(favicon(matchedTabs[0]));
    sub.append(favs);
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '↳';
    title.append(arrow, highlight(matchedTabs[0].title || matchedTabs[0].url || '', q));
  } else {
    sub.append(faviconStrip(win));
    const active = win.tabs.find((tab) => tab.active) || win.tabs[0];
    title.textContent = active ? (active.title || active.url || '') : '';
  }
  title.title = title.textContent;
  sub.append(title);
  el.append(sub);

  el.addEventListener('click', () => {
    if (state.renaming) return;
    activate(win, matchedTabs[0] || null);
  });
  return el;
}

function render() {
  const q = state.query.trim().toLowerCase();
  els.list.replaceChildren(...state.rows.map((row) => buildRow(row, q)));
  const none = !state.rows.length;
  const lonely = !q && state.windows.length <= 1;
  els.empty.hidden = !(none || lonely);
  if (none || lonely) els.empty.textContent = q ? t('noMatch', state.query.trim()) : t('noWindows');
  renderMode();
  renderFoot();
  renderSelection();
}

function renderSelection() {
  const rows = els.list.children;
  for (let i = 0; i < rows.length; i++) {
    const on = i === state.selected;
    rows[i].classList.toggle('sel', on);
    rows[i].setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) { rows[i].scrollIntoView({ block: 'nearest' }); els.search.setAttribute('aria-activedescendant', rows[i].id); }
  }
}

function renderMode() {
  const moving = state.shift && !state.renaming;
  els.searchbox.classList.toggle('moving', moving);
  document.body.classList.toggle('moving', moving);
  els.mode.hidden = !moving;
  if (moving) {
    const title = state.activeTab ? (state.activeTab.title || state.activeTab.url || '') : '';
    els.mode.replaceChildren(...t('moveMode', title).split(title).flatMap((part, i, arr) => {
      const out = [part];
      if (i < arr.length - 1) { const b = document.createElement('b'); b.textContent = title; out.push(b); }
      return out;
    }));
  }
}

function keycap(text) {
  const k = document.createElement('span');
  k.className = 'k';
  k.textContent = text;
  return k;
}

function footItem(...parts) {
  const s = document.createElement('span');
  for (const p of parts) s.append(p);
  return s;
}

function renderFoot() {
  const f = els.foot;
  f.className = 'foot';
  const q = state.query.trim();
  if (state.renaming) {
    f.classList.add('hint');
    f.replaceChildren(footItem(t('renameHint')));
    return;
  }
  if (state.shift) {
    f.classList.add('hint');
    f.replaceChildren(footItem(t('moveStay')));
    return;
  }
  if (q) {
    f.classList.add('hint');
    f.replaceChildren(footItem(keycap('↵'), ' ' + t('footSearchEnter')), footItem(t('footSearchPick')));
    return;
  }
  const items = [
    footItem(keycap('1'), '…', keycap('9'), ' ' + t('footJump').replace(/^1–9\s*/, '')),
    footItem(keycap('0'), ' ' + t('footLast').replace(/^0\s*/, '')),
    footItem(keycap('↵'), ' ' + t('footBack').replace(/^Enter\s*/, '')),
    footItem(keycap('⇧'), '+' + t('footMove').replace(/^Shift\+/, '')),
    footItem(keycap('F2'), ' ' + t('footRename').replace(/^F2\s*/, '')),
  ];
  if (state.windows.length > 9) items.push(footItem(keycap('⇧A'), '… ' + t('footLetters').replace(/^Shift\+A…\s*/, '')));
  f.replaceChildren(...items);
}

// ---------- keyboard ----------

function onKeyDown(e) {
  // The shortcut that opened the popup closes it again, and never reaches Chrome.
  if (matchesShortcut(e, state.ownShortcut)) { e.preventDefault(); e.stopPropagation(); window.close(); return; }
  if (state.renaming) return;
  const mods = e.metaKey || e.ctrlKey;

  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (digit && !mods) {
    e.preventDefault();
    const d = Number(digit[1]);
    const win = d === 0 ? state.windows[state.windows.length - 1] : state.windows[d - 1];
    if (!win) return;
    if (e.shiftKey) moveActiveTab(win, !e.altKey);
    else activate(win, matchedTabFor(win));
    return;
  }

  const letter = /^Key([A-Z])$/.exec(e.code);
  if (letter && e.shiftKey && !mods && !e.altKey) {
    const win = state.windows[9 + letter[1].charCodeAt(0) - 65];
    if (win) { e.preventDefault(); activate(win, matchedTabFor(win)); return; }
  }

  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); setSelected(state.selected + 1); return;
    case 'ArrowUp': e.preventDefault(); setSelected(state.selected - 1); return;
    case 'PageDown': e.preventDefault(); setSelected(state.selected + 5); return;
    case 'PageUp': e.preventDefault(); setSelected(state.selected - 5); return;
    case 'Home': if (!state.query) { e.preventDefault(); setSelected(0); } return;
    case 'End': if (!state.query) { e.preventDefault(); setSelected(state.rows.length - 1); } return;
    case 'Enter': {
      e.preventDefault();
      const row = state.rows[state.selected];
      if (!row) return;
      if (e.shiftKey) moveActiveTab(row.win, !e.altKey);
      else activate(row.win, row.matchedTabs[0] || null);
      return;
    }
    case 'Escape':
      if (state.query) { e.preventDefault(); setQuery(''); }
      else window.close();
      return;
    case 'F2': e.preventDefault(); startRename(); return;
    case 'Shift':
      if (!e.repeat && !state.query) { state.shift = true; render(); }
      return;
    default:
      if (document.activeElement !== els.search) els.search.focus();
  }
}

function onKeyUp(e) {
  if (e.key === 'Shift' && state.shift) { state.shift = false; render(); }
}

// ---------- init ----------

async function init() {
  await (globalThis.__windialMockReady || Promise.resolve());
  chrome.storage.session.set({ lastPopupOpen: Date.now() }).catch(() => {});
  document.documentElement.lang = uiLanguage();
  els.search.placeholder = t('searchPlaceholder');
  els.search.setAttribute('aria-label', t('searchLabel'));
  els.list.setAttribute('aria-label', t('listLabel'));
  els.search.addEventListener('input', () => setQuery(els.search.value));
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { if (state.shift) { state.shift = false; render(); } });

  await load();
  const params = new URLSearchParams(location.search);
  state.query = params.get('q') || '';
  if (state.query) els.search.value = state.query;
  buildRows();
  selectDefault();
  if (params.get('shift') === '1') state.shift = true;
  render();
  els.search.focus();

  getShortcut().then((shortcut) => {
    state.ownShortcut = parseShortcut(shortcut);
    els.banner.hidden = Boolean(shortcut);
    if (!shortcut) els.banner.textContent = t('popupNoShortcut');
  });
  els.banner.addEventListener('click', () => { openShortcutsPage(); window.close(); });

  if (state.settings.naming === 'nano' && hasPromptApi()) {
    refreshNanoNames(state.windows, state.settings, async () => {
      state.nanoNames = await getSession('nanoNames', {});
      computeNames();
      buildRows();
      render();
    }).catch(() => {});
  }
}

init().catch((err) => {
  console.error('[windial] init failed', err);
  els.empty.hidden = false;
  els.empty.textContent = String(err);
});
