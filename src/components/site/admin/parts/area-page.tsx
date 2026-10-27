'use client';

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AREAS, movedTo, type AreaId, type TabOf } from '@/components/site/admin/lib/areas';

const onHash = (notify: () => void) => {
  window.addEventListener('hashchange', notify);
  return () => window.removeEventListener('hashchange', notify);
};

/** The open tab lives in the URL hash, so a link can point at it; an unknown or missing hash opens the first. */
export function useAreaTab<A extends AreaId>(area: A): TabOf<A> {
  const hash = useSyncExternalStore(onHash, () => window.location.hash.slice(1), () => '');
  const tabs = AREAS[area].tabs as readonly (readonly [TabOf<A>, string])[];
  return (tabs.find(([id]) => id === hash) ?? tabs[0])[0];
}

const ToolbarSlot = createContext<HTMLElement | null>(null);

/** Controls for the open tab, drawn in the title row so every tab keeps them in the same place. */
export function Toolbar({ children }: { children: ReactNode }) {
  const slot = useContext(ToolbarSlot);
  return slot ? createPortal(children, slot) : null;
}

/** An area's title, its toolbar and its tab bar; `children` is the open tab. */
export function AreaPage<A extends AreaId>({ area, tab, children }: { area: A; tab?: TabOf<A>; children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const { label, tabs } = AREAS[area];
  const tabLabel = (tabs as readonly (readonly [string, string])[]).find(([id]) => id === tab)?.[1];
  return (
    <ToolbarSlot.Provider value={slot}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h1 className="text-[20px] font-semibold text-ink-1">{label}</h1>
        <div ref={setSlot} className="flex flex-wrap items-center justify-end gap-2" />
      </div>
      {tabs.length > 0 && (
        <div role="tablist" aria-label={`${label} tabs`} className="-mt-2 mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line">
          {(tabs as readonly (readonly [string, string])[]).map(([id, text]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => { window.location.hash = id; }}
              className={`-mb-px h-9 whitespace-nowrap border-b-2 px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${tab === id ? 'border-accent text-ink-1' : 'border-transparent text-ink-3 hover:text-ink-1'}`}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      <div role={tabs.length ? 'tabpanel' : undefined} aria-label={tabLabel} className="pb-10">{children}</div>
    </ToolbarSlot.Provider>
  );
}

/** A page from before the six areas: sends the browser on to where it lives now. */
export function Moved() {
  const router = useRouter();
  useEffect(() => router.replace(movedTo(window.location.pathname, window.location.hash)), [router]);
  return null;
}
