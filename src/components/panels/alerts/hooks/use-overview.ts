'use client';

import { useCallback, useState } from 'react';
import { useT } from '@/components/ui/use-t';
import type { AlertBrief } from '@/lib/intel/alerts/digest';
import { hostedAiNotice, type HostedAiBlock } from '@/lib/intel/ai/hosted';

export interface OverviewResult {
  overview: string;
  highlights: string[];
  generatedBy: 'gemini' | 'analyst';
  generatedAt: string;
  brief?: AlertBrief;
  hostedAi?: HostedAiBlock;
}

/**
 * A read-out from /api/ai/overview, which answers with or without a model key
 * (a heuristic analyst stands in), so there is always something to show.
 * `signature` changes with the feed, so an old read-out can say it is old.
 */
export function useOverview(mode: 'alerts' | 'markets', payload: unknown, signature?: string) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OverviewResult | null>(null);
  const [resultSignature, setResultSignature] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sig = signature;
    try {
      const res = await fetch('/api/ai/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(hostedAiNotice(body?.error, t) ?? `The overview service answered ${res.status}.`);
      }
      setResult(await res.json());
      setResultSignature(sig);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not write the brief.'));
    } finally {
      setLoading(false);
    }
  }, [mode, payload, signature, t]);

  const stale = Boolean(result && signature && resultSignature && signature !== resultSignature);
  return { loading, result, error, stale, generate, notice: hostedAiNotice(result?.hostedAi, t) };
}

export type Overview = ReturnType<typeof useOverview>;
