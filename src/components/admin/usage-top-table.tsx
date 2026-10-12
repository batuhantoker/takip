import Link from 'next/link';
import { Badge, Muted, TABLE, TD, TH } from './admin-parts';
import type { UsageTop } from './admin-types';

const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`);

const busiest = (groups: Record<string, number>) =>
  Object.entries(groups).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([group, n]) => `${group} ${n.toLocaleString('en')}`).join(' · ');

/** One row per signed-in session user, per API key, and per anonymous address block (a hash that changes daily). */
export default function UsageTopTable({ top }: { top: UsageTop }) {
  if (!top.consumers.length) return <Muted>No requests that day.</Muted>;
  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>Caller</th>
            <th className={`${TH} text-right`}>Requests</th>
            <th className={`${TH} text-right`}>Refused</th>
            <th className={`${TH} text-right`}>Sent</th>
            <th className={TH}>Busiest groups</th>
          </tr>
        </thead>
        <tbody>
          {top.consumers.map(c => (
            <tr key={`${c.subjectType}:${c.subjectId}:${c.keyId}`}>
              <td className={TD}>
                {c.subjectType === 'anon' ? (
                  <span className="text-[var(--text-muted)]">Anonymous <span className="font-mono text-[11px]">{c.subjectId.slice(0, 8)}</span></span>
                ) : (
                  <>
                    <Link href={`/admin/users/${c.subjectId}`} className="hover:underline">{c.email ?? c.subjectId}</Link>{' '}
                    {c.keyId ? (
                      <Badge tone="gold">key {c.keyPrefix ? `${c.keyPrefix}…` : c.keyId}{c.keyName ? ` · ${c.keyName}` : ''}</Badge>
                    ) : (
                      <Badge tone="muted">signed in</Badge>
                    )}
                  </>
                )}
              </td>
              <td className={`${TD} text-right font-mono tabular-nums`}>{c.requests.toLocaleString('en')}</td>
              <td className={`${TD} text-right font-mono tabular-nums ${c.denied ? 'text-[var(--alert-red)]' : 'text-[var(--text-muted)]'}`}>{c.denied.toLocaleString('en')}</td>
              <td className={`${TD} text-right font-mono tabular-nums text-[var(--text-muted)]`}>{bytes(c.bytes)}</td>
              <td className={`${TD} text-[var(--text-muted)]`}>{busiest(c.groups) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
