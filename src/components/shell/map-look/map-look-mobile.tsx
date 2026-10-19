'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Palette } from 'lucide-react';
import StyleStudio from './style-studio';
import { Button } from '@/components/ui/button';
import { PanelSection } from '@/components/ui/panel';
import { Segmented } from '@/components/ui/segmented';
import { useT } from '@/components/ui/use-t';

type Theme = 'core' | 'ghost';

/** The phone has no map options menu, so the theme and the colour studio live at the foot of its layer list. */
export default function MapLookMobile({ theme, setTheme }: { theme: Theme; setTheme?: (theme: Theme) => void }) {
  const t = useT();
  const [studioOpen, setStudioOpen] = useState(false);
  return (
    <PanelSection title={t('Map look')}>
      <div className="flex items-center gap-2">
        {setTheme && (
          <Segmented<Theme> label={t('Theme')} value={theme} onChange={setTheme} className="flex-1" full
            options={[{ value: 'core', label: 'Core' }, { value: 'ghost', label: 'Ghost' }]} />
        )}
        <Button icon={Palette} onClick={() => setStudioOpen(o => !o)} aria-pressed={studioOpen}>{t('Colours')}</Button>
      </div>
      <AnimatePresence>
        {studioOpen && <StyleStudio isMobile onClose={() => setStudioOpen(false)} />}
      </AnimatePresence>
    </PanelSection>
  );
}
