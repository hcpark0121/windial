// Fake chrome.* API so popup.html and options.html can be opened in a plain browser tab
// (for screenshots and design work). Inert inside the real extension.

const params = new URLSearchParams(location.search);
const isExtension = typeof chrome !== 'undefined' && chrome.windows && chrome.runtime && chrome.runtime.id;

if (!isExtension && params.has('mock')) {
  const lang = params.get('lang') || (navigator.language || 'en').split('-')[0];

  const svgTile = (letter, bg, fg = '#fff') =>
    'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="7" fill="${bg}"/>` +
      `<text x="16" y="22" text-anchor="middle" font-family="-apple-system,Helvetica,Arial" font-size="18" font-weight="700" fill="${fg}">${letter}</text></svg>`);

  const tab = (id, windowId, url, title, letter, bg, extra = {}) => ({
    id, windowId, url, title, favIconUrl: svgTile(letter, bg), active: false, groupId: -1, index: 0, ...extra,
  });

  const ko = lang === 'ko';
  const windows = [
    { id: 101, type: 'normal', state: 'normal', focused: false, incognito: false, tabs: [
      tab(1, 101, 'https://github.com/hcpark/llm-wiki', 'hcpark/llm-wiki: Personal Life Wiki', 'G', '#24292F', { active: true, groupId: 1 }),
      tab(2, 101, 'https://claude.ai/code', 'Claude Code', 'C', '#D97757', { groupId: 1 }),
      tab(3, 101, 'http://localhost:8080/wiki', 'llm-wiki · areas/jarvis', 'L', '#555', { groupId: 2 }),
      tab(4, 101, 'https://developer.apple.com/documentation', 'Apple Developer Documentation', 'A', '#0D0D0D', { groupId: 1 }),
      tab(5, 101, 'https://stackoverflow.com/questions/1', 'How to focus a window from a Chrome extension', 'S', '#F48024'),
      tab(6, 101, 'https://developer.chrome.com/docs/extensions', 'Chrome Extensions', 'D', '#1A73E8'),
      tab(7, 101, 'https://github.com/hcpark/windial', 'hcpark/windial', 'G', '#24292F', { groupId: 2 }),
      ...Array.from({ length: 7 }, (_, i) => tab(8 + i, 101, `https://github.com/hcpark/x${i}`, `issue #${i}`, 'G', '#24292F')),
    ] },
    { id: 102, type: 'normal', state: 'normal', focused: false, incognito: false, tabs: [
      tab(31, 102, 'https://www.tradingview.com/chart/', 'TSLA 1D — TradingView', 'T', '#2962FF', { active: true, groupId: 3 }),
      tab(32, 102, 'https://www.kiwoom.com/', ko ? '키움증권' : 'Kiwoom Securities', 'K', '#1A5AD5', { groupId: 3 }),
      tab(33, 102, 'https://finance.naver.com/', ko ? '네이버 금융' : 'Naver Finance', 'N', '#03C75A'),
      tab(34, 102, 'https://dart.fss.or.kr/', 'DART', 'D', '#0F4C81', { groupId: 4 }),
      tab(35, 102, 'https://www.youtube.com/watch?v=1', ko ? '월가아재 — 9월 FOMC 이후 시나리오' : 'FOMC September scenarios', '▶', '#FF0000', { groupId: 4 }),
      ...Array.from({ length: 4 }, (_, i) => tab(36 + i, 102, `https://www.tradingview.com/chart/${i}`, `Chart ${i}`, 'T', '#2962FF')),
    ] },
    { id: 103, type: 'normal', state: 'normal', focused: false, incognito: false, tabs: [
      tab(51, 103, 'https://wiki.bambulab.com/', 'Bambu Lab Wiki', 'B', '#00AE42', { active: true }),
      tab(52, 103, 'https://www.printables.com/', 'Printables', 'P', '#F26722'),
      tab(53, 103, 'https://makerworld.com/', 'MakerWorld', 'M', '#1B1B1B'),
      tab(54, 103, 'https://cad.onshape.com/', 'Onshape', 'O', '#3D7BF7'),
      tab(55, 103, 'https://wiki.bambulab.com/en/software/bambu-studio/plate', ko ? '밤부 스튜디오 — 플레이트 설정' : 'Bambu Studio — plate settings', 'B', '#00AE42'),
      tab(56, 103, 'https://forum.bambulab.com/', ko ? '밤부 포럼' : 'Bambu forum', 'B', '#00AE42'),
    ] },
    { id: 104, type: 'normal', state: 'normal', focused: true, incognito: false, tabs: [
      tab(71, 104, 'https://map.naver.com/', ko ? '코엑스 — 네이버 지도' : 'COEX — Naver Map', 'N', '#03C75A', { active: true }),
      tab(72, 104, 'https://map.kakao.com/', ko ? '카카오맵' : 'Kakao Map', 'K', '#FEE500'),
      tab(73, 104, 'https://app.catchtable.co.kr/', ko ? '캐치테이블' : 'Catchtable', 'C', '#FF3D3D'),
      tab(74, 104, 'https://map.naver.com/p/2', ko ? '성수동 카페 — 네이버 지도' : 'Seongsu cafes — Naver Map', 'N', '#03C75A'),
      tab(75, 104, 'https://www.google.com/maps', 'Google Maps', 'G', '#4285F4'),
    ] },
    { id: 105, type: 'normal', state: 'normal', focused: false, incognito: false, tabs: [
      tab(91, 105, 'https://www.youtube.com/', 'YouTube', '▶', '#FF0000', { active: true }),
      tab(92, 105, 'https://brunch.co.kr/', ko ? '브런치' : 'Brunch', 'b', '#00C7AE'),
      tab(93, 105, 'https://news.hada.io/', 'GeekNews', 'H', '#1B1B1B'),
      tab(94, 105, 'https://www.reddit.com/', 'Reddit', 'R', '#5B4B8A'),
      ...Array.from({ length: 7 }, (_, i) => tab(95 + i, 105, `https://www.youtube.com/watch?v=${i}`, `Video ${i}`, '▶', '#FF0000')),
    ] },
    { id: 106, type: 'normal', state: 'normal', focused: false, incognito: false, tabs: [
      tab(121, 106, 'https://mail.google.com/mail/u/0/#inbox', ko ? '받은편지함 (12)' : 'Inbox (12)', 'M', '#EA4335', { active: true }),
      tab(122, 106, 'https://calendar.google.com/', 'Google Calendar', 'C', '#4285F4'),
      tab(123, 106, 'https://www.notion.so/', 'Notion', 'N', '#1B1B1B'),
      tab(124, 106, 'https://www.linkedin.com/', 'LinkedIn', 'in', '#0A66C2'),
    ] },
  ];
  const groups = {
    1: { id: 1, title: 'jarvis', color: 'blue', windowId: 101 },
    2: { id: 2, title: 'wiki', color: 'cyan', windowId: 101 },
    3: { id: 3, title: ko ? '스윙' : 'swing', color: 'green', windowId: 102 },
    4: { id: 4, title: ko ? '매크로' : 'macro', color: 'grey', windowId: 102 },
  };
  // Saved names carry the fingerprint of their window so they bind exactly like real ones.
  const fpOf = (w) => {
    const urls = [], hosts = [];
    for (const t of w.tabs) {
      if (!urls.includes(t.url)) urls.push(t.url);
      const h = new URL(t.url).hostname.replace(/^www\./, '');
      if (!hosts.includes(h)) hosts.push(h);
    }
    return { urls, hosts };
  };
  const labels = ko
    ? ['개발', '투자', '3D 모델링', '장소·지도', '읽을거리', '메일·캘린더']
    : ['Dev', 'Investing', '3D printing', 'Places', 'Reading', 'Mail & calendar'];
  const savedNames = windows.map((w, i) => ({ id: `a${i + 1}`, name: labels[i], fp: fpOf(w), created: 1, updated: 1 }));

  const local = new Map([['savedNames', savedNames], ['settings', { naming: 'rule', nameLang: 'system' }]]);
  const session = new Map([['mru', [104, 105, 101, 102]], ['bindings', {}], ['nanoNames', {}]]);
  const storageArea = (map) => ({
    async get(key) {
      const keys = key === undefined || key === null ? [...map.keys()] : (Array.isArray(key) ? key : [key]);
      const out = {};
      for (const k of keys) if (map.has(k)) out[k] = structuredClone(map.get(k));
      return out;
    },
    async set(obj) { for (const [k, v] of Object.entries(obj)) map.set(k, structuredClone(v)); },
    async remove(key) { for (const k of (Array.isArray(key) ? key : [key])) map.delete(k); },
  });

  let messages = {};
  const ready = fetch(`../_locales/${lang}/messages.json`).then((r) => r.json()).then((m) => { messages = m; }).catch(() => {});

  const clone = (w) => structuredClone(w);
  globalThis.chrome = {
    runtime: { getURL: (p) => new URL(p, location.href).toString(), id: undefined },
    i18n: {
      getUILanguage: () => lang,
      getMessage(key, subs = []) {
        const m = messages[key];
        if (!m) return '';
        let s = m.message;
        for (const [name, ph] of Object.entries(m.placeholders || {})) {
          const idx = Number(String(ph.content).replace('$', '')) - 1;
          s = s.split(`$${name}$`).join(subs[idx] ?? '');
        }
        return s;
      },
    },
    windows: {
      WINDOW_ID_NONE: -1,
      async getAll() { return windows.map(clone); },
      async getCurrent() { return clone(windows.find((w) => w.focused) || windows[0]); },
      async update(id, info) { console.log('[mock] windows.update', id, info); for (const w of windows) w.focused = w.id === id; return clone(windows.find((w) => w.id === id)); },
    },
    tabs: {
      async query(q) {
        let list = windows.flatMap((w) => w.tabs);
        if (q.currentWindow) { const cur = windows.find((w) => w.focused); list = cur ? cur.tabs : []; }
        if (q.active !== undefined) list = list.filter((tab) => tab.active === q.active);
        return list.map(clone);
      },
      async update(id, info) { console.log('[mock] tabs.update', id, info); },
      async move(id, info) {
        console.log('[mock] tabs.move', id, info);
        for (const w of windows) {
          const i = w.tabs.findIndex((tab) => tab.id === id);
          if (i >= 0) { const [tab] = w.tabs.splice(i, 1); tab.windowId = info.windowId; windows.find((x) => x.id === info.windowId).tabs.push(tab); }
        }
      },
    },
    tabGroups: { async query() { return Object.values(groups).map(clone); } },
    storage: { local: storageArea(local), session: storageArea(session), onChanged: { addListener() {} } },
    commands: { async getAll() { return [{ name: '_execute_action', shortcut: navigator.platform.includes('Mac') ? '⌥W' : 'Alt+W' }]; } },
  };
  globalThis.__windialMockReady = ready;
  window.close = () => console.log('[mock] window.close()');
}
