import type { InputHTMLAttributes, ReactNode } from 'react';

export const PASSWORDS_DIFFER = "The two passwords don't match.";

export const INPUT =
  'w-full h-8 px-2.5 bg-black/40 border border-white/10 text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold-primary)]/50';

export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[var(--text-muted)]">{label}</span>
      <input {...input} required className={INPUT} />
    </label>
  );
}

export function Submit({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="h-8 mt-1 text-[11px] font-bold border border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/25 disabled:opacity-50 transition-colors"
    >
      {busy ? 'One moment…' : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-[11px] text-[var(--alert-red)]">{message}</p> : null;
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-[var(--text-primary)] border-l-2 border-[var(--gold-primary)]/50 pl-2.5">{children}</p>;
}

export function TextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-[var(--gold-primary)] hover:underline">
      {children}
    </button>
  );
}
