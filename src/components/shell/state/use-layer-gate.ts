'use client';

import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import type { MapLayerSection } from '@takip/core/entitlements';
import { closedLayerKeys, layerSection, sectionTitle, withoutClosed } from '@/components/panels/layers/lib/layer-gates';
import { askForAccount, useSignedIn } from '@/components/site/account/plan-gate';
import { useAccess } from '@/components/site/account/use-access';
import type { ActiveLayers } from '@/lib/map/layers/defaults';

const NONE: ReadonlySet<string> = new Set();
// StrictMode runs updaters twice; one prompt per attempt.
const PROMPT_GAP_MS = 1000;

// Only a click or key press asks: layers restored from storage or the address bar are just left off.
const byPerson = () => typeof navigator !== 'undefined' && navigator.userActivation?.isActive === true;

/**
 * The page's layers as the plan allows them: layers in sections the plan closes read as off, can't be switched
 * on, and keep their stored choice for when the plan opens them. Switching one on asks for an account.
 */
export function useLayerGate(chosen: ActiveLayers, setChosen: Dispatch<SetStateAction<ActiveLayers>>) {
  const access = useAccess();
  const signedIn = useSignedIn();
  const closed = useMemo(() => (access ? closedLayerKeys(access.entitlements) : NONE), [access]);
  const gate = useRef({ closed, signedIn, promptedAt: 0 });
  useEffect(() => {
    gate.current.closed = closed;
    gate.current.signedIn = signedIn;
  }, [closed, signedIn]);

  const activeLayers = useMemo(() => withoutClosed(chosen, closed), [chosen, closed]);

  const setActiveLayers = useCallback<Dispatch<SetStateAction<ActiveLayers>>>(next => setChosen(prev => {
    const shut = gate.current.closed;
    if (!shut.size) return typeof next === 'function' ? next(prev) : next;
    const view = withoutClosed(prev, shut);
    const value = typeof next === 'function' ? next(view) : next;
    const tried = [...shut].filter(key => value[key as keyof ActiveLayers] && !view[key as keyof ActiveLayers]);
    if (tried.length && byPerson() && Date.now() - gate.current.promptedAt > PROMPT_GAP_MS) {
      gate.current.promptedAt = Date.now();
      const section = layerSection(tried[0]) as MapLayerSection;
      const { signedIn: member } = gate.current;
      // After this render: opening the dialog sets another component's state.
      queueMicrotask(() => askForAccount({
        visitor: `Create a free account to see ${sectionTitle(section)} layers.`,
        member: `${sectionTitle(section)} layers aren't in your plan.`,
      }, member));
    }
    return { ...value, ...Object.fromEntries([...shut].filter(key => key in prev).map(key => [key, prev[key as keyof ActiveLayers]])) };
  }), [setChosen]);

  return { activeLayers, setActiveLayers };
}
