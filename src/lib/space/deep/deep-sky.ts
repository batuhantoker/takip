/**
 * TAKIP — photographs of nebulae, star clusters, galaxies and two black holes, hung where they are: each picture
 * at its object's distance, facing the Sun, as large and turned as it is on the sky, so seen from Earth it covers
 * exactly what the telescope saw. Their depth is not known, so each is flat. tools/build-deep-sky.mjs fetches
 * the pictures and their astrometry (deep-sky.generated.ts).
 */

import { msg } from '@/lib/core/i18n/translator';
import { LY_KM } from '../astro';
import { bodyDirection, EQUATORIAL_TO_ECLIPTIC, mul } from '../frames';
import type { Vec3 } from '../horizons';
import { DEEP_SKY_IMAGES } from './deep-sky.generated';

/** Where a picture sits on the sky: its reference pixel's RA/Dec (J2000, degrees), scale, and how far north is turned left of up. */
export interface DeepSkyImage {
  ra: number; dec: number;
  /** Reference pixel, from the top-left corner. */
  x: number; y: number;
  arcsecPerPx: number;
  northLeftDeg: number;
  width: number; height: number;
  credit: string;
  /** The archive page the picture and its astrometry come from. */
  page: string;
}

export type DeepSkyKind = 'nebula' | 'cluster' | 'remnant' | 'galaxy' | 'black-hole' | 'deep-field';
export type DeepSkyRealm = 'milky-way' | 'local-group' | 'beyond';

export interface DeepSkyObject {
  id: string;
  name: string;
  kind: DeepSkyKind;
  /** A few words under the name. */
  subtitle: string;
  /** From the Sun; comoving for the deep field, as the cosmos layer places galaxies. */
  ly: number;
  realm: DeepSkyRealm;
  note: string;
  /** English Wikipedia title. */
  wiki: string;
  /** Label priority among its realm and gallery order, highest first. */
  rank: number;
  /** A feature that already has a card (the Local Group galaxies): the picture joins it instead of making its own. */
  feature?: string;
}

const o = (id: string, name: string, kind: DeepSkyKind, subtitle: string, ly: number, realm: DeepSkyRealm, rank: number, wiki: string, note: string, feature?: string): DeepSkyObject =>
  ({ id, name, kind, subtitle, ly, realm, rank, wiki, note, ...(feature ? { feature } : {}) });

