import { ArrowUpRight, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Section, TEXT_LINK } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import { bearing, compassPoint, haversine } from '@/lib/core/geodesic';
import { localePath } from '@/lib/platform/site/locale-path';
import { mapHref } from '@/lib/platform/site/map-link';
import { crawlRel } from '@/lib/platform/site/meta';
import { count, countryName, dayOf, nameOf, placeName, shortHeading } from '@/lib/platform/site/places/copy/format';
import { compass } from '@/lib/platform/site/places/copy/weather-words';
import { placeById, placeLabel, regionLabel, type Place } from '@/lib/platform/site/places/gazetteer';
import { findPlacePage, placeIndexed } from '@/lib/platform/site/places/pages';
import { placePath, placeZoom } from '@/lib/platform/site/places/paths';
import type { AlprData } from '@/lib/platform/site/places/topics/alpr';
import type { AlprPick } from '@/lib/platform/site/places/topics/alpr-data';
import type { CamerasData } from '@/lib/platform/site/places/topics/cameras';
import { Notes } from '../parts/notes';
import { LinkCard } from '../parts/place-links';
import { CameraStrip } from './cameras-body';
import type { TopicView } from './view';

/** Close enough that the reader's view cone shows (from zoom 13). */
const READER_ZOOM = 17;
const readerPath = (at: [number, number]) => mapHref({ layers: ['alpr'], view: { lat: at[1], lon: at[0], zoom: READER_ZOOM } });

const facing = (dirs: number[]) => dirs.map(d => `${d}° ${compassPoint(d)}`).join(', ');

const PER_PERSON_POP = 10_000;

