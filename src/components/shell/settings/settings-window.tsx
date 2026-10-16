'use client';

import { useState } from 'react';
import StyleStudio from '@/components/shell/map-look/style-studio';
import { showAccountDialog } from '@/components/site/account/account-dialog-state';
import AccountSettings from '@/components/site/account/settings/account-settings';
import { Modal } from '@/components/ui/modal';
import { useIsMobile } from '@/components/ui/use-is-mobile';
import { SETTINGS_TABS, settingsTab, type SettingsTab } from './lib/tabs';
import { showSettingsTab } from './open-settings';
import GeneralTab from './parts/general-tab';
import MapTab, { type MapSettings } from './parts/map-tab';

export type { MapSettings };

type View = { tab?: SettingsTab; notice?: string };

/** Settings: General, Map and Account. The account dialog's `settings` view shows it; `map` is the page's map state. */
export default function SettingsWindow({ view, map }: { view: View | null; map?: MapSettings }) {
  const [studio, setStudio] = useState(false);
  const isMobile = useIsMobile();
  // The studio previews over a clear map, so Settings steps aside for it.
  const openStudio = () => { showAccountDialog(null); setStudio(true); };

  return (
    <>
      {view && <Window view={view} map={map} onOpenStudio={openStudio} />}
      {studio && <StyleStudio isMobile={isMobile} onClose={() => setStudio(false)} />}
    </>
  );
}

function Window({ view, map, onOpenStudio }: { view: View; map?: MapSettings; onOpenStudio: () => void }) {
  const tab = settingsTab(view);
  return (
    <Modal open onClose={() => showAccountDialog(null)} title="Settings" className="max-w-[480px]" bare
      tabs={{ options: SETTINGS_TABS, value: tab, onChange: next => showSettingsTab(next, view.notice) }}>
      <div key={tab} className="styled-scrollbar h-[min(70vh,620px)] min-h-0 overflow-y-auto border-t border-line">
        {tab === 'general' ? <GeneralTab />
          : tab === 'map' ? <MapTab map={map} onOpenStudio={onOpenStudio} />
          : <AccountSettings notice={view.notice} />}
      </div>
    </Modal>
  );
}