export const DEEP_SKY: DeepSkyObject[] = [
  o('pillars-of-creation', msg('Pillars of Creation'), 'nebula', msg('Star-forming columns in the Eagle Nebula'), 5_700, 'milky-way', 100, 'Pillars of Creation',
    msg('Columns of cold gas and dust about four light-years tall, eaten away by the light of hot young stars beside them. New stars are forming inside their tips. Webb sees through much of the dust in infrared.')),
  o('eagle-nebula', msg('Eagle Nebula'), 'nebula', msg('Star cluster and nebula, M16'), 5_700, 'milky-way', 70, 'Eagle Nebula',
    msg('A young open cluster lighting the cloud it was born from. The Pillars of Creation are near its centre.')),
  o('orion-nebula', msg('Orion Nebula'), 'nebula', msg('Nearest large star-forming region, M42'), 1_344, 'milky-way', 95, 'Orion Nebula',
    msg("Visible to the naked eye as the middle 'star' of Orion's sword. The four Trapezium stars at its heart light the whole cloud.")),
  o('horsehead-nebula', msg('Horsehead Nebula'), 'nebula', msg('Dark nebula, Barnard 33'), 1_375, 'milky-way', 80, 'Horsehead Nebula',
    msg('A cloud of cold dust standing in front of glowing hydrogen, just south of Alnitak in Orion’s belt.')),
  o('lagoon-nebula', msg('Lagoon Nebula'), 'nebula', msg('Star-forming region, M8'), 4_300, 'milky-way', 55, 'Lagoon Nebula',
    msg('A giant cloud in Sagittarius, bright enough to see with the naked eye from a dark site.')),
  o('trifid-nebula', msg('Trifid Nebula'), 'nebula', msg('Emission and reflection nebula, M20'), 4_100, 'milky-way', 45, 'Trifid Nebula',
    msg('Split into three lobes by dark lanes of dust; red where hydrogen glows, blue where dust reflects starlight.')),
  o('carina-nebula', msg('Carina Nebula'), 'nebula', msg('Star-forming region, NGC 3372'), 7_500, 'milky-way', 75, 'Carina Nebula',
    msg('One of the largest star-forming regions in the Milky Way, four times the size of the Orion Nebula, and home to the unstable giant Eta Carinae.')),
  o('cosmic-cliffs', msg('Cosmic Cliffs'), 'nebula', msg('Edge of NGC 3324 in Carina'), 7_600, 'milky-way', 85, 'NGC 3324',
    msg("The edge of a cavity blown in the cloud by hot young stars above it, in one of Webb's first images (July 2022). The tallest peaks are about seven light-years high.")),
  o('crab-nebula', msg('Crab Nebula'), 'remnant', msg('Supernova remnant, M1'), 6_500, 'milky-way', 90, 'Crab Nebula',
    msg('What is left of a star whose explosion was seen from Earth in 1054 and recorded by Chinese astronomers. A pulsar spinning 30 times a second sits at its centre.')),
  o('helix-nebula', msg('Helix Nebula'), 'nebula', msg('Planetary nebula, NGC 7293'), 655, 'milky-way', 65, 'Helix Nebula',
    msg('The outer layers of a dying Sun-like star, cast off over the last 10,000 years. One of the nearest planetary nebulae.')),
  o('southern-ring-nebula', msg('Southern Ring Nebula'), 'nebula', msg('Planetary nebula, NGC 3132'), 2_500, 'milky-way', 50, 'NGC 3132',
    msg('Shells of gas thrown off by a dying star; Webb found the faint star at its centre wrapped in dust. One of Webb’s first images.')),
  o('cassiopeia-a', msg('Cassiopeia A'), 'remnant', msg('Supernova remnant'), 11_000, 'milky-way', 60, 'Cassiopeia A',
    msg('The youngest known supernova remnant in the Milky Way: its light reached Earth around 1680, apparently unnoticed.')),
  o('rho-ophiuchi', msg('Rho Ophiuchi'), 'nebula', msg('Nearest star-forming cloud'), 390, 'milky-way', 40, 'Rho Ophiuchi cloud complex',
    msg('About 50 young stars, none much bigger than the Sun, forming in the nearest stellar nursery to Earth. Webb’s first-anniversary image.')),
  o('veil-nebula', msg('Veil Nebula'), 'remnant', msg("Supernova remnant, the Witch's Broom"), 2_400, 'milky-way', 35, 'Veil Nebula',
    msg('Filaments of a star that exploded 10,000 to 20,000 years ago, still expanding. This is its western arc, NGC 6960.')),
  o('pleiades', msg('Pleiades'), 'cluster', msg('Open star cluster, M45'), 444, 'milky-way', 88, 'Pleiades',
    msg('The Seven Sisters: a cluster of hot young stars about 100 million years old, passing through a cloud of dust that reflects their blue light.')),
  o('omega-centauri', msg('Omega Centauri'), 'cluster', msg('Globular cluster'), 17_000, 'milky-way', 58, 'Omega Centauri',
    msg('About ten million stars, the largest globular cluster of the Milky Way; it may be the core of a small galaxy the Milky Way swallowed.')),
  o('47-tucanae', msg('47 Tucanae'), 'cluster', msg('Globular cluster'), 14_700, 'milky-way', 30, '47 Tucanae',
    msg('The second-brightest globular cluster, seen beside the Small Magellanic Cloud though nowhere near it.')),
  o('sgr-a-shadow', msg('Sagittarius A*, imaged'), 'black-hole', msg('Event Horizon Telescope, 2022'), 26_670, 'milky-way', 72, 'Sagittarius A*',
    msg("The shadow of the Milky Way's central black hole against the glowing gas around it, imaged by the Event Horizon Telescope. The ring is about the size of Mercury's orbit.")),
  o('ring-nebula', msg('Ring Nebula'), 'nebula', msg('Planetary nebula, M57'), 2_570, 'milky-way', 62, 'Ring Nebula',
    msg('The outer layers of a dying star, cast off in a barrel-shaped shell that we see almost end on, so it looks like a ring.')),
  o('cats-eye-nebula', msg("Cat's Eye Nebula"), 'nebula', msg('Planetary nebula, NGC 6543'), 3_300, 'milky-way', 45, "Cat's Eye Nebula",
    msg('Shells of gas thrown off by a dying star every 1,500 years or so, with a fast wind inside them shaping knots and jets. One of the most intricate planetary nebulae known.')),
  o('butterfly-nebula', msg('Butterfly Nebula'), 'nebula', msg('Planetary nebula, NGC 6302'), 3_400, 'milky-way', 40, 'NGC 6302',
    msg('The wings are gas thrown out by a dying star hidden behind the dark band of dust at the centre, one of the hottest stars known at over 200,000 kelvin.')),
  o('bubble-nebula', msg('Bubble Nebula'), 'nebula', msg('Emission nebula, NGC 7635'), 7_100, 'milky-way', 42, 'NGC 7635',
    msg('A shell blown into the surrounding gas by the wind of a single young star about 45 times the mass of the Sun.')),
  o('eta-carinae', msg('Eta Carinae'), 'nebula', msg('Massive star and the Homunculus Nebula'), 7_500, 'milky-way', 48, 'Eta Carinae',
    msg('One of the most massive stars known. In the 1840s it threw off more than ten Suns’ worth of gas and briefly became the second-brightest star in the sky; the two lobes are that outburst.')),
  o('westerlund-2', msg('Westerlund 2'), 'cluster', msg('Young star cluster in Carina'), 20_000, 'milky-way', 45, 'Westerlund 2',
    msg('About 3,000 young stars, some of the hottest and brightest in the Milky Way, carving a cavity in the cloud they formed from. Hubble’s 25th-anniversary image.')),
  o('lmc', msg('Large Magellanic Cloud'), 'galaxy', msg('Satellite of the Milky Way'), 163_000, 'local-group', 80, 'Large Magellanic Cloud', '', 'lmc'),
  o('smc', msg('Small Magellanic Cloud'), 'galaxy', msg('Satellite of the Milky Way'), 203_000, 'local-group', 60, 'Small Magellanic Cloud', '', 'smc'),
  o('tarantula-nebula', msg('Tarantula Nebula'), 'nebula', msg('Star-forming region in the Large Magellanic Cloud'), 163_000, 'local-group', 55, 'Tarantula Nebula',
    msg('The brightest star-forming region in the Local Group. If it were as close as the Orion Nebula it would cast shadows on Earth.')),
  o('m31', msg('Andromeda Galaxy'), 'galaxy', msg('Spiral galaxy, M31'), 2_537_000, 'local-group', 100, 'Andromeda Galaxy', '', 'm31'),
  o('m33', msg('Triangulum Galaxy'), 'galaxy', msg('Spiral galaxy, M33'), 2_730_000, 'local-group', 70, 'Triangulum Galaxy', '', 'm33'),
  o('ic-342', msg('Hidden Galaxy'), 'galaxy', msg('Spiral galaxy, IC 342'), 10_700_000, 'beyond', 30, 'IC 342',
    msg('A large spiral almost face-on to us, dimmed and reddened by the Milky Way’s dust in front of it.')),
  o('bodes-galaxy', msg("Bode's Galaxy"), 'galaxy', msg('Spiral galaxy, M81'), 11_800_000, 'beyond', 60, "Bode's Galaxy",
    msg('A grand spiral whose pull is stirring up its neighbour, the Cigar Galaxy.')),
  o('cigar-galaxy', msg('Cigar Galaxy'), 'galaxy', msg('Starburst galaxy, M82'), 11_400_000, 'beyond', 55, 'Messier 82',
    msg("Forming stars ten times faster than the Milky Way since a close pass by M81; the red plumes are gas blown out of it by supernovae.")),
  o('centaurus-a', msg('Centaurus A'), 'galaxy', msg('Elliptical galaxy with a dust lane, NGC 5128'), 12_400_000, 'beyond', 75, 'Centaurus A',
    msg('A giant elliptical galaxy that swallowed a spiral; the dark band is the spiral’s dust. Its central black hole drives jets a million light-years long.')),
  o('whirlpool-galaxy', msg('Whirlpool Galaxy'), 'galaxy', msg('Spiral galaxy, M51'), 28_000_000, 'beyond', 85, 'Whirlpool Galaxy',
    msg('A face-on spiral pulling on its small companion, NGC 5195. The first galaxy whose spiral shape was seen, by Lord Rosse in 1845.')),
  o('sombrero-galaxy', msg('Sombrero Galaxy'), 'galaxy', msg('Spiral galaxy, M104'), 31_100_000, 'beyond', 80, 'Sombrero Galaxy',
    msg('Seen almost edge-on, with a bright bulge and a ring of dust; its black hole weighs about a billion Suns.')),
  o('needle-galaxy', msg('Needle Galaxy'), 'galaxy', msg('Edge-on spiral, NGC 4565'), 40_000_000, 'beyond', 35, 'NGC 4565',
    msg('A spiral seen exactly edge-on, which is how the Milky Way would look from far outside along its plane.')),
  o('phantom-galaxy', msg('Phantom Galaxy'), 'galaxy', msg('Spiral galaxy, M74'), 32_000_000, 'beyond', 40, 'Messier 74',
    msg('A face-on spiral; Webb’s infrared view shows the filaments of gas and dust in its arms.')),
  o('pinwheel-galaxy', msg('Pinwheel Galaxy'), 'galaxy', msg('Spiral galaxy, M101'), 21_000_000, 'beyond', 65, 'Pinwheel Galaxy',
    msg('A face-on spiral about 170,000 light-years across, much larger than the Milky Way. This Hubble mosaic was the largest and most detailed galaxy picture it had made.')),
  o('antennae-galaxies', msg('Antennae Galaxies'), 'galaxy', msg('Colliding galaxies, NGC 4038 and NGC 4039'), 72_000_000, 'beyond', 60, 'Antennae Galaxies',
    msg('Two spiral galaxies in the middle of a collision. The bright blue knots are clusters of new stars set off by the crash; the long tails of stars that name them are beyond this picture.')),
  o('m87', msg('Messier 87'), 'galaxy', msg('Giant elliptical galaxy'), 53_500_000, 'beyond', 65, 'Messier 87',
    msg('One of the most massive galaxies nearby, at the heart of the Virgo Cluster, with a jet 5,000 light-years long coming out of its core.')),
  o('m87-shadow', msg('M87*, imaged'), 'black-hole', msg('Event Horizon Telescope, 2019'), 53_500_000, 'beyond', 70, 'Messier 87',
    msg('The first picture of a black hole: the shadow of the 6.5-billion-Sun black hole at the centre of M87 against the hot gas around it.')),
  o('stephans-quintet', msg("Stephan's Quintet"), 'galaxy', msg('Group of galaxies'), 290_000_000, 'beyond', 70, "Stephan's Quintet",
    msg('Four galaxies locked in a slow collision, with a fifth far in front of them (about 40 million light-years away, placed here with the group). One of Webb’s first images.')),
  o('perseus-a', msg('Perseus A'), 'galaxy', msg('Galaxy at the heart of the Perseus Cluster, NGC 1275'), 237_000_000, 'beyond', 40, 'NGC 1275',
    msg('The giant galaxy at the centre of the Perseus Cluster. Its red threads are filaments of cool gas held in shape by magnetic fields, in the hot gas that fills the cluster.')),
  o('cartwheel-galaxy', msg('Cartwheel Galaxy'), 'galaxy', msg('Ring galaxy'), 500_000_000, 'beyond', 50, 'Cartwheel Galaxy',
    msg('A smaller galaxy punched through it, sending a ring of new stars rippling outward like a stone dropped in a pond.')),
  o('webb-first-deep-field', msg("Webb's First Deep Field"), 'deep-field', msg('Galaxy cluster SMACS 0723'), 5_100_000_000, 'beyond', 75, 'SMACS J0723.3–7327',
    msg('The cluster’s light left it 4.6 billion years ago; its gravity bends the light of galaxies far behind it into arcs. Placed at the cluster; the arcs are much farther still.')),
];

