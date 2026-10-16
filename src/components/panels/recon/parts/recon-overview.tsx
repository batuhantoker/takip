'use client';

import { useId, type ReactNode } from 'react';
import { ScanSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PanelSection } from '@/components/ui/panel';
import { TABS } from '@/components/panels/recon/recon-tools';
import { ReconSearch } from './recon-search';
import { RecentScans } from './recent-scans';
import { suggestTools } from '@/lib/intel/recon/suggest-tools';
import { detectQuery } from '@/lib/intel/recon/detect-query';
import { ErrorNote } from './error-note';
import { TryExamples } from './example-link';
import type { ReconLookup } from '@/components/panels/recon/use-recon-lookup';

const EXAMPLES = ['8.8.8.8', 'wikipedia.org', 'octocat'];

/** Nothing open yet: the search field, recent lookups and every tool. */
export function ReconOverview({ lookup, isMobile, isFullScreen, onRun, onOpenByName, selfTrackError, onDismissSelfTrackError, browseAll, setBrowseAll, toolList }: {
  lookup: ReconLookup;
  isMobile?: boolean;
  isFullScreen: boolean;
  onRun: (id: string, query: string) => void;
  /** Opens a tool found by its name; the typed name is not a target. */
  onOpenByName: (id: string) => void;
  selfTrackError: string;
  onDismissSelfTrackError: () => void;
  browseAll: boolean;
  setBrowseAll: (v: boolean) => void;
  toolList: ReactNode;
}) {
  const typed = lookup.query.trim();
  const hasSuggestions = typed !== '' && suggestTools(typed, TABS).length > 0;
  const detection = detectQuery(typed);
  const inputId = useId();
  const fresh = !typed && !lookup.history.length;
  const tryOne = (q: string) => { lookup.setQuery(q); document.getElementById(inputId)?.focus(); };
  const examples = <TryExamples values={EXAMPLES} onPick={tryOne} />;
  return (
    <>
      <ReconSearch id={inputId} query={lookup.query} setQuery={lookup.setQuery} onRun={onRun} onOpen={onOpenByName} autoFocus={!isMobile} />
      {fresh && !isFullScreen && <p className="mt-2 text-small text-ink-3">{examples}</p>}
      {selfTrackError && <ErrorNote className="mt-4" message={selfTrackError} onDismiss={onDismissSelfTrackError} />}
      {!typed && lookup.history.length > 0 && <RecentScans history={lookup.history} onPick={onRun} onClear={lookup.clearHistory} />}
      {fresh && isFullScreen && (
        <EmptyState icon={ScanSearch} title="Start with something to look up" className="mt-10"
          body={<>Paste an IP, domain, email, username or phone number and the tools that fit show up here. {examples}.</>} />
      )}
      {/* Full screen keeps every tool in the rail. */}
      {!isFullScreen && (hasSuggestions ? (
        <PanelSection title="All tools" hint={TABS.length}
          action={<Button variant="ghost" size="sm" aria-expanded={browseAll} onClick={() => setBrowseAll(!browseAll)}>{browseAll ? 'Hide' : 'Show'}</Button>}>
          {browseAll && toolList}
        </PanelSection>
      ) : (
        <div className="mt-6">
          {typed && (
            <p className="mb-4 text-small text-ink-2">
              {detection.label ? `${detection.label}, and none of these tools can look one up yet.` : <>Not sure what “{typed}” is. Pick a tool to look it up with.</>}
            </p>
          )}
          {toolList}
        </div>
      ))}
    </>
  );
}
