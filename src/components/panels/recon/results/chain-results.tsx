'use client';

import { AlertTriangle } from 'lucide-react';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import type { RiskFactor } from '@/lib/intel/recon/chain/detect';
import { ResultRow, SEVERITY_TONE, Verdict, day, fromNow, severityLabel, type ToolResultProps } from './result-primitives';

// The wallet route's risk factors by code; `vars` carries the numbers its English detail was built from.
const FACTORS: Record<string, { label: string; detail: string }> = {
  OFAC_SDN: { label: msg('OFAC-sanctioned address'), detail: msg('Listed on the US OFAC SDN list as: {names}') },
  NEW_ADDRESS: { label: msg('Recently created'), detail: msg('{n, plural, one {First activity # day ago.} other {First activity # days ago.}}') },
  DORMANT: { label: msg('Long dormant'), detail: msg('{n, plural, one {No activity for # day.} other {No activity for # days.}}') },
  HIGH_VOLUME: { label: msg('Exchange-scale activity'), detail: msg('{n} transactions — consistent with an exchange, service or pooled wallet rather than a personal one.') },
  FAN_PATTERN: { label: msg('High counterparty fan-out'), detail: msg('{counterparties} distinct counterparties across {sampled} sampled transactions — a distribution pattern also seen in mixing and payout scripts.') },
  FAILED_TXS: { label: msg('Repeated failed transactions'), detail: msg('{failed} of {sampled} sampled transactions failed.') },
  DRAINED: { label: msg('Swept balance'), detail: msg('Received {received} {symbol} but retains {kept} — funds were forwarded on rather than held.') },
  NOMINAL: { label: msg('No risk indicators'), detail: msg('Nothing in the sampled data matched a risk heuristic.') },
};

function factorText(f: RiskFactor, t: Translate): { label: string; detail: string } {
  const known = FACTORS[f.code];
  if (!known) return { label: f.label, detail: f.detail };
  return { label: t(known.label), detail: f.vars || f.code === 'NOMINAL' ? t(known.detail, f.vars) : f.detail };
}

