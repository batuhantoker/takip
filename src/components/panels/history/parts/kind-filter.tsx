'use client';

import { ListFilter, X } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { useT } from '@/components/ui/use-t';
import { KINDS } from '@/lib/history/popup';
import type { HistorySession } from '@/lib/history/session';

/** The kinds a topic page's link narrowed the map to, with × to draw every kind again. Nothing when no filter is on. */
export function KindFilter({ session }: { session: HistorySession }) {
  const t = useT();
  const kinds = session.kinds();
  if (!kinds.length) return null;
  const names = kinds.map(k => (KINDS[k] ? t(KINDS[k]) : k)).join(', ');
  return (
    <ListRow compact className="mb-1"
      leading={<ListFilter aria-hidden className="size-4 text-ink-3" strokeWidth={1.75} />}
      title={<span className="line-clamp-2 whitespace-normal">{t('Only: {kinds}', { kinds: names })}</span>}
      trailing={<IconButton size="sm" icon={X} label={t('Show every kind')} onClick={() => session.setKinds([])} />} />
  );
}
