'use client';

import type { ReactNode } from 'react';
import { cx } from '@/components/ui/class-names';
import ChainBrief from '@/components/panels/recon/results/chain-brief';
import type { ToolDef } from '@/components/panels/recon/recon-tools';
import { ReconRunBar } from './recon-run-bar';
import { ReconPivots } from './recon-pivots';
import { RecentScans } from '@/components/panels/recon/parts/recent-scans';
import { ToolHeader } from './tool-header';
import { SignInNotice } from '@/components/panels/recon/parts/sign-in-notice';
import { ErrorNote } from '@/components/panels/recon/parts/error-note';
import { TryExamples } from '@/components/panels/recon/parts/example-link';
import type { ReconLookup } from '@/components/panels/recon/use-recon-lookup';
import { useT } from '@/components/ui/use-t';

/** One tool open: its input, its answer, and the other lookups that fit the same query. */
export function ReconToolView({ tool, lookup, autoFocus, onBack, ownView, results, onPivot }: {
  tool: ToolDef;
  lookup: ReconLookup;
  autoFocus?: boolean;
  onBack: () => void;
  /** Profile search and token scan bring their own field and results. */
  ownView: ReactNode;
  results: ReactNode;
  onPivot: (id: string) => void;
}) {
  const t = useT();
  const brief = tool.id === 'crypto' && lookup.chainView === 'brief';
  const mine = lookup.resultTool === tool.id;
  const hasOutput = mine && (lookup.results || lookup.sweepResult || lookup.sweepProgress);
  const answered = mine && !lookup.loading && (lookup.results || lookup.sweepResult);
  const idle = !brief && !hasOutput && !lookup.error && !lookup.loading;
  const recent = lookup.history.filter(h => h.tool === tool.id);
  const run = (q: string) => { lookup.setQuery(q); lookup.run(tool.id, q, { cidr: lookup.sweepCidr }); };

  return (
    <>
      <ToolHeader tool={tool} onBack={onBack} />
      <div className="mt-4">
        {ownView ?? (
          <>
            <ReconRunBar lookup={lookup} tool={tool} autoFocus={autoFocus} />
            {lookup.isSignInError ? <SignInNotice className="mt-4" />
              : lookup.error ? <ErrorNote className="mt-4" message={lookup.error} onRetry={lookup.query.trim() ? () => run(lookup.query) : undefined} /> : null}
            {idle && tool.note && <p className="mt-3 text-small text-ink-3">{t(tool.note)}</p>}
            {idle && tool.example && !lookup.query.trim() && (
              <p className={cx('text-small text-ink-3', tool.note ? 'mt-1' : 'mt-3')}>
                <TryExamples values={[tool.example]} onPick={run} />
              </p>
            )}
            {idle && recent.length > 0 && <RecentScans history={recent} onPick={(_, q) => run(q)} hideTool />}
            {brief ? <div className="mt-5"><ChainBrief /></div>
              : hasOutput && !lookup.isSignInError ? <div className="mt-6">{results}</div> : null}
            {answered && !brief && <ReconPivots query={lookup.query} current={tool.id} onRun={onPivot} />}
          </>
        )}
      </div>
    </>
  );
}
