// Builds every TAKIP brand asset from tools/brand/geometry.mjs.
// Usage: node tools/brand/build.mjs
// Text in the OG image goes through librsvg/fontconfig, so it renders in whatever
// fallback font this machine has for Inter (Avenir Next on macOS).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { COLORS, mark, wordmark } from './geometry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pub = (p) => path.join(ROOT, 'public', p);
const write = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); console.log('  ' + path.relative(ROOT, p)); };

const FULL = mark('full');
const SMALL = mark('small');
const WORD = wordmark();
const TAGLINE = 'SPATIOTEMPORAL INTELLIGENCE';
const FONT = "Inter, 'Avenir Next', 'Helvetica Neue', Arial, sans-serif";

function markMarkup(m, { globe = COLORS.globe, accent = COLORS.accent, id = 'tk' } = {}) {
  const { cx, cy, r } = m.globe;
  const s = m.stroke;
  const dots = m.dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${m.dotR}" fill="${accent}"/>`).join('');
  const dotHoles = m.dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${m.dotR + s.gap}"/>`).join('');
  return `<defs>
    <clipPath id="${id}-globe"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <mask id="${id}-gaps" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <rect width="512" height="512" fill="#fff"/>
      <g fill="#000" stroke="#000" stroke-linecap="round" stroke-linejoin="round">
        <path d="${m.front}" fill="none" stroke-width="${s.orbit + s.gap * 2}"/>
        <path d="${m.arrow}" stroke-width="${s.gap * 2 + s.arrow}"/>${dotHoles}
      </g>
    </mask>
    <mask id="${id}-behind" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
      <rect width="512" height="512" fill="#fff"/>
      <circle cx="${cx}" cy="${cy}" r="${r + s.outline / 2 + s.gap}" fill="#000"/>
    </mask>
    <linearGradient id="${id}-fade" gradientUnits="userSpaceOnUse" x1="${m.fade.x1}" y1="${m.fade.y1}" x2="${m.fade.x2}" y2="${m.fade.y2}">
      <stop offset="0" stop-color="${accent}" stop-opacity="0"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <g mask="url(#${id}-gaps)" fill="none" stroke="${globe}" stroke-linecap="round">
    <path d="${m.grid}" stroke-width="${s.grid}" clip-path="url(#${id}-globe)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="${s.outline}"/>
  </g>${m.predicted ? `
  <path d="${m.predicted}" mask="url(#${id}-behind)" fill="none" stroke="${accent}" stroke-width="${f1(s.orbit * 0.6)}" stroke-linecap="round" stroke-dasharray="0.1 ${f1(s.orbit * 1.6)}" opacity="0.85"/>` : ''}
  <path d="${m.front}" fill="none" stroke="url(#${id}-fade)" stroke-width="${s.orbit}" stroke-linecap="round"/>
  ${dots}
  <path d="${m.arrow}" fill="${accent}" stroke="${globe}" stroke-width="${s.arrow}" stroke-linejoin="round"/>`;
}
const f1 = (n) => +n.toFixed(1);

const wordMarkup = (fill) =>
  `<g fill="${fill}"><path d="${WORD.d}"/><path fill-rule="evenodd" d="${WORD.ring}"/></g>`;

const svg = (viewBox, body, size) => {
  const [, , w, h] = viewBox.split(' ').map(Number);
  const [W, H] = size ?? [w, h];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${W}" height="${H}">\n  ${body}\n</svg>\n`;
};

// Mark centred in a 512 tile. `radius` 0 gives a full-bleed square (apple-touch, maskable).
function tile(m, { scale, radius }) {
  const [bx, by, bw, bh] = m.box;
  const k = (512 * scale) / Math.max(bw, bh);
  const tx = 256 - (bx + bw / 2) * k, ty = 256 - (by + bh / 2) * k;
  return svg('0 0 512 512', `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORS.tileTop}"/><stop offset="1" stop-color="${COLORS.tileBottom}"/></linearGradient></defs>
  <rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>
  <g transform="translate(${f1(tx)} ${f1(ty)}) scale(${+k.toFixed(4)})">${markMarkup(m)}</g>`);
}

// Horizontal lockup: mark, then the logotype at ~40% of the mark's height.
function lockup({ globe, word }) {
  const [bx, by, bw, bh] = FULL.box;
  const capH = bh * 0.36, k = capH / WORD.height;
  const gap = bh * 0.16;
  const wx = bw + gap, wy = (bh - capH) / 2;
  const width = wx + WORD.width * k;
  return svg(`0 0 ${f1(width)} ${f1(bh)}`,
    `<g transform="translate(${-bx} ${-by})">${markMarkup(FULL, { globe })}</g>
  <g transform="translate(${f1(wx)} ${f1(wy)}) scale(${+k.toFixed(4)})">${wordMarkup(word)}</g>`);
}

