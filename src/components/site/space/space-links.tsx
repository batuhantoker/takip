import Link from 'next/link';
import { LINK_BUTTON, TEXT_LINK } from '@/components/site/pages/site-frame';
import type { Translate } from '@/lib/core/i18n/translator';
import type { LayerPage } from '@/lib/platform/site/layer-pages';
import { localePath } from '@/lib/platform/site/locale-path';
import { bodyName } from '@/lib/platform/site/space/copy';
import { planetPath, PLANETS } from '@/lib/platform/site/space/planets';
import { craftPath, ROSTER_GROUPS } from '@/lib/platform/site/space/roster';
import { CraftCards } from './parts/craft-cards';

const heading = 'text-[20px] font-semibold tracking-[-0.01em] text-ink-1';

/** A Space /map page's way into the spacecraft and planet pages. */
export function SpaceLinks({ t, which }: { t: Translate; which: NonNullable<LayerPage['spaceLinks']> }) {
  const index = <Link href={localePath(t.locale, '/spacecraft')} className={TEXT_LINK}>{t('Every spacecraft')}</Link>;
  if (which === 'planets') {
    return (
      <section className="mt-20">
        <h2 className={heading}>{t('The planets')}</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {PLANETS.map(p => <li key={p.key}><Link href={localePath(t.locale, planetPath(p))} className={LINK_BUTTON.secondary}>{bodyName(t, p.key)}</Link></li>)}
        </ul>
        <p className="mt-4 text-[14px]">{index}</p>
      </section>
    );
  }
  if (which === 'all') {
    return (
      <section className="mt-20">
        <h2 className={heading}>{t('Spacecraft')}</h2>
        <div className="mt-5 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {ROSTER_GROUPS.map(g => (
            <div key={g.id}>
              <h3 className="text-[15px] font-semibold text-ink-1">{t(g.label)}</h3>
              <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
                {g.craft.map(c => <li key={c.slug}><Link href={localePath(t.locale, craftPath(c))} className={TEXT_LINK}>{c.name}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  }
  const group = ROSTER_GROUPS.find(g => g.id === which);
  if (!group) return null;
  return (
    <section className="mt-20">
      <h2 className={heading}>{t(group.label)}</h2>
      <div className="mt-5"><CraftCards t={t} items={group.craft.map(craft => ({ craft }))} /></div>
      <p className="mt-4 text-[14px]">
        {which === 'mars' && <><Link href={localePath(t.locale, planetPath({ key: 'mars' }))} className={TEXT_LINK}>{t('Mars right now')}</Link>{' · '}</>}
        {index}
      </p>
    </section>
  );
}
