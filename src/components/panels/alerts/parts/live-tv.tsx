'use client';

import { useEffect, useState } from 'react';
import { Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MenuItem } from '@/components/ui/menu-item';
import { Popover } from '@/components/ui/popover';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { BUILTIN_FEEDS } from '@/lib/intel/alerts/live-alerts';

const REGIONS: [string, string][] = [
  ['americas', msg('Americas')], ['europe', msg('Europe')], ['middleeast', msg('Middle East')], ['asia', msg('Asia Pacific')], ['africa', msg('Africa')],
];

type Feed = (typeof BUILTIN_FEEDS)[number] & { live?: boolean | null };

/** Live news channels on air, by region. Picking one plays it and takes the map to its newsroom. */
export default function LiveTv({ onWatch }: { onWatch: (feed: Feed) => void }) {
  const t = useT();
  // The table until /api/live-news says what is on air and with which broadcast.
  const [all, setAll] = useState<Feed[]>(BUILTIN_FEEDS);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/live-news', { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (Array.isArray(d?.feeds) && d.feeds.length) setAll(d.feeds); })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  const onAir = all.filter(f => f.live !== false);
  return (
    <Popover role="menu" label={t('Live TV')} placement="top" align="end" className="max-h-[min(480px,calc(100vh-120px))] w-72 p-1"
      trigger={<Button variant="ghost" size="sm" icon={Tv} className="-mr-2 ml-auto">{t('Live TV')}</Button>}>
      {close => REGIONS.map(([region, label]) => {
        const feeds = onAir.filter(f => f.region === region);
        if (!feeds.length) return null;
        return (
          <div key={region} role="group" aria-label={t(label)}>
            <p className="px-2 pt-2 pb-1 text-meta font-medium text-ink-3">{t(label)}</p>
            {feeds.map(f => (
              <MenuItem key={f.id} hint={f.language === 'en' ? f.city : `${f.city} · ${f.language.toUpperCase()}`} onSelect={() => { onWatch(f); close(); }}>{f.name}</MenuItem>
            ))}
          </div>
        );
      })}
    </Popover>
  );
}
