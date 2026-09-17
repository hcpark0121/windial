# Show HN

**Title**: Show HN: Windial – switch Chrome windows by pressing a number

**URL**: https://github.com/hcpark0121/windial

**First comment**:

I keep one Chrome window per topic (work, investing, 3D printing, reading). Chrome can only cycle windows (Cmd+` / Alt+Tab), and in the OS switcher every window looks alike because it shows whichever tab happens to be active. In 2017 I hacked a popup that listed my windows and let me press 1–9; I used it daily for years. This month I rebuilt it properly as a Manifest V3 extension and published it.

How it works: a shortcut opens a list of windows. Each row shows a name (one you typed, or the site of the first tab), tab-group chips, a strip of favicons and the tab count. Numbers follow creation order, so window 2 stays window 2 all day; 0 is always the last window; the previous window is preselected, so Enter toggles back. Typing searches every tab in every window and Enter lands on that tab. Shift+number moves the current tab into that window. The toolbar icon shows the number of the window you are in.

Things I learned on the way:

- Chrome closes an action popup the moment the active tab of its window changes, so "move this tab" has to be finished by the service worker, and the popup must wait for the reply before closing itself or the message never leaves.
- Suggested shortcuts are applied only at install time and silently dropped when taken (Cmd+Shift+C belongs to DevTools). The extension opens a page after install that asks you to press the shortcut and detects whether the popup opened.
- Branded Chrome no longer accepts --load-extension, so the end-to-end tests drive Chrome for Testing; window focus events only exist with a real display, so CI runs under xvfb.

No network requests, no analytics, MIT. Store link is in the README. I'd especially like feedback from people who run ten or more windows.
