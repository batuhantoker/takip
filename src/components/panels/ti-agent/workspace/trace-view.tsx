'use client';
/**
 * TAKIP TI: the execution trace.
 *
 * The run as the engine ran it: each step with its state, how long it took
 * (live, for the one under way), the engine's own words for it and what it
 * produced. Steps not reached yet are listed, so the whole plan shows from
 * the first event.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Minus, X } from 'lucide-react';
import { cx } from '@/components/ui/class-names';
import { PanelSection } from '@/components/ui/panel';
import { Stat } from '@/components/ui/stat';
import { useT } from '@/components/ui/use-t';
import { traceOf, type TraceStep } from '@/lib/ai/workspace/trace';
import type { RunState } from '@/lib/ai/state';
import { phaseText, took, tookParts } from '@/components/panels/ti-agent/theme';
import { Figures } from '@/components/panels/ti-agent/parts/figures';

function StepIcon({ status }: { status: TraceStep['status'] }) {
  const box = 'relative z-[1] flex size-[18px] shrink-0 items-center justify-center rounded-full';
  if (status === 'done') return <span className={cx(box, 'bg-gold-soft text-gold')}><Check aria-hidden className="size-2.5" strokeWidth={3} /></span>;
  if (status === 'active') return <span className={cx(box, 'bg-surface-1 text-ink-1 ring-1 ring-gold')}><LoaderCircle aria-hidden className="size-2.5 animate-spin motion-reduce:animate-none" strokeWidth={3} /></span>;
  if (status === 'failed') return <span className={cx(box, 'bg-red/15 text-red')}><X aria-hidden className="size-2.5" strokeWidth={3} /></span>;
  if (status === 'skipped') return <span className={cx(box, 'bg-surface-1 text-ink-3 ring-1 ring-line-strong')}><Minus aria-hidden className="size-2.5" /></span>;
  return <span className={cx(box, 'bg-surface-1 ring-1 ring-line-strong')} />;
}

export function TraceView({ s }: { s: RunState }) {
  const t = useT();
  const steps = useMemo(() => traceOf(s, t), [s, t]);
  // The step under way shows its time ticking.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (s.status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [s.status]);

  const total = s.startedAt ? (s.endedAt || (s.status === 'running' ? now : s.updatedAt)) - s.startedAt : 0;
  const tokens = s.usage.input + s.usage.output;

  return (
    <section aria-label={t('Execution trace')} className="flex flex-col">
      <div className="grid grid-cols-3 gap-4">
        <Stat size="sm" label={t('Time')} {...tookParts(total)} />
        <Stat size="sm" label={t('Model calls')} value={s.usage.calls.toLocaleString(t.intl)} />
        <Stat size="sm" label={t('Tokens')} value={tokens ? tokens.toLocaleString(t.intl) : '—'} />
      </div>
      <PanelSection title={t('Steps')} hint={`${s.provider} / ${s.model}`} className="mt-6">
        <ol className="relative flex flex-col">
          {steps.map((st, i) => {
            const running = st.status === 'active';
            const duration = st.start !== null ? (st.end ?? now) - st.start : null;
            const quiet = st.status === 'pending' || st.status === 'skipped';
            return (
              <li key={st.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < steps.length - 1 && <span className={cx('absolute top-[18px] bottom-0 left-[8.5px] w-px', st.status === 'done' ? 'bg-gold/40' : 'bg-line')} />}
                <StepIcon status={st.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={cx('flex-1 truncate text-small font-medium', quiet ? 'text-ink-3' : 'text-ink-1')}>{st.title}</span>
                    <span className={cx('shrink-0 text-meta', running ? 'text-ink-1' : 'text-ink-3')}>
                      {duration !== null ? <Figures text={took(duration)} /> : st.status === 'skipped' ? t('Not reached') : t('Waiting')}
                    </span>
                  </div>
                  {st.detail && !quiet && <p className="mt-0.5 truncate text-meta text-ink-2">{phaseText(t, st.phase, st.detail)}</p>}
                  {st.metrics.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-meta">
                      {st.metrics.map(m => (
                        <span key={m.label} className="whitespace-nowrap">
                          <span className="text-ink-3">{m.label}</span> <span className="font-mono text-ink-1 tabular-nums">{m.value}</span>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </PanelSection>
      {s.warnings.length > 0 && (
        <details className="group mt-5 rounded-card border border-line px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-small text-ink-2 hover:text-ink-1">
            <span className="flex-1">{t('{n, plural, one {# hiccup} other {# hiccups}} along the way', { n: s.warnings.length })}</span>
            <ChevronDown aria-hidden className="size-4 text-ink-3 transition-transform duration-150 group-open:rotate-180" strokeWidth={1.75} />
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {s.warnings.slice(-6).map((w, i) => <li key={i} className="truncate text-meta text-ink-2" title={w}>{w}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
