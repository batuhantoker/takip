'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { useAssist } from './assist/use-assist';
import type { AssistMemo, Highlight, Site } from '@/lib/ai/assist/tools';
import { requestTrack, stopTracking, trackedNow, trackStatus } from '@/components/map/inspect/track-request';
import type { AiClient } from './use-ai';
import { currentAnswer } from '@/lib/ai/state';
import { searchObjects, TYPE_LABEL, objectsOf } from '@/lib/ai/workspace/objects';
import type { AiGlobe } from '@/lib/ai/globe/attach';
import { look } from '@/lib/intel/vision/store';
import type { ActiveLayers } from '@/lib/map/layers/defaults';
import type { ToolId } from '@/components/shell/sidebar/dock';
import type { FlyToTarget, LiveData, MapCenter, MapProjection, MapStyle, MapView, MobilePanel } from '@/components/shell/state/types';
import type { AiMode } from './ti-mode';
import type { TiAssist } from './assist/assist-view';
import type { Stage } from '@/components/panels/ti-agent/workspace/workspace';
import type { ReplaySession } from '@/lib/map/replay/session';
import type { HistorySession } from '@/lib/history/session';
import type { ReplayClock } from '@/lib/map/replay/clock';

const when = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');
const clockWords = (c: ReplayClock) => (c.playing() ? `playing at ${c.speed()}× real time` : 'paused');

/** A session opened from a hook shows up a render later. */
async function settled<T>(read: () => T | null, ms = 1500): Promise<T | null> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = read();
    if (v) return v;
    await new Promise(r => setTimeout(r, 50));
  }
  return read();
}

