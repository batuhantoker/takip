'use client';

import { ArrowUpRight } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

const PAIR = 'https://dexscreener.com/solana/G3rchnZ2WLsBDZSrVME4fTyzFP57F3yvvqWMxAy2b4ce';
const EMBED = `${PAIR}?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15`;

/** The $TAKIP price chart from Dexscreener, opened from the More menu. */
export default function TokenChart({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="$TAKIP chart" subtitle="Live from Dexscreener · 15 min candles" className="max-w-4xl" bare
      actions={<IconButton label="Open on Dexscreener" icon={ArrowUpRight} onClick={() => window.open(PAIR, '_blank', 'noopener,noreferrer')} />}>
      <div className="relative h-[70vh] min-h-[420px] border-t border-line bg-surface-0">
        <iframe title="$TAKIP price chart" src={EMBED} className="absolute inset-0 size-full border-0" allow="clipboard-write" />
      </div>
    </Modal>
  );
}
