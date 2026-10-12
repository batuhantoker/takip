'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { adminSend, useAdminData } from './admin-api';
import { Badge, Button, ErrorText, Input, Muted, PageTitle, TABLE, TD, TH, day, when } from './admin-parts';
import type { KeyList, KeyState } from './admin-types';
import { useAdminAction } from './use-admin-action';

const PAGE = 50;
const STATES: [KeyState | '', string][] = [['', 'All'], ['active', 'Active'], ['expired', 'Expired'], ['revoked', 'Revoked']];

const stateOf = (key: KeyList['keys'][number]): KeyState =>
  key.revokedAt !== null ? 'revoked' : key.expiresAt !== null && key.expiresAt <= Date.now() ? 'expired' : 'active';

export default function KeysPage() {
  const [q, setQ] = useState('');
  const [state, setState] = useState<KeyState | ''>('');
  const [offset, setOffset] = useState(0);
  const { data, error, reload } = useAdminData<KeyList>(`/keys?q=${encodeURIComponent(q)}${state ? `&state=${state}` : ''}&offset=${offset}&limit=${PAGE}`);
  const revoke = useAdminAction(reload);

  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQ(String(new FormData(e.currentTarget).get('q')).trim());
    setOffset(0);
  };

  return (
    <>
      <PageTitle title="API keys">
        <form onSubmit={search} className="flex gap-2">
          <Input name="q" placeholder="Owner, key name or prefix" defaultValue={q} className="w-64" />
          <Button type="submit">Search</Button>
        </form>
      </PageTitle>
      <div className="flex flex-wrap gap-1 mb-3">
        {STATES.map(([value, label]) => (
          <Button
            key={value}
            tone={state === value ? 'gold' : 'plain'}
            onClick={() => {
              setState(value);
              setOffset(0);
            }}
          >
            {label}{data ? ` (${data.counts[value || 'all']})` : ''}
          </Button>
        ))}
      </div>
      <ErrorText message={error ?? revoke.error} />
      {data && (
        <>
          <div className="overflow-x-auto border border-[var(--border-primary)] bg-[#0A0A0A]">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Key</th>
                  <th className={TH}>Owner</th>
                  <th className={TH}>State</th>
                  <th className={TH}>Created</th>
                  <th className={TH}>Last used</th>
                  <th className={TH}>Expires</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {data.keys.map(key => {
                  const keyState = stateOf(key);
                  return (
                    <tr key={key.id} className="hover:bg-white/[0.03]">
                      <td className={TD}>
                        <span className="break-words">{key.name}</span>
                        <span className="block font-mono text-[11px] text-[var(--text-muted)]">{key.prefix}…{key.scopes.length > 0 && ` · only ${key.scopes.join(', ')}`}</span>
                      </td>
                      <td className={TD}>
                        <Link href={`/admin/users/${key.userId}`} className="hover:underline">{key.email ?? key.userId}</Link>
                      </td>
                      <td className={TD}>
                        <Badge tone={keyState === 'active' ? 'gold' : keyState === 'revoked' ? 'danger' : 'muted'}>{keyState}</Badge>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-[var(--text-muted)]`}>{when(key.createdAt)}</td>
                      <td className={`${TD} whitespace-nowrap text-[var(--text-muted)]`}>{key.lastUsedAt ? when(key.lastUsedAt) : 'never'}</td>
                      <td className={`${TD} whitespace-nowrap text-[var(--text-muted)]`}>{key.revokedAt !== null ? `revoked ${when(key.revokedAt)}` : day(key.expiresAt)}</td>
                      <td className={`${TD} text-right`}>
                        {key.revokedAt === null && (
                          <Button
                            tone="danger"
                            disabled={revoke.busy}
                            onClick={() =>
                              window.confirm(`Revoke ${key.prefix}… (${key.name}) for ${key.email ?? key.userId}? Anything using it stops working.`) &&
                              revoke.run(() => adminSend('DELETE', `/users/${encodeURIComponent(key.userId)}/keys/${encodeURIComponent(key.id)}`))
                            }
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!data.keys.length && <div className="p-4"><Muted>No keys match.</Muted></div>}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[12px] text-[var(--text-muted)]">
            <span>{data.total ? `${offset + 1}–${offset + data.keys.length} of ${data.total}` : '0 keys'}</span>
            <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
            <Button disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
          </div>
        </>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </>
  );
}
