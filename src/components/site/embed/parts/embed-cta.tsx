import { ArrowUpRight } from 'lucide-react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';

/** The way from the glimpse into the full map: quiet, in the corner, always there. It replaces the page around the frame. */
export function EmbedCta({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_top"
      className={cx(
        'absolute bottom-3 left-3 z-30 inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface-1 pr-2.5 pl-3',
        'text-body font-medium text-ink-1 shadow-float hover:bg-surface-2',
        FOCUS_RING, TRANSITION,
      )}>
      {label}
      <ArrowUpRight aria-hidden className="size-4 shrink-0 text-accent" strokeWidth={1.75} />
    </a>
  );
}
