# Comparison and world pages

Two countries side by side on History's measures, and each measure around the world, built 2026-10-19 on the country statistics pages (`place-pages.md`, Statistics). They read the same table, `data/site/topics/indicators.json`, through `lib/platform/site/places/topics/indicators-table.ts`, so nothing here opens `history.db`. Every page is in ten languages at its own URL (`/tr/compare/…`), like the other reading pages.

## Pages

| URL | What it is | Where |
|---|---|---|
| `/compare` | Two selects that go to any pair (`?a=greece&b=turkey` redirects), every measure's world page, and every country with the countries it is compared with, for crawling | `app/compare/page.tsx`, `components/site/compare/compare-index.tsx` |
| `/compare/<a>-vs-<b>` | Every measure both countries have, grouped as on a country's hub, each card both latest values and both lines | `app/compare/[pair]/[[...measure]]`, `components/site/compare/compare-page.tsx`, `parts/pair-bodies.tsx` |
| `/compare/<a>-vs-<b>/<measure>` | Both countries and the World on one chart; each latest value, the gap and ratio in the latest year both have (percentage points between shares), who has been higher since when and whom they overtook, their ranks, both projections where published, the table for both, and links to each country's own page for the measure | same |
| `/map/<measure>` | The measure around the world: the World and the five most populous countries with figures on one chart, every country ranked by its latest value (linked to its page), the highest and lowest in the measure's rank year | `app/map/[slug]/page.tsx` (after the layer pages, which no measure slug collides with), `components/site/compare/world-page.tsx` |

The pair's address names the two country slugs in alphabetical order (`pairs.ts` `pairSlug`); the other order answers 308 to it, measure and language kept, in `src/proxy.ts` (`compare/pair-path.ts`, no data read) and again in the page. Unknown countries, a country with itself, a pair with no measure in common and unknown measures are 404.

"Watch it change on the map" opens History coloured by the measure, playing from its first year, with both countries charted: the link's `country` takes up to four countries.json ids (`?country=GRC,TUR`, `lib/map/view-mode-link.ts`).

## What gets indexed

- A pair is listed when the two share a land border, are both among the biggest countries, or both big in one region: `data/site/compare-pairs.json` from `tools/site/compare-pairs.ts`, 1,874 pairs (`compare/pairs.ts`). Any other pair renders with `noindex, follow`.
- A listed pair's measure page: both countries' own pages for the measure are indexed (`INDICATOR_INDEX`), the two have values in at least 10 of the same years (`COMMON_YEARS`), and its title can name both countries and the measure in 60 characters, with the measure's `short` label if need be (`pairMeasureIndexed` in `compare/compare-copy.ts`). The last rule leaves out 71 pages of 8 pairs of long names, such as Central African Republic and Congo - Brazzaville.
- A listed pair's overview: five of its measure pages indexed (`pairIndexed`).
- Every measure's world page.
- `compare/compare.test.ts` checks every indexed comparison's and world page's title (60 characters at most, each its own) and description (110 to 160).

The comparisons go into the place sitemaps' chunks (`places/sitemap.ts`, from `compare/sitemap.ts`, kept for 30 seconds since every chunk asks); `/compare` and the world pages are in `/sitemap.xml`. Share cards are the place pages' (`/og?place=compare/<pair>[/<measure>]`, `world/<measure>`; `compare/card.ts`).

## Copy

Every sentence is worked out from the two series (`compare-copy.ts`, `world.ts`): what is estimated, observed (ERA5) or modelled (CMIP6) is said as such, as on the country pages, and projections are named by their publisher and scenario. Ranks are said only where neither country shares its place. A source's own marks stay on the chart and in the table: SIPRI's estimates as dots and its highly uncertain figures as rings.
