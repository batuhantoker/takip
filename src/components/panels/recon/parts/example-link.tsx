'use client';

import { Fragment } from 'react';
import { cx, FOCUS_RING, isNumeric } from '@/components/ui/class-names';

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
  return (
    <>
      Try{' '}
      {values.map((v, i) => (
        <Fragment key={v}>
          {i > 0 && (i === values.length - 1 ? ' or ' : ', ')}
          <ExampleLink value={v} onPick={onPick} />
        </Fragment>
      ))}
    </>
  );
}