export function useAiAssist({
  dataRef, ai, aiGlobe, activeLayers, setActiveLayers, mapCenter, mapView, mapProjection, setMapProjection, mapStyle, setMapStyle,
  aiTheater, setAiTheater, aiStage, setAiStage, setAiMode, setAiSelected,
  setMobilePanel, setActiveTool, setShowLayers, setShowDirections, setFlyToLocation, setActiveCamera, replay, history,
}: {
  dataRef: RefObject<LiveData>;
  ai: AiClient;
  aiGlobe: RefObject<AiGlobe | null>;
  activeLayers: ActiveLayers;
  setActiveLayers: Dispatch<SetStateAction<ActiveLayers>>;
  mapCenter: MapCenter | null;
  mapView: MapView;
  mapProjection: MapProjection;
  setMapProjection: Dispatch<SetStateAction<MapProjection>>;
  mapStyle: MapStyle;
  setMapStyle: Dispatch<SetStateAction<MapStyle>>;
  aiTheater: boolean;
  setAiTheater: Dispatch<SetStateAction<boolean>>;
  aiStage: Stage;
  setAiStage: Dispatch<SetStateAction<Stage>>;
  setAiMode: Dispatch<SetStateAction<AiMode>>;
  setAiSelected: Dispatch<SetStateAction<string | null>>;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  setShowLayers: Dispatch<SetStateAction<boolean>>;
  setShowDirections: Dispatch<SetStateAction<boolean>>;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
  setActiveCamera: Dispatch<SetStateAction<any>>;
  replay?: { session: ReplaySession | null; toggle(): void };
  history?: { session: HistorySession | null; open(): void; close(): void };
}) {
  const replayRef = useRef(replay);
  const historyRef = useRef(history);
  useEffect(() => { replayRef.current = replay; historyRef.current = history; });
  // ── AI ASSIST ── the conversation, and the page it works: the camera, the
  // layers, the panels, the live data, and what it marks on the map. It lives
  // here, so closing the panel keeps the conversation and its marks.
  const [aiHighlight, setAiHighlight] = useState<Highlight | null>(null);
  const [aiVoice, setAiVoice] = useState(() => typeof window !== 'undefined' && localStorage.getItem('takip.ai.voice') === '1');
  const setAiVoicePersist = useCallback((on: boolean) => {
    setAiVoice(on);
    try { localStorage.setItem('takip.ai.voice', on ? '1' : '0'); } catch { /* storage blocked */ }
    if (!on && typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);
  const assistView = useRef<ReturnType<Site['view']>>({ lat: 20, lng: 0, zoom: 2.5, projection: 'globe', style: 'dark' });
  const assistLayers = useRef<Record<string, boolean>>(activeLayers);
  const assistVoice = useRef(aiVoice);
  const assistAi = useRef(ai);
  useEffect(() => { assistLayers.current = activeLayers; }, [activeLayers]);
  useEffect(() => { assistVoice.current = aiVoice; }, [aiVoice]);
  useEffect(() => { assistAi.current = ai; });
  useEffect(() => {
    assistView.current = { lat: mapCenter?.lat ?? 20, lng: mapCenter?.lng ?? 0, zoom: mapView.zoom, projection: mapProjection, style: mapStyle, bounds: mapCenter?.bounds };
  }, [mapCenter, mapView.zoom, mapProjection, mapStyle]);
  const [assistMemo] = useState<AssistMemo>(() => ({}));
  /** A panel the assistant asked for, opened the way its own button opens it. */
  const openFromAssist = useCallback((panel: string) => {
    const phone = window.matchMedia('(max-width: 767px)').matches;
    if (panel === 'markets') { if (phone) setMobilePanel('markets'); else setActiveTool('markets'); }
    else if (panel === 'alerts') setActiveTool('alerts');
    else if (panel === 'intel') { if (phone) setMobilePanel('recon'); else setActiveTool('recon'); }
    else if (panel === 'layers') { if (phone) setMobilePanel('layers'); else setShowLayers(true); }
    else if (panel === 'directions') { setShowDirections(true); if (!phone) setActiveTool('directions'); }
    else if (panel === 'forecast' || panel === 'workspace') {
      setAiMode('forecast');
      if (phone) setMobilePanel('ai'); else setActiveTool('ai');
      if (panel === 'workspace' && assistAi.current.state && !phone) setAiTheater(true);
    }
  }, []);
  /** The way back: what its own close button does. */
  const closeFromAssist = useCallback((panel: string) => {
    const phone = window.matchMedia('(max-width: 767px)').matches;
    if (panel === 'layers') { if (phone) setMobilePanel(null); else setShowLayers(false); }
    else if (panel === 'directions') { setShowDirections(false); setActiveTool(t => (t === 'directions' ? null : t)); }
    else if (panel === 'workspace') setAiTheater(false);
    else if (phone) setMobilePanel(null);
    else setActiveTool(null);
  }, []);
  const assistTheater = useRef(aiTheater);
  const assistStage = useRef<Stage>(aiStage);
  useEffect(() => { assistTheater.current = aiTheater; }, [aiTheater]);
  useEffect(() => { assistStage.current = aiStage; }, [aiStage]);
  const assistSite = useMemo<Omit<Site, 'forecast'>>(() => ({
    data: () => dataRef.current,
    view: () => ({ ...assistView.current, ...aiGlobe.current?.camera() }),
    layers: () => assistLayers.current,
    flyTo: (lat, lng, zoom) => { aiGlobe.current?.follow(false); setFlyToLocation({ lat, lng, zoom, ts: Date.now() }); },
    setLayers: (on, off) => setActiveLayers(prev => {
      const next = { ...prev } as Record<string, boolean>;
      for (const k of on) if (k in next) next[k] = true;
      for (const k of off) if (k in next) next[k] = false;
      return next as typeof prev;
    }),
    highlight: h => setAiHighlight(h),
    openPanel: openFromAssist,
    closePanel: closeFromAssist,
    memo: assistMemo,
    move: v => aiGlobe.current?.move(v) ?? '',
    track: t => requestTrack(t),
    untrack: () => stopTracking(),
    timeline: async ({ mode, at, play, speed }) => {
      const rp = replayRef.current, hs = historyRef.current;
      if (!rp || !hs) return { ok: false, error: 'Replay and History are not available here' };
      if (mode === 'live') {
        if (rp.session) rp.toggle();
        if (hs.session) hs.close();
        return { ok: true, summary: 'Back to live' };
      }
      const steer = (c: ReplayClock) => {
        if (at !== undefined) c.seek(at);
        if (speed) c.setSpeed(speed);
        if (play === true) c.play(); else if (play === false) c.pause();
      };
      if (mode === 'replay') {
        if (hs.session) hs.close();
        if (!rp.session) rp.toggle();
        const s = await settled(() => replayRef.current?.session ?? null);
        if (!s) return { ok: false, error: 'Replay did not open' };
        steer(s.clock);
        return { ok: true, summary: `Replay at ${when(s.clock.time())} UTC, ${clockWords(s.clock)}` };
      }
      if (rp.session) rp.toggle();
      if (!hs.session) hs.open();
      const s = await settled(() => historyRef.current?.session ?? null);
      if (!s) return { ok: false, error: 'History did not open' };
      steer(s.clock);
      return { ok: true, summary: `History at ${new Date(s.clock.time()).getUTCFullYear()}, ${clockWords(s.clock)}` };
    },
    tracked: () => {
      const t = trackedNow() ?? trackStatus()?.target ?? null;
      return t ? { ...t, status: trackStatus()?.target.id === t.id ? trackStatus()!.status : 'tracking' } : null;
    },
    setView: ({ projection, style }) => {
      if (projection) {
        if (projection === 'mercator') setActiveLayers(prev => ({ ...prev, terrain_elevation: false, terrain_3d: false }));
        setMapProjection(projection);
      }
      if (style) setMapStyle(style);
    },
    workspace: ({ open, view }) => {
      if (window.matchMedia('(max-width: 767px)').matches) return { ok: false, error: 'The full-screen workspace is for larger screens' };
      const run = assistAi.current.state;
      if (view && view !== 'globe' && !run) return { ok: false, error: `The ${view} needs a forecast: start one first` };
      if (open === false) { setAiTheater(false); return { ok: true, summary: 'Closed the workspace' }; }
      setActiveTool('ai');
      setAiTheater(true);
      if (view) setAiStage(view);
      return { ok: true, summary: `Opened the workspace${view ? ` on the ${view}` : ''}` };
    },
    select: name => {
      const run = assistAi.current.state;
      if (!run) return { ok: false, error: 'There is no forecast to select from' };
      const hit = searchObjects(run, name, 1)[0];
      if (!hit) return { ok: false, error: `Nothing called "${name}" in this forecast` };
      setAiSelected(hit.key);
      return { ok: true, summary: `Opened ${hit.title} (${TYPE_LABEL[hit.type].toLowerCase()})` };
    },
    geocode: async q => {
      try {
        const res = await fetch(`/api/v1/geo/search?q=${encodeURIComponent(q)}`);
        const hit = (await res.json())?.results?.[0];
        return hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng) ? { name: hit.name, lat: hit.lat, lng: hit.lng, kind: hit.kind } : null;
      } catch { return null; }
    },
    // AI looks through the same overlay the reader uses, so its boxes appear in the open viewer.
    camera: async (cam, watch) => {
      setActiveCamera({ ...cam, type: 'cctv' });
      const out = await look(cam, { watch, by: 'ai' });
      return { analysis: out.analysis, watch: out.watch };
    },
  }), [openFromAssist, closeFromAssist, assistMemo]);
  const assist = useAssist({
    site: assistSite,
    startForecast: async (question, depth, auth) => {
      const id = await assistAi.current.start({ question, seed: '', depth, useFeeds: true }, auth.engine, auth.key);
      return id ? { ok: true, id } : { ok: false, error: 'The forecast did not start: check the key and try again.' };
    },
    forecastSummary: () => {
      const st = assistAi.current.state;
      return st ? {
        question: st.question, status: st.status === 'running' ? st.phaseLabel || 'running' : st.status, answer: currentAnswer(st),
        objects: objectsOf(st).filter(o => o.type === 'actor' || o.type === 'world').map(o => o.title).slice(0, 40),
      } : null;
    },
    ui: () => ({ fullscreen: assistTheater.current, stage: assistStage.current }),
    onReply: text => {
      if (!assistVoice.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/^- /gm, '').replace(/\s+/g, ' ').trim());
      u.rate = 1.03;
      window.speechSynthesis.speak(u);
    },
  });

  const ti: TiAssist = { ...assist, setLayers: assistSite.setLayers };
  return { aiHighlight, aiVoice, setAiVoicePersist, assist: ti };
}
