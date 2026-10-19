import { msg } from '@/lib/core/i18n/translator';

export type SettingsTab = 'general' | 'map' | 'layout' | 'account';

export const SETTINGS_TABS: { value: SettingsTab; label: string }[] = [
  { value: 'general', label: msg('General') },
  { value: 'map', label: msg('Map') },
  { value: 'layout', label: msg('Layout') },
  { value: 'account', label: msg('Account') },
];

/** Without a tab, Settings opens on Account: every older "account settings" link and button means that one. */
export const settingsTab = (view: { tab?: SettingsTab }): SettingsTab => view.tab ?? 'account';
