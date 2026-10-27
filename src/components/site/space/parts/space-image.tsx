import { cx, FOCUS_RING } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import type { Picture } from '@/lib/platform/site/space/overview';

/** A picture of a world or a sky object on black: globes and craft whole, nebulae and galaxies cropped to fill. */
export function SpaceImage({ t, picture, alt, ratio, eager = false }: { t: Translate; picture: Picture | null; alt: string; ratio: string; eager?: boolean }) {
  return (
    <div className={cx('relative overflow-hidden rounded-card border border-line bg-black', ratio)}>
      {picture && (
        // eslint-disable-next-line @next/next/no-img-element -- our own files and Wikimedia's; next/image has no remote patterns here.
        <img src={picture.src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async"
          className={cx('size-full transition-[opacity,transform] duration-300 ease-out group-hover:scale-[1.02] group-hover:opacity-90 motion-reduce:transition-none',
            picture.contain ? 'object-contain' : 'object-cover')} />
      )}
      {picture?.illustration && <span className="absolute top-2.5 left-2.5 rounded-control bg-black/70 px-2 py-0.5 text-[11px] text-ink-2">{t('Illustration')}</span>}
    </div>
  );
}

export function PictureCredit({ t, picture }: { t: Translate; picture: Picture }) {
  const label = t('Picture: {credit}', { credit: picture.credit });
  return (
    <p className="mt-2 line-clamp-1 text-[11px] leading-4 text-ink-3" title={picture.credit}>
      {picture.href ? <a href={picture.href} rel="noopener" className={cx('hover:text-ink-1', FOCUS_RING)}>{label}</a> : label}
    </p>
  );
}
