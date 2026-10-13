'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAdminData } from '@/components/site/admin/admin-api';
import { Badge, Button, ErrorText, Input, Muted, PageTitle, TABLE, TD, TH, when } from '@/components/site/admin/parts/admin-parts';
import type { UserList } from '@/components/site/admin/admin-types';

const PAGE = 50;

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const { data, error } = useAdminData<UserList>(`/users?q=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE}`);

  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQ(String(new FormData(e.currentTarget).get('q')).trim());
    setOffset(0);
  };

  return (
    <>
      <PageTitle title="Users">
        <form onSubmit={search} className="flex gap-2">
          <Input name="q" placeholder="Email or name" defaultValue={q} className="w-64" />
          <Button type="submit">Search</Button>
        </form>
      </PageTitle>
      <ErrorText message={error} />
      {data && (
        <>
          <div className="overflow-x-auto border border-line bg-surface-1">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>User</th>
                  <th className={TH}>Plan</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map(user => (
                  <tr key={user.id} className="hover:bg-surface-2">
                    <td className={TD}>
                      <Link href={`/admin/users/${user.id}`} className="block hover:underline">
                        <span className="text-ink-1">{user.email}</span>
                        <span className="block text-[11px] text-ink-3">{user.name}</span>
                      </Link>
                    </td>
                    <td className={TD}><Badge tone={user.plan === 'free' ? 'muted' : 'gold'}>{user.plan}</Badge></td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1">
                        {user.role === 'admin' && <Badge tone="gold">admin</Badge>}
                        {user.banned && <Badge tone="danger">banned</Badge>}
                        {!user.emailVerified && <Badge tone="muted">unconfirmed</Badge>}
                        {user.twoFactorEnabled && <Badge tone="muted">2FA</Badge>}
                      </div>
                    </td>
                    <td className={`${TD} whitespace-nowrap text-ink-3`}>{when(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.users.length && <div className="p-4"><Muted>No users match.</Muted></div>}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[12px] text-ink-3">
            <span>{data.total ? `${offset + 1}–${offset + data.users.length} of ${data.total}` : '0 users'}</span>
            <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
            <Button disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
          </div>
        </>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </>
  );
}
