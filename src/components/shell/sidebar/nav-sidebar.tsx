'use client';

import { Fragment, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TakipMark } from '@/components/shell/brand/takip-mark';
import { AiMark } from '@/components/panels/ti-agent/atoms';
import { Dot } from '@/components/ui/tag';
import { cx } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { NAV_WIDTH, type ToolId } from './dock';
import { RailButton } from './rail-button';

export interface NavItem {
  id: ToolId;
  label: string;
  /** The tooltip: what the panel is for, in a few words. */
  hint: string;
  kbd?: string;
  icon: LucideIcon;
  badge?: number;
  /** Still on with its panel closed, such as History's timeline. */
  running?: boolean;
}

/** The one place to start anything: each entry opens its panel beside the sidebar; TI sits apart. */
export function NavSidebar({ groups, active, onSelect, ti = true, tiLive, tiRunning, footer, revealed }: {
  groups: NavItem[][];
  active: ToolId | null;
  onSelect: (id: ToolId) => void;
  /** Off when the person hid TI from the sidebar; T still opens it. */
  ti?: boolean;
  tiLive: boolean;
  tiRunning: boolean;
  footer: ReactNode;
  revealed: boolean;
}) {
  const t = useT();
  return (
    <nav data-hud aria-label={t('Tools')}
      className={cx(
        'absolute top-0 bottom-[var(--shell-foot,28px)] left-0 z-[260] flex flex-col border-r border-line bg-surface-1 px-2 pt-3 pb-2',
        'transition-opacity duration-150 ease-out motion-reduce:transition-none',
        revealed ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      style={{ width: NAV_WIDTH }}>
      <div className="mb-3 flex h-9 shrink-0 items-center justify-center">
        <TakipMark title="TAKIP" className="h-7 w-auto text-ink-1" />
      </div>
      <div className="-mx-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-2 [scrollbar-width:none]">
        {groups.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <div aria-hidden className="h-3 shrink-0" />}
            <div className="flex flex-col gap-0.5">
              {group.map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className="relative">
                    <RailButton glyph={<Icon className="size-[18px]" strokeWidth={1.75} />} label={t(item.label)}
                      hint={t(item.hint)} kbd={item.kbd} badge={item.badge} active={active === item.id} pressed={active === item.id}
                      onClick={() => onSelect(item.id)} />
                    {item.running && active !== item.id && <span className="pointer-events-none absolute top-2 right-3 flex"><Dot tone="accent" label={t('{name} is on', { name: t(item.label) })} /></span>}
                  </div>
                );
              })}
            </div>
          </Fragment>
        ))}
        {ti && (
          <>
            <div aria-hidden className="mx-auto my-3 h-px w-8 shrink-0 bg-line" />
            <div className="relative">
              <RailButton glyph={<AiMark size={18} live={tiLive} />} label="TI" tone="gold" hint={t('Ask TI to work the map')} kbd="T"
                active={active === 'ai'} pressed={active === 'ai'} onClick={() => onSelect('ai')} />
              {/* Dot is position: relative itself, so a wrapper places it. */}
              {tiRunning && <span className="pointer-events-none absolute top-2 right-3 flex"><Dot tone="gold" pulse label={t('TI is working')} /></span>}
            </div>
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-0.5 pt-2">{footer}</div>
    </nav>
  );
}
