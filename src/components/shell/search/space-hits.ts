import type { Translate } from '@/lib/core/i18n/translator';
import { KIND_LABEL, ROSTER } from '@/lib/platform/site/space/roster';
import { DEEP_SKY, type DeepSkyObject } from '@/lib/space/deep/deep-sky';
import { BASINS } from '@/lib/space/deep/basins.generated';
import { DEEP_FEATURES, NEARBY_GALAXIES, VOID_FEATURES } from '@/lib/space/deep/features';
import { STRUCTURES } from '@/lib/space/deep/structures';
import type { SpaceSelection } from '@/lib/space/selection';
import { SKY_BODIES } from '@/lib/space/sky';
import { isSpaceFocus, type SpaceFocus } from '@/lib/space/worlds';

/** Something in the space view a search can fly to: a body, a craft, a nebula or galaxy, a named structure. */
export interface SpaceHit { label: string; context: string; focus: SpaceFocus; select: SpaceSelection }

const DEEP_FOCUS: Record<DeepSkyObject['realm'], SpaceFocus> = { 'milky-way': 'stars', 'local-group': 'galaxy', beyond: 'universe' };
const FEATURE_FOCUS: Record<string, SpaceFocus> = {
  'milky-way': 'galaxy', 'sgr-a': 'galaxy', cmb: 'universe', 'local-void': 'universe', 'zone-of-avoidance': 'universe',
  heliopause: 'solar', 'termination-shock': 'solar', 'kuiper-belt': 'solar', 'oort-cloud': 'stars',
  ...Object.fromEntries([...BASINS.map(b => b.id), ...STRUCTURES.map(x => x.id), ...VOID_FEATURES].map(id => [id, 'universe' as const])),
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** 3 when a name starts with what was typed, 2 when a word in it does, 1 anywhere in it, 0 not at all. */
function score(names: string[], q: string): number {
  let best = 0;
  for (const n of names.map(fold)) {
    if (n.startsWith(q)) return 3;
    if (n.split(/[\s\-–'’(),]+/).some(w => w.startsWith(q))) best = Math.max(best, 2);
    else if (n.includes(q)) best = Math.max(best, 1);
  }
  return best;
}

/** The best few things in space whose name, in English or the reader's language, matches what was typed. */
export function spaceHits(query: string, t: Translate, limit = 5): SpaceHit[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const found: { hit: SpaceHit; s: number; weight: number }[] = [];
  const add = (names: string[], hit: SpaceHit, weight: number) => {
    const s = score(names, q);
    if (s) found.push({ hit, s, weight });
  };

  for (const b of SKY_BODIES) {
    if (b.key === 'earth') continue;
    add([b.name, t(b.name)], { label: t(b.name), context: b.key === 'sun' ? t('Star') : b.key === 'moon' ? t('Moon') : t('Planet'), focus: isSpaceFocus(b.key) ? b.key : 'solar', select: { kind: 'body', key: b.key } }, 100);
  }
  for (const o of DEEP_SKY) {
    add([o.name, t(o.name), o.subtitle], { label: t(o.name), context: t(o.subtitle), focus: DEEP_FOCUS[o.realm], select: { kind: 'feature', id: o.feature ?? o.id } }, 40 + o.rank / 2);
  }
  for (const g of NEARBY_GALAXIES) {
    if (DEEP_SKY.some(o => o.feature === g.id)) continue;
    add([g.name, t(g.name)], { label: t(g.name), context: t(g.kind), focus: 'galaxy', select: { kind: 'feature', id: g.id } }, 35);
  }
  for (const [id, focus] of Object.entries(FEATURE_FOCUS)) {
    const f = DEEP_FEATURES[id];
    if (f) add([f.name, t(f.name)], { label: t(f.name), context: t(f.subtitle, f.subtitleVars), focus, select: { kind: 'feature', id } }, 60);
  }
  for (const c of ROSTER) {
    const select: SpaceSelection | null = c.rover ? { kind: 'rover', id: c.rover }
      : c.site ? { kind: 'site', world: c.site.world, id: c.site.id }
      : c.horizons !== undefined && !c.gone ? { kind: 'craft', id: c.horizons } : null;
    if (!select) continue;
    const focus: SpaceFocus = c.site ? c.site.world : 'solar';
    add([c.name], { label: c.name, context: t(KIND_LABEL[c.kind]), focus, select }, 50);
  }
  return found.sort((a, b) => b.s - a.s || b.weight - a.weight).slice(0, limit).map(f => f.hit);
}
