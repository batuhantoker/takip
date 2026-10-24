# Shorts

Short vertical videos (1080 × 1920, 30 fps) for YouTube Shorts, Instagram Reels and TikTok, filmed from the
running app. Each has a voiceover and captions in any of the ten UI languages. Built 2026-10-20 in
`tools/shorts`. It needs:
- the app (`npm run dev`);
- Claude, which writes and translates the words: Fable 5.1 through the Claude Code CLI on the Mac (`claude -p`, the
  user's sign-in; the user's pick on 2026-10-22, when `aws login` kept expiring overnight). `SHORTS_LLM=bedrock` uses
  Claude Opus 5.5 on Amazon Bedrock instead (the AWS credential chain, `us-east-1` unless `AWS_REGION` says otherwise),
  and `SHORTS_LLM_MODEL` overrides the model either way;
- the AI-models panel's Speech service (`~/Developer/personal/AI-models`), which reads the words. Voice and
  filming stay on the Mac.

```sh
npm run shorts -- list
npm run shorts -- ideas                               # today's situations first, each with its make command
npm run shorts -- auto --count 3 --lang all           # make the top ideas
npm run shorts -- make deep-time                      # English
npm run shorts -- make deep-time --lang tr,de         # or --lang all
npm run shorts -- make deep-time --script-only        # write the scripts, edit them, then run without it
npm run shorts -- make deep-time --seconds 8          # the first 8 seconds, for a quick look
npm run shorts -- library                             # every story's script, under data/shorts/library
npm run shorts -- make chronicle --preset cold-war --day library --lang tr   # film a library story
npm run shorts -- remix library/chronicle-preset-cold-war   # new soundtrack (music) under videos already filmed
```

`--no-music` leaves the music out of `make` or `remix`.

## The format (2026-10-21, lengths 2026-10-22)

The user's brief, in their words: short ("should be short content mostly not very long"), fun ("not for phd"), with the
details on screen ("show details"), a hook that hypes the app ("Takip has everything and more"), and endless, looping
videos ("at the end takip promotion should be connected to entry"). Then, on 2026-10-22: "loops can be slightly longer, it
is a variation right I dont want full of those", "20-25 secs", and "on X I believe there is no replay, so its posts should
not be looping". The literal "TAKIP has everything, and more" was the user thinking out loud, not copy ("so cringe",
2026-10-22): the hooks are ours to write, as cold opens that work on their own.

Two shapes, told apart by `"loop"` in `timeline.<lang>.json`:

- **Short = a 20–25 s loop** (the default): hook, beats, and a bridge back into the hook, as below.
- **Long = a 40–60 s closed cut** (`--length long`): the same hype hook, more beats, and no bridge. The last line is the
  tagline "See the world live or in the past on TAKIP." (`loop.ts` `TAGLINE`), captioned over the last shot wherever it
  is, then the takip.dev end card for about 2 s while the music fades out (`narrate/mix.ts`). Nothing flies back to the
  opening. It needs no new writing, so a long cut whose lines are cached re-films without AWS. For X, the queue cuts a
  non-looping copy of a short from the hook's word timings in the timeline.

- **Hook** (no card): a hype line from `narrate/style.ts` `LOOPS`, a cold open that works on its own ("Nobody believes
  this map is free."), then the model's "today" ("Today, life's biggest turning points."). Captioned like every line,
  over the opening view, from about 0.3 s.
- **Middle:** a tour shows one detail: today's strongest quake, one counted spot, one space stop or the whole orbit of a
  followed object, with the item's own card or popup opened through the app's click handler (`PICKS` in
  `stories/feature.ts`). A plane's card is always of one in the air (over about 1,000 ft and 60 kt) and a ship's of one
  under way, never one parked or moored; each spot closes the last card first (`closeCards` in `loop.ts`; the phone's
  sheet only closes through the dev handle `__takipInspect`). A History page's tour (`stories/history-tour.ts`) closes the
  phone's History sheet (`__takipPanel`), runs the clock across the page's years (the app's own time bar shows the date;
  an overlay counter beside it disagreed, since the bar redraws on its own throttle), and on
  `country-data-over-time` colours the map by life expectancy into the UN projection with one country's value as a chip.
  A History page with no years of its own runs through its subject's chronicle (`CHRONICLED`: the WWII map through
  `ww2-europe`), and its long cut flies to each stop at its date. No short draws massacres, genocides, pogroms or expulsions
  (`stories/kept-out.ts`: tours, chronicles and borders scenes alike), and no borders story tells Tibet or Kosovo (`UNTOLD`), whose comings and goings are contested.
  A story tells three stretches or stops, each with a fact chip under the title: the event the line names (by a year
  among the biggest, else a year and a word of its title, as "2004 … Sumatra"), or the country's biggest change.
