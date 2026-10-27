// Builds public/data/sky/deep/<id>.jpg and src/lib/space/deep/deep-sky.generated.ts: the photographs the space
// view hangs at nebulae, clusters and galaxies, each with where it sits on the sky (centre, scale, rotation).
// Archive pictures come from the djangoplicity sites (ESA/Webb, ESA/Hubble, ESO, NOIRLab), whose image pages carry
// the picture's astrometry in their WorldWide Telescope link; ESA/Webb, ESA/Hubble and ESO images are CC BY 4.0,
// NOIRLab's CC BY 4.0 as well. Whole galaxies too wide for any archive frame are cut from the DSS2 colour survey by
// CDS hips2fits, north up and east left (DSS: STScI/AURA, Palomar and UK Schmidt plates; free for non-commercial use).
// Each picture also gets <id>.small.jpg, 512 px across, which the space view shows until the picture is big on screen.
//   nice node tools/build-deep-sky.mjs [id ...]   (rebuilds only those ids; the rest keep their last placement)
//   nice node tools/build-deep-sky.mjs --small    (only remakes the 512 px renditions from the saved pictures)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharpLib from 'sharp';

const OUT_DIR = 'public/data/sky/deep';
const OUT_TS = 'src/lib/space/deep/deep-sky.generated.ts';
const UA = 'takip-build (hello@takip.dev)';
const ARCHIVE = {
  webb: 'https://esawebb.org/images/',
  hubble: 'https://esahubble.org/images/',
  eso: 'https://www.eso.org/public/images/',
  noirlab: 'https://noirlab.edu/public/images/',
};
const HIPS2FITS = 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits';

// [id, archive, image id, longest edge px] or [id, 'dss2', [ra°, dec°, field°, D25 major′, minor′, PA°], edge]; ids match
// lib/space/deep/deep-sky.ts. A survey cut-out keeps only a soft ellipse round its galaxy (RC3/NED D25 diameters): the square of
// sky around it, and the Milky Way's own foreground stars in it, would hang at the galaxy's distance otherwise.
const SOURCES = [
  ['pillars-of-creation', 'webb', 'weic2216a', 2048],
  ['eagle-nebula', 'eso', 'eso0926a', 1600],
  ['orion-nebula', 'eso', 'eso1723a', 2048],
  ['horsehead-nebula', 'eso', 'eso0202a', 1600],
  ['lagoon-nebula', 'eso', 'eso1403a', 1600],
  ['trifid-nebula', 'eso', 'eso0930a', 1280],
  ['carina-nebula', 'eso', 'eso1250a', 2048],
  ['cosmic-cliffs', 'webb', 'weic2205a', 2048],
  ['crab-nebula', 'hubble', 'heic0515a', 1600],
  ['helix-nebula', 'eso', 'eso1205a', 1600],
  ['southern-ring-nebula', 'webb', 'weic2207b', 1600],
  ['cassiopeia-a', 'webb', 'weic2311a', 1600],
  ['rho-ophiuchi', 'webb', 'weic2316a', 1600],
  ['veil-nebula', 'noirlab', 'noao-veil-wiyn-0-9-m', 1280],
  ['pleiades', 'noirlab', 'noao-m45', 1600],
  ['omega-centauri', 'eso', 'eso0844a', 1280],
  ['47-tucanae', 'eso', 'eso1302a', 1280],
  ['sgr-a-shadow', 'eso', 'eso2208-eht-mwa', 1024],
  ['ring-nebula', 'hubble', 'heic1310a', 1280],
  ['cats-eye-nebula', 'hubble', 'heic0414a', 1280],
  ['butterfly-nebula', 'hubble', 'heic0910h', 1280],
  ['bubble-nebula', 'hubble', 'heic1608a', 1280],
  ['eta-carinae', 'hubble', 'heic1912a', 1600],
  ['westerlund-2', 'hubble', 'heic1509a', 1600],
  ['lmc', 'dss2', [80.894, -69.756, 15, 645, 550, 170], 2048],
  ['smc', 'dss2', [13.187, -72.829, 7, 320, 185, 45], 1600],
  ['tarantula-nebula', 'eso', 'eso1816a', 1600],
  ['m31', 'dss2', [10.6847, 41.269, 3.6, 190, 60, 35], 2048],
  ['m33', 'dss2', [23.462, 30.66, 1.6, 70.8, 41.7, 23], 1280],
  ['ic-342', 'noirlab', 'noao0703a', 1280],
  ['bodes-galaxy', 'noirlab', 'noao-m81', 1280],
  ['cigar-galaxy', 'noirlab', 'noao-m82final', 1280],
  ['centaurus-a', 'eso', 'eso0903a', 1600],
  ['whirlpool-galaxy', 'noirlab', 'noao-m51haase', 1600],
  ['sombrero-galaxy', 'eso', 'eso0007a', 1600],
  ['needle-galaxy', 'eso', 'eso0525a', 1280],
  ['phantom-galaxy', 'webb', 'potm2208a', 1280],
  ['pinwheel-galaxy', 'hubble', 'heic0602a', 1600],
  ['antennae-galaxies', 'hubble', 'heic0615a', 1600],
  ['m87', 'dss2', [187.7059, 12.3911, 0.3, 8.3, 6.6, 170], 1024],
  ['m87-shadow', 'eso', 'eso1907a', 1024],
  ['stephans-quintet', 'webb', 'weic2208a', 1600],
  ['perseus-a', 'hubble', 'heic0817a', 1280],
  ['cartwheel-galaxy', 'webb', 'weic2211a', 1280],
  ['webb-first-deep-field', 'webb', 'weic2209a', 1600],
];

