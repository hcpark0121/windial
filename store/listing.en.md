# Chrome Web Store listing (English)

**Name** (45 chars max): `Windial: Switch Windows by Number`

**Summary** (132 chars max):
One shortcut, one number. See every Chrome window by its topic and jump between them in two keystrokes.

**Category**: Workflow & Planning (or Tools)

**Description**:

If you keep one Chrome window per topic, you already know the problem: the built-in window switcher only shows the title of whatever tab happens to be active, and cycling through windows with ⌘` takes as many presses as you have windows.

Windial fixes both.

Press the shortcut (⌘⇧X on Mac, Alt+W on Windows and Linux; change it any time at chrome://extensions/shortcuts) and a list of your windows appears. Every window shows its name, its tab groups, a row of favicons and its tab count, so you recognise it before you read anything. Press 1 to 9 to jump to that window, or 0 for the last one. Two keystrokes, done.

• Numbers are stable. Windows are numbered in the order you opened them, so number 2 stays number 2 all day.
• The previous window is preselected. Open Windial and press Enter to go back where you came from.
• Search everything. Type to filter by window name, tab group, tab title or URL. Enter opens the window and switches to the matching tab.
• Numbers always jump, even while you are searching.
• Move a tab with Shift+number. Hold Shift and press a number to send the current tab to that window. Add Alt to move it without following.
• Name your windows. Press F2 to name a window. Names are matched by the window's tabs, so they survive a Chrome restart.
• Optional on-device naming. With Chrome 148 or newer you can let the built-in Gemini Nano model suggest a name for windows you have not named. It runs on your computer and nothing leaves it. Off by default.
• Follows Chrome's language. English and Korean today.
• Works in light and dark mode.

Privacy: Windial has no server, makes no network requests and collects nothing. Everything stays in your browser profile.

Tip: if the shortcut is already taken on your machine, pick another at chrome://extensions/shortcuts.

**Screenshots** (1280×800): `store/screenshots/en-default.png`, `en-search.png`, `en-move.png`

**Privacy policy URL**: host `store/privacy-policy.md` (for example on GitHub) and paste its URL.

**Single purpose** (for the review form): Switch between open Chrome windows using the keyboard.

**Permission justifications**:
- `tabs`: read tab titles, URLs and favicons to describe each window and to search them.
- `tabGroups`: show tab group names and colours as part of each window's description.
- `favicon`: show cached site icons for tabs that have not loaded one.
- `storage`: keep user-typed window names and settings in the browser profile.
