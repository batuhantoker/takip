import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import type { SettingsTab } from './lib/tabs';

let last: SettingsTab = 'general';

/** Opens Settings on the tab last picked there. */
export const openSettings = () => showAccountDialog({ kind: 'settings', tab: last });

export function showSettingsTab(tab: SettingsTab, notice?: string) {
  last = tab;
  showAccountDialog({ kind: 'settings', tab, notice });
}
