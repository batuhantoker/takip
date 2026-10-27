# Space expansion

The brief: 3D views of Mars, the Moon, the stars and more, and NASA APIs to track spacecraft.

## What is built

**One space view, not a planet switcher.** The view strip at the bottom left reads *Map | Earth · Moon · Mars · Sun · System · Stars · Galaxy · Universe*. *Map* is the live Earth map. Any other choice leaves the map: the camera starts over the map's own centre, pulls out, and flies to the target. Everything sits in one heliocentric scene at true scale and at its real position now. `Esc` or *Map* flies home: the camera arcs back to Earth from wherever it is (rising between two far-apart close views, coming straight down from far out) and lands on the map's own globe. If the map was zoomed in, it was first put back on the whole globe under the space view, and it flies back down to where it was as the space view fades. With reduced motion it is a plain fade. Anything that moves the map (search, an alert, a dossier) leaves with a plain fade too.

**The wheel does it all.** Zooming out past the whole globe hands the map over to space: Earth opens at the globe's exact size, tilt and side, with north up, and the camera carries on outward. Keep zooming and it passes the planets, the heliopause and the Oort cloud, through the nearest stars to the Milky Way, the Local Group, the cosmic web and the edge of the observable universe; the switcher lights up each stop as it goes. The zoom is log-scale and speeds up the longer the wheel is held, so the twenty-odd orders of magnitude take seconds. Zooming back in with the pointer near the middle retraces the way home (galaxy → Sun → Earth → map); pointing at something off-centre (a planet, a craft, a star) and zooming goes to it instead. The space view is fetched while the globe is nearly whole and fades in only once Earth is ready, so the hand-over has no blank frame. On the way back the map takes over just inside its zoom floor, at the same size and side, and the space view fades out held on the map's camera, so the wheel carries straight on into the map. MapLibre's globe keeps its zoom floor at one globe size, so the floor it reports sinks with latitude (`minZoom + log2(cos lat)`); the hand-back allows for that.

