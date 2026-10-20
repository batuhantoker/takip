'use client';

import { Globe } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover } from '@/components/ui/popover';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { useT } from '@/components/ui/use-t';
import { STORY_FAMILIES, type StoryAlert } from '@/lib/intel/alerts/gdelt-alerts';
import { STORY_LABEL } from '@/components/panels/alerts/format';

/** Which GDELT stories join the list. On by default; kept between visits. */
export interface StoryPrefs { on: boolean; families: StoryAlert['family'][]; minOutlets: number }

export const STORY_PREFS: StoryPrefs = { on: true, families: STORY_FAMILIES, minOutlets: 1 };
const OUTLET_STEPS = ['1', '3', '10'] as const;

export const isStoryPrefs = (v: unknown): v is StoryPrefs => {
  const p = v as StoryPrefs | null;
  return !!p && typeof p.on === 'boolean' && Array.isArray(p.families) && p.families.every(f => STORY_FAMILIES.includes(f))
    && OUTLET_STEPS.includes(String(p.minOutlets) as (typeof OUTLET_STEPS)[number]);
};

export const narrowStories = (stories: StoryAlert[], p: StoryPrefs) =>
  p.on ? stories.filter(s => p.families.includes(s.family) && s.outlets >= p.minOutlets) : [];

export default function StoryFilters({ prefs, setPrefs, stories }: {
  prefs: StoryPrefs;
  setPrefs: (p: StoryPrefs) => void;
  /** Everything GDELT sent, before these choices narrow it. */
  stories: StoryAlert[];
}) {
  const t = useT();
  const shown = narrowStories(stories, prefs).length;
  const changed = !prefs.on || prefs.families.length < STORY_FAMILIES.length || prefs.minOutlets > 1;
  const toggle = (f: StoryAlert['family'], on: boolean) =>
    setPrefs({ ...prefs, families: on ? STORY_FAMILIES.filter(x => x === f || prefs.families.includes(x)) : prefs.families.filter(x => x !== f) });

  return (
    <Popover label={t('GDELT stories')} placement="bottom" align="end" className="w-72 p-3"
      trigger={<IconButton icon={Globe} active={changed}
        label={prefs.on ? t('{n, plural, one {# GDELT story in the list} other {# GDELT stories in the list}}', { n: shown }) : t('GDELT stories are hidden')} />}>
      <Switch checked={prefs.on} onChange={on => setPrefs({ ...prefs, on })} label={t('GDELT stories')}
        description={t('What the world’s press is reporting, read from GDELT every 15 minutes and placed where it happens.')} />
      {prefs.on && (
        <>
          <p className="mt-4 mb-1.5 text-meta font-medium text-ink-3">{t('Kinds')}</p>
          <div className="flex flex-col gap-2">
            {STORY_FAMILIES.map(f => (
              <Checkbox key={f} checked={prefs.families.includes(f)} onChange={e => toggle(f, e.target.checked)}
                label={`${t(STORY_LABEL[f])} · ${stories.filter(s => s.family === f).length.toLocaleString(t.intl)}`} />
            ))}
          </div>
          <p className="mt-4 mb-1.5 text-meta font-medium text-ink-3">{t('Reported by')}</p>
          <Segmented size="sm" full label={t('Reported by')} value={String(prefs.minOutlets) as (typeof OUTLET_STEPS)[number]}
            onChange={v => setPrefs({ ...prefs, minOutlets: Number(v) })}
            options={[
              { value: '1', label: t('Any') },
              { value: '3', label: t('3+ outlets') },
              { value: '10', label: t('10+ outlets') },
            ]} />
        </>
      )}
    </Popover>
  );
}
