// Gemini Nano (Chrome built-in Prompt API) naming. Optional; everything degrades to rules.

import { hostOf, MAX_NAME_LENGTH, nanoSignature, getSession, setSession, uiLanguage } from './common.js';

const LANG_NAMES = {
  ko: 'Korean', en: 'English', ja: 'Japanese', es: 'Spanish', de: 'German', fr: 'French',
  zh: 'Chinese', pt: 'Portuguese', it: 'Italian', ru: 'Russian',
};

export function hasPromptApi() {
  return typeof self !== 'undefined' && typeof self.LanguageModel !== 'undefined';
}

// 'unsupported' | 'available' | 'downloadable' | 'downloading' | 'unavailable'
export async function nanoAvailability() {
  if (!hasPromptApi()) return 'unsupported';
  try {
    return await self.LanguageModel.availability();
  } catch (_) {
    return 'unsupported';
  }
}

// Must be called from a user gesture (a click) to start the model download.
export async function nanoDownload(onProgress) {
  const session = await self.LanguageModel.create({
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        if (onProgress) onProgress(Math.round((e.loaded || 0) * 100));
      });
    },
  });
  session.destroy();
}

export function resolveNameLang(settings) {
  const pref = settings.nameLang || 'system';
  const code = pref === 'system' ? uiLanguage().split('-')[0] : pref;
  return { code, name: LANG_NAMES[code] || 'English' };
}

function cleanLabel(raw) {
  let s = String(raw || '').split('\n')[0].trim();
  s = s.replace(/^[\s"'“”‘’«»`*#\-–—:]+|[\s"'“”‘’«»`*#.\-–—:]+$/g, '');
  s = s.replace(/^(label|name|topic)\s*[:：]\s*/i, '');
  return s.slice(0, MAX_NAME_LENGTH);
}

// Ask the on-device model for a short topic label for a window.
export async function nanoNameFor(win, settings) {
  const lang = resolveNameLang(settings);
  const tabs = (win.tabs || []).slice(0, 14);
  const lines = tabs.map((tab) => {
    const host = hostOf(tab.url || tab.pendingUrl || '');
    const title = (tab.title || '').replace(/\s+/g, ' ').slice(0, 80);
    return `- ${title}${host ? ` (${host})` : ''}`;
  });
  const session = await self.LanguageModel.create({
    initialPrompts: [{
      role: 'system',
      content:
        'You label browser windows. The user gives you the titles of the tabs in one window. ' +
        `Reply with a short topic label of one to three words in ${lang.name}. ` +
        'Reply with the label only: no quotes, no punctuation, no explanation.',
    }],
  });
  try {
    const out = await session.prompt(`Tabs in this window:\n${lines.join('\n')}\n\nLabel:`);
    const label = cleanLabel(out);
    if (!label) throw new Error('empty label');
    return label;
  } finally {
    session.destroy();
  }
}

// Name every window that lacks a fresh Nano name. Serialised; safe to call often.
let running = null;
export function refreshNanoNames(windows, settings, onEach) {
  if (running) return running;
  running = (async () => {
    try {
      if (settings.naming !== 'nano') return;
      if ((await nanoAvailability()) !== 'available') return;
      const nanoNames = await getSession('nanoNames', {});
      for (const win of windows) {
        if (win.incognito) continue; // never describe incognito tabs, even on-device
        const sig = nanoSignature(win);
        const cur = nanoNames[win.id];
        if (cur && cur.sig === sig) continue;
        if (!(win.tabs || []).length) continue;
        try {
          const name = await nanoNameFor(win, settings);
          nanoNames[win.id] = { name, sig, at: Date.now() };
          await setSession({ nanoNames });
          if (onEach) onEach(win.id, name);
        } catch (err) {
          console.warn('[windial] nano naming failed for window', win.id, err);
        }
      }
    } finally {
      running = null;
    }
  })();
  return running;
}
