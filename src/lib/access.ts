import { useEffect, useState } from 'react';
import type { Access, PlanAccess } from '@takip/core/entitlements';
import { authClient } from './auth-client';

/** The caller's plan and entitlements, fetched again whenever the signed-in user changes. */
export function useAccess(): Access | null {
  const { data } = authClient.useSession();
  const userId = data?.user.id ?? null;
  const [state, setState] = useState<{ userId: string | null; access: Access } | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/v1/me/access')
      .then(res => (res.ok ? (res.json() as Promise<Access>) : null))
      .then(access => {
        if (live && access) setState({ userId, access });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  return state?.userId === userId ? state.access : null;
}

let plansRequest: Promise<PlanAccess[]> | null = null;

/** The public plans in upgrade order, asked once per page load. */
export function usePlans(): PlanAccess[] | null {
  const [plans, setPlans] = useState<PlanAccess[] | null>(null);
  useEffect(() => {
    let live = true;
    plansRequest ??= fetch('/api/v1/plans')
      .then(res => (res.ok ? (res.json() as Promise<{ plans: PlanAccess[] }>) : { plans: [] }))
      .then(body => body.plans)
      .catch(() => {
        plansRequest = null;
        return [];
      });
    void plansRequest.then(list => {
      if (live) setPlans(list);
    });
    return () => {
      live = false;
    };
  }, []);
  return plans;
}