- **Outro** of a short (no end card): the bridge half of the same `LOOPS` pair, a sentence the hook finishes ("It's called
  TAKIP, and" → "nobody believes this map is free."); most bridges name TAKIP. It closes any open
  card, returns the clock and camera to the opening (`loop.ts`, `window.__loopStart`), and shows takip.dev and the
  sources in a lower third. The music bed's tail is crossfaded into its head (`narrate/mix.ts`), so the seam isn't heard.
- **Length:** a short runs 20–25 s, tours and stories alike. A story tells four stretches (three where its lines were
  written for the old ≤20 s short), each held for its share of about 16 s (`loop.ts` `shortHold`); a tour holds its one
  detail about 13 s, opening a second card where it opens cards. Where the folder already has the long cut's lines, the
  short takes that cut's opening instead: the hook, as many of its beats as fit in 25 s (two at least) at a short's pace
  (one card a spot), and the loop's outro (`make.ts`, `loop.ts` `trimmed`), so it films without new writing. Hype lines
  run 6–10 words, "today" at most 6. The narrator is sped to 1.15× (`narrate/voice.ts` `TEMPO`, in the cache key).
- **Clock:** an events stretch runs its clock in the first 40% of the beat and holds at the stretch's end, so the year on
  screen is never behind the event the line names; its chip appears then.
- **Measures** leave out territories under 250,000 people (they led every "biggest change" by noise), give the year one
  of the top three passes another inside a stretch ("In 2022, India passes China"), and say projected years are projected
  ("the UN projects…"); the writer is asked again until every projected line does. Every line names a year inside its
  stretch ("By 2000, …"), or viewers can't tell when anything happened. A preset's `phrasing` refuses a misleading
  wording: life expectancy, never how long people lived; Maddison's GDP said once as 2011 dollars. `smooth` averages a
  swinging measure (temperature) over five years.
- **Chronicles** show the date only with a stop's title, never on the hook or outro, where the clock sits 120 days before
  the first stop; a title stays up at least 1.8 s after the camera lands.
- **History cards:** a History tour flies to its page's top event (by physical size, else picked by hand in
  `stories/spotlight.ts`), runs the clock to its date and opens its card through `__takipOpenEvent`; while it is open the
  film strips its death rows, photo and article (`TRIM_CARD`). Space tours open on a lit view (the solar system, or the
  Sun for the solar system), never the Earth from space, which can face its night side. `TOUR_SPOTS` and `TOUR_SETUP` in
  `feature.ts` give a page spots and film-only restyling where its own don't read on a phone (the undersea cables).
- **Long cuts need two stops:** a long tour whose page gives fewer fails before any writing (a page with no spots made a
  "long" cut of its wow alone). Space pages get more stops when long; the hiking tour pans along famous trails
  (`stories/trails.ts`), each chosen where a click names the trail itself.
- **No death tolls** (GUIDELINES § Topics: tragedies stay plain). Events lines and chips tell a hazard by its physical
  size (magnitude, explosivity, water height, wind), and the writer is asked again over any toll word (`tollIn`);
  chronicles may name one death but never mass deaths by a number or as "most" (`chronicleToll`).
- **Event counts** come from the dataset a preset's coverage names (`counted` in `presets/events.ts`), canonical rows
  only: the Wikipedia year pages retell many dataset events without being merged, and counted twice they put SIPRI's
  2,051 explosions at 2,164.
- **Live tours** retry their feed and fail if it never answers, so the queue tries again rather than film without facts.
  The queue re-films at any hour, so a tour's counts are told as of its filming: each spot is recounted, a changed count is
  swapped into its line (with its spoken form, `narrate/numbers.ts`, so no new writing) and kept in the folder, and a spot
  that has dropped under 10 in view fails the film ("film it nearer that hour"). Text that isn't a count (today's strongest
  quake) stays as written, so such a tour is filmed the day its facts were taken.
