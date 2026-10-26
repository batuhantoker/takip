import { ArrowUpRight, ScanLine, Video } from 'lucide-react';
import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import { bearing, compassPoint, haversine } from '@/lib/core/geodesic';
import { localePath } from '@/lib/platform/site/locale-path';
import { mapHref } from '@/lib/platform/site/map-link';
import { crawlRel } from '@/lib/platform/site/meta';
import { count, countryName, dayOf, nameOf, shortHeading } from '@/lib/platform/site/places/copy/format';
import { compass } from '@/lib/platform/site/places/copy/weather-words';
import { placeById, type Place } from '@/lib/platform/site/places/gazetteer';
import { findPlacePage, placeIndexed } from '@/lib/platform/site/places/pages';
import { placePath } from '@/lib/platform/site/places/paths';
import type { AlprData } from '@/lib/platform/site/places/topics/alpr';
import type { AlprPick } from '@/lib/platform/site/places/topics/alpr-data';
import type { CamerasData } from '@/lib/platform/site/places/topics/cameras';
import { Notes } from '../parts/notes';
import { LinkCard } from '../parts/place-links';
import { CameraStrip } from './cameras-body';
import type { TopicView } from './view';

/** Close enough that the reader's view cone shows (from zoom 13). */
const readerPath = (at: [number, number]) => mapHref({ layers: ['alpr'], view: { lat: at[1], lon: at[0], zoom: 17 } });

const facing = (dirs: number[]) => dirs.map(d => `${d}° ${compassPoint(d)}`).join(', ');

function rankLabel(place: Place, t: Translate): string | null {
  if (place.kind === 'city') return t('Among cities in {country}', { country: countryName(place.cc, t) });
  if (place.kind === 'town') return t('Among US towns');
  if (place.kind === 'county') return t('Among US counties');
  if (place.kind === 'state') return t('Among US states');
  return null;
}

function areasTitle(place: Place, t: Translate): string {
  if (place.kind === 'country') return t('By state');
  if (place.kind === 'state') return t('By county');
  return t('By town');
}

