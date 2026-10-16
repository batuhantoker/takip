'use client';

import { useAccess, usePlans } from '@/components/site/account/use-access';
import { planGains } from '@/components/site/account/settings/plan-highlights';
import { Row, Section, SmallButton } from '@/components/site/account/settings/settings-parts';

const day = (at: number) => new Date(at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PlanSection() {
  const access = useAccess();
  const plans = usePlans();
  if (!access || !plans) return <Section title="Plan"><p className="text-small text-ink-3">Loading…</p></Section>;

  const { plan, subscription, entitlements } = access;
  const next = plans[plans.findIndex(p => p.id === plan.id) + 1];
  const gains = next ? planGains(entitlements, next.entitlements) : [];
  const detail = !subscription ? 'Included with every account'
    : subscription.provider === 'manual' ? (subscription.until ? `Granted until ${day(subscription.until)}` : 'Granted')
    : subscription.status === 'past_due' ? 'Payment overdue'
    : 'Subscribed';

  return (
    <Section title="Plan">
      <Row label={`${plan.name} plan`} detail={detail} />
      {gains.length > 0 && (
        <>
          <p className="text-small text-ink-3">{next.name} adds:</p>
          <ul className="flex flex-col gap-1 pl-3 text-body text-ink-1 list-disc marker:text-accent">
            {gains.map(line => <li key={line}>{line}</li>)}
          </ul>
          <div className="flex items-center gap-2.5">
            <SmallButton disabled>Upgrade to {next.name}</SmallButton>
            <span className="text-meta text-ink-3">Payments aren&apos;t set up yet.</span>
          </div>
        </>
      )}
    </Section>
  );
}
