'use client';

import { AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import type { Tone } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { ResultRow, Target, Verdict, plain, type ToolResultProps } from './result-primitives';

const VERDICT_TONE: Record<string, Tone> = { malicious: 'red', suspicious: 'amber', clean: 'green', unknown: 'neutral' };
const VERDICT_TITLE: Record<string, string> = {
  malicious: msg('Malicious'), suspicious: msg('Suspicious'), clean: msg('No threat signals'), unknown: msg('Not enough data'),
};
const CLASSIFICATION: Record<string, string> = { malicious: msg('Malicious'), benign: msg('Benign'), unknown: msg('Unknown') };

// The reputation route's fixed signals; the ones carrying a value are matched below.
const FIXED_SIGNALS = new Set<string>([
  msg('GreyNoise: malicious scanner'), msg('GreyNoise: known benign service'), msg('Tor exit node'), msg('Observed scanning the internet'),
]);

function signalText(s: string, t: Translate): string {
  if (FIXED_SIGNALS.has(s)) return t(s);
  const otx = /^Named in (\d+) OTX reports?$/.exec(s);
  if (otx) return t('{n, plural, one {Named in # OTX report} other {Named in # OTX reports}}', { n: Number(otx[1]) });
  const c2 = /^Botnet C2 \((.*)\)$/.exec(s);
  if (c2) return t('Botnet C2 ({malware})', { malware: c2[1] });
  return s;
}

const isIp = (q: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(q);

/** Reputation merged from GreyNoise, Feodo, Spamhaus, the Tor list and OTX. */
export function ThreatsResult({ r, query }: ToolResultProps) {
  const t = useT();
  const q = query.trim();
  const signals: string[] = r.signals ?? [];
  const otxUrl = `https://otx.alienvault.com/indicator/${isIp(q) ? 'ip' : 'domain'}/${encodeURIComponent(q)}`;
  const classification = r.greynoise?.classification;

  return (
    <div>
      <Verdict tone={VERDICT_TONE[r.verdict] ?? 'neutral'} title={VERDICT_TITLE[r.verdict] ? t(VERDICT_TITLE[r.verdict]) : plain(r.verdict)}
        body={t.rich('For {target}', { target: <Target value={q} /> })} />

      {signals.length > 0 && (
        <PanelSection title={t('Signals')}>
          {signals.map((s: string) => {
            const good = /benign|known/i.test(s);
            return (
              <div key={s} className="flex items-center gap-2.5 border-b border-line py-1.5 last:border-0">
                {good
                  ? <ShieldCheck aria-hidden className="size-4 shrink-0 text-green" strokeWidth={1.75} />
                  : <AlertTriangle aria-hidden className="size-4 shrink-0 text-amber" strokeWidth={1.75} />}
                <span className="text-small text-ink-1">{signalText(s, t)}</span>
              </div>
            );
          })}
        </PanelSection>
      )}

      {r.greynoise && (
        <PanelSection title="GreyNoise">
          <ResultRow label={t('Classification')}
            value={classification ? (CLASSIFICATION[classification] ? t(CLASSIFICATION[classification]) : plain(classification)) : t('Not observed')}
            tone={classification === 'malicious' ? 'red' : classification === 'benign' ? 'green' : undefined} />
          <ResultRow label={t('Internet scanner')} value={r.greynoise.noise ? t('Yes') : t('No')} />
          <ResultRow label={t('Known service')} value={r.greynoise.riot ? t('Yes') : t('No')} />
          <ResultRow label={t('Last seen')} value={r.greynoise.last_seen} />
        </PanelSection>
      )}

      {(r.feodo || r.spamhaus || r.tor_exit != null) && (
        <PanelSection title={t('Blocklists')}>
          {r.feodo && (
            <ResultRow label={t('Botnet C2')} value={r.feodo.port ? t('{malware} · port {port}', { malware: r.feodo.malware, port: String(r.feodo.port) }) : r.feodo.malware} tone="red"
              note={r.feodo.status ? `abuse.ch Feodo · ${r.feodo.status}` : 'abuse.ch Feodo'} />
          )}
          {r.spamhaus && <ResultRow label="Spamhaus DROP" value={`${r.spamhaus.cidr} (${r.spamhaus.sblid})`} tone="red" mono={false} />}
          {r.tor_exit != null && (
            <ResultRow label={t('Tor exit node')} value={r.tor_exit ? t('Yes') : t('No')} tone={r.tor_exit ? 'amber' : undefined}
              note={r.tor_exit ? t('Traffic from here can come from anyone on Tor') : undefined} />
          )}
        </PanelSection>
      )}

      {r.otx && (
        <PanelSection title="AlienVault OTX" action={
          <a href={otxUrl} target="_blank" rel="noopener noreferrer" className="flex h-7 items-center gap-1 rounded-control px-2 text-small font-medium text-ink-2 hover:bg-surface-2 hover:text-ink-1">
            {t('Open on OTX')}<ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
          </a>
        }>
          <ResultRow label={t('Threat reports')} value={r.otx.pulse_count} note={r.otx.whitelisted ? t('On OTX allow-list — not treated as a threat') : undefined} />
          <ResultRow label={t('Country')} value={r.otx.country} mono={false} />
          <ResultRow label={t('Network')} value={r.otx.asn} mono={false} />
        </PanelSection>
      )}

      {!r.greynoise && !r.otx && !r.feodo && !r.spamhaus && (
        <PanelSection title={t('Sources')}>
          <p className="text-small text-ink-2">{t('No source answered. The feeds are sometimes busy; try again in a minute.')}</p>
        </PanelSection>
      )}
    </div>
  );
}

export function LeaksResult({ r }: ToolResultProps) {
  const t = useT();
  const breaches: string[] = r.breaches ?? [];
  return (
    <div>
      <Verdict tone={r.breached ? 'red' : 'green'}
        title={!r.breached ? t('No known breaches')
          : breaches.length ? t('{n, plural, one {In # breach} other {In # breaches}}', { n: breaches.length }) : t('In known breaches')}
        body={r.breached ? t('Data tied to {email} has leaked', { email: r.email }) : t('XposedOrNot has no breach on record for {email}', { email: r.email })} />

      {r.breached && r.data_exposed?.length > 0 && (
        <PanelSection title={t('What leaked')}>
          <div className="flex flex-wrap gap-1.5">
            {r.data_exposed.map((dc: string) => <Tag key={dc}>{dc}</Tag>)}
          </div>
        </PanelSection>
      )}

      {breaches.length > 0 && (
        <PanelSection title={t('Breaches')} hint={breaches.length}>
          {breaches.map(b => (
            <ListRow key={b} compact title={b} href={`https://haveibeenpwned.com/PwnedWebsites#${encodeURIComponent(b)}`} external
              trailing={<ExternalLink aria-hidden className="size-3.5 text-ink-3" strokeWidth={1.75} />} />
          ))}
        </PanelSection>
      )}
    </div>
  );
}
