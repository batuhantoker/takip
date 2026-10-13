'use client';

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Palette } from 'lucide-react';
import StyleStudio from './style-studio';
import { Button } from '@/components/ui/button';
import { PanelSection } from '@/components/ui/panel';
import { Segmented } from '@/components/ui/segmented';

type Theme = 'core' | 'ghost';

/** The phone has no map options menu, so the theme and the colour studio live at the foot of its layer list. */
export default function MapLookMobile({ theme, setTheme }: { theme: Theme; setTheme?: (theme: Theme) => void }) {
  const [studioOpen, setStudioOpen] = useState(false);
  return (
    <PanelSection title="Map look">
      <div className="flex items-center gap-2">
        {setTheme && (
          <Segmented<Theme> label="Theme" value={theme} onChange={setTheme} className="flex-1" full
            options={[{ value: 'core', label: 'Core' }, { value: 'ghost', label: 'Ghost' }]} />
        )}
        <Button icon={Palette} onClick={() => setStudioOpen(o => !o)} aria-pressed={studioOpen}>Colours</Button>
      </div>
      <AnimatePresence>
        {studioOpen && <StyleStudio isMobile onClose={() => setStudioOpen(false)} />}
      </AnimatePresence>
    </PanelSection>
  );
}
