'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocateFixed, Radar, ChevronDown, ChevronUp, AlertTriangle, Clock, Maximize2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { lookupError, lookupUrl, needsSignIn, parseLeaks, runSweep, SIGN_IN_REQUIRED } from '@/lib/recon-lookup';
import { StructuredResults } from '@/components/recon/tools/structured-results';
import { TABS, type ToolDef } from './recon-tools';
import FingerprintSearch, { useFingerprintSearch } from './fingerprint-search';
import DonBotScan from '@/components/markets/donbot-scan';
import { ToolRail } from './tool-rail';
import { ToolGrid } from './tool-grid';
import { QueryBar } from './query-bar';
import { SweepProgress, SweepResults } from './sweep-results';
import { ExpandedView } from './expanded-view';
import { SignInNotice } from './sign-in-notice';

interface OsintPanelProps { isMobile?: boolean; onSweepVisualize?: (data: any) => void; onScanGeolocate?: (target: string, data: any) => void; }

function OsintPanelInner({ isMobile, onSweepVisualize, onScanGeolocate }: OsintPanelProps) {
  const [activeTab, setActiveTab] = useState('scanner');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanType, setScanType] = useState('quick');
  const [expanded, setExpanded] = useState(true);
  const [history, setHistory] = useState<{tab:string;query:string;time:string}[]>([]);
  const [sweepResult, setSweepResult] = useState<any>(null);
  const [sweepProgress, setSweepProgress] = useState<{ current: number; total: number } | null>(null);
  const [sweepCidr, setSweepCidr] = useState(24);
  const [cveCache, setCveCache] = useState<Record<string, any>>({});
  // CHAIN INTEL carries two views: the daily brief needs no target, the wallet
  // lookup uses the shared query bar.
  const [chainView, setChainView] = useState<'brief' | 'wallet'>('brief');
  /** Free-text filter over the toolkit — 19 modules is too many to scan. */
  const [toolFilter, setToolFilter] = useState('');
  // Owned here, not by the view: toggling the expanded view remounts it.
  const fingerprint = useFingerprintSearch();
  /** DonBot's open token, kept for the same reason; its frame reloads on the remount, on the same token. */
  const [donbotQuery, setDonbotQuery] = useState<string | null>(null);
  const signedIn = Boolean(authClient.useSession().data);

  const selectTool = useCallback((id: string) => {
    setActiveTab(id);
    setQuery('');
    setResults(null);
    setError('');
    setSweepResult(null);
  }, []);

  // Escape leaves the expanded view — it covers the map, so there must be a
  // way out that isn't hunting for the button.
  useEffect(() => {
    if (!isFullScreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullScreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullScreen]);

  const matchesFilter = useCallback((t: ToolDef) => {
    const q = toolFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      t.label.toLowerCase().includes(q) ||
      t.blurb.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q)
    );
  }, [toolFilter]);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  // Fetch CVE details when a device is expanded in full-screen mode
  const fetchCveDetails = useCallback(async (cveIds: string[]) => {
    const missing = cveIds.filter(id => !cveCache[id]);
    if (missing.length === 0) return;
    // Mark as loading
    setCveCache(prev => {
      const next = { ...prev };
      for (const id of missing) next[id] = { loading: true };
      return next;
    });
    // Fetch in parallel
    const results = await Promise.allSettled(
      missing.map(id => fetch(`/api/osint/cve?cve=${encodeURIComponent(id)}`).then(r => r.json()).then(data => ({ id, data })))
    );
    setCveCache(prev => {
      const next = { ...prev };
      for (const r of results) {
        if (r.status === 'fulfilled') {
          next[r.value.id] = r.value.data;
        }
      }
      return next;
    });
  }, [cveCache]);

    const handleSelfTrack = () => {
      setLoading(true);
      setError('');
      fetch('/api/geo')
        .then(r => {
          if (!r.ok) throw new Error(`Server returned ${r.status}`);
          return r.json();
        })
        .then(geo => {
          setLoading(false);
          if (geo.status === 'success' && geo.lat && geo.lon && onScanGeolocate) {
            onScanGeolocate(geo.query || 'local', {
              lat: geo.lat,
              lng: geo.lon,
              city: geo.city || 'Unknown',
              country: geo.country || 'Unknown',
              isp: geo.isp || 'Unknown',
              org: geo.org || 'Unknown',
              as: geo.as || 'Unknown',
              type: 'self_track'
            });
          } else {
            setError("Could not retrieve your IP location.");
          }
        })
        .catch(err => {
          setLoading(false);
          setError("Network error: " + err.message);
        });
    };

  const runLookup = useCallback(async () => {
    if (!query.trim() || loading) return;
    if (needsSignIn(activeTab, signedIn)) { setResults(null); setSweepResult(null); setError(SIGN_IN_REQUIRED); return; }
    setLoading(true); setError(''); setResults(null);

    // IP Sweep — separate flow (only for the sweep tab)
    if (activeTab === 'sweep') {
      setSweepResult(null);
      const cidr = sweepCidr;
      const totalHosts = Math.pow(2, 32 - cidr);
      setSweepProgress({ current: 0, total: totalHosts });
      try {
        const result = await runSweep(query, cidr, totalHosts, (done) => setSweepProgress({ current: done, total: totalHosts }));
        setSweepResult(result);
        setSweepProgress(null);
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      } catch (err: any) {
        setError(err.message);
        setSweepProgress(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const url = lookupUrl(activeTab, query, scanType);
      const res = await fetch(url, activeTab === 'shodan' ? { cache: 'no-store' } : undefined);
      if (activeTab === 'shodan' && res.status === 404) {
        setResults({ ip: query, status: 'No Shodan InternetDB records found', ports: [], cpes: [], hostnames: [], tags: [], vulns: [] });
        setLoading(false);
        return;
      }
      if (activeTab === 'leaks' && res.status === 404) {
        setResults({ email: query, breached: false, breaches: [], data_exposed: [] });
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        let parsedData = data;
        if (activeTab === 'leaks') {
           parsedData = parseLeaks(data, query);
        }

        setResults(parsedData);
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
        
        // Geolocate the target in the background
        if (activeTab === 'phone') {
          if (data.lat && data.lng && onScanGeolocate) {
             onScanGeolocate(query, { lat: data.lat, lng: data.lng, type: 'phone', region: data.region });
          }
        } else if (activeTab !== 'sweep' && activeTab !== 'vuln' && activeTab !== 'crypto' && activeTab !== 'username' && activeTab !== 'mac' && activeTab !== 'bgp' && activeTab !== 'github' && activeTab !== 'leaks' && activeTab !== 'phone') {
          fetch(`/api/osint/ip?ip=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(locData => {
              if (locData && locData.geo && locData.geo.lat && locData.geo.lon && onScanGeolocate) {
                // ip-api returns lat/lon, we pass it up
                onScanGeolocate(query, { lat: locData.geo.lat, lng: locData.geo.lon, ...locData, type: activeTab });
              }
            })
            .catch(() => {});
        }
      } else {
        setError(lookupError(data, 'Lookup failed'));
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [query, activeTab, scanType, loading, sweepCidr, signedIn]);

  const currentTab = TABS.find(t => t.id === activeTab);

  const renderContent = () => (
    <div className="flex flex-col gap-2.5">
      {/* Tool grid — omitted entirely in the expanded view, which uses the
          rail instead. Hiding it with CSS would leave a second "Filter tools"
          input in the DOM competing with the rail's. */}
      {!isFullScreen && (
      <div className="flex flex-col gap-1">
        {/* Sweep & Self Track Actions */}
        <div className="grid grid-cols-2 gap-2">
          {TABS.filter(t => t.id === 'sweep').map(tab => (
            <button key={tab.id} onClick={() => { 
                  setActiveTab(tab.id); setQuery(''); setResults(null); setError(''); setSweepResult(null); 
                }}
                className={`w-full py-4 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${
                  activeTab === tab.id ? 'bg-[var(--bg-tertiary)] border-opacity-50' : 'bg-[#0D0D0C] hover:bg-[var(--hover-accent)] border-transparent'
                }`}
                style={{ borderColor: activeTab === tab.id ? tab.color : 'rgba(255, 61, 61, 0.2)' }}
              >
                <div className="flex items-center gap-3">
                  <tab.icon className="w-5 h-5" style={{ color: tab.color }} />
                  <span className="font-mono font-bold tracking-[0.1em] text-[10px]" style={{ color: tab.color }}>GLOBAL SWEEP</span>
                </div>
            </button>
          ))}
          <button onClick={handleSelfTrack}
            disabled={loading}
            className={`w-full py-4 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${loading ? 'opacity-60 cursor-wait' : 'hover:bg-[var(--hover-accent)] hover:shadow-[0_0_20px_rgba(0,230,118,0.15)]'} bg-[#0D0D0C]`}
            style={{ borderColor: 'rgba(0, 230, 118, 0.2)' }}
          >
            <div className="flex items-center gap-3">
              <LocateFixed className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} style={{ color: '#00E676' }} />
              <span className="font-mono font-bold tracking-[0.1em] text-[10px]" style={{ color: '#00E676' }}>{loading ? 'TRACKING...' : 'SELF TRACK'}</span>
            </div>
          </button>
        </div>
        {/* Toolkit — grouped so 19 modules stay scannable, and at 4 columns
            every label fits without truncation. */}
        <ToolGrid toolFilter={toolFilter} setToolFilter={setToolFilter} matchesFilter={matchesFilter} activeTab={activeTab} selectTool={selectTool} />
      </div>
      )}

      {/* FINGERPRINT brings its own search bar, results and history. */}
      {activeTab === 'fingerprint' && <FingerprintSearch fp={fingerprint} isFullScreen={isFullScreen} />}

      {/* So does DONBOT — the same scan as Markets → Crypto, sealed in its own frame. */}
      {activeTab === 'donbot' && <DonBotScan initial={donbotQuery} onScan={setDonbotQuery} />}

      {/* Input Area */}
      {activeTab !== 'fingerprint' && activeTab !== 'donbot' && (
      <QueryBar
        activeTab={activeTab} chainView={chainView} setChainView={setChainView} currentTab={currentTab}
        query={query} setQuery={setQuery} runLookup={runLookup} loading={loading}
        scanType={scanType} setScanType={setScanType} sweepCidr={sweepCidr} setSweepCidr={setSweepCidr}
      />
      )}

      {error === SIGN_IN_REQUIRED ? <SignInNotice /> : error && (
        <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-[10px] font-mono text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* Sweep Progress */}
      {sweepProgress && loading && <SweepProgress sweepProgress={sweepProgress} />}

      {/* Sweep Results */}
      {sweepResult && !loading && activeTab === 'sweep' && (
        <SweepResults
          sweepResult={sweepResult} isFullScreen={isFullScreen} expandedDevice={expandedDevice} setExpandedDevice={setExpandedDevice}
          fetchCveDetails={fetchCveDetails} cveCache={cveCache} onSweepVisualize={onSweepVisualize}
        />
      )}

      {(results || (activeTab === 'crypto' && chainView === 'brief')) && !(sweepResult && !loading) && (
        <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-primary)] rounded-lg p-3 max-h-[50vh] overflow-y-auto styled-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono tracking-widest" style={{ color: currentTab?.color }}>{currentTab?.label} RESULTS</span>
            <span className="text-[9px] font-mono text-[var(--text-muted)] flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date().toLocaleTimeString()}</span>
          </div>
          <StructuredResults activeTab={activeTab} chainView={chainView} results={results} query={query} scanType={scanType} />
        </div>
      )}

      {history.length > 0 && !results && activeTab !== 'fingerprint' && activeTab !== 'donbot' && (
        <div className="space-y-1">
          <span className="text-[10px] font-mono tracking-widest text-[var(--text-muted)]">RECENT SCANS</span>
          {history.slice(0, 5).map((h, i) => (
            <button key={i} onClick={() => { setActiveTab(h.tab); setQuery(h.query); }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-accent)] transition-colors text-left">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono" style={{ color: TABS.find(t => t.id === h.tab)?.color }}>{TABS.find(t => t.id === h.tab)?.label}</span>
                <span className="text-[11px] font-mono text-[var(--text-secondary)]">{h.query}</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--text-muted)]">{h.time}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (isMobile) return renderContent();

  if (isFullScreen) {
    return (
      <ExpandedView
        currentTab={currentTab}
        setIsFullScreen={setIsFullScreen}
        rail={<ToolRail toolFilter={toolFilter} setToolFilter={setToolFilter} matchesFilter={matchesFilter} activeTab={activeTab} selectTool={selectTool} handleSelfTrack={handleSelfTrack} loading={loading} />}
      >
        {renderContent()}
      </ExpandedView>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="glass-panel flex flex-col overflow-hidden pointer-events-auto shrink-0 h-[500px] max-h-[80vh] resize-y">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.05)] bg-[rgba(0,0,0,0.3)] hover:bg-[var(--hover-accent)] transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1">
          <Radar className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />
          <span className="hud-text text-[11px] text-[var(--text-primary)]">RECON TOOLKIT</span>
          <span className="gotham-tag gotham-tag--info" style={{ fontSize: '9px', padding: '1px 5px' }}>{TABS.length} TOOLS</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsFullScreen(true)} className="p-1.5 -m-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors" title="Full Screen">
             <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--cyan-primary)] animate-takip-pulse" />
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-y-auto px-3 py-3 flex-1 min-h-0 styled-scrollbar">
            {renderContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const OsintPanel = memo(OsintPanelInner);
export default OsintPanel;
