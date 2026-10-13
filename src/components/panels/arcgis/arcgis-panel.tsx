'use client';

import { useCallback, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { SearchField } from '@/components/ui/search-field';
import { Tooltip } from '@/components/ui/tooltip';
import { Dot } from '@/components/ui/tag';
import { toBboxParam, type ArcGISResult, type ImportedLayer } from '@/lib/layers/arcgis';
import ArcGISImportedLayers from './arcgis-imported-layers';
import ArcGISSearchResults from './arcgis-search-results';
import { nextLayerColor } from './arcgis-palette';

type Bounds = { west: number; south: number; east: number; north: number };

export interface ArcGISPanelProps {
  onImportLayer: (layer: { id: string; title: string; url: string; geojson: any; color?: string; opacity?: number }) => void;
  onRemoveLayer: (id: string) => void;
  onUpdateLayer: (id: string, updates: Partial<{ color: string; visible: boolean; opacity: number }>) => void;
  importedLayers: ImportedLayer[];
  mapBounds?: Bounds | null;
  onClose?: () => void;
}

type Health = { state: 'idle' | 'busy' | 'ok' | 'error'; ms?: number };

const coord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;
const extentText = (b: Bounds) => `${coord(b.north, 'N', 'S')} ${coord(b.west, 'E', 'W')} to ${coord(b.south, 'N', 'S')} ${coord(b.east, 'E', 'W')}`;

type Again = { kind: 'search'; q: string } | { kind: 'import'; result: ArcGISResult };

const PLAIN: [RegExp, string][] = [
  [/^(rate_limited|rate limit exceeded)$/i, 'Too many requests in a short time. Wait a minute, then try again.'],
  [/^quota_exceeded$/i, 'You’ve reached your usage limit for now.'],
  [/feature service layer url/i, 'That item isn’t a public feature service, so it can’t be drawn.'],
];

async function getJson(params: URLSearchParams, fallback: string) {
  const res = await fetch(`/api/v1/arcgis?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // 4xx messages say what was wrong with the request; upstream failures only carry a status code.
    const said = res.status < 500 && typeof body.error === 'string' ? body.error : '';
    throw new Error(PLAIN.find(([re]) => re.test(said))?.[1] ?? (said || fallback));
  }
  return res.json();
}

export default function ArcGISPanel({ onImportLayer, onRemoveLayer, onUpdateLayer, importedLayers, mapBounds, onClose }: ArcGISPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArcGISResult[] | null>(null);
  // What the visible results came from; `query` changes as soon as someone types the next search.
  const [resultsFor, setResultsFor] = useState('');
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; again: Again } | null>(null);
  const [health, setHealth] = useState<Health>({ state: 'idle' });
  const lastSearch = useRef('');

  const bboxParam = toBboxParam(mapBounds);

  const runSearch = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    lastSearch.current = q;
    setSearching(true);
    setError(null);
    setHealth({ state: 'busy' });
    const t0 = performance.now();
    try {
      const params = new URLSearchParams({ q });
      if (bboxParam) params.set('bbox', bboxParam);
      const data = await getJson(params, 'ArcGIS Online didn’t answer the search.');
      if (lastSearch.current !== q) return;
      setResults(data.results || []);
      setResultsFor(q);
      setHealth({ state: 'ok', ms: Math.round(performance.now() - t0) });
    } catch (err: any) {
      setError({ message: err.message || 'The search didn’t finish.', again: { kind: 'search', q } });
      setHealth({ state: 'error' });
    } finally {
      if (lastSearch.current === q) setSearching(false);
    }
  }, [bboxParam]);

  const handleImport = useCallback(async (result: ArcGISResult) => {
    if (!result.url) return;
    setImportingId(result.id);
    setError(null);
    try {
      const params = new URLSearchParams({ service: result.url });
      if (bboxParam) params.set('bbox', bboxParam);
      const geojson = await getJson(params, 'That layer didn’t load. Its service may be down or private.');
      onImportLayer({ id: result.id, title: result.title, url: result.url, geojson, color: nextLayerColor(importedLayers.map(l => l.color)), opacity: 0.8 });
      setHealth(h => ({ ...h, state: 'ok' }));
    } catch (err: any) {
      setError({ message: err.message || 'That layer didn’t load.', again: { kind: 'import', result } });
    } finally {
      setImportingId(null);
    }
  }, [bboxParam, onImportLayer, importedLayers]);

  const clearResults = () => { setResults(null); setResultsFor(''); setQuery(''); };
  const retry = () => { if (error?.again.kind === 'search') runSearch(error.again.q); else if (error) handleImport(error.again.result); };

  return (
    <Panel
      title="ArcGIS layers"
      subtitle="Search public ArcGIS services and add them to the map"
      onClose={onClose}
      footer={<HealthLine health={health} />}
    >
      <SearchField
        value={query}
        onChange={setQuery}
        onKeyDown={e => { if (e.key === 'Enter') runSearch(query); }}
        placeholder="Search layers, like pipelines or substations"
        label="Search ArcGIS layers"
        autoFocus
        autoComplete="off"
      />
      <ExtentNote bounds={mapBounds ?? null} />

      <ArcGISImportedLayers
        importedLayers={importedLayers}
        onUpdateLayer={onUpdateLayer}
        onRemoveLayer={onRemoveLayer}
        onRestoreLayer={l => onImportLayer({ id: l.id, title: l.title, url: l.url, geojson: l.geojson, color: l.color, opacity: l.opacity })}
      />

      <ArcGISSearchResults
        searching={searching}
        results={results}
        resultsFor={resultsFor}
        importedLayers={importedLayers}
        importingId={importingId}
        error={error && { message: error.message, retry }}
        onDismissError={() => setError(null)}
        onImport={handleImport}
        onClear={clearResults}
        onTopic={q => { setQuery(q); runSearch(q); }}
      />
    </Panel>
  );
}

function ExtentNote({ bounds }: { bounds: Bounds | null }) {
  if (!bounds) return <p className="mt-2 text-small text-ink-3">Searching everywhere</p>;
  const extent = extentText(bounds);
  return (
    <p className="mt-2 flex items-center gap-1.5 text-small text-ink-3">
      Searching within the current map view
      <Tooltip label={<span className="font-mono tabular-nums">{extent}</span>}>
        <span tabIndex={0} aria-label={`Map view: ${extent}`}
          className="inline-flex size-4 items-center justify-center rounded-full text-ink-3 outline-none hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-accent">
          <Info aria-hidden className="size-3.5" strokeWidth={1.75} />
        </span>
      </Tooltip>
    </p>
  );
}

function HealthLine({ health }: { health: Health }) {
  if (health.state === 'busy') return <><Dot tone="accent" pulse /><span>Asking ArcGIS Online…</span></>;
  if (health.state === 'error') return <><Dot tone="red" /><span>ArcGIS Online didn’t answer. Try again in a moment.</span></>;
  if (health.state === 'ok') {
    return (
      <>
        <Dot tone="green" />
        <span>ArcGIS Online answered{health.ms != null && <> in <span className="font-mono tabular-nums">{health.ms.toLocaleString()}</span> ms</>}</span>
      </>
    );
  }
  return <><Dot tone="muted" /><span>ArcGIS Online · public services only</span></>;
}
