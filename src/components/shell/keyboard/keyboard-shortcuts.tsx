'use client';

import { Fragment, useEffect } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { Modal } from '@/components/ui/modal';
import { useT } from '@/components/ui/use-t';
import { msg } from '@/lib/core/i18n/translator';
import { hideShortcuts, toggleShortcuts, useShortcutsOpen } from './shortcuts-state';

type Shortcut = { keys: string[][]; label: string };

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

// What use-keyboard-shortcuts.ts and SearchBar do; keep the three in step.
const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: msg('Map'),
    items: [
      { keys: [['+'], ['−']], label: msg('Zoom in and out') },
      { keys: [['←', '↑', '→', '↓']], label: msg('Move the map') },
      { keys: [['G']], label: msg('Globe or flat map') },
      { keys: [['R']], label: msg('Back to the whole world') },
      { keys: [['F']], label: msg('Full screen') },
    ],
  },
  {
    title: msg('Search'),
    items: [
      { keys: [['/'], [MOD, 'K']], label: msg('Search places and coordinates') },
      { keys: [['↑', '↓']], label: msg('Move through results') },
      { keys: [['↵']], label: msg('Go there') },
      { keys: [['⇧', '↵']], label: msg('Directions there') },
      { keys: [['Esc']], label: msg('Clear, then close') },
    ],
  },
  {
    title: msg('Panels'),
    items: [
      { keys: [['L']], label: msg('Layers') },
      { keys: [['A']], label: msg('Alerts') },
      { keys: [['D']], label: msg('Areas') },
      { keys: [['I']], label: msg('Recon') },
      { keys: [['M']], label: msg('Markets') },
      { keys: [['T']], label: msg('Ask TI') },
      { keys: [['Esc']], label: msg('Close the panel') },
      { keys: [['?']], label: msg('These shortcuts') },
    ],
  },
  {
    title: msg('Replay and history'),
    items: [
      { keys: [['P']], label: msg('Replay recorded ships and aircraft') },
      { keys: [['H']], label: msg('History: the past on a timeline') },
      { keys: [['Space']], label: msg('Play or pause the timeline') },
      { keys: [[','], ['.']], label: msg('Replay: jump back or ahead') },
      { keys: [['J']], label: msg('Go to a date or time') },
    ],
  },
];

function Keys({ keys }: { keys: string[][] }) {
  const t = useT();
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {keys.map((combo, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-meta text-ink-4">{t('or')}</span>}
          <span className="flex items-center gap-0.5">{combo.map(k => <Kbd key={k}>{k}</Kbd>)}</span>
        </Fragment>
      ))}
    </span>
  );
}

/** The cheat sheet: ? anywhere outside a text field, or the ? in the status bar. */
export default function KeyboardShortcuts() {
  const t = useT();
  const open = useShortcutsOpen();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable)) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleShortcuts(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Modal open={open} onClose={hideShortcuts} title={t('Keyboard shortcuts')} subtitle={t('Single keys work anywhere outside a text field')} className="max-w-[680px]">
      <div className="gap-x-10 sm:columns-2">
        {GROUPS.map(g => (
          <section key={g.title} aria-labelledby={`kbd-${g.title}`} className="mb-6 break-inside-avoid last:mb-0">
            <h3 id={`kbd-${g.title}`} className="mb-1 text-meta font-medium text-ink-3">{t(g.title)}</h3>
            <dl>
              {g.items.map(s => (
                <div key={s.label} className="flex min-h-8 items-center justify-between gap-4 border-b border-line py-1 last:border-0">
                  <dt className="text-body text-ink-1">{t(s.label)}</dt>
                  <dd className="m-0"><Keys keys={s.keys} /></dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
