# Embeds

A small live map that a page shows in an iframe: one layer page's layers at its view, or any place, layers and period that a URL names. Built 2026-10-19 for the heroes of the `/map/<slug>` pages, and shaped so place-and-period pages ("earthquakes in Malatya in the last 100 years", "US earthquakes in the last 10 years") need only a URL, not new code.

## The two routes

| Path | What it shows | Code |
|---|---|---|
| `/embed/<slug>` | A layer page's layers at its view, following its `track` (the ISS). 45 of the 66 catalogue pages, fewer on a server without the keys some layers need (`availablePages`): those without a `mode` (History, deep time, Space, Replay) or a `panel` (the tools). | `app/embed/[slug]/page.tsx`; `hasEmbed`, `embedPath`, `pageEmbed` in `lib/platform/site/embed.ts` |
| `/embed?…` | Any spec, read from the query. | `app/embed/page.tsx`; `embedHref(spec)` writes the URL |

Both render `EmbedView` (`components/site/embed/`): the map, full-bleed, and "Open the full map" in the corner, which replaces the page around the frame (`target="_top"`). Both are `noindex, nofollow` and stay out of the sitemap.

## The spec

`EmbedSpec` (`lib/map/embed/spec.ts`) is what every producer writes and the one parser reads. The query keeps the map's own link names, so a spec reads like a share link:

| Key | Meaning |
|---|---|
| `layers=earthquakes,flights` | Layer keys from `DEFAULT_LAYERS`; unknown ones are dropped. Day and night and the sky are drawn under them. |
| `lat`, `lon`, `zoom` | Where the camera opens. |
| `bbox=w,s,e,n` | An area: the camera fits it, and windowed layers ask for what happened inside it. West above east crosses the antimeridian (`bbox=172,51,-129,72` is Alaska). |
| `track=satellite:25544` | What the map finds and follows. |
| `last=10y`, `last=30d` | A window ending at the close of today (UTC), so everyone who opens it on the same day asks the same question. |
| `from=1999-08-17&to=1999-08-18` | A fixed window, `to` exclusive; `YYYY` works too. |
| `minmag=4` | Earthquakes from this magnitude up. Without it the floor rises with area and years: 2.5 for a place or a country, up to 6 for the whole world over a century (`range/floor.ts`). |

Anything malformed is left out rather than refused. Examples:

- `/embed?layers=earthquakes&bbox=-125,24,-66,50&last=10y`: the 2,000 largest of the 31,898 M2.5+ quakes in the contiguous US since 2016.
- `/embed?layers=earthquakes&bbox=37.5,37.8,39.3,39.4&last=100y`: all 442 around Malatya since 1926.
- `/embed?layers=earthquakes&from=1999-08-17&to=1999-08-18&minmag=4`: the day of the İzmit earthquake, worldwide.

## What it loads, and what it doesn't

It reuses the full map: `WorldMap` and its layer hooks, `useLiveData` with `panels: false`, `useNearbyFlights`, `useMalwareStream`, `useSdkEntities`, the track request, `MapCredits`. With `panels: false` there are no markets, no space weather and no news unless `alert_pins` is on; earthquakes and warnings load only while their layer is on. There is no shell, splash, search, status bar, TI, account, map-time tick or ad script: `AdsProvider` steps aside on `/embed`, so nothing calls `/api/v1/me/*`. `countAction` calls in the map's components only buffer, since nothing sends them without the map-time tick. The right-click menu is off, and conflict zones (shown unless `conflict_zones` is false, with no layer key of their own) are switched off.

Framed in a page, cooperative gestures are on: the wheel and one finger scroll the page, and Ctrl or ⌘ with the wheel, or two fingers, move the map. Opened on its own it pans and zooms like the full map.

## Windows

`WINDOWED_LAYERS` (`lib/map/embed/windows.ts`) lists the layers that can show a past window and how far back their source reaches. Under a window only those layers are drawn, plus the sky; nothing live sits under a caption about the past, and day and night is left out because it shows today.

Earthquakes are the first. `/api/earthquakes/range` takes the embed's own grammar and asks USGS ComCat (US public domain) for the largest 2,000 in the window and the count, because ComCat answers at most 20,000 a query. The caption says so: "The 2,000 largest of 31,898 earthquakes from magnitude 2.5", the years and the source. A window that reaches today is cached 15 minutes (an hour once it is longer than a month) and polled by the embed every 15 minutes; a closed one is cached a day. A worldwide window takes USGS 10–30 s at any floor, so the first visitor of the day waits; the count gets 20 s, and without it a full list still reads as "the 2,000 largest". 20 requests a minute per address. Magnitudes are rounded to two decimals; older catalogue entries carry raw floats. The quake popup gives the time in UTC, for live quakes too.

ComCat's completeness falls off with age and distance from dense networks: small Turkish quakes before about 1970 are thin. Say so on any page that leans on old small quakes, and prefer `minmag` 4 or more for windows over decades.

## Scaling out

1. **Places.** The spec takes a `bbox`, so a place-and-period page is a place table away: admin-0 and admin-1 shapes with their box and names in the ten languages (Natural Earth is public domain), next to the cities table `lib/platform/site/cities/` already holds. A page is then `embedHref({ layers: ['earthquakes'], bbox, window: { last: { n: 100, unit: 'y' } }, minMag: 4 })`. Generate only where the window holds enough to say something, and let the page carry facts from the same route (the count, the largest, its date), or it is a thin doorway page.
2. **More windowed layers.** Each is a range route, an entry in `WINDOWED_LAYERS` and a loader beside the earthquakes one in `components/site/embed/hooks/use-window-data.ts`. Candidates: wildfires (FIRMS archive), tropical cyclones (IBTrACS), disasters and conflict events already in `history.db` behind `/api/replay/history/events` (bbox, from, to and families; NOAA's damaging quakes are its `hazard` family), and tsunamis and volcanoes (NOAA NCEI, also there).
3. **The full map learning windows.** "Open the full map" from a windowed embed lands on today's layer at the same place, because `use-startup.ts` doesn't read `last`, `from` or `to`. Teaching it, or opening History at the window's start, is the next step that makes the link faithful.
4. **Language.** `/embed` isn't a reading path, so its language follows the visitor (cookie, country, browser), while `/tr/map/…` sets it from the URL. Adding `embed` to `READING` in `lib/platform/site/locale-path.ts` and to `proxy.ts`'s matcher would make `/tr/embed/…` follow the page.
5. **Other sites.** `X-Frame-Options: SAMEORIGIN` (`next.config.ts`) keeps the embed to our own pages. For blogs and news sites, send `frame-ancestors *` and no `X-Frame-Options` on `/embed` only, and decide on attribution and the rate limits first.

## Limits

- Plan gates don't apply: an embed shows its layers even when a plan closes their section for anonymous visitors.
- The map's JavaScript is the full map's (cached for the click through); only the data is per layer.
- Tracking opens the target's card, as on the map; in a small frame it covers part of the view.
- Inspect windows remember where they were put in the same `takip.windows.v1` storage as the full map.
