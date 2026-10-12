'use client';

import { History } from 'lucide-react';
import { relativeTime } from '@/lib/fingerprint';
import type { FingerprintState } from './use-fingerprint-search';

export function FingerprintHistory({ fp, isFullScreen }: { fp: FingerprintState; isFullScreen: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border-primary)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-primary)]/40">
        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-widest text-[var(--text-secondary)]">
          <History className="w-3 h-3" /> SEARCH HISTORY
        </span>
        <span className="flex items-center gap-2 text-[9px] font-mono text-[var(--text-muted)]">
          {fp.history.length} searches
          <button onClick={fp.clearHistory} className="hover:text-white underline-offset-2 hover:underline">clear</button>
        </span>
      </div>
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr className="text-[9px] tracking-wider text-[var(--text-muted)]">
            <th className="text-left font-normal px-3 py-1.5">QUERY</th>
            <th className="text-left font-normal px-1 py-1.5">TYPE</th>
            <th className="text-right font-normal px-1 py-1.5">#</th>
            <th className="text-left font-normal px-2 py-1.5">STATUS</th>
            {isFullScreen && <th className="text-right font-normal px-3 py-1.5">TIME</th>}
          </tr>
        </thead>
        <tbody>
          {fp.history.slice(0, isFullScreen ? 12 : 6).map((h, i) => (
            <tr
              key={`${h.at}-${i}`}
              onClick={() => fp.run(h.type, h.query)}
              className="border-t border-[var(--border-primary)]/50 cursor-pointer hover:bg-[var(--hover-accent)]"
              title={`Search ${h.query} again`}
            >
              <td className="px-3 py-1.5 text-[var(--text-primary)] truncate max-w-[140px]">{h.query}</td>
              <td className="px-1 py-1.5 text-[var(--text-muted)]">{h.type}</td>
              <td className="px-1 py-1.5 text-right text-[var(--text-secondary)]">{h.count}</td>
              <td className="px-2 py-1.5">
                <span style={{ color: h.status === 'done' ? '#00E676' : h.status === 'stopped' ? '#FF9500' : '#FF3D3D' }}>
                  {h.status === 'fail' ? 'fail' : h.status}
                </span>
              </td>
              {isFullScreen && <td className="px-3 py-1.5 text-right text-[var(--text-muted)]">{relativeTime(h.at)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
