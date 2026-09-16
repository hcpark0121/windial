# Windial privacy policy

_Last updated: 2026-09-12_

Windial is a Chrome extension that lists your open browser windows and lets you switch between them with the keyboard.

## What Windial reads

To draw the window list, Windial reads the titles, URLs, favicons and tab groups of your open tabs through Chrome's extension APIs. It reads them only while the popup is open or, if you turn on the on-device naming option, when a window's tabs change.

## What Windial stores

- Window names you type yourself, together with the list of tab addresses of that window at the time (used only to recognise the same window again after Chrome restarts). Stored in `chrome.storage.local` inside your browser profile.
- Your settings (naming mode, label language). Stored in `chrome.storage.local`.
- The order in which windows were focused and any automatically generated names. Stored in `chrome.storage.session`, which Chrome erases when the browser closes.

## What Windial sends

Nothing. Windial makes no network requests and has no server. It does not collect analytics, does not sell or share data, and does not use remote code.

If you enable **Ask Gemini Nano on this device**, tab titles and site names are given to Chrome's built-in on-device model to suggest a window name. That model runs on your computer; the data does not leave it. The option is off by default.

## Permissions

- `tabs`, `tabGroups`, `favicon`: to show each window's tabs, groups and icons.
- `storage`: to keep names and settings in your profile.

## Contact

Email hayden.park.apps@gmail.com or open an issue at https://github.com/hcpark0121/windial/issues.
