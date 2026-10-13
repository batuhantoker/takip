'use client';

import type { FormEvent } from 'react';
import { adminSend } from '@/components/site/admin/admin-api';
import { Button, Card, ErrorText, Input, Label, Select, day } from '@/components/site/admin/parts/admin-parts';
import type { PlansResponse, UserDetail } from '@/components/site/admin/admin-types';
import { useAdminAction } from '@/components/site/admin/use-admin-action';

export default function UserPlanCard({ detail, plans, reload }: { detail: UserDetail; plans: PlansResponse['plans']; reload: () => void }) {
  const { busy, error, run } = useAdminAction(reload);
  const { plan, subscription } = detail.access;
  const id = detail.user.id;

  const grant = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void run(() => adminSend('PUT', `/users/${id}/plan`, {
      planId: form.get('planId'),
      until: form.get('until') || null,
      reason: String(form.get('reason')) || undefined,
    }));
  };

  return (
    <Card title="Plan">
      <p className="text-[13px]">
        {plan.name}
        <span className="text-[12px] text-ink-3">
          {' · '}
          {!subscription ? 'the default'
            : subscription.provider === 'manual' ? `granted${subscription.until ? ` until ${day(subscription.until)}` : ''}`
            : `${subscription.provider}, ${subscription.status}`}
        </span>
      </p>
      {subscription?.provider === 'manual' && (
        <Button disabled={busy} className="self-start" onClick={() => run(() => adminSend('DELETE', `/users/${id}/plan`, {}))}>
          Revoke grant
        </Button>
      )}
      <form onSubmit={grant} className="grid grid-cols-2 gap-2 items-end">
        <Label text="Grant plan">
          <Select name="planId" defaultValue="pro">
            {plans.filter(p => p.id !== 'anon').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Label>
        <Label text="Until (optional)">
          <Input name="until" type="date" />
        </Label>
        <Label text="Reason">
          <Input name="reason" placeholder="Beta tester, refund, partner…" />
        </Label>
        <Button type="submit" tone="gold" disabled={busy}>Grant</Button>
      </form>
      <ErrorText message={error} />
    </Card>
  );
}
