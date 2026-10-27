// Builds public/data/cosmos/cmb.jpg, the cosmic microwave background over the whole sky, from the Planck 2015 SMICA
// map (ESA and the Planck Collaboration, from IRSA's Planck archive): COM_CMB_IQU-smica_1024_R2.02_full.fits, HEALPix
// Nside 1024 NESTED, galactic coordinates, K_CMB, smoothed to 10′, the galactic plane inpainted. WMAP's 9-year ILC map,
// used before, is smoothed to 1°: spread over the sky round the camera it was a blur.
// Plate carrée in J2000 like milky-way-sky.jpg: RA 0h at the centre, RA increasing to the left, Dec +90° on the top row,
//   u = frac(0.5 − RA/360), v = (90 − Dec)/180.
//   nice node tools/build-cmb.mjs [path/to/COM_CMB_IQU-smica_1024_R2.02_full.fits]   (downloads it, 176 MB, without a path)
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'https://irsa.ipac.caltech.edu/data/Planck/release_2/all-sky-maps/maps/component-maps/cmb/COM_CMB_IQU-smica_1024_R2.02_full.fits';
const OUT = 'public/data/cosmos/cmb.jpg';
const W = 4096;
const H = 2048;
const SS = 2;
// The Planck team's own CMB figures run ±300 µK.
const RANGE_MK = 0.3;
// Planck-style diverging palette, cold → hot.
const PALETTE = [[0, 0, 255], [0, 112, 255], [0, 221, 255], [255, 237, 217], [255, 180, 0], [255, 75, 0], [100, 0, 0]];

const RAD = Math.PI / 180;
const RA_GP = 192.85948 * RAD;
const DEC_GP = 27.12825 * RAD;
const L_NCP = 122.93192 * RAD;

async function fits() {
  const path = process.argv[2];
  if (path) return readFileSync(path);
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`IRSA HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Primary HDU (header only) then the BINTABLE; each header is padded to 2880-byte blocks.
function readMap(buf) {
  let off = 0;
  const hdus = [];
  for (let n = 0; n < 2; n++) {
    const keys = {};
    for (let done = false; !done; off += 2880) {
      for (let c = 0; c < 36 && !done; c++) {
        const card = buf.toString('latin1', off + c * 80, off + c * 80 + 80);
        if (card.startsWith('END ')) done = true;
        const m = /^([A-Z0-9_-]+)\s*=\s*(?:'([^']*)'|([^/\s]+))/.exec(card);
        if (m) keys[m[1]] = (m[2] ?? m[3]).trim();
      }
    }
    hdus.push(keys);
  }
  const [primary, table] = hdus;
  const nside = Number(table.NSIDE);
  const rows = Number(table.NAXIS2);
  const stride = Number(table.NAXIS1);
  if (primary.NAXIS !== '0' || table.XTENSION !== 'BINTABLE' || table.ORDERING !== 'NESTED' || table.COORDSYS !== 'GALACTIC' ||
      table.TTYPE1 !== 'I_STOKES' || table.TFORM1 !== 'E' || table.TUNIT1 !== 'K_CMB' || rows !== 12 * nside * nside) {
    throw new Error('unexpected FITS layout');
  }
  // Kelvin to mK; the few unseen pixels read as the mean.
  const T = new Float32Array(rows);
  for (let i = 0; i < rows; i++) {
    const k = buf.readFloatBE(off + i * stride);
    T[i] = k > -1e30 ? k * 1000 : 0;
  }
  return { nside, T };
}

// IAU J2000 → galactic; returns [z = sin b, l in [0, 2π)].
function equatorialToGalactic(ra, dec) {
  const sd = Math.sin(dec);
  const cd = Math.cos(dec);
  const c = Math.cos(ra - RA_GP);
  const z = sd * Math.sin(DEC_GP) + cd * Math.cos(DEC_GP) * c;
  let l = L_NCP - Math.atan2(cd * Math.sin(ra - RA_GP), sd * Math.cos(DEC_GP) - cd * Math.sin(DEC_GP) * c);
  l %= 2 * Math.PI;
  if (l < 0) l += 2 * Math.PI;
  return [z, l];
}

// HEALPix NESTED ang2pix (Górski et al. 2005), z = cos θ, φ in [0, 2π); spread interleaves bits of x into even positions.
function ang2pix(nside, spread, z, phi) {
  const za = Math.abs(z);
  const tt = phi / (Math.PI / 2);
  let face, ix, iy;
  if (za <= 2 / 3) {
    const t1 = nside * (0.5 + tt);
    const t2 = nside * z * 0.75;
    const jp = Math.floor(t1 - t2);
    const jm = Math.floor(t1 + t2);
    const ifp = Math.floor(jp / nside);
    const ifm = Math.floor(jm / nside);
    face = ifp === ifm ? ifp | 4 : ifp < ifm ? ifp : ifm + 8;
    ix = jm & (nside - 1);
    iy = nside - (jp & (nside - 1)) - 1;
  } else {
    const ntt = Math.min(3, Math.floor(tt));
    const tp = tt - ntt;
    const tmp = nside * Math.sqrt(3 * (1 - za));
    const jp = Math.min(nside - 1, Math.floor(tp * tmp));
    const jm = Math.min(nside - 1, Math.floor((1 - tp) * tmp));
    if (z >= 0) {
      face = ntt;
      ix = nside - jm - 1;
      iy = nside - jp - 1;
    } else {
      face = ntt + 8;
      ix = jp;
      iy = jm;
    }
  }
  return face * nside * nside + spread[ix] + 2 * spread[iy];
}

function colour(t) {
  const s = ((Math.max(-1, Math.min(1, t)) + 1) / 2) * (PALETTE.length - 1);
  const i = Math.min(PALETTE.length - 2, Math.floor(s));
  const f = s - i;
  return PALETTE[i].map((a, c) => Math.round(a + (PALETTE[i + 1][c] - a) * f));
}

const { nside, T } = readMap(await fits());
const spread = Int32Array.from({ length: nside }, (_, v) => {
  let r = 0;
  for (let b = 0; v >> b; b++) r |= ((v >> b) & 1) << (2 * b);
  return r;
});

const px = Buffer.alloc(W * H * 3);
let saturated = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let sum = 0;
  for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
    const u = (x + (sx + 0.5) / SS) / W;
    const v = (y + (sy + 0.5) / SS) / H;
    const [z, l] = equatorialToGalactic((0.5 - u) * 2 * Math.PI, (0.5 - v) * Math.PI);
    sum += T[ang2pix(nside, spread, z, l)];
  }
  const t = sum / (SS * SS) / RANGE_MK;
  if (Math.abs(t) >= 1) saturated++;
  px.set(colour(t), (y * W + x) * 3);
}

mkdirSync('public/data/cosmos', { recursive: true });
const info = await sharp(px, { raw: { width: W, height: H, channels: 3 } })
  .jpeg({ quality: 75, mozjpeg: true })
  .toFile(OUT);
console.log(`${OUT}: ${info.width}×${info.height}, ${(info.size / 1024).toFixed(0)} KB, ` +
  `${((100 * saturated) / (W * H)).toFixed(2)}% of pixels beyond ±${RANGE_MK} mK`);