/** Local Group galaxies that are inside another's picture: their glows give way to it. */
export const PICTURED_IN: Record<string, string> = { m32: 'm31', m110: 'm31' };

const byId = new Map(DEEP_SKY.map(d => [d.id, d]));
export const deepSkyObject = (id: string) => byId.get(id);
export const deepSkyImage = (id: string): DeepSkyImage | undefined => DEEP_SKY_IMAGES[id];
/** `small`: the 512 px rendition, for a picture that is small on screen or a card. */
export const deepSkyUrl = (id: string, small = false) => `/data/sky/deep/${id}${small ? '.small' : ''}.jpg`;
/** The placed picture a feature id stands for: its own, or a Local Group galaxy's. */
export const picturedFeature = (id: string) => DEEP_SKY_PLACED.find(d => (d.object.feature ?? d.object.id) === id);

/**
 * Sky offsets, radians, of image pixel (px, py): east and north of the reference direction. Pictures keep
 * astronomy's parity (east left of north), so with north turned θ left of up, right = −sinθ·n − cosθ·e and
 * up = cosθ·n − sinθ·e.
 */
export function pixelOffset(img: DeepSkyImage, px: number, py: number): { east: number; north: number } {
  const s = (img.arcsecPerPx / 3600) * Math.PI / 180;
  const right = (px - img.x) * s, up = (img.y - py) * s;
  const t = img.northLeftDeg * Math.PI / 180;
  return { east: -Math.cos(t) * right - Math.sin(t) * up, north: -Math.sin(t) * right + Math.cos(t) * up };
}

