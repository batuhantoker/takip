'use client';

import { AlertTriangle, RotateCw, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { cx } from '@/components/ui/class-names';

/** A failed lookup, said plainly where its answer would be, with a retry when one makes sense. */
export function ErrorNote({ message, onRetry, onDismiss, className }: {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  const actions = onRetry || onDismiss;
  return (
    <div role="alert" className={cx('flex items-start gap-2.5 rounded-card border border-line bg-surface-2 py-2 pl-3', actions ? 'pr-1.5' : 'pr-3', className)}>
      <AlertTriangle aria-hidden className={cx('size-4 shrink-0 text-red', actions ? 'mt-1.5' : 'mt-0.5')} strokeWidth={1.75} />
      <p className={cx('min-w-0 flex-1 text-small text-ink-1', actions ? 'py-1.5' : 'py-0.5')}>{message}</p>
      {onRetry && <Button variant="ghost" size="sm" icon={RotateCw} onClick={onRetry}>Try again</Button>}
      {onDismiss && <IconButton label="Dismiss" icon={X} size="sm" onClick={onDismiss} />}
    </div>
  );
}
