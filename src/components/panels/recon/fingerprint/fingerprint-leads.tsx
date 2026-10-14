'use client';

import { AtSign, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FingerprintState } from './use-fingerprint-search';

export interface Lead {
  type: 'username' | 'email';
  value: string;
  from: string[];
}

/** Handles and addresses the results point at, each one click from its own search. Never run on their own: each search counts against the hourly limit. */
export function SearchNext({ fp, leads, limit = 6 }: { fp: FingerprintState; leads: Lead[]; limit?: number }) {
  const seen = new Set<string>();
  const unique = leads.filter(l => {
    const key = `${l.type}:${l.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
  if (!unique.length) return null;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-meta text-ink-3">Search next</p>
      <div className="flex flex-wrap gap-1.5">
        {unique.map(l => (
          <Button key={`${l.type}:${l.value}`} variant="secondary" size="sm" icon={l.type === 'email' ? Mail : AtSign}
            title={`Suggested by ${l.from.join(', ')}`} disabled={fp.phase === 'running'} onClick={() => fp.run(l.type, l.value)}>
            {l.value}
          </Button>
        ))}
      </div>
    </div>
  );
}
