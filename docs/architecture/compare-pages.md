# Comparison and world pages

Two countries side by side on History's measures, and each measure around the world, built 2026-10-19 on the country statistics pages (`place-pages.md`, Statistics). They read the same table, `data/site/topics/indicators.json`, through `lib/platform/site/places/topics/indicators-table.ts`, so nothing here opens `history.db`. Every page is in ten languages at its own URL (`/tr/compare/…`), like the other reading pages.

## Pages

| URL | What it is | Where |
|---|---|---|
| `/compare` | Two country pickers that go to any pair (`?a=greece&b=turkey` redirects; names and codes as typed work too), every measure's world page, and every country with the countries it is compared with, for crawling | `app/compare/page.tsx`, `components/site/compare/compare-index.tsx` |
| `/compare/<a>-vs-<b>` | The headline measure's chart beside the main differences (each leading to its measure's page) and other listed pairs that share a country, then one table of every measure both countries have, grouped as on a country's hub: each country's latest value with a bar to scale against the others', and their lines | `app/compare/[pair]/[[...measure]]`, `components/site/compare/compare-page.tsx`, `parts/overview-table.tsx` |
| `/compare/<a>-vs-<b>/<measure>` | The answer first (`pairAnswer`, `parts/pair-answer.tsx`): both figures in the latest year both have, who is higher by how much (percentage points between shares, and a ratio from 1.2 times), and since when; beside it, where to go next. Then the chart across the page with its settings (under it on a phone); a table of each country's latest value, ten years before, rank and projection; ranks, projections and the world in sentences; the year table for all; the other measures down the side | same, `parts/compare-chart.tsx`, `parts/latest-table.tsx`, `parts/measure-nav.tsx`, `parts/next-steps.tsx` |
| `/map/<measure>` | The measure around the world: the World and the five most populous countries with figures on one chart, every country ranked by its latest value (linked to its page), the highest and lowest in the measure's rank year | `app/map/[slug]/page.tsx` (after the layer pages, which no measure slug collides with), `components/site/compare/world-page.tsx` |

## The reader's view

A comparison takes up to four more countries and its chart's settings in the query, so a view can be shared and the pair keeps one address (`compare/view.ts`):

| Query | What it does |
|---|---|
| `with=germany,france` | More countries, in the order added, each in the next `SERIES_INK` colour (six in all). The country bar adds one through `?add=<slug>` (a GET form, folded into `with` by a redirect) and takes any off with its ×; one of the pair gives its place to the first added. |
| `from=1950` / `1990` / `2010` | The years from; offered only where the chart reaches further back. |
| `change=1` | Change: every line as its change since the first year all of them have, the World with them. In percent for what grows by multiples (`RELATIVE`: population, money, armed forces, CO₂, child and infant mortality), otherwise in the measure's unit, percentage points for a share. Not on a log axis. |
| `log=1` | A log axis, where every value shown is above zero. |
| `world=0` / `world=1`, `proj=0` | The World's line hidden or shown, and the projections hidden. A total (`total` on the spec: population, armed forces, arms trade, military spending in dollars, conflict deaths) leaves the World's line out unless asked, since it is billions beside a country; the country pages never draw it there. |

The country pickers (`parts/country-picker.tsx`) are a text field with a list under it. They find a country by its name in the reader's language or in English, its ISO codes ("us", "usa", "tr"), the names people use (`COUNTRY_ALIASES`: UK, UAE, America, Holland, Burma, Ivory Coast…), its name in any of the site's languages ("almanya"), or a near miss ("germny"), codes and whole names first (`compare/country-search.ts`, shared with the server). The field is what the form sends, so the server resolves typed text the same way (`compare/countries.ts` `findCountry`), with or without scripts.

The settings are links (`parts/chart-controls.tsx`, `rel="nofollow"`), and the page draws on the server as before. Any query makes the page `noindex, follow` with its canonical on the plain pair, and the redirects (reversed pair in `src/proxy.ts` and the page, `?add=`) keep it. With more than two countries the heading lists them, the lede ranks them in the latest year they share (`groupSentence`), and the pair's own sentences step aside; "Watch it change on the map" charts the first four.

The pair's address names the two country slugs in alphabetical order (`pairs.ts` `pairSlug`); the other order answers 308 to it, measure and language kept, in `src/proxy.ts` (`compare/pair-path.ts`, no data read) and again in the page. Unknown countries, a country with itself, a pair with no measure in common and unknown measures are 404.

"Watch it change on the map" opens History coloured by the measure, playing from its first year, with both countries charted: the link's `country` takes up to four countries.json ids (`?country=GRC,TUR`, `lib/map/view-mode-link.ts`). It frames the countries (`pairFocus`: their label points, widened by each one's size), or leaves the view alone where they span more than 120°, as the US and China do.

Where a comparison leads next (`compare/next.ts`): the pair's other measures, the overview's highlights first, and the same measure for listed pairs that share a country, each country's partners in turn, most populous first. Only indexed pages are offered (`pairMeasureIndexed`, `pairIndexed`), so the links add no addresses for crawlers, and a view with added countries offers no other pairs.

## What gets indexed

- A pair is listed when the two share a land border, are both among the biggest countries, or both big in one region: `data/site/compare-pairs.json` from `tools/site/compare-pairs.ts`, 1,874 pairs (`compare/pairs.ts`). Any other pair renders with `noindex, follow`.
- A listed pair's measure page: both countries' own pages for the measure are indexed (`INDICATOR_INDEX`), the two have values in at least 10 of the same years (`COMMON_YEARS`), and its title can name both countries and the measure in 60 characters, with the measure's `short` label if need be (`pairMeasureIndexed` in `compare/compare-copy.ts`). The last rule leaves out 71 pages of 8 pairs of long names, such as Central African Republic and Congo - Brazzaville.
- A listed pair's overview: five of its measure pages indexed (`pairIndexed`).
- Every measure's world page.
- `compare/compare.test.ts` checks every indexed comparison's and world page's title (60 characters at most, each its own) and description (110 to 160).

The comparisons go into the place sitemaps' chunks (`places/sitemap.ts`, from `compare/sitemap.ts`, kept for 30 seconds since every chunk asks); `/compare` and the world pages are in `/sitemap.xml`. Share cards are the place pages' (`/og?place=compare/<pair>[/<measure>]`, `world/<measure>`; `compare/card.ts`).

## Copy

Every sentence is worked out from the two series (`compare-copy.ts`, `world.ts`): what is estimated, observed (ERA5) or modelled (CMIP6) is said as such, as on the country pages, and projections are named by their publisher and scenario. Ranks are said only where neither country shares its place. A source's own marks stay on the chart and in the table: SIPRI's estimates as dots and its highly uncertain figures as rings.
