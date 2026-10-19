'use client';

import { memo, useCallback, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { useEscape } from '@/components/ui/use-escape';
import { useT } from '@/components/ui/use-t';
import DonBotScan from '@/components/panels/markets/donbot-scan';
import { toolById } from './recon-tools';
import { useReconLookup } from './use-recon-lookup';
import { ReconOverview } from '@/components/panels/recon/parts/recon-overview';
import { ReconToolView } from '@/components/panels/recon/tool/recon-tool-view';
import { ReconResults } from '@/components/panels/recon/results/recon-results';
import { ToolList } from '@/components/panels/recon/parts/tool-list';
import { ToolRail } from '@/components/panels/recon/parts/tool-rail';
import { ExpandedView } from '@/components/panels/recon/parts/expanded-view';
import { profileMode } from '@/lib/intel/recon/suggest-tools';
import FingerprintSearch, { useFingerprintSearch } from '@/components/panels/recon/fingerprint/fingerprint-search';
import { SignInFooter, SignInNotice } from '@/components/panels/recon/parts/sign-in-notice';
import { SIGN_IN_REQUIRED } from '@/lib/intel/recon/lookup';

interface OsintPanelProps {
  isMobile?: boolean;
  onClose?: () => void;
  onSweepVisualize?: (data: any) => void;
  onScanGeolocate?: (target: string, data: any) => void;
}

function OsintPanelInner({ isMobile, onClose, onSweepVisualize, onScanGeolocate }: OsintPanelProps) {
  const t = useT();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [railFilter, setRailFilter] = useState('');
  const [browseAll, setBrowseAll] = useState(false);
  const [selfTracking, setSelfTracking] = useState(false);
  const [selfTrackError, setSelfTrackError] = useState('');
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [cveCache, setCveCache] = useState<Record<string, any>>({});
  const [donbotQuery, setDonbotQuery] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const lookup = useReconLookup({ onScanGeolocate });
  // Owned here, not by the view: the expanded view remounts and would drop a live sweep.
  const fingerprint = useFingerprintSearch();
  const tool = toolById(activeTool);

  const backToTools = () => { setActiveTool(null); lookup.clearResults(); };

  // Escape climbs one level at a time: an open tool, then full screen, then the panel itself.
  useEscape(() => {
    if (tool) backToTools();
    else if (isFullScreen) setIsFullScreen(false);
    else onClose?.();
  }, !isMobile, rootRef);

  /** Opens a tool, carrying whatever is in the field over to it. */
  const openTool = (id: string, query = lookup.query) => {
    setActiveTool(id);
    lookup.clearResults();
    if (id === 'fingerprint' && query.trim()) {
      fingerprint.setMode(profileMode(query));
      fingerprint.setQuery(query.trim());
    }
  };

  /** Opens a tool and runs it on the query at once. */
  const runTool = (id: string, query: string) => {
    setActiveTool(id);
    lookup.clearResults();
    lookup.setQuery(query);
    if (id === 'fingerprint') fingerprint.run(profileMode(query), query);
    else if (id === 'donbot') setDonbotQuery(query.trim() || null);
    else lookup.run(id, query, { cidr: lookup.sweepCidr });
  };

  const fetchCveDetails = useCallback(async (cveIds: string[]) => {
    const missing = cveIds.filter(id => !cveCache[id]);
    if (!missing.length) return;
    setCveCache(prev => { const next = { ...prev }; for (const id of missing) next[id] = { loading: true }; return next; });
    const done = await Promise.allSettled(missing.map(id => fetch(`/api/osint/cve?cve=${encodeURIComponent(id)}`).then(r => r.json()).then(data => ({ id, data }))));
    setCveCache(prev => { const next = { ...prev }; for (const r of done) if (r.status === 'fulfilled') next[r.value.id] = r.value.data; return next; });
  }, [cveCache]);

  const handleSelfTrack = useCallback(() => {
    setSelfTracking(true);
    setSelfTrackError('');
    fetch('/api/geo')
      .then(r => { if (!r.ok) throw new Error(`Server returned ${r.status}`); return r.json(); })
      .then(geo => {
        setSelfTracking(false);
        if (geo.status === 'success' && geo.lat && geo.lon && onScanGeolocate) {
          onScanGeolocate(geo.query || 'local', {
            lat: geo.lat, lng: geo.lon, city: geo.city || 'Unknown', country: geo.country || 'Unknown',
            isp: geo.isp || 'Unknown', org: geo.org || 'Unknown', as: geo.as || 'Unknown', type: 'self_track',
          });
        } else {
          setSelfTrackError(t('Couldn’t work out your location from your IP.'));
        }
      })
      .catch(() => { setSelfTracking(false); setSelfTrackError(t('Couldn’t reach the location service. Check your connection and try again.')); });
  }, [onScanGeolocate, t]);

  const listProps = { activeTool, onPick: (id: string) => openTool(id), onSelfTrack: handleSelfTrack, selfTracking };
  // Said once, before anything is typed; hidden while a lookup's own sign-in notice is showing.
  const askToSignIn = !lookup.signedIn && !lookup.isSignInError && fingerprint.error !== SIGN_IN_REQUIRED;

  const body = (
    <div ref={rootRef}>
      {tool ? (
        <ReconToolView
          tool={tool} lookup={lookup} autoFocus={!isMobile && !isFullScreen}
          onBack={backToTools}
          ownView={tool.id === 'fingerprint' ? <FingerprintSearch fp={fingerprint} isFullScreen={isFullScreen} autoFocus={!isMobile && !isFullScreen} />
            : tool.id === 'donbot' ? <DonBotScan initial={donbotQuery} onScan={setDonbotQuery} /> : null}
          results={
            <ReconResults
              lookup={lookup} isFullScreen={isFullScreen} onSweepVisualize={onSweepVisualize}
              expandedDevice={expandedDevice} setExpandedDevice={setExpandedDevice}
              fetchCveDetails={fetchCveDetails} cveCache={cveCache}
            />
          }
          onPivot={id => runTool(id, lookup.query)}
        />
      ) : (
        <ReconOverview
          lookup={lookup} isMobile={isMobile} isFullScreen={isFullScreen}
          onRun={runTool} onOpenByName={id => { lookup.setQuery(''); openTool(id, ''); }}
          selfTrackError={selfTrackError} onDismissSelfTrackError={() => setSelfTrackError('')} browseAll={browseAll} setBrowseAll={setBrowseAll}
          toolList={<ToolList {...listProps} />}
        />
      )}
    </div>
  );

  if (isMobile) return <>{body}{askToSignIn && <SignInNotice className="mt-6" />}</>;

  if (isFullScreen) {
    return (
      <ExpandedView onExit={() => setIsFullScreen(false)} footer={askToSignIn ? <SignInFooter /> : undefined}
        rail={<ToolRail filter={railFilter} setFilter={setRailFilter} {...listProps} />}>
        {body}
      </ExpandedView>
    );
  }

  return (
    <Panel
      title={t('Recon')}
      subtitle={t('Look up an IP, domain, username or phone number')}
      onClose={onClose}
      closeOnEscape={false}
      actions={<IconButton label={t('Open full screen')} icon={Maximize2} onClick={() => setIsFullScreen(true)} />}
      footer={askToSignIn ? <SignInFooter /> : undefined}
    >
      {body}
    </Panel>
  );
}

const OsintPanel = memo(OsintPanelInner);
export default OsintPanel;
