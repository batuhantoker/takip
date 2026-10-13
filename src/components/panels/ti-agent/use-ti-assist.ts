'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { useAssist } from '@/lib/oi/assist/client';
import type { Highlight, Site } from '@/lib/oi/assist/tools';
import type { OiClient } from '@/lib/oi/client';
import { currentAnswer } from '@/lib/oi/state';
import { searchObjects, TYPE_LABEL, objectsOf } from '@/lib/oi/objects';
import type { OiGlobe } from '@/lib/oi/globe';
import { look } from '@/lib/vision/store';
import type { ActiveLayers } from '@/lib/layers/defaults';
import type { ToolId } from '@/components/shell/sidebar/dock';
import type { FlyToTarget, LiveData, MapCenter, MapProjection, MapStyle, MapView, MobilePanel } from '@/components/shell/state/types';
import type { OiMode } from './ti-mode';
import type { TiAssist } from './assist/assist-view';
import type { Stage } from '@/components/panels/ti-agent/workspace/workspace';

export function useOiAssist({
  dataRef, oi, oiGlobe, activeLayers, setActiveLayers, mapCenter, mapView, mapProjection, setMapProjection, mapStyle, setMapStyle,
  oiTheater, setOiTheater, oiStage, setOiStage, setOiMode, setOiSelected,
  setMobilePanel, setActiveTool, setShowLayers, setShowDirections, setFlyToLocation, setActiveCamera,
}: {
  dataRef: RefObject<LiveData>;
  oi: OiClient;
  oiGlobe: RefObject<OiGlobe | null>;
  activeLayers: ActiveLayers;
  setActiveLayers: Dispatch<SetStateAction<ActiveLayers>>;
  mapCenter: MapCenter | null;
  mapView: MapView;
  mapProjection: MapProjection;
  setMapProjection: Dispatch<SetStateAction<MapProjection>>;
  mapStyle: MapStyle;
  setMapStyle: Dispatch<SetStateAction<MapStyle>>;
  oiTheater: boolean;
  setOiTheater: Dispatch<SetStateAction<boolean>>;
  oiStage: Stage;
  setOiStage: Dispatch<SetStateAction<Stage>>;
  setOiMode: Dispatch<SetStateAction<OiMode>>;
  setOiSelected: Dispatch<SetStateAction<string | null>>;
  setMobilePanel: Dispatch<SetStateAction<MobilePanel | null>>;
  setActiveTool: Dispatch<SetStateAction<ToolId | null>>;
  setShowLayers: Dispatch<SetStateAction<boolean>>;
  setShowDirections: Dispatch<SetStateAction<boolean>>;
  setFlyToLocation: Dispatch<SetStateAction<FlyToTarget | null>>;
  setActiveCamera: Dispatch<SetStateAction<any>>;
}) {
  // ── OI ASSIST ── the conversation, and the page it works: the camera, the
  // layers, the panels, the live data, and what it marks on the map. It lives
  // here, so closing the panel keeps the conversation and its marks.
  const [oiHighlight, setOiHighlight] = useState<Highlight | null>(null);
  const [oiVoice, setOiVoice] = useState(() => typeof window !== 'undefined' && localStorage.getItem('takip.oi.voice') === '1');
  const setOiVoicePersist = useCallback((on: boolean) => {
    setOiVoice(on);
    try { localStorage.setItem('takip.oi.voice', on ? '1' : '0'); } catch { /* storage blocked */ }
    if (!on && typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);
  const assistView = useRef<ReturnType<Site['view']>>({ lat: 20, lng: 0, zoom: 2.5, projection: 'globe', style: 'dark' });
  const assistLayers = useRef<Record<string, boolean>>(activeLayers);
  const assistVoice = useRef(oiVoice);
  const assistOi = useRef(oi);
  useEffect(() => { assistLayers.current = activeLayers; }, [activeLayers]);
  useEffect(() => { assistVoice.current = oiVoice; }, [oiVoice]);
  useEffect(() => { assistOi.current = oi; });
  useEffect(() => {
    assistView.current = { lat: mapCenter?.lat ?? 20, lng: mapCenter?.lng ?? 0, zoom: mapView.zoom, projection: mapProjection, style: mapStyle, bounds: mapCenter?.bounds };
  }, [mapCenter, mapView.zoom, mapProjection, mapStyle]);
  /** A panel the assistant asked for, opened the way its own button opens it. */
  const openFromAssist = useCallback((panel: string) => {
    const phone = window.matchMedia('(max-width: 767px)').matches;
    if (panel === 'markets') { if (phone) setMobilePanel('markets'); else setActiveTool('markets'); }
    else if (panel === 'alerts') setActiveTool('alerts');
    else if (panel === 'intel') { if (phone) setMobilePanel('recon'); else setActiveTool('recon'); }
    else if (panel === 'layers') { if (phone) setMobilePanel('layers'); else setShowLayers(true); }
    else if (panel === 'directions') { setShowDirections(true); if (!phone) setActiveTool('directions'); }
    else if (panel === 'forecast' || panel === 'workspace') {
      setOiMode('forecast');
      if (phone) setMobilePanel('oi'); else setActiveTool('oi');
      if (panel === 'workspace' && assistOi.current.state && !phone) setOiTheater(true);
    }
  }, []);
  const assistTheater = useRef(oiTheater);
  const assistStage = useRef<Stage>(oiStage);
  useEffect(() => { assistTheater.current = oiTheater; }, [oiTheater]);
  useEffect(() => { assistStage.current = oiStage; }, [oiStage]);
  const assistSite = useMemo<Omit<Site, 'forecast'>>(() => ({
    data: () => dataRef.current,
    view: () => assistView.current,
    layers: () => assistLayers.current,
    flyTo: (lat, lng, zoom) => { oiGlobe.current?.follow(false); setFlyToLocation({ lat, lng, zoom, ts: Date.now() }); },
    setLayers: (on, off) => setActiveLayers(prev => {
      const next = { ...prev } as Record<string, boolean>;
      for (const k of on) if (k in next) next[k] = true;
      for (const k of off) if (k in next) next[k] = false;
      return next as typeof prev;
    }),
    highlight: h => setOiHighlight(h),
    openPanel: openFromAssist,
    setView: ({ projection, style }) => {
      if (projection) {
        if (projection === 'mercator') setActiveLayers(prev => ({ ...prev, terrain_elevation: false, terrain_3d: false }));
        setMapProjection(projection);
      }
      if (style) setMapStyle(style);
    },
    workspace: ({ open, view }) => {
      if (window.matchMedia('(max-width: 767px)').matches) return { ok: false, error: 'The full-screen workspace is for larger screens' };
      const run = assistOi.current.state;
      if (view && view !== 'globe' && !run) return { ok: false, error: `The ${view} needs a forecast: start one first` };
      if (open === false) { setOiTheater(false); return { ok: true, summary: 'Closed the workspace' }; }
      setActiveTool('oi');
      setOiTheater(true);
      if (view) setOiStage(view);
      return { ok: true, summary: `Opened the workspace${view ? ` on the ${view}` : ''}` };
    },
    select: name => {
      const run = assistOi.current.state;
      if (!run) return { ok: false, error: 'There is no forecast to select from' };
      const hit = searchObjects(run, name, 1)[0];
      if (!hit) return { ok: false, error: `Nothing called "${name}" in this forecast` };
      setOiSelected(hit.key);
      return { ok: true, summary: `Opened ${hit.title} (${TYPE_LABEL[hit.type].toLowerCase()})` };
    },
    geocode: async q => {
      try {
        const res = await fetch(`/api/v1/geo/search?q=${encodeURIComponent(q)}`);
        const hit = (await res.json())?.results?.[0];
        return hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng) ? { name: hit.name, lat: hit.lat, lng: hit.lng, kind: hit.kind } : null;
      } catch { return null; }
    },
    // OI looks through the same overlay the reader uses, so its boxes appear in the open viewer.
    camera: async (cam, watch) => {
      setActiveCamera({ ...cam, type: 'cctv' });
      const out = await look(cam, { watch, by: 'oi' });
      return { analysis: out.analysis, watch: out.watch };
    },
  }), [openFromAssist]);
  const assist = useAssist({
    site: assistSite,
    startForecast: async (question, depth, auth) => {
      const id = await assistOi.current.start({ question, seed: '', depth, useFeeds: true }, auth.engine, auth.key);
      return id ? { ok: true, id } : { ok: false, error: 'The forecast did not start: check the key and try again.' };
    },
    forecastSummary: () => {
      const st = assistOi.current.state;
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
  return { oiHighlight, oiVoice, setOiVoicePersist, assist: ti };
}
