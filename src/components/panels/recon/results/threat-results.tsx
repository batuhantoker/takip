'use client';

import { ExternalLink } from 'lucide-react';
import type { Tone } from '@/components/ui/class-names';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import { ResultRow, Verdict, day, plain, type ToolResultProps } from './result-primitives';

const LEVEL_TONE: Record<string, Tone> = { LOW: 'green', MEDIUM: 'amber', HIGH: 'red' };

const isIp = (q: string) => /^(\d{1,3}\.){3}\d{1,3}$/.test(q);

/** What AlienVault OTX and the Tor exit list say about an IP or domain. */
export function ThreatsResult({ r, query }: ToolResultProps) {
  const q = query.trim();
  const otx = r.otx;
  const reports = otx?.pulse_count ?? 0;
  const otxUrl = `https://otx.alienvault.com/indicator/${isIp(q) ? 'ip' : 'domain'}/${encodeURIComponent(q)}`;

  return (
    <div>
      {otx ? (
        <Verdict tone={LEVEL_TONE[r.threat_level] ?? 'neutral'} title={`${plain(r.threat_level)} risk`}
          body={reports ? `Named in ${reports.toLocaleString()} AlienVault OTX threat ${reports === 1 ? 'report' : 'reports'}` : 'No AlienVault OTX threat report names it'} />
      ) : (
        <Verdict title="No score" body="AlienVault OTX didn’t answer, so there is nothing to score. Try again in a minute." />
      )}
      <PanelSection title="Details" action={otx && (
        <a href={otxUrl} target="_blank" rel="noopener noreferrer" className="flex h-7 items-center gap-1 rounded-control px-2 text-small font-medium text-ink-2 hover:bg-surface-2 hover:text-ink-1">
          Open on OTX<ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
        </a>
      )}>
        <ResultRow label="OTX reports" value={otx ? reports : null} />
        <ResultRow label="OTX reputation" value={otx?.reputation} />
        {r.tor_exit_node != null && (
          <ResultRow label="Tor exit node" value={r.tor_exit_node ? 'Yes' : 'No'} tone={r.tor_exit_node ? 'amber' : undefined}
            note={r.tor_exit_node ? 'Traffic from here can come from anyone on Tor' : undefined} />
        )}
        <ResultRow label="Country" value={otx?.country} mono={false} />
        <ResultRow label="Network" value={otx?.asn} mono={false} />
        <ResultRow label="Registrar" value={otx?.whois?.registrar} mono={false} />
        <ResultRow label="Registered" value={day(otx?.whois?.creation_date)} />
        <ResultRow label="Expires" value={day(otx?.whois?.expiration_date)} />
      </PanelSection>
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
