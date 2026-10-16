'use client';

import { useState } from 'react';
import { BarChart3, BookOpen, ChartLine, Coffee, Ellipsis, Keyboard, Settings, ShieldCheck } from 'lucide-react';
import { APP_VERSION } from '@/lib/platform/app-version';
import { IconButton } from '@/components/ui/button';
import { MenuDivider, MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { DiscordIcon, XIcon } from './brand-icons';
import { RailButton } from '@/components/shell/sidebar/rail-button';
import { showShortcuts } from '@/components/shell/keyboard/shortcuts-state';
import { openSettings } from '@/components/shell/settings/open-settings';
import TokenChart from './token-chart';

const SOCIAL = [
  { href: 'https://discord.gg/EPaFD5FFKf', label: 'TAKIP on Discord', Icon: DiscordIcon },
  { href: 'https://x.com/soulsimplifai', label: 'TAKIP on X', Icon: XIcon },
];

/**
 * Everything kept off the main screen: Markets, the token chart, support,
 * Settings, the docs and the community. `rail` is the sidebar's entry; `compact` the phone's.
 */
export default function MoreMenu({ compact = false, rail = false, active = false, onOpenMarkets }: {
  compact?: boolean;
  rail?: boolean;
  /** Something opened from here (Markets) is showing beside the sidebar. */
  active?: boolean;
  onOpenMarkets: () => void;
}) {
  const [tokenOpen, setTokenOpen] = useState(false);
  const trigger = rail
    ? <RailButton glyph={<Ellipsis className="size-[18px]" strokeWidth={1.75} />} label="More" active={active} />
    : <IconButton label="More" icon={Ellipsis} tooltipSide="bottom" />;

  return (
    <>
      <Popover role="menu" label="More" placement={rail ? 'right' : 'bottom'} align="end" className="w-64 p-1" trigger={trigger}>
        {close => (
          <>
            <MenuItem icon={BarChart3} kbd={compact ? undefined : 'M'} onSelect={() => { close(); onOpenMarkets(); }}>Markets</MenuItem>
            <MenuItem icon={ChartLine} onSelect={() => { close(); setTokenOpen(true); }}>$TAKIP chart</MenuItem>
            <MenuItem icon={Coffee} href="https://ko-fi.com/M8D41ZYW4Z" external onSelect={close}>Support on Ko-fi</MenuItem>
            <MenuDivider />
            <MenuItem icon={Settings} onSelect={() => { close(); openSettings(); }}>Settings</MenuItem>
            <MenuItem icon={BookOpen} href="/docs" onSelect={close}>Docs and API</MenuItem>
            {!compact && <MenuItem icon={Keyboard} kbd="?" onSelect={() => { close(); showShortcuts(); }}>Keyboard shortcuts</MenuItem>}
            <MenuItem icon={ShieldCheck} href="/privacy" onSelect={close}>Privacy</MenuItem>
            <MenuDivider />
            <div className="flex items-center gap-0.5 pl-0.5">
              {SOCIAL.map(({ href, label, Icon }) => (
                <Tooltip key={href} label={label} side="top">
                  <a role="menuitem" href={href} target="_blank" rel="noopener noreferrer" aria-label={label} onClick={close}
                    className={cx('flex size-8 items-center justify-center rounded-control text-ink-2 hover:bg-surface-2 hover:text-ink-1', FOCUS_RING, TRANSITION)}>
                    <Icon className="size-4" />
                  </a>
                </Tooltip>
              ))}
              <span className="ml-auto pr-2 font-mono text-meta text-ink-4">{APP_VERSION.replace(/^v/i, 'v')}</span>
            </div>
          </>
        )}
      </Popover>
      <TokenChart open={tokenOpen} onClose={() => setTokenOpen(false)} />
    </>
  );
}
