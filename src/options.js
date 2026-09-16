import { t, uiLanguage, getSettings, setSettings, getSavedNames, setSavedNames, getSession, setSession, SUPPORT_URL } from './common.js';
import { getShortcut, openShortcutsPage } from './shortcut.js';

const $ = (id) => document.getElementById(id);

function applyI18n() {
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
}

let toastTimer = null;
function toast() {
  const el = $('toast');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1200);
}

async function renderNames() {
  const [names, bindings] = await Promise.all([getSavedNames(), getSession('bindings', {})]);
  const ul = $('names');
  ul.replaceChildren();
  $('namesEmpty').hidden = names.length > 0;
  for (const n of names) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = n.name;
    const small = document.createElement('small');
    small.textContent = (n.fp && n.fp.hosts ? n.fp.hosts.slice(0, 5).join(' · ') : '');
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = t('delete');
    let armed = null;
    del.addEventListener('click', async () => {
      // Two presses: the first arms the button for three seconds, the second deletes.
      if (!armed) {
        del.textContent = t('confirmDelete');
        del.classList.add('danger');
        armed = setTimeout(() => { armed = null; del.textContent = t('delete'); del.classList.remove('danger'); }, 3000);
        return;
      }
      clearTimeout(armed);
      const list = (await getSavedNames()).filter((x) => x.id !== n.id);
      await setSavedNames(list);
      const b2 = await getSession('bindings', {});
      for (const [wid, sid] of Object.entries(b2)) if (sid === n.id) delete b2[wid];
      await setSession({ bindings: b2 });
      await renderNames();
      toast();
    });
    li.append(b, small, del);
    ul.append(li);
  }
  void bindings;
}

async function renderShortcut() {
  const shortcut = await getShortcut();
  $('shortcut').textContent = shortcut || t('optShortcutNone');
  $('shortcut').classList.toggle('missing', !shortcut);
  $('shortcutHelp').textContent = shortcut ? t('optShortcutHelp') : t('welcomeNone');
}

async function init() {
  await (globalThis.__windialMockReady || Promise.resolve());
  document.documentElement.lang = uiLanguage();
  applyI18n();
  const settings = await getSettings();
  for (const r of document.querySelectorAll('input[name=density]')) {
    r.checked = r.value === settings.density;
    r.addEventListener('change', async () => { await setSettings({ density: r.value }); toast(); });
  }
  $('shortcutChange').addEventListener('click', openShortcutsPage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderShortcut(); });

  if (SUPPORT_URL) {
    $('support').hidden = false;
    $('supportLink').href = SUPPORT_URL;
    $('supportLink').textContent = `☕ ${t('support')}`;
  }
  await Promise.all([renderNames(), renderShortcut()]);
}

init().catch((err) => console.error('[windial] options init failed', err));
