import { leadSentences } from '@/lib/core/wikipedia/summary';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { LY_KM } from '@/lib/space/astro';
import { DEEP_SKY_PLACED, type DeepSkyImage, type DeepSkyKind, type DeepSkyObject, type DeepSkyPlacement, type DeepSkyRealm } from '@/lib/space/deep/deep-sky';
import { DEEP_FEATURES } from '@/lib/space/deep/features';
import { compact } from '@/lib/space/format';
import { descriptionMax, fit, titleMax } from './copy';

/**
 * TAKIP — the deep-sky pages, /deep-sky/<id>: one per telescope picture the space view hangs (lib/space/deep/deep-sky.ts),
 * slugged by the picture's id, which never moves.
 */

export interface SkyPage { object: DeepSkyObject; image: DeepSkyImage; place: DeepSkyPlacement }

export const SKY_INDEX_PATH = '/deep-sky';
export const SKY_PAGES: SkyPage[] = DEEP_SKY_PLACED;
export const skyPage = (slug: string): SkyPage | null => SKY_PAGES.find(p => p.object.id === slug) ?? null;
export const skyPath = (id: string) => `${SKY_INDEX_PATH}/${id}`;

export const REALMS: { id: DeepSkyRealm; label: string }[] = [
  { id: 'milky-way', label: msg('In the Milky Way') },
  { id: 'local-group', label: msg('Our neighbour galaxies') },
  { id: 'beyond', label: msg('Far beyond') },
];

export const KIND: Record<DeepSkyKind, string> = {
  nebula: msg('Nebula'), remnant: msg('Supernova remnant'), cluster: msg('Star cluster'),
  galaxy: msg('Galaxy'), 'black-hole': msg('Black hole'), 'deep-field': msg('Deep field'),
};

/** Most famous first, the page's own object left out. */
export function realmPages(realm: DeepSkyRealm, except?: string): SkyPage[] {
  return SKY_PAGES.filter(p => p.object.realm === realm && p.object.id !== except).sort((a, b) => b.object.rank - a.object.rank);
}

/** What it is: its own note, or for a Local Group galaxy the note of the galaxy it joins. */
export const skyNote = (p: SkyPage): string => p.object.note || (p.object.feature ? DEEP_FEATURES[p.object.feature]?.note ?? '' : '');

export interface Telescope { name: string; craft?: string }

/** Who took the picture, from the archive it came from; Webb's and Hubble's have their own pages. */
export function telescope(image: DeepSkyImage): Telescope {
  if (/EHT|Event Horizon/i.test(image.credit)) return { name: 'Event Horizon Telescope' };
  const host = new URL(image.page).hostname;
  if (host.includes('esawebb')) return { name: 'James Webb Space Telescope', craft: 'james-webb-space-telescope' };
  if (host.includes('esahubble')) return { name: 'Hubble Space Telescope', craft: 'hubble-space-telescope' };
  if (host.includes('eso.org')) return { name: msg('European Southern Observatory') };
  if (host.includes('noirlab')) return { name: 'NOIRLab' };
  return { name: msg('Digitized Sky Survey') };
}

/** "5,700 light-years", "2.5 million light-years". */
export function lightYearsText(t: Translate, ly: number): string {
  return ly < 1e6
    ? t('{n} light-years', { n: ly.toLocaleString(t.intl, { maximumFractionDigits: ly < 10 ? 2 : 0 }) })
    : t('{amount} light-years', { amount: compact(ly, t.intl, 1) });
}

/** How wide the picture is where it hangs; a black hole's in kilometres. */
export function spanText(t: Translate, p: SkyPage): string {
  if (p.object.kind === 'black-hole') return t('{amount} km', { amount: compact(p.place.widthKm, t.intl) });
  const ly = p.place.widthKm / LY_KM;
  return t('about {n} ly', { n: +ly.toPrecision(2) });
}

export function skyTitle(t: Translate, p: SkyPage): string {
  const name = t(p.object.name);
  return fit([t('{name}: where it is and how far, in 3D', { name }), t('{name}: how far it is, in 3D', { name }), name], titleMax(t));
}

/** The object's own first sentence leads; the tail says how far it is and what the page holds. */
export function skyDescription(t: Translate, p: SkyPage, wikiLead: string | null): string {
  const max = descriptionMax(t);
  const name = t(p.object.name);
  const distance = lightYearsText(t, p.object.ly);
  const long = t('{distance} from the Sun, in a telescope picture hung where it really is, in 3D.', { distance });
  const short = t('{distance} from the Sun; see it in 3D.', { distance });
  const text = skyNote(p) ? t(skyNote(p)) : wikiLead ?? '';
  const first = text.match(/^.+?[.!?。！？](?=\s|$)/u)?.[0] ?? '';
  const candidates = [first && `${first} ${long}`, first && `${first} ${short}`, `${name}: ${long}`, `${name}: ${short}`].filter(Boolean);
  return candidates.find(d => [...d].length <= max) ?? leadSentences(candidates[candidates.length - 1], max);
}

export const skyIndexTitle = (t: Translate) => fit([t('Nebulae and galaxies in 3D: Pillars of Creation, Andromeda'), t('Nebulae and galaxies in 3D')], titleMax(t));

export const skyIndexDescription = (t: Translate) => t('The Pillars of Creation, the Orion and Crab nebulae, Andromeda and {n} more in Webb and Hubble pictures, each placed where it really is, in 3D.', { n: SKY_PAGES.length - 4 });