function ogImage() {
  const W = 1200, H = 630;
  const [bx, by, bw, bh] = FULL.box;
  const markH = 236, mk = markH / bh;
  const capH = 58, wk = capH / WORD.height;
  const top = 108;
  const wordY = top + markH + 44;
  const tagY = wordY + capH + 46;
  return svg(`0 0 ${W} ${H}`, `<defs>
    <linearGradient id="og-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D121D"/><stop offset="1" stop-color="#05070C"/></linearGradient>
    <radialGradient id="og-glow" cx="600" cy="${top + markH / 2}" r="360" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${COLORS.accent}" stop-opacity="0.16"/><stop offset="1" stop-color="${COLORS.accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="og-grid" width="48" height="48" patternUnits="userSpaceOnUse" x="24" y="27">
      <path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity="0.035" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#og-bg)"/>
  <rect width="${W}" height="${H}" fill="url(#og-grid)"/>
  <rect width="${W}" height="${H}" fill="url(#og-glow)"/>
  <g transform="translate(${f1(600 - (bx + bw / 2) * mk)} ${f1(top - by * mk)}) scale(${+mk.toFixed(4)})">${markMarkup(FULL, { id: 'og' })}</g>
  <g transform="translate(${f1(600 - (WORD.width * wk) / 2)} ${wordY}) scale(${+wk.toFixed(4)})">${wordMarkup(COLORS.globe)}</g>
  <text x="600" y="${tagY}" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="21" letter-spacing="6.5" fill="${COLORS.accent}">${TAGLINE}</text>
  <text x="600" y="${H - 34}" text-anchor="middle" font-family="${FONT}" font-weight="500" font-size="17" letter-spacing="1.5" fill="#8A93A6">Live flights · ships · satellites · cameras on one map — open source</text>`, [W, H]);
}

function generatedTs() {
  const obj = (o, indent) => '{\n' + Object.entries(o).map(([k, v]) => `${indent}  ${k}: ${JSON.stringify(v)},`).join('\n') + `\n${indent}}`;
  const variant = (m) => obj({ globe: m.globe, stroke: m.stroke, box: m.box, grid: m.grid, front: m.front, predicted: m.predicted, arrow: m.arrow, dots: m.dots, dotR: m.dotR, fade: m.fade }, '  ');
  return `// Generated by tools/brand/build.mjs from tools/brand/geometry.mjs. Do not edit.

export const MARK = {
  full: ${variant(FULL)},
  small: ${variant(SMALL)},
} as const;

export const WORDMARK = ${obj(WORD, '')} as const;
`;
}

// PNG-in-ICO; every browser since IE Vista reads it.
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(buf.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.buf)]);
}

const png = (svgText, w, h = w) =>
  sharp(Buffer.from(svgText), { density: 72 * Math.max(w / 512, 1) * 2 }).resize(w, h).png({ compressionLevel: 9 }).toBuffer();

console.log('Vectors');
const markBox = FULL.box.join(' ');
write(pub('brand/takip-mark.svg'), svg(markBox, markMarkup(FULL)));
write(pub('brand/takip-mark-on-light.svg'), svg(markBox, markMarkup(FULL, { globe: '#0B1220' })));
write(pub('brand/takip-logo.svg'), lockup({ globe: COLORS.globe, word: COLORS.globe }));
write(pub('brand/takip-logo-on-light.svg'), lockup({ globe: '#0B1220', word: '#0B1220' }));
const iconTile = tile(FULL, { scale: 0.8, radius: 112 });
const faviconTile = tile(SMALL, { scale: 0.92, radius: 104 });
const squareTile = tile(FULL, { scale: 0.8, radius: 0 });
// Maskable: launchers crop to a circle of 80% diameter, so the mark stays inside it.
const maskableTile = tile(FULL, { scale: 0.66, radius: 0 });
write(pub('favicon.svg'), faviconTile);
write(pub('brand/takip-icon.svg'), iconTile);
write(path.join(ROOT, 'src/components/shell/brand/geometry.generated.ts'), generatedTs());

console.log('Rasters');
const rasters = [
  ['favicon-16x16.png', faviconTile, 16],
  ['favicon-32x32.png', faviconTile, 32],
  ['apple-touch-icon.png', squareTile, 180],
  ['android-chrome-192x192.png', iconTile, 192],
  ['android-chrome-512x512.png', iconTile, 512],
  ['casaos-icon.png', iconTile, 512],
  ['icon-192.png', maskableTile, 192],
  ['takip-icon.png', maskableTile, 512],
];
for (const [name, src, size] of rasters) write(pub(name), await png(src, size));

const icoBuf = ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await png(faviconTile, size) }))));
write(pub('favicon.ico'), icoBuf);
write(path.join(ROOT, 'src/app/favicon.ico'), icoBuf);
write(pub('og-image.png'), await sharp(Buffer.from(ogImage())).png({ compressionLevel: 9 }).toBuffer());
