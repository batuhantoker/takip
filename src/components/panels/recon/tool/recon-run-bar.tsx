'use client';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { SearchField } from '@/components/ui/search-field';
import type { ToolDef } from '@/components/panels/recon/recon-tools';
import type { ReconLookup } from '@/components/panels/recon/use-recon-lookup';

/** The open tool's input: its field and run button on one line, then the few options the tool has. Port scans are always quick: the server refuses deeper ones. */
export function ReconRunBar({ lookup, tool, autoFocus }: { lookup: ReconLookup; tool: ToolDef; autoFocus?: boolean }) {
  const briefOnly = tool.id === 'crypto' && lookup.chainView === 'brief';
  const run = () => { if (lookup.query.trim()) lookup.run(tool.id, lookup.query, { scanType: lookup.scanType, cidr: lookup.sweepCidr }); };

  return (
    <div className="flex flex-col gap-3">
      {tool.id === 'crypto' && (
        <Segmented size="sm" full className="max-w-sm" label="Crypto view" value={lookup.chainView} onChange={lookup.setChainView}
          options={[{ value: 'brief', label: 'Daily brief' }, { value: 'wallet', label: 'Trace a wallet' }]} />
      )}

      {!briefOnly && (
        <div className="flex gap-2">
          <SearchField
            className="flex-1"
            value={lookup.query}
            onChange={lookup.setQuery}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run(); } }}
            placeholder={tool.placeholder}
            label={tool.placeholder}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
          />
          <Button variant="primary" loading={lookup.loading} disabled={!lookup.query.trim()} onClick={run}>
            {tool.verb ?? 'Look up'}
          </Button>
        </div>
      )}

      {tool.id === 'sweep' && (
        <div className="flex items-center gap-3">
          <Segmented size="sm" label="Subnet size" value={String(lookup.sweepCidr)} onChange={v => lookup.setSweepCidr(Number(v))}
            options={[24, 25, 26, 27, 28].map(c => ({ value: String(c), label: <span className="font-mono tabular-nums">/{c}</span> }))} />
          <span className="ml-auto text-small whitespace-nowrap text-ink-3">
            <span className="font-mono tabular-nums">{(2 ** (32 - lookup.sweepCidr)).toLocaleString()}</span> addresses
          </span>
        </div>
      )}
    </div>
  );
}
