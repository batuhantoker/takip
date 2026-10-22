'use client';

import { useCallback, useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { loadCameraCatalog, mergeCameraCatalog } from '@/lib/feeds/cameras/camera-catalog';
import { newsTransform } from '@/lib/intel/alerts/news-transform';
import { noteFeed, noteFeedFailure } from '@/lib/core/feed-log';
import { createShipBook, type ShipReply, type ShipRow } from '@/lib/feeds/maritime/ship-delta';
import { SATELLITE_ELEMENTS_URL, satelliteData } from '@/lib/feeds/satellites/elements';
import { FLIGHTS_URL, flightData } from '@/lib/feeds/aviation/flight-lists';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import type { BackendStatus, LiveData } from './types';

// USGS and EMSC, merged server-side.
const EQ_URL = '/api/earthquakes';
const eqTransform = (data: { earthquakes?: unknown[] }) => ({ earthquakes: data.earthquakes ?? [] });
const weatherTransform = (d: { events?: unknown[] }) => ({ weather_events: d.events });
// GDELT's stories, pinned with the news: the Alerts panel's own request, so the pinned ids line up.
const STORIES_URL = '/api/gdelt-events?limit=600';
const storiesData = (d: { events?: unknown[] }) => ({ alert_stories: d.events ?? [] });
const radarData = (d: { outages?: unknown[]; attack_origins?: unknown[] }) => ({ cf_outages: d.outages ?? [], cf_attack_origins: d.attack_origins ?? [] });
const iodaData = (d: { outages?: unknown[] }) => ({ ioda_outages: d.outages ?? [] });

export function useLiveData({ dataRef, setDataVersion, setBackendStatus, setSpaceWeather, activeLayers, replayActive = false, panels = true }: {
  dataRef: RefObject<LiveData>;
  setDataVersion: Dispatch<SetStateAction<number>>;
  setBackendStatus: Dispatch<SetStateAction<BackendStatus>>;
  setSpaceWeather: Dispatch<SetStateAction<any>>;
  activeLayers: ActiveLayers;
  replayActive?: boolean;
  /** False for a map with no panels (the embed): no markets or space weather, and earthquakes, news and warnings only while their layer is on. */
  panels?: boolean;
}) {
  /* `skipWhenHidden` is for background polling only — skipping a *user-initiated*
     load (a layer toggle, or first paint in a background tab) leaves the caller
     believing it fetched, so the layer stays empty until a full reload.
     Returns whether data actually landed, so callers can retry. */
  const fetchEndpoint = useCallback(async (
    url: string,
    transform?: (d: any) => any,
    options?: RequestInit,
    { skipWhenHidden = false }: { skipWhenHidden?: boolean } = {},
  ): Promise<boolean> => {
    if (skipWhenHidden && typeof document !== 'undefined' && document.hidden) return false;
    try {
      // Live data skips the browser cache unless the caller asks otherwise.
      const res = await fetch(url, { cache: 'no-store', ...options });
      if (res.ok) {
        const json = await res.json();
        const d = transform ? transform(json) : json;
        noteFeed(url, Object.keys(d ?? {}), json);
        dataRef.current = { ...dataRef.current, ...d };
        setDataVersion(v => v + 1);
        setBackendStatus('connected');
        return true;
      }
      noteFeedFailure(url, `HTTP ${res.status}`);
      return false;
    } catch (e) {
      noteFeedFailure(url, e instanceof Error ? e.message : 'failed');
      console.warn('[TAKIP] Suppressed error:', e instanceof Error ? e.message : e);
      setBackendStatus('error');
      return false;
    }
  }, []);

  // ── PROGRESSIVE DATA LOADING (request-optimized) ──
  useEffect(() => {
    if (!panels) return;
    // Priority 1: Core feeds (always needed for panels)
    fetchEndpoint(EQ_URL, eqTransform);
    fetchEndpoint('/api/news', newsTransform);
    /* Official warnings — NOAA/NWS, GDACS, NASA EONET. A core feed rather than
       a layer fetch: Live Alerts lists them whether or not the weather layer
       is on, and this is the one thing in the panel a reader may have to act on. */
    fetchEndpoint('/api/weather', weatherTransform);
    layerFetchedRef.current.add('weather');
    /* A cold start can time out every upstream quote and return an all-empty
       feed. Waiting a full poll interval to find out leaves the panel blank for
       15 minutes, so retry a few times up-front until instruments actually land. */
    const marketRetries: ReturnType<typeof setTimeout>[] = [];
    const loadMarkets = async (attempt = 0) => {
      await fetchEndpoint('/api/markets', d => ({ markets: d }));
      if ((dataRef.current.markets?.count || 0) === 0 && attempt < 3) {
        marketRetries.push(setTimeout(() => loadMarkets(attempt + 1), 15000));
      }
    };
    const marketTimer = setTimeout(() => loadMarkets(), 800);

    // Priority 2: Space Weather (needed for MarketsPanel)
    const spaceTimer = setTimeout(async () => {
      try {
        const r = await fetch('/api/space-weather');
        if (r.ok) setSpaceWeather(await r.json());
      } catch (e) { console.warn('[TAKIP] Suppressed error:', e instanceof Error ? e.message : e); }
    }, 5000);

    // Polling — OPTIMIZED intervals to minimize edge requests
    const intervals = [
      setInterval(() => fetchEndpoint(EQ_URL, eqTransform, undefined, { skipWhenHidden: true }), 900000),  // 15 min (was 5)
      // 5 min: the route caches each channel for 3, so Telegram sees at most one read per channel per window however many tabs poll.
      setInterval(() => fetchEndpoint('/api/news', newsTransform, undefined, { skipWhenHidden: true }), 300000),
      // 5 min: a warning that has just been issued is the point of the panel.
      setInterval(() => fetchEndpoint('/api/weather', weatherTransform, undefined, { skipWhenHidden: true }), 300000),
      setInterval(() => fetchEndpoint('/api/markets', d => ({ markets: d }), undefined, { skipWhenHidden: true }), 900000), // 15 min (was 5)
    ];
    return () => {
      clearTimeout(marketTimer);
      marketRetries.forEach(clearTimeout);
      clearTimeout(spaceTimer);
      intervals.forEach(clearInterval);
    };
  }, [fetchEndpoint, panels]);

  // Without the panels, the core feeds above load only for the layers that draw them, at the same rates.
  const quakesOn = !panels && !!activeLayers.earthquakes;
  const newsOn = !panels && !!activeLayers.alert_pins;
  const warningsOn = !panels && !!activeLayers.weather;
  useEffect(() => {
    const feeds = [
      quakesOn && { url: EQ_URL, transform: eqTransform, every: 900_000 },
      newsOn && { url: '/api/news', transform: newsTransform, every: 300_000 },
      warningsOn && { url: '/api/weather', transform: weatherTransform, every: 300_000 },
    ].filter(f => !!f);
    // The layer loader below would fetch the warnings a second time.
    if (warningsOn) layerFetchedRef.current.add('weather');
    feeds.forEach(f => fetchEndpoint(f.url, f.transform));
    const intervals = feeds.map(f => setInterval(() => fetchEndpoint(f.url, f.transform, undefined, { skipWhenHidden: true }), f.every));
    return () => intervals.forEach(clearInterval);
  }, [quakesOn, newsOn, warningsOn, fetchEndpoint]);

  // ── LAYER-AWARE DATA LOADING — only fetch when layer is toggled ON ──
  const layerFetchedRef = useRef<Set<string>>(new Set());
  // Ships come whole once, then as the changes since the last reply (lib/feeds/maritime/ship-delta.ts).
  const shipBookRef = useRef(createShipBook<ShipRow>());
  const shipsFrom = useCallback((d: ShipReply & { ports?: unknown; chokepoints?: unknown }) => ({ maritime_ports: d.ports, maritime_chokepoints: d.chokepoints, maritime_ships: shipBookRef.current.apply(d) }), []);
  useEffect(() => {
    if (!activeLayers.cctv) return;
    return loadCameraCatalog(cameras => {
      dataRef.current = {
        ...dataRef.current,
        cameras: mergeCameraCatalog(dataRef.current.cameras ?? [], cameras),
      };
      setDataVersion(value => value + 1);
      setBackendStatus('connected');
    }, () => console.warn('[TAKIP] Camera catalogue load failed; bounded retry scheduled'));
  }, [activeLayers.cctv]);

  useEffect(() => {

    // Flights; GNSS interference is computed from the same aircraft
    if (activeLayers.flights || activeLayers.military || activeLayers.jets || activeLayers.private || activeLayers.gps_jamming) {
      if (!layerFetchedRef.current.has('flights')) {
        fetchEndpoint(FLIGHTS_URL, flightData);
        layerFetchedRef.current.add('flights');
      }
    }
    // Satellites (any satellite sub-layer triggers fetch)
    const anySatLayer = activeLayers.satellites || activeLayers.sat_comms || activeLayers.sat_military || activeLayers.sat_navigation || activeLayers.sat_earth || activeLayers.sat_science;
    if (anySatLayer && !layerFetchedRef.current.has('satellites')) {
      // Fetched once, with the element sets: use-satellite-motion moves the
      // markers from there and keeps the epoch the orbit route needs current.
      // In replay useReplaySatellites loads them, and a live answer racing it would win.
      // Revalidated: the sets change a few times a day, and an unchanged answer is a 304.
      if (!replayActive) fetchEndpoint(SATELLITE_ELEMENTS_URL, d => satelliteData(d), { cache: 'no-cache' });
      layerFetchedRef.current.add('satellites');
    }
    // Fires
    if (activeLayers.fires && !layerFetchedRef.current.has('fires')) {
      fetchEndpoint('/api/fires');
      layerFetchedRef.current.add('fires');
    }
    // Maritime
    if (activeLayers.maritime && !layerFetchedRef.current.has('maritime')) {
      fetchEndpoint(shipBookRef.current.url(), shipsFrom);
      layerFetchedRef.current.add('maritime');
    }
    // Balloons
    if (activeLayers.balloons && !layerFetchedRef.current.has('balloons')) {
      fetchEndpoint('/api/balloons', d => ({ balloons: d.balloons }));
      layerFetchedRef.current.add('balloons');
    }
    // Radiation
    if (activeLayers.radiation && !layerFetchedRef.current.has('radiation')) {
      fetchEndpoint('/api/radiation', d => ({ radiation: d.stations }));
      layerFetchedRef.current.add('radiation');
    }
    // Live News
    if (activeLayers.live_news && !layerFetchedRef.current.has('live_news')) {
      fetchEndpoint('/api/live-news', d => ({ live_feeds: d.feeds }));
      layerFetchedRef.current.add('live_news');
    }
    // Weather
    if (activeLayers.weather && !layerFetchedRef.current.has('weather')) {
      fetchEndpoint('/api/weather', d => ({ weather_events: d.events }));
      layerFetchedRef.current.add('weather');
    }
    // Infrastructure
    if (activeLayers.infrastructure && !layerFetchedRef.current.has('infrastructure')) {
      fetchEndpoint('/api/infrastructure', d => ({ infrastructure: d.infrastructure }));
      layerFetchedRef.current.add('infrastructure');
    }
    // Global Incidents (GDELT)
    if (activeLayers.global_incidents && !layerFetchedRef.current.has('gdelt')) {
      fetchEndpoint('/api/gdelt', d => ({ gdelt: d.events }));
      layerFetchedRef.current.add('gdelt');
    }

    // Submarine Cables
    if (activeLayers.cables && !layerFetchedRef.current.has('cables')) {
      (async () => {
        try {
          const res = await fetch('/data/submarine-cables.json');
          if (res.ok) {
             const cablesData = await res.json();
             dataRef.current = { ...dataRef.current, submarine_cables: cablesData.features };
             setDataVersion(v => v + 1);
          }
        } catch (e) { console.warn('Cables fetch failed'); }
      })();
      layerFetchedRef.current.add('cables');
    }


    // Live Malware (abuse.ch) is pushed, not fetched — see the SSE subscription below.

    // Botnet C2 infrastructure (abuse.ch Feodo Tracker blocklist)
    if ((activeLayers as any).cyber_attacks && !layerFetchedRef.current.has('cyber_attacks')) {
      fetchEndpoint('/api/cyber-attacks', d => ({ cyber_attacks: d.indicators }));
      layerFetchedRef.current.add('cyber_attacks');
    }

    /* Mark before awaiting so a re-render mid-flight cannot double-fetch, then
       release the mark if nothing landed — otherwise one failed request leaves
       the layer permanently empty. */
    const loadLayerOnce = (key: string, url: string, transform: (d: any) => any) => {
      if (layerFetchedRef.current.has(key)) return;
      layerFetchedRef.current.add(key);
      fetchEndpoint(url, transform).then(ok => {
        if (!ok) layerFetchedRef.current.delete(key);
      });
    };

    if (activeLayers.alert_pins) loadLayerOnce('alert_stories', STORIES_URL, storiesData);

    // GDELT 2.0 geocoded events
    if ((activeLayers as any).gdelt_events) {
      loadLayerOnce('gdelt_events', '/api/gdelt-events?limit=600', d => ({ gdelt_events: d.events }));
    }

    // Cloudflare Radar — one request backs both layers
    if ((activeLayers as any).cf_outages || (activeLayers as any).cf_attacks) {
      loadLayerOnce('cloudflare_radar', '/api/cloudflare-radar', radarData);
    }
    if ((activeLayers as any).cf_outages) {
      loadLayerOnce('ioda', '/api/radar', iodaData);
    }

    // Open-Meteo grid — one request backs temperature and wind
    if (activeLayers.wx_temperature || activeLayers.wx_wind) {
      loadLayerOnce('weather_grid', '/api/weather-grid', d => ({ weather_grid: d }));
    }

    if (activeLayers.launches) {
      loadLayerOnce('launches', '/api/launches', d => ({ launches: d.launches ?? [] }));
    }
    if (activeLayers.aurora) {
      loadLayerOnce('aurora', '/api/aurora', d => ({ aurora: d }));
    }
    if (activeLayers.service_status) {
      loadLayerOnce('service_status', '/api/service-status', d => ({ service_status: d.cities ?? [] }));
    }

    if (activeLayers.war_alerts) {
      loadLayerOnce('war_alerts', '/api/war-alerts', d => ({ war_alerts: d.alerts ?? [] }));
    }

    if (activeLayers.airport_delays) {
      loadLayerOnce('airport_delays', '/api/airport-status', d => ({ airport_delays: d.airports ?? [] }));
    }

    if (activeLayers.chokepoint_flow) {
      loadLayerOnce('chokepoint_flow', '/api/chokepoints', d => ({ chokepoint_flow: d.chokepoints ?? [], chokepoint_disruptions: d.disruptions ?? [] }));
    }

    if (activeLayers.outbreaks) {
      loadLayerOnce('outbreaks', '/api/outbreaks', d => ({ outbreaks: d.outbreaks ?? [] }));
    }


  }, [activeLayers, replayActive]);

  // ── LAYER-AWARE POLLING — only poll data for active layers ──
  useEffect(() => {
    const intervals: ReturnType<typeof setInterval>[] = [];
    const stopFns: (() => void)[] = [];
    if (activeLayers.flights || activeLayers.military || activeLayers.jets || activeLayers.private || activeLayers.gps_jamming) {
      intervals.push(setInterval(() => fetchEndpoint(FLIGHTS_URL, flightData), 300000)); // 5 min (was 2 min)
    }

    if (activeLayers.balloons) {
      intervals.push(setInterval(() => fetchEndpoint('/api/balloons', d => ({ balloons: d.balloons })), 300000)); // 5m
    }
    if (activeLayers.radiation) {
      intervals.push(setInterval(() => fetchEndpoint('/api/radiation', d => ({ radiation: d.stations })), 300000)); // 5m
    }
    if (activeLayers.outbreaks) {
      intervals.push(setInterval(() => fetchEndpoint('/api/outbreaks', d => ({ outbreaks: d.outbreaks ?? [] }), undefined, { skipWhenHidden: true }), 3_600_000));
    }
    if (activeLayers.alert_pins) {
      // GDELT publishes every 15 minutes.
      intervals.push(setInterval(() => fetchEndpoint(STORIES_URL, storiesData, undefined, { skipWhenHidden: true }), 900_000));
    }
    if (activeLayers.airport_delays) {
      intervals.push(setInterval(() => fetchEndpoint('/api/airport-status', d => ({ airport_delays: d.airports ?? [] }), undefined, { skipWhenHidden: true }), 300_000));
    }
    if (activeLayers.war_alerts) {
      // A siren lasts a minute or two; the route re-reads its upstreams every 20-30 s.
      intervals.push(setInterval(() => fetchEndpoint('/api/war-alerts', d => ({ war_alerts: d.alerts ?? [] }), undefined, { skipWhenHidden: true }), 60_000));
    }
    if ((activeLayers as any).cf_outages || (activeLayers as any).cf_attacks) {
      // Both routes re-read their upstreams every 5 minutes.
      intervals.push(setInterval(() => {
        fetchEndpoint('/api/cloudflare-radar', radarData, undefined, { skipWhenHidden: true });
        if ((activeLayers as any).cf_outages) fetchEndpoint('/api/radar', iodaData, undefined, { skipWhenHidden: true });
      }, 300_000));
    }
    if (activeLayers.service_status) {
      intervals.push(setInterval(() => fetchEndpoint('/api/service-status', d => ({ service_status: d.cities ?? [] }), undefined, { skipWhenHidden: true }), 300_000));
    }
    if (activeLayers.aurora) {
      // SWPC refreshes the nowcast about every 5 minutes.
      intervals.push(setInterval(() => fetchEndpoint('/api/aurora', d => ({ aurora: d }), undefined, { skipWhenHidden: true }), 300_000));
    }
    if (activeLayers.launches) {
      // The route reads Launch Library 2 at most hourly.
      intervals.push(setInterval(() => fetchEndpoint('/api/launches', d => ({ launches: d.launches ?? [] }), undefined, { skipWhenHidden: true }), 1_800_000));
    }
    if (activeLayers.wx_temperature || activeLayers.wx_wind) {
      // The route moves to the next forecast hour on its own; this just picks it up.
      intervals.push(setInterval(() => fetchEndpoint('/api/weather-grid', d => ({ weather_grid: d }), undefined, { skipWhenHidden: true }), 900000)); // 15m
    }
    if (activeLayers.maritime) {
      /* Ten seconds is the cadence a moving vessel needs. The other two thirds
         of this payload — 52 ports and 10 chokepoints — are constants in the
         route, and their congestion is derived from those vessels, so with no
         AIS feed the reply is byte-identical poll after poll: 360 requests an
         hour, per reader, for a fixed document. So the fast rate is earned by
         actually carrying vessels, and otherwise falls back to the five
         minutes every other layer here uses. Rescheduled rather than fixed,
         because the count is read from a ref that no re-render announces. */
      let vesselTimer: ReturnType<typeof setTimeout>;
      let stopped = false;
      const vesselGapMs = () => ((dataRef.current.maritime_ships?.length ?? 0) > 0 ? 10_000 : 300_000);
      const pollMaritime = () => {
        if (stopped) return;
        // A background tab asks for nothing, and catches up the moment it is shown again.
        fetchEndpoint(shipBookRef.current.url(), shipsFrom, undefined, { skipWhenHidden: true });
        vesselTimer = setTimeout(pollMaritime, vesselGapMs());
      };
      const onShown = () => {
        if (document.hidden || stopped) return;
        clearTimeout(vesselTimer);
        pollMaritime();
      };
      // The first ships may not have landed yet, so the first refresh doesn't wait the empty-feed five minutes.
      vesselTimer = setTimeout(pollMaritime, 10_000);
      document.addEventListener('visibilitychange', onShown);
      stopFns.push(() => { stopped = true; clearTimeout(vesselTimer); document.removeEventListener('visibilitychange', onShown); });
    }
    if ((activeLayers as any).cyber_attacks) {
      intervals.push(setInterval(() => {
        layerFetchedRef.current.delete('cyber_attacks');
        fetchEndpoint('/api/cyber-attacks', d => ({ cyber_attacks: d.indicators }));
        layerFetchedRef.current.add('cyber_attacks');
      }, 300000)); // 5m — a blocklist turns over in hours, not seconds
    }
    return () => { intervals.forEach(clearInterval); stopFns.forEach(stop => stop()); };
  }, [activeLayers, fetchEndpoint, shipsFrom]);

  // CCTV: loaded once on layer toggle via layerFetchedRef (no viewport polling)

  // Reactive layer fetch: handled by layerFetchedRef above (no duplicate)

  return { fetchEndpoint };
}
