'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import LayerPanel from '@/components/LayerPanel';
import IntelFeed from '@/components/IntelFeed';
import MarketsPanel from '@/components/MarketsPanel';
import SearchBar from '@/components/SearchBar';
import ScaleBar from '@/components/ScaleBar';
import ErrorBoundary from '@/components/ErrorBoundary';

/* ═══════════════════════════════════════════════════════════════
   O S I R I S — Global Intelligence Platform
   Open Source Palantir Alternative
   Real-Time Geospatial OSINT Dashboard
   ═══════════════════════════════════════════════════════════════ */

// Dynamic import for MapLibre (no SSR — needs window)
const OsirisMap = dynamic(() => import('@/components/OsirisMap'), { ssr: false });

export default function Dashboard() {
  // ── Data State ──
  const dataRef = useRef<any>({});
  const [dataVersion, setDataVersion] = useState(0);
  const data = dataRef.current;

  // ── UI State ──
  const [uiVisible, setUiVisible] = useState(true);
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [mapView, setMapView] = useState({ zoom: 2.5, latitude: 20 });
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number; ts: number } | null>(null);

  // ── Mouse Coordinates + Reverse Geocoding ──
  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const geocodeCache = useRef<Map<string, string>>(new Map());
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocodedPos = useRef<{ lat: number; lng: number } | null>(null);
  const geocodeAbort = useRef<AbortController | null>(null);

  // ── Uptime Clock ──
  const [uptime, setUptime] = useState('00:00:00');
  const startTime = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      setUptime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Layer Toggles ──
  const [activeLayers, setActiveLayers] = useState({
    flights: true,
    private: true,
    jets: true,
    military: true,
    satellites: true,
    earthquakes: true,
    global_incidents: true,
    gps_jamming: true,
    day_night: true,
  });

  // ── Mouse Coordinate Tracking ──
  const handleMouseCoords = useCallback((coords: { lat: number; lng: number }) => {
    setMouseCoords(coords);

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      if (lastGeocodedPos.current) {
        const dLat = Math.abs(coords.lat - lastGeocodedPos.current.lat);
        const dLng = Math.abs(coords.lng - lastGeocodedPos.current.lng);
        if (dLat < 0.05 && dLng < 0.05) return;
      }

      const gridKey = `${coords.lat.toFixed(2)},${coords.lng.toFixed(2)}`;
      const cached = geocodeCache.current.get(gridKey);
      if (cached) {
        setLocationLabel(cached);
        lastGeocodedPos.current = coords;
        return;
      }

      if (geocodeAbort.current) geocodeAbort.current.abort();
      geocodeAbort.current = new AbortController();

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&zoom=10&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' }, signal: geocodeAbort.current.signal }
        );
        if (res.ok) {
          const data = await res.json();
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.county || '';
          const state = addr.state || addr.region || '';
          const country = addr.country || '';
          const parts = [city, state, country].filter(Boolean);
          const label = parts.join(', ') || data.display_name?.split(',').slice(0, 3).join(',') || 'Unknown';

          if (geocodeCache.current.size > 500) {
            const iter = geocodeCache.current.keys();
            for (let i = 0; i < 100; i++) {
              const key = iter.next().value;
              if (key !== undefined) geocodeCache.current.delete(key);
            }
          }
          geocodeCache.current.set(gridKey, label);
          setLocationLabel(label);
          lastGeocodedPos.current = coords;
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') { /* keep last label */ }
      }
    }, 1500);
  }, []);

  // ── Region Dossier (right-click) ──
  const [regionDossier, setRegionDossier] = useState<any>(null);
  const [dossierLoading, setDossierLoading] = useState(false);

  const handleRightClick = useCallback(async (coords: { lat: number; lng: number }) => {
    setDossierLoading(true);
    setRegionDossier(null);
    try {
      const res = await fetch(`/api/region-dossier?lat=${coords.lat}&lng=${coords.lng}`);
      if (res.ok) {
        const data = await res.json();
        setRegionDossier(data);
      }
    } catch (e) {
      console.error('Dossier fetch failed', e);
    } finally {
      setDossierLoading(false);
    }
  }, []);

  // ── Data Fetching Loops ──
  useEffect(() => {
    const fetchFlights = async () => {
      try {
        const res = await fetch('/api/flights');
        if (res.ok) {
          const json = await res.json();
          dataRef.current = { ...dataRef.current, ...json };
          setDataVersion(v => v + 1);
          setBackendStatus('connected');
        }
      } catch {
        setBackendStatus('error');
      }
    };

    const fetchSatellites = async () => {
      try {
        const res = await fetch('/api/satellites');
        if (res.ok) {
          const json = await res.json();
          dataRef.current = { ...dataRef.current, ...json };
          setDataVersion(v => v + 1);
        }
      } catch { /* silent */ }
    };

    const fetchEarthquakes = async () => {
      try {
        const res = await fetch('/api/earthquakes');
        if (res.ok) {
          const json = await res.json();
          dataRef.current = { ...dataRef.current, ...json };
          setDataVersion(v => v + 1);
        }
      } catch { /* silent */ }
    };

    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        if (res.ok) {
          const json = await res.json();
          dataRef.current = { ...dataRef.current, ...json };
          setDataVersion(v => v + 1);
        }
      } catch { /* silent */ }
    };

    const fetchGdelt = async () => {
      try {
        const res = await fetch('/api/gdelt');
        if (res.ok) {
          const json = await res.json();
          dataRef.current = { ...dataRef.current, gdelt: json.events };
          setDataVersion(v => v + 1);
        }
      } catch { /* silent */ }
    };

    const fetchMarkets = async () => {
      try {
        const res = await fetch('/api/markets');
        if (res.ok) {
          const json = await res.json();
          dataRef.current = { ...dataRef.current, ...json };
          setDataVersion(v => v + 1);
        }
      } catch { /* silent */ }
    };

    // Initial fetch all
    fetchFlights();
    fetchSatellites();
    fetchEarthquakes();
    fetchNews();
    fetchGdelt();
    fetchMarkets();

    // Polling intervals
    const flightsInterval = setInterval(fetchFlights, 60000);
    const satInterval = setInterval(fetchSatellites, 120000);
    const eqInterval = setInterval(fetchEarthquakes, 120000);
    const newsInterval = setInterval(fetchNews, 300000);
    const gdeltInterval = setInterval(fetchGdelt, 600000);
    const marketsInterval = setInterval(fetchMarkets, 120000);

    return () => {
      clearInterval(flightsInterval);
      clearInterval(satInterval);
      clearInterval(eqInterval);
      clearInterval(newsInterval);
      clearInterval(gdeltInterval);
      clearInterval(marketsInterval);
    };
  }, []);

  // ── Computed Stats ──
  const totalFlights = (data.commercial_flights?.length || 0) + (data.private_flights?.length || 0) + (data.private_jets?.length || 0) + (data.military_flights?.length || 0);
  const totalSatellites = data.satellites?.length || 0;
  const totalEarthquakes = data.earthquakes?.length || 0;

  return (
    <main className="fixed inset-0 w-full h-full bg-[var(--bg-void)] overflow-hidden">

      {/* ── MAP ── */}
      <ErrorBoundary name="Map">
        <OsirisMap
          data={data}
          activeLayers={activeLayers}
          onEntityClick={() => {}}
          onMouseCoords={handleMouseCoords}
          onRightClick={handleRightClick}
          onViewStateChange={setMapView}
          flyToLocation={flyToLocation}
        />
      </ErrorBoundary>

      {uiVisible && (
        <>
          {/* ── OSIRIS HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="absolute top-6 left-6 z-[200] pointer-events-none flex items-center gap-4"
          >
            {/* Eye of Horus Reticle */}
            <div className="w-10 h-10 flex items-center justify-center relative">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--gold-primary)] flex items-center justify-center animate-glow-pulse">
                <div className="w-4 h-4 rounded-full bg-[var(--gold-primary)]/30 border border-[var(--gold-primary)]/60" />
              </div>
              <div className="absolute w-[1px] h-full bg-[var(--gold-primary)]/40" />
              <div className="absolute w-full h-[1px] bg-[var(--gold-primary)]/40" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-[0.5em] text-[var(--text-heading)] font-mono flex items-center">
                O S I R I S
              </h1>
              <span className="text-[8px] text-[var(--gold-primary)] font-mono tracking-[0.35em] mt-0.5 ml-0.5 opacity-80">
                GLOBAL INTELLIGENCE PLATFORM
              </span>
            </div>
          </motion.div>

          {/* ── TOP-RIGHT SYSTEM STATUS ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute top-4 right-6 z-[200] pointer-events-none flex items-center gap-4 text-[8px] font-mono tracking-widest text-[var(--text-muted)]"
          >
            <span>SYS: <span className={backendStatus === 'connected' ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}>{backendStatus.toUpperCase()}</span></span>
            <span>UPTIME: <span className="text-[var(--gold-primary)]">{uptime}</span></span>
            <span>VER: <span className="text-[var(--text-secondary)]">1.0.0</span></span>
          </motion.div>

          {/* ── TOP-LEFT METRICS ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="absolute top-3 left-6 z-[200] pointer-events-none text-[7px] font-mono tracking-[0.2em] text-[var(--gold-dim)]"
          >
            FEEDS:{Object.keys(data).length} SRC:8 LAT:{mouseCoords?.lat.toFixed(1) || '—'} LNG:{mouseCoords?.lng.toFixed(1) || '—'}
          </motion.div>

          {/* ── LEFT HUD ── */}
          <div className="absolute left-6 top-24 bottom-28 w-80 flex flex-col gap-4 z-[200] pointer-events-none">
            <LayerPanel
              data={data}
              activeLayers={activeLayers}
              setActiveLayers={setActiveLayers}
            />

            {/* Live Stats */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="glass-panel px-4 py-3 pointer-events-auto"
            >
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="hud-label">AIRCRAFT</div>
                  <div className="hud-value">{totalFlights.toLocaleString()}</div>
                </div>
                <div>
                  <div className="hud-label">SATELLITES</div>
                  <div className="hud-value">{totalSatellites.toLocaleString()}</div>
                </div>
                <div>
                  <div className="hud-label">SEISMIC</div>
                  <div className="hud-value">{totalEarthquakes.toLocaleString()}</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── RIGHT HUD ── */}
          <div className="absolute right-6 top-24 bottom-28 w-80 flex flex-col gap-4 z-[200] pointer-events-auto overflow-y-auto styled-scrollbar pr-1">
            <SearchBar onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })} />
            <MarketsPanel data={data} />
            <IntelFeed data={data} onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })} />
          </div>

          {/* ── BOTTOM CENTER — Coordinates + Location Bar ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 1 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-auto"
          >
            <div className="glass-panel px-6 py-3 flex items-center gap-6 osiris-glow">
              {/* Coordinates */}
              <div className="flex flex-col items-center min-w-[120px]">
                <div className="hud-label">COORDINATES</div>
                <div className="text-[11px] font-mono font-bold text-[var(--gold-primary)] tracking-wide">
                  {mouseCoords ? `${mouseCoords.lat.toFixed(4)}, ${mouseCoords.lng.toFixed(4)}` : '0.0000, 0.0000'}
                </div>
              </div>

              <div className="w-px h-8 bg-[var(--border-primary)]" />

              {/* Location */}
              <div className="flex flex-col items-center min-w-[180px] max-w-[320px]">
                <div className="hud-label">LOCATION</div>
                <div className="text-[10px] text-[var(--text-secondary)] font-mono truncate max-w-[320px]">
                  {locationLabel || 'Hover over map...'}
                </div>
              </div>

              <div className="w-px h-8 bg-[var(--border-primary)]" />

              {/* Zoom Level */}
              <div className="flex flex-col items-center">
                <div className="hud-label">ZOOM</div>
                <div className="text-[11px] font-mono font-bold text-[var(--gold-primary)]">
                  {mapView.zoom.toFixed(1)}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Scale Bar ── */}
          <div className="absolute bottom-[5.5rem] left-[26rem] z-[201] pointer-events-none">
            <ScaleBar zoom={mapView.zoom} latitude={mapView.latitude} />
          </div>

          {/* ── Region Dossier Overlay ── */}
          {(regionDossier || dossierLoading) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 z-[300] w-[500px] max-h-[70vh] overflow-y-auto styled-scrollbar"
            >
              <div className="glass-panel p-6 osiris-glow">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-mono font-bold text-[var(--gold-primary)] tracking-wider">
                    REGION DOSSIER
                  </h2>
                  <button
                    onClick={() => { setRegionDossier(null); setDossierLoading(false); }}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
                  >
                    ✕
                  </button>
                </div>

                {dossierLoading ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span className="text-[9px] font-mono text-[var(--text-muted)] tracking-widest">COMPILING INTEL...</span>
                  </div>
                ) : regionDossier && (
                  <div className="space-y-4">
                    {/* Location */}
                    <div>
                      <div className="hud-label mb-1">LOCATION</div>
                      <div className="text-xs text-[var(--text-primary)]">{regionDossier.location?.display_name}</div>
                    </div>

                    {/* Country Info */}
                    {regionDossier.country && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="hud-label mb-0.5">COUNTRY</div>
                          <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.flag} {regionDossier.country.name}</div>
                        </div>
                        <div>
                          <div className="hud-label mb-0.5">CAPITAL</div>
                          <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.capital}</div>
                        </div>
                        <div>
                          <div className="hud-label mb-0.5">POPULATION</div>
                          <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.population?.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="hud-label mb-0.5">AREA</div>
                          <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.area?.toLocaleString()} km²</div>
                        </div>
                        <div>
                          <div className="hud-label mb-0.5">REGION</div>
                          <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.subregion || regionDossier.country.region}</div>
                        </div>
                        <div>
                          <div className="hud-label mb-0.5">LANGUAGES</div>
                          <div className="text-xs text-[var(--text-primary)]">{regionDossier.country.languages?.join(', ')}</div>
                        </div>
                      </div>
                    )}

                    {/* Head of State */}
                    {regionDossier.head_of_state && (
                      <div>
                        <div className="hud-label mb-0.5">HEAD OF STATE</div>
                        <div className="text-xs text-[var(--gold-primary)]">{regionDossier.head_of_state.name}</div>
                        <div className="text-[9px] text-[var(--text-muted)]">{regionDossier.head_of_state.position}</div>
                      </div>
                    )}

                    {/* Wikipedia */}
                    {regionDossier.wikipedia && (
                      <div>
                        <div className="hud-label mb-1">INTELLIGENCE BRIEF</div>
                        <div className="flex gap-3">
                          {regionDossier.wikipedia.thumbnail && (
                            <img
                              src={regionDossier.wikipedia.thumbnail}
                              alt=""
                              className="w-16 h-16 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">{regionDossier.wikipedia.extract}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ── RESTORE UI BUTTON ── */}
      {!uiVisible && (
        <button
          onClick={() => setUiVisible(true)}
          className="absolute bottom-6 right-6 z-[200] glass-panel px-4 py-2 text-[10px] font-mono tracking-widest text-[var(--gold-primary)] hover:bg-[var(--hover-accent)] transition-colors pointer-events-auto"
        >
          RESTORE UI
        </button>
      )}

      {/* ── CRT VIGNETTE OVERLAY ── */}
      <div className="vignette absolute inset-0 pointer-events-none z-[2]" />

      {/* ── SCANLINES ── */}
      <div className="crt-scanlines absolute inset-0 pointer-events-none z-[3] opacity-[0.03]" />

      {/* ── Corner Frame Lines (Egyptian aesthetic) ── */}
      <div className="absolute top-0 left-0 w-20 h-20 pointer-events-none z-[1]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-[var(--gold-primary)]/40 to-transparent" />
        <div className="absolute top-0 left-0 w-[1px] h-full bg-gradient-to-b from-[var(--gold-primary)]/40 to-transparent" />
      </div>
      <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none z-[1]">
        <div className="absolute top-0 right-0 w-full h-[1px] bg-gradient-to-l from-[var(--gold-primary)]/40 to-transparent" />
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-[var(--gold-primary)]/40 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 w-20 h-20 pointer-events-none z-[1]">
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-[var(--gold-primary)]/40 to-transparent" />
        <div className="absolute bottom-0 left-0 w-[1px] h-full bg-gradient-to-t from-[var(--gold-primary)]/40 to-transparent" />
      </div>
      <div className="absolute bottom-0 right-0 w-20 h-20 pointer-events-none z-[1]">
        <div className="absolute bottom-0 right-0 w-full h-[1px] bg-gradient-to-l from-[var(--gold-primary)]/40 to-transparent" />
        <div className="absolute bottom-0 right-0 w-[1px] h-full bg-gradient-to-t from-[var(--gold-primary)]/40 to-transparent" />
      </div>
    </main>
  );
}
