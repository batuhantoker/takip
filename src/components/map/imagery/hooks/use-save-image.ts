'use client';

import { useEffect, useRef, useState } from 'react';
import type { Bbox } from '@/lib/feeds/imagery/area';
import { cropPlan, renderCrop } from '@/lib/feeds/imagery/area-image';
import type { ScenePass } from '@/lib/feeds/imagery/passes';
import { saveFile } from '@/lib/platform/native/save-file';

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving'; id: string; done: number; total: number }
  | { status: 'saved'; id: string; missing: number }
  | { status: 'failed'; id: string };

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Saves a pass, cut to the area, as one PNG. Closing the window cancels it, as does saving another. */
export function useSaveImage(bbox: Bbox, place: string) {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  const save = (pass: ScenePass) => {
    const plan = cropPlan(pass.tiles, bbox);
    if (!plan) { setState({ status: 'failed', id: pass.id }); return; }
    ctrl.current?.abort();
    const c = ctrl.current = new AbortController();
    setState({ status: 'saving', id: pass.id, done: 0, total: plan.pieces.length });
    renderCrop(plan, c.signal, done => setState({ status: 'saving', id: pass.id, done, total: plan.pieces.length }))
      .then(({ blob, missing }) => {
        const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
        const what = pass.mix ? `clearest-${day(pass.mix.from)}-to-${day(pass.mix.to)}` : `${slug(pass.lead.imager?.name ?? pass.lead.platform)}-${day(pass.lead.time)}`;
        return saveFile(blob, `takip-${slug(place) || 'area'}-${what}.png`).then(() => setState({ status: 'saved', id: pass.id, missing }));
      })
      .catch(() => { if (!c.signal.aborted) setState({ status: 'failed', id: pass.id }); });
  };

  return { state, save };
}
