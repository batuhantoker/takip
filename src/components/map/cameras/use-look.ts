'use client';

import { useSyncExternalStore } from 'react';
import { lookOf, subscribeLooks, type Look } from '@/lib/intel/vision/store';

/** The look at a camera, for its overlay. */
export const useLook = (id: string | null | undefined): Look | null =>
  useSyncExternalStore(subscribeLooks, () => lookOf(id), () => null);
