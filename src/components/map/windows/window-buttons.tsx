'use client';

import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { useWindowControls } from './floating-window';

/** Folds the window to its header and back; renders nothing outside a window. */
export function WindowFoldButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const w = useWindowControls();
  if (!w) return null;
  return <IconButton label={w.collapsed ? 'Unfold' : 'Fold'} icon={w.collapsed ? ChevronDown : ChevronUp} size={size} onClick={w.toggleFold} />;
}

/** Large size and back, the same as a double-click on the header. */
export function WindowSizeButton({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const w = useWindowControls();
  if (!w) return null;
  return <IconButton label={w.big ? 'Smaller' : 'Larger'} icon={w.big ? Minimize2 : Maximize2} size={size} onClick={w.toggleBig} />;
}
