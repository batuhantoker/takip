'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
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
  const t = useT();
  const [allNames, setAllNames] = useState(false);
  const [now] = useState(Date.now);
  const certs: any[] = r.certificates ?? [];
  const names: string[] = r.subdomains ?? [];

  if (!certs.length) {
    return (
      <p className="text-small text-ink-2">
        {r.error ? t('crt.sh didn’t answer. It is often busy; try again in a minute.') : t('No certificates are logged for {domain}.', { domain: r.domain || query })}
      </p>
    );
  }

  return (
    <div>
      <PanelSection title={t('Certificates')} hint={r.total_certs > certs.length ? t('latest {n} of {total}', { n: certs.length, total: r.total_certs }) : certs.length}>
        {certs.slice(0, 12).map((c, i) => {
          const live = new Date(c.not_after).getTime() > now && new Date(c.not_before).getTime() <= now;
          return (
            <ListRow key={c.id ?? i} compact
              leading={<Dot tone={live ? 'green' : 'muted'} label={live ? t('Valid now') : t('Expired')} />}
              title={c.common_name || c.name_value}
              subtitle={<>{issuerName(c.issuer)} · <span className="tabular-nums">{t('{from} to {to}', { from: day(c.not_before, t.intl) ?? '', to: day(c.not_after, t.intl) ?? '' })}</span></>} />
          );
        })}
      </PanelSection>

      {names.length > 0 && (
        <PanelSection title={t('Host names on these certificates')} hint={names.length} action={<CopyButton text={names.join('\n')} />}>
          <ul className="flex flex-col gap-1 text-small text-ink-1">
            {(allNames ? names : names.slice(0, NAMES_SHOWN)).map(n => <li key={n} className="break-all">{n}</li>)}
          </ul>
          {names.length > NAMES_SHOWN && (
            <Button className="mt-2 -ml-2.5" variant="ghost" size="sm" onClick={() => setAllNames(!allNames)}>
              {allNames ? t('Show fewer') : t('Show all {n}', { n: names.length })}
            </Button>
          )}
        </PanelSection>
      )}
    </div>
  );
}

/** A live TLS handshake: the negotiated protocol and cipher, and the leaf certificate's health. */
export function SslResult({ r, query }: ToolResultProps) {
  const t = useT();
  if (!r.ok && !r.protocol) return renderFallback(r);
  const soon = r.days_left != null && r.days_left >= 0 && r.days_left <= 30;
  const expired = r.days_left != null && r.days_left < 0;
  const expiry = expired ? t('{n, plural, one {Expired # day ago} other {Expired # days ago}}', { n: Math.abs(r.days_left) })
    : r.days_left != null ? t('{n, plural, one {# day left} other {# days left}}', { n: r.days_left }) : undefined;
  const host = r.host || query;

  return (
    <div>
      <Verdict tone={r.valid ? 'green' : 'red'}
        title={r.valid ? t('Certificate valid') : r.authorized ? (expired ? t('Certificate expired') : t('Name mismatch')) : t('Certificate not trusted')}
        body={r.valid
          ? t.rich('Trusted, covers {host}, {expiry}', { host: <Target value={host} />, expiry: expiry ?? '' })
          : r.auth_error ? r.auth_error.replace(/_/g, ' ') : !r.san_match ? t('The certificate does not cover {host}', { host }) : expiry} />
      <PanelSection title={t('Connection')}>
        <ResultRow label={t('Host')} value={host} mono={false} />
        <ResultRow label={t('Protocol')} value={r.protocol} mono={false} tone={/TLSv1\.[01]|SSL/i.test(r.protocol ?? '') ? 'amber' : undefined} />
        <ResultRow label={t('Cipher')} value={r.cipher} mono={false} />
      </PanelSection>
      <PanelSection title={t('Certificate')}>
        <ResultRow label={t('Issuer')} value={r.issuer} mono={false} />
        <ResultRow label={t('Subject')} value={r.subject} mono={false} />
        <ResultRow label={t('Trusted')} value={r.authorized ? t('Yes') : t('No')} tone={r.authorized ? 'green' : 'red'}
          note={!r.authorized && r.auth_error ? r.auth_error.replace(/_/g, ' ') : undefined} />
        <ResultRow label={t('Covers host')} value={r.san_match ? t('Yes') : t('No')} tone={r.san_match ? 'green' : 'red'} />
        <ResultRow label={t('Valid from')} value={day(r.not_before, t.intl)} />
        <ResultRow label={t('Expires')} value={day(r.expires, t.intl)} tone={expired ? 'red' : soon ? 'amber' : undefined} note={expiry} />
        <ResultRow label={t('Also covers')} value={(r.sans ?? []).slice(0, 30)} mono={false} />
      </PanelSection>
    </div>
  );
}