/** Pixel of a sky position (J2000 degrees), by the gnomonic projection the archives' astrometry uses. */
export function skyToPixel(img: DeepSkyImage, ra: number, dec: number): [number, number] {
  const r = Math.PI / 180;
  const a0 = img.ra * r, d0 = img.dec * r, a = ra * r, d = dec * r;
  const den = Math.sin(d) * Math.sin(d0) + Math.cos(d) * Math.cos(d0) * Math.cos(a - a0);
  const east = Math.cos(d) * Math.sin(a - a0) / den;
  const north = (Math.sin(d) * Math.cos(d0) - Math.cos(d) * Math.sin(d0) * Math.cos(a - a0)) / den;
  const t = img.northLeftDeg * r, s = (img.arcsecPerPx / 3600) * r;
  const right = -Math.sin(t) * north - Math.cos(t) * east, up = Math.cos(t) * north - Math.sin(t) * east;
  return [img.x + right / s, img.y - up / s];
}

export interface DeepSkyPlacement {
  /** The picture's centre, km, scene frame. */
  centre: Vec3;
  /** Top-left, top-right, bottom-right, bottom-left, km, scene frame. */
  corners: [Vec3, Vec3, Vec3, Vec3];
  /** Unit vector from the Sun to the picture: its face looks back along it. */
  normal: Vec3;
  widthKm: number;
  heightKm: number;
}

