# Shorts

Short vertical videos (1080 × 1920, 30 fps) for YouTube Shorts, Instagram Reels and TikTok, filmed from the
running app. Each has a voiceover and captions in any of the ten UI languages. Built 2026-10-20 in
`tools/shorts`. It needs:
- the app (`npm run dev`);
- Claude Opus 5.5 on Amazon Bedrock, which writes and translates the words. It uses the AWS credential chain
  (`aws login` on the Mac), and `us-east-1` unless `AWS_REGION` says otherwise;
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

## What it makes

| Id | Kind | What |
|---|---|---|
| `deep-time` | story | The plates from Pangaea to today, told by History's deep time documentary. `--chapters 252,201,66,50,34,0` (ages in Ma) picks the chapters. |
| `borders` | story | History's world borders as a time-lapse over a region, with the year counting. Use `--preset ottoman`, `rome`, `europe-20th`, `mongols`, `americas`, `africa`, `balkans`, `china`, `india` or `middle-east`, or set `--from 1300 --to 1923 --at lat,lon,zoom --label "…"`. The words are written only from the states the border data has in view at five sampled years. |
| `chronicle` | story | Dated stops on History's map. Presets in `stories/presets/chronicles.ts`: `ww2-america` (Poland 1939, Lend-Lease, Pearl Harbor, Germany's declaration of war, D-Day, Hiroshima), `ww1`, `turkish-independence`, `ottoman-rise`, `cold-war`, `discovery`, `rome`, `mongols`. Dates use astronomical years (`-48-01-10` is 49 BCE); fetching the facts checks each year against its article's lead and warns when the lead doesn't mention it. Each stop flies to its place while the clock runs from the previous date, so the borders change month by month on the way. It switches between the WWII layer (Europe) and world borders (Pacific). The counter shows the date, and the words come only from each stop's Wikipedia lead. A preset is a list of stops (`id`, `date`, `at`, `layer`, `wiki`, `title`) in `stories/chronicle.ts`. |
| `events` | story | An event family running over the years on History's map, from `data/db/history.db`, so it works only where that file is. The globe turns to the densest part of each stretch. Presets in `stories/presets/events.ts`: `nuclear-tests` (SIPRI, 1945–1998), `hazards-1900` (NOAA NCEI quakes, tsunamis and eruptions), `disasters` (GDIS, 1960–2018), `border-changes` (Correlates of War, 1816–2018). Counts, top places and the biggest events per stretch are counted in `stories/facts.ts`. The clock's speed is set so an event stays drawn about three seconds. |
| `measure` | story | Countries coloured by a History measure through the years, continuing into the publisher's projection. Projected stretches are titled "UN projection". Presets in `stories/presets/measures.ts`: `population`, `fertility`, `median-age`, `life-expectancy` (UN WPP 2024, 1950–2100), `cities` (UN WUP, to 2050), `democracy` (V-Dem, 1900–2025). Rankings, world totals, the biggest change per stretch (where the camera flies) and countries past a threshold are computed from `/api/replay/history/series/<metric>` and `<metric>.proj`. A colour key shows the scale; its top is the 98th percentile, marked "+". Event pins are switched off. |
| `feature` | tour | One feature as its `/map/<slug>` page opens it (`--page earthquakes`), filmed in the phone interface. A tap on Layers, then a flight to each of the page's spots. The words come from that page alone: heading, lede, what it shows, sources, freshness, spots, and the page's live line. For earthquakes they also include each spot's count in the last day. |
| `feature` + situation | tour | The same tour leading with what is happening: `--fact "…" --at lat,lon,zoom --label "…" --name …`. `ideas` writes these for today's biggest quake (M5.5+), an active tropical cyclone, a geomagnetic storm (Kp 6+) or a launch in the next 24 hours. It takes the facts word for word from the feeds. |

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
2. **Scripts.** `script.en.json` comes from the scene. Every other language is translated by Claude on
   Bedrock (`narrate/llm.ts`, `narrate/script.ts`).
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
   - Claude writes a one-line brief from the story (genre, instruments, tempo, mood, no vocals), and the seed comes
     from the story's id, so no two shorts sound alike.
   - The Speech service makes 90 s of it with MiniMax Music 3 (`POST :8880/v1/audio/music`). It is made once per
     story and shared by every language.
   - The mix sets the bed at 0.18 before ducking. A sidechain compressor dips it while the narrator speaks, it fades
     in and out, and it loops if the model ended it early. The whole track is normalised to −14 LUFS at 48 kHz.
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
- `window.__takipReplay`: the Replay session, from `useReplay().toggle()`.

The phone tab bar's buttons carry `data-tab="<id>"` (`layers`, `history`, `ai`…), so a tour finds them in any
language.

A scene opens its view with the map's own links (`?view=history&year=…`, `?view=deep&ma=…`, `lat`/`lon`/`zoom`,
`layers=`) and drives it through those handles. Deep time uses the documentary: `story.go(i)` runs the clock
and camera to chapter i, and `legMs` (exported from `lib/history/paleo/story.ts`) tells the timeline how long
that takes.

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
