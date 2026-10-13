'use client';

import { StructuredResults } from './structured-results';
import { SweepProgress, SweepResults } from './sweep-results';
import type { ReconLookup } from '@/components/panels/recon/use-recon-lookup';

/** Whatever the active lookup produced: sweep progress, sweep results, or a tool's structured answer. */
export function ReconResults({ lookup, isFullScreen, onSweepVisualize, expandedDevice, setExpandedDevice, fetchCveDetails, cveCache }: {
  lookup: ReconLookup;
  isFullScreen: boolean;
  onSweepVisualize?: (data: any) => void;
  expandedDevice: string | null;
  setExpandedDevice: (v: string | null) => void;
  fetchCveDetails: (ids: string[]) => void;
  cveCache: Record<string, any>;
}) {
  const isSweep = lookup.resultTool === 'sweep';
  const briefOnly = lookup.resultTool === 'crypto' && lookup.chainView === 'brief';
  const showStructured = (lookup.results || briefOnly) && !isSweep;

  return (
    <div className="flex flex-col gap-4">
      {lookup.sweepProgress && lookup.loading && <SweepProgress progress={lookup.sweepProgress} />}

      {isSweep && lookup.sweepResult && !lookup.loading && (
        <SweepResults
          sweepResult={lookup.sweepResult} isFullScreen={isFullScreen} onSweepVisualize={onSweepVisualize}
          expandedDevice={expandedDevice} setExpandedDevice={setExpandedDevice}
          fetchCveDetails={fetchCveDetails} cveCache={cveCache}
        />
      )}

      {showStructured && (
        <StructuredResults activeTab={lookup.resultTool!} chainView={lookup.chainView} results={lookup.results} query={lookup.query} scanType={lookup.scanType} />
      )}
    </div>
  );
}
