import type { Translate } from '@/lib/core/i18n/translator';
import { countryName, feetFirst, heightText, kindLabel } from './copy';
import { nameIn } from './data';
import { highestInCountry, highestOnEarth, mountainBySlug } from './store';

/** A mountain page's share card: its kind and country, its name and height, its place marked on the world sketch. */
export function mountainCard(slug: string, t: Translate) {
  const found = mountainBySlug(slug);
  if (!found || 'redirect' in found) return null;
  const m = found.mountain;
  return {
    kicker: [kindLabel(t, m), ...m.cc.map(cc => countryName(t, cc))].join(' · '),
    title: nameIn(m.names, t.locale) ?? slug,
    subtitle: m.elev !== null ? heightText(t, m.elev, feetFirst(m)) : '',
    focus: { lat: m.lat, lon: m.lon },
  };
}

/** A list's share card (`/og?mountains=world`, `=TR`): its heading over the world sketch, its highest marked. */
export function mountainsCard(param: string, t: Translate) {
  const cc = param === 'world' ? null : param;
  const top = cc ? highestInCountry(cc, 1)[0] : highestOnEarth(1)[0];
  if (!top) return null;
  const name = nameIn(top.names, t.locale) ?? top.slug;
  return {
    kicker: 'TAKIP',
    title: cc ? t('Highest mountains in {country}', { country: countryName(t, cc) }) : t('The world’s highest mountains'),
    subtitle: top.elev !== null ? `${name} · ${heightText(t, top.elev, feetFirst(top))}` : name,
    focus: { lat: top.lat, lon: top.lon },
  };
}
