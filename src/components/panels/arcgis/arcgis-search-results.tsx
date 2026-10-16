'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Plus, RotateCw, SearchX, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PanelSection } from '@/components/ui/panel';
import { Tag } from '@/components/ui/tag';
import type { ArcGISResult, ImportedLayer } from '@/lib/map/layers/arcgis';
import { ArcgisResultRow } from './arcgis-result-row';
import { ArcgisTopics } from './arcgis-topics';

// The API returns one page of this many matches.
const PAGE = 20;

export default function ArcGISSearchResults({ searching, results, resultsFor, importedLayers, importingId, error, onDismissError, onImport, onClear, onTopic }: {
  searching: boolean;
  /** Null until the first search. */
  results: ArcGISResult[] | null;
  resultsFor: string;
  importedLayers: ImportedLayer[];
  importingId: string | null;
  error: { message: string; retry: () => void } | null;
  onDismissError: () => void;
  onImport: (result: ArcGISResult) => void;
  onClear: () => void;
  onTopic: (query: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const errorNote = error && (
    <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-card border border-line bg-surface-2 py-2 pr-1.5 pl-3">
      <AlertTriangle aria-hidden className="mt-1.5 size-4 shrink-0 text-red" strokeWidth={1.75} />
      <p className="min-w-0 flex-1 py-1.5 text-small text-ink-1">{error.message}</p>
      <Button variant="ghost" size="sm" icon={RotateCw} onClick={error.retry}>Try again</Button>
      <IconButton label="Dismiss" icon={X} size="sm" onClick={onDismissError} />
    </div>
  );

  if (searching) {
    return (
      <PanelSection title="Results" hint="searching…">
        <div aria-busy className="flex flex-col">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex h-12 items-center gap-3">
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
                <div className="h-2.5 w-1/2 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
              </div>
              <div className="h-7 w-12 animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </PanelSection>
    );
  }

  if (results === null) {
    return (
      <>
        {errorNote}
        <ArcgisTopics onPick={onTopic} />
      </>
    );
  }

  const added = new Set(importedLayers.map(l => l.id));
  return (
    <PanelSection
      title="Results"
      hint={<>{results.length === PAGE ? 'top ' : ''}{results.length} for “{resultsFor}”</>}
      action={<Button variant="ghost" size="sm" onClick={() => { setOpenId(null); onClear(); }}>Clear</Button>}
    >
      {errorNote}
      {results.length === 0 ? (
        <EmptyState icon={SearchX} title="No public layers here" className="py-8"
          body="Zoom out to search a wider area, or try a broader word." />
      ) : results.map(result => (
        <ArcgisResultRow
          key={result.id}
          result={result}
          open={openId === result.id}
          onToggle={() => setOpenId(openId === result.id ? null : result.id)}
          trailing={added.has(result.id) ? <Tag icon={Check}>On the map</Tag>
            : !result.url ? <span className="text-meta text-ink-3">No service link</span>
            : <Button variant="ghost" size="sm" icon={Plus} loading={importingId === result.id} disabled={importingId !== null && importingId !== result.id}
                onClick={() => onImport(result)} aria-label={`Add ${result.title} to the map`} className="-mr-1">Add</Button>}
        />
      ))}
    </PanelSection>
  );
}
