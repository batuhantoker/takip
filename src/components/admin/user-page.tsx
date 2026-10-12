'use client';

import { describeDevice } from '@/lib/device-label';
import { adminSend, useAdminData } from './admin-api';
import { Badge, Button, Card, ErrorText, Muted, PageTitle, when } from './admin-parts';
import type { PlansResponse, UserDetail } from './admin-types';
import AuditTable from './audit-table';
import { useAdminAction } from './use-admin-action';
import UserBanCard from './user-ban-card';
import UserKeysCard from './user-keys-card';
import UserOverridesCard from './user-overrides-card';
import UserPlanCard from './user-plan-card';

export default function UserPage({ id }: { id: string }) {
  const { data, error, reload } = useAdminData<UserDetail>(`/users/${id}`);
  const plans = useAdminData<PlansResponse>('/plans');
  const signOut = useAdminAction(reload);

  if (error) return <ErrorText message={error} />;
  if (!data || !plans.data) return <Muted>Loading…</Muted>;
  const { user, accounts, sessions } = data;

  return (
    <>
      <PageTitle title={user.email}>
        <div className="flex flex-wrap gap-1">
          <Badge tone={data.access.plan.id === 'free' ? 'muted' : 'gold'}>{data.access.plan.id}</Badge>
          {user.role === 'admin' && <Badge tone="gold">admin</Badge>}
          {user.banned && <Badge tone="danger">banned</Badge>}
        </div>
      </PageTitle>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Account">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-[12px]">
            <dt className="text-[var(--text-muted)]">Name</dt><dd>{user.name}</dd>
            <dt className="text-[var(--text-muted)]">Email</dt><dd>{user.emailVerified ? 'confirmed' : 'not confirmed'}</dd>
            <dt className="text-[var(--text-muted)]">Joined</dt><dd>{when(user.createdAt)}</dd>
            <dt className="text-[var(--text-muted)]">Role</dt><dd>{user.role ?? 'user'}</dd>
            <dt className="text-[var(--text-muted)]">Two-factor</dt><dd>{user.twoFactorEnabled ? 'on' : 'off'}</dd>
            <dt className="text-[var(--text-muted)]">Signs in with</dt>
            <dd>{accounts.map(a => (a.providerId === 'credential' ? 'password' : a.providerId)).join(', ') || '—'}</dd>
            <dt className="text-[var(--text-muted)]">User id</dt><dd className="font-mono text-[11px] break-all">{user.id}</dd>
          </dl>
        </Card>

        <UserPlanCard detail={data} plans={plans.data.plans} reload={reload} />

        <Card title={`Signed-in devices (${sessions.length})`}>
          {sessions.length ? (
            <ul className="flex flex-col gap-1.5 text-[12px]">
              {sessions.map(s => (
                <li key={s.id}>
                  {describeDevice(s.userAgent)}
                  <span className="text-[11px] text-[var(--text-muted)]"> · active {when(s.updatedAt)}{s.ipAddress ? ` · ${s.ipAddress}` : ''}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>Not signed in anywhere.</Muted>
          )}
          {sessions.length > 0 && (
            <Button
              disabled={signOut.busy}
              className="self-start"
              onClick={() => window.confirm(`Sign ${user.email} out everywhere?`) && signOut.run(() => adminSend('POST', `/users/${id}/sign-out`))}
            >
              Sign out everywhere
            </Button>
          )}
          <ErrorText message={signOut.error} />
        </Card>

        <UserBanCard detail={data} reload={reload} />
        <UserOverridesCard detail={data} catalogue={plans.data.catalogue} reload={reload} />
        <UserKeysCard userId={id} email={user.email} onChange={reload} />
      </div>

      <Card title="History" className="mt-4">
        <AuditTable events={data.audit} showSubject={false} />
      </Card>
    </>
  );
}
