'use client';

import type { FormEvent } from 'react';
import { adminSend } from '@/components/site/admin/admin-api';
import { Button, Card, ErrorText, Input, Label, Muted, Select, day } from '@/components/site/admin/parts/admin-parts';
import type { PlansResponse, UserDetail } from '@/components/site/admin/admin-types';
import { useAdminAction } from '@/components/site/admin/use-admin-action';

export default function UserOverridesCard({ detail, catalogue, reload }: { detail: UserDetail; catalogue: PlansResponse['catalogue']; reload: () => void }) {
  const { busy, error, run } = useAdminAction(reload);
  const id = detail.user.id;

  const add = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void run(() => adminSend('PUT', `/users/${id}/overrides/${form.get('key')}`, {
      value: String(form.get('value')).trim(),
      until: form.get('until') || null,
      reason: String(form.get('reason')) || undefined,
    }));
  };

  return (
    <Card title="Exceptions to the plan">
      {detail.overrides.length ? (
        <ul className="flex flex-col gap-2">
          {detail.overrides.map(o => (
            <li key={o.key} className="flex items-start gap-3 text-[12px]">
              <div className="flex-1 min-w-0">
                <span className="font-mono">{o.key} = {o.value}</span>
                <span className="block text-[11px] text-ink-3">
                  {o.expiresAt ? `until ${day(o.expiresAt)}` : 'no end date'}{o.reason ? ` · ${o.reason}` : ''}
                </span>
              </div>
              <Button disabled={busy} onClick={() => run(() => adminSend('DELETE', `/users/${id}/overrides/${o.key}`))}>Remove</Button>
            </li>
          ))}
        </ul>
      ) : (
        <Muted>None. The plan applies as it is.</Muted>
      )}
      <form onSubmit={add} className="grid grid-cols-2 gap-2 items-end">
        <Label text="Entitlement">
          <Select name="key">{catalogue.map(c => <option key={c.key} value={c.key}>{c.key}</option>)}</Select>
        </Label>
        <Label text="Value (true, 500, &quot;paid&quot;)">
          <Input name="value" required className="font-mono" />
        </Label>
        <Label text="Until (optional)">
          <Input name="until" type="date" />
        </Label>
        <Label text="Reason">
          <Input name="reason" />
        </Label>
        <Button type="submit" disabled={busy} className="col-span-2 justify-self-start">Add exception</Button>
      </form>
      <ErrorText message={error} />
    </Card>
  );
}
