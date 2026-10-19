'use client';

import { BarChart3, BookOpen, Ellipsis, Info, Keyboard, MessageSquareWarning, Settings, ShieldCheck } from 'lucide-react';
import { APP_VERSION } from '@/lib/platform/app-version';
import { localePath } from '@/lib/platform/site/locale-path';
import { IconButton } from '@/components/ui/button';
import { MenuDivider, MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { Tooltip } from '@/components/ui/tooltip';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { XIcon } from './brand-icons';
import { RailButton } from '@/components/shell/sidebar/rail-button';
import { showShortcuts } from '@/components/shell/keyboard/shortcuts-state';
import { openSettings } from '@/components/shell/settings/open-settings';
import { showReportDialog } from '@/components/site/report/report-dialog-state';

const SOCIAL = [
  { href: 'https://x.com/soulsimplifai', label: msg('TAKIP on X'), Icon: XIcon },
];

/**
 * Everything kept off the main screen: Markets, Settings, the docs, issue reports and the community.
 * `rail` is the sidebar's entry; `compact` the phone's.
 */
export default function MoreMenu({ compact = false, rail = false, active = false, onOpenMarkets }: {
  compact?: boolean;
  rail?: boolean;
  /** Something opened from here (Markets) is showing beside the sidebar. */
  active?: boolean;
  onOpenMarkets: () => void;
}) {
  const t = useT();
  const trigger = rail
    ? <RailButton glyph={<Ellipsis className="size-[18px]" strokeWidth={1.75} />} label={t('rail|More')} active={active} />
    : <IconButton label={t('More')} icon={Ellipsis} tooltipSide="bottom" />;

  return (
    <Popover role="menu" label={t('More')} placement={rail ? 'right' : 'bottom'} align="end" className="w-64 p-1" trigger={trigger}>
      {close => (
        <>
          <MenuItem icon={BarChart3} kbd={compact ? undefined : 'M'} onSelect={() => { close(); onOpenMarkets(); }}>{t('Markets')}</MenuItem>
          <MenuDivider />
          <MenuItem icon={Settings} onSelect={() => { close(); openSettings(); }}>{t('Settings')}</MenuItem>
          <MenuItem icon={Info} href={localePath(t.locale, '/about')} onSelect={close}>{t('About TAKIP')}</MenuItem>
          <MenuItem icon={BookOpen} href="/docs" onSelect={close}>{t('Docs and API')}</MenuItem>
          {!compact && <MenuItem icon={Keyboard} kbd="?" onSelect={() => { close(); showShortcuts(); }}>{t('Keyboard shortcuts')}</MenuItem>}
          <MenuItem icon={ShieldCheck} href="/privacy" onSelect={close}>{t('Privacy')}</MenuItem>
          <MenuItem icon={MessageSquareWarning} onSelect={() => { close(); showReportDialog(); }}>{t('Report an issue')}</MenuItem>
          <MenuDivider />
          <div className="flex items-center gap-0.5 pl-0.5">
            {SOCIAL.map(({ href, label, Icon }) => (
              <Tooltip key={href} label={t(label)} side="top">
                <a role="menuitem" href={href} target="_blank" rel="noopener noreferrer" aria-label={t(label)} onClick={close}
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
  );
}
