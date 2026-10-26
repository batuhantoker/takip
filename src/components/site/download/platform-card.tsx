import { Laptop, Monitor, Smartphone, type LucideIcon } from 'lucide-react';
import { LINK_BUTTON } from '@/components/site/pages/site-frame';
import { cx } from '@/components/ui/class-names';
import type { Translate } from '@/lib/core/i18n/translator';
import type { DownloadFile } from '@/lib/platform/native/downloads';
import type { AppPlatform } from '@/lib/platform/native/shell';

const ICON: Record<AppPlatform, LucideIcon> = { ios: Smartphone, android: Smartphone, windows: Monitor, macos: Laptop, linux: Monitor };

export type CardLink = { href: string; label: string; file?: DownloadFile };

/** One system's way to get the app: a store, a file, or word that it is coming. */
export function PlatformCard({ t, platform, name, links, notes, version, mine }: {
  t: Translate;
  platform: AppPlatform;
  name: string;
  links: CardLink[];
  notes: string[];
  version: string | null;
  mine: boolean;
}) {
  const Icon = ICON[platform];
  const size = (bytes: number) => t('{size} MB', { size: (bytes / 1e6).toLocaleString(t.intl, { maximumFractionDigits: 1 }) });
  return (
    <section id={platform} className={cx('flex scroll-mt-8 flex-col gap-4 rounded-card border bg-surface-1 p-5', mine ? 'border-accent' : 'border-line')}>
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-ink-3" aria-hidden />
        <h2 className="text-[17px] font-semibold text-ink-1">{name}</h2>
        {mine && <span className="ml-auto rounded-control bg-accent/15 px-2 py-0.5 text-[12px] font-medium text-accent">{t('This device')}</span>}
      </div>
      {links.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {links.map((link, i) => (
            <a key={link.href} href={link.href} className={i === 0 ? LINK_BUTTON.primary : LINK_BUTTON.secondary} {...(link.file ? { download: link.file.name } : {})}>
              {link.label}
              {link.file && <span className="font-normal opacity-75">{size(link.file.bytes)}</span>}
            </a>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-ink-3">{t('Coming soon')}</p>
      )}
      {version && links.some(l => l.file) && <p className="text-[13px] text-ink-3">{t('Version {version}', { version })}</p>}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-ink-3">
          {notes.map(note => <li key={note}>{note}</li>)}
        </ul>
      )}
    </section>
  );
}
