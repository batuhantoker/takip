'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, ErrorText, Input, Label } from './admin-parts';

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** `retryAfterSeconds`: the gate is already locked by wrong codes when the page loads. */
export default function UnlockForm({ onUnlocked, retryAfterSeconds = null }: { onUnlocked: () => void; retryAfterSeconds?: number | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lock, setLock] = useState<{ until: number; now: number } | null>(() => {
    if (!retryAfterSeconds) return null;
    const now = Date.now();
    return { until: now + retryAfterSeconds * 1000, now };
  });

  const until = lock?.until;
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setLock(current => (current && Date.now() < current.until ? { ...current, now: Date.now() } : null)), 1000);
    return () => clearInterval(timer);
  }, [until]);

  const left = lock ? Math.max(0, Math.ceil((lock.until - lock.now) / 1000)) : 0;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('code')).trim();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/unlock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string; retryAfterSeconds?: number };
    setBusy(false);
    if (res.ok) return onUnlocked();
    if (body.retryAfterSeconds) {
      const now = Date.now();
      setLock({ until: now + body.retryAfterSeconds * 1000, now });
    }
    setError(
      body.error === 'too_many_attempts' ? null
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
      {left > 0 && (
        <p role="alert" className="text-[12px] text-[var(--alert-red)]">
          Too many wrong codes. You can try again in <span className="font-mono tabular-nums">{clock(left)}</span>.
        </p>
      )}
      <Button type="submit" tone="gold" disabled={busy || left > 0}>Open the console</Button>
    </form>
  );
}
