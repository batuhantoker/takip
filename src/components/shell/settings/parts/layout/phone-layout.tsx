'use client';

import { BAR_LABELS, OVERLAY_LABELS } from '@/components/shell/layout/lib/labels';
import { PHONE_OVERLAY_IDS, setBar, type PageLayout } from '@/components/shell/layout/lib/model';
import { updateLayout } from '@/components/shell/layout/use-page-layout';
import { Section } from '@/components/site/account/settings/settings-parts';
import { useT } from '@/components/ui/use-t';
import { OrderList, PieceRow, ShownSwitch } from './rows';

/** A phone's bottom bar, and the pieces over its map; they keep their places, so they only switch off. */
export default function PhoneLayout({ layout }: { layout: PageLayout }) {
  const t = useT();
  return (
    <>
      <Section title={t('Bottom bar')}>
        <OrderList items={layout.phone.bar} onOrder={bar => updateLayout(l => setBar(l, bar))} label={id => t(BAR_LABELS[id])}
          row={id => <span className="min-w-0 flex-1 truncate text-body text-ink-1">{t(BAR_LABELS[id])}</span>}
          trailing={id => <ShownSwitch layout={layout} form="phone" piece={`bar:${id}`} label={t(BAR_LABELS[id])} />} />
      </Section>
      <Section title={t('On the map')}>
        {PHONE_OVERLAY_IDS.map(id => <PieceRow key={id} layout={layout} form="phone" piece={`overlay:${id}`} label={t(OVERLAY_LABELS[id])} />)}
        <PieceRow layout={layout} form="phone" piece="logo" label={t('TAKIP mark')} detail={t('Top left')} />
        <p className="text-small text-ink-3">{t('Your account and More always stay, so Settings is a tap away. A desktop has its own layout.')}</p>
      </Section>
    </>
  );
}
