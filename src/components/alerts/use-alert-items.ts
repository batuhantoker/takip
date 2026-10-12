'use client';

import { useMemo } from 'react';
import { buildThreads, type DigestReport } from '@/lib/alert-digest';
import {
  rec, str, toNews, toQuake, toWarning, type LiveAlertsData, type NewsAlert, type QuakeAlert, type WarningAlert,
} from '@/lib/live-alerts';

export function useAlertItems(data: LiveAlertsData) {
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

  const threads = useMemo(() => buildThreads(digestReports, 8), [digestReports]);

  // Only what the overview reads — not the whole dashboard state.
  const overviewPayload = useMemo(() => ({
    news: digestReports,
    earthquakes: quakes.map(q => ({ magnitude: q.magnitude, place: q.place, time: q.ts, tsunami: q.tsunami ? 1 : 0, url: q.url })),
    weather_events: (data.weather_events ?? []).slice(0, 100).map(w => ({ type: str(rec(w).type), severity: str(rec(w).severity) })),
  }), [digestReports, quakes, data.weather_events]);
  return { news, quakes, warnings, threads, overviewPayload };
}
