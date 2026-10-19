'use client';

import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import { useWindowControls } from './floating-window';

/** Folds the window to its header and back; renders nothing outside a window. */
export function WindowFoldButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const t = useT();
  const w = useWindowControls();
  if (!w) return null;
  return <IconButton label={w.collapsed ? t('Unfold') : t('Fold')} icon={w.collapsed ? ChevronDown : ChevronUp} size={size} onClick={w.toggleFold} />;
}

/** Large size and back, the same as a double-click on the header. */
export function WindowSizeButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const t = useT();
  const w = useWindowControls();
  if (!w) return null;
  return <IconButton label={w.big ? t('Smaller') : t('Larger')} icon={w.big ? Minimize2 : Maximize2} size={size} onClick={w.toggleBig} />;
}
