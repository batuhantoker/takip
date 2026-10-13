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
import type { OiClient } from '@/lib/oi/client';
import type { RunState } from '@/lib/oi/state';
import { KIND_LABEL, plural, took } from '@/components/panels/ti-agent/theme';
import { OiMark } from '@/components/panels/ti-agent/atoms';
import { Figures } from '@/components/panels/ti-agent/parts/figures';

export { Verdict } from './verdict';

const PHASES: { id: RunState['phase']; label: string }[] = [
  { id: 'context', label: 'Research' },
  { id: 'graph', label: 'World' },
  { id: 'agents', label: 'Cast' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'report', label: 'Report' },
];

/** The run's five stages as one line: done in gold, the current one live, the rest waiting. */
export function PhaseRail({ s }: { s: RunState }) {
  const n = PHASES.length;
  const at = s.status === 'done' ? n : PHASES.findIndex(p => p.id === s.phase);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label={`Stage ${Math.min(at + 1, n)} of ${n}`}>
      {PHASES.map((p, i) => {
        const done = i < at;
        const now = i === at && s.status === 'running';
        const failed = i === at && s.status === 'failed';
        return (
          <li key={p.id} aria-current={now ? 'step' : undefined} className="flex min-w-0 flex-col gap-1.5">
            <span className={cx('h-0.5 rounded-full', failed ? 'bg-red' : done ? 'bg-gold' : now ? 'bg-gold/45' : 'bg-surface-3')} />
            <span className={cx('truncate text-meta', failed ? 'text-red' : now ? 'font-medium text-ink-1' : done ? 'text-ink-2' : 'text-ink-3')}>{p.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusLine({ s }: { s: RunState }) {
  if (s.status === 'running') {
    const thinking = Object.keys(s.thinking).length;
    return (
      <p role="status" className="flex min-w-0 items-start gap-2 text-small text-ink-2">
        <Dot tone="gold" pulse className="mt-[5px]" />
        <span className="line-clamp-2 min-w-0">
          {s.phaseLabel || 'Starting'}
          {thinking > 0 && <span className="text-ink-3"> · <span className="font-mono tabular-nums">{thinking}</span> actors deciding</span>}
        </span>
      </p>
    );
  }
  if (s.status === 'failed') return <p role="status" className="min-w-0 truncate text-small text-red">{s.message || 'The run failed.'}</p>;
  if (s.status === 'cancelled') return <p role="status" className="text-small text-ink-2">Stopped</p>;
  const elapsed = s.startedAt && s.endedAt ? took(s.endedAt - s.startedAt) : '';
  return (
    <p role="status" className="flex min-w-0 items-center gap-1.5 text-small text-ink-2">
      <Check aria-hidden className="size-3.5 shrink-0 text-green" strokeWidth={2} />
      <span className="shrink-0">Prediction ready</span>
      {elapsed && <span className="truncate text-ink-3">· <Figures text={`${elapsed}, ${plural(s.usage.calls, 'model call')}`} /></span>}
    </p>
  );
}

export function Controls({ s, oi, focus, onFocus, following, onFollow }: { s: RunState; oi: OiClient; focus?: boolean; onFocus?: () => void; following?: boolean; onFollow?: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {following !== undefined && onFollow && (
        <IconButton size="sm" icon={Camera} active={following} onClick={following ? undefined : onFollow}
          label={following ? 'The camera follows the run; move the map to take over' : 'Follow the run with the camera'} />
      )}
      {onFocus && <IconButton size="sm" icon={Crosshair} active={focus} onClick={onFocus} label={focus ? 'Bring the other map layers back' : 'Hide the other map layers'} />}
      {s.status === 'running' && oi.canSteer && <IconButton size="sm" icon={Square} onClick={() => oi.cancel()} label="Stop the run" />}
    </div>
  );
}

export function RunHead({ s, oi, focus, onFocus, following, onFollow }: { s: RunState; oi: OiClient; focus?: boolean; onFocus?: () => void; following?: boolean; onFollow?: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        {s.frame && <p className="mb-1 text-meta font-medium text-ink-3">{KIND_LABEL[s.frame.kind]}</p>}
        <h3 className="text-title font-semibold text-ink-1">{s.question}</h3>
        {s.frame && s.frame.proposition !== s.question && (
          <p className="mt-1.5 text-small text-ink-2">
            <span className="text-ink-3">{s.frame.kind === 'binary' ? 'Resolves yes if ' : 'Framed as '}</span>{s.frame.proposition}
            {s.frame.horizon && <span className="text-ink-3"> · by {s.frame.horizon}</span>}
          </p>
        )}
      </div>
      {s.status !== 'done' && <PhaseRail s={s} />}
      <div className="-my-1 flex min-h-8 items-center gap-2">
        <div className="min-w-0 flex-1"><StatusLine s={s} /></div>
        <Controls s={s} oi={oi} focus={focus} onFocus={onFocus} following={following} onFollow={onFollow} />
      </div>
    </div>
  );
}

/** A run is open but has not spoken yet: say so, so the panel never looks as if nothing happened. */
export function Connecting({ onCancel }: { onCancel: () => void }) {
  return (
    <section role="status" className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-gold-soft"><OiMark size={20} live /></span>
      <p className="text-body font-medium text-ink-1">Starting your forecast</p>
      <p className="mt-1 max-w-[260px] text-small text-ink-2">TI researches the question first, then casts the actors. The map draws as it goes.</p>
      <Button variant="ghost" size="sm" className="mt-4" onClick={onCancel} title="It keeps running; open it again from your forecasts">Ask something else</Button>
    </section>
  );
}

/** Steering a live run: something that happens in every world from the next period on. */
export function InjectBox({ oi, s }: { oi: OiClient; s: RunState }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const late = s.phase === 'report';
  const send = async () => {
    if (text.trim().length < 3) return;
    const err = await oi.inject(text.trim());
    setMsg(err ?? 'Added. It happens in every world in the next period.');
    if (!err) setText('');
    setTimeout(() => setMsg(''), 3500);
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void send(); }}>
      <TextField size="sm" label="Add an event" value={text} onChange={e => setText(e.target.value.slice(0, 400))} disabled={late}
        leading={<Zap aria-hidden className="size-3.5" strokeWidth={1.75} />}
        placeholder={late ? 'The report is being written' : 'Something that happens in every world next'}
        trailing={<Button type="submit" variant="ghost" size="sm" className="-mr-1.5" disabled={late || text.trim().length < 3}>Add</Button>}
        hint={msg || undefined} />
    </form>
  );
}

/** The run's accounting, for the panel's foot. */
export function UsageLine({ s }: { s: RunState }) {
  const tokens = s.usage.input + s.usage.output;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-meta text-ink-3">
      <span className="min-w-0 truncate" title={`${s.provider} / ${s.model}`}>{s.model}</span>
      <span aria-hidden>·</span><span className="shrink-0"><span className="font-mono tabular-nums">{s.usage.calls}</span> calls</span>
      {tokens > 0 && <><span aria-hidden>·</span><span className="shrink-0"><span className="font-mono tabular-nums">{tokens.toLocaleString('en-US')}</span> tokens</span></>}
      {s.warnings.length > 0 && (
        <><span aria-hidden>·</span><span title={s.warnings.join('\n')} className="shrink-0 cursor-help text-ink-2 underline decoration-ink-4 decoration-dotted underline-offset-2">{plural(s.warnings.length, 'hiccup')}</span></>
      )}
    </span>
  );
}
