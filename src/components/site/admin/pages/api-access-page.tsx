'use client';

import { adminSend, useAdminData } from '@/components/site/admin/admin-api';
import { Button, ErrorText, Muted, PageTitle, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import { Switch } from '@/components/site/admin/parts/admin-switch';
import { useAdminAction } from '@/components/site/admin/use-admin-action';

/** GET /api/admin/key-policy (apps/api/src/admin/key-policy-routes.ts). */
type KeyPolicyGroup = {
  group: string;
  label: string;
  paths: string[];
  keyRequired: boolean;
  updatedAt: number | null;
  updatedBy: string | null;
  week: { keys: number; accounts: number; anonymous: number; refused: number };
};

const count = (n: number) => n.toLocaleString('en');

export default function ApiAccessPage() {
  const { data, error, reload } = useAdminData<{ groups: KeyPolicyGroup[] }>('/key-policy');
  const { busy, error: actionError, run } = useAdminAction(reload);
  const setAll = (keyRequired: boolean) => void run(() => adminSend('PUT', '/key-policy', { keyRequired }));
  const flip = (g: KeyPolicyGroup) => void run(() => adminSend('PUT', `/key-policy/${g.group}`, { keyRequired: !g.keyRequired }));

  return (
    <>
      <PageTitle title="API access" />
      <Muted>
        A caller without a key gets <span className="font-mono">401 api_key_required</span> from an endpoint that needs one,
        with a link to make a free account and a key. The map&rsquo;s own requests and signed-in visitors always get through,
        and a valid key works everywhere its plan allows. Account, plan and docs routes are always open. Changes apply at once
        and go in the audit log.
      </Muted>
      <div className="flex flex-wrap gap-2 my-4">
        <Button disabled={busy || !data} onClick={() => setAll(true)}>Require a key everywhere</Button>
        <Button disabled={busy || !data} onClick={() => setAll(false)}>Open everything</Button>
      </div>
      <ErrorText message={error ?? actionError} />
      {data && (
        <div className="overflow-x-auto border border-line bg-surface-1">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Endpoints</th>
                <th className={TH}>Without a key</th>
                <th className={`${TH} text-right`}>Keys</th>
                <th className={`${TH} text-right`}>Accounts</th>
                <th className={`${TH} text-right`} title="Includes visitors using the map">Anonymous</th>
                <th className={`${TH} text-right`} title="Missing key or rate limit">Refused</th>
                <th className={TH}>Last switched</th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map(g => (
                <tr key={g.group}>
                  <td className={TD}>
                    <div className="text-ink-1">{g.label}</div>
                    {g.paths.map(path => <div key={path} className="font-mono text-[11px] text-ink-3">{path}</div>)}
                  </td>
                  <td className={TD}>
                    <Switch
                      on={!g.keyRequired}
                      states={['Open', 'Key required']}
                      warnOff={false}
                      disabled={busy}
                      label={`Let callers without a key use ${g.label}`}
                      onClick={() => flip(g)}
                    />
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{count(g.week.keys)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{count(g.week.accounts)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{count(g.week.anonymous)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{count(g.week.refused)}</td>
                  <td className={`${TD} text-[11px] text-ink-3`}>
                    {g.updatedAt ? <>{when(g.updatedAt)}<br />{g.updatedBy}</> : 'Default'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-[11px] text-ink-3">Requests in the last 7 days (UTC).</p>
        </div>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </>
  );
}
