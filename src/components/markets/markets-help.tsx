'use client';

import { FUNCTIONS } from '@/lib/markets';
import { T } from '@/lib/markets-terminal';

export default function MarketsHelp() {
  return (
    <div className="p-2.5 rounded-lg border border-[var(--border-secondary)] bg-white/[0.02] text-[10px] font-mono leading-relaxed space-y-2" style={{ color: T.dim }}>
      <div className="text-[9px] tracking-widest" style={{ color: T.accent }}>TYPE A FUNCTION OR A SECURITY, THEN GO</div>
      <table className="w-full">
        <tbody>
          {FUNCTIONS.map(f => (
            <tr key={f.code}>
              <td className="pr-2 w-16 font-bold whitespace-nowrap" style={{ color: T.accent }}>{f.key} · {f.code}</td>
              <td style={{ color: T.text }}>{f.title}</td>
              <td className="text-right" style={{ color: T.faint }}>{f.aliases.slice(0, 2).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        Securities by ticker or name: <span style={{ color: T.text }}>LMT</span>, <span style={{ color: T.text }}>lmt us equity</span>, <span style={{ color: T.text }}>gold</span>, <span style={{ color: T.text }}>eurusd</span>, <span style={{ color: T.text }}>nikkei</span>.
        ↑↓ picks a suggestion, Esc clears, ★ adds a row to WATCH, and a column head sorts.
      </div>
    </div>
  );
}
