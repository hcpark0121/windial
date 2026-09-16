# Windial privacy policy

_Last updated: 2026-09-12_

Windial is a Chrome extension that lists your open browser windows and lets you switch between them with the keyboard.

## What Windial reads

To draw the window list, Windial reads the titles, URLs, favicons and tab groups of your open tabs through Chrome's extension APIs. It reads them while the popup is open and, to draw the window number on the toolbar icon, when windows or tabs change.

## What Windial stores

- Window names you type yourself, together with the list of tab addresses of that window at the time (used only to recognise the same window again after Chrome restarts). Stored in `chrome.storage.local` inside your browser profile.
- The order in which windows were focused, and names given to incognito windows. Stored in `chrome.storage.session`, which Chrome erases when the browser closes.

Incognito windows are visible to Windial only if you allow it in incognito. Their names are kept in session storage only.

## What Windial sends

Nothing. Windial makes no network requests and has no server. It does not collect analytics, does not sell or share data, and does not use remote code.

## Permissions

- `tabs`, `tabGroups`, `favicon`: to show each window's tabs, groups and icons.
- `storage`: to keep names and settings in your profile.

## Contact

Email hayden.park.apps@gmail.com or open an issue at https://github.com/hcpark0121/windial/issues.
