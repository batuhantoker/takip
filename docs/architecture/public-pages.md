# Public pages and search

How TAKIP shows up in search results and link previews. Built 2026-10-19. The map itself is WebGL, which crawlers and link-preview bots can't read, so everything they see is server-rendered around it.

## What exists

| Path | What it is | Code |
|---|---|---|
| `/` | The map. Its metadata comes from the link's query: `?track=satellite:25544` previews as "Following the ISS live", `?layers=earthquakes&lat…` as "Earthquakes near Tokyo, live". A visually hidden intro gives screen readers and crawlers a heading, a summary and links to every layer page. | `app/page.tsx`, `lib/platform/site/share-view.ts`, `components/site/pages/home-intro.tsx`; the map is `components/shell/dashboard.tsx` |
| `/og?…` | Share cards. For a map link, drawn from the same query; only what `describeView` recognises reaches the picture. For a reading page, `?page=<slug>&lang=tr`: its heading over its picture of the map, in its language. Russian, Chinese and Japanese fetch a small Noto subset from Google Fonts (`og-fonts.ts`). Arabic, which Satori can't lay out, and any card whose font can't be fetched are drawn in English. Outside `/api/` because X's card fetcher obeys robots.txt. Rate-limited to 30 a minute per address, with the last 200 cards kept in memory. | `app/og/route.tsx`, `components/site/pages/og-card.tsx` |
| `/map` | Every page as a gallery of pictures, by section. | `app/map/page.tsx` |
| `/map/<slug>` | One page per layer or feature (66): the layers, History and its eras, deep time, the Space view, Replay and the tools. Each says what it shows, where the data comes from, how fresh it is, what it can't tell you, and has "Open on the map", which opens the right view (`?view=history&year=1914`, `?view=deep&ma=250`, `?view=space&focus=mars`, `?view=replay`) or panel (`?panel=route`). A country's statistics pages add `&metric=wpp:LEx&country=TUR` (and `&source=` where several sources publish the metric): History colours the countries by it, charts that country (by its countries.json id, up to four of them comma-separated, as a comparison's link does) and plays from the measure's first year. Each History measure also has a page here, `/map/<measure>` (`compare-pages.md`). Four have a live line (earthquakes, next launch, aurora, ISS position). Each has its own preview card. | `app/map/[slug]/`, `lib/platform/site/catalog/`, `components/site/pages/layer-article.tsx`; the map side is `lib/map/view-mode-link.ts` and `shell/state/use-view-mode-link.ts` |
| `/about` | Why TAKIP exists, in plain words, beside a wall of four pictures. | `app/about/page.tsx` |
| `/tr/…`, `/ja/…` | Every reading page in nine more languages (below). | `src/proxy.ts` |
| `/shots/<slug>.jpg` | The pictures of the map the pages lead with. | `app/shots/[file]/route.ts` |
| `/embed/<slug>`, `/embed?…` | A minimal live map of a page's layers, framed in its picture; noindex. | `app/embed/`, docs/architecture/embeds.md |
| `/robots.txt`, `/sitemap.xml` | Generated. Crawlers stay out of `/api/`, `/admin`, `/design` and `/w/`. | `app/robots.ts`, `app/sitemap.ts` |

Every page carries schema.org JSON-LD for the site (`site-copy.ts`), and layer pages add a breadcrumb trail.

## The address

Canonical links, the sitemap and preview images need the site's public origin. `SITE_URL` sets it: `https://takip.dev` on the NUC. Where it is unset (dev, self-hosted copies) each request's own host is used (`lib/platform/site/origin.ts`). While it is unset every page renders per request. TI's watch links use the same helper after `AI_PUBLIC_ORIGIN`.

## Adding or changing a layer page

- Add the entry to the section's file in `lib/platform/site/catalog/`. Everything in it is shown as written, so it has to be true of the code: real sources, real refresh rates, real limits. Estimates, inferences and timetables are called what they are.
- Titles stay within 60 characters and descriptions between 110 and 160 (`layer-pages.test.ts`).
- A layer added to the Layers panel needs a page or a line in `NO_PAGE` with the reason (`components/panels/layers/lib/layer-pages-coverage.test.ts`).
- A page whose layer needs a key (`requiresEnv`) exists only when the server has it, so no page promises a hidden layer. Today that is ships (`AIS_API_KEY`), the Cloudflare layers and road traffic (`TOMTOM_API_KEY`; without it traffic covers only the Netherlands, Rennes and Nantes).
- `layers` replaces the map's whole set when the link opens (`use-startup.ts`), so `mapHref` adds the quiet display layers (day and night, the sky, the SDK lines) to any it names. A page that names none (History, Space, the tools) leaves the visitor's own layers alone.

## Pictures

On pages with an embed (`hasEmbed`: layers on today's map at a view), the picture turns into the live map: on a wide screen once it scrolls into view, on a phone only when the reader taps "Explore it here", since it loads the whole map's code (`LiveWindow`). Until it has loaded, the picture links into the full map.

Each page leads with a picture of the map: its own "Open on the map" link, taken in headless Chrome with the interface hidden, so it reads the same in every language (`MapWindow`; the whole picture links into the live map). `nice npx tsx tools/site/shots.ts` takes them against the running app (`--only slug,slug`, `--force` to retake, about 25 minutes for all), answering the map-time and usage calls itself so the run spends no one's minutes and leaves nothing in the analytics. They go to `.cache/site-shots/` (`SITE_SHOTS_DIR`), outside git, so a server needs its own run or a copy. A page without one shows a sketch of the world with its places marked. Retake a page's picture when its layer changes how it looks.

Each page has one ad slot (`AD_SLOTS.page`), beside the text and never over the picture; it shows only where AdSense is configured and the plan has ads. AdSense's Auto ads are on as well (since 2026-10-19), so Google adds its own placements on every page that loads the script, the map included; `/embed` never loads it, in any language.

## Languages

Each reading page has a URL per language: English at `/map/earthquakes`, the others under a prefix, `/tr/map/earthquakes`. `src/proxy.ts` rewrites `/tr/…` to the one set of routes and passes the language in a header that `requestLocale()` puts before the cookie and the country (`lib/core/i18n/request.ts`); the unprefixed pages are always English, `/en/…` redirects there, and a bare `/tr` opens `/tr/map`. Each page names every language's URL as an alternate (hreflang, `x-default` English), and so does the sitemap. Links between reading pages keep the reader's language (`localePath`); the map itself has one URL.

Short interface text goes through the shared translator (`t()`, catalogs in `lib/core/i18n/catalogs`). The long page copy is kept per page in `lib/platform/site/translations/<locale>.ts` (`copy.ts`), because with the English sentence as the key, editing one word would lose every translation. Anything missing stays English, and a list whose length no longer matches the English falls back to English. All nine languages were machine-translated on 2026-10-19 and cover every page; `translations.test.ts` fails if a page, a section or an About key is missing, or a list's length no longer matches. When you change English copy, change the same field in each language, or delete it there so English shows until it is translated. Generic source names ("Road authorities", "USGS and EMSC") translate through `sourceNames`; names of organisations stay as they are. 

## Live lines

A page with `live` fetches one sentence when it renders. It goes over loopback to the app's own `/api` route (`live/own-api.ts`, `WEB_INTERNAL_URL` or `127.0.0.1:$PORT`) rather than importing the route, so there is one copy of each route's cache and no extra upstream calls. A failure leaves the line out. The line says the time it was true for ("as of 14:11 UTC"), never "live".

## Not built yet

In `roadmap.md` §1.7.
