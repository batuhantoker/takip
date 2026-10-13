import { useEffect, useEffectEvent, type RefObject } from 'react';

type Root = RefObject<HTMLElement | null>;

/**
 * Closes on a press outside `root` (or outside every root in a list, for
 * content portalled away from its trigger), or on Escape — which also hands
 * focus back to `returnFocus`, so a keyboard user is not left stranded.
 */
export function useDismiss(
  open: boolean,
  close: () => void,
  root: Root | Root[],
  returnFocus?: RefObject<HTMLElement | null>,
) {
  const onClose = useEffectEvent(close);
  const isInside = useEffectEvent((target: Node) =>
    (Array.isArray(root) ? root : [root]).some(r => r.current?.contains(target)));

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!isInside(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Claimed, so a panel underneath (see use-escape) stays open.
      e.preventDefault();
      onClose();
      returnFocus?.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, returnFocus]);
}
