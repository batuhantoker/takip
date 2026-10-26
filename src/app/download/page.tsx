import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { PhoneQr } from '@/components/site/download/phone-qr';
import { PlatformCard, type CardLink } from '@/components/site/download/platform-card';
import { LINK_BUTTON, Section, SiteFrame } from '@/components/site/pages/site-frame';
import { getT, requestLocale } from '@/lib/core/i18n/request';
import { msg, type Translate } from '@/lib/core/i18n/translator';
import { readDownloads, storeLinks, visitorPlatform, type Downloads } from '@/lib/platform/native/downloads';
import type { AppPlatform } from '@/lib/platform/native/shell';
import { localePath } from '@/lib/platform/site/locale-path';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { readingImage, readingMetadata } from '@/lib/platform/site/meta';

const TITLE = msg('TAKIP apps for iPhone, Android, Windows, Mac and Linux');
const LEDE = msg('The apps open the same live map as the website, signed in to the same account, and change when it does: new layers and fixes reach them without an app update.');

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return readingMetadata({ locale: t.locale, path: '/download', title: t(TITLE), description: t(LEDE), image: readingImage('download', t.locale) });
}

const ORDER: AppPlatform[] = ['ios', 'android', 'windows', 'macos', 'linux'];

// Product names stay as they are; a catalog would translate Windows as the panes.
const NAMES: Record<Exclude<AppPlatform, 'ios'>, string> = { android: 'Android', windows: 'Windows', macos: 'Mac', linux: 'Linux' };
const nameOf = (t: Translate, platform: AppPlatform) => (platform === 'ios' ? t('iPhone and iPad') : NAMES[platform]);

function cards(t: Translate, downloads: Downloads | null, stores: Partial<Record<AppPlatform, string>>) {
  const files = (platform: AppPlatform) => downloads?.files.filter(f => f.platform === platform) ?? [];
  const href = (name: string) => `/download/${encodeURIComponent(name)}`;
  const unsigned = (platform: AppPlatform) => files(platform).some(f => !f.signed);
  const MAC_ARCH: Record<string, string> = { universal: '', arm64: msg('Apple silicon'), x64: msg('Intel') };

  const links: Record<AppPlatform, CardLink[]> = {
    ios: stores.ios ? [{ href: stores.ios, label: t('App Store') }] : [],
    android: [
      ...(stores.android ? [{ href: stores.android, label: t('Google Play') }] : []),
      ...files('android').map(f => ({ href: href(f.name), label: t('Download the APK'), file: f })),
    ],
    windows: files('windows').map(f => ({ href: href(f.name), label: t('Download for Windows'), file: f })),
    macos: files('macos').map(f => ({ href: href(f.name), label: MAC_ARCH[f.arch] ? `${t('Download for Mac')} (${t(MAC_ARCH[f.arch])})` : t('Download for Mac'), file: f })),
    linux: files('linux').map(f => ({ href: href(f.name), label: f.kind === 'deb' ? t('.deb for Debian and Ubuntu') : t('AppImage'), file: f })),
  };
  const notes: Record<AppPlatform, string[]> = {
    ios: [],
    android: files('android').length ? [t('The APK installs once you let your browser install apps, which Android asks about the first time.')] : [],
    windows: unsigned('windows') ? [t('The installer is not signed yet. If Windows warns about it, choose More info, then Run anyway.')] : [],
    macos: unsigned('macos') ? [t('The app is not notarized by Apple yet, so the first time macOS refuses to open it. Then choose Open Anyway in System Settings, under Privacy & Security.')] : [],
    linux: files('linux').some(f => f.kind === 'appimage') ? [t('Make the AppImage executable, then open it.')] : [],
  };
  return { links, notes };
}

export default async function DownloadPage() {
  const { locale } = await requestLocale();
  const t = await getT();
  const h = await headers();
  const [downloads, ua] = [await readDownloads(), h.get('user-agent')];
  const mine = visitorPlatform(ua);
  const phone = mine === 'ios' || mine === 'android';
  const { links, notes } = cards(t, downloads, storeLinks());
  const order = mine ? [mine, ...ORDER.filter(p => p !== mine)] : ORDER;
  const files = downloads?.files ?? [];

  return (
    <SiteFrame t={t} path="/download" trail={[{ href: localePath(locale, '/download'), label: t('Apps') }]}>
      <header className="mt-8 grid items-end gap-8 lg:grid-cols-[minmax(0,44rem)_auto] lg:justify-between">
        <div>
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.02em] sm:text-5xl">{t('TAKIP on your phone and computer')}</h1>
          <p className="mt-5 text-[17px] leading-relaxed text-ink-2">{t(LEDE)}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={LINK_BUTTON.secondary}>{t('Or open it in the browser')}</Link>
          </div>
        </div>
        {!phone && <PhoneQr url={`${configuredOrigin() ?? publicOrigin(h)}${localePath(locale, '/download')}`} label={t('Scan with your phone to open this page there.')} />}
      </header>

      <div className="mt-12 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {order.map(platform => (
          <PlatformCard key={platform} t={t} platform={platform} name={nameOf(t, platform)} links={links[platform]} notes={notes[platform]}
            version={downloads?.files.find(f => f.platform === platform)?.version ?? null} mine={platform === mine} />
        ))}
      </div>

      <div className="mt-16 max-w-[44rem]">
        <Section title={t('The same TAKIP')}>
          <p>{t('Each app is the website in a window of its own: the map, History, Replay, TI and your settings are the same everywhere, and signing in on one keeps your workspaces on all of them.')}</p>
        </Section>
        {files.length > 0 && (
          <Section title={t('Checksums')}>
            <p>{t('To check a file, compare its SHA-256 with the one here.')}</p>
            <ul className="mt-4 flex flex-col gap-2 font-mono text-[12px] break-all text-ink-3">
              {files.map(f => <li key={f.name}><span className="text-ink-2">{f.name}</span> {f.sha256}</li>)}
            </ul>
          </Section>
        )}
      </div>
    </SiteFrame>
  );
}
