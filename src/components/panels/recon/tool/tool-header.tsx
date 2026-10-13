'use client';

import { ArrowLeft } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import type { ToolDef } from '@/components/panels/recon/recon-tools';

/** The open tool's name and what it does, with the way back to every tool. */
export function ToolHeader({ tool, onBack }: { tool: ToolDef; onBack: () => void }) {
  return (
    <div className="-ml-2 flex items-center gap-2">
      <IconButton label="All tools" kbd="Esc" icon={ArrowLeft} onClick={onBack} tooltipSide="right" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-body font-medium text-ink-1">{tool.label}</span>
        <span className="truncate text-small text-ink-3">{tool.blurb}</span>
      </div>
    </div>
  );
}
