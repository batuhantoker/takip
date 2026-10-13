'use client';

import { Check, Loader2, X } from 'lucide-react';
import { ListRow } from '@/components/ui/list-row';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import type { FingerprintState } from './use-fingerprint-search';
import { ResultRow, plain } from '@/components/panels/recon/results/result-primitives';

type Source = FingerprintState['sources'][number];

function BreachAnswer({ data }: { data: any }) {
  const breaches: string[] = data?.breaches || [];
  const exposed: string[] = data?.data_exposed || [];
  if (!breaches.length) return <p className="text-small text-ink-2">Not found in any known breach.</p>;
  return (
    <>
      <p className="mb-2 text-small text-amber">In {breaches.length} known {breaches.length === 1 ? 'breach' : 'breaches'}</p>
      <div className="flex flex-wrap gap-1.5">
        {breaches.map((b, i) => <Tag key={`${b}-${i}`}>{b}</Tag>)}
      </div>
      {exposed.length > 0 && (
        <>
          <p className="mt-3 mb-1.5 text-meta font-medium text-ink-3">What leaked</p>
          <div className="flex flex-wrap gap-1.5">{exposed.map(d => <Tag key={d}>{d}</Tag>)}</div>
        </>
      )}
    </>
  );
}

function MailAnswer({ data }: { data: any }) {
  const records: string[] = data?.summary?.mail_servers || [];
  // RFC 7505 null MX ("0 .") is a domain declaring it takes no mail.
  const mx = records.filter(m => !/^0\s+\.?$/.test(m.trim())).map(m => m.replace(/\.$/, '').replace(/^(\d+)\s+/, '$1 · '));
  return (
    <>
      <ResultRow label="Domain" value={data?.domain} mono={false} />
      {mx.length
        ? <ResultRow label="Mail servers" value={mx.slice(0, 6)} mono={false} />
        : <ResultRow label="Mail servers" value={records.length ? 'None: it says it takes no mail' : 'None, so it can’t receive mail'} mono={false} tone="amber" />}
    </>
  );
}

function NumberAnswer({ data }: { data: any }) {
  const region = data?.region_code && data.region_code !== 'Unknown' ? `${data.region} (${data.region_code})` : data?.region;
  return (
    <>
      <ResultRow label="Status" value={data?.valid ? 'Valid number' : 'Not a valid number'} tone={data?.valid ? 'green' : 'red'} mono={false} />
      <ResultRow label="E.164" value={data?.number} />
      <ResultRow label="International" value={data?.international} />
      <ResultRow label="National" value={data?.national} />
      <ResultRow label="Country code" value={data?.country_code} />
      <ResultRow label="Region" value={region} mono={false} />
      <ResultRow label="Line type" value={data?.line_type ? plain(data.line_type) : null} mono={false} />
    </>
  );
}

function SourceAnswer({ s }: { s: Source }) {
  if (s.state === 'error') return <p className="text-small text-ink-2">{s.error || 'This source didn’t answer.'}</p>;
  if (s.id === 'breach') return <BreachAnswer data={s.data} />;
  if (s.id === 'mail') return <MailAnswer data={s.data} />;
  if (s.id === 'number') return <NumberAnswer data={s.data} />;
  return null;
}

/** Email and phone lookups: which sources answered, then each one's answer in its own section. */
export function FingerprintSourceResults({ fp }: { fp: FingerprintState }) {
  return (
    <div>
      <PanelSection title="Sources">
        {fp.sources.map(s => (
          <ListRow key={s.id} compact
            leading={s.state === 'pending' ? <Loader2 aria-hidden className="size-3.5 animate-spin text-ink-3 motion-reduce:animate-none" />
              : s.state === 'done' ? <Check aria-hidden className="size-3.5 text-green" /> : <X aria-hidden className="size-3.5 text-red" />}
            title={s.label} subtitle={s.via}
            meta={s.state === 'pending' ? 'Checking…' : s.state === 'error' ? 'No answer' : undefined} />
        ))}
      </PanelSection>

      {fp.sources.filter(s => s.state !== 'pending').map(s => (
        <PanelSection key={s.id} title={s.label}>
          <SourceAnswer s={s} />
        </PanelSection>
      ))}
    </div>
  );
}
