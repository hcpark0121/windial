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
