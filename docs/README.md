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
| [`architecture/code-map.md`](architecture/code-map.md) | What each src/lib domain, component group and API route family holds, and who uses it |
| [`space-view.md`](space-view.md) | The space view: what is built, decisions, where the code is, what is left |
| [`data-sources.md`](data-sources.md) | Candidate public data sources, and how to choose one |
| [`inspiration-sources/`](inspiration-sources/README.md) | Sources and features surveyed in World Monitor, Provenance, Argus, God's Eye View and NASA Worldview |
| [`runbooks/app-db-restore.md`](runbooks/app-db-restore.md) | Restoring `app.db` from a snapshot |
| [`runbooks/nuc.md`](runbooks/nuc.md) | The NUC deployment: services, link, updating |
| [`privacy-draft.md`](privacy-draft.md) | Draft privacy text for accounts; not live |
| [`../data/reference/README.md`](../data/reference/README.md) | The reference map data files |

`docs/data/` is not documentation: it holds the raw downloads that `tools/import/` reads (gitignored, several GB).

Older docs still cite `CCTV-handoff.md`, `INSPIRATION.md` and `docs/brain-storming.md`, which were removed in `722face`. Read them with `git show 722face^:<path>`. The old `TODO.md` and `BACKEND-handoff.md` were merged into `roadmap.md`.
