'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { cx, isNumeric, type Tone } from '@/components/ui/class-names';
import { Tag } from '@/components/ui/tag';
import { Button } from '@/components/ui/button';
import type { ReconData } from '@/lib/intel/recon/lookup';

export interface ToolResultProps { r: ReconData; query: string }

/** An API's shouted enum ("HIGH", "FIXED_LINE") as words: "High", "Fixed line". */
export const plain = (v: unknown) => {
  const s = String(v ?? '').replace(/_/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Upstreams fill gaps with these instead of leaving the field out. */
export const known = (v: unknown) => v != null && v !== '' && v !== 'N/A' && v !== 'Unknown';

// UTC so a registry's midnight timestamp doesn't land on the previous day west of Greenwich.
const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "13 Aug 1995", or the input untouched when it is not a date. */
export function day(v: unknown): string | null {
  if (!known(v)) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : DATE_FMT.format(d);
}

/** "in 10 months", "29 years ago": how far a date is from now, roughly. */
export function fromNow(v: unknown): string | null {
  const t = new Date(String(v ?? '')).getTime();
  if (!known(v) || Number.isNaN(t)) return null;
  const days = Math.round((t - Date.now()) / 86_400_000);
  const n = Math.abs(days);
  const span = n < 1 ? 'today' : n < 45 ? `${n} ${n === 1 ? 'day' : 'days'}` : n < 545 ? `${Math.round(n / 30.4)} months` : `${Math.round(n / 365.25)} years`;
  if (span === 'today') return span;
  return days > 0 ? `in ${span}` : `${span} ago`;
}

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'text-ink-1', accent: 'text-accent', red: 'text-red', amber: 'text-amber', green: 'text-green', blue: 'text-blue',
};

type Value = string | number | boolean | null | undefined;

/** One fact: a label, its value (or several, one per line), a quiet note, and a copy button for real strings. */
export function ResultRow({ label, value, tone, mono, note }: {
  label: string;
  value: Value | Value[];
  tone?: Tone;
  mono?: boolean;
  /** Context after the value in ink-3: "in 10 months". */
  note?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const values = (Array.isArray(value) ? value : [value]).filter(known).map(String);
  if (!values.length) return null;
  const text = values.join('\n');
  const canCopy = text.length > 2 && text.length < 4000 && !/^(yes|no)$/i.test(text);

  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  };

  return (
    <div className="group/row flex items-start gap-3 border-b border-line py-2 last:border-0">
      <span className="w-[96px] shrink-0 text-small text-ink-2">{label}</span>
      <div className={cx('flex min-w-0 flex-1 flex-col text-small', values.length > 1 && 'gap-1', TONE_CLASS[tone ?? 'neutral'])}>
        {values.map((v, i) => (
          <div key={i} className={cx('break-words', (mono ?? isNumeric(v)) && 'font-mono tabular-nums')}>{v}</div>
        ))}
        {note && <div className="text-meta text-ink-3">{note}</div>}
      </div>
      {canCopy && (
        <button type="button" aria-label={copied ? 'Copied' : `Copy ${label}`} onClick={copy}
          className="-my-0.5 flex size-5 shrink-0 items-center justify-center rounded text-ink-3 opacity-0 transition-opacity group-hover/row:opacity-100 pointer-coarse:opacity-100 hover:bg-surface-3 hover:text-ink-1 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent">
          {copied ? <Check aria-hidden className="size-3" strokeWidth={2.5} /> : <Copy aria-hidden className="size-3" strokeWidth={1.75} />}
        </button>
      )}
    </div>
  );
}

/** Copies a whole list at once, for a section's header. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  return <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copy}>{copied ? 'Copied' : label}</Button>;
}

export const SEVERITY_TONE = (sev?: string): Tone => {
  switch (String(sev || '').toUpperCase()) {
    case 'CRITICAL': case 'HIGH': return 'red';
    case 'MEDIUM': return 'amber';
    case 'LOW': case 'INFO': return 'green';
    default: return 'neutral';
  }
};

/** What was looked up, inside a sentence: mono for an IP, Geist for a host name. */
export const Target = ({ value }: { value: string }) => <span className={cx('text-ink-1', isNumeric(value) && 'font-mono tabular-nums')}>{value}</span>;

/** The answer in one line at the top, with a line of why; a status dot only when the tone means something. */
export function Verdict({ tone, title, body }: { tone?: Tone; title: ReactNode; body?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {tone && (
        <span aria-hidden className={cx('mt-[5px] size-2 shrink-0 rounded-full', {
          neutral: 'bg-ink-3', accent: 'bg-accent', red: 'bg-red', amber: 'bg-amber', green: 'bg-green', blue: 'bg-blue',
        }[tone])} />
      )}
      <div className="min-w-0">
        <p className="break-words text-title font-semibold text-ink-1">{title}</p>
        {body && <p className="mt-0.5 text-small text-ink-2">{body}</p>}
      </div>
    </div>
  );
}

/** An OFAC-SDN hit, surfaced before anything else it is attached to. */
export function SanctionsBadge({ match }: { match: any }) {
  if (!match || !Array.isArray(match.hits) || match.hits.length === 0) return null;
  return (
    <div className="mb-4 rounded-card border border-red/35 bg-red/10 p-2.5">
      <div className="mb-1.5 flex items-center gap-2 text-small font-medium text-red">
        <AlertTriangle aria-hidden className="size-3.5" strokeWidth={1.75} />
        Sanctioned: {match.source || 'OFAC SDN'}
      </div>
      {match.hits.slice(0, 5).map((h: any, i: number) => (
        <div key={i} className="break-words text-small text-ink-1">
          <span className="text-ink-3">{h.matched_value}: </span>
          {(h.entries || []).slice(0, 2).map((e: any) => e.name).join('; ')}
        </div>
      ))}
    </div>
  );
}

export function PortRow({ port, state, service, version }: { port: number; state: string; service?: string; version?: string }) {
  const open = state === 'open';
  return (
    <div className="flex items-center gap-2.5 border-b border-line py-1.5 last:border-0">
      <span className="w-14 shrink-0 font-mono text-small text-ink-1 tabular-nums">{port}</span>
      {open ? <Tag tone="green">Open</Tag> : <Tag>{plain(state)}</Tag>}
      <span className="min-w-0 flex-1 truncate text-small text-ink-2">{service || 'Unknown service'}</span>
      {version && <span className="shrink-0 text-meta text-ink-3">{version}</span>}
    </div>
  );
}

const pretty = (k: string) => plain(k.replace(/([a-z])([A-Z])/g, '$1 $2'));
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const scalar = (v: unknown): v is Value => v == null || ['string', 'number', 'boolean'].includes(typeof v);
const asValue = (v: Value) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v);