// Survey mosaics run to hundreds of megapixels.
const sharp = buf => sharpLib(buf, { limitInputPixels: false });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = s => s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

async function get(url, as = 'text') {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } }).catch(e => ({ ok: false, status: e.message }));
    if (res.ok) return as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
    if (i === 3) throw new Error(`${url}: HTTP ${res.status}`);
    await sleep(5000 * (i + 1));
  }
}

/**
 * The page's WorldWide Telescope link holds the screen-size image's astrometry. Its reference pixel's y counts up
 * from the bottom row, as in FITS, and its rotation is 180° minus AVM's.
 */
async function archive(site, imageId) {
  const page = ARCHIVE[site] + imageId + '/';
  const html = await get(page);
  const wwt = html.match(/ShowImage\.aspx\?([^"]+)"/);
  if (!wwt) throw new Error(`${page}: no WorldWide Telescope link`);
  const q = new URLSearchParams(wwt[1].replace(/&amp;/g, '&'));
  const screenUrl = q.get('imageurl').replace(/^http:/, 'https:');
  const screen = await get(screenUrl, 'buffer');
  const { width: sw, height: sh } = await sharp(screen).metadata();
  let large = await get(screenUrl.replace('/screen/', '/large/'), 'buffer').catch(() => null);
  // A large rendition cropped differently from the screen one would carry the astrometry off.
  const lm = large && await sharp(large).metadata();
  if (lm && Math.abs(lm.width / lm.height - sw / sh) > 0.01) large = null;
  const credit = strip((html.match(/<div class="credit">([\s\S]*?)<\/div>/) || [])[1] ?? '');
  return {
    image: large ?? screen, screenWidth: sw,
    ra: +q.get('ra'), dec: +q.get('dec'), x: +q.get('x'), y: sh - +q.get('y'), scale: +q.get('scale'), northLeft: 180 - +q.get('rotation'),
    credit, page,
  };
}

/** 1 inside the galaxy, easing to 0 a little past its D25 ellipse; the minor axis is given more room, discs fade slowly sideways. */
function ellipseMask(w, h, fov, [major, minor, pa]) {
  const perPx = (fov * 60) / w, t = (pa * Math.PI) / 180;
  // North up, east left: PA turns the major axis from up toward the left.
  const ax = [-Math.sin(t), Math.cos(t)], bx = [Math.cos(t), Math.sin(t)];
  const a = (major / 2) * 1.1, b = (minor / 2) * 1.5;
  const mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) * perPx, dy = (h / 2 - y) * perPx;
      const r = Math.hypot((dx * ax[0] + dy * ax[1]) / a, (dx * bx[0] + dy * bx[1]) / b);
      const k = Math.min(1, Math.max(0, (1.15 - r) / 0.45));
      mask[y * w + x] = k * k * (3 - 2 * k);
    }
  }
  return mask;
}

