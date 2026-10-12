'use client';

import type { FormEvent } from 'react';
import { adminSend } from './admin-api';
import { Button, Card, ErrorText, Input, Label, when } from './admin-parts';
import type { UserDetail } from './admin-types';
import { useAdminAction } from './use-admin-action';

export default function UserBanCard({ detail, reload }: { detail: UserDetail; reload: () => void }) {
  const { busy, error, run } = useAdminAction(reload);
  const { id, email, banned, banReason, banExpires } = detail.user;

  const ban = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!window.confirm(`Ban ${email}? They are signed out everywhere and can't sign in.`)) return;
    void run(() => adminSend('POST', `/users/${id}/ban`, { reason: String(form.get('reason')).trim(), until: form.get('until') || null }));
  };

  return (
    <Card title="Ban">
      {banned ? (
        <>
          <p className="text-[12px] text-[var(--alert-red)]">
            Banned{banExpires ? ` until ${when(banExpires)}` : ''}{banReason ? `: ${banReason}` : ''}
          </p>
          <Button disabled={busy} className="self-start" onClick={() => run(() => adminSend('POST', `/users/${id}/unban`))}>Unban</Button>
        </>
      ) : (
        <form onSubmit={ban} className="grid grid-cols-2 gap-2 items-end">
          <Label text="Reason (shown in the log)">
            <Input name="reason" required />
          </Label>
          <Label text="Until (optional)">
            <Input name="until" type="date" />
          </Label>
          <Button type="submit" tone="danger" disabled={busy} className="col-span-2 justify-self-start">Ban…</Button>
        </form>
      )}
      <ErrorText message={error} />
    </Card>
  );
}
