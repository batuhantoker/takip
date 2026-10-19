'use client';

import { Button } from '@/components/ui/button';
import { useEscape } from '@/components/ui/use-escape';
import { useT } from '@/components/ui/use-t';
import { backToCorners } from '../lib/model';
import { updateLayout } from '../use-page-layout';
import { stopArranging } from './arrange-state';

/** Over the top of the map while arranging: what to do, Back to corners, and Done (or Escape). */
export default function ArrangeBar({ placed }: { placed: number }) {
  const t = useT();
  useEscape(stopArranging);
  return (
    <div role="toolbar" aria-label={t('Arrange the map')}
      className="fixed top-3 left-1/2 z-[600] flex -translate-x-1/2 items-center gap-2 rounded-float border border-line bg-surface-1 py-1.5 pr-1.5 pl-3 shadow-float">
      <span className="mr-1 text-small whitespace-nowrap text-ink-2">{t('Drag the pieces anywhere; arrow keys nudge')}</span>
      {placed > 0 && <Button variant="ghost" size="sm" onClick={() => updateLayout(backToCorners)}>{t('Back to corners')}</Button>}
      <Button variant="primary" size="sm" onClick={stopArranging}>{t('Done')}</Button>
    </div>
  );
}
