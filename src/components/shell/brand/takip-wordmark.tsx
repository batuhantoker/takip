import { WORDMARK } from './geometry.generated';

/** The TAKIP logotype, drawn rather than typeset so it matches the icons and OG image. */
export function TakipWordmark({ className, title = 'TAKIP' }: { className?: string; title?: string }) {
  return (
    <svg viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`} className={className} fill="currentColor" role="img" aria-label={title}>
      <path d={WORDMARK.d} />
      <path d={WORDMARK.ring} fillRule="evenodd" />
    </svg>
  );
}
