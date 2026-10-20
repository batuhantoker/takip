'use client';

import { useState } from 'react';
import { cx, FOCUS_RING, TRANSITION } from '@/components/ui/class-names';
import { previewImage } from '@/lib/core/link-preview/client';
import type { LinkPreview } from '@/lib/core/link-preview/parse';

/** An article as its own page presents it: picture, headline, standfirst, site. A placeholder while it loads. */
export function LinkPreviewCard({ href, preview, loading, showTitle = true }: {
  href: string;
  preview: LinkPreview | null;
  loading: boolean;
  /** Off when the row above already reads the same headline. */
  showTitle?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  if (loading) {
    return (
      <div aria-hidden className="flex flex-col gap-2 rounded-card border border-line p-3">
        <span className="h-32 w-full animate-pulse rounded-control bg-surface-3 motion-reduce:animate-none" />
        <span className="h-3 w-4/5 animate-pulse rounded bg-surface-3 motion-reduce:animate-none" />
        <span className="h-3 w-3/5 animate-pulse rounded bg-surface-3 motion-reduce:animate-none" />
      </div>
    );
  }
  const image = preview && !imageFailed ? previewImage(preview) : null;
  const title = showTitle ? preview?.title : null;
  if (!preview || !(image || title || preview.description)) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={cx('group/card block overflow-hidden rounded-card border border-line bg-surface-1 hover:border-line-strong', FOCUS_RING, TRANSITION)}>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- the publisher's own picture, loaded only when the row is opened
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)}
          className="block max-h-48 w-full bg-surface-0 object-cover" />
      )}
      <span className="flex flex-col gap-1 p-3">
        {title && <span className="line-clamp-3 text-body font-medium text-ink-1 group-hover/card:underline">{title}</span>}
        {preview.description && <span className="line-clamp-4 text-small text-ink-2">{preview.description}</span>}
        {preview.site && <span className="truncate text-meta text-ink-3">{preview.site}</span>}
      </span>
    </a>
  );
}
