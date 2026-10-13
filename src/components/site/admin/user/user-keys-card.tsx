'use client';

import { isExpired } from '@/lib/account/api-keys';
import { adminSend, useAdminData } from '@/components/site/admin/admin-api';
import { Badge, Button, Card, ErrorText, Muted, day, when } from '@/components/site/admin/parts/admin-parts';
import type { AdminApiKey } from '@/components/site/admin/admin-types';
import { useAdminAction } from '@/components/site/admin/use-admin-action';

const stateOf = (key: AdminApiKey) => (key.revokedAt !== null ? 'revoked' : isExpired(key) ? 'expired' : 'active');

/** `onChange` reloads the rest of the page, so the revocation shows in its history. */
export default function UserKeysCard({ userId, email, onChange }: { userId: string; email: string; onChange: () => void }) {
  const { data, error, reload } = useAdminData<{ keys: AdminApiKey[] }>(`/users/${userId}/keys`);
  const revoke = useAdminAction(() => {
    reload();
    onChange();
  });

  if (error) return <Card title="API keys"><ErrorText message={error} /></Card>;
  if (!data) return <Card title="API keys"><Muted>Loading…</Muted></Card>;
  const active = data.keys.filter(key => stateOf(key) === 'active').length;

  return (
    <Card title={`API keys (${active} active)`}>
      {data.keys.length ? (
        <ul className="flex flex-col gap-2">
          {data.keys.map(key => {
            const state = stateOf(key);
            return (
              <li key={key.id} className="flex items-start gap-3 text-[12px]">
                <div className="flex-1 min-w-0">
                  <span className="break-words">{key.name}</span> <span className="font-mono text-[11px] text-ink-3">{key.prefix}…</span>{' '}
                  {state !== 'active' && <Badge tone={state === 'revoked' ? 'danger' : 'muted'}>{state}</Badge>}
                  <span className="block text-[11px] text-ink-3">
                    created {when(key.createdAt)} · {key.lastUsedAt ? `last used ${when(key.lastUsedAt)}` : 'never used'}
                    {key.expiresAt !== null && ` · expires ${day(key.expiresAt)}`}
                    {key.revokedAt !== null && ` · revoked ${when(key.revokedAt)}`}
                    {key.scopes.length > 0 && ` · only ${key.scopes.join(', ')}`}
                  </span>
                </div>
                {key.revokedAt === null && (
                  <Button
                    tone="danger"
                    disabled={revoke.busy}
                    onClick={() =>
                      window.confirm(`Revoke ${key.prefix}… (${key.name}) for ${email}? Anything using it stops working.`) &&
                      revoke.run(() => adminSend('DELETE', `/users/${userId}/keys/${key.id}`))
                    }
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Muted>No keys.</Muted>
      )}
      <ErrorText message={revoke.error} />
    </Card>
  );
}
