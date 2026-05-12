'use client';

import { motion } from 'framer-motion';
import { Globe, MapPin } from 'lucide-react';

interface ViewPresetsProps {
  onNavigate: (lat: number, lng: number, zoom: number) => void;
}

const PRESETS = [
  { label: 'GLOBAL', lat: 20, lng: 0, zoom: 2.5, emoji: '🌍' },
  { label: 'EUROPE', lat: 48, lng: 10, zoom: 4, emoji: '🇪🇺' },
  { label: 'MIDDLE EAST', lat: 30, lng: 45, zoom: 4.5, emoji: '🕌' },
  { label: 'EAST ASIA', lat: 35, lng: 120, zoom: 4, emoji: '🏯' },
  { label: 'AMERICAS', lat: 25, lng: -90, zoom: 3, emoji: '🗽' },
  { label: 'UKRAINE', lat: 49, lng: 32, zoom: 6, emoji: '🇺🇦' },
  { label: 'AFRICA', lat: 5, lng: 20, zoom: 3.5, emoji: '🌍' },
  { label: 'S.E. ASIA', lat: 10, lng: 110, zoom: 4.5, emoji: '🌏' },
  { label: 'ARCTIC', lat: 75, lng: 0, zoom: 3.5, emoji: '❄️' },
  { label: 'INDIA', lat: 22, lng: 78, zoom: 4.5, emoji: '🇮🇳' },
];

export default function ViewPresets({ onNavigate }: ViewPresetsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.7, duration: 0.6 }}
      className="glass-panel p-2.5 pointer-events-auto"
    >
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-3 h-3 text-[var(--gold-primary)]" />
        <span className="hud-text text-[8px] text-[var(--text-primary)] tracking-widest">REGION PRESETS</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => onNavigate(p.lat, p.lng, p.zoom)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[7px] font-mono tracking-wider text-[var(--text-muted)] border border-transparent hover:border-[var(--border-primary)] hover:bg-[var(--hover-accent)] hover:text-[var(--gold-primary)] transition-all"
          >
            <span>{p.emoji}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
