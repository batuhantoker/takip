'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  X,
  Search,
  Loader2,
  AlertTriangle,
  Globe,
  Radio,
  Wifi,
} from 'lucide-react';
import { CATEGORIES, countFeatures, pickLayerColor, toBboxParam, type ArcGISResult, type ImportedLayer } from '@/lib/arcgis-layers';
import ArcGISImportedLayers from './arcgis-imported-layers';
import ArcGISSearchResults from './arcgis-search-results';

/* ═══════════════════════════════════════════════════════════════
   ArcGIS Search & Import Panel — TAKIP OSINT Dashboard
   Premium dark-ops glassmorphism aesthetic
   ═══════════════════════════════════════════════════════════════ */

export interface ArcGISPanelProps {
  onImportLayer: (layer: { id: string; title: string; url: string; geojson: any; color?: string; opacity?: number }) => void;
  onRemoveLayer: (id: string) => void;
  onUpdateLayer: (id: string, updates: Partial<{ color: string; visible: boolean; opacity: number }>) => void;
  importedLayers: ImportedLayer[];
  mapBounds?: { west: number; south: number; east: number; north: number } | null;
}

export default function ArcGISPanel({
  onImportLayer,
  onRemoveLayer,
  onUpdateLayer,
  importedLayers,
  mapBounds,
}: ArcGISPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ArcGISResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [featureCounts, setFeatureCounts] = useState<Record<string, number>>({});
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);
  // The query the visible results actually came from. Reading `query` here
  // would relabel the list the moment someone starts typing the next search.
  const [resultsFor, setResultsFor] = useState('');

  const importedIds = importedLayers.map(l => l.id);

  const bboxParam = toBboxParam(mapBounds);

  const runSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) return;
      setSearching(true);
      setError('');
      setResults([]);

      try {
        const params = new URLSearchParams({ q: searchQuery });
        if (bboxParam) params.set('bbox', bboxParam);

        const res = await fetch(`/api/arcgis?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Search failed (${res.status})`);
        }

        const data = await res.json();
        setResults(data.results || []);
        setResultsFor(searchQuery);
      } catch (err: any) {
        setError(err.message || 'Search failed');
      } finally {
        setSearching(false);
      }
    },
    [bboxParam],
  );

  const handleImport = useCallback(
    async (result: ArcGISResult) => {
      if (!result.url) return;
      setImportingId(result.id);
      setError('');

      try {
        const params = new URLSearchParams({ service: result.url });
        if (bboxParam) params.set('bbox', bboxParam);

        const res = await fetch(`/api/arcgis?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Import failed (${res.status})`);
        }

        const geojson = await res.json();
        const count = countFeatures(geojson);

        setFeatureCounts((prev) => ({ ...prev, [result.id]: count }));
        const availableColor = pickLayerColor(importedLayers);
        onImportLayer({ id: result.id, title: result.title, url: result.url, geojson, color: availableColor, opacity: 0.8 });
      } catch (err: any) {
        setError(err.message || 'Import failed');
      } finally {
        setImportingId(null);
      }
    },
    [bboxParam, onImportLayer, importedLayers],
  );

  const handleCategory = (cat: (typeof CATEGORIES)[number]) => {
    const isActive = activeCategory === cat.label;
    setActiveCategory(isActive ? null : cat.label);
    if (!isActive) {
      setQuery(cat.query);
      runSearch(cat.query);
    }
  };

  const totalFeatures = Object.values(featureCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Prominent Stats Header ───────────────────────────────── */}
      <div className="flex items-center justify-between bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg p-2.5">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#D4AF37]" />
          <span className="text-[11px] font-mono font-bold tracking-[0.2em] text-[#D4AF37] uppercase">
            ArcGIS Intel
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-[#D4AF37]/80 uppercase tracking-widest">
            {importedLayers.length} Layers Active
          </div>
          <div className="text-[10px] font-mono font-bold text-[#D4AF37] tabular-nums">
            {totalFeatures.toLocaleString()} Features
          </div>
        </div>
      </div>

      {/* ── Current Map Extent Indicator ─────────────────────────── */}
      {mapBounds && (
        <div className="flex items-center gap-2 px-2 py-1 rounded border border-white/[0.04] bg-white/[0.02]">
          <Globe className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider flex-1">
            Map Extent:
          </span>
          <span className="text-[9px] font-mono text-[var(--text-muted)] tabular-nums truncate max-w-[150px]">
            {mapBounds.west.toFixed(2)}, {mapBounds.south.toFixed(2)} to {mapBounds.east.toFixed(2)}, {mapBounds.north.toFixed(2)}
          </span>
        </div>
      )}

      {/* ── Active Imported Layers (TOP) ─────────────────────────── */}
      {importedLayers.length > 0 && (
        <ArcGISImportedLayers
          importedLayers={importedLayers}
          featureCounts={featureCounts}
          setFeatureCounts={setFeatureCounts}
          expandedLayerId={expandedLayerId}
          setExpandedLayerId={setExpandedLayerId}
          onUpdateLayer={onUpdateLayer}
          onRemoveLayer={onRemoveLayer}
        />
      )}

      {/* ── Search Bar ────────────────────────────────────────── */}
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveCategory(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && runSearch(query)}
          placeholder="Search ArcGIS layers..."
          className="w-full bg-black/60 border border-white/10 rounded-lg pl-8 pr-16 py-2.5 text-[10px] font-mono text-white placeholder:text-[var(--text-muted)]/40 focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
        />
        <button
          onClick={() => runSearch(query)}
          disabled={searching || !query.trim()}
          className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md text-[10px] font-mono font-bold tracking-widest uppercase disabled:opacity-30 transition-all bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/20"
        >
          {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'SCAN'}
        </button>
      </div>

      {/* ── Category Quick Filters ────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => handleCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-[9px] font-mono tracking-[0.1em] uppercase transition-all border ${
              activeCategory === cat.label
                ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                : 'bg-white/[0.03] border-white/[0.08] text-[var(--text-muted)] hover:bg-white/[0.06] hover:border-white/20'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Error ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-[11px] font-mono text-red-400 shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate flex-1">{error}</span>
            <button onClick={() => setError('')} className="p-1 rounded hover:bg-red-500/20 opacity-80 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search Results ────────────────────────────────────── */}
      <ArcGISSearchResults
        searching={searching}
        results={results}
        resultsFor={resultsFor}
        importedIds={importedIds}
        importedLayers={importedLayers}
        importingId={importingId}
        error={error}
        handleImport={handleImport}
      />

      {/* ── Status Bar ────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-[#D4AF37]" />
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#D4AF37]/80">
            ArcGIS PUBLIC
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
            Connection Health
          </span>
          <div className="relative flex items-center justify-center">
            <Wifi className={`w-3 h-3 ${searching ? 'text-[#D4AF37]' : 'text-[var(--alert-green)]'}`} />
            <span
              className={`absolute top-0 right-0 w-1.5 h-1.5 rounded-full ${
                searching
                  ? 'bg-[#D4AF37] animate-ping'
                  : 'bg-[var(--alert-green)] animate-pulse'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
