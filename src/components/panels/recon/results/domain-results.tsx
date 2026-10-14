'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Dot } from '@/components/ui/tag';
import { CopyButton, ResultRow, Target, Verdict, day, renderFallback, type ToolResultProps } from './result-primitives';

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

/** A live TLS handshake: the negotiated protocol and cipher, and the leaf certificate's health. */
export function SslResult({ r, query }: ToolResultProps) {
  if (!r.ok && !r.protocol) return renderFallback(r);
  const soon = r.days_left != null && r.days_left >= 0 && r.days_left <= 30;
  const expired = r.days_left != null && r.days_left < 0;
  const expiry = expired ? `Expired ${Math.abs(r.days_left)} days ago`
    : r.days_left != null ? `${r.days_left} days left` : undefined;

  return (
    <div>
      <Verdict tone={r.valid ? 'green' : 'red'}
        title={r.valid ? 'Certificate valid' : r.authorized ? (expired ? 'Certificate expired' : 'Name mismatch') : 'Certificate not trusted'}
        body={r.valid
          ? <>Trusted, covers <Target value={r.host || query} />, {expiry}</>
          : r.auth_error ? r.auth_error.replace(/_/g, ' ') : !r.san_match ? `The certificate does not cover ${r.host || query}` : expiry} />
      <PanelSection title="Connection">
        <ResultRow label="Host" value={r.host || query} mono={false} />
        <ResultRow label="Protocol" value={r.protocol} mono={false} tone={/TLSv1\.[01]|SSL/i.test(r.protocol ?? '') ? 'amber' : undefined} />
        <ResultRow label="Cipher" value={r.cipher} mono={false} />
      </PanelSection>
      <PanelSection title="Certificate">
        <ResultRow label="Issuer" value={r.issuer} mono={false} />
        <ResultRow label="Subject" value={r.subject} mono={false} />
        <ResultRow label="Trusted" value={r.authorized ? 'Yes' : 'No'} tone={r.authorized ? 'green' : 'red'}
          note={!r.authorized && r.auth_error ? r.auth_error.replace(/_/g, ' ') : undefined} />
        <ResultRow label="Covers host" value={r.san_match ? 'Yes' : 'No'} tone={r.san_match ? 'green' : 'red'} />
        <ResultRow label="Valid from" value={day(r.not_before)} />
        <ResultRow label="Expires" value={day(r.expires)} tone={expired ? 'red' : soon ? 'amber' : undefined} note={expiry} />
        <ResultRow label="Also covers" value={(r.sans ?? []).slice(0, 30)} mono={false} />
      </PanelSection>
    </div>
  );
}
