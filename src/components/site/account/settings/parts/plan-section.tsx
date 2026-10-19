'use client';

import { useAccess, usePlans } from '@/components/site/account/use-access';
import { planGains } from '@/components/site/account/settings/plan-highlights';
import { Row, Section, SmallButton } from '@/components/site/account/settings/settings-parts';
import { useT } from '@/components/ui/use-t';

export default function PlanSection() {
  const t = useT();
  const access = useAccess();
  const plans = usePlans();
  if (!access || !plans) return <Section title={t('Plan')}><p className="text-small text-ink-3">{t('Loading…')}</p></Section>;

  const day = (at: number) => new Date(at).toLocaleDateString(t.intl, { day: 'numeric', month: 'short', year: 'numeric' });
  const { plan, subscription, entitlements } = access;
  const next = plans[plans.findIndex(p => p.id === plan.id) + 1];
  const gains = next ? planGains(entitlements, next.entitlements, t) : [];
  const detail = !subscription ? t('Included with every account')
    : subscription.provider === 'manual' ? (subscription.until ? t('Granted until {date}', { date: day(subscription.until) }) : t('Granted'))
    : subscription.status === 'past_due' ? t('Payment overdue')
    : t('Subscribed');

  return (
    <Section title={t('Plan')}>
      <Row label={t('{plan} plan', { plan: plan.name })} detail={detail} />
      {gains.length > 0 && (
        <>
          <p className="text-small text-ink-3">{t('{plan} adds:', { plan: next.name })}</p>
          <ul className="flex flex-col gap-1 pl-3 text-body text-ink-1 list-disc marker:text-accent">
            {gains.map(line => <li key={line}>{line}</li>)}
          </ul>
          <div className="flex items-center gap-2.5">
            <SmallButton disabled>{t('Upgrade to {plan}', { plan: next.name })}</SmallButton>
            <span className="text-meta text-ink-3">{t("Payments aren't set up yet.")}</span>
          </div>
        </>
      )}
    </Section>
  );
}
