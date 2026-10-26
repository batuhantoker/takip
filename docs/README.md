# Docs

| Start here | |
|---|---|
| [`roadmap.md`](roadmap.md) | Open work, and the decisions already taken |
| [`design/README.md`](design/README.md) | How TAKIP looks, reads and behaves. Every screen follows it |
| [`architecture/README.md`](architecture/README.md) | The data model and rules, plus an index of the architecture docs |
| [`self-hosting.md`](self-hosting.md) | Docker, CasaOS and API keys |

| Reference | |
|---|---|
| [`cctv-adding-sources.md`](cctv-adding-sources.md) | Adding or fixing a camera source |
| [`architecture/geolocation.md`](architecture/geolocation.md) | Placing history events on the map: the offline index of Wikipedia, Wikidata, GeoNames and Pleiades places (`data/db/geo-index.db`), the resolver, and its benchmark against known coordinates |
| [`architecture/wikipedia-years.md`](architecture/wikipedia-years.md) | Dated events from Wikipedia's year pages in ten languages: fetch, placement by the articles each bullet links, duplicates, and the benchmark behind the accepted methods |
| [`architecture/code-map.md`](architecture/code-map.md) | What each src/lib domain, component group and API route family holds, and who uses it |
| [`architecture/embeds.md`](architecture/embeds.md) | The live map the public pages frame: `/embed/<slug>` and `/embed?…`, the spec a URL carries, past windows (earthquakes over any area and period) and how it scales to place-and-period pages |
| [`architecture/shorts.md`](architecture/shorts.md) | Short vertical videos filmed from the app with a voiceover in ten languages: `npm run shorts`, how a frame is stepped, adding a story or tour |
| [`architecture/public-pages.md`](architecture/public-pages.md) | What search engines and link previews see: share-link metadata, the `/map` layer pages, `/about`, the site address |
| [`architecture/place-pages.md`](architecture/place-pages.md) | City and country pages (`/city/cincinnati/transit`): the gazetteer, topic tables, how to add a topic, what gets indexed |
| [`architecture/compare-pages.md`](architecture/compare-pages.md) | Two countries side by side (`/compare/greece-vs-turkey/life-expectancy`) and each History measure around the world (`/map/life-expectancy`): what they say and what gets indexed |
| [`space-view.md`](space-view.md) | The space view: what is built, decisions, where the code is, what is left |
| [`data-sources.md`](data-sources.md) | Candidate public data sources, and how to choose one |
| [`inspiration-sources/`](inspiration-sources/README.md) | Sources and features surveyed in World Monitor, Provenance, Argus, God's Eye View and NASA Worldview |
| [`architecture/native-apps.md`](architecture/native-apps.md) | The iOS, Android, Windows, macOS and Linux apps: shells around takip.dev, sign-in through the system browser, downloads, CI |
| [`runbooks/app-stores.md`](runbooks/app-stores.md) | Publishing the apps: Google Play, the App Store, desktop signing, takip.dev/download, each release |
| [`runbooks/app-db-restore.md`](runbooks/app-db-restore.md) | Restoring `app.db` from a snapshot |
| [`runbooks/nuc.md`](runbooks/nuc.md) | The NUC deployment: services, link, updating |
| [`privacy-draft.md`](privacy-draft.md) | Draft privacy text for accounts; not live |
| [`../data/reference/README.md`](../data/reference/README.md) | The reference map data files |

`docs/data/` is not documentation: it holds the raw downloads that `tools/import/` reads (gitignored, several GB).

Older docs still cite `CCTV-handoff.md`, `INSPIRATION.md` and `docs/brain-storming.md`, which were removed in `722face`. Read them with `git show 722face^:<path>`. The old `TODO.md` and `BACKEND-handoff.md` were merged into `roadmap.md`.
