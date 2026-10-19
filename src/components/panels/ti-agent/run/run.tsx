'use client';
/**
 * TAKIP TI: a run at a glance: the question, where the run is, its
 * controls, and the quiet accounting at the foot.
 */
import { useState } from 'react';
import { Camera, Check, Crosshair, Square, Zap } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';
import { TextField } from '@/components/ui/field';
import { Dot } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import type { AiClient } from '@/components/panels/ti-agent/use-ai';
import type { RunState } from '@/lib/ai/state';
import { KIND_LABEL, phaseText, took } from '@/components/panels/ti-agent/theme';
import { AiMark } from '@/components/panels/ti-agent/atoms';
import { Figures } from '@/components/panels/ti-agent/parts/figures';

export { Verdict } from './verdict';

const PHASES: { id: RunState['phase']; label: string }[] = [
  { id: 'context', label: msg('Research') },
  { id: 'graph', label: msg('World') },
  { id: 'agents', label: msg('Cast') },
  { id: 'simulate', label: msg('Simulate') },
  { id: 'report', label: msg('Report') },
];

/** The run's five stages as one line: done in gold, the current one live, the rest waiting. */
export function PhaseRail({ s }: { s: RunState }) {
  const t = useT();
  const n = PHASES.length;
  const at = s.status === 'done' ? n : PHASES.findIndex(p => p.id === s.phase);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={t('Stage {at} of {n}', { at: Math.min(at + 1, n), n })}>
      {PHASES.map((p, i) => {
        const done = i < at;
        const now = i === at && s.status === 'running';
        const failed = i === at && s.status === 'failed';
        return (
          <li key={p.id} aria-current={now ? 'step' : undefined} className="flex min-w-0 flex-col gap-1.5">
            <span className={cx('h-0.5 rounded-full', failed ? 'bg-red' : done ? 'bg-gold' : now ? 'bg-gold/45' : 'bg-surface-3')} />
            <span className={cx('truncate text-meta', failed ? 'text-red' : now ? 'font-medium text-ink-1' : done ? 'text-ink-2' : 'text-ink-3')}>{t(p.label)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusLine({ s }: { s: RunState }) {
  const t = useT();
  if (s.status === 'running') {
    const thinking = Object.keys(s.thinking).length;
    return (
      <p role="status" className="flex min-w-0 items-start gap-2 text-small text-ink-2">
        <Dot tone="gold" pulse className="mt-[5px]" />
        <span className="line-clamp-2 min-w-0">
          {s.phaseLabel ? phaseText(t, s.phase, s.phaseLabel) : t('Starting')}
          {thinking > 0 && <span className="text-ink-3"> · {t.rich('{n} actors deciding', { n: <span className="font-mono tabular-nums">{thinking.toLocaleString(t.intl)}</span> })}</span>}
        </span>
      </p>
    );
  }
  if (s.status === 'failed') return <p role="status" className="min-w-0 truncate text-small text-red">{s.message || t('The run failed.')}</p>;
  if (s.status === 'cancelled') return <p role="status" className="text-small text-ink-2">{t('Stopped')}</p>;
  const elapsed = s.startedAt && s.endedAt ? took(s.endedAt - s.startedAt) : '';
  return (
    <p role="status" className="flex min-w-0 items-center gap-1.5 text-small text-ink-2">
      <Check aria-hidden className="size-3.5 shrink-0 text-green" strokeWidth={2} />
      <span className="shrink-0">{t('Prediction ready')}</span>
      {elapsed && <span className="truncate text-ink-3">· <Figures text={t('{elapsed}, {n, plural, one {# model call} other {# model calls}}', { elapsed, n: s.usage.calls })} /></span>}
    </p>
  );
}

export function Controls({ s, ai, focus, onFocus, following, onFollow }: { s: RunState; ai: AiClient; focus?: boolean; onFocus?: () => void; following?: boolean; onFollow?: () => void }) {
  const t = useT();
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {following !== undefined && onFollow && (
        <IconButton size="sm" icon={Camera} active={following} onClick={following ? undefined : onFollow}
          label={following ? t('The camera follows the run; move the map to take over') : t('Follow the run with the camera')} />
      )}
      {onFocus && <IconButton size="sm" icon={Crosshair} active={focus} onClick={onFocus} label={focus ? t('Bring the other map layers back') : t('Hide the other map layers')} />}
      {s.status === 'running' && ai.canSteer && <IconButton size="sm" icon={Square} onClick={() => ai.cancel()} label={t('Stop the run')} />}
    </div>
  );
}

export function RunHead({ s, ai, focus, onFocus, following, onFollow }: { s: RunState; ai: AiClient; focus?: boolean; onFocus?: () => void; following?: boolean; onFollow?: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div>
        {s.frame && <p className="mb-1 text-meta font-medium text-ink-3">{t(KIND_LABEL[s.frame.kind])}</p>}
        <h3 className="text-title font-semibold text-ink-1">{s.question}</h3>
        {s.frame && s.frame.proposition !== s.question && (
          <p className="mt-1.5 text-small text-ink-2">
            <span className="text-ink-3">
              {s.frame.kind === 'binary'
                ? t.rich('Resolves yes if {proposition}', { proposition: <span className="text-ink-2">{s.frame.proposition}</span> })
                : t.rich('Framed as {proposition}', { proposition: <span className="text-ink-2">{s.frame.proposition}</span> })}
            </span>
            {s.frame.horizon && <span className="text-ink-3"> · {t('by {date}', { date: s.frame.horizon })}</span>}
          </p>
        )}
      </div>
      {s.status !== 'done' && <PhaseRail s={s} />}
      <div className="-my-1 flex min-h-8 items-center gap-2">
        <div className="min-w-0 flex-1"><StatusLine s={s} /></div>
        <Controls s={s} ai={ai} focus={focus} onFocus={onFocus} following={following} onFollow={onFollow} />
      </div>
    </div>
  );
}

/** A run is open but has not spoken yet: say so, so the panel never looks as if nothing happened. */
export function Connecting({ onCancel }: { onCancel: () => void }) {
  const t = useT();
  return (
    <section role="status" className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-gold-soft"><AiMark size={20} live /></span>
      <p className="text-body font-medium text-ink-1">{t('Starting your forecast')}</p>
      <p className="mt-1 max-w-[260px] text-small text-ink-2">{t('TI researches the question first, then casts the actors. The map draws as it goes.')}</p>
      <Button variant="ghost" size="sm" className="mt-4" onClick={onCancel} title={t('It keeps running; open it again from your forecasts')}>{t('Ask something else')}</Button>
    </section>
  );
}

/** Steering a live run: something that happens in every world from the next period on. */
export function InjectBox({ ai, s }: { ai: AiClient; s: RunState }) {
  const t = useT();
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const late = s.phase === 'report';
  const send = async () => {
    if (text.trim().length < 3) return;
    const err = await ai.inject(text.trim());
    setNote(err ?? t('Added. It happens in every world in the next period.'));
    if (!err) setText('');
    setTimeout(() => setNote(''), 3500);
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void send(); }}>
      <TextField size="sm" label={t('Add an event')} value={text} onChange={e => setText(e.target.value.slice(0, 400))} disabled={late}
        leading={<Zap aria-hidden className="size-3.5" strokeWidth={1.75} />}
        placeholder={late ? t('The report is being written') : t('Something that happens in every world next')}
        trailing={<Button type="submit" variant="ghost" size="sm" className="-mr-1.5" disabled={late || text.trim().length < 3}>{t('Add')}</Button>}
        hint={note || undefined} />
    </form>
  );
}

/** The run's accounting, for the panel's foot. */
export function UsageLine({ s }: { s: RunState }) {
  const t = useT();
  const tokens = s.usage.input + s.usage.output;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-meta text-ink-3">
      <span className="min-w-0 truncate" title={`${s.provider} / ${s.model}`}>{s.model}</span>
      <span aria-hidden>·</span><span className="shrink-0">{t.rich('{n} calls', { n: <span className="font-mono tabular-nums">{s.usage.calls.toLocaleString(t.intl)}</span> })}</span>
      {tokens > 0 && <><span aria-hidden>·</span><span className="shrink-0">{t.rich('{n} tokens', { n: <span className="font-mono tabular-nums">{tokens.toLocaleString(t.intl)}</span> })}</span></>}
      {s.warnings.length > 0 && (
        <><span aria-hidden>·</span><span title={s.warnings.join('\n')} className="shrink-0 cursor-help text-ink-2 underline decoration-ink-4 decoration-dotted underline-offset-2">{t('{n, plural, one {# hiccup} other {# hiccups}}', { n: s.warnings.length })}</span></>
      )}
    </span>
  );
}
