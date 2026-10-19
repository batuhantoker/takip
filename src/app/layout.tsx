import type { Metadata, Viewport } from "next";
import AdsProvider from '@/components/shell/ads/ads-provider';
import ErrorBoundary from '@/components/ui/error-boundary';
import LocaleProvider from '@/components/ui/locale-provider';
import { headers } from 'next/headers';
import { loadCatalog } from '@/lib/core/i18n/catalog';
import { AD_CLIENT } from '@/lib/platform/ads';
import { ogLocale } from '@/lib/core/i18n/locales';
import { getT, requestLocale } from '@/lib/core/i18n/request';
import { configuredOrigin, publicOrigin } from '@/lib/platform/site/origin';
import { jsonLd } from '@/lib/platform/site/json-ld';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteJsonLd } from '@/lib/platform/site/site-copy';
import "./globals.css";

// Settings saved before the rename live under osiris.* / osiris:* keys.
const MIGRATE_STORAGE_KEYS = `try{for(const k of Object.keys(localStorage)){if(!/^osiris[.:]/.test(k))continue;const n='takip'+k.slice(6);if(localStorage.getItem(n)===null)localStorage.setItem(n,localStorage.getItem(k));localStorage.removeItem(k)}}catch(e){}`;

export const viewport: Viewport = {
  themeColor: "#0A0C0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

/** SITE_URL once the domain exists; until then the address the request came in on (the tunnel link rotates). */
async function origin() {
  return configuredOrigin() ?? publicOrigin(await headers());
}

// No canonical here: it would be inherited by every page that doesn't set its own.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    metadataBase: new URL(await origin()),
    applicationName: SITE_NAME,
    title: {
      default: t(SITE_TITLE),
      template: "%s · TAKIP",
    },
    description: t(SITE_DESCRIPTION),
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
        { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
        { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
        { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
        { url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
      ],
      apple: [
        { url: "/apple-touch-icon.png", sizes: "180x180" },
      ],
      shortcut: "/favicon.ico",
    },
    manifest: "/site.webmanifest",
    openGraph: {
      title: t("TAKIP: the world, live on one map"),
      description: t(SITE_DESCRIPTION),
      type: "website",
      siteName: SITE_NAME,
      locale: ogLocale((await requestLocale()).locale),
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: t("TAKIP, a live map of public data") }],
    },
    // Card type only: X falls back to og:title and og:image, so a page's own preview image wins.
    twitter: { card: "summary_large_image" },
    other: {
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "black-translucent",
      "apple-mobile-web-app-title": "TAKIP",
      "mobile-web-app-capable": "yes",
      "msapplication-TileColor": "#0A0C0F",
      "msapplication-config": "none",
      // AdSense site verification: the ad script loads client-side once the plan is known, so crawlers never see it.
      ...(AD_CLIENT ? { "google-adsense-account": AD_CLIENT } : {}),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, chosen, automatic } = await requestLocale();
  return (
    <html lang={locale} dir="ltr">
      <head>
        {/* Must run before any client code reads its settings. */}
        <script dangerouslySetInnerHTML={{ __html: MIGRATE_STORAGE_KEYS }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteJsonLd(await origin())) }} />
      </head>
      <body className="antialiased">
        <LocaleProvider locale={locale} chosen={chosen} automatic={automatic} catalog={await loadCatalog(locale)}>
          <ErrorBoundary name="TAKIP Core">
            <AdsProvider>{children}</AdsProvider>
          </ErrorBoundary>
        </LocaleProvider>
      </body>
    </html>
  );
}
