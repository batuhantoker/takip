'use client';

import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { CveLine } from './cve-line';
import { day } from './result-primitives';

export const usd = (n: number | null | undefined) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
};

const shortAddr = (a: string) => (a && a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a);

/** "Spot Price Manipulation" → "Spot price manipulation", leaving acronyms like MEV alone. */
const sentence = (s: string) => s.replace(/(?!^)\b([A-Z])([a-z]+)\b/g, (_, a: string, b: string) => a.toLowerCase() + b);

export function ExploitList({ exploits }: { exploits: any[] }) {
  const t = useT();
  return (
    <PanelSection title={t('On-chain exploits')} hint={exploits.length}>
      {exploits.length === 0 && <p className="text-small text-ink-3">{t('None in this window.')}</p>}
      {exploits.slice(0, 12).map((e, i) => (
        <div key={i} className="border-b border-line py-2 last:border-0">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-body font-medium text-ink-1">{e.name}</span>
            <span className="shrink-0 font-mono text-small text-ink-1 tabular-nums">{usd(e.amount_usd)}</span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-small text-ink-2">
            <span className="min-w-0 truncate">
              {[day(e.date, t.intl), e.chain, e.technique && sentence(String(e.technique))].filter(Boolean).join(' · ')}
            </span>
            {e.bridge_hack && <Tag>{t('Bridge')}</Tag>}
          </div>
        </div>
      ))}
    </PanelSection>
  );
}

export function CveList({ cves }: { cves: any[] }) {
  const t = useT();
  return (
    <PanelSection title={t('Crypto CVEs')} hint={cves.length}>
      {cves.length === 0 && <p className="text-small text-ink-3">{t('None published in this window.')}</p>}
      {cves.slice(0, 10).map((c, i) => (
        <CveLine key={c.id ?? i} id={c.id} href={c.url} cvss={c.cvss ?? undefined} severity={c.severity || undefined}
          description={c.description} published={c.published} />
      ))}
    </PanelSection>
  );
}

export function SanctionedWallets({ wallets, total }: { wallets: any[]; total: number }) {
  const t = useT();
  return (
    <PanelSection title={t('Wallets sanctioned by OFAC')} hint={total}>
      {wallets.slice(0, 10).map((w, i) => (
        <div key={i} className="flex min-h-8 items-center gap-3 border-b border-line text-small last:border-0">
          <span className="w-10 shrink-0 font-medium text-ink-2">{w.asset}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-ink-1">{shortAddr(w.address)}</span>
          {w.first_seen && <span className="shrink-0 font-mono text-meta text-ink-3 tabular-nums">{day(w.first_seen, t.intl)}</span>}
        </div>
      ))}
    </PanelSection>
  );
}
