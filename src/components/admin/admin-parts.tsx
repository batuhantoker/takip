import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <h1 className="text-lg text-[var(--text-primary)]">{title}</h1>
      {children}
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-[var(--border-primary)] bg-[#0A0A0A] ${className}`}>
      {title && <h2 className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">{title}</h2>}
      <div className="px-4 pb-4 pt-1 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Button({ tone = 'plain', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'plain' | 'gold' | 'danger' }) {
  const tones = {
    plain: 'border-white/10 text-[var(--text-primary)] hover:bg-white/[0.07]',
    gold: 'border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/25',
    danger: 'border-[var(--alert-red)]/40 text-[var(--alert-red)] hover:bg-[var(--alert-red)]/10',
  };
  return <button type="button" {...props} className={`h-8 px-3 shrink-0 text-[12px] border transition-colors disabled:opacity-40 ${tones[tone]} ${className}`} />;
}

const CONTROL = 'h-8 px-2.5 bg-black/40 border border-white/10 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--gold-primary)]/50';

export const Input = ({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`${CONTROL} ${className}`} />;
export const Select = ({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className={`${CONTROL} ${className}`} />;

export function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[var(--text-muted)]">{text}</span>
      {children}
    </label>
  );
}

export function Badge({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'gold' | 'danger' | 'muted' }) {
  const tones = {
    plain: 'border-white/15 text-[var(--text-primary)]',
    gold: 'border-[var(--gold-primary)]/40 text-[var(--gold-primary)]',
    danger: 'border-[var(--alert-red)]/40 text-[var(--alert-red)]',
    muted: 'border-white/10 text-[var(--text-muted)]',
  };
  return <span className={`inline-block px-1.5 py-px border text-[10px] leading-4 whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export const TABLE = 'w-full text-left text-[12px] border-collapse';
export const TH = 'px-3 py-2 text-[10px] uppercase tracking-[0.15em] font-normal text-[var(--text-muted)] border-b border-white/10';
export const TD = 'px-3 py-2 border-b border-white/5 align-top';

export const ErrorText = ({ message }: { message?: string | null }) =>
  message ? <p role="alert" className="text-[12px] text-[var(--alert-red)]">{message}</p> : null;

export const Muted = ({ children }: { children: ReactNode }) => <p className="text-[12px] text-[var(--text-muted)]">{children}</p>;

/** "Until" dates mean the end of that day in UTC, so show them in UTC: a local zone east of it would show the next day. */
export const day = (at: number | null | undefined) =>
  at == null ? '—' : new Date(at).toLocaleDateString('en', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

export const when = (at: string | number | null | undefined) =>
  at == null ? '—' : new Date(at).toLocaleString('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