- **Captions** take turns between a bottom band (63%) and a top band (18% on a tour, under the app's bar; 42% on a
  story, under its counter, title and chip), beat by beat, with a small nudge within a band (`timeline.ts`, the user's
  "top and bottom rotating"). A beat with a card open at the bottom takes the top band; the last beat is in the bottom
  band like the hook, so the loop's seam doesn't jump.
- **Long cut** (`--length long`, the user, 2026-10-21: "long content is also good"; posts alternate short and long): a
  tour adds a wow line and up to four spots with two cards each, topped up from the day's busiest views of its feed
  ("Around Dallas", named for a city of 200,000 or more from `data/db/geo-index.db`) when the page's own are empty; a story tells five stretches, a chronicle all its stops,
  deep time five chapters. About 40–60 s, same hook and rules, closed (above). It keeps its own caches (`cache.*.long.json`), and a
  script whose beats don't match the cut is rewritten (the old one kept as `script.en.replaced.json`). Like `--variant`,
  it stays out of the folder name.
- **Chronicle pins:** each stop is pinned and labelled (`place`, `pin` in `presets/chronicles.ts`) with the route from the
  last stop, so a stop at sea or on ice still shows where it is. The globe draws nothing past ±85°.
- **Rotation:** `LOOPS` holds 8 pairs, picked by a hash of the folder name, or `--variant N` (0–7) when the queue sets
  one per row so neighbouring posts differ.

## What it makes

