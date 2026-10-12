'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Eye, EyeOff, Palette, SlidersHorizontal, X } from 'lucide-react';
import { LAYER_COLORS, type ImportedLayer } from '@/lib/arcgis-layers';

interface ArcGISImportedLayersProps {
  importedLayers: ImportedLayer[];
  featureCounts: Record<string, number>;
  setFeatureCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  expandedLayerId: string | null;
  setExpandedLayerId: (id: string | null) => void;
  onUpdateLayer: (id: string, updates: Partial<{ color: string; visible: boolean; opacity: number }>) => void;
  onRemoveLayer: (id: string) => void;
}

export default function ArcGISImportedLayers({
  importedLayers,
  featureCounts,
  setFeatureCounts,
  expandedLayerId,
  setExpandedLayerId,
  onUpdateLayer,
  onRemoveLayer,
}: ArcGISImportedLayersProps) {
  return (
    <div className="flex flex-col gap-1.5 shrink-0">
      <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[var(--text-muted)] px-1">
        Active Data Layers
      </span>
      <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto styled-scrollbar">
        <AnimatePresence>
          {importedLayers.map((layer) => {
            const count = featureCounts[layer.id];
            const isExpanded = expandedLayerId === layer.id;
            return (
              <motion.div
                key={layer.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border overflow-hidden transition-all"
                style={{
                  borderColor: layer.visible ? `${layer.color}40` : 'rgba(255,255,255,0.06)',
                  background: layer.visible ? `${layer.color}08` : 'rgba(255,255,255,0.02)',
                }}
              >
                {/* Main layer row */}
                <div className="flex items-center gap-2 px-2.5 py-2">
                  {/* Color dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-black/30"
                    style={{ background: layer.color, opacity: layer.visible ? 1 : 0.3 }}
                  />

                  {/* Visibility toggle */}
                  <button
                    onClick={() => onUpdateLayer(layer.id, { visible: !layer.visible })}
                    className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                  >
                    {layer.visible ? (
                      <Eye className="w-3 h-3 text-white/70" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-white/30" />
                    )}
                  </button>

                  {/* Layer name */}
                  <span className={`text-[11px] font-mono font-medium truncate flex-1 ${layer.visible ? 'text-white' : 'text-white/40'}`}>
                    {layer.title}
                  </span>

                  {/* Feature count */}
                  {count !== undefined && (
                    <span
                      className="text-[9px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded"
                      style={{ color: layer.color, background: `${layer.color}15` }}
                    >
                      {count.toLocaleString()}
                    </span>
                  )}

                  {/* Expand / collapse for settings */}
                  <button
                    onClick={() => setExpandedLayerId(isExpanded ? null : layer.id)}
                    className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
                    title="Layer settings"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                  </button>

                  {/* Remove */}
                  <button
                    onClick={() => {
                      onRemoveLayer(layer.id);
                      setFeatureCounts((prev) => {
                        const next = { ...prev };
                        delete next[layer.id];
                        return next;
                      });
                      if (isExpanded) setExpandedLayerId(null);
                    }}
                    className="flex-shrink-0 p-0.5 rounded text-red-400/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Remove Layer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Expanded settings */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-2.5 pb-2.5 flex flex-col gap-2 border-t border-white/[0.06] pt-2">
                        {/* Color Swatches */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[var(--text-muted)] flex items-center gap-1">
                            <Palette className="w-2.5 h-2.5" /> Color
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {LAYER_COLORS.map((c) => (
                              <button
                                key={c}
                                onClick={() => onUpdateLayer(layer.id, { color: c })}
                                className="w-5 h-5 rounded-full transition-all hover:scale-110 ring-1 ring-black/40 relative"
                                style={{ background: c }}
                                title={c}
                              >
                                {layer.color === c && (
                                  <span className="absolute inset-0 flex items-center justify-center">
                                    <CheckCircle className="w-3 h-3 text-black/70" />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Opacity Slider */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[var(--text-muted)] flex items-center gap-1">
                              <Eye className="w-2.5 h-2.5" /> Opacity
                            </span>
                            <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: layer.color }}>
                              {Math.round(layer.opacity * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(layer.opacity * 100)}
                            onChange={(e) => onUpdateLayer(layer.id, { opacity: parseInt(e.target.value) / 100 })}
                            className="w-full h-1 rounded-full appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, ${layer.color} ${layer.opacity * 100}%, rgba(255,255,255,0.1) ${layer.opacity * 100}%)`,
                              accentColor: layer.color,
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
