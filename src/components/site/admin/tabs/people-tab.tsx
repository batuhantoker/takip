'use client';

import { useState, type FormEvent } from 'react';
import { useAdminData } from '@/components/site/admin/admin-api';
import { Button, ErrorText, Input, Muted, Select } from '@/components/site/admin/parts/admin-parts';
import type { Overview, UserList } from '@/components/site/admin/admin-types';
import type { UserSort } from '@/components/site/admin/analytics/analytics-types';
import { count } from '@/components/site/admin/analytics/lib/format';
import { DbIpCredit } from '@/components/site/admin/analytics/parts/place-label';
import { StatTile } from '@/components/site/admin/charts/stat-tile';
import { Toolbar } from '@/components/site/admin/parts/area-page';
import UsersTable from '@/components/site/admin/tables/users-table';

const PAGE = 50;
const RANGES = [7, 30, 90] as const;

/** Every account, with its activity in the range, under the account totals. */
export function PeopleTab() {
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState<number>(30);
  const [sort, setSort] = useState<UserSort>('joined');
  const { data, error } = useAdminData<UserList>(`/users?q=${encodeURIComponent(q)}&offset=${offset}&limit=${PAGE}&days=${days}&sort=${sort}`);

  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQ(String(new FormData(e.currentTarget).get('q')).trim());
    setOffset(0);
  };
  const sortBy = (next: UserSort) => {
    setSort(next);
    setOffset(0);
  };
  const idle = data && data.users.length > 0 && data.users.every(u => !u.activity.minutes);

  return (
    <>
      <Toolbar>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form onSubmit={search} className="flex gap-2">
            <Input name="q" placeholder="Email or name" defaultValue={q} className="w-64" />
            <Button type="submit">Search</Button>
          </form>
          <Select value={days} onChange={e => { setDays(Number(e.target.value)); setOffset(0); }} aria-label="Activity range">
            {RANGES.map(n => <option key={n} value={n}>Last {n} days</option>)}
          </Select>
        </div>
      </Toolbar>
      <AccountTiles />
      <p className="mb-4 text-[12px] text-ink-3">
        Activity over the last {data?.days ?? days} days: map time, API requests and sign-ins. Open an account for everything it did, or see the trends
        under <a href="#growth" className="text-accent hover:underline">Growth</a>.
      </p>
      <ErrorText message={error} />
      {data && (
        <>
          {idle && <p className="mb-2 text-[12px] text-ink-3">No map minutes in this range yet. They are counted once a minute while someone has the map open, from the day that started.</p>}
          <div className="overflow-x-auto border border-line bg-surface-1">
            <UsersTable list={data} onSort={sortBy} />
            {!data.users.length && <div className="p-4"><Muted>No users match.</Muted></div>}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[12px] text-ink-3">
            <span>{data.total ? `${offset + 1}–${offset + data.users.length} of ${data.total}` : '0 users'}</span>
            <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
            <Button disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
          </div>
          {data.users.some(u => u.activity.lastPlace || u.activity.lastDevice) && <div className="mt-2"><DbIpCredit osm={data.users.some(u => u.activity.lastDevice?.label)} /></div>}
        </>
      )}
      {!data && !error && <Muted>Loading…</Muted>}
    </>
  );
}

function AccountTiles() {
  const { data } = useAdminData<Overview>('/overview');
  if (!data) return null;
  const tiles: [string, number][] = [
    ['Accounts', data.users], ['New this week', data.newThisWeek], ['Signed in now', data.signedInNow], ['Unconfirmed email', data.unverified],
    ['Admins', data.admins], ['Banned', data.banned], ...Object.entries(data.onPaidOrGrantedPlans).map(([plan, n]): [string, number] => [`On ${plan}`, n]),
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map(([label, n]) => <StatTile key={label} label={label} value={count(n)} />)}
    </div>
  );
}