/** The picture laid in the plane square to the line of sight at the object's distance. */
export function placement(img: DeepSkyImage, ly: number): DeepSkyPlacement {
  const r = Math.PI / 180;
  const a = img.ra * r, d = img.dec * r;
  const dir: Vec3 = bodyDirection(img.dec, img.ra);
  const east: Vec3 = [-Math.sin(a), Math.cos(a), 0];
  const north: Vec3 = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  const km = ly * LY_KM;
  const at = (px: number, py: number): Vec3 => {
    const o = pixelOffset(img, px, py);
    return mul(EQUATORIAL_TO_ECLIPTIC, [0, 1, 2].map(i => km * (dir[i] + o.east * east[i] + o.north * north[i])) as Vec3);
  };
  const s = (img.arcsecPerPx / 3600) * r * km;
  return {
    centre: at(img.width / 2, img.height / 2),
    corners: [at(0, 0), at(img.width, 0), at(img.width, img.height), at(0, img.height)],
    normal: mul(EQUATORIAL_TO_ECLIPTIC, dir),
    widthKm: img.width * s, heightKm: img.height * s,
  };
}

/** Every object with a picture, placed. */
export const DEEP_SKY_PLACED: { object: DeepSkyObject; image: DeepSkyImage; place: DeepSkyPlacement }[] = DEEP_SKY.flatMap(object => {
  const image = deepSkyImage(object.id);
  return image ? [{ object, image, place: placement(image, object.ly) }] : [];
});
