'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CRAWLER_KIND_LABEL } from '@takip/core/crawlers';
import { ChartCard, Legend } from '@/components/site/admin/charts/chart-card';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { WorldDots } from '@/components/site/admin/charts/world-dots';
import { Muted, when } from '@/components/site/admin/parts/admin-parts';
import { shortVisitor } from '@/components/site/admin/tables/visitors-table';
import type { AnalyticsLive } from './analytics-types';
import { kindColor } from './crawlers-section';
import { actionLabel } from './lib/actions';
import { featureLabel, splitFeature } from './lib/features';
import { count, plural } from './lib/format';
import { deviceLabel, originLabel, pathLabel, since, STEP_INK } from './lib/journeys';
import { NEUTRAL } from './lib/series';
import { useAnalyticsData } from './lib/use-analytics-data';
import { placeShort } from './lib/place';
import { DbIpCredit, PlaceLabel } from './parts/place-label';
import { SectionFrame, Tiles } from './parts/section-frame';

const REFRESH_MS = 10_000;
const MAX_LAYERS = 5;

type Person = AnalyticsLive['people'][number];
type Crawler = AnalyticsLive['crawlers'][number];
const SMALL_MAP = 'view:embed';

const KIND = { map: { label: 'On the map', color: STEP_INK.map }, page: { label: 'Reading a page', color: STEP_INK.page } } as const;

/** Who is on the site now, refreshed every 10 seconds while this tab is open. */
export function LiveSection({ hideAdmins }: { hideAdmins: boolean }) {
  const [round, setRound] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setRound(n => n + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  const query = useAnalyticsData<AnalyticsLive>(`/analytics/live?n=${round}${hideAdmins ? '&admins=exclude' : ''}`);
  return (
    <>
      <p className="text-[12px] text-ink-3">
        Who is on the site right now: on the map (its once-a-minute tick came in the last 2½ minutes), or on a public page they opened or whose small map
        they used in the last 5. Below them, the crawlers that made a request in the last 5 minutes, up to 10 seconds late. Refreshes every 10 seconds.
        Kept in the api&apos;s memory only, so a restart empties it.
      </p>
      <SectionFrame query={query}>{d => <Live people={d.people} crawlers={d.crawlers} />}</SectionFrame>
    </>
  );
}

function Live({ people, crawlers }: { people: Person[]; crawlers: Crawler[] }) {
  const onMap = people.filter(p => p.kind === 'map').length;
  const countries = new Set(people.map(p => p.place?.country).filter(Boolean)).size;

  // One dot per town; its colour says what everyone there is doing, neutral when it's a mix.
  const towns = new Map<string, { latitude: number; longitude: number; people: Person[] }>();
  for (const p of people) {
    const { latitude, longitude } = p.place ?? {};
    if (latitude == null || longitude == null) continue;
    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const town = towns.get(key) ?? { latitude, longitude, people: [] };
    town.people.push(p);
    towns.set(key, town);
  }
  const points = [...towns.values()].map(t => {
    const kinds = new Set(t.people.map(p => p.kind));
    return {
      latitude: t.latitude, longitude: t.longitude, value: t.people.length, title: placeShort(t.people[0].place),
      color: kinds.size === 1 ? KIND[t.people[0].kind].color : NEUTRAL,
    };
  });

  return (
    <>
      <Tiles>
        <StatTile label="Here now" value={count(people.length)} sub={`Browsers and accounts, ${plural(countries, 'country', 'countries')}`} />
        <StatTile label="On the map" value={count(onMap)} />
        <StatTile label="Reading a page" value={count(people.length - onMap)} />
        <StatTile label="Crawlers" value={count(crawlers.length)} sub={plural(crawlers.reduce((n, c) => n + c.hits, 0), 'request')} />
      </Tiles>
      <ChartCard title="Where they are" note="By the town their address points to; a dot holds everyone in one town">
        {points.length ? (
          <>
            <Legend items={[KIND.map, KIND.page, { label: 'Both', color: NEUTRAL }]} />
            <WorldDots label={`Where the ${count(people.length)} people here now are`} format={n => `${count(n)} here`} points={points} />
          </>
        ) : <Muted>{people.length ? 'Nobody here now could be placed.' : 'Nobody is on the site right now.'}</Muted>}
      </ChartCard>
      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface-1 p-4">
        <h2 className="text-[12px] font-medium text-ink-2">What they are doing</h2>
        {people.length
          ? <ul className="flex flex-col divide-y divide-line">{people.map(p => <PersonRow key={p.key} p={p} />)}</ul>
          : <Muted>Nobody is on the site right now.</Muted>}
        {people.some(p => p.place) && <DbIpCredit />}
      </section>
      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface-1 p-4">
        <h2 className="text-[12px] font-medium text-ink-2">Crawlers here now</h2>
        {crawlers.length
          ? <ul className="flex flex-col divide-y divide-line">{crawlers.map(c => <CrawlerRow key={c.bot} c={c} />)}</ul>
          : <Muted>No crawler has made a request in the last 5 minutes.</Muted>}
      </section>
    </>
  );
}

function CrawlerRow({ c }: { c: Crawler }) {
  return (
    <li className="grid gap-x-4 gap-y-1 py-2.5 text-[12px] md:grid-cols-[14rem_minmax(0,1fr)_12rem]">
      <span className="flex min-w-0 items-center gap-1.5 text-ink-1">
        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: kindColor(c.kind) }} />
        <span className="truncate">{c.bot}</span>
        <span className="shrink-0 text-[11px] text-ink-3">{CRAWLER_KIND_LABEL[c.kind]}</span>
      </span>
      <span className="truncate font-mono text-ink-1" title={c.path}>{c.path}</span>
      <span className="text-[11px] text-ink-3" title={`Since ${when(c.since)}; last request ${when(c.at)}`}>
        {plural(c.hits, 'request')}{c.hits > 1 && ` over ${since(c.since, c.at)}`} · last {since(c.at)} ago
      </span>
    </li>
  );
}

