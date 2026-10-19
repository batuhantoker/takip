import * as THREE from 'three';
import { t } from '@/lib/core/i18n/active';
import { msg } from '@/lib/core/i18n/translator';
import { AU_KM, C_KM_S } from '@/lib/space/astro';

/**
 * From the heliopause to the nearest star: rings at one light-day, -week,
 * -month and -year from the Sun, the solar gravitational focus at 550 AU, and
 * the Oort cloud — random points standing in for a shell nobody has seen.
 */

const LIGHT_DAY_AU = (C_KM_S * 86_400) / AU_KM;

export const RINGS: { id: string; au: number; label: string }[] = [
  { id: 'light-day', au: LIGHT_DAY_AU, label: msg('1 light-day') },
  { id: 'light-week', au: LIGHT_DAY_AU * 7, label: msg('1 light-week') },
  { id: 'light-month', au: LIGHT_DAY_AU * 30, label: msg('1 light-month') },
  { id: 'light-year', au: LIGHT_DAY_AU * 365.25, label: msg('1 light-year') },
];
export const FOCUS_AU = 550;
const OORT_INNER_AU = 2_000, HILLS_EDGE_AU = 20_000, OORT_OUTER_AU = 100_000;
const OORT_POINTS = 24_000;
/** Where ring labels sit, in the ecliptic. */
const LABEL_DIR = new THREE.Vector3(Math.cos(-0.5), Math.sin(-0.5), 0);

function circle(au: number, segments = 256): THREE.BufferGeometry {
  const pts = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.set([au * Math.cos(a), au * Math.sin(a), 0], i * 3);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pts, 3));
}

/** mulberry32: the cloud is the same on every load. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function oortCloud(): THREE.BufferGeometry {
  const rnd = random(1950);
  const pos = new Float32Array(OORT_POINTS * 3);
  for (let i = 0; i < OORT_POINTS; i++) {
    // Weighted outward: drawn evenly in log r, the inner cloud saturates into a white blob.
    const r = OORT_INNER_AU * Math.pow(OORT_OUTER_AU / OORT_INNER_AU, Math.sqrt(rnd()));
    const z = 2 * rnd() - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    // The inner (Hills) cloud stays flattened toward the planets' plane; the outer one is round.
    const flat = r < HILLS_EDGE_AU ? 0.3 + 0.7 * (r - OORT_INNER_AU) / (HILLS_EDGE_AU - OORT_INNER_AU) : 1;
    pos.set([r * s * Math.cos(a), r * s * Math.sin(a), r * z * flat], i * 3);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
}

/** 0 → 1 → 0 as log10(distance / radius) passes the window where a ring reads well. */
function ringFade(sunKm: number, au: number): number {
  const x = Math.log10(sunKm / (au * AU_KM));
  return THREE.MathUtils.clamp((x + 0.8) / 0.5, 0, 1) * THREE.MathUtils.clamp((1.6 - x) / 0.6, 0, 1);
}

export function createOort() {
  /** In AU. */
  const group = new THREE.Group();
  group.scale.setScalar(AU_KM);

  const rings = RINGS.map(r => {
    const material = new THREE.LineBasicMaterial({ color: '#8FA3C0', transparent: true, opacity: 0, depthWrite: false });
    const line = new THREE.Line(circle(r.au), material);
    line.frustumCulled = false;
    group.add(line);
    return { ...r, line, material };
  });

  const focusMaterial = new THREE.LineDashedMaterial({ color: '#F0D060', dashSize: 12, gapSize: 9, transparent: true, opacity: 0, depthWrite: false });
  const focus = new THREE.Line(circle(FOCUS_AU), focusMaterial);
  focus.computeLineDistances();
  focus.frustumCulled = false;
  group.add(focus);

  const cloudMaterial = new THREE.PointsMaterial({ color: '#9DB4D8', size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const cloud = new THREE.Points(oortCloud(), cloudMaterial);
  cloud.frustumCulled = false;
  group.add(cloud);

  /** `cloudFade` is the Oort cloud's own window; models hide when illustrations are off. */
  function update(sunKm: number, cloudFade: number, illustrations: boolean) {
    for (const r of rings) {
      r.material.opacity = 0.45 * ringFade(sunKm, r.au);
      r.line.visible = r.material.opacity > 0.005;
    }
    focusMaterial.opacity = 0.5 * ringFade(sunKm, FOCUS_AU);
    focus.visible = focusMaterial.opacity > 0.005;
    cloudMaterial.opacity = illustrations ? 0.28 * cloudFade : 0;
    cloud.visible = cloudMaterial.opacity > 0.005;
  }

  /** Label anchors, km: each ring, the focus and the cloud, with how visible each is now. */
  function labels(sunKm: number, cloudFade: number): { id: string; text: string; position: THREE.Vector3; alpha: number }[] {
    const at = (au: number) => LABEL_DIR.clone().multiplyScalar(au * AU_KM);
    return [
      ...rings.map(r => ({ id: r.id, text: t(r.label), position: at(r.au), alpha: ringFade(sunKm, r.au) })),
      { id: 'gravitational-focus', text: t('Solar gravitational focus'), position: LABEL_DIR.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.6).multiplyScalar(FOCUS_AU * AU_KM), alpha: ringFade(sunKm, FOCUS_AU) },
      { id: 'oort-cloud', text: t('Oort cloud · illustration'), position: new THREE.Vector3(0, 0, 1).multiplyScalar(30_000 * AU_KM), alpha: cloudFade },
    ];
  }

  return { group, update, labels };
}
