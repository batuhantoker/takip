'use client';

import { useMemo } from 'react';
import { buildThreads, type DigestReport } from '@/lib/intel/alerts/digest';
import type { StoryAlert } from '@/lib/intel/alerts/gdelt-alerts';
import {
  rec, str, toNews, toQuake, toWarning, type LiveAlertsData, type NewsAlert, type QuakeAlert, type WarningAlert,
} from '@/lib/intel/alerts/live-alerts';

/** The overview reads GDELT's best-reported stories beside the channels, not all 600. */
const OVERVIEW_STORIES = 40;
const OVERVIEW_MIN_OUTLETS = 3;

/** `stories` are GDELT's, as the reader narrowed them: threads and the overview read them with the reports. */
export function useAlertItems(data: LiveAlertsData, stories: StoryAlert[] = []) {
  const news = useMemo(
    () => (data.news ?? []).map(toNews).filter((n): n is NewsAlert => n !== null).sort((a, b) => b.ts - a.ts),
    [data.news],
  );
  const quakes = useMemo(
    () => (data.earthquakes ?? []).map(toQuake).filter((q): q is QuakeAlert => q !== null).sort((a, b) => b.ts - a.ts).slice(0, 15),
    [data.earthquakes],
  );
  /* Official warnings, gravest first and then newest: a tornado warning
     outranks a coastal flood statement however recently either was issued. */
  const warnings = useMemo(() => {
    const rank = { high: 0, medium: 1, low: 2 };
    return (data.weather_events ?? [])
      .map(toWarning)
      .filter((w): w is WarningAlert => w !== null)
      .sort((a, b) => rank[a.severity] - rank[b.severity] || b.ts - a.ts);
  }, [data.weather_events]);

  const digestReports = useMemo<DigestReport[]>(() => news.map(n => ({
    id: n.id,
    title: n.title,
    text: n.text.slice(0, 600),
    source: n.source,
    source_name: n.source_name,
    bloc: n.bloc,
    published: n.published,
    link: n.link,
    flag: n.flag,
    views: n.views,
    also_reported_by: n.carriers.map(c => ({ source: c.source, source_name: c.source_name, bloc: c.bloc })),
  })), [news]);

  // GDELT reads thousands of outlets at once, so its stories count as an independent aggregator's.
  const storyReports = useMemo<DigestReport[]>(() => stories.map(s => ({
    id: s.id,
    title: s.title,
    text: [s.actors.join(' → '), s.action, s.place].filter(Boolean).join(' · '),
    source: 'gdelt',
    source_name: `GDELT, ${s.outlets} outlets`,
    bloc: 'independent',
    published: new Date(s.ts).toISOString(),
    link: s.link,
    flag: null,
    views: null,
  })), [stories]);

  const threads = useMemo(() => buildThreads([...digestReports, ...storyReports], 8), [digestReports, storyReports]);

  const bestStories = useMemo(() => new Set([...stories].filter(s => s.outlets >= OVERVIEW_MIN_OUTLETS)
    .sort((a, b) => b.reports - a.reports).slice(0, OVERVIEW_STORIES).map(s => s.id)), [stories]);

  // Only what the overview reads — not the whole dashboard state.
  const overviewPayload = useMemo(() => ({
    // The brief reads the newest 200; sending more only makes the request heavier.
    news: [
      ...digestReports.slice(0, 200),
      ...storyReports.filter(r => bestStories.has(r.id)),
    ],
    earthquakes: quakes.map(q => ({ magnitude: q.magnitude, place: q.place, time: q.ts, tsunami: q.tsunami ? 1 : 0, url: q.url })),
    weather_events: (data.weather_events ?? []).slice(0, 100).map(w => ({ type: str(rec(w).type), severity: str(rec(w).severity) })),
  }), [digestReports, storyReports, bestStories, quakes, data.weather_events]);
  return { news, quakes, warnings, threads, overviewPayload };
}