| Id | Kind | What |
|---|---|---|
| `deep-time` | story | The plates from Pangaea to today, told by History's deep time documentary. `--chapters 252,201,66,50,34,0` (ages in Ma) picks the chapters; a short keeps the first three that aren't Today, on 3 s runs, to stay under 20 s. |
| `borders` | story | History's world borders as a time-lapse over a region, with the year counting. Use `--preset ottoman`, `rome`, `europe-20th`, `mongols`, `americas`, `africa`, `balkans`, `china`, `india` or `middle-east`, or set `--from 1300 --to 1923 --at lat,lon,zoom --label "…"`. The words are written only from the states the border data has in view at five sampled years: which are on the map, which are new and which are gone, alphabetical. Nothing is ranked by size or screen share, and no state joins or takes another, because those read as territorial claims; `bordersProblem` rejects lines that do, or that call a state gone while it is still in view. A state counts only where it shows on screen (the query returns whole tiles, which once named Tokugawa Japan in a Southeast Asia story), and a preset's `region` (Africa, Europe, Southeast Asia, East Asia, South Asia, Iran, Arabia, West Africa, the caliphates' lands) keeps only states whose part on screen mostly lies in it, so neighbours at the frame's edge stay out. A state gone and a new one on the same ground, at a similar size and sharing a name's root, are told as renamed (Kingdom of Portugal → Portuguese Republic); ground alone would call a successor a rename. Lines never count states, since the frame never holds a whole continent. Where the dataset itself misleads (a state missing for a year, a protectorate folded into an empire), the line is trimmed by hand in the folder's `cache.lines*.json`. A state that only leaves the frame while it still exists elsewhere (`worldNames`) is "out of" the region, never gone. A preset's `short` or `long` years replace even sampling where the borders only move in a few years (`central-europe-90s`, `persia`). |
| `chronicle` | story | Dated stops on History's map. Presets in `stories/presets/chronicles.ts`: `ww2-america` (Poland 1939, Lend-Lease, Pearl Harbor, Germany's declaration of war, D-Day, Hiroshima), `ww1`, `turkish-independence`, `ottoman-rise`, `cold-war`, `discovery`, `rome`, `mongols`. Dates use astronomical years (`-48-01-10` is 49 BCE); fetching the facts checks each year against its article's lead and warns when the lead doesn't mention it. Each stop flies to its place while the clock runs from the previous date, so the borders change month by month on the way. It switches between the WWII layer (Europe) and world borders (Pacific). The counter shows the date, and the words come only from each stop's Wikipedia lead. A preset is a list of stops (`id`, `date`, `at`, `layer`, `wiki`, `title`) in `stories/chronicle.ts`. |
| `events` | story | An event family running over the years on History's map, from `data/db/history.db`, so it works only where that file is. The globe turns to what each stretch's line talks about (`focus` in `stories/facts.ts`): the biggest event whose year it says, else the first place it names, else the densest part. Looking only at the densest part held nuclear tests on Nevada for 50 years while the narrator talked about Novaya Zemlya and Lop Nor. Presets in `stories/presets/events.ts`: `nuclear-tests` (SIPRI, 1945–1998), `hazards-1900` (NOAA NCEI quakes, tsunamis and eruptions), `disasters` (GDIS, 1960–2018), `border-changes` (Correlates of War, 1816–2018). Counts, top places and the biggest events per stretch are counted in `stories/facts.ts`. A line with a stretch's count names the stretch ("From 1957 to 1979, …", or "the 1960s"), and any other names its event's year (`undatedIn`). The clock's speed is set so an event stays drawn about three seconds. |
| `measure` | story | Countries coloured by a History measure through the years, continuing into the publisher's projection. The "UN projection" title comes up as the counter passes the last estimated year (a beat's `titleAt`), even partway through a stretch. Presets in `stories/presets/measures.ts`: `population`, `fertility`, `median-age`, `life-expectancy` (UN WPP 2024, 1950–2100), `cities` (UN WUP, to 2050), `democracy` (V-Dem, 1900–2025). Rankings, world totals, the biggest change per stretch (where the camera flies) and countries past a threshold are computed from `/api/replay/history/series/<metric>` and `<metric>.proj`. A colour key shows the scale; its top is the 98th percentile, marked "+". Event pins are switched off. |
| `feature` | tour | One feature as its `/map/<slug>` page opens it (`--page earthquakes`), filmed in the phone interface. The link always names its layers (the base two when the page has none), or the filming profile's defaults would show. A space page (`?view=space`) opens on the Earth in the space view and flies out through its stops (`takip:world` events): the Moon, Mars or the Sun, or the solar system on the way to the stars. `night-sky` leaves the map for the Earth from space and the solar system, since the sky around the map's globe is too faint on a phone. A globe page with no spots turns slowly. A tap on Layers, then a flight to each of the page's spots. For ships, aircraft, fires and cameras it counts the layer's points in each spot's view and skips a spot with fewer than 10, and with none left it stays on the page's own view. Feeds don't reach everywhere, and skies empty at night: aisstream had no ships at the Bosphorus on 2026-10-21, and Le Bourget had two jets that evening. The words come from that page alone: heading, lede, what it shows, spots, and the page's live line. Its sources are credited on the end card, not read out: spoken, they made the tours dull (user, 2026-10-21). For earthquakes they also include each spot's count in the last day. |
| `feature` + situation | tour | The same tour leading with what is happening: `--fact "…" --at lat,lon,zoom --label "…" --name …`. `ideas` writes these for today's biggest quake (M5.5+), an active tropical cyclone, a geomagnetic storm (Kp 6+) or a launch in the next 24 hours. It takes the facts word for word from the feeds. |
| `intro` | tour | What TAKIP is, for the launch post (2026-10-21): flights over Europe, ships at Rotterdam, quakes, the temperature map and London's cameras, each switched on alone, then a tap into History with world borders running 1900–2000. Every shot's layer is on in the opening link so its data has loaded before filming; `setup` then leaves only the opening ones. The words come from those `/map` pages. History needs the accounts api on :4100 (`/api/replay` goes through it); without it the borders come back HTTP 500 and film blank. |

**The library** (`npm run shorts -- library`, `tools/shorts/library.ts`) writes the English script of every story and
preset to `data/shorts/library/<id>/`. It also writes a `README.md` listing each story's title, hook, lines, sources and
the command that films it. Nothing is filmed. Filming with `--day library` reuses that folder's facts and words. Tours
are left to `ideas`.

`ideas` ranks today's situations first, then deep time if it has not been made, then the History pages, then
every other feature not yet made (rotating daily). It skips any short that has been filmed (a folder with an `.mp4`). `auto` makes the
top `--count` and carries on past one that fails.

Output goes to `data/shorts/<day>/<id>/` (gitignored):

| File | What |
|---|---|
| `<lang>.mp4` | The video: H.264, AAC, loudness −14 LUFS |
| `<lang>.jpg` | A cover frame (1.2 s in, the hook card) |
| `<lang>.post.txt` | Title, description, hashtags and sources, to paste when posting |
| `script.<lang>.json` | Every word said or shown. Edit freely: a run keeps an existing file and re-voices changed lines |
| `scene.json`, `timeline.<lang>.json` | What was filmed, and when each beat and word falls |
| `cache.*.json` | Data and wording a story fetched or wrote once, so a re-render tells the same thing |
| `voice/<lang>/` | One clip per line (named by a hash of its words) with its check, `narration.wav`, and `mix.wav` (the soundtrack) |
| `music.wav`, `cache.music.json` | The story's music bed and the brief it was made from |

