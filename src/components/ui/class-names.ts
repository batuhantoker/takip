import type { ComponentType } from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/** Any icon component that takes a className, such as a lucide icon. */
export type IconType = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>;

/** Mono is for numbers, coordinates, IDs and times; words stay in Geist. */
export const isNumeric = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && /^[−+-]?[\d.,:]/.test(v.trim()));

export type Tone = 'neutral' | 'accent' | 'red' | 'amber' | 'green' | 'blue';

/** Keyboard focus only: inputs match :focus-visible on click too, so fields use FIELD_FOCUS instead. */
export const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const FIELD_FOCUS = 'outline-none focus-within:border-accent';

export const EASE = 'ease-out';

/** Colour and background changes on hover and press. */
export const TRANSITION = `transition-colors duration-150 ${EASE} motion-reduce:transition-none`;

/** Fade in on mount, for floating surfaces; ENTER_FROM in position.ts adds the slide. */
export const ENTER =
  `transition-[opacity,translate] duration-150 ${EASE} starting:opacity-0 motion-reduce:transition-none`;
