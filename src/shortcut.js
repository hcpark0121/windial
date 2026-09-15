// The one thing an extension cannot do for the user: set its own keyboard shortcut.
// Chrome assigns the manifest's suggested key only at install time, and only if the key is free.
// These helpers let every surface (welcome page, popup, options) notice a missing shortcut
// and send the user to the page where it takes ten seconds to fix.

export const SHORTCUTS_PAGE = 'chrome://extensions/shortcuts';

export async function getShortcut() {
  try {
    const cmds = await chrome.commands.getAll();
    const c = cmds.find((x) => x.name === '_execute_action');
    return c && c.shortcut ? c.shortcut : '';
  } catch (_) {
    return '';
  }
}

export function openShortcutsPage() {
  chrome.tabs.create({ url: SHORTCUTS_PAGE });
}

// Chrome reports shortcuts as "⇧⌘C" / "⌥W" on Mac and "Ctrl+Shift+Y" / "Alt+W" elsewhere.
// Parse either into modifiers plus a KeyboardEvent.code, so the popup can recognise its own
// chord (pressing it again closes the popup instead of reaching Chrome, where ⌘⇧C would
// open DevTools on the popup).
const KEY_CODES = {
  space: 'Space', comma: 'Comma', ',': 'Comma', period: 'Period', '.': 'Period',
  home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown', insert: 'Insert', delete: 'Delete',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  '↑': 'ArrowUp', '↓': 'ArrowDown', '←': 'ArrowLeft', '→': 'ArrowRight',
};
export function parseShortcut(text) {
  if (!text) return null;
  const mods = { meta: false, ctrl: false, alt: false, shift: false };
  let rest;
  if (/[⌘⇧⌥⌃]/.test(text)) {
    for (const ch of text) {
      if (ch === '⌘') mods.meta = true; else if (ch === '⇧') mods.shift = true;
      else if (ch === '⌥') mods.alt = true; else if (ch === '⌃') mods.ctrl = true;
    }
    rest = text.replace(/[⌘⇧⌥⌃]/g, '').trim();
  } else {
    const parts = text.split('+').map((p) => p.trim());
    rest = parts.pop();
    for (const p of parts) {
      const q = p.toLowerCase();
      if (q === 'ctrl' || q === 'control' || q === 'macctrl') mods.ctrl = true; else if (q === 'alt' || q === 'option') mods.alt = true;
      else if (q === 'shift') mods.shift = true; else if (q === 'command' || q === 'cmd' || q === 'meta' || q === 'win') mods.meta = true;
    }
  }
  const low = rest.toLowerCase();
  let code = KEY_CODES[low];
  if (!code && /^[a-z]$/.test(low)) code = `Key${low.toUpperCase()}`;
  if (!code && /^[0-9]$/.test(low)) code = `Digit${low}`;
  if (!code && /^f([1-9]|1[0-9]|2[0-4])$/.test(low)) code = low.toUpperCase();
  if (!code) return null;
  return { ...mods, code };
}
export function matchesShortcut(event, sc) {
  return Boolean(sc) && event.code === sc.code &&
    event.metaKey === sc.meta && event.ctrlKey === sc.ctrl && event.altKey === sc.alt && event.shiftKey === sc.shift;
}