- **Earth** keeps its satellite layer: the whole CelesTrak catalogue at true altitude, so the GEO ring and the GPS shells are visible. Blue Marble by day, Black Marble city lights by night, split by the real Sun direction.
- **Moon and Mars** are textured globes (LRO WAC mosaic; Viking MDIM 2.1), the texture and the landing sites fetched only once the body is a few pixels across on screen, so the solar system opens without them. Each is oriented from where Horizons says the Sun and Earth stand overhead on it, so the terminator and the Earth-facing side are the real ones. On them: landing sites, Perseverance and Curiosity with their full drive paths, and each orbiter at its altitude with its arc either side of now.
- **Sun**: the latest SDO 171 Å frame from Helioviewer, as the disc seen from Earth.
- **System**: every planet's orbit and every spacecraft JPL Horizons can place now, about 150 of them, from L1 and L2 out to Voyager. Each cruising craft draws the past year as a trail. A click on an orbit, a dwarf planet's path or a craft's trail picks what is on it: its card opens, its orbit brightens, and if it is out of view the camera turns to it (`src/lib/space/scene/hud/pick-orbit.ts`). Wheel zooming ignores the lines, or every turn near an orbit would head for its planet.
- **Earth map sky** (layer *Stars & Planets*, on by default): real bright stars, Orion, the Big Dipper, the Southern Cross and Cassiopeia, the Sun, the Moon in its current phase, and the planets, behind the globe. They are drawn through MapLibre's own globe matrix, so they turn with the real sky. They fade out as the map zooms in, except the stars a city sky shows (to about magnitude 3.5) and the names of the fifteen brightest, which stay in the sky above a tilted map. Once MapLibre's globe has gone flat (zoom 12, or 9 with terrain) those are drawn in the local sky over the map's centre instead, with nothing below the horizon. The map tilts to 88° (past about 90° MapLibre's camera sinks under the flat map's plane), so a street-level view shows the first 16° or so above the horizon. From zoom 3.5 to 5.5 the satellites seen against the sky fade to a trace, so they don't bury the stars; over the whole globe they stay as its halo.
- **Past Neptune**: the dwarf planets (Eris, Haumea, Makemake, Gonggong, Quaoar, Sedna, Orcus) with their orbits, and the three interstellar visitors, 1I/ʻOumuamua, 2I/Borisov and 3I/ATLAS, on their real paths through the solar system, 1990–2060. Behind them, 8,300 centaurs and trans-Neptunian objects from the Minor Planet Center, each placed by its orbit today.
- **Heliosphere** (model, marked *illustration*): the termination shock and the heliopause, nose into the interstellar wind and fitted through the four points where the Voyagers crossed them, which are marked.
- **Oort cloud**: rings at one light-day, -week, -month and -year, the Sun's gravitational focus at 550 AU, and the Oort cloud as random points (illustration).
- **Stars**: 12,807 stars as real 3D points, every Yale Bright Star to magnitude 5.5 at its Hipparcos distance and every Gaia DR3 star within 100 light-years. Each star's brightness is worked out from the camera's position, so from the Sun the sky is the familiar one and away from it the near stars swell, the constellation figures come apart and the Sun becomes a star among them. Stars with known planets (NASA Exoplanet Archive) wear a ring while they are within about 200 light-years of the camera; a click opens a star card with its planets. Named stars are labelled while they look brighter than magnitude 4.5 from where the camera is.
- **The galaxy around the Sun**: 213,141 more Gaia DR3 stars, drawn dimmer, from 100 light-years out to about 21,600: a random sample with parallaxes good to 10% within about 10,800 light-years, and a third of the giants and hot young stars (absolute G brighter than −1) good to 20%, which reach further. They fade in from 50 light-years out and are gone by the Galaxy stop. Dust hides most of the far stars in the plane, so the field thins along it.
- **Deep sky**: 45 telescope pictures of nebulae, clusters, galaxies and both black holes ever imaged (the Pillars of Creation, Orion, the Crab, Carina's Cosmic Cliffs, Andromeda, the Magellanic Clouds, the Whirlpool, Stephan's Quintet, Webb's First Deep Field and more). Each hangs at its object's distance, square to the line of sight from the Sun, as large and turned as it is on the sky, placed by the picture's own astrometry; from Earth's side it covers exactly what the telescope saw. Depth is unknown, so each is flat, faded out when seen edge on or from behind. The famous ones are labelled from the Stars stop out, with a marker until the picture is big enough to see; a card's *Fly here*, and zooming at one, flies round to Earth's side and frames the picture upright as published. Pictures load only when they are big enough on screen, first as a 512 px rendition (`<id>.small.jpg`, also the card's picture) and in full only while over about 480 px, so the textures near the Sun take about 80 MB instead of 165. The Local Group galaxies with a picture (LMC, SMC, M31, M33) drop their glow for it, and so do M32 and M110 inside Andromeda's; those whole-galaxy cut-outs keep only a soft ellipse round the galaxy, so no square of sky or foreground star hangs out there with them.
- **Search**: the map's search box also finds things in space by name, in English or the reader's language (planets, spacecraft, every pictured nebula and galaxy, Laniakea and the other basins, the CMB); picking one opens the space view and flies there, from the map or from space (`src/components/shell/search/space-hits.ts`).
- **How it works**: on entering space (zooming out past the globe, the switcher or a link) a one-time *Learn how it works* offer opens a six-stop tour of the view; the ? in the Space layers header brings it back.
- **Galaxy**: NASA SVS's Milky Way sky behind the stars from inside; from outside, R. Hurt's face-on Milky Way (illustration), placed so its Sun and Sagittarius A* land on the real ones. Past it, the Magellanic Clouds, Andromeda, Triangulum and a dozen other Local Group galaxies at their catalogued positions and sizes.
- **Universe**: every 2MASS Redshift Survey galaxy (43,463, out to about a billion light-years), 179,000 SDSS galaxies and 120,000 quasars out to redshift 6, placed in 3D by their redshifts, with the named clusters and superclusters labelled; and around it all the cosmic microwave background (ESA Planck, SMICA, 10′ detail) on the last-scattering surface, 45.3 billion light-years out. The shell is drawn as two halves so it looks the same whichever way the camera turns: its inside before the galaxies, and from outside its near half after them, as glass, clear in the middle and solid at the rim. Drawn as one see-through mesh, whichever half its triangles reached last painted over the other, and the shell changed as the camera turned; the map is mipmapped, with the mip level taken across the RA wrap so no seam shows. From inside it would wrap the whole sky in false colour and hide everything in front of it, so it only comes up as the camera nears the shell (from about 20 billion light-years), less saturated until it is close; from outside it is a quieter globe. The *Universe* stop opens 22 billion light-years out, inside it: the surveyed universe in the middle of the quasar supervoids, the shell just coming up behind.
- **Cosmic web**: 15,421 filament spines traced through SDSS DR8 (Tempel et al. 2014) as faint threads, and 531 voids of SDSS DR7 (Douglass et al. 2023, V2/VIDE, Planck 2018) as their fitted ellipsoids. Only the voids named on screen are outlined, as thin grey rims: the four biggest-looking whose centre is in view and whose outline fits on screen, easing in and out as they change, and the picked one. Drawn all at once, 4,345 of them were a foam of blue circles over everything and 4.7 million triangles; a void is not drawn from inside. Over the whole sky, the 27 great voids between the rich clusters of the supercluster network (Einasto et al. 1994) are drawn as spheres across their narrowest width, and billions of light-years out, 3,762 supervoids among the Gaia Quaia quasars (Arsenov et al. 2025, the clear ones: density ratio over 1.2, off the survey edge) as spheres of their volume, from 1.5 billion light-years out. The 563 SDSS superclusters over 30 h⁻¹ Mpc across (Liivamägi et al. 2012) glow warm at their size; the ones holding a named structure carry its name (the Sloan Great Wall's richest part). Around the Local Group, the 25 nearest voids (Pustilnik et al. 2019, within 25 Mpc over the whole sky) are drawn as ellipsoids spanning their extents along the supergalactic axes and named by their constellations (the Hercules Void, the Ophiuchus–Sagittarius–Capricornus Void that holds the Local Void's near part); the Local Void itself is a label at Tully's centre, with no outline. Past 250 million light-years the gravitational basins of the Cosmicflows-4 velocity field (Dupuy & Courtois 2023) come in as glowing surfaces: Laniakea, our home supercluster, gold, with the Sun inside it near its edge; around it the Apus, Hercules, Lepus, Perseus–Pisces and Shapley basins, dimmer; and the Sculptor Void, a basin of repulsion, in the voids' grey. They are the watersheds traced on the published 128³ grid (7.8 h⁻¹ Mpc cells), so their edges are approximate. Through each run streamlines of the same velocity field, brightening toward the attractor (or leaving the Sculptor repeller), with dashes travelling the way matter moves; the dashes show direction, not speed. A picked void or basin lights up, its flows with it. The outlined voids are labelled with their size, Boötes and the nearest voids by name; a click opens the void's card and lights it, a card's *Fly here* (or zooming at one) stands back to see it whole from the Sun's side. The wheel slows to about half pace from 40 million to 2 billion light-years out, so the web is seen rather than flown through.
- **Zone of Avoidance**: the Milky Way hides the galaxies behind its plane, and 2MRS leaves out the band within 5° of it (8° toward the centre). That band is filled with stand-ins, dimmer, copied in from the strips just above and below as Erdoğdu et al. (2006) filled it; they are an illustration, shown with the illustrations and labelled so.
- **Flight replay** (a craft's card → *Watch the flight*, or ▶ beside it in the Space panel): the craft's whole Horizons trajectory, through today into JPL's prediction, with the planets where they were.
  - **Launch**: the replay starts on the real pad at the real lift-off minute, from a table of all 65 craft taken from Wikipedia and checked against Horizons. The climb up to where JPL's track begins is drawn, and tagged *Illustrated ascent*.
  - **Timeline and camera**: the timeline marks launch, flybys, arrivals, landings, the Voyagers' boundary crossings and now. Playback slows by itself through each encounter. The camera follows, closing in on whatever the craft is passing and standing back during the long coasts.
  - **Flybys** are found automatically and fetched in fine steps around closest approach. Voyager 1 passes Jupiter at 348,000 km on 1979-03-05, and New Horizons passes Pluto on 2015-07-14 at 11:49 UTC, as flown.
  - **Orbiters**: while a craft stays with a body, its samples are days apart, far longer than one orbit. So an orbiter is carried along its two-body orbit from JPL's nearest planet-relative state, and that orbit is drawn round the planet (MRO, LRO, Juno).
  - **Landers** are held on the surface as the planet turns, using the IAU rotation model. Landings get a minute-by-minute stretch of their own (Curiosity: 2012-08-06 05:19 UTC).
  - **L1 and L2 craft** draw their track in the Sun–Earth rotating frame, so JWST's halo orbit is a loop beyond Earth.
  - **The Sun** is a plain disc during a replay, since SDO's frame shows today's Sun.
- **Past missions**: 17 finished missions whose whole flight Horizons still keeps, though they are no longer in the fleet: Artemis II and I, Cassini, Rosetta, MESSENGER, Galileo, Deep Impact, Stardust, Deep Space 1, NEAR Shoemaker, Genesis, Phoenix, Venus Express, Akatsuki, GRAIL (Ebb), LADEE and Mars Pathfinder (`src/lib/space/craft/past-missions.ts`). They are listed under *Past missions* in the Space panel, each a click from its replay, with a card of its own; each was checked to replay end to end. Hayabusa, Lunar Prospector and ICE were left out: Horizons keeps only part of their flights. The fleet's history warm-up stores their flights once, so their /spacecraft pages have a timeline.
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
| `src/lib/space/scene/` | The three.js scene: `space-scene.ts` runs it; `camera/rig.ts` and `camera/zoom-anchor.ts` drive the camera and the wheel; `tiers.ts` fades each scale in and out by distance and sets the wheel's pace; `craft/flight-replay.ts` and `craft/model.ts` draw a replay; `deep/deep-sky.ts` hangs the telescope pictures, `deep/galactic-stars.ts` draws the Gaia field, `deep/cosmic-web.ts` the voids and filaments |
| `src/lib/space/deep/` | The data behind those: `deep-sky.ts` (objects, astrometry maths), `cosmic-web.ts`, `galactic-stars.ts`, `cosmos.ts` (with the Zone of Avoidance fill) |
| `src/components/panels/space/replay/` | The replay bar and its data hook |
| `src/lib/space/` | Pure maths and tables: `frames` and `wiki-topic` at the root; `replay/` (`two-body`, `planets-approx`, `flight-history`, `model`); `craft/` (`launches`, `models`) |
| `src/app/api/(space)/space/` | The routes; `history/collect.ts` builds a replay |
| `src/components/map/interaction/hooks/use-zoom-past-globe.ts`, `src/lib/space/globe-match.ts` | The hand-over between map and space; the `GlobeLink` the space view reads and moves the map through |
| `src/lib/space/scene/camera/fly-path.ts` | The zoom-and-pan arc (van Wijk & Nuij) the flight home follows |
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
| `/api/space/history/[id]` | Horizons: one craft's whole ephemeris span on a coarse grid, plus fine stretches of the craft and the body around every encounter, and the body's exact track through long stays. Kept in `.cache/space-history/v7/<id>.json` (`TAKIP_SPACE_HISTORY_DIR`); bump `VERSION` in `history/store.ts` when the `CraftHistory` shape changes. After each fleet sweep every replayable craft not yet stored is fetched behind map views; any other craft in Horizons' catalogue on its first replay | ended flights once; live ones refetched in the background after 12 h on replay, 7 days otherwise |
| `src/lib/space/craft/launches.ts` | Lift-off time, pad and vehicle for each craft, from each craft's Wikipedia infobox; pad coordinates from the pad's article | by hand |
| `src/lib/space/craft/models.ts`, `public/data/models/` | NASA Science 3D Resources glTF files: 28 loaded from assets.science.nasa.gov (which allows cross-origin loading), and SOHO and STEREO-A copied from the nasa/NASA-3D-Resources repository. Most are Draco-compressed; three's decoder is copied to `public/vendor/draco/` | static |
| `public/data/sky/bright-stars.json` | Yale Bright Star Catalogue (CDS V/50), built by `tools/build-bright-stars.mjs` | static |
| `public/data/sky/nearby-stars.json` | Gaia DR3 within 100 ly, Hipparcos-2 distances for the bright stars, via the ESA Gaia archive TAP; built by `tools/build-nearby-stars.mjs` | static |
| `public/data/sky/milky-way-sky.jpg` | NASA SVS Deep Star Maps 2020, starless Milky Way layer; built by `tools/build-milky-way-sky.mjs` | static |
| `public/data/sky/milky-way-face-on.jpg` | NASA/JPL-Caltech/R. Hurt, ssc2008-10a1 (PIA10748) | static |
| `public/data/cosmos/{local,deep}-galaxies.bin`, `cosmos.json` | 2MRS (CDS J/ApJS/199/26) and SDSS DR17 SkyServer, comoving distances in flat ΛCDM (Planck 2018); built by `tools/build-cosmos.mjs`. The deep file (4.8 MB) loads only when the camera nears that scale | static |
| `public/data/cosmos/cmb.jpg` | ESA Planck 2015 SMICA map (Nside 1024, 10′) from IRSA's Planck archive, reprojected from HEALPix to 4096×2048 by `tools/build-cmb.mjs`; WMAP's ILC map, used before, is smoothed to 1° and was a blur filling the sky | static |
| `public/data/sky/galactic-stars.bin` | Gaia DR3 through the ESA Gaia archive's async TAP (`MAXREC`; sync and plain async stop at 50,000 rows); built by `tools/build-galactic-stars.mjs`. Loads once the camera is 30 light-years out | static |
| `public/data/sky/deep/<id>.jpg`, `src/lib/space/deep/deep-sky.generated.ts` | ESA/Webb, ESA/Hubble, ESO and NOIRLab pictures (CC BY 4.0) with the astrometry from each image page's WorldWide Telescope link (its reference pixel's y counts from the bottom, as in FITS); whole galaxies cut from DSS2 colour by CDS hips2fits (free for non-commercial use) and masked to an ellipse from their D25 diameters. Built by `tools/build-deep-sky.mjs`; names, distances and notes in `src/lib/space/deep/deep-sky.ts` | static |
| `public/data/cosmos/web.bin` | VizieR: Douglass et al. 2023 (J/ApJS/265/7) voids, Einasto et al. 1994 (J/MNRAS/269/301, B1950 turned to J2000) and Arsenov et al. 2025 (J/A+A/706/A362, comoving distances from Quaia's redshifts) voids, Tempel et al. 2014 (J/MNRAS/438/3465) filaments, turned from h⁻¹ Mpc into equatorial Mly with build-cosmos's h; the filament points are stored as 16-bit steps (0.06 Mly), which halves the file to 1.9 MB. Tempel's axes are SDSS survey ones (x toward RA 95°, y and z turned 32.5° about x); checked by the filaments falling on the galaxies, best against 3° turns and 5% rescalings. The 25 nearest voids are Pustilnik et al. 2019 (J/MNRAS/482/4329), their distances D = V/73 turned to h⁻¹ Mpc. Built by `tools/build-cosmic-web.mjs`, which also writes `superclusters.json` (Liivamägi et al. 2012, J/A+A/539/A80); both load with the 2MRS galaxies | static |
| `public/data/cosmos/basins.bin`, `src/lib/space/deep/basins.generated.ts` | Dupuy & Courtois 2023 (A&A 678, A176): the CF4 galaxy basins of attraction and repulsion, 128³ voxels 1000 h⁻¹ Mpc across, supergalactic, indexed [z][y][x], from `CF4_new_128-z008_watersheds-fits.zip` on the Cosmicflows project page (unreachable in October 2026; the Wayback copy is used). Laniakea and its five neighbours, and the Sculptor Void, are the voxels joined to each attractor (a few stray specks dropped), blurred and meshed by surface nets, turned from supergalactic to equatorial and into Mly with build-cosmos's h. The build checks that every attractor in the paper's table 1 falls in its own basin and the Sun in Laniakea. The streamlines follow the reconstruction's velocity cube (Courtois et al. 2023, Zenodo record 20653238), which is stored [component][x][y][z], the other way round from the basin grids: read so, 99% of test streamlines end in their own basin, under any other axis order or sign at most a third. Each converges on a sink a voxel or two from the paper's tabulated attractor; the build fails if fewer than 60% of a basin's lines get within 3.5 voxels of it. Built by `tools/build-cosmic-web.mjs`; loads with the web | static |

Horizons answers 502/503 when one client sends more than a couple of requests at once. All calls share two slots, and map views go ahead of the sweep. It also returns 502 to Node's fetch when a `TLIST` URL passes about 1.5k characters, so epochs are sent as start/stop/step grids.

## What is not done

**Fleet and replays**

- **Ended ephemerides**: craft whose Horizons ephemeris has ended are not in the fleet. They are not drawn live, even when the craft still works (Perseverance's ends Feb 2026, MAVEN's Mar 2026; the rovers come from MMGIS instead). Finished missions are listed for replay under *Past missions*; a craft still working but off the fleet (MAVEN) is not.
- **Slow first replay**: a craft not stored yet, such as one the warm-up has not reached on a fresh install, takes 10–40 s of Horizons calls.
- **No writable store on a host**: the Docker image's `/app/.cache` is not writable by its user (nor on a serverless host), so flights stay in memory and every restart refetches them. A deploy needs a writable volume there, or `TAKIP_SPACE_HISTORY_DIR` on one.
- **Burns**: between samples an orbiter follows a two-body orbit, so burns that fall between them are not seen (orbit insertions, trims). Only the orbit at the moment shown is drawn, not the earlier ones.
- **Planets in a replay** come from JPL's mean orbital elements between encounters (arcminutes off for Jupiter and Saturn), and from Horizons through each encounter.
- **Ascent**: the ascent is drawn, not measured.
  - Four craft whose ephemeris begins long after launch get no ascent.
  - Five whose ephemeris begins before launch, on a back-propagated orbit, are trusted only from an hour after lift-off (TGO from 12 h).
- **Models**:
  - **No free model**: the European, Japanese, Indian, Korean and UAE craft, Psyche, Lucy, IMAP, ESCAPADE, the smaller NASA missions and the Tesla Roadster stay as dots.
  - **Europa Clipper**: its model is 36 MB, over the 15 MB cap (`MAX_MODEL_BYTES` in `scene/craft/placement.ts`).
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

1. **Manoeuvres and orbit history.**
   - Find burns as jumps in orbital energy between neighbouring samples; `history/collect.ts` already has the planet-relative states.
   - Fetch a fine stretch around each burn, as for an encounter, and mark it on the timeline (orbit insertion, trajectory corrections).
   - Give orbiters a faint trail of their last few orbits.
2. **More and better models.**
   - **ESA models**: ESA publishes 3D models of many of its craft. Wire them in with their terms noted in a code comment, as done for other sources.
   - **Europa Clipper**: re-compress its model (gltf-transform with Draco or meshopt) to fit under the 15 MB cap.
   - **Ulysses**: size it by its body rather than by the wire antenna.
   - **Dish axes**: look up the high-gain antenna axis for the rest of the NASA models.
3. **Real attitude.** NAIF publishes attitude kernels (CK) for most NASA missions, keyless. A build-time tool could reduce them to a coarse attitude track per craft, so the model turns as flown instead of pointing its dish at Earth. This is a larger piece of work; start with one craft, such as Juno.
4. **Animated events.** Deployments, engine burns and instrument pointing were floated as a "simulation". NASA's files are mostly static meshes with no named moving parts, so this means editing models craft by craft. Decide the scope before starting.
5. **Live view.**
   - **Time slider**: a time slider for the whole scene; the replay model can already place the planets for any date.
   - **Textures**: Mercury, Ceres and Vesta from Trek.
   - **Sun channels**: a switch between them.
   - **Asteroids**: close approaches from `cad.api`.
6. **Deep sky.**
   - **Star motion**: apply proper motion.
   - **ξ UMa**: place it from the original Hipparcos parallax.
   - **Nearby galaxies**: use distances measured without redshift (Cosmicflows-4, or NED-D via CDS) within about 50 million light-years.
   - **Exoplanet payload**: trim it.
7. **More deep sky.**
   - **The Local Void's outline**: only its label is placed. At 7.8 h⁻¹ Mpc a cell the Cosmicflows-4 density grid is too coarse to outline it (δ is only about −0.25 at its centre), and no catalogue gives its shape.
   - **Galaxies placed by measured distance**: the pictured galaxies use measured distances, but the 2MRS points around them are placed by redshift, so near ones sit apart from their pictures (see *Nearby galaxies are misplaced*).
8. **A smoke test in the repo.** The zoom round trip and the replays were checked with headless Chrome scripts kept outside the repo; the round trip takes 96 wheel steps from 1.9 billion light-years back to the map. `tools/preview-smoke.mjs` already drives headless Chrome with no dependencies, so it could gain these two runs: map → Universe → map, and one replay through a flyby.
