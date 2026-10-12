'use client';

import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { ReconData } from '@/lib/recon-lookup';

export interface ToolResultProps { r: ReconData; query: string; scanType: string }

// ── Shodan-style structured result renderers ──

export const ResultRow = ({ label, value, color, mono = true }: { label: string; value: any; color?: string; mono?: boolean }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-[var(--border-secondary)]/20 last:border-0">
      <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider w-[90px] flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-[11px] ${mono ? 'font-mono' : ''} break-all flex-1`} style={{ color: color || 'var(--text-primary)' }}>
        {String(value)}
      </span>
    </div>
  );
};

const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${ok ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
    {ok ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
    {label}
  </span>
);

// Surfaces an inline OFAC-SDN hit (used by the WHOIS and IP-intel routes
// when their cross-check finds a sanctioned registrant / ASN owner).
export const SanctionsBadge = ({ match }: { match: any }) => {
  if (!match || !Array.isArray(match.hits) || match.hits.length === 0) return null;
  return (
    <div className="mb-2 px-2 py-2 rounded border border-red-500/40 bg-red-500/15">
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
        <span className="text-[11px] font-mono font-bold text-red-400 tracking-wider">
          SANCTIONED — {match.source || 'OFAC SDN'}
        </span>
      </div>
      {match.hits.slice(0, 5).map((h: any, i: number) => (
        <div key={i} className="text-[10px] font-mono text-red-200 break-all leading-tight">
          <span className="text-[var(--text-muted)]">↳ {h.matched_value}:</span>{' '}
          {(h.entries || []).slice(0, 2).map((e: any) => e.name).join('; ')}
        </div>
      ))}
    </div>
  );
};

export const SectionHeader = ({ title, icon: Icon, color }: { title: string; icon: any; color: string }) => (
  <div className="flex items-center gap-2 mt-3 mb-1.5 first:mt-0">
    <Icon className="w-3.5 h-3.5" style={{ color }} />
    <span className="text-[11px] font-mono font-bold tracking-widest" style={{ color }}>{title}</span>
    <div className="flex-1 h-px" style={{ background: `${color}30` }} />
  </div>
);

export const PortRow = ({ port, state, service, version }: { port: number; state: string; service?: string; version?: string }) => (
  <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--hover-accent)] transition-colors">
    <span className="text-[10px] font-mono font-bold text-[var(--cyan-primary)] w-[60px]">{port}</span>
    <StatusBadge ok={state === 'open'} label={state.toUpperCase()} />
    <span className="text-[11px] font-mono text-[var(--text-secondary)] flex-1">{service || 'unknown'}</span>
    {version && <span className="text-[10px] font-mono text-[var(--text-muted)]">{version}</span>}
  </div>
);

export const renderFallback = (results: ReconData) => {
  if (!results) return null;
  return (
    <div className="space-y-1">
      {Object.entries(results).filter(([k]) => !['timestamp','cached'].includes(k)).map(([key, value]) => (
        <ResultRow key={key} label={key.replace(/_/g, ' ')} value={typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value)} />
      ))}
    </div>
  );
};

export const renderFallbackExcluding = (results: ReconData, exclude: string[]) => {
  if (!results) return null;
  const extra = Object.entries(results).filter(([k]) => !exclude.includes(k));
  if (extra.length === 0) return null;
  return (
    <div className="mt-2 space-y-1">
      {extra.map(([key, value]) => (
        <ResultRow key={key} label={key.replace(/_/g, ' ')} value={typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value)} />
      ))}
    </div>
  );
};
