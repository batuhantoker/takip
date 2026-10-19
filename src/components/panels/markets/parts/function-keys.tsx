'use client';

import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { Select } from '@/components/ui/field';
import { useT } from '@/components/ui/use-t';
import { FUNCTIONS, type FunctionCode } from '@/lib/intel/markets/markets';
import { sectionTitle } from '@/components/panels/markets/markets-format';

/** Which section of the markets is on screen: a menu docked, a row of tabs in full screen. */
export default function FunctionKeys({ fn, setFn, maximized }: {
  fn: FunctionCode | 'HELP';
  setFn: (code: FunctionCode | 'HELP') => void;
  maximized: boolean;
}) {
  const t = useT();
  if (!maximized) {
    return (
      <Select aria-label={t('Section')} size="sm" value={fn} onChange={e => setFn(e.target.value as FunctionCode | 'HELP')} className="min-w-0 flex-1"
        options={[...FUNCTIONS.map(f => ({ value: f.code, label: sectionTitle(f.code, t) })), { value: 'HELP', label: t('How to search') }]} />
    );
  }
  return (
    <div role="tablist" aria-label={t('Section')} className="flex gap-1">
      {FUNCTIONS.map(f => (
        <button key={f.code} type="button" role="tab" aria-selected={fn === f.code} onClick={() => setFn(f.code)} title={`${f.key} · ${f.code}`}
          className={cx('inline-flex h-8 shrink-0 items-center gap-2 rounded-control px-2.5 text-small font-medium whitespace-nowrap',
            fn === f.code ? 'bg-surface-3 text-ink-1' : 'text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
          {sectionTitle(f.code, t)}
          <span className="font-mono text-meta text-ink-3 tabular-nums">{f.key}</span>
        </button>
      ))}
    </div>
  );
}
