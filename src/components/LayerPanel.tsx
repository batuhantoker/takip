'use client';

import { motion } from 'framer-motion';
import {
  Plane, Satellite, Activity, Globe, Radio, Eye, EyeOff,
  Shield, Crosshair, Sun, Ship, Radar, AlertTriangle, MapPin,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   OSIRIS — Layer Control Panel
   Toggle data layers with counts
   ═══════════════════════════════════════════════════════════════ */

interface LayerPanelProps {
  data: any;
  activeLayers: Record<string, boolean>;
  setActiveLayers: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
}

const LAYER_CONFIG = [
  { key: 'flights', label: 'Commercial Flights', icon: Plane, color: '#00E5FF', dataKey: 'commercial_flights' },
  { key: 'private', label: 'Private Aircraft', icon: Plane, color: '#00E676', dataKey: 'private_flights' },
  { key: 'jets', label: 'Private Jets', icon: Plane, color: '#FF69B4', dataKey: 'private_jets' },
  { key: 'military', label: 'Military Flights', icon: Shield, color: '#FF3D3D', dataKey: 'military_flights' },
  { key: 'satellites', label: 'Satellites', icon: Satellite, color: '#D4AF37', dataKey: 'satellites' },
  { key: 'earthquakes', label: 'Earthquakes (24h)', icon: Activity, color: '#FF9500', dataKey: 'earthquakes' },
  { key: 'global_incidents', label: 'Global Incidents', icon: AlertTriangle, color: '#FF3D3D', dataKey: 'gdelt' },
  { key: 'gps_jamming', label: 'GPS Jamming', icon: Radio, color: '#FF4444', dataKey: 'gps_jamming' },
  { key: 'day_night', label: 'Day / Night Cycle', icon: Sun, color: '#448AFF', dataKey: null },
];

export default function LayerPanel({ data, activeLayers, setActiveLayers }: LayerPanelProps) {
  const toggle = (key: string) => {
    setActiveLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getCount = (dataKey: string | null): number | null => {
    if (!dataKey || !data[dataKey]) return null;
    return Array.isArray(data[dataKey]) ? data[dataKey].length : null;
  };

  const totalEntities = LAYER_CONFIG.reduce((sum, l) => {
    const count = getCount(l.dataKey);
    return sum + (count || 0);
  }, 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
      className="glass-panel p-4 pointer-events-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          <span className="hud-text text-[10px] text-[var(--text-primary)]">DATA LAYERS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-[var(--text-muted)]">
            {totalEntities.toLocaleString()} ENTITIES
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--alert-green)] animate-osiris-pulse" />
        </div>
      </div>

      {/* Layer Toggles */}
      <div className="space-y-1">
        {LAYER_CONFIG.map((layer) => {
          const Icon = layer.icon;
          const isActive = activeLayers[layer.key];
          const count = getCount(layer.dataKey);

          return (
            <button
              key={layer.key}
              onClick={() => toggle(layer.key)}
              className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-[var(--hover-accent)] border border-[var(--border-primary)]'
                  : 'border border-transparent hover:bg-[var(--hover-accent)] hover:border-[var(--border-secondary)]'
              }`}
            >
              <Icon
                className="w-3.5 h-3.5 flex-shrink-0 transition-colors"
                style={{ color: isActive ? layer.color : 'var(--text-muted)' }}
              />
              <span className={`text-[9px] font-mono tracking-wider flex-1 text-left transition-colors ${
                isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
              }`}>
                {layer.label}
              </span>
              {count !== null && (
                <span className="text-[8px] font-mono tabular-nums" style={{ color: isActive ? layer.color : 'var(--text-muted)' }}>
                  {count.toLocaleString()}
                </span>
              )}
              <div className={`layer-toggle ${isActive ? 'active' : ''}`} />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
