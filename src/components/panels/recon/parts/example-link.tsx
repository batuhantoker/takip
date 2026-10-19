'use client';

import { Fragment } from 'react';
import { cx, FOCUS_RING, isNumeric } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';

/** A sample target set inline in a sentence; one click uses it. */
export function ExampleLink({ value, onPick }: { value: string; onPick: (value: string) => void }) {
  return (
    <button type="button" onClick={() => onPick(value)}
      className={cx(
        'rounded-sm text-ink-2 underline decoration-line-strong underline-offset-[3px] hover:text-ink-1 hover:decoration-ink-3',
        isNumeric(value) && 'font-mono tabular-nums',
        FOCUS_RING,
      )}>
      {value}
    </button>
  );
}

/** "Try a, b or c", each one pickable. */
export function TryExamples({ values, onPick }: { values: string[]; onPick: (value: string) => void }) {
  const t = useT();
  const list = new Intl.ListFormat(t.intl, { type: 'disjunction' }).formatToParts(values).map((part, i) => (
    part.type === 'element'
      ? <ExampleLink key={i} value={part.value} onPick={onPick} />
      : <Fragment key={i}>{part.value}</Fragment>
  ));
  return <>{t.rich('Try {examples}', { examples: <>{list}</> })}</>;
}
