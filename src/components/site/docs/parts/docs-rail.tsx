'use client';

import { ALL_SECTIONS } from '@/components/site/docs/docs-sections';
import { useT } from '@/components/ui/use-t';

export function DocsRail({ active }: { active: string }) {
  const t = useT();
  return (
    <aside className="hidden xl:block w-52 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto styled-scrollbar py-16">
      <div className="text-[12px] font-medium text-ink-3 mb-3">{t('On this page')}</div>
      <div className="space-y-0.5">
        {ALL_SECTIONS.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`block text-[12px] py-1 transition-colors ${
              active === s.id ? 'text-ink-1 font-medium' : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            {t(s.title)}
          </a>
        ))}
      </div>

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="mt-6 flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink-1 transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 15-6-6-6 6" />
        </svg>
        {t('Back to top')}
      </button>
    </aside>
  );
}
