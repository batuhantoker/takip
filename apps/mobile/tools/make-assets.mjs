// App icons, launch screens and store graphics from public/brand (tools/brand/build.mjs makes those).
// Run after a brand change: npm run assets. The outputs are committed, so builds don't need sharp.
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const brand = name => readFileSync(new URL(`../../public/brand/${name}`, root), 'utf8');
const BACKGROUND = '#0A0C0F';

const icon = brand('takip-icon.svg');
// iOS rounds the corners itself and refuses transparency; Android's legacy icons keep the brand's own rounding.
const squareIcon = Buffer.from(icon.replace(/ rx="112"/, ''));
const roundedIcon = Buffer.from(icon);
const mark = Buffer.from(brand('takip-mark.svg'));
const logo = Buffer.from(brand('takip-logo.svg'));

const out = path => {
  const file = new URL(path, root);
  mkdirSync(new URL('./', file), { recursive: true });
  return file.pathname;
};

/** The art `share` of the canvas's shorter side wide (or of its width, for wide art), centred on `background` or transparent. */
async function centred(svg, width, height, share, background, side = Math.min(width, height)) {
  const art = await sharp(svg, { density: 384 }).resize({ width: Math.round(side * share) }).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art, gravity: 'centre' }]);
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const res = 'android/app/src/main/res';

for (const [density, scale] of Object.entries(DENSITIES)) {
  const legacy = Math.round(48 * scale);
  await sharp(roundedIcon, { density: 384 }).resize(legacy).png().toFile(out(`${res}/mipmap-${density}/ic_launcher.png`));
  const circle = Buffer.from(`<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`);
  await sharp(squareIcon, { density: 384 }).resize(legacy).composite([{ input: circle, blend: 'dest-in' }]).png()
    .toFile(out(`${res}/mipmap-${density}/ic_launcher_round.png`));
  // Adaptive icons crop to a 66 dp circle of the 108 dp layer, so the mark stays inside it.
  const layer = Math.round(108 * scale);
  await (await centred(mark, layer, layer, 0.56)).png().toFile(out(`${res}/mipmap-${density}/ic_launcher_foreground.png`));

  const [w, h] = [Math.round(320 * scale), Math.round(480 * scale)];
  await (await centred(mark, w, h, 0.42, BACKGROUND)).png().toFile(out(`${res}/drawable-port-${density}/splash.png`));
  await (await centred(mark, h, w, 0.42, BACKGROUND)).png().toFile(out(`${res}/drawable-land-${density}/splash.png`));
}
await (await centred(mark, 480, 320, 0.42, BACKGROUND)).png().toFile(out(`${res}/drawable/splash.png`));

const ios = 'ios/App/App/Assets.xcassets';
await sharp(squareIcon, { density: 384 }).resize(1024).flatten({ background: BACKGROUND }).png().toFile(out(`${ios}/AppIcon.appiconset/AppIcon-512@2x.png`));
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await (await centred(mark, 2732, 2732, 0.16, BACKGROUND)).png().toFile(out(`${ios}/Splash.imageset/${name}`));
}

// Store listings: Play wants a 512 px icon and a 1024×500 feature graphic.
await sharp(roundedIcon, { density: 384 }).resize(512).png().toFile(out('store/play-icon-512.png'));
await (await centred(logo, 1024, 500, 0.6, BACKGROUND, 1024)).png().toFile(out('store/play-feature-1024x500.png'));
await sharp(squareIcon, { density: 384 }).resize(1024).flatten({ background: BACKGROUND }).png().toFile(out('store/app-store-icon-1024.png'));

console.log('icons, launch screens and store graphics written');
