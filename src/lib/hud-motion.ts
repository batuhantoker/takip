/* The HUD enters as one sequence when the splash lifts. Each piece used to
   run its own fixed timer (2.5–3.5 s), which raced a splash that now lasts
   as long as the map takes to draw. */
const HUD_EASE = [0.22, 1, 0.36, 1] as const;
export const hudIn = (delay: number) => ({ duration: 0.7, ease: HUD_EASE, delay });
