'use client';

import { Server } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PanelSection } from '@/components/ui/panel';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { ResultRow, type ToolResultProps } from './result-primitives';

type DnsAnswer = { data?: string; ttl?: number };

const TYPES: { type: string; label: string; mono?: boolean }[] = [
  { type: 'A', label: msg('IPv4 (A)'), mono: true },
  { type: 'AAAA', label: msg('IPv6 (AAAA)'), mono: true },
  { type: 'CNAME', label: msg('Alias (CNAME)') },
  { type: 'MX', label: msg('Mail (MX)') },
  { type: 'NS', label: msg('Name servers') },
  { type: 'TXT', label: msg('Text (TXT)') },
  { type: 'SOA', label: msg('Authority (SOA)') },
];

// Resolvers answer with fully qualified names ("mail.example.com.") and quoted TXT strings.
const tidy = (type: string, data = '') => {
  if (type === 'TXT') return data.replace(/^"|"$/g, '').replace(/" "/g, '');
  if (type === 'MX') return data.replace(/\.$/, '').replace(/^(\d+)\s+/, '$1 · ');
  return data.replace(/\.$/, '');
};

/** Every record a domain answers with, grouped by what the record is for. */
export function DnsResult({ r, query }: ToolResultProps) {
  const t = useT();
  const records: Record<string, DnsAnswer[]> = r.records ?? {};
  const domain = r.domain || query;
  const rows = TYPES.map(row => ({ ...row, values: (records[row.type] ?? []).map(a => tidy(row.type, a.data)).filter(Boolean) }))
    .filter(row => row.values.length);
  const total = rows.reduce((n, row) => n + row.values.length, 0);

  if (!total) {
    return (
      <EmptyState icon={Server} title={t('No DNS records')}
        body={t('{domain} didn’t answer with any records. Check the spelling, or the domain may not be in use.', { domain })} />
    );
  }

  return (
    <PanelSection title={t.rich('Records for {domain}', { domain: <span className="text-ink-2">{domain}</span> })} hint={total}>
      {rows.map(row => <ResultRow key={row.type} label={t(row.label)} value={row.values} mono={row.mono ?? false} />)}
    </PanelSection>
  );
}
