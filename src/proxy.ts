import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, PATH_LOCALE_HEADER } from '@/lib/core/i18n/locales';
import { localePath, splitLocalePath } from '@/lib/platform/site/locale-path';
import { reversedPairPath } from '@/lib/platform/site/compare/pair-path';
import { noteCrawler } from '@/lib/platform/site/crawl-log';
import { languageRedirect } from '@/lib/platform/site/language-redirect';

/*
 * The public reading pages carry their language in the URL (/tr/map/earthquakes); there is one set of
 * routes, so /tr/… is rewritten to /… and the language travels in a request header that requestLocale()
 * puts first. The unprefixed pages are English, whatever the visitor's cookie says; a reader arriving on one
 * from another site is sent to their own language's copy first (language-redirect.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  noteCrawler(request.headers.get('user-agent'), pathname);
  const prefix = /^\/([a-z]{2})(?:\/|$)/.exec(pathname)?.[1];
  // A bare /tr opens that language's index of the map.
  if (prefix && prefix !== 'en' && /^\/[a-z]{2}\/?$/.test(pathname)) {
    return NextResponse.redirect(new URL(`/${prefix}/map`, request.url), 308);
  }
  if (prefix === 'en') return NextResponse.redirect(new URL(pathname.slice(3) || '/', request.url), 308);

  const split = splitLocalePath(pathname);
  // /compare/turkey-vs-greece is /compare/greece-vs-turkey.
  const canonical = split && reversedPairPath(split.path);
  if (split && canonical) return NextResponse.redirect(new URL(localePath(split.locale, canonical), request.url), 308);
  // An English page reached from outside goes to the reader's language; temporary and per reader, so never cached.
  const elsewhere = split && split.path === pathname && (request.method === 'GET' || request.method === 'HEAD')
    ? languageRedirect(pathname, request.nextUrl.search, request.headers, request.cookies.get(LOCALE_COOKIE)?.value)
    : null;
  if (elsewhere) {
    const response = NextResponse.redirect(new URL(elsewhere, request.url), 307);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  const headers = new Headers(request.headers);
  // Only this proxy sets the header; a client's own copy is dropped.
  headers.delete(PATH_LOCALE_HEADER);
  if (!split) return NextResponse.next({ request: { headers } });
  headers.set(PATH_LOCALE_HEADER, split.locale);
  if (split.path === pathname) return NextResponse.next({ request: { headers } });
  const url = request.nextUrl.clone();
  url.pathname = split.path;
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ['/', '/map/:path*', '/about', '/embed', '/embed/:path*', '/city/:path*', '/town/:path*', '/county/:path*', '/state/:path*', '/country/:path*', '/event/:path*', '/spacecraft', '/spacecraft/:path*', '/planet/:path*', '/compare', '/compare/:path*', '/ramadan', '/easter', '/jewish-holidays', '/guides', '/guides/:path*', '/docs', '/docs/:path*', '/robots.txt', '/sitemap.xml', '/sitemap-index.xml', '/privacy', '/terms', '/cookies', '/contact', '/disclaimer', '/copyright', '/places', '/live', '/(en|tr|es|pt|fr|de|ru|ar|zh|ja)', '/(en|tr|es|pt|fr|de|ru|ar|zh|ja)/:path*'],
};
