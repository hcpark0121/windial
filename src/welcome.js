import { t, getSession, setSession } from './common.js';
import { getShortcut, openShortcutsPage } from './shortcut.js';

const $ = (id) => document.getElementById(id);
let tryShownAt = 0;
let tryHelpTimer = null;

for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
$('setBtn').addEventListener('click', openShortcutsPage);
$('tryBtn').addEventListener('click', openShortcutsPage);

// "Press it now" — the popup stamps storage.session on every open, so a press we can see.
async function renderTry(shortcut) {
  const card = $('tryCard');
  if (!shortcut) { card.hidden = true; return; }
  card.hidden = false;
  $('tryLabel').textContent = t('welcomeTry', shortcut);
  const last = await getSession('lastPopupOpen', 0);
  const worked = last && last >= tryShownAt;
  card.classList.toggle('ok', Boolean(worked));
  $('tryStatus').textContent = worked ? t('welcomeWorks') : t('welcomeWaiting');
  $('tryStatus').className = worked ? 'ok-text' : 'muted';
  if (worked) { $('tryHelp').hidden = true; $('tryActions').hidden = true; clearTimeout(tryHelpTimer); return; }
  if (!tryHelpTimer) {
    tryHelpTimer = setTimeout(() => {
      $('tryHelp').hidden = false; $('tryHelp').textContent = t('welcomeNotOpening');
      $('tryActions').hidden = false; $('tryBtn').textContent = t('welcomeChange');
    }, 8000);
  }
}

async function render() {
  const shortcut = await getShortcut();
  await renderTry(shortcut);
  const card = $('card');
  card.classList.toggle('warn', !shortcut);
  $('label').textContent = shortcut ? t('welcomeShortcutIs') : '';
  $('key').replaceChildren();
  if (shortcut) {
    const k = document.createElement('span');
    k.className = 'bigkey';
    k.textContent = shortcut;
    $('key').append(k);
    $('help').hidden = true;
    $('setBtn').textContent = t('welcomeChange');
    $('setBtn').classList.remove('primary');
    $('watch').hidden = true;
    $('kOpen').textContent = shortcut;
  } else {
    const p = document.createElement('p');
    p.textContent = t('welcomeNone');
    p.style.margin = '0';
    $('key').append(p);
    $('help').hidden = false;
    $('help').textContent = t('welcomeHow');
    $('setBtn').textContent = t('welcomeSet');
    $('setBtn').classList.add('primary');
    $('watch').hidden = false;
    $('kOpen').textContent = '?';
  }
}

async function init() {
  await (globalThis.__windialMockReady || Promise.resolve());
  tryShownAt = (await getSession('welcomeShownAt', 0)) || Date.now();
  await setSession({ welcomeShownAt: tryShownAt });
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'session' && (changes.lastPopupOpen || changes.welcomeShownAt)) render();
    });
  } catch (_) { /* mock */ }
  await render();
  // The user sets the key in another tab; pick it up when they come back (and poll gently meanwhile).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  setInterval(() => { if (!document.hidden) render(); }, 2000);
}

init().catch((err) => console.error('[windial] welcome init failed', err));
