import { t, getSettings, setSettings, getSavedNames, setSavedNames, getSession, setSession } from './common.js';
import { nanoAvailability, nanoDownload, nanoNameFor, hasPromptApi } from './naming-nano.js';

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

async function renderNano() {
  const settings = await getSettings();
  const on = settings.naming === 'nano';
  $('nano').classList.toggle('on', on);
  if (!on) return;
  const status = await nanoAvailability();
  const dot = $('nanoDot');
  const text = $('nanoStatus');
  const dl = $('nanoDownload');
  const test = $('nanoTest');
  dot.className = 'dot';
  dl.hidden = true;
  test.hidden = true;
  switch (status) {
    case 'available': dot.classList.add('ok'); text.textContent = t('nanoAvailable'); test.hidden = false; break;
    case 'downloadable': dot.classList.add('warn'); text.textContent = t('nanoDownloadable'); dl.hidden = false; break;
    case 'downloading': dot.classList.add('warn'); text.textContent = t('nanoDownloading', '…'); break;
    case 'unavailable': dot.classList.add('bad'); text.textContent = t('nanoUnavailable'); break;
    default: dot.classList.add('bad'); text.textContent = t('nanoUnsupported');
  }
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
    del.addEventListener('click', async () => {
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
  let text = t('optShortcutNone');
  try {
    const cmds = await chrome.commands.getAll();
    const c = cmds.find((x) => x.name === '_execute_action');
    if (c && c.shortcut) text = c.shortcut;
  } catch (_) { /* ignore */ }
  $('shortcut').textContent = text;
}

async function init() {
  await (globalThis.__windialMockReady || Promise.resolve());
  applyI18n();
  const settings = await getSettings();
  for (const r of document.querySelectorAll('input[name=naming]')) {
    r.checked = r.value === settings.naming;
    r.addEventListener('change', async () => {
      await setSettings({ naming: r.value });
      await renderNano();
      toast();
    });
  }
  $('nameLang').value = settings.nameLang || 'system';
  $('nameLang').addEventListener('change', async (e) => {
    await setSettings({ nameLang: e.target.value });
    await setSession({ nanoNames: {} });
    toast();
  });

  $('nanoDownload').addEventListener('click', async () => {
    const btn = $('nanoDownload');
    btn.disabled = true;
    try {
      await nanoDownload((pct) => { $('nanoStatus').textContent = t('nanoDownloading', pct); });
    } catch (err) {
      $('nanoResult').hidden = false;
      $('nanoResult').textContent = t('nanoTestFailed', err && err.message ? err.message : String(err));
    } finally {
      btn.disabled = false;
      await renderNano();
    }
  });

  $('nanoTest').addEventListener('click', async () => {
    const out = $('nanoResult');
    out.hidden = false;
    out.textContent = '…';
    try {
      const win = await chrome.windows.getCurrent({ populate: true });
      const name = await nanoNameFor(win, await getSettings());
      out.textContent = t('nanoTestResult', name);
    } catch (err) {
      out.textContent = t('nanoTestFailed', err && err.message ? err.message : String(err));
    }
  });

  $('shortcutChange').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  await Promise.all([renderNano(), renderNames(), renderShortcut()]);
  if (!hasPromptApi()) {
    // Keep the radio usable so the status line explains why it will not work.
  }
}

init().catch((err) => console.error('[windial] options init failed', err));
