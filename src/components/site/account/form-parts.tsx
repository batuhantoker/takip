import type { InputHTMLAttributes, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { cx, FOCUS_RING } from '@/components/ui/class-names';
import { msg } from '@/lib/core/i18n/translator';

export const PASSWORDS_DIFFER = msg("The two passwords don't match.");

/** For a bare <input> outside the kit's TextField; drawn the same way. */
export const INPUT =
  'h-8 w-full min-w-0 rounded-card border border-line-strong bg-surface-2 px-2.5 text-body text-ink-1 placeholder:text-ink-3 outline-none transition-colors focus:border-accent';

export function Field({ label, ...input }: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>) {
  return <TextField label={label} required {...input} />;
}

export function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <Button type="submit" variant="primary" loading={busy} className="mt-1 w-full">{children}</Button>;
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-small text-red">{message}</p> : null;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-card bg-surface-2 px-3 py-2.5 text-small text-ink-2">{children}</p>;
}

export function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx('rounded-[3px] font-medium text-accent hover:underline underline-offset-2', FOCUS_RING)}>
      {children}
    </button>
  );
}
