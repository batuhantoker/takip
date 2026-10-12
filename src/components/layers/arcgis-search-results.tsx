'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Database, Download, Eye, Hexagon, Loader2, MapPin, Search, Share2 } from 'lucide-react';
import type { ArcGISResult, ImportedLayer } from '@/lib/arcgis-layers';

// Helper to guess geometry type for icon
function getGeometryIcon(title: string, tags: string[] = []) {
  const t = (title + ' ' + tags.join(' ')).toLowerCase();
  if (t.includes('point') || t.includes('location') || t.includes('shelter')) return <MapPin className="w-3 h-3" />;
  if (t.includes('line') || t.includes('route') || t.includes('pipe') || t.includes('grid')) return <Share2 className="w-3 h-3" />;
  if (t.includes('poly') || t.includes('boundary') || t.includes('zone') || t.includes('area')) return <Hexagon className="w-3 h-3" />;
  return <Database className="w-3 h-3" />;
}

interface ArcGISSearchResultsProps {
  searching: boolean;
  results: ArcGISResult[];
  resultsFor: string;
  importedIds: string[];
  importedLayers: ImportedLayer[];
  importingId: string | null;
  error: string;
  handleImport: (result: ArcGISResult) => void;
}

export default function ArcGISSearchResults({
  searching,
  results,
  resultsFor,
  importedIds,
  importedLayers,
  importingId,
  error,
  handleImport,
}: ArcGISSearchResultsProps) {
  return (
    <div className="flex-1 overflow-y-auto styled-scrollbar -mx-1 px-1 space-y-1.5">
      {/* Loading skeleton */}
      {searching && (
        <div className="space-y-2 py-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton-shimmer h-[72px] rounded-lg" />
          ))}
        </div>
      )}

      {/* Result count — searching without knowing how much came back, or
          which query it belongs to, leaves the list unanchored. */}
      {!searching && results.length > 0 && (
        <div className="flex items-baseline gap-2 px-1 pb-0.5">
          <span className="text-[10px] font-mono text-white tabular-nums">
            {results.length} layer{results.length === 1 ? '' : 's'}
          </span>
          {resultsFor && (
            <span className="text-[9px] font-mono text-[var(--text-muted)] truncate">
              for &ldquo;{resultsFor}&rdquo;
            </span>
          )}
          {results.filter(r => importedIds.includes(r.id)).length > 0 && (
            <span className="ml-auto text-[9px] font-mono text-[var(--alert-green)] tabular-nums flex-shrink-0">
              {results.filter(r => importedIds.includes(r.id)).length} live
            </span>
          )}
        </div>
      )}

      {/* Results list */}
      <AnimatePresence>
        {!searching &&
          results.map((result, i) => {
            const isImported = importedIds.includes(result.id);
            const isImporting = importingId === result.id;
            const importedLayer = importedLayers.find(l => l.id === result.id);

            return (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05, duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
                className={`group flex flex-col gap-1.5 p-2.5 rounded-lg border transition-all ${
                  isImported
                    ? 'border-[var(--alert-green)]/30 bg-[var(--alert-green)]/[0.05]'
                    : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#D4AF37]/30'
                }`}
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <div
                      className="p-1.5 rounded-md bg-black/40 border border-white/10"
                      style={{ color: importedLayer?.color || '#D4AF37' }}
                    >
                      {getGeometryIcon(result.title, result.tags)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[10px] font-mono font-bold text-white leading-tight line-clamp-2" title={result.title}>
                        {result.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-mono text-[var(--text-muted)] truncate">
                          {result.owner}
                        </span>
                        <span className="text-[9px] font-mono text-[#D4AF37]/70 tabular-nums flex items-center gap-0.5">
                          <Eye className="w-2.5 h-2.5" />
                          {result.numViews?.toLocaleString() ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Import / Imported badge */}
                  {isImported ? (
                    <span
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold tracking-widest uppercase shadow-[0_0_10px_rgba(0,230,118,0.2)]"
                      style={{
                        color: importedLayer?.color || 'var(--alert-green)',
                        background: `${importedLayer?.color || 'var(--alert-green)'}15`,
                        borderWidth: 1,
                        borderColor: `${importedLayer?.color || 'var(--alert-green)'}40`,
                      }}
                    >
                      <CheckCircle className="w-3 h-3" />
                      LIVE
                    </span>
                  ) : (
                    <button
                      onClick={() => handleImport(result)}
                      disabled={isImporting || !result.url}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-mono font-bold tracking-widest uppercase transition-all disabled:opacity-40 bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20 hover:shadow-[0_0_12px_rgba(212,175,55,0.2)] active:scale-95"
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          LOADING...
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3" />
                          IMPORT
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Snippet */}
                <p className={`text-[10px] font-mono leading-relaxed line-clamp-2 mt-0.5 ${
                  result.snippet ? 'text-[var(--text-muted)]/80' : 'text-[var(--text-muted)]/40 italic'
                }`}>
                  {result.snippet || 'No description published for this layer.'}
                </p>

                {/* Tags */}
                {result.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {result.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-mono tracking-wide text-[#D4AF37]/80 bg-[#D4AF37]/10 border border-[#D4AF37]/20"
                      >
                        {tag}
                      </span>
                    ))}
                    {result.tags.length > 4 && (
                      <span className="text-[9px] font-mono text-[var(--text-muted)]/50 flex items-center px-1">
                        +{result.tags.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
      </AnimatePresence>

      {/* Empty state */}
      {!searching && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-60">
          <div className="relative">
            <Database className="w-8 h-8 text-[var(--text-muted)] opacity-50" />
            <Search className="w-4 h-4 text-[#D4AF37] absolute -bottom-1 -right-1" />
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="text-[10px] font-mono font-bold text-white tracking-wide">
              No active search
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)] max-w-[200px] leading-relaxed">
              Try searching for Power Plants, Substations, Evacuation Routes, or Pipelines in the designated area.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
