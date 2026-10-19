'use client';

import { ENDPOINT_COUNT } from '@/components/site/docs/api-catalog';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';

const STATS = [
  { n: String(ENDPOINT_COUNT), l: msg('Endpoints') },
  { n: '20+', l: msg('Live feeds') },
  { n: '0', l: msg('Keys required') },
];

export function DocsHero() {
  const t = useT();
  return (
    <div className="mb-16">
      <p className="mb-4 text-[13px] font-medium text-ink-3">{t('Open source · MIT')}</p>
      <h1 className="text-[34px] md:text-[44px] leading-[1.1] font-semibold tracking-[-0.02em] text-ink-1 mb-5">
        {t('Build on the TAKIP platform')}
      </h1>

      <p className="text-[17px] leading-[1.65] text-ink-2 max-w-[40rem]">
        {t('TAKIP aggregates aviation, maritime, seismic, conflict, cyber, and OSINT feeds onto a single GPU-rendered map — and exposes every one of them as a plain HTTP endpoint. This is the same API the dashboard runs on. There is no separate, privileged internal tier.')}
      </p>

      <div className="flex flex-wrap gap-2 mt-8">
        <a
          href="#quickstart"
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md text-[13px] font-medium bg-accent text-on-accent hover:bg-accent/90 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('Quick start')}
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
        <a
          href="#api"
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md text-[13px] font-medium border border-line-strong bg-surface-2 text-ink-1 hover:bg-surface-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t('API reference')}
        </a>
      </div>

      <dl className="grid grid-cols-3 gap-3 mt-10 max-w-[40rem]">
        {STATS.map(s => (
          <div key={s.l} className="rounded-card border border-line bg-surface-1 px-4 py-3">
            <dt className="text-[12px] text-ink-3">{t(s.l)}</dt>
            <dd className="m-0 mt-1 text-[22px] font-medium text-ink-1 font-mono tabular-nums leading-7">{s.n}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
