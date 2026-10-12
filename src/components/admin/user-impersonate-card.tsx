'use client';

import { useState, type FormEvent } from 'react';
import { startImpersonating } from '@/lib/impersonation';
import { Button, Card, ErrorText, Input, Label, Muted } from './admin-parts';
import type { UserDetail } from './admin-types';

/** "View as" the user on the map for 30 minutes. The api refuses admins and banned users too; this only explains why. */
export default function UserImpersonateCard({ detail, self }: { detail: UserDetail; self: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { id, email, role, banned } = detail.user;

  const why = self ? 'This is you.' : role === 'admin' ? "Admins can't be viewed as." : banned ? "Banned users can't be viewed as. Unban them first." : null;

  const start = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason')).trim();
    if (!window.confirm(`View the site as ${email} for up to 30 minutes? This is recorded, with your reason.`)) return;
    setBusy(true);
    setError(null);
    try {
      await startImpersonating(id, reason);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Card title="View as this user">
      {why ? (
        <Muted>{why}</Muted>
      ) : (
        <form onSubmit={start} className="flex flex-col gap-2">
          <Muted>Opens the map signed in as them, for up to 30 minutes. The console stays closed until you stop.</Muted>
          <Label text="Reason (shown in the log)">
            <Input name="reason" required maxLength={500} />
          </Label>
          <Button type="submit" disabled={busy} className="self-start">View as {email}…</Button>
        </form>
      )}
      <ErrorText message={error} />
    </Card>
  );
}
