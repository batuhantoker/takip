'use client';

import { AlertTriangle, ShieldAlert, ExternalLink } from 'lucide-react';
import { ResultRow, SectionHeader, renderFallbackExcluding, type ToolResultProps } from './result-primitives';

export function ThreatsResult({ r, query }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="THREAT INTELLIGENCE" icon={AlertTriangle} color="#FF9500" />
      <ResultRow label="Query" value={query} color="#FF9500" />
      <ResultRow label="Risk Score" value={r.risk_score || r.score} color={
        (r.risk_score || r.score || 0) > 70 ? '#FF3D3D' : (r.risk_score || r.score || 0) > 40 ? '#FF9500' : '#00E676'
      } />
      <ResultRow label="Malicious" value={r.malicious !== undefined ? (r.malicious ? 'YES' : 'NO') : undefined} color={r.malicious ? '#FF3D3D' : '#00E676'} />
      <ResultRow label="Category" value={r.category || r.type} />
      <ResultRow label="Reports" value={r.total_reports || r.reports} />
      <ResultRow label="Last Seen" value={r.last_seen || r.last_analysis} />
      {r.tags && <ResultRow label="Tags" value={Array.isArray(r.tags) ? r.tags.join(', ') : r.tags} />}
      {renderFallbackExcluding(r, ['risk_score','score','malicious','category','type','total_reports','reports','last_seen','last_analysis','tags','timestamp','cached','query'])}
    </div>
  );
}

export function LeaksResult({ r }: ToolResultProps) {
  return (
    <div>
      <SectionHeader title="DATA LEAK SWEEP" icon={ShieldAlert} color="#E040FB" />
      <ResultRow label="Email Target" value={r.email} color="#E040FB" />
      <ResultRow label="Status" value={r.breached ? 'COMPROMISED' : 'SECURE'} color={r.breached ? '#FF1744' : '#00E676'} />
      
      {r.breached && r.data_exposed?.length > 0 && (
        <div className="mt-2 p-2 border border-[#E040FB]/30 bg-[#E040FB]/10 rounded">
          <span className="text-[11px] font-mono text-[#E040FB] font-bold mb-1 block">EXPOSED DATA POINTS</span>
          <div className="flex flex-wrap gap-1">
            {r.data_exposed.map((dc: string) => (
              <span key={dc} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A18] text-[#E8E6E0] border border-[#E040FB]/20">{dc}</span>
            ))}
          </div>
        </div>
      )}

      {r.breached && r.breaches?.length > 0 && (
        <div className="mt-2 p-2 border border-red-500/30 bg-red-500/10 rounded">
          <span className="text-[11px] font-mono text-red-400 font-bold mb-1 block">KNOWN BREACHES ({r.breaches.length})</span>
          <div className="flex flex-col gap-1">
            {r.breaches.map((b: string) => (
              <a key={b} href={`https://haveibeenpwned.com/PwnedWebsites#${b}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono px-2 py-1 rounded bg-[#1A1A18] text-red-300 hover:text-white hover:bg-red-500/30 flex items-center justify-between transition-colors">
                <span>{b}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
