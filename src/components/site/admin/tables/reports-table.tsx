'use client';

import { useState } from 'react';
import Link from 'next/link';
import { describeDevice } from '@/lib/platform/account/device-label';
import { siteLink, summarizeView } from '@/lib/platform/reports/view-summary';
import type { AdminReport, ReportStatus } from '@/components/site/admin/admin-types';
import { Badge, Button, Muted, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';

const SHORT = 180;

function Message({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > SHORT;
  return (
    <p className="whitespace-pre-wrap break-words text-ink-1">
      {long && !open ? `${text.slice(0, SHORT).trimEnd()}…` : text}
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="ml-1.5 text-[12px] text-accent hover:underline">
          {open ? 'Show less' : 'Show all'}
        </button>
      )}
    </p>
  );
}

/** Issue reports, newest first, with what the reporter's map showed and a way to open it. */
export default function ReportsTable({ reports, busy, onStatus }: {
  reports: AdminReport[];
  busy: boolean;
  onStatus: (report: AdminReport, status: ReportStatus) => void;
}) {
  if (!reports.length) return <div className="p-4"><Muted>No reports here.</Muted></div>;
  return (
    <table className={TABLE}>
      <thead>
        <tr>
          <th className={TH}>When</th>
          <th className={TH}>Who</th>
          <th className={TH}>Report</th>
          <th className={TH}>Status</th>
          <th className={TH} />
        </tr>
      </thead>
      <tbody>
        {reports.map(report => {
          const link = siteLink(report.view);
          const summary = summarizeView(report.view);
          return (
            <tr key={report.id} className="hover:bg-surface-2">
              <td className={`${TD} whitespace-nowrap text-ink-3`}>{when(report.createdAt)}</td>
              <td className={TD}>
                {report.userId
                  ? <Link href={`/admin/users/${report.userId}`} className="hover:underline">{report.email ?? report.userId}</Link>
                  : <span className="text-ink-2">Visitor</span>}
                <span className="block text-[11px] text-ink-3" title={report.userAgent ?? undefined}>{describeDevice(report.userAgent)}</span>
              </td>
              <td className={`${TD} max-w-[34rem]`}>
                <Message text={report.message} />
                {summary.length > 0 && <p className="mt-1 text-[12px] text-ink-3 break-words">{summary.join(' · ')}</p>}
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] text-accent hover:underline">
                    Open this view
                  </a>
                )}
              </td>
              <td className={TD}>
                <Badge tone={report.status === 'open' ? 'plain' : 'muted'}>{report.status}</Badge>
                {report.resolvedAt !== null && (
                  <span className="block mt-1 text-[11px] text-ink-3 whitespace-nowrap">
                    {when(report.resolvedAt)}{report.resolvedBy && ` · ${report.resolverEmail ?? report.resolvedBy}`}
                  </span>
                )}
              </td>
              <td className={`${TD} text-right`}>
                {report.status === 'open'
                  ? <Button disabled={busy} onClick={() => onStatus(report, 'resolved')}>Resolve</Button>
                  : <Button disabled={busy} onClick={() => onStatus(report, 'open')}>Reopen</Button>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