/** "Layers panel · Flights, Ships, Radar +3 · Camera window", from the map's last tick. */
function mapActivity(features: string[]) {
  const of = (kind: string) => features.filter(f => splitFeature(f).kind === kind);
  const view = of('view').map(featureLabel).filter(v => v !== 'Map');
  const panels = of('panel').filter(f => f !== 'panel:none').map(f => `${featureLabel(f)} panel`);
  const windows = of('window').map(f => `${featureLabel(f)} window`);
  const layers = of('layer').map(featureLabel);
  const shown = layers.length ? [`${layers.slice(0, MAX_LAYERS).join(', ')}${layers.length > MAX_LAYERS ? ` +${layers.length - MAX_LAYERS}` : ''}`] : [];
  const parts = [...view, ...panels, ...windows, ...shown];
  return parts.length ? parts.join(' · ') : 'Just opened it';
}

function PersonRow({ p }: { p: Person }) {
  const kind = KIND[p.kind];
  return (
    <li className="grid gap-x-4 gap-y-1 py-3 text-[12px] md:grid-cols-[10rem_minmax(0,1fr)_14rem]">
      <div className="flex flex-col">
        <span className="flex items-center gap-1.5 text-ink-1">
          <span aria-hidden className="size-2 rounded-full" style={{ background: kind.color }} />{kind.label}
        </span>
        <span className="text-[11px] text-ink-3" title={`Since ${when(p.since)}; last active ${when(p.at)}`}>
          here {since(p.since)} · active {since(p.at)} ago
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        {p.kind === 'page'
          ? <span className="truncate font-mono text-ink-1">{pathLabel(p.path)}</span>
          : <span className="text-ink-1">{mapActivity(p.features)}</span>}
        {p.kind === 'page' && p.features.includes(SMALL_MAP) && <span className="text-[11px] text-ink-2">Using its small map</span>}
        {p.actions.length > 0 && (
          <span className="text-[11px] text-ink-2" title="The latest actions on the map, newest first">
            Did: {p.actions.map(a => `${actionLabel(a.action)} (${since(a.at)} ago)`).join(' · ')}
          </span>
        )}
        <span className="text-[11px] text-ink-3">Came from {originLabel(p.referrer)}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <PlaceLabel place={p.place} short />
        {p.agent && <span className="text-[11px] text-ink-3">{deviceLabel(p.agent.device)} · {p.agent.os} · {p.agent.browser}</span>}
        <span className="flex min-w-0 items-center text-[11px]">
          <span className="truncate">
            {p.visitorId && (p.known
              ? <Link href={`/admin/visitors/${p.visitorId}`} className="font-mono text-ink-2 hover:underline" title={p.visitorId}>{shortVisitor(p.visitorId)}</Link>
              : <span className="font-mono text-ink-3" title={p.visitorId}>{shortVisitor(p.visitorId)}</span>)}
            {p.user && <>{p.visitorId && ' · '}<Link href={`/admin/users/${p.user.id}#activity`} className="text-ink-2 hover:underline">{p.user.email}</Link></>}
          </span>
          {p.admin && <span className="ml-1.5 shrink-0 rounded-[3px] border border-line px-1 text-[10px] uppercase tracking-wide text-ink-3">admin</span>}
        </span>
      </div>
    </li>
  );
}
