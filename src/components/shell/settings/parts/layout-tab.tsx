'use client';

import { isDefault, resetForm } from '@/components/shell/layout/lib/model';
import { updateLayout, useLayoutForm, usePageLayout } from '@/components/shell/layout/use-page-layout';
import { Row, Section, SmallButton } from '@/components/site/account/settings/settings-parts';
import { useT } from '@/components/ui/use-t';
import DesktopLayout from './layout/desktop-layout';
import PhoneLayout from './layout/phone-layout';

/** What the map page shows and where, for the screen in use; each change shows on the page at once. */
export default function LayoutTab() {
  const t = useT();
  const layout = usePageLayout();
  const form = useLayoutForm();
  const changed = !isDefault(layout, form);
  return (
    <>
      {form === 'phone' ? <PhoneLayout layout={layout} /> : <DesktopLayout layout={layout} />}
      <Section title={t('Reset')}>
        <Row label={t('The designed layout')} detail={form === 'phone' ? t('For phones in this browser') : t('For this browser on larger screens')}>
          <SmallButton disabled={!changed} onClick={() => updateLayout(l => resetForm(l, form))}>{changed ? t('Reset') : t('In use')}</SmallButton>
        </Row>
      </Section>
    </>
  );
}
