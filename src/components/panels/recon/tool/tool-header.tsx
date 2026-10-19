'use client';

import { ArrowLeft } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { useT } from '@/components/ui/use-t';
import type { ToolDef } from '@/components/panels/recon/recon-tools';

/** The open tool's name and what it does, with the way back to every tool. */
export function ToolHeader({ tool, onBack }: { tool: ToolDef; onBack: () => void }) {
  const t = useT();
  return (
    <div className="-ml-2 flex items-center gap-2">
      <IconButton label={t('All tools')} kbd="Esc" icon={ArrowLeft} onClick={onBack} tooltipSide="right" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-body font-medium text-ink-1">{t(tool.label)}</span>
        <span className="truncate text-small text-ink-3">{t(tool.blurb)}</span>
      </div>
    </div>
  );
}