/** Readers per 100,000 people, to a tenth below ten. */
function per100k(n: number, pop: number, t: Translate): string {
  const v = (n / pop) * 1e5;
  return new Intl.NumberFormat(t.intl, { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v);
}

/** What the page's live map reads off a row to mark it (components/site/pages/map-talk.ts). */
const mapRow = (id: string, at: [number, number], label: string) => ({ 'data-map': `${at[0]},${at[1]}`, 'data-map-id': id, 'data-map-label': label });

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

/** A place in a list on `on`'s page, a town named with its state where the page spans several. */
function listName(p: Place, on: Place, t: Translate): string {
  if (on.kind !== 'country' || p.kind === 'state') return nameOf(p, t);
  const region = regionLabel(p, t.locale);
  return region ? `${placeLabel(p, t.locale)}, ${region}` : placeName(p, t);
}

const resolve = (rows: [number, number][] | undefined) => (rows ?? []).flatMap(([id, n]) => {
  const p = placeById(id);
  return p ? [{ p, n }] : [];
});

const pageLink = (p: Place, t: Translate) => ({ href: localePath(t.locale, placePath(p, 'flock-cameras')), rel: crawlRel(placeIndexed(p, 'flock-cameras')) });

function Tally({ rows, t }: { rows: [string, number][]; t: Translate }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rows.map(([name, n]) => (
        <li key={name} className="flex items-baseline justify-between gap-6 py-3 text-[14px]">
          <span className="font-medium text-ink-1">{name}</span>
          <span className="font-mono tabular-nums text-ink-2">{count(n, t)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Places inside this one with their readers; `marked` rows light their place on the live map beside. */
function PlaceCounts({ items, on, t, marked }: { items: { p: Place; n: number }[]; on: Place; t: Translate; marked?: boolean }) {
  return (
    <ul className={cx('grid gap-x-6 gap-y-2 sm:grid-cols-2', on.kind !== 'country' && 'lg:grid-cols-3')}>
      {items.map(({ p, n }) => (
        <li key={p.id} className="flex items-baseline justify-between gap-4 text-[14px]" {...(marked ? mapRow(`city:${p.id}`, p.at, nameOf(p, t)) : {})}>
          <Link {...pageLink(p, t)} className={TEXT_LINK}>{listName(p, on, t)}</Link>
          <span className="font-mono tabular-nums text-ink-3">{count(n, t)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Where a reader stands: from the centre of a city or town, else the town or county it is counted in. */
function Reader({ pick, on, t }: { pick: AlprPick; on: Place; t: Translate }) {
  const local = on.kind === 'city' || on.kind === 'town';
  const area = !local && pick.within ? placeById(pick.within) : undefined;
  const who = pick.op ?? pick.maker ?? t('Licence-plate reader');
  const where = local
    ? t('{km, distance} {dir} of the centre', { km: haversine(on.at, pick.at), dir: compass(bearing(on.at, pick.at), t) })
    : area && listName(area, on, t);
  const aim = pick.dirs?.length ? t('facing {facing}', { facing: facing(pick.dirs) }) : t('direction not mapped');
  // Away from a centre the place says more than a maker repeated down the list.
  const title = !local && where ? where : who;
  const maker = pick.op ? pick.maker : undefined;
  const meta = [...(local ? [where, maker] : where ? [who, maker] : [maker]), aim].filter(Boolean).join(' · ');
  return (
    <li>
      <a href={readerPath(pick.at)} data-map-jump={READER_ZOOM} {...mapRow(`reader:${pick.id}`, pick.at, who)}
        className={cx('group flex items-center gap-3 rounded-card border border-line bg-surface-1 px-3 py-2.5 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-ink-1">{title}</span>
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
  mapBeside: true,

  // The figures a search for a place's Flock cameras asks for, on the first screen.
  Lead({ text: { t }, place, page: { data: { row } } }) {
    const rank = rankLabel(place, t);
    const share = (n: number) => `${Math.round((n / row.n) * 100)}%`;
    // Counted around a city rather than inside its limits, the readers are its suburbs' too; in a hamlet one reader
    // makes thousands per 100,000. Neither gets a per-resident figure.
    const more: [string, string][] = [
      ...(!row.r && place.pop >= PER_PERSON_POP ? [[t('Per 100,000 people'), per100k(row.n, place.pop, t)] as [string, string]] : []),
      ...(rank && row.of > 1 ? [[rank, t('{rank} of {of}', { rank: count(row.rank, t), of: count(row.of, t) })] as [string, string]] : []),
      [t('Direction mapped'), share(row.dir)],
    ];
    const stats: [string, string][] = [[t('Mapped'), count(row.n, t)], [t('By Flock Safety'), share(row.flock)], ...more.slice(0, 2)];
    const near = mapHref({ layers: ['alpr'], near: 12, view: { lat: place.at[1], lon: place.at[0], zoom: placeZoom(place) } });
    return (
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line">
          {stats.map(([label, value]) => (
            <div key={label} className="bg-surface-1 px-4 py-3">
              <dt className="text-[12px] text-ink-3">{label}</dt>
              <dd className="mt-1 font-mono text-[18px] tabular-nums text-ink-1">{value}</dd>
            </div>
          ))}
        </dl>
        <a href={near} className={cx(TEXT_LINK, 'self-start text-[14px]')}>{t('See the ones near you on the live map')}</a>
      </div>
    );
  },

  Body({ text, place, page: { data: { row, asOf } } }) {
    const { t } = text;
    const areas = resolve(row.areas);
    const cities = resolve(row.cities);
    const dense = resolve(row.dense).filter(({ p }) => p.pop > 0);
    const notes = [
      t('Counted from OpenStreetMap as DeFlock published it on {day}. Volunteers map readers as they find them, so some are missing and a few may already be gone.', { day: dayOf(asOf, t) }),
      ...(row.r ? [t('{city} has no Census boundary here, so each reader nearby is counted once, for the town it is nearest, allowing for each town’s size: within {km, radius} of the centre for {city}.', { km: row.r, city: nameOf(place, t) })] : []),
      ...(row.bound === 'cdp' ? [t('{place} is unincorporated: counted inside the area the Census Bureau draws for it.', { place: nameOf(place, t) })] : []),
      ...(row.bound === 'limits' || place.kind === 'county' || place.kind === 'state' ? [t('Counted inside the Census Bureau’s 2024 boundary for {place}.', { place: nameOf(place, t) })] : []),
      ...(!row.r && (place.pop >= PER_PERSON_POP || row.dense?.length) ? [t('Per 100,000 people uses each place’s latest population estimate.')] : []),
      t('{n, plural, one {One reader has} other {# readers have}} an operator mapped; the rest are run by someone OpenStreetMap doesn’t name.', { n: row.opN }),
      t('The cone on the map shows the mapped direction; its width and reach are typical for these cameras, not measured.'),
    ];
    return (
      <>
        {areas.length > 0 && (
          <Section title={areasTitle(place, t)}>
            <PlaceCounts items={areas} on={place} t={t} />
          </Section>
        )}

        {cities.length > 0 && (
          <Section title={t('The cities and towns with the most')}>
            <PlaceCounts items={cities} on={place} t={t} marked />
          </Section>
        )}

        {dense.length > 0 && (
          <Section title={t('The most per resident')}
            meta={place.kind === 'state' ? t('Readers per 100,000 people, in counties of 50,000 or more') : t('Readers per 100,000 people')}>
            <ol className="divide-y divide-line border-y border-line">
              {dense.map(({ p, n }, i) => (
                <li key={p.id} className="flex items-baseline gap-4 py-3 text-[14px]">
                  <span className="w-5 font-mono tabular-nums text-ink-3">{i + 1}</span>
                  <Link {...pageLink(p, t)} className={cx(TEXT_LINK, 'flex-1 font-medium')}>{nameOf(p, t)}</Link>
                  <span className="text-[12px] text-ink-3">{t('{n, plural, one {One reader} other {# readers}}', { n })}</span>
                  <span className="w-14 text-right font-mono tabular-nums text-ink-1">{per100k(n, p.pop, t)}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

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

        {row.picks && row.picks.length > 0 && (
          <Section title={place.kind === 'city' || place.kind === 'town' ? t('The readers nearest the centre') : t('The latest added to the map')}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {row.picks.map(p => <Reader key={p.id} pick={p} on={place} t={t} />)}
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
          line={cams.topic.summary(place, cams.page, t)} />
      </Section>
    );
  },
};
