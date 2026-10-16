'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Panel } from '@/components/ui/panel';
import { askForAccount, useSignedIn } from '@/components/site/account/plan-gate';
import { TiGlyph } from '../atoms';

const REASON = { visitor: 'Create a free account to use TI.', member: "TI isn't in your plan." };

/** In place of TI for a plan without `ai.assistant`; opening it asks once, the button asks again. */
export default function TiAccountPrompt({ embedded, onClose }: { embedded: boolean; onClose?: () => void }) {
  const signedIn = useSignedIn();
  // Once per opening: signing up flips signedIn before the new plan lifts this prompt.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    askForAccount(REASON, signedIn);
  }, [signedIn]);
  const prompt = (
    <EmptyState icon={TiGlyph}
      title={signedIn ? "TI isn't in your plan" : 'TI needs a free account'}
      body={signedIn ? 'See which plans include it in Account settings.' : 'Ask TI to work the map, find what is live and forecast what happens next.'}
      action={<Button variant="primary" onClick={() => askForAccount(REASON, signedIn)}>{signedIn ? 'See plans' : 'Create account'}</Button>} />
  );
  return embedded ? prompt : <Panel title="TI" subtitle="Takip AI" icon={TiGlyph} onClose={onClose}>{prompt}</Panel>;
}
