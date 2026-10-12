'use client';

import { Bitcoin, AlertTriangle, Layers, Network, Clock } from 'lucide-react';
import { ResultRow, SectionHeader, type ToolResultProps } from './result-primitives';

// Shares /api/osint/crypto with the standalone CHAIN panel; this is the
// in-toolkit view of the same wallet report.
export function CryptoResult({ r }: ToolResultProps) {
  const ACCENT = '#F7931A';
  const RISK_COLOR: Record<string, string> = {
    critical: '#FF1744', high: '#FF3D3D', medium: '#FF9500', low: '#FFD700', info: '#00E676',
  };
  const riskColor = RISK_COLOR[r.risk?.level] || '#00E676';
  const fmt = (n: number, d = 4) =>
    typeof n === 'number' && Number.isFinite(n)
      ? n.toLocaleString(undefined, { maximumFractionDigits: d })
      : '—';
  const short = (a: string) => (a && a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a);

  return (
    <div>
      <SectionHeader title="CHAIN INTEL" icon={Bitcoin} color={ACCENT} />

      {/* A sanctions hit dominates the report — surface it before anything else. */}
      {r.sanctions?.hit && (
        <div className="mb-2 px-2 py-2 rounded border border-red-500/40 bg-red-500/15">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] font-mono font-bold text-red-400 tracking-wider">
              OFAC SANCTIONED WALLET
            </span>
          </div>
          {(r.sanctions.entries || []).map((e: any, i: number) => (
            <div key={i} className="text-[10px] font-mono text-red-200 break-all leading-tight">
              ↳ {e.name}{e.programs?.length ? ` — ${e.programs.join(', ')}` : ''}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
          style={{ color: ACCENT, borderColor: `${ACCENT}55`, background: `${ACCENT}18` }}>
          {r.chain_label?.toUpperCase()}
        </span>
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
          style={{ color: riskColor, borderColor: `${riskColor}55`, background: `${riskColor}18` }}>
          RISK {r.risk?.score} · {String(r.risk?.level || '').toUpperCase()}
        </span>
      </div>

      <ResultRow label="Address" value={r.address} color={ACCENT} />
      <ResultRow label="Balance" value={`${fmt(r.balance?.native, 8)} ${r.symbol}`} color="#00E676" />
      <ResultRow
        label="Value (USD)"
        value={r.balance?.usd != null ? `$${fmt(r.balance.usd, 2)}` : 'price unavailable'}
      />
      <ResultRow label="Spot price" value={r.balance?.price_usd != null ? `$${fmt(r.balance.price_usd, 2)}` : null} />
      <ResultRow label="Transactions" value={r.activity?.tx_count?.toLocaleString()} />
      <ResultRow label="Last active" value={r.activity?.last_seen ? `${String(r.activity.last_seen).slice(0, 10)} (${r.activity.dormant_days}d ago)` : null} />
      {/* age_days is withheld by the API whenever the sample cannot prove it. */}
      <ResultRow
        label="Age"
        value={r.activity?.age_days != null ? `${r.activity.age_days} days` : 'unknown — history exceeds sample'}
        color={r.activity?.age_days != null ? undefined : 'var(--text-muted)'}
      />
      {r.ambiguous_chain && (
        <ResultRow label="Note" value="Address format is valid on both Bitcoin and Solana; assumed Bitcoin." color="#FFD700" />
      )}

      {r.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.labels.map((l: string, i: number) => (
            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-white/15 text-[var(--text-secondary)] bg-white/5">
              {l}
            </span>
          ))}
        </div>
      )}

      {r.flow && (
        <>
          <SectionHeader title="FLOW" icon={Layers} color={ACCENT} />
          <ResultRow label="Total in" value={`${fmt(r.flow.total_in)} ${r.symbol}`} color="#00E676" />
          <ResultRow label="Total out" value={`${fmt(r.flow.total_out)} ${r.symbol}`} color="#FF9500" />
          <ResultRow label="Net" value={`${fmt(r.flow.net)} ${r.symbol}`} />
        </>
      )}

      {r.risk?.factors?.length > 0 && (
        <>
          <SectionHeader title="RISK FACTORS" icon={AlertTriangle} color={riskColor} />
          {r.risk.factors.map((f: any, i: number) => (
            <div key={i} className="py-1.5 border-b border-[var(--border-secondary)]/20 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold" style={{ color: RISK_COLOR[f.severity] || '#00E676' }}>
                  {f.label}
                </span>
                {f.weight > 0 && (
                  <span className="text-[9px] font-mono text-[var(--text-muted)]">+{f.weight}</span>
                )}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-secondary)] leading-snug mt-0.5">{f.detail}</div>
            </div>
          ))}
        </>
      )}

      {r.counterparties?.length > 0 && (
        <>
          <SectionHeader title={`TOP COUNTERPARTIES (${r.counterparties.length})`} icon={Network} color={ACCENT} />
          {r.counterparties.slice(0, 10).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-[10px] font-mono">
              <span className={`w-[34px] flex-shrink-0 font-bold ${c.direction === 'out' ? 'text-[#FF9500]' : c.direction === 'in' ? 'text-[#00E676]' : 'text-[var(--text-muted)]'}`}>
                {c.direction === 'out' ? 'OUT' : c.direction === 'in' ? 'IN' : 'BOTH'}
              </span>
              <span className="flex-1 break-all text-[var(--text-primary)]">{short(c.address)}</span>
              <span className="text-[var(--text-muted)]">{c.txs}×</span>
              <span className="text-[var(--text-secondary)] w-[70px] text-right">{fmt(c.value)}</span>
            </div>
          ))}
        </>
      )}

      {r.tokens?.length > 0 && (
        <>
          <SectionHeader title={`TOKENS (${r.tokens.length})`} icon={Layers} color={ACCENT} />
          <div className="flex flex-wrap gap-1">
            {r.tokens.slice(0, 20).map((t: any, i: number) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-white/15 bg-white/5 text-[var(--text-secondary)]">
                {t.symbol}{t.amount != null ? ` ${fmt(t.amount, 2)}` : ''}
              </span>
            ))}
          </div>
        </>
      )}

      {r.transactions?.length > 0 && (
        <>
          <SectionHeader title={`RECENT TRANSACTIONS (${r.transactions.length})`} icon={Clock} color={ACCENT} />
          {r.transactions.slice(0, 12).map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-[10px] font-mono">
              <span className={`w-[34px] flex-shrink-0 font-bold ${t.direction === 'out' ? 'text-[#FF9500]' : t.direction === 'in' ? 'text-[#00E676]' : 'text-[var(--text-muted)]'}`}>
                {t.direction === 'unknown' ? '—' : t.direction.toUpperCase()}
              </span>
              <span className="text-[var(--text-muted)] w-[64px] flex-shrink-0">{t.time ? String(t.time).slice(0, 10) : 'pending'}</span>
              <span className="flex-1 break-all text-[var(--text-primary)]">{short(t.hash)}</span>
              {t.failed && <span className="text-[#FF3D3D]">FAIL</span>}
              {t.value > 0 && <span className="text-[var(--text-secondary)]">{fmt(t.value)}</span>}
            </div>
          ))}
        </>
      )}

      {/* Honesty rail: what this report could not establish. */}
      {r.partial?.length > 0 && (
        <div className="mt-3 px-2 py-1.5 rounded border border-white/10 bg-white/[0.03]">
          <span className="text-[10px] font-mono text-[var(--text-muted)] block mb-0.5">COVERAGE LIMITS</span>
          {r.partial.map((p: string, i: number) => (
            <div key={i} className="text-[10px] font-mono text-[var(--text-secondary)] leading-snug">↳ {p}</div>
          ))}
        </div>
      )}

      <div className="mt-2 text-[9px] font-mono text-[var(--text-muted)]">
        Sources: {(r.sources || []).join(' · ')}
        {r.activity && ` · sampled ${r.activity.sample_size} tx${r.activity.history_complete ? ' (full history)' : ' of a longer history'}`}
      </div>
    </div>
  );
}
