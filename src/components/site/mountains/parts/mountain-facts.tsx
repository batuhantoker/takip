import Link from 'next/link';
import type { ReactNode } from 'react';
import { TEXT_LINK } from '@/components/site/pages/site-parts';
import { localePath } from '@/lib/platform/site/locale-path';
import { crawlRel } from '@/lib/platform/site/meta';
import { ascentText, countryName, feetFirst, heightText, kindLabel, placeLabel, topsOf } from '@/lib/platform/site/mountains/copy';
import { nameIn } from '@/lib/platform/site/mountains/data';
import { mountainPath, type MountainPage } from '@/lib/platform/site/mountains/mountain-page';
import { mountainsPath } from '@/lib/platform/site/mountains/sitemap';
import type { SiteText } from '@/lib/platform/site/text';

type Row = { label: string; value: ReactNode };

/** What Wikidata records of the mountain, a row each, the label beside its value (above it on a phone). */
export function MountainFacts({ text, page, coords }: { text: SiteText; page: MountainPage; coords: string }) {
  const { t } = text;
  const m = page.mountain;
  const feet = feetFirst(m);
  const rows: Row[] = [{ label: t('What it is'), value: kindLabel(t, m) }];
  if (m.elev !== null) rows.push({ label: t('Height above sea level'), value: heightText(t, m.elev, feet) });
  if (m.prom !== null) rows.push({ label: t('Prominence'), value: heightText(t, m.prom, feet) });
  if (m.isol !== null) rows.push({ label: t('Isolation'), value: t('{km, distance} to higher ground', { km: m.isol }) });
  const range = m.range !== null ? placeLabel(t, page.places.get(m.range)) : null;
  if (range) rows.push({ label: t('mountain|Range'), value: range });
  const parent = page.parent
    ? <Link href={localePath(t.locale, mountainPath(page.parent.slug))} rel={crawlRel(page.parent.indexed)} className={TEXT_LINK}>{nameIn(page.parent.names, t.locale)}</Link>
    : m.parent !== null ? placeLabel(t, page.places.get(m.parent)) : null;
  if (parent) rows.push({ label: t('Parent peak'), value: parent });
  if (m.cc.length) {
    rows.push({
      label: m.cc.length > 1 ? t('Countries') : t('Country'),
      value: m.cc.map((cc, i) => (
        <span key={cc}>{i > 0 && ', '}<Link href={localePath(t.locale, mountainsPath(cc))} className={TEXT_LINK}>{countryName(t, cc)}</Link></span>
      )),
    });
  }
  if (m.ascent) rows.push({ label: t('First ascent'), value: ascentText(t, m.ascent) });
  const tops = topsOf(t, m, page.places);
  if (tops.length) rows.push({ label: t('Highest point of'), value: new Intl.ListFormat(t.intl, { type: 'conjunction' }).format(tops) });
  rows.push({ label: t('Coordinates'), value: <span className="font-mono tabular-nums">{coords}</span> });
  if (m.gvp) {
    rows.push({ label: t('Volcano number'), value: <a href={`https://volcano.si.edu/volcano.cfm?vn=${encodeURIComponent(m.gvp)}`} rel="noopener" className={TEXT_LINK}>{t('{n} at the Global Volcanism Program', { n: m.gvp })}</a> });
  }
  rows.push({ label: t('Source'), value: <a href={`https://www.wikidata.org/wiki/Q${m.qid}`} rel="noopener" className={TEXT_LINK}>{t('Wikidata, CC0')}</a> });
  return (
    <dl className="divide-y divide-line rounded-card border border-line bg-surface-1">
      {rows.map(r => (
        <div key={r.label} className="flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:gap-6">
          <dt className="text-[13px] text-ink-3 sm:w-44 sm:flex-shrink-0">{r.label}</dt>
          <dd className="text-[14px] leading-relaxed text-ink-1 [overflow-wrap:anywhere]">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
