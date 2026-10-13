'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Dot } from '@/components/ui/tag';
import { CopyButton, ResultRow, day, renderFallback, type ToolResultProps } from './result-primitives';

export { DnsResult } from './dns-result';
export { WhoisResult } from './whois-result';

/** "C=US, O=Let's Encrypt, CN=R3" → "Let's Encrypt": the organisation is what a reader recognises. */
function issuerName(dn = '') {
  const parts = Object.fromEntries(dn.split(/,\s*/).map(p => p.split('=')).filter(p => p.length === 2));
  return parts.O || parts.CN || dn;
}

const NAMES_SHOWN = 24;

/** Certificate transparency: the certificates logged for a domain, and every host name they cover. */
export function CertsResult({ r, query }: ToolResultProps) {
  const [allNames, setAllNames] = useState(false);
  const [now] = useState(Date.now);
  const certs: any[] = r.certificates ?? [];
  const names: string[] = r.subdomains ?? [];

  if (!certs.length) {
    return (
      <p className="text-small text-ink-2">
        {r.error ? 'crt.sh didn’t answer. It is often busy; try again in a minute.' : <>No certificates are logged for {r.domain || query}.</>}
      </p>
    );
  }

  return (
    <div>
      <PanelSection title="Certificates" hint={r.total_certs > certs.length ? `latest ${certs.length} of ${r.total_certs.toLocaleString()}` : certs.length}>
        {certs.slice(0, 12).map((c, i) => {
          const live = new Date(c.not_after).getTime() > now && new Date(c.not_before).getTime() <= now;
          return (
            <ListRow key={c.id ?? i} compact
              leading={<Dot tone={live ? 'green' : 'muted'} label={live ? 'Valid now' : 'Expired'} />}
              title={c.common_name || c.name_value}
              subtitle={<>{issuerName(c.issuer)} · <span className="tabular-nums">{day(c.not_before)} to {day(c.not_after)}</span></>} />
          );
        })}
      </PanelSection>

      {names.length > 0 && (
        <PanelSection title="Host names on these certificates" hint={names.length} action={<CopyButton text={names.join('\n')} />}>
          <ul className="flex flex-col gap-1 text-small text-ink-1">
            {(allNames ? names : names.slice(0, NAMES_SHOWN)).map(n => <li key={n} className="break-all">{n}</li>)}
          </ul>
          {names.length > NAMES_SHOWN && (
            <Button className="mt-2 -ml-2.5" variant="ghost" size="sm" onClick={() => setAllNames(!allNames)}>
              {allNames ? 'Show fewer' : `Show all ${names.length.toLocaleString()}`}
            </Button>
          )}
        </PanelSection>
      )}
    </div>
  );
}

export function SslResult({ r, query }: ToolResultProps) {
  const known = ['protocol', 'tls_version', 'cipher', 'cipher_suite', 'valid', 'issuer', 'subject', 'expires', 'not_after', 'sans'];
  const hasKnown = known.some(k => r[k] != null);
  if (!hasKnown) return renderFallback(r);
  return (
    <PanelSection title="TLS">
      <ResultRow label="Host" value={query} mono={false} />
      <ResultRow label="Protocol" value={r.protocol || r.tls_version} mono={false} />
      <ResultRow label="Cipher" value={r.cipher || r.cipher_suite} mono={false} />
      {r.valid !== undefined && <ResultRow label="Certificate" value={r.valid ? 'Valid' : 'Not valid'} tone={r.valid ? 'green' : 'red'} />}
      <ResultRow label="Issuer" value={r.issuer} mono={false} />
      <ResultRow label="Subject" value={r.subject} mono={false} />
      <ResultRow label="Expires" value={day(r.expires || r.not_after)} />
      <ResultRow label="Also covers" value={Array.isArray(r.sans) ? r.sans : r.sans} mono={false} />
    </PanelSection>
  );
}
