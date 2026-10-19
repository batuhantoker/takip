'use client';

import { cx } from '@/components/ui/class-names';
import { Tag } from '@/components/ui/tag';
import { useT } from '@/components/ui/use-t';
import type { Row, RowStatus } from '@/lib/intel/recon/fingerprint/rows';
import { STATUS_DISPLAY } from './fingerprint-status';

/** `live` is false once a search has ended: a hit still awaiting calibration then never got it. Found is what the list is, so it goes unmarked. */
export function StatusPill({ status, live }: { status: RowStatus; live: boolean }) {
  const t = useT();
  if (status === 'verified') return null;
  const d = STATUS_DISPLAY[status];
  const pending = status === 'verifying';
  const tone = d.tone === 'muted' ? 'neutral' : d.tone === 'gold' ? 'amber' : d.tone;
  return <Tag tone={tone}>{pending && !live ? t('Unverified') : t(d.label)}</Tag>;
}

/** The platform initial, kept calm: a neutral square, not a colour per category. */
export function PlatformTile({ row, small }: { row: Row; small?: boolean }) {
  return (
    <span className={cx(
      'flex shrink-0 items-center justify-center rounded-control border border-line bg-surface-2 font-medium text-ink-2',
      small ? 'size-[18px] text-meta' : 'size-7 text-small',
    )}>
      {row.site.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase() || '?'}
    </span>
  );
}
