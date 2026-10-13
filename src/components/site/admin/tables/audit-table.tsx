import Link from 'next/link';
import type { AuditEvent } from '@/components/site/admin/admin-types';
import { Muted, TABLE, TD, TH, day, when } from '@/components/site/admin/parts/admin-parts';

const show = (key: string, value: unknown) =>
  key === 'until' && typeof value === 'number' ? day(value) : typeof value === 'object' ? JSON.stringify(value) : String(value);

const summary = (data: Record<string, unknown>) =>
  Object.entries(data).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${show(k, v)}`).join(' · ');

export default function AuditTable({ events, showSubject = true }: { events: AuditEvent[]; showSubject?: boolean }) {
  if (!events.length) return <Muted>Nothing recorded yet.</Muted>;
  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>When</th>
            <th className={TH}>Who</th>
            <th className={TH}>What</th>
            {showSubject && <th className={TH}>User</th>}
            <th className={TH}>Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map(e => (
            <tr key={e.id}>
              <td className={`${TD} whitespace-nowrap text-ink-3`}>{when(e.at)}</td>
              <td className={`${TD} whitespace-nowrap`}>
                {e.actorEmail ?? e.actorId ?? e.actorType}
                {e.impersonator && e.impersonator !== e.actorId && (
                  <span className="block text-[11px] text-red">via {e.impersonatorEmail ?? e.impersonator}</span>
                )}
              </td>
              <td className={`${TD} font-mono text-[11px] text-accent whitespace-nowrap`}>{e.action}</td>
              {showSubject && (
                <td className={TD}>
                  {e.subjectId ? <Link href={`/admin/users/${e.subjectId}`} className="hover:underline">{e.subjectEmail ?? e.subjectId}</Link> : '—'}
                </td>
              )}
              <td className={`${TD} text-ink-3 break-words`}>{summary(e.data) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