const SKIP = new Set(['timestamp', 'cached']);

/** Any answer we have no layout for, read as labelled facts instead of raw JSON. Nested objects get their own small group. */
export function Fallback({ data, exclude = [], depth = 0 }: { data: ReconData; exclude?: string[]; depth?: number }) {
  if (!isPlainObject(data)) return null;
  const entries = Object.entries(data).filter(([k, v]) => !SKIP.has(k) && !exclude.includes(k) && v != null && v !== '');
  if (!entries.length) return null;
  return (
    <div className={depth ? 'mt-1 border-l border-line pl-3' : ''}>
      {entries.map(([key, v]) => {
        if (scalar(v)) return <ResultRow key={key} label={pretty(key)} value={asValue(v)} />;
        if (Array.isArray(v)) {
          if (v.every(scalar)) return <ResultRow key={key} label={pretty(key)} value={v.slice(0, 50).map(x => asValue(x as Value))} />;
          return (
            <div key={key} className="border-b border-line py-2 last:border-0">
              <p className="text-small text-ink-3">{pretty(key)} <span className="font-mono tabular-nums">{v.length}</span></p>
              {depth < 2 && v.slice(0, 10).map((item, i) => <Fallback key={i} data={item as ReconData} depth={depth + 1} />)}
            </div>
          );
        }
        if (depth >= 2) return null;
        return (
          <div key={key} className="border-b border-line py-2 last:border-0">
            <p className="text-small text-ink-3">{pretty(key)}</p>
            <Fallback data={v as ReconData} depth={depth + 1} />
          </div>
        );
      })}
    </div>
  );
}

export const renderFallback = (results: ReconData) => <Fallback data={results} />;
export const renderFallbackExcluding = (results: ReconData, exclude: string[]) => <Fallback data={results} exclude={exclude} />;
