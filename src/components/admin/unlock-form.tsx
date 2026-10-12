'use client';

import { useState, type FormEvent } from 'react';
import { Button, ErrorText, Input, Label } from './admin-parts';

export default function UnlockForm({ onUnlocked }: { onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('code')).trim();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/unlock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string; retryAfterSeconds?: number };
    setBusy(false);
    if (res.ok) return onUnlocked();
    setError(
      body.error === 'too_many_attempts' ? `Too many wrong codes. Try again in ${Math.ceil((body.retryAfterSeconds ?? 900) / 60)} minutes.`
      : body.error === 'invalid_code' ? "That code didn't work."
      : 'Something went wrong. Try again.',
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-[12px] text-[var(--text-muted)]">
        Enter a code from your authenticator app, or a backup code. The console then stays open on this device for 12 hours.
      </p>
      <Label text="Code">
        <Input name="code" autoComplete="one-time-code" autoFocus required minLength={6} />
      </Label>
      <ErrorText message={error} />
      <Button type="submit" tone="gold" disabled={busy}>Open the console</Button>
    </form>
  );
}
