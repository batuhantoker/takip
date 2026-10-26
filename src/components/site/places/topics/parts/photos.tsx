import { Section } from '@/components/site/pages/site-parts';
import type { Photo } from '@/lib/places/attractions/photos';
import type { SiteText } from '@/lib/platform/site/text';

export type Photos = Record<string, Photo>;

/** The same Commons picture at another of Wikimedia's widths. */
export const photoAt = (src: string, px: number) => src.replace(/\/\d+px-/, `/${px}px-`);

/** A square thumbnail; the credit is in the page's PhotoCredits. */
export function PhotoThumb({ photo, size = 56 }: { photo?: Photo; size?: number }) {
  if (!photo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Wikimedia's own scaled copy; next/image has no remote patterns here.
    <img src={photoAt(photo.src, 250)} alt="" width={size} height={size} loading="lazy" decoding="async"
      className="shrink-0 rounded-control bg-surface-2 object-cover" style={{ width: size, height: size }} />
  );
}

/** Who took each picture shown, under which licence, linked to its Commons page. */
export function PhotoCredits({ text, credits }: { text: SiteText; credits: { name: string; photo: Photo }[] }) {
  const { t } = text;
  if (!credits.length) return null;
  return (
    <Section title={t('Photo credits')}>
      <ul className="flex flex-col gap-1 text-[12px] leading-relaxed text-ink-3">
        {credits.map(({ name, photo }) => (
          <li key={photo.page}>
            {name}: <a href={photo.page} target="_blank" rel="noopener" className="hover:text-ink-1">
              {[photo.author ?? t('Unknown author'), photo.licence].filter(Boolean).join(', ')}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-3">{t('Pictures from Wikimedia Commons, through each place’s Wikidata entry.')}</p>
    </Section>
  );
}
