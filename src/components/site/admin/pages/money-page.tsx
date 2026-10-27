'use client';

import { AreaPage, useAreaTab } from '@/components/site/admin/parts/area-page';
import { BillingTab } from '@/components/site/admin/tabs/billing-tab';
import { PlansTab } from '@/components/site/admin/tabs/plans-tab';

/** What each plan includes, and the subscriptions paying for them. */
export default function MoneyPage() {
  const tab = useAreaTab('money');
  return (
    <AreaPage area="money" tab={tab}>
      {tab === 'plans' && <PlansTab />}
      {tab === 'billing' && <BillingTab />}
    </AreaPage>
  );
}
