// Toolbar icon with the window's number drawn in, for chrome.action.setIcon.
// Works in the service worker (OffscreenCanvas) and in pages (used by the e2e check).

const BG = '#4258D6';
const INK = '#FFFFFF';
const SIZES = [16, 32, 48];
const cache = new Map();

export function drawIcon(label, size) {
  const key = `${label}@${size}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fillStyle = BG;
  ctx.fill();
  if (label) {
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const scale = label.length > 1 ? 0.58 : 0.76;
    ctx.font = `bold ${Math.round(size * scale)}px -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(label, size / 2, size / 2 + size * 0.05);
  } else {
    // No number (more than 35 windows): the plain window glyph.
    const m = size * 0.16;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.beginPath();
    ctx.roundRect(m, m, size - 2 * m, size - 2 * m, size * 0.1);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(m, m, size - 2 * m, size * 0.16);
  }
  const data = ctx.getImageData(0, 0, size, size);
  cache.set(key, data);
  return data;
}

export function iconImageData(label) {
  const out = {};
  for (const s of SIZES) out[s] = drawIcon(label, s);
  return out;
}
