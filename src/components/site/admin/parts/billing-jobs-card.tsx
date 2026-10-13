import { Card, Muted, TABLE, TD, TH, when } from './admin-parts';
import type { BillingOverview, Job } from '@/components/site/admin/admin-types';

function JobTable({ jobs, at }: { jobs: Job[]; at: (job: Job) => number | null }) {
  if (!jobs.length) return <Muted>None.</Muted>;
  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>Job</th>
            <th className={TH}>When</th>
            <th className={`${TH} text-right`}>Attempts</th>
            <th className={TH}>Last error</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(job => (
            <tr key={job.id}>
              <td className={`${TD} whitespace-nowrap`}>
                <span className="font-mono text-[11px] text-accent">{job.kind}</span>
                <span className="text-[11px] text-ink-3"> #{job.id}</span>
                {job.lockedUntil !== null && <span className="block text-[11px] text-ink-3">claimed until {when(job.lockedUntil)}</span>}
              </td>
              <td className={`${TD} whitespace-nowrap text-ink-3`}>{when(at(job))}</td>
              <td className={`${TD} text-right font-mono tabular-nums`}>{job.attempts}/{job.maxAttempts}</td>
              <td className={`${TD} text-ink-3 break-words`}>{job.lastError ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The shared job table: billing reconciliation today, email retries later. */
export default function BillingJobsCard({ jobs }: { jobs: BillingOverview['jobs'] }) {
  return (
    <Card title={`Job queue (${jobs.counts.pending} pending, ${jobs.counts.failed} failed)`}>
      <h3 className="text-[11px] text-ink-3">Pending, by when they run</h3>
      <JobTable jobs={jobs.pending} at={job => job.runAt} />
      <h3 className="text-[11px] text-ink-3">Failed for good</h3>
      <JobTable jobs={jobs.failed} at={job => job.failedAt} />
      <h3 className="text-[11px] text-ink-3">Recently done</h3>
      <JobTable jobs={jobs.recent} at={job => job.doneAt} />
    </Card>
  );
}