// Shares /api/osint/crypto with the standalone chain panel; this is Recon's view of the same wallet report.
export function CryptoResult({ r }: ToolResultProps) {
  const t = useT();
  const level: string | undefined = r.risk?.level;
  const fmt = (n: number, d = 4) =>
    typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString(t.intl, { maximumFractionDigits: d }) : '—';
  const short = (a: string) => (a && a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a);
  const direction = (d: string) => (d === 'out' ? t('Out') : d === 'in' ? t('In') : t('Both'));

  return (
    <div>
      {r.sanctions?.hit && (
        <div className="mb-3 rounded-card border border-red/35 bg-red/10 p-2.5">
          <div className="mb-1.5 flex items-center gap-2 text-small font-medium text-red">
            <AlertTriangle aria-hidden className="size-3.5" strokeWidth={1.75} />
            {t('Sanctioned by OFAC')}
          </div>
          {(r.sanctions.entries || []).map((e: any, i: number) => (
            <div key={i} className="break-words text-small text-ink-1">
              {e.name}{e.programs?.length ? ` — ${e.programs.join(', ')}` : ''}
            </div>
          ))}
        </div>
      )}

      <Verdict tone={level ? SEVERITY_TONE(level) : undefined}
        title={level ? t('{level} risk', { level: severityLabel(level, t) }) : t('Not scored')}
        body={r.chain_label
          ? t.rich('{chain} wallet · risk score {score}', { chain: r.chain_label, score: <span className="font-mono tabular-nums">{r.risk?.score ?? 0}</span> })
          : t.rich('Risk score {score}', { score: <span className="font-mono tabular-nums">{r.risk?.score ?? 0}</span> })} />

      <PanelSection title={t('Wallet')}>
        <ResultRow label={t('Address')} value={r.address} mono />
        <ResultRow label={t('Balance')} value={`${fmt(r.balance?.native, 8)} ${r.symbol}`} mono />
        <ResultRow label={t('Value')} value={r.balance?.usd != null ? `$${fmt(r.balance.usd, 2)}` : t('No price available')} mono={r.balance?.usd != null} />
        <ResultRow label={t('Spot price')} value={r.balance?.price_usd != null ? `$${fmt(r.balance.price_usd, 2)}` : null} mono />
        <ResultRow label={t('Transactions')} value={r.activity?.tx_count?.toLocaleString(t.intl)} />
        <ResultRow label={t('Last active')} value={day(r.activity?.last_seen, t.intl)} note={r.activity?.last_seen ? fromNow(r.activity.last_seen, t.intl) : undefined} />
        <ResultRow label={t('First seen')} value={r.activity?.age_days != null ? fromNow(new Date(Date.now() - r.activity.age_days * 86_400_000).toISOString(), t.intl) : t('Earlier than the sample reaches')} mono={false} />
        {r.ambiguous_chain && <ResultRow label={t('Note')} value={t('This address is valid on both Bitcoin and Solana; read as Bitcoin.')} mono={false} />}
      </PanelSection>

      {r.labels?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">{r.labels.map((l: string, i: number) => <Tag key={i}>{l}</Tag>)}</div>
      )}

      {r.flow && (
        <PanelSection title={t('Flow')}>
          <ResultRow label={t('Total in')} value={`${fmt(r.flow.total_in)} ${r.symbol}`} mono />
          <ResultRow label={t('Total out')} value={`${fmt(r.flow.total_out)} ${r.symbol}`} mono />
          <ResultRow label={t('Net')} value={`${fmt(r.flow.net)} ${r.symbol}`} mono />
        </PanelSection>
      )}

      {r.risk?.factors?.length > 0 && (
        <PanelSection title={t('Risk factors')}>
          {r.risk.factors.map((f: any, i: number) => {
            const text = factorText(f, t);
            return (
              <div key={i} className="border-b border-line py-1.5 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-small font-medium text-ink-1">{text.label}</span>
                  <Tag tone={SEVERITY_TONE(f.severity)}>{severityLabel(f.severity, t)}</Tag>
                  {f.weight > 0 && <span className="font-mono text-meta text-ink-3 tabular-nums">+{f.weight}</span>}
                </div>
                <p className="mt-0.5 text-small text-ink-2">{text.detail}</p>
              </div>
            );
          })}
        </PanelSection>
      )}

      {r.counterparties?.length > 0 && (
        <PanelSection title={t('Top counterparties')} hint={r.counterparties.length}>
          {r.counterparties.slice(0, 10).map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-small">
              <span className="w-10 shrink-0 text-meta font-medium text-ink-3">{direction(c.direction)}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-ink-1">{short(c.address)}</span>
              <span className="font-mono text-meta text-ink-3 tabular-nums">{c.txs}×</span>
              <span className="w-16 shrink-0 text-right font-mono text-ink-2 tabular-nums">{fmt(c.value)}</span>
            </div>
          ))}
        </PanelSection>
      )}

      {r.tokens?.length > 0 && (
        <PanelSection title={t('Tokens')} hint={r.tokens.length}>
          <div className="flex flex-wrap gap-1.5">
            {r.tokens.slice(0, 20).map((token: any, i: number) => (
              <Tag key={i}>{token.symbol}{token.amount != null ? ` ${fmt(token.amount, 2)}` : ''}</Tag>
            ))}
          </div>
        </PanelSection>
      )}

      {r.transactions?.length > 0 && (
        <PanelSection title={t('Recent transactions')} hint={r.transactions.length}>
          {r.transactions.slice(0, 12).map((tx: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-small">
              <span className="w-10 shrink-0 text-meta font-medium text-ink-3">{tx.direction === 'unknown' ? '—' : direction(tx.direction)}</span>
              {tx.time
                ? <span className="w-[78px] shrink-0 font-mono text-meta text-ink-3 tabular-nums">{day(tx.time, t.intl)}</span>
                : <span className="w-[78px] shrink-0 text-meta text-ink-3">{t('Pending')}</span>}
              <span className="min-w-0 flex-1 truncate font-mono text-ink-1">{short(tx.hash)}</span>
              {tx.failed && <Tag tone="red">{t('Failed')}</Tag>}
              {tx.value > 0 && <span className="font-mono text-meta text-ink-2 tabular-nums">{fmt(tx.value)}</span>}
            </div>
          ))}
        </PanelSection>
      )}

      {r.partial?.length > 0 && (
        <PanelSection title={t('What this doesn’t cover')}>
          {r.partial.map((p: string, i: number) => <p key={i} className="text-small text-ink-2">{p}</p>)}
        </PanelSection>
      )}

      <p className="mt-6 text-meta text-ink-3">
        {t('From {sources}', { sources: (r.sources || []).join(', ') })}
        {r.activity && ` · ${r.activity.history_complete
          ? t('{n, plural, one {read from # transaction, the full history} other {read from # transactions, the full history}}', { n: r.activity.sample_size })
          : t('{n, plural, one {read from # transaction of a longer history} other {read from # transactions of a longer history}}', { n: r.activity.sample_size })}`}
      </p>
    </div>
  );
}
