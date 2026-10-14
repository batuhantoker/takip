'use client';

import { AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import type { Tone } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { ResultRow, Target, Verdict, plain, type ToolResultProps } from './result-primitives';

const VERDICT_TONE: Record<string, Tone> = { malicious: 'red', suspicious: 'amber', clean: 'green', unknown: 'neutral' };
const VERDICT_TITLE: Record<string, string> = {
  malicious: 'Malicious', suspicious: 'Suspicious', clean: 'No threat signals', unknown: 'Not enough data',
};

const isIp = (q: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(q);

/** Reputation merged from GreyNoise, Feodo, Spamhaus, the Tor list and OTX. */
export function ThreatsResult({ r, query }: ToolResultProps) {
  const q = query.trim();
  const signals: string[] = r.signals ?? [];
  const otxUrl = `https://otx.alienvault.com/indicator/${isIp(q) ? 'ip' : 'domain'}/${encodeURIComponent(q)}`;

  return (
    <div>
      <Verdict tone={VERDICT_TONE[r.verdict] ?? 'neutral'} title={VERDICT_TITLE[r.verdict] ?? plain(r.verdict)}
        body={<>For <Target value={q} /></>} />

      {signals.length > 0 && (
        <PanelSection title="Signals">
          {signals.map((s: string) => {
            const good = /benign|known/i.test(s);
            return (
              <div key={s} className="flex items-center gap-2.5 border-b border-line py-1.5 last:border-0">
                {good
                  ? <ShieldCheck aria-hidden className="size-4 shrink-0 text-green" strokeWidth={1.75} />
                  : <AlertTriangle aria-hidden className="size-4 shrink-0 text-amber" strokeWidth={1.75} />}
                <span className="text-small text-ink-1">{s}</span>
              </div>
            );
          })}
        </PanelSection>
      )}

      {r.greynoise && (
        <PanelSection title="GreyNoise">
          <ResultRow label="Classification" value={r.greynoise.classification ? plain(r.greynoise.classification) : 'Not observed'}
            tone={r.greynoise.classification === 'malicious' ? 'red' : r.greynoise.classification === 'benign' ? 'green' : undefined} />
          <ResultRow label="Internet scanner" value={r.greynoise.noise ? 'Yes' : 'No'} />
          <ResultRow label="Known service" value={r.greynoise.riot ? 'Yes' : 'No'} />
          <ResultRow label="Last seen" value={r.greynoise.last_seen} />
        </PanelSection>
      )}

      {(r.feodo || r.spamhaus || r.tor_exit != null) && (
        <PanelSection title="Blocklists">
          {r.feodo && (
            <ResultRow label="Botnet C2" value={`${r.feodo.malware}${r.feodo.port ? ` · port ${r.feodo.port}` : ''}`} tone="red"
              note={r.feodo.status ? `abuse.ch Feodo · ${r.feodo.status}` : 'abuse.ch Feodo'} />
          )}
          {r.spamhaus && <ResultRow label="Spamhaus DROP" value={`${r.spamhaus.cidr} (${r.spamhaus.sblid})`} tone="red" mono={false} />}
          {r.tor_exit != null && (
            <ResultRow label="Tor exit node" value={r.tor_exit ? 'Yes' : 'No'} tone={r.tor_exit ? 'amber' : undefined}
              note={r.tor_exit ? 'Traffic from here can come from anyone on Tor' : undefined} />
          )}
        </PanelSection>
      )}

      {r.otx && (
        <PanelSection title="AlienVault OTX" action={
          <a href={otxUrl} target="_blank" rel="noopener noreferrer" className="flex h-7 items-center gap-1 rounded-control px-2 text-small font-medium text-ink-2 hover:bg-surface-2 hover:text-ink-1">
            Open on OTX<ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
          </a>
        }>
          <ResultRow label="Threat reports" value={r.otx.pulse_count} note={r.otx.whitelisted ? 'On OTX allow-list — not treated as a threat' : undefined} />
          <ResultRow label="Country" value={r.otx.country} mono={false} />
          <ResultRow label="Network" value={r.otx.asn} mono={false} />
        </PanelSection>
      )}

      {!r.greynoise && !r.otx && !r.feodo && !r.spamhaus && (
        <PanelSection title="Sources">
          <p className="text-small text-ink-2">No source answered. The feeds are sometimes busy; try again in a minute.</p>
        </PanelSection>
      )}
    </div>
  );
}

export function LeaksResult({ r }: ToolResultProps) {
  const breaches: string[] = r.breaches ?? [];
  return (
    <div>
      <Verdict tone={r.breached ? 'red' : 'green'}
        title={r.breached ? `In ${breaches.length || 'known'} ${breaches.length === 1 ? 'breach' : 'breaches'}` : 'No known breaches'}
        body={r.breached ? <>Data tied to {r.email} has leaked</> : <>XposedOrNot has no breach on record for {r.email}</>} />

      {r.breached && r.data_exposed?.length > 0 && (
        <PanelSection title="What leaked">
          <div className="flex flex-wrap gap-1.5">
            {r.data_exposed.map((dc: string) => <Tag key={dc}>{dc}</Tag>)}
          </div>
        </PanelSection>
      )}

      {breaches.length > 0 && (
        <PanelSection title="Breaches" hint={breaches.length}>
          {breaches.map(b => (
            <ListRow key={b} compact title={b} href={`https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(b)}`} external
              trailing={<ExternalLink aria-hidden className="size-3.5 text-ink-3" strokeWidth={1.75} />} />
          ))}
        </PanelSection>
      )}
    </div>
  );
}
