import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <h1 className="text-[20px] font-semibold text-ink-1">{title}</h1>
      {children}
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-line bg-surface-1 ${className}`}>
      {title && <h2 className="px-4 pt-3 pb-2 text-[12px] font-medium text-ink-3">{title}</h2>}
      <div className="px-4 pb-4 pt-1 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Button({ tone = 'plain', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'plain' | 'gold' | 'danger' }) {
  const tones = {
    plain: 'border-line-strong bg-surface-2 text-ink-1 hover:bg-surface-3',
    // "gold" is the page's one primary action; it draws in the accent like every other primary.
    gold: 'border-transparent bg-accent text-on-accent hover:bg-accent/90',
    danger: 'border-line-strong bg-surface-2 text-red hover:border-red/40 hover:bg-red/10',
  };
  return <button type="button" {...props} className={`h-8 px-3 shrink-0 rounded-md text-[13px] font-medium border transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${tones[tone]} ${className}`} />;
}

const CONTROL = 'h-8 px-2.5 rounded-md bg-surface-2 border border-line-strong text-[13px] text-ink-1 placeholder:text-ink-4 outline-none focus:border-accent';

export const Input = ({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`${CONTROL} ${className}`} />;
export const Select = ({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className={`${CONTROL} ${className}`} />;

export function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-ink-3">{text}</span>
      {children}
    </label>
  );
}

export function Badge({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'gold' | 'danger' | 'muted' }) {
  const tones = {
    plain: 'border-line-strong text-ink-2',
    // "gold" marks a live or healthy state.
    gold: 'border-green/35 text-green',
    danger: 'border-red/35 text-red',
    muted: 'border-line text-ink-3',
  };
  return <span className={`inline-flex h-5 items-center rounded-[4px] px-1.5 border text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export const TABLE = 'w-full text-left text-[13px] border-collapse';
export const TH = 'px-3 py-2 text-[12px] font-medium text-ink-3 border-b border-line-strong';
export const TD = 'px-3 py-2 border-b border-line align-top';

export const ErrorText = ({ message }: { message?: string | null }) =>
  message ? <p role="alert" className="text-[13px] text-red">{message}</p> : null;

export const Muted = ({ children }: { children: ReactNode }) => <p className="text-[13px] text-ink-3">{children}</p>;

/** "Until" dates mean the end of that day in UTC, so show them in UTC: a local zone east of it would show the next day. */
export const day = (at: number | null | undefined) =>
  at == null ? '—' : new Date(at).toLocaleDateString('en', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });

export const when = (at: string | number | null | undefined) =>
  at == null ? '—' : new Date(at).toLocaleString('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
