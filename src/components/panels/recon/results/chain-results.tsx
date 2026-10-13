'use client';

import { AlertTriangle } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { ResultRow, SEVERITY_TONE, Verdict, day, fromNow, plain, type ToolResultProps } from './result-primitives';

// Shares /api/osint/crypto with the standalone chain panel; this is Recon's view of the same wallet report.
export function CryptoResult({ r }: ToolResultProps) {
  const level: string | undefined = r.risk?.level;
  const fmt = (n: number, d = 4) =>
    typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : '—';
  const short = (a: string) => (a && a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a);

  return (
    <div>
      {r.sanctions?.hit && (
        <div className="mb-3 rounded-card border border-red/35 bg-red/10 p-2.5">
          <div className="mb-1.5 flex items-center gap-2 text-small font-medium text-red">
            <AlertTriangle aria-hidden className="size-3.5" strokeWidth={1.75} />
            Sanctioned by OFAC
          </div>
          {(r.sanctions.entries || []).map((e: any, i: number) => (
            <div key={i} className="break-words text-small text-ink-1">
              {e.name}{e.programs?.length ? ` — ${e.programs.join(', ')}` : ''}
            </div>
          ))}
        </div>
      )}

      <Verdict tone={level ? SEVERITY_TONE(level) : undefined} title={level ? `${plain(level)} risk` : 'Not scored'}
        body={<>{r.chain_label ? `${r.chain_label} wallet · ` : ''}risk score <span className="font-mono tabular-nums">{r.risk?.score ?? 0}</span></>} />

      <PanelSection title="Wallet">
        <ResultRow label="Address" value={r.address} mono />
        <ResultRow label="Balance" value={`${fmt(r.balance?.native, 8)} ${r.symbol}`} mono />
        <ResultRow label="Value" value={r.balance?.usd != null ? `$${fmt(r.balance.usd, 2)}` : 'No price available'} mono={r.balance?.usd != null} />
        <ResultRow label="Spot price" value={r.balance?.price_usd != null ? `$${fmt(r.balance.price_usd, 2)}` : null} mono />
        <ResultRow label="Transactions" value={r.activity?.tx_count?.toLocaleString()} />
        <ResultRow label="Last active" value={day(r.activity?.last_seen)} note={r.activity?.last_seen ? fromNow(r.activity.last_seen) : undefined} />
        <ResultRow label="First seen" value={r.activity?.age_days != null ? fromNow(new Date(Date.now() - r.activity.age_days * 86_400_000).toISOString()) : 'Earlier than the sample reaches'} mono={false} />
        {r.ambiguous_chain && <ResultRow label="Note" value="This address is valid on both Bitcoin and Solana; read as Bitcoin." mono={false} />}
      </PanelSection>

      {r.labels?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">{r.labels.map((l: string, i: number) => <Tag key={i}>{l}</Tag>)}</div>
      )}

      {r.flow && (
        <PanelSection title="Flow">
          <ResultRow label="Total in" value={`${fmt(r.flow.total_in)} ${r.symbol}`} mono />
          <ResultRow label="Total out" value={`${fmt(r.flow.total_out)} ${r.symbol}`} mono />
          <ResultRow label="Net" value={`${fmt(r.flow.net)} ${r.symbol}`} mono />
        </PanelSection>
      )}

      {r.risk?.factors?.length > 0 && (
        <PanelSection title="Risk factors">
          {r.risk.factors.map((f: any, i: number) => (
            <div key={i} className="border-b border-line py-1.5 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-small font-medium text-ink-1">{f.label}</span>
                <Tag tone={SEVERITY_TONE(f.severity)}>{plain(f.severity)}</Tag>
                {f.weight > 0 && <span className="font-mono text-meta text-ink-3 tabular-nums">+{f.weight}</span>}
              </div>
              <p className="mt-0.5 text-small text-ink-2">{f.detail}</p>
            </div>
          ))}
        </PanelSection>
      )}

      {r.counterparties?.length > 0 && (
        <PanelSection title="Top counterparties" hint={r.counterparties.length}>
          {r.counterparties.slice(0, 10).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-small">
              <span className="w-10 shrink-0 text-meta font-medium text-ink-3">{c.direction === 'out' ? 'Out' : c.direction === 'in' ? 'In' : 'Both'}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-ink-1">{short(c.address)}</span>
              <span className="font-mono text-meta text-ink-3 tabular-nums">{c.txs}×</span>
              <span className="w-16 shrink-0 text-right font-mono text-ink-2 tabular-nums">{fmt(c.value)}</span>
            </div>
          ))}
        </PanelSection>
      )}

      {r.tokens?.length > 0 && (
        <PanelSection title="Tokens" hint={r.tokens.length}>
          <div className="flex flex-wrap gap-1.5">
            {r.tokens.slice(0, 20).map((t: any, i: number) => (
              <Tag key={i}>{t.symbol}{t.amount != null ? ` ${fmt(t.amount, 2)}` : ''}</Tag>
            ))}
          </div>
        </PanelSection>
      )}

      {r.transactions?.length > 0 && (
        <PanelSection title="Recent transactions" hint={r.transactions.length}>
          {r.transactions.slice(0, 12).map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-small">
              <span className="w-10 shrink-0 text-meta font-medium text-ink-3">{t.direction === 'unknown' ? '—' : t.direction === 'out' ? 'Out' : t.direction === 'in' ? 'In' : 'Both'}</span>
              {t.time
                ? <span className="w-[78px] shrink-0 font-mono text-meta text-ink-3 tabular-nums">{day(t.time)}</span>
                : <span className="w-[78px] shrink-0 text-meta text-ink-3">Pending</span>}
              <span className="min-w-0 flex-1 truncate font-mono text-ink-1">{short(t.hash)}</span>
              {t.failed && <Tag tone="red">Failed</Tag>}
              {t.value > 0 && <span className="font-mono text-meta text-ink-2 tabular-nums">{fmt(t.value)}</span>}
            </div>
          ))}
        </PanelSection>
      )}

      {r.partial?.length > 0 && (
        <PanelSection title="What this doesn’t cover">
          {r.partial.map((p: string, i: number) => <p key={i} className="text-small text-ink-2">{p}</p>)}
        </PanelSection>
      )}

      <p className="mt-6 text-meta text-ink-3">
        From {(r.sources || []).join(', ')}
        {r.activity && ` · read from ${r.activity.sample_size} transactions${r.activity.history_complete ? ', the full history' : ' of a longer history'}`}
      </p>
    </div>
  );
}
