# Replies to existing questions (one per thread, each worded differently, author disclosed)

## Ask Different — "How to switch between different Chrome windows with keyboard shortcuts?" (361k views)
https://apple.stackexchange.com/questions/93835/how-to-switch-between-different-chrome-windows-with-keyboard-shortcuts

The answers here all cycle through windows (Cmd+`), which is fine for two or three. If you keep many Chrome windows and want to go *straight* to a particular one, Chrome has no built-in shortcut for that; it takes an extension.

I wrote one for exactly this (disclosure: I'm the author): **Windial**. A shortcut (⌥W by default, rebindable at `chrome://extensions/shortcuts`) opens a list of your Chrome windows, each with a name, its tab groups and a row of favicons so you can tell them apart. Press 1–9 to jump to that window, 0 for the last one, or Enter to return to the window you came from. Numbers follow the order in which the windows were opened, so they do not shuffle as you switch.

It is free, open source (MIT) and makes no network requests.

- Chrome Web Store: https://chromewebstore.google.com/detail/ccghjfhnknjhbdfhpolmjejigphmdlja
- Source: https://github.com/hcpark0121/windial

## Quora — "Is there a Chrome and Windows 7 shortcut for switching between Chrome windows?"
https://www.quora.com/Is-there-a-Chrome-and-Windows-7-shortcut-for-switching-between-Chrome-windows

Built in, you have two options. Alt+Tab cycles through every window of every app, and Win+number cycles through the windows of the app pinned at that taskbar position (press Win+1 repeatedly if Chrome is first). Neither lets you go straight to a particular Chrome window, and the thumbnails all look alike once you have several.

Since Chrome 90 you can right-click the title bar and choose "Name window…", which at least makes them tellable apart in Alt+Tab.

If you want a direct jump, that needs an extension. I wrote a free one called Windial for exactly this (disclosure: I'm the author): a shortcut opens a list of your Chrome windows with names and favicons, and pressing 1–9 takes you to that window. It's open source and makes no network requests: https://chromewebstore.google.com/detail/ccghjfhnknjhbdfhpolmjejigphmdlja

## 클리앙 맥 게시판 — 크롬 창 간 전환
https://www.clien.net/service/board/cm_mac/18283996

기본 기능으로는 Cmd+` 로 같은 앱의 창을 순서대로 넘기는 것까지입니다. 다른 데스크탑(Spaces)에 있는 창도 Cmd+` 로 넘어가긴 하는데, 창이 여러 개면 원하는 창까지 여러 번 눌러야 하고 어느 창인지 미리 볼 수가 없죠.

저도 같은 불편 때문에 크롬 확장을 하나 만들어 쓰고 있습니다(제가 만든 거라 홍보이긴 합니다). 단축키를 누르면 창 목록이 이름·파비콘과 함께 뜨고 숫자 1~9로 그 창에 바로 갑니다. 무료·오픈소스이고 외부로 아무것도 보내지 않습니다. 스토어에서 Windial로 찾으시면 됩니다.

## Google Chrome Community — Keyboard shortcut for switching windows in Chrome (macOS) — LOCKED, cannot reply
https://support.google.com/chrome/thread/291082258

On macOS the built-in shortcut is Cmd+` (backtick), which moves to the next Chrome window, and Cmd+Shift+` goes the other way. It only cycles, so with many windows it takes several presses, and there is no built-in way to jump to a specific window.

If cycling is not enough, an extension can do the direct jump. I maintain a free, open-source one called Windial (so, author here): press a shortcut, see the list of windows by name and favicons, press a number to go there.
