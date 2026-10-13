'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './button';
import { cx, type IconType } from './class-names';
import { Segmented, segmentId, type SegmentedOption } from './segmented';
import { useEscape } from './use-escape';

export type PanelTabs<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export type PanelProps<T extends string = string> = {
  title: string;
  /** One line of context under the title: "136 in the last day · updated just now". */
  subtitle?: ReactNode;
  /** Small context beside the title, such as a count. */
  meta?: ReactNode;
  icon?: IconType;
  /** Icon buttons before Close. */
  actions?: ReactNode;
  tabs?: PanelTabs<T>;
  onClose?: () => void;
  /** Escape closes the newest open panel; turn off when the shell handles it. */
  closeOnEscape?: boolean;
  /** Stays put under the body: the one primary action, or source and freshness. */
  footer?: ReactNode;
  /** Docked panels are part of the frame: flush, full height, no radius. Floating ones are cards. */
  docked?: boolean;
  /** Hand the body over as-is (no padding, no scroll) to children that run their own scroller. */
  bare?: boolean;
  className?: string;
  children: ReactNode;
};

/** The one frame every panel uses: header, optional tabs, a scrolling body, an optional footer. */
export function Panel<T extends string = string>({
  title, subtitle, meta, icon: Icon, actions, tabs, onClose, closeOnEscape = true, footer, docked = true, bare, className, children,
}: PanelProps<T>) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEscape(() => onClose?.(), closeOnEscape && !!onClose, root);

  return (
    <section
      ref={root}
      aria-labelledby={`${id}-title`}
      className={cx(
        'flex min-h-0 flex-col overflow-hidden bg-surface-1 text-ink-2',
        docked ? 'h-full w-full border-r border-line' : 'max-h-full rounded-float border border-line shadow-float',
        className,
      )}
    >
      <div className={cx('shrink-0 border-b transition-colors duration-150', scrolled && !bare ? 'border-line' : 'border-transparent')}>
        <header className="flex h-[52px] items-center gap-2.5 pr-2 pl-4">
          {Icon && <Icon aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 id={`${id}-title`} className="truncate text-title font-semibold text-ink-1">{title}</h2>
              {meta && <div className="flex shrink-0 items-center text-meta text-ink-3">{meta}</div>}
            </div>
            {subtitle && <p className="truncate text-meta text-ink-3">{subtitle}</p>}
          </div>
          {(actions || onClose) && (
            <div className="flex shrink-0 items-center gap-0.5">
              {actions}
              {onClose && <IconButton label="Close" kbd="Esc" icon={X} onClick={onClose} />}
            </div>
          )}
        </header>
        {tabs && (
          <div className="px-4 pb-3">
            <Segmented {...tabs} id={id} semantics="tabs" label={title} size="sm" full />
          </div>
        )}
      </div>
      <div
        role={tabs ? 'tabpanel' : undefined}
        aria-labelledby={tabs ? segmentId(id, tabs.value) : undefined}
        onScroll={bare ? undefined : e => setScrolled(e.currentTarget.scrollTop > 0)}
        className={bare ? 'flex min-h-0 flex-1 flex-col' : 'styled-scrollbar min-h-0 flex-1 overflow-y-auto p-4'}
      >
        {children}
      </div>
      {footer && <PanelFooter>{footer}</PanelFooter>}
    </section>
  );
}

/** A labelled group inside a panel body. The label is 11 px, sentence case, ink-3. */
export function PanelSection({ title, hint, action, className, children }: {
  title?: ReactNode;
  /** Quiet context after the label: a count, a time. */
  hint?: ReactNode;
  /** One small control on the right of the label, usually a ghost sm Button. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className={cx('not-first:mt-6', className)}>
      {(title || action) && (
        <div className="mb-2 flex min-h-5 items-center gap-2">
          <h3 id={id} className="min-w-0 flex-1 truncate text-meta font-medium text-ink-3">
            {title}
            {hint != null && <span className="font-normal"> · {hint}</span>}
          </h3>
          {action && <div className="-my-1.5 -mr-2 flex shrink-0 items-center">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** The sticky foot of a panel: one primary action, or quiet source and freshness. */
export function PanelFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('flex min-h-[52px] shrink-0 items-center gap-2 border-t border-line px-4 py-2.5 text-meta text-ink-3', className)}>
      {children}
    </div>
  );
}
