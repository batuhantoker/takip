# Space expansion

The brief: 3D views of Mars, the Moon, the stars and more, and NASA APIs to track spacecraft.

## What is built

**One space view, not a planet switcher.** The view strip at the bottom left reads *Map | Earth · Moon · Mars · Sun · System · Stars · Galaxy · Universe*. *Map* is the live Earth map. Any other choice leaves the map: the camera starts over the map's own centre, pulls out, and flies to the target. Everything sits in one heliocentric scene at true scale and at its real position now. `Esc` or *Map* flies home: the camera arcs back to Earth from wherever it is (rising between two far-apart close views, coming straight down from far out) and lands on the map's own globe. If the map was zoomed in, it was first put back on the whole globe under the space view, and it flies back down to where it was as the space view fades. With reduced motion it is a plain fade. Anything that moves the map (search, an alert, a dossier) leaves with a plain fade too.

**The wheel does it all.** Zooming out past the whole globe hands the map over to space: Earth opens at the globe's exact size, tilt and side, with north up, and the camera carries on outward. Keep zooming and it passes the planets, the heliopause and the Oort cloud, through the nearest stars to the Milky Way, the Local Group, the cosmic web and the edge of the observable universe; the switcher lights up each stop as it goes. The zoom is log-scale and speeds up the longer the wheel is held, so the twenty-odd orders of magnitude take seconds. Zooming back in with the pointer near the middle retraces the way home (galaxy → Sun → Earth → map); pointing at something off-centre (a planet, a craft, a star) and zooming goes to it instead. The space view is fetched while the globe is nearly whole and fades in only once Earth is ready, so the hand-over has no blank frame. On the way back the map takes over just inside its zoom floor, at the same size and side, and the space view fades out held on the map's camera, so the wheel carries straight on into the map. MapLibre's globe keeps its zoom floor at one globe size, so the floor it reports sinks with latitude (`minZoom + log2(cos lat)`); the hand-back allows for that.

