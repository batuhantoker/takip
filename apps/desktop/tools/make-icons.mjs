// Window, dock and installer icons from the brand tile (public/brand/takip-icon.svg).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(app, 'build');
const svg = readFileSync(join(app, '../../public/brand/takip-icon.svg'));

const tile = size => sharp(svg, { density: (72 * size) / 512 }).resize(size, size).png().toBuffer();

// Apple's grid keeps the tile at 824 of 1024, centred on a clear canvas.
async function macTile(size) {
  const inner = Math.round((size * 824) / 1024);
  const pad = Math.floor((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await tile(inner), left: pad, top: pad }])
    .png()
    .toBuffer();
}

/** An .ico of PNG frames, which Windows reads from Vista on. */
export function ico(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map(f => f.png)]);
}

async function main() {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'icons'), { recursive: true });

  writeFileSync(join(out, 'icon.png'), await tile(1024));
  for (const size of [16, 32, 48, 64, 128, 256, 512, 1024]) writeFileSync(join(out, 'icons', `${size}x${size}.png`), await tile(size));
  const frames = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256]) frames.push({ size, png: await tile(size) });
  writeFileSync(join(out, 'icon.ico'), ico(frames));

  if (process.platform === 'darwin') {
    const set = join(out, 'icon.iconset');
    mkdirSync(set);
    for (const size of [16, 32, 128, 256, 512]) {
      writeFileSync(join(set, `icon_${size}x${size}.png`), await macTile(size));
      writeFileSync(join(set, `icon_${size}x${size}@2x.png`), await macTile(size * 2));
    }
    execFileSync('iconutil', ['-c', 'icns', set, '-o', join(out, 'icon.icns')]);
    rmSync(set, { recursive: true });
  }
  console.log(`icons in ${out}${process.platform === 'darwin' ? '' : ' (icon.icns needs macOS)'}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