async function masked(image, w, h, mask) {
  const { data } = await sharp(image).resize(w, h).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) data[i * 3 + c] = Math.round(data[i * 3 + c] * mask[i]);
  return sharpLib(data, { raw: { width: w, height: h, channels: 3 } });
}

async function dss2([ra, dec, fov]) {
  const px = 2048;
  const qs = new URLSearchParams({ hips: 'CDS/P/DSS2/color', width: px, height: px, fov, projection: 'TAN', coordsys: 'icrs', rotation_angle: 0, ra, dec, format: 'jpg' });
  const image = await get(`${HIPS2FITS}?${qs}`, 'buffer');
  return {
    image, screenWidth: px, ra, dec, x: px / 2, y: px / 2, scale: (fov * 3600) / px, northLeft: 0,
    credit: 'Digitized Sky Survey 2 (STScI/AURA, Palomar/Caltech, UKSTU/AAO), via CDS hips2fits',
    page: `https://aladin.cds.unistra.fr/AladinLite/?target=${ra}%20${dec}&fov=${fov}&survey=CDS%2FP%2FDSS2%2Fcolor`,
  };
}

function previous() {
  if (!existsSync(OUT_TS)) return {};
  const m = readFileSync(OUT_TS, 'utf8').match(/= (\{[\s\S]*\});\s*$/);
  return m ? JSON.parse(m[1]) : {};
}

const SMALL_PX = 512;
const small = id => sharpLib(`${OUT_DIR}/${id}.jpg`).resize(SMALL_PX, SMALL_PX, { fit: 'inside' }).jpeg({ quality: 80, mozjpeg: true }).toFile(`${OUT_DIR}/${id}.small.jpg`);
if (process.argv[2] === '--small') {
  for (const [id] of SOURCES) if (existsSync(`${OUT_DIR}/${id}.jpg`)) await small(id);
  console.log(`${SOURCES.length} small renditions → ${OUT_DIR}`);
  process.exit(0);
}

const only = new Set(process.argv.slice(2));
const out = previous();
mkdirSync(OUT_DIR, { recursive: true });
for (const [id, site, source, edge] of SOURCES) {
  if (only.size && !only.has(id)) continue;
  const got = site === 'dss2' ? await dss2(source) : await archive(site, source);
  const meta = await sharp(got.image).metadata();
  // Astrometry is in screen-image pixels; the saved image is the larger rendition brought down to `edge`.
  const k = Math.min(1, edge / Math.max(meta.width, meta.height));
  const w = Math.round(meta.width * k), h = Math.round(meta.height * k);
  const perScreen = w / got.screenWidth;
  const pic = site === 'dss2' ? await masked(got.image, w, h, ellipseMask(w, h, source[2], source.slice(3))) : sharp(got.image).resize(w, h);
  await pic.jpeg({ quality: 82, mozjpeg: true }).toFile(`${OUT_DIR}/${id}.jpg`);
  await small(id);
  out[id] = {
    ra: +got.ra.toFixed(6), dec: +got.dec.toFixed(6), x: +(got.x * perScreen).toFixed(2), y: +(got.y * perScreen).toFixed(2),
    arcsecPerPx: +(got.scale / perScreen).toPrecision(6), northLeftDeg: +got.northLeft.toFixed(3), width: w, height: h,
    credit: got.credit, page: got.page,
  };
  console.log(id, w, h, out[id].arcsecPerPx, out[id].northLeftDeg);
  save();
  await sleep(1500);
}

function save() {
  const sorted = Object.fromEntries(SOURCES.filter(([id]) => out[id]).map(([id]) => [id, out[id]]));
  writeFileSync(OUT_TS, `// Generated by tools/build-deep-sky.mjs; do not edit.
import type { DeepSkyImage } from './deep-sky';

export const DEEP_SKY_IMAGES: Record<string, DeepSkyImage> = ${JSON.stringify(sorted, null, 2)};
`);
}