- **Earth** keeps its satellite layer: the whole CelesTrak catalogue at true altitude, so the GEO ring and the GPS shells are visible. Blue Marble by day, Black Marble city lights by night, split by the real Sun direction.
- **Moon and Mars** are textured globes (LRO WAC mosaic; Viking MDIM 2.1). Each is oriented from where Horizons says the Sun and Earth stand overhead on it, so the terminator and the Earth-facing side are the real ones. On them: landing sites, Perseverance and Curiosity with their full drive paths, and each orbiter at its altitude with its arc either side of now.
- **Sun**: the latest SDO 171 Å frame from Helioviewer, as the disc seen from Earth.
- **System**: every planet's orbit and every spacecraft JPL Horizons can place now, about 150 of them, from L1 and L2 out to Voyager. Each cruising craft draws the past year as a trail.
- **Earth map sky** (layer *Stars & Planets*, on by default): real bright stars, Orion, the Big Dipper, the Southern Cross and Cassiopeia, the Sun, the Moon in its current phase, and the planets, behind the globe. They are drawn through MapLibre's own globe matrix, so they turn with the real sky. They fade out as the map zooms in, except the stars a city sky shows (to about magnitude 3.5) and the names of the fifteen brightest, which stay in the sky above a tilted map. Once MapLibre's globe has gone flat (zoom 12, or 9 with terrain) those are drawn in the local sky over the map's centre instead, with nothing below the horizon. MapLibre tilts at most 85°, so a street-level view shows only the first 13° or so above the horizon.
- **Past Neptune**: the dwarf planets (Eris, Haumea, Makemake, Gonggong, Quaoar, Sedna, Orcus) with their orbits, and the three interstellar visitors, 1I/ʻOumuamua, 2I/Borisov and 3I/ATLAS, on their real paths through the solar system, 1990–2060. Behind them, 8,300 centaurs and trans-Neptunian objects from the Minor Planet Center, each placed by its orbit today.
- **Heliosphere** (model, marked *illustration*): the termination shock and the heliopause, nose into the interstellar wind and fitted through the four points where the Voyagers crossed them, which are marked.
- **Oort cloud**: rings at one light-day, -week, -month and -year, the Sun's gravitational focus at 550 AU, and the Oort cloud as random points (illustration).
- **Stars**: 12,807 stars as real 3D points, every Yale Bright Star to magnitude 5.5 at its Hipparcos distance and every Gaia DR3 star within 100 light-years. Each star's brightness is worked out from the camera's position, so from the Sun the sky is the familiar one and away from it the near stars swell, the constellation figures come apart and the Sun becomes a star among them. Stars with known planets (NASA Exoplanet Archive) wear a ring; a click opens a star card with its planets.
- **Galaxy**: NASA SVS's Milky Way sky behind the stars from inside; from outside, R. Hurt's face-on Milky Way (illustration), placed so its Sun and Sagittarius A* land on the real ones. Past it, the Magellanic Clouds, Andromeda, Triangulum and a dozen other Local Group galaxies at their catalogued positions and sizes.
- **Universe**: every 2MASS Redshift Survey galaxy (43,463, out to about a billion light-years), 179,000 SDSS galaxies and 120,000 quasars out to redshift 6, placed in 3D by their redshifts, with the named clusters, superclusters and voids labelled; and around it all the cosmic microwave background (NASA WMAP) on the last-scattering surface, 45.3 billion light-years out.
- **Flight replay** (a craft's card → *Watch the flight*, or ▶ beside it in the Space panel): the craft's whole Horizons trajectory, through today into JPL's prediction, with the planets where they were.
  - **Launch**: the replay starts on the real pad at the real lift-off minute, from a table of all 65 craft taken from Wikipedia and checked against Horizons. The climb up to where JPL's track begins is drawn, and tagged *Illustrated ascent*.
  - **Timeline and camera**: the timeline marks launch, flybys, arrivals, landings, the Voyagers' boundary crossings and now. Playback slows by itself through each encounter. The camera follows, closing in on whatever the craft is passing and standing back during the long coasts.
  - **Flybys** are found automatically and fetched in fine steps around closest approach. Voyager 1 passes Jupiter at 348,000 km on 1979-03-05, and New Horizons passes Pluto on 2015-07-14 at 11:49 UTC, as flown.
  - **Orbiters**: while a craft stays with a body, its samples are days apart, far longer than one orbit. So an orbiter is carried along its two-body orbit from JPL's nearest planet-relative state, and that orbit is drawn round the planet (MRO, LRO, Juno).
  - **Landers** are held on the surface as the planet turns, using the IAU rotation model. Landings get a minute-by-minute stretch of their own (Curiosity: 2012-08-06 05:19 UTC).
  - **L1 and L2 craft** draw their track in the Sun–Earth rotating frame, so JWST's halo orbit is a loop beyond Earth.
  - **The Sun** is a plain disc during a replay, since SDO's frame shows today's Sun.
- **Spacecraft models**: the craft in focus (replayed, selected or followed) is drawn as NASA's own 3D model where one exists, for 37 of the 65 craft. The model never shrinks below 7% of the view's height, and is drawn at true size when the camera is close enough. The 9 craft whose high-gain antenna axis is known turn it to face Earth.
- **Pictures**: every inspect card (craft, planets, stars, galaxies, clusters) carries the matching Wikipedia article's picture and lead, and the replay bar the craft's picture.
- **Space panel** (sidebar → Space): every tracked craft grouped by where it is, with distance and light time and a button to replay its flight; the stars with known planets, nearest first; the ISS live feed. A click flies there.

## Decisions taken

- **Beyond the solar system** (2026-10-12):
  - **Illustrations**: the heliopause, the Oort cloud and the Milky Way's arms are models, not measurements. They show by default, faint and labelled *illustration*.
  - **Sky background**: NASA SVS's map (public domain), not Gaia's map (CC BY-SA).
  - **Stops**: the switcher gained two stops, *Stars* and *Galaxy*. *Universe* was added later on top of those two; it can be dropped.
- **Replays**:
  - **Look**: NASA's 3D models where they exist and Wikipedia pictures for the rest, rather than a separate simulation.
  - **Ascent**: anything drawn rather than measured, like the ascent, is labelled as such.

## Where the code is

| Path | What it holds |
|---|---|
| `src/lib/space/scene/` | The three.js scene: `space-scene.ts` runs it; `rig.ts` and `zoom-anchor.ts` drive the camera and the wheel; `tiers.ts` fades each scale in and out by distance; `flight-replay.ts` and `craft-model.ts` draw a replay |
| `src/components/panels/space/replay/` | The replay bar and its data hook |
| `src/lib/space/` | Pure maths and tables: `frames`, `two-body`, `planets-approx`, `flight-history`, `replay-model`, `launches`, `craft-models`, `wiki-topic` |
| `src/app/api/space/` | The routes; `history/collect.ts` builds a replay |
| `src/components/map/interaction/hooks/use-zoom-past-globe.ts`, `src/lib/space/globe-match.ts` | The hand-over between map and space; the `GlobeLink` the space view reads and moves the map through |
| `src/lib/space/fly-path.ts` | The zoom-and-pan arc (van Wijk & Nuij) the flight home follows |
| `tools/build-*.mjs` | The static sky and cosmos files |

## Data (all keyless)

| Endpoint | Source | Refresh |
|---|---|---|
| `/api/space/sky` | JPL Horizons vectors: Sun, Moon, planets, Pluto, hourly for a day | 3 h |
| `/api/space/fleet` | Horizons' own spacecraft catalogue (`COMMAND='MB'`), one query per craft | 6 h sweep; partial on a cold start |
| `/api/space/surface/{moon,mars}` | Horizons observer tables (ground tracks, sub-solar and sub-Earth points); NASA MMGIS rover files | 1 h; rovers 3 h |
| `/api/space/texture/{earth,earth-night,moon,mars}` | NASA GIBS and NASA Trek tiles, stitched | static |
| `/api/space/sun[/channel]` | Helioviewer (SDO/AIA, SDO/HMI, SOHO/LASCO) | 10 min |
| `/api/space/outer` | Horizons: dwarf planets now, interstellar visitors' paths; MPC `Distant.txt` orbits | 24 h |
| `/api/space/exoplanets` | NASA Exoplanet Archive TAP, `pscomppars`, grouped by host | 24 h |
| `/api/space/wiki` | Wikipedia REST summary (lead and picture), by title or by search with a word of context | 24 h |
| `/api/space/history/[id]` | Horizons: one craft's whole ephemeris span on a coarse grid, plus fine stretches of the craft and the body around every encounter, and the body's exact track through long stays. Cached as `space:history:v7:<id>`; bump the version when the `CraftHistory` shape changes | 12 h |
| `src/lib/space/launches.ts` | Lift-off time, pad and vehicle for each craft, from each craft's Wikipedia infobox; pad coordinates from the pad's article | by hand |
| `src/lib/space/craft-models.ts`, `public/data/models/` | NASA Science 3D Resources glTF files: 28 loaded from assets.science.nasa.gov (which allows cross-origin loading), and SOHO and STEREO-A copied from the nasa/NASA-3D-Resources repository. Most are Draco-compressed; three's decoder is copied to `public/vendor/draco/` | static |
| `public/data/sky/bright-stars.json` | Yale Bright Star Catalogue (CDS V/50), built by `tools/build-bright-stars.mjs` | static |
| `public/data/sky/nearby-stars.json` | Gaia DR3 within 100 ly, Hipparcos-2 distances for the bright stars, via the ESA Gaia archive TAP; built by `tools/build-nearby-stars.mjs` | static |
| `public/data/sky/milky-way-sky.jpg` | NASA SVS Deep Star Maps 2020, starless Milky Way layer; built by `tools/build-milky-way-sky.mjs` | static |
| `public/data/sky/milky-way-face-on.jpg` | NASA/JPL-Caltech/R. Hurt, ssc2008-10a1 (PIA10748) | static |
| `public/data/cosmos/{local,deep}-galaxies.bin`, `cosmos.json` | 2MRS (CDS J/ApJS/199/26) and SDSS DR17 SkyServer, comoving distances in flat ΛCDM (Planck 2018); built by `tools/build-cosmos.mjs`. The deep file (4.8 MB) loads only when the camera nears that scale | static |
| `public/data/cosmos/cmb.jpg` | NASA WMAP 9-year ILC map from LAMBDA, reprojected from HEALPix by `tools/build-cmb.mjs` | static |

Horizons answers 502/503 when one client sends more than a couple of requests at once. All calls share two slots, and map views go ahead of the sweep. It also returns 502 to Node's fetch when a `TLIST` URL passes about 1.5k characters, so epochs are sent as start/stop/step grids.

## What is not done

**Fleet and replays**

- **Ended ephemerides**: craft whose Horizons ephemeris has ended are not in the fleet. They are not drawn live, even when the craft still works (Perseverance's ends Feb 2026, MAVEN's Mar 2026; the rovers come from MMGIS instead). They cannot be replayed either (Cassini, Artemis I).
- **Slow first replay**: the first replay of a craft takes 10–40 s of Horizons calls; after that it is cached.
- **Cold start**: on a cold server the fleet sweep is partial, and the history route answers 404 "Not in the tracked fleet" for craft the sweep has not reached yet.
- **Burns**: between samples an orbiter follows a two-body orbit, so burns that fall between them are not seen (orbit insertions, trims). Only the orbit at the moment shown is drawn, not the earlier ones.
- **Planets in a replay** come from JPL's mean orbital elements between encounters (arcminutes off for Jupiter and Saturn), and from Horizons through each encounter.
- **Ascent**: the ascent is drawn, not measured.
  - Four craft whose ephemeris begins long after launch get no ascent.
  - Five whose ephemeris begins before launch, on a back-propagated orbit, are trusted only from an hour after lift-off (TGO from 12 h).
- **Models**:
  - **No free model**: the European, Japanese, Indian, Korean and UAE craft, Psyche, Lucy, IMAP, ESCAPADE, the smaller NASA missions and the Tesla Roadster stay as dots.
  - **Europa Clipper**: its model is 36 MB, over the 15 MB cap (`MAX_MODEL_BYTES` in `space-scene.ts`).
  - **Ulysses** looks small because its span is set by its 72 m wire antenna.
  - **Orientation**: only 9 craft are turned (dish to Earth). No craft's real attitude is used.

**Live view**

- **Moon ground tracks**: ARTEMIS P1/P2 cannot be used as a Horizons observer, so they have no ground track over the Moon.
- **Earth-orbit craft** in the Horizons list are not drawn in space; the satellite layer already has them all.
- **Time**: there are time controls only inside a flight replay; the live view is always now.
- **Textures**: only the Moon and Mars have them. Mercury and Ceres are on Trek and could follow.
- **Sun channels**: the other channels (304 Å, HMI, LASCO) are served but cannot yet be picked in the view.
- **Asteroids**: JPL's close-approach API (`ssd-api.jpl.nasa.gov/cad.api`) is keyless and probed, but not wired in.

**Deep sky**

- **Star motion**: stars do not move. The catalogue is fixed at Gaia's epoch (2016), and proper motion is not applied.
- **ξ UMa** (about 27 ly) has no Hipparcos-2 parallax, so it sits at the 3,000 ly placeholder with 69 others. The original Hipparcos parallax could place it.
- **Local Group**: its galaxies are glows sized to their diameters, not images.
- **Nearby galaxies are misplaced**: galaxies are placed by redshift alone. Within about 50 million light-years the galaxies' own motions outweigh the expansion, so the nearest are misplaced (Centaurus A sits at 26 rather than 12 million light-years).
- **Exoplanet payload**: `/api/space/exoplanets` sends 747 KB.

## Next

In order of what most improves what users see:

1. **Replay finished missions.** Horizons keeps finished trajectories, for example Cassini to 2017-09-15, Artemis I, Rosetta, MESSENGER and Galileo; check each one's span first.
   - Keep a hand-made list of past missions with their spans.
   - Let `/api/space/history/[id]` accept any craft Horizons can place within its span, not only the live fleet. That also ends the cold-start 404.
   - List them in the Space panel under *Past missions*.
2. **Manoeuvres and orbit history.**
   - Find burns as jumps in orbital energy between neighbouring samples; `history/collect.ts` already has the planet-relative states.
   - Fetch a fine stretch around each burn, as for an encounter, and mark it on the timeline (orbit insertion, trajectory corrections).
   - Give orbiters a faint trail of their last few orbits.
3. **More and better models.**
   - **ESA models**: ESA publishes 3D models of many of its craft. Wire them in with their terms noted in a code comment, as done for other sources.
   - **Europa Clipper**: re-compress its model (gltf-transform with Draco or meshopt) to fit under the 15 MB cap.
   - **Ulysses**: size it by its body rather than by the wire antenna.
   - **Dish axes**: look up the high-gain antenna axis for the rest of the NASA models.
4. **Real attitude.** NAIF publishes attitude kernels (CK) for most NASA missions, keyless. A build-time tool could reduce them to a coarse attitude track per craft, so the model turns as flown instead of pointing its dish at Earth. This is a larger piece of work; start with one craft, such as Juno.
5. **Faster first replay.**
   - Warm the history cache during the 6 h fleet sweep, at low priority behind map views.
   - Or commit static history files for flights whose past no longer changes (Voyager, Pioneer, New Horizons).
6. **Animated events.** Deployments, engine burns and instrument pointing were floated as a "simulation". NASA's files are mostly static meshes with no named moving parts, so this means editing models craft by craft. Decide the scope before starting.
7. **Live view.**
   - **Time slider**: a time slider for the whole scene; the replay model can already place the planets for any date.
   - **Textures**: Mercury, Ceres and Vesta from Trek.
   - **Sun channels**: a switch between them.
   - **Asteroids**: close approaches from `cad.api`.
8. **Deep sky.**
   - **Star motion**: apply proper motion.
   - **ξ UMa**: place it from the original Hipparcos parallax.
   - **Nearby galaxies**: use distances measured without redshift (Cosmicflows-4, or NED-D via CDS) within about 50 million light-years.
   - **Local Group**: give its galaxies images.
   - **Exoplanet payload**: trim it.
9. **A smoke test in the repo.** The zoom round trip and the replays were checked with headless Chrome scripts kept outside the repo; the round trip takes 96 wheel steps from 1.9 billion light-years back to the map. `tools/preview-smoke.mjs` already drives headless Chrome with no dependencies, so it could gain these two runs: map → Universe → map, and one replay through a flyby.