function Tally({ rows, t }: { rows: [string, number][]; t: Translate }) {
  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface-1">
      {rows.map(([name, n]) => (
        <li key={name} className="flex items-baseline justify-between gap-6 px-4 py-3 text-[14px]">
          <span className="font-medium text-ink-1">{name}</span>
          <span className="font-mono tabular-nums text-ink-2">{count(n, t)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Where a reader stands, from the centre of a city or town; a county's or state's centre says nothing. */
function Reader({ pick, t, from }: { pick: AlprPick; t: Translate; from?: [number, number] }) {
  const where = from && t('{km, distance} {dir} of the centre', { km: haversine(from, pick.at), dir: compass(bearing(from, pick.at), t) });
  const meta = [where, pick.op ? pick.maker : undefined, pick.dirs?.length ? t('facing {facing}', { facing: facing(pick.dirs) }) : t('direction not mapped')].filter(Boolean).join(' · ');
  return (
    <li>
      <a href={readerPath(pick.at)} className={cx('group flex items-center gap-3 rounded-card border border-line bg-surface-1 px-3 py-2.5 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink-1">{pick.op ?? pick.maker ?? t('Licence-plate reader')}</span>
          <span className="block truncate text-[12px] text-ink-3">{meta}</span>
        </span>
        <ArrowUpRight className="size-4 flex-shrink-0 text-ink-3 group-hover:text-ink-1" aria-hidden />
      </a>
    </li>
  );
}

export const ALPR_VIEW: TopicView<AlprData> = {
  icon: ScanLine,
  nearbySummary: true,

  // The figures a search for a place's Flock cameras asks for, on the first screen.
  Lead({ text: { t }, place, page: { data: { row } } }) {
    const rank = rankLabel(place, t);
    const share = (n: number) => `${Math.round((n / row.n) * 100)}%`;
    const stats: [string, string][] = [
      [t('Mapped'), count(row.n, t)],
      [t('By Flock Safety'), share(row.flock)],
      [t('Direction mapped'), share(row.dir)],
      ...(rank && row.of > 1 ? [[rank, t('{rank} of {of}', { rank: count(row.rank, t), of: count(row.of, t) })] as [string, string]] : []),
    ];
    return (
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-surface-1 px-4 py-3">
            <dt className="text-[12px] text-ink-3">{label}</dt>
            <dd className="mt-1 font-mono text-[18px] tabular-nums text-ink-1">{value}</dd>
          </div>
        ))}
      </dl>
    );
  },

  Body({ text, place, page: { data: { row, asOf } } }) {
    const { t } = text;
    const local = place.kind === 'city' || place.kind === 'town';
    const areas = (row.areas ?? []).flatMap(([id, n]) => {
      const p = placeById(id);
      return p ? [{ p, n }] : [];
    });
    const notes = [
      t('Counted from OpenStreetMap as DeFlock published it on {day}. Volunteers map readers as they find them, so some are missing and a few may already be gone.', { day: dayOf(asOf, t) }),
      ...(row.r ? [t('{city} has no Census boundary here, so each reader nearby is counted once, for the town it is nearest, allowing for each town’s size: within {km, radius} of the centre for {city}.', { km: row.r, city: nameOf(place, t) })] : []),
      ...(row.bound === 'cdp' ? [t('{place} is unincorporated: counted inside the area the Census Bureau draws for it.', { place: nameOf(place, t) })] : []),
      ...(row.bound === 'limits' || place.kind === 'county' || place.kind === 'state' ? [t('Counted inside the Census Bureau’s 2024 boundary for {place}.', { place: nameOf(place, t) })] : []),
      t('{n, plural, one {One reader has} other {# readers have}} an operator mapped; the rest are run by someone OpenStreetMap doesn’t name.', { n: row.opN }),
      t('The cone on the map shows the mapped direction; its width and reach are typical for these cameras, not measured.'),
    ];
    return (
      <>
        {row.ops.length > 0 && (
          <Section title={t('Who runs them')}>
            <Tally rows={row.ops.slice(0, 12)} t={t} />
          </Section>
        )}

        {row.makers.length > 0 && (
          <Section title={t('Who makes them')}>
            <Tally rows={row.makers.slice(0, 8)} t={t} />
          </Section>
        )}

        {areas.length > 0 && (
          <Section title={areasTitle(place, t)}>
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {areas.map(({ p, n }) => (
                <li key={p.id} className="flex items-baseline justify-between gap-4 text-[14px]">
                  <Link href={localePath(t.locale, placePath(p, 'flock-cameras'))} rel={crawlRel(placeIndexed(p, 'flock-cameras'))} className={TEXT_LINK}>{nameOf(p, t)}</Link>
                  <span className="font-mono tabular-nums text-ink-3">{count(n, t)}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {row.picks && row.picks.length > 0 && (
          <Section title={local ? t('The readers nearest the centre') : t('The latest added to the map')}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {row.picks.map(p => <Reader key={p.id} pick={p} t={t} from={local ? place.at : undefined} />)}
            </ul>
          </Section>
        )}

        <Notes text={text} notes={notes} layers={['plate-readers', 'live-cameras']} />
      </>
    );
  },

  // Readers of plate readers often want the place's public cameras too: they're the map's most opened layer.
  Aside({ text: { t }, place }) {
    const cams = findPlacePage(place, 'cameras');
    if (!cams) return null;
    const data = cams.page.data as CamerasData;
    if (data.frames.length) return <CameraStrip t={t} place={place} data={data} slug={cams.page.slug} />;
    if (!data.onAir) return null;
    return (
      <Section title={t('Public cameras')}>
        <LinkCard href={localePath(t.locale, placePath(place, cams.page.slug))} rel={crawlRel(placeIndexed(place, cams.page.slug))} title={shortHeading(cams.topic.header(place, cams.page, t).heading, place, t)}
          line={cams.topic.summary(place, cams.page, t)} Icon={Video} />
      </Section>
    );
  },
};
