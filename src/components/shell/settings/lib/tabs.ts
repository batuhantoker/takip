export type SettingsTab = 'general' | 'map' | 'account';

export const SETTINGS_TABS: { value: SettingsTab; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'map', label: 'Map' },
  { value: 'account', label: 'Account' },
];

/** Without a tab, Settings opens on Account: every older "account settings" link and button means that one. */
export const settingsTab = (view: { tab?: SettingsTab }): SettingsTab => view.tab ?? 'account';
