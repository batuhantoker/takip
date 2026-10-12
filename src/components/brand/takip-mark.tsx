'use client';

import { useId } from 'react';
import { motion, type Transition } from 'framer-motion';
import { MARK } from './geometry.generated';

const ACCENT = 'var(--brand-accent)';
const EASE = [0.22, 1, 0.36, 1] as const;

/** The globe-and-orbit mark. The globe and the arrow's rim take `currentColor`; the orbit takes --brand-accent.
 *  `small` is the favicon cut, for anything under ~24px. `intro` draws the orbit in. */
export function TakipMark({ variant = 'full', intro = false, className, title }: {
  variant?: keyof typeof MARK;
  intro?: boolean;
  className?: string;
  title?: string;
}) {
  const m = MARK[variant];
  const id = useId().replace(/[^\w-]/g, '');
  const { cx, cy, r } = m.globe;
  const s = m.stroke;

  const step = (delay: number, duration = 0.5): Transition => ({ delay, duration, ease: EASE });
  const draw = intro
    ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: step(0.35, 1.1) }
    : {};
  const pop = (delay: number) => intro
    ? { initial: { opacity: 0, scale: 0.4 }, animate: { opacity: 1, scale: 1 }, transition: step(delay, 0.35) }
    : {};

  return (
    <svg
      viewBox={m.box.join(' ')}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={`${id}-globe`}><circle cx={cx} cy={cy} r={r} /></clipPath>
        {/* Gaps in the globe lines where the orbit passes in front */}
        <mask id={`${id}-gaps`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <rect width="512" height="512" fill="#fff" />
          <g fill="#000" stroke="#000" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d={m.front} fill="none" strokeWidth={s.orbit + s.gap * 2} {...draw} />
            <path d={m.arrow} strokeWidth={s.gap * 2 + s.arrow} />
            {m.dots.map(([x, y]) => <circle key={x} cx={x} cy={y} r={m.dotR + s.gap} />)}
          </g>
        </mask>
        <mask id={`${id}-behind`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <rect width="512" height="512" fill="#fff" />
          <circle cx={cx} cy={cy} r={r + s.outline / 2 + s.gap} fill="#000" />
        </mask>
        <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" {...m.fade}>
          <stop offset="0" style={{ stopColor: ACCENT, stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: ACCENT }} />
        </linearGradient>
      </defs>

      <motion.g
        mask={`url(#${id}-gaps)`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        {...(intro ? { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 }, transition: step(0, 0.7) } : {})}
      >
        <path d={m.grid} strokeWidth={s.grid} clipPath={`url(#${id}-globe)`} />
        <circle cx={cx} cy={cy} r={r} strokeWidth={s.outline} />
      </motion.g>

      {m.predicted && (
        <motion.path
          d={m.predicted}
          mask={`url(#${id}-behind)`}
          fill="none"
          strokeWidth={s.orbit * 0.6}
          strokeLinecap="round"
          strokeDasharray={`0.1 ${s.orbit * 1.6}`}
          style={{ stroke: ACCENT }}
          initial={intro ? { opacity: 0 } : false}
          animate={{ opacity: 0.85 }}
          transition={step(1.3, 0.6)}
        />
      )}
      <motion.path d={m.front} fill="none" stroke={`url(#${id}-fade)`} strokeWidth={s.orbit} strokeLinecap="round" {...draw} />
      {m.dots.map(([x, y], i) => (
        <motion.circle key={x} cx={x} cy={y} r={m.dotR} style={{ fill: ACCENT }} {...pop(0.75 + i * 0.25)} />
      ))}
      <motion.path
        d={m.arrow}
        stroke="currentColor"
        strokeWidth={s.arrow}
        strokeLinejoin="round"
        style={{ fill: ACCENT }}
        {...pop(1.35)}
      />
    </svg>
  );
}
