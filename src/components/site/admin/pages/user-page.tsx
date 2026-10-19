'use client';

import { authClient } from '@/components/site/account/auth-client';
import { describeDevice } from '@/lib/platform/account/device-label';
import { adminSend, useAdminData } from '@/components/site/admin/admin-api';
import { Badge, Button, Card, ErrorText, Muted, PageTitle, when } from '@/components/site/admin/parts/admin-parts';
import type { PlansResponse, UserDetail } from '@/components/site/admin/admin-types';
import AuditTable from '@/components/site/admin/tables/audit-table';
import { useAdminAction } from '@/components/site/admin/use-admin-action';
import UserActivity from '@/components/site/admin/user/user-activity';
import UserBanCard from '@/components/site/admin/user/user-ban-card';
import UserImpersonateCard from '@/components/site/admin/user/user-impersonate-card';
import UserKeysCard from '@/components/site/admin/user/user-keys-card';
import UserOverridesCard from '@/components/site/admin/user/user-overrides-card';
import UserPlanCard from '@/components/site/admin/user/user-plan-card';

export default function UserPage({ id }: { id: string }) {
  const { data, error, reload } = useAdminData<UserDetail>(`/users/${id}`);
  const plans = useAdminData<PlansResponse>('/plans');
  const signOut = useAdminAction(reload);
  const me = authClient.useSession().data?.user.id;

  if (error) return <ErrorText message={error} />;
  if (!data || !plans.data) return <Muted>Loading…</Muted>;
  const { user, accounts, sessions } = data;
  const self = me === user.id;

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
            <dt className="text-ink-3">Name</dt><dd>{user.name}</dd>
            <dt className="text-ink-3">Email</dt><dd>{user.emailVerified ? 'confirmed' : 'not confirmed'}</dd>
            <dt className="text-ink-3">Joined</dt><dd>{when(user.createdAt)}</dd>
            <dt className="text-ink-3">Role</dt><dd>{user.role ?? 'user'}</dd>
            <dt className="text-ink-3">Two-factor</dt><dd>{user.twoFactorEnabled ? 'on' : 'off'}</dd>
            <dt className="text-ink-3">Signs in with</dt>
            <dd>{accounts.map(a => (a.providerId === 'credential' ? 'password' : a.providerId)).join(', ') || '—'}</dd>
            <dt className="text-ink-3">User id</dt><dd className="font-mono text-[11px] break-all">{user.id}</dd>
          </dl>
        </Card>

        <UserPlanCard detail={data} plans={plans.data.plans} reload={reload} />

        <Card title={`Signed-in devices (${sessions.length})`}>
          {sessions.length ? (
            <ul className="flex flex-col gap-1.5 text-[12px]">
              {sessions.map(s => (
                <li key={s.id}>
                  {describeDevice(s.userAgent)} {s.impersonatedBy && <Badge tone="danger">admin viewing as them</Badge>}
                  <span className="text-[11px] text-ink-3"> · active {when(s.updatedAt)}{s.ipAddress ? ` · ${s.ipAddress}` : ''}</span>
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

        <UserBanCard detail={data} self={self} reload={reload} />
        <UserImpersonateCard detail={data} self={self} />
        <UserOverridesCard detail={data} catalogue={plans.data.catalogue} reload={reload} />
        <UserKeysCard userId={id} email={user.email} onChange={reload} />
      </div>

      <UserActivity id={id} />

      <Card title="History" className="mt-4">
        <AuditTable events={data.audit} showSubject={false} />
      </Card>
    </>
  );
}