Nothing is posted anywhere: uploading is by hand.

**Voice.** Every writer adds `narrate/style.ts`: the user's brief (2026-10-21) is entertainment, "not for phd". Lead with
the striking part, short punchy lines, no how-it-works, spec lists, refresh rates or spoken sources; every fact still comes
from the data. Tours run hook → one or two wow facts → the spots → "go try it", about 30 s.

## How a short is made

1. **Scene.** A story or tour (`tools/shorts/stories/`, listed in `registry.ts`) builds a `Scene` (`scene.ts`):
   - the app path to open, and whether to show only the map (`map-only`, for stories) or the whole interface
     (`app`, for tours);
   - a list of **beats**. A beat is one spoken line plus the page JavaScript to run as it starts (`enter`) or on
     every frame (`frame`), and the time its picture needs (`minMs`, e.g. a camera leg);
   - an optional **counter**, a number read from the page every frame: a count (deep time's "252 million years
     ago"), a year (`kind: 'year'`, "300 BCE"), or a date (`kind: 'date'`, epoch ms, "7 Aralık 1941");
   - sources and post text.

   The first beat is usually the hook card and the last the end card.
2. **Scripts.** `script.en.json` comes from the scene. Every other language is translated by Claude
   (`narrate/llm.ts`, `narrate/script.ts`).
   - It records the lines it was written from (`written`). When the scene's lines change (a line fixed in a story's
     `cache.lines*.json`), it is written anew and the old one kept as `script.en.stale.json`, unless it was edited by hand
     since, which only warns. Fix lines in the cache, so a long and a short cut of one folder both get them.
   - The model is `anthropic.claude-opus-5-5`; set `SHORTS_LLM_MODEL` to change it.
   - The local models were dropped: they turned "three quarters" into "a third" in Turkish, and "{n} million"
     into "{n}万" (ten thousands) in Japanese.
   - The counter's unit is checked like a line: `{n}` stands for the same bare number in every language, so its
     scale must not change.
   - `scriptProblem` rejects a translation that drops a beat, a title or the `{n}` of the counter's unit.
   - A second pass reads each line against the English as a native editor would. It translates again any line
     that changed a fact or reads badly, and prints what it fixed.
3. **Voice** (`narrate/voice.ts`): each line is spoken by the panel's Speech service, then read back through
   Whisper.
   - The read-back finds where speech starts and ends in the clip, and scores the take by character error rate
     on letters (so "200" heard for "two hundred" costs little).
   - A take above 0.35 is redone up to twice, keeping the best, with a warning if it stays above.
   - Japanese uses Kokoro's own voice: Chatterbox garbled it.
   - Speech starts on demand through the panel (`POST :7860/api/tts/start`).
4. **Timeline** (`timeline.ts`, tested): each beat lasts the longer of its line (with lead and tail) and its
   `minMs`, plus a hold for the end card.
   - Captions are cut into cards of at most five words (twelve characters in Chinese and Japanese). Chinese
     and Japanese are split into words by `Intl.Segmenter`.
   - Word highlights are spread over the measured speech by word length. That is close enough to follow the
     voice, and it works in every script, where Whisper's own word times are unreliable for ja, zh and ar.
5. **Music** (`narrate/music.ts`, `narrate/mix.ts`): each story gets its own instrumental bed.
   - Claude writes a one-line brief from the story: upbeat electronic at 115–125 BPM with drums from the first second and a
     synth hook (the user, 2026-10-21), synthwave for space, house for live data, electro-pop for history, minor-key and
     restrained for deaths, disasters and war. The seed comes from the story's id, so no two shorts sound alike. A brief
     without the current `style` is remade with its music.
   - The Speech service makes 32 s of it with MiniMax Music 3 (`POST :8880/v1/audio/music`). It is made once per
     story and shared by every language.
   - The mix sets the bed at 0.18 before ducking. A sidechain compressor dips it while the narrator speaks, it loops if
     the model ended it early, and it has no fades: its last 0.6 s is laid under its first, so the loop's seam isn't heard. The whole track is normalised to −14 LUFS at 48 kHz.
   - Replace `music.wav` with any track and run `remix` to use it instead.
