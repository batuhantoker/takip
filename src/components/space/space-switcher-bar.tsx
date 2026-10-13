'use client';

import { motion } from 'framer-motion';
import { hudIn } from '@/lib/hud-motion';
import type { SpaceFocus } from '@/lib/space/worlds';
import WorldSwitcher from './world-switcher';

/** Map or space, bottom-left beside the sidebar (above the view strip on a phone). */
export default function SpaceSwitcherBar({ revealed, isMobile, inSpace, focus, onMap, onSpace }: {
  revealed: boolean;
  isMobile: boolean;
  inSpace: boolean;
  focus: SpaceFocus;
  onMap: () => void;
  onSpace: (f: SpaceFocus) => void;
}) {
  return (
    <motion.div data-hud
      initial={{ opacity: 0, y: 20 }} animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }} transition={hudIn(0.5)}
      className={`absolute z-[240] pointer-events-none ${isMobile ? 'left-3 bottom-[118px]' : 'bottom-10'}`}
      style={isMobile ? undefined : { left: 'calc(var(--shell-left, 72px) + 12px)' }}>
      <WorldSwitcher inSpace={inSpace} focus={focus} onMap={onMap} onSpace={onSpace} />
    </motion.div>
  );
}
