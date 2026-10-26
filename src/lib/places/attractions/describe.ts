import { t } from '@/lib/core/i18n/active';
import { pop } from '@/lib/map/popups/kit';
import { groupOf, KIND_LABEL, wikiLink, type AttractionKind } from '@/lib/platform/site/places/topics/attractions-data';
import { GROUP_COLOR } from './map-layers';

type Props = Record<string, unknown>;

const kindOf = (p: Props) => (typeof p.k === 'string' && p.k in KIND_LABEL ? p.k as AttractionKind : 'landmark');
// GeoJSON properties come back from MapLibre as written, but a 1 may arrive as "1".
const heritage = (p: Props) => p.h === 1 || p.h === '1' || p.h === true;

export function attractionTip(p: Props): { key: string; name: string; meta: string } {
  return {
    key: `attraction:${p.id}`,
    name: String(p.name || t(KIND_LABEL[kindOf(p)])),
    meta: [t(KIND_LABEL[kindOf(p)]), heritage(p) && t('World Heritage')].filter(Boolean).join(' · '),
  };
}

export function attractionPopupHtml(p: Props): string {
  const kind = kindOf(p);
  const id = String(p.id ?? '');
  const links = Number(p.l);
  return pop({
    kicker: t(KIND_LABEL[kind]),
    dot: GROUP_COLOR[groupOf(kind)],
    title: String(p.name || t(KIND_LABEL[kind])),
    subtitle: heritage(p) ? t('On UNESCO’s World Heritage List') : undefined,
    rows: [{ label: t('Wikipedias'), value: Number.isFinite(links) ? links : undefined, mono: true }],
    note: t('From Wikidata: the best known first, by how many Wikipedias write about it. Opening hours and tickets are in its article.'),
    links: [
      /^Q\d+$/.test(id) && !!p.wl && { href: wikiLink(id, String(p.wl)), label: 'Wikipedia' },
      /^Q\d+$/.test(id) && { href: `https://www.wikidata.org/wiki/${id}`, label: 'Wikidata' },
    ],
  });
}