6. **Film** (`capture/`): headless Chrome with a 432 × 768 page at 2.5× (a phone layout, 1080 × 1920 pixels).
   - Before any page script runs, `virtual-clock.js` takes over the page's timers, `requestAnimationFrame`,
     `Date`, `performance.now` and Web Animations, and counts requests in flight.
   - Once the view is ready the clock is frozen. For every frame the renderer then:
     1. advances time by exactly 1/30 s;
     2. runs the beat's page code and draws the overlay for that instant;
     3. waits until the map has loaded its tiles and no request younger than 10 s is open (at most 8 s);
     4. takes a JPEG and pipes it to ffmpeg with the narration track.
   - Camera flights, History's clocks, framer-motion and CSS transitions all land on exact frames however long
     a frame takes to capture. About 9 frames are filmed per second, so a 45 s short takes 2–3 minutes per
     language.
7. **Overlay** (`capture/overlay.js`): hook card, counter (the unit's words before `{n}` go above the number and
   the rest below, so "hace … millones de años" reads in order), beat title, captions with the word being said in the
   accent colour, the TAKIP wordmark with the first source, and the end card ("takip.dev" and all sources).
   - It keeps no clock: `frameAt` (timeline.ts) gives it each frame's state.
   - Platform buttons cover the bottom fifth and the right edge, so nothing that matters sits there.
   - Arabic runs right to left.

A frame is ready when the style and its tiles have loaded and no request younger than 10 s is open. A scene's
`waitOn` narrows that to the requests it draws from: History stories wait on `/api/replay/`, not on the live feeds
the app keeps polling. It does
not wait for `map.loaded()`, which a layer that restyles itself every frame keeps false. When a frame hits the
cap, the run prints what held it.

The browser (`capture/browser.ts`) answers the map-time, usage-action, page-view and report calls itself, so a
render spends no one's minutes and adds nothing to Admin → Analytics. It uses a throwaway profile, with the UI
language set by the `takip-lang` cookie.

Taps are scheduled by frame number. Comparing times in ms put one on both sides of a frame boundary, so it
fired twice and undid itself. A tap with `expect` waits up to 20 s in real time for that state, because a
panel's first open compiles its code on the dev server. `SHORTS_TRACE="<page expression>"` logs a value every
frame.

## What the app provides

Dev builds only (`NODE_ENV=development`), next to the existing `window.__takipMap`:
- `window.__takipHistory`: the History session, from `useHistory().open()`;
- `window.__takipReplay`: the Replay session, from `useReplay().toggle()`;
- `window.__takipLayers`: the map's layer setter, `(prev => next)`, to switch layers between shots.

The phone tab bar's buttons carry `data-tab="<id>"` (`layers`, `history`, `ai`…), so a tour finds them in any
language.

A scene opens its view with the map's own links (`?view=history&year=…`, `?view=deep&ma=…`, `lat`/`lon`/`zoom`,
`layers=`) and drives it through those handles. Deep time uses the documentary: `story.go(i, ms)` runs the clock
and camera to chapter i in `ms`, and `legMs` (exported from `lib/history/paleo/story.ts`) is the run time a reader gets.

## Adding a story or tour

Write a `Maker` in `tools/shorts/stories/<id>.ts` and add it to `registry.ts`.
- `ctx.once(name, fn)` keeps fetched data and model-written wording in the short's folder.
- `ctx.args` holds the command line's own options (`--chapters 252,66,0`), and `ctx.base` the app's address.
- `--name` sets the folder; without it the folder is the id and its options.
- Use the app's real data and say where it comes from; nothing simulated (as everywhere in TAKIP).

## Limits

- Live layers that animate on their own (satellites, wind, replay tracks) follow the virtual clock. Video
  elements (camera feeds) play in real time, so a frame shows them wherever their stream is.
- The voice is a stand-in until a recording replaces `models/tts/voices/narrator.wav` in AI-models. Voice clips
  are cached by their words and the narrator clip's version, so a new recording re-voices every line.
- Audio sync was checked on 2026-10-20: the English deep-time cut, transcribed from the finished MP4, put every
  line within ±0.3 s of the timeline, with no drift over 62 s. That margin is Whisper's own word timing.
- The basemap's place names follow the UI language where the style has them.
