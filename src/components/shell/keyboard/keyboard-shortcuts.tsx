'use client';

import { Fragment, useEffect } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { Modal } from '@/components/ui/modal';
import { hideShortcuts, toggleShortcuts, useShortcutsOpen } from './shortcuts-state';

type Shortcut = { keys: string[][]; label: string };

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

// What use-keyboard-shortcuts.ts and SearchBar do; keep the three in step.
const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Map',
    items: [
      { keys: [['+'], ['−']], label: 'Zoom in and out' },
      { keys: [['←', '↑', '→', '↓']], label: 'Move the map' },
      { keys: [['G']], label: 'Globe or flat map' },
      { keys: [['R']], label: 'Back to the whole world' },
      { keys: [['F']], label: 'Full screen' },
    ],
  },
  {
    title: 'Search',
    items: [
      { keys: [['/'], [MOD, 'K']], label: 'Search places and coordinates' },
      { keys: [['↑', '↓']], label: 'Move through results' },
      { keys: [['↵']], label: 'Go there' },
      { keys: [['⇧', '↵']], label: 'Directions there' },
      { keys: [['Esc']], label: 'Clear, then close' },
    ],
  },
  {
    title: 'Panels',
    items: [
      { keys: [['L']], label: 'Layers' },
      { keys: [['A']], label: 'Alerts' },
      { keys: [['D']], label: 'Areas' },
      { keys: [['I']], label: 'Recon' },
      { keys: [['M']], label: 'Markets' },
      { keys: [['T']], label: 'Ask TI' },
      { keys: [['Esc']], label: 'Close the panel' },
      { keys: [['?']], label: 'These shortcuts' },
    ],
  },
  {
    title: 'Replay and history',
    items: [
      { keys: [['P']], label: 'Replay recorded ships and aircraft' },
      { keys: [['H']], label: 'History: the past on a timeline' },
      { keys: [['Space']], label: 'Play or pause the timeline' },
      { keys: [['J']], label: 'Go to a date or time' },
    ],
  },
];

function Keys({ keys }: { keys: string[][] }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {keys.map((combo, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-meta text-ink-4">or</span>}
          <span className="flex items-center gap-0.5">{combo.map(k => <Kbd key={k}>{k}</Kbd>)}</span>
        </Fragment>
      ))}
    </span>
  );
}

/** The cheat sheet: ? anywhere outside a text field, or the ? in the status bar. */
export default function KeyboardShortcuts() {
  const open = useShortcutsOpen();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleShortcuts(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Modal open={open} onClose={hideShortcuts} title="Keyboard shortcuts" subtitle="Single keys work anywhere outside a text field" className="max-w-[680px]">
      <div className="gap-x-10 sm:columns-2">
        {GROUPS.map(g => (
          <section key={g.title} aria-labelledby={`kbd-${g.title}`} className="mb-6 break-inside-avoid last:mb-0">
            <h3 id={`kbd-${g.title}`} className="mb-1 text-meta font-medium text-ink-3">{g.title}</h3>
            <dl>
              {g.items.map(s => (
                <div key={s.label} className="flex min-h-8 items-center justify-between gap-4 border-b border-line py-1 last:border-0">
                  <dt className="text-body text-ink-1">{s.label}</dt>
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
