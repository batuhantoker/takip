'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import { BriefCard } from '@/components/panels/alerts/parts/alert-brief';
import { TiGlyph } from '@/components/panels/ti-agent/atoms';
import { useOverview } from '@/components/panels/alerts/hooks/use-overview';

interface AiOverviewProps {
  mode: 'alerts' | 'markets';
  payload: unknown;
  /** Changes when the underlying feed changes, so a stale read-out can say so. */
  signature?: string;
  activeThreadId?: string | null;
  onThreadSelect?: (id: string | null) => void;
  onOpenChange?: (open: boolean) => void;
}

/** "Brief me": one click for TI's read of whatever payload it is handed. */
export default function AiOverview({ mode, payload, signature, activeThreadId, onThreadSelect, onOpenChange }: AiOverviewProps) {
  const t = useT();
  const overview = useOverview(mode, payload, signature);
  const [open, setOpenState] = useState(false);
  const setOpen = useCallback((next: boolean) => { setOpenState(next); onOpenChange?.(next); }, [onOpenChange]);
  const [now, setNow] = useState(() => Date.now());

  const toggle = () => {
    const next = !open;
    setOpen(next);
    setNow(Date.now());
    if (next && !overview.result && !overview.loading) overview.generate();
  };

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <Button variant="ghost" size="sm" icon={TiGlyph} aria-expanded={open} onClick={toggle}>
        {open ? t('Hide brief') : t('Brief me')}
      </Button>
      {open && (
        <div className="w-full">
          <BriefCard overview={overview} now={now} activeThreadId={activeThreadId} onThreadSelect={onThreadSelect} />
        </div>
      )}
    </div>
  );
}
