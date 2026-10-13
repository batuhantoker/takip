'use client';

import { Server } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PanelSection } from '@/components/ui/panel';
import { ResultRow, type ToolResultProps } from './result-primitives';

type DnsAnswer = { data?: string; ttl?: number };

const TYPES: { type: string; label: string; mono?: boolean }[] = [
  { type: 'A', label: 'IPv4 (A)', mono: true },
  { type: 'AAAA', label: 'IPv6 (AAAA)', mono: true },
  { type: 'CNAME', label: 'Alias (CNAME)' },
  { type: 'MX', label: 'Mail (MX)' },
  { type: 'NS', label: 'Name servers' },
  { type: 'TXT', label: 'Text (TXT)' },
  { type: 'SOA', label: 'Authority (SOA)' },
];

// Resolvers answer with fully qualified names ("mail.example.com.") and quoted TXT strings.
const tidy = (type: string, data = '') => {
  if (type === 'TXT') return data.replace(/^"|"$/g, '').replace(/" "/g, '');
  if (type === 'MX') return data.replace(/\.$/, '').replace(/^(\d+)\s+/, '$1 · ');
  return data.replace(/\.$/, '');
};

/** Every record a domain answers with, grouped by what the record is for. */
export function DnsResult({ r, query }: ToolResultProps) {
  const records: Record<string, DnsAnswer[]> = r.records ?? {};
  const domain = r.domain || query;
  const rows = TYPES.map(t => ({ ...t, values: (records[t.type] ?? []).map(a => tidy(t.type, a.data)).filter(Boolean) }))
    .filter(t => t.values.length);
  const total = rows.reduce((n, t) => n + t.values.length, 0);

  if (!total) {
    return (
      <EmptyState icon={Server} title="No DNS records"
        body={<>{domain} didn’t answer with any records. Check the spelling, or the domain may not be in use.</>} />
    );
  }

  return (
    <PanelSection title={<>Records for <span className="text-ink-2">{domain}</span></>} hint={total}>
      {rows.map(t => <ResultRow key={t.type} label={t.label} value={t.values} mono={t.mono ?? false} />)}
    </PanelSection>
  );
}
