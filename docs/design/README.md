# TAKIP design direction

How TAKIP should look, read and behave. Every screen follows this. If a change
needs to break a rule here, change the rule here first.

## The idea

TAKIP is a field instrument for watching the world: a live map, and a few
well-made tools around it. It should feel like something a small, careful team
built over years, the way Flighty, Linear, Felt or Apple Maps feel. Not a
"command centre" and not a sci-fi HUD.

Five principles decide every argument:

1. **The map is the content.** Chrome is quiet, solid and neutral so the data
   can carry the colour. Panels never let the map show through them.
2. **One voice.** Every panel has the same anatomy, the same type sizes and the
   same controls. A person who learns one panel has learned them all.
3. **Words a person would say.** Sentence case, plain verbs, real numbers.
   Write like a thoughtful editor, not a terminal.
4. **Colour means something.** Neutral by default. One accent for "you can act
   here / this is on". Red, amber, green only for severity and status. Gold
   belongs to TI.
5. **Handy beats impressive.** Keyboard shortcuts for everything common,
   Escape always closes, state is remembered, empty states teach the next step,
   nothing important hides behind hover alone.

## What we stopped doing

These are the tells of a generated UI. None of them ship.

- Glass panels, backdrop blur, glows, neon borders, scanlines, corner marks.
- UPPERCASE LABELS WITH WIDE LETTER-SPACING. Use sentence case.
- Monospace for words. Mono is for numbers, coordinates, IDs and times only.
- Filled red/cyan "chips" for every attribute (`HIGH SEVERITY` `16H LEFT`).
- Words like *intel, toolkit, command, ops, protocol, sweep* when a plain word
  exists. "ArcGIS INTEL" is "ArcGIS layers".
- Grids of six suggestion cards. Offer two or three good ones.
- A colour per feature (red buttons in Recon, gold box in ArcGIS, cyan in TI).
- Animating every element, springs on chrome, 600 ms colour transitions.
- Emoji or decorative icons in front of every row.
- Repeating the same item three times. Group duplicates and show a count.

**One exception: map looks.**
- A person may pick a look for the map, such as night vision, thermal, noir or snow.
- A look is off by default and is remembered once picked.
- It changes the map canvas only, never panels or other chrome.
- Data keeps its meaning colours wherever the renderer allows.
- It is one control in Map options, switched by number keys, and it travels in share links.
- Decided with the user on 2026-10-15.

## Tokens

All tokens live in `src/app/globals.css` and are exposed to Tailwind through
`@theme`, so components write `bg-surface-1 text-ink-2 border-line`, not hex
values or `rgba(...)`.

### Surfaces (dark, faintly cool)

| Token | Value | Use |
|---|---|---|
| `--surface-0` | `#0A0C0F` | app background, status bar |
| `--surface-1` | `#111317` | sidebar, panels, floating controls |
| `--surface-2` | `#171A1F` | inputs, cards inside panels, row hover |
| `--surface-3` | `#1E2228` | pressed and selected rows, segmented "on" |
| `--line` | `rgba(255,255,255,0.07)` | hairlines and borders |
| `--line-strong` | `rgba(255,255,255,0.12)` | input borders, focused card |

### Ink

| Token | Value | Use |
|---|---|---|
| `--ink-1` | `#ECEEF0` | titles, primary text |
| `--ink-2` | `#A4AAB2` | body copy, secondary text |
| `--ink-3` | `#6D737B` | meta, captions, section labels, placeholders |
| `--ink-4` | `#474C53` | disabled, decorative rules |

### Accent and status

| Token | Value | Use |
|---|---|---|
| `--accent` | `#52C1D6` | toggles on, focus ring, primary button, active nav marker, links |
| `--accent-soft` | `rgba(82,193,214,0.12)` | accent backgrounds |
| `--on-accent` | `#061A1F` | text on an accent fill |
| `--gold` | `#D7B35A` | TI only |
| `--gold-soft` | `rgba(215,179,90,0.12)` | TI backgrounds |
| `--red` | `#E5534B` | critical, destructive |
| `--amber` | `#E9A23B` | warning, elevated |
| `--green` | `#46B97F` | live, healthy, success |
| `--blue` | `#5B9CF5` | informational |
| `--violet` | `#9B8AFB` | rare categorical use |
| `SERIES_INK` | `#C98500` `#D55181` `#9085E9` `#008300` `#3987E5` `#D95926` | series compared side by side (History's country chart and the outlines that match it), handed out in this order; lives in `src/lib/map/style/tokens.ts`, not CSS |

Selected states are mostly **neutral** (`surface-3` + `ink-1`), not accent.
The accent is a scarce resource: if more than a few things on screen are
accent-coloured, something is wrong.

The legacy tokens (`--bg-panel`, `--text-primary`, `--cyan-primary`,
`--gold-primary`, `--border-primary`…) are remapped onto these values so old
code calms down at once. New code uses the new names.

### Type

Geist for words, Geist Mono for numbers (`tabular-nums`). One scale:

| Role | Size / line | Weight |
|---|---|---|
| Display number (timeline year, big stat) | 22 / 28 | 500, mono |
| Panel title | 15 / 20 | 600 |
| Body, row title | 13 / 18 | 500 for titles, 400 for body |
| Secondary | 12 / 16 | 400, `ink-2` |
| Meta, section label | 11 / 14 | 500, `ink-3`, sentence case |

Never below 11 px. Never letter-spaced uppercase.

### Shape, space, depth, motion

- 4 px grid. Panel padding 16. Gap between sections 20–24. List rows 40 tall
  (compact 32). Controls 32 tall (small 28).
- Radius: 6 controls, 8 cards and inputs, 12 floating surfaces. Panels docked
  to the sidebar have no outer radius.
- One shadow for floating things: `--shadow-float`
  (`0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -12px rgba(0,0,0,0.7)`)
  plus a `line` border. Nothing glows.
- Motion: 120–180 ms, `ease-out` (`cubic-bezier(0.2, 0.8, 0.2, 1)`). Fade and a
  4–8 px slide at most. No springs on chrome. Honour `prefers-reduced-motion`.
- Focus: 2 px `accent` ring with 2 px offset on keyboard focus only.

## Layout

```
┌────┬──────────────┬──────────────────────────────────────────┐
│ ◎  │ Panel title ✕│ [Search places, coordinates…   /]        │
│Lyr │──────────────│                             [Showing 4 ▾]│
│Alr │ section      │                                ┌────────┐│
│Are │  row         │              the map           │inspect ││
│His │  row         │                                └────────┘│
│Spc │              │                                      [+] │
│Rte │              │ [Map | Space ▾]          scale  [−] [◐]  │
│Rcn │              │                                 [⌖] [⟲]  │
│ ── │              │                                          │
│ TI │              │                                          │
│ ⋯  │              │                                          │
├────┴──────────────┴──────────────────────────────────────────┤
│ 40.71° N 74.00° W · Manhattan   ● Live · 139,452 tracked  UTC│
└──────────────────────────────────────────────────────────────┘
```

- **Sidebar** (72 px, `surface-1`, hairline right). Logo, then the nav, then TI
  set apart, then More and the account at the bottom. Icon 18 px over an 11 px
  label. Active: `surface-3` fill, `ink-1`, a 2 px accent bar on the left edge.
- **Panel** (360 px) docks flush to the sidebar, full height, solid
  `surface-1`, hairline right. One at a time. It is part of the frame, not a
  card floating over the map.
- **Search** floats at the top-left of the map area, 40 px tall, `surface-1`,
  `shadow-float`. `/` focuses it.
- **Map controls** form one cluster at the bottom-right: zoom, compass, globe/
  flat, base map (a popover with thumbnails and map options) and replay.
- **Map / Space** is one compact control at the bottom-left of the map area.
  On the map it reads `Map | Space ▾`; the menu lists the stops (Earth, Moon,
  Mars, Sun, System, Stars, Galaxy, Universe). In space the stops show inline.
- **Showing** sits at the top-right of the map (beside Map / Space on a phone),
  so there is always one place that says what you are looking at. It reads `Showing 4`: a green
  dot when live, a grey one in History or Replay, and the number of things
  drawn (`Showing 0` with nothing on, so it never goes away unless the person
  hides it under Layout). It opens a popover,
  as the Space menu does: first the mode and time in a sentence or two
  ("History · 14 July 1981. World borders of 1981, with wars and battles around
  that date."), then every layer, event family, border layer, colouring,
  ArcGIS layer and drawn area on the map, grouped by kind, each with its
  switch. A row switched off stays, greyed, until the popover closes. Under
  them, Recent lists up to five things the person had on and switched off
  (from here, Layers or History), newest first and remembered across reloads,
  each with its switch to put it back. It offers only what fits the map shown,
  and is left out when there is nothing recent; it never suggests things the
  person hasn't used. Neither counts towards the number. The footer opens
  Layers, or History while History runs.
- **Status bar** (28 px, `surface-0`, hairline top, 11 px `ink-3`): pointer
  position and place on the left, live state and count, UTC clock and a `?` for
  shortcuts on the right. No price tickers. Links live in the More menu.
- **Inspect card** opens at the top-right of the map for a clicked ship,
  aircraft, satellite or camera. 340 px, `surface-1`, `shadow-float`.

### The layout is the person's

What this section draws is the default. Settings → Layout
(`@/components/shell/layout`) lets each person change it, saved in their browser,
with a separate layout for phones:

- **Hide** any piece: a sidebar entry or TI, the status bar or any of its pieces,
  Search, Showing, Map / Space, the scale, the whole control cluster or any of
  its buttons. On a phone, a bottom-bar entry, Showing, Map / Space, the
  controls or the mark. Keys still open what is hidden (a hidden Search shows
  while `/` has it open). Without the status bar the map runs to the bottom
  edge.
- **Reorder** the sidebar (and where its gaps fall), each side of the status bar
  (and which side a piece is on), and a phone's bottom bar.
- **Move** Search, Showing, Map / Space, the controls and the scale to any of
  the map's four corners, in any order there. A top corner stacks downwards, a
  bottom one sideways; menus open towards the middle of the map.
- **Place freely**: Arrange (under Layout) outlines those pieces on the map to
  be dragged anywhere, or nudged with the arrow keys; Done or Escape ends it.
  Nine preset places (each corner and edge middle, 12 px in, and the middle of
  the map) show as outlines while a piece is dragged, and one dropped within
  48 px of a preset takes it; 1 to 9 send the selected piece to one, laid out
  as on a number pad. A placed piece hangs from the corner, edge middle or
  centre of the third it is in, so a narrower window or a panel opening beside
  the sidebar carries it along and a centred one stays centred. Picking a
  corner, or Back to corners, puts it back in a stack. Desktop only; a phone's
  pieces stay put.
- **Always there:** More and the account (the way to Settings), the map's
  credits, which travel beside the controls (issue #16), and Map / Space while
  in space (the way back).
- The window column runs between whatever sits top-right and bottom-right,
  and keeps clear of a placed piece in its path; anything parked beside the
  controls only does so while they are bottom-right. Placed pieces can overlap
  each other: where they go is the person's call.

### Windows on the map

Everything that opens over the map is a window (`@/components/map/windows`):
inspect cards, camera players, live TV, the place dossier, the satellite images
of a place, the watched aircraft, and History events pinned from their popups. Map pins' own popups
stay anchored to their point; a History event's popup has a Pin beside Close that turns it into a
window (closed again on leaving History or Replay; not on a phone). A right-click on the map opens a
menu at the pointer, not a window: Region dossier, Satellite images here and Report an issue here; a
second right-click straight after still opens the dossier. A camera window
has a thin `ink-2` line from its nearest edge to the camera's ring on the map.

- **Stacked.** Windows dock in a column at the top-right, below whatever sits in that
  corner (Showing, by default; 12 px in, cards 340 px wide, video as wide as it needs),
  newest on top, 8 px apart, ending above whatever sits bottom-right (the control cluster). When the column runs out, older windows open with
  a scroll or fold to their header; click a folded one to bring it to the top.
  Clicking something that already has a window brings that window forward.
- **Windowed.** Drag a window by its header to free it anywhere in the map
  area. Drop it back by the column to dock it again. With the header focused,
  arrow keys nudge it (Shift for bigger steps) and Enter folds it.
- **Put next to.** Dragged near another window or the edge of the map, a
  window snaps flush with an 8 px gap and lines up with its neighbour's top or
  left, shown by an accent guide. Snapped windows form a group that moves when
  the first one is dragged; dragging a member takes it out. Alt turns snapping
  off.
- **Bigger, smaller.** Resize from the edges and corners (cards from
  280 × 160; video from 320 wide and always 16:9). Double-click the header for
  the large size and back; video gets a big player, never full screen.

Each kind remembers where it was last put and its size. If that place no
longer fits the screen, the window docks and a "Reset window places" button
appears. "Close all" appears with two or more windows; Escape closes the
frontmost. Each open card has a selection ring on the map, the frontmost's
the strongest, and Follow belongs to one card at a time. At most four
pictures play at once; the rest wait with a Play button. Windows open with a
120 ms fade and a 4 px rise, and drags have no inertia. On a phone none of
this applies: one bottom sheet at a time, no dragging.

### Plan limits

Two things open over the map without being windows:

- **Account prompt.** Reaching for something the plan leaves out (TI, a
  Layers section the plan closes) opens the account dialog with one line
  saying why: "Create a free account to use TI." for a visitor, or the
  Account tab with "TI isn't in your plan." for a member. A closed layer stays
  off. Only a click or key press asks; layers restored on load are just left
  off.
- **Time wall.** When the plan's map minutes for the day run out, a 380 px card
  sits centred over the blurred map and can't be closed. Visitors get Create
  account and Sign in, members See plans, and both are told when the map opens
  again (00:00 UTC). It sits under the account dialog, so its buttons open on
  top of it.

## Panel anatomy

Use `Panel` from `@/components/ui/panel`.

1. **Header**, 52 px: title (15/600), an optional one-line context under or
   beside it in `ink-3` ("136 in the last day · updated just now"), then icon
   actions and close. Tabs, when a panel has them, sit in a segmented control
   directly under the header.
2. **Body** scrolls. Sections have an 11 px sentence-case label in `ink-3`, an
   optional action on the right of the label, and their content.
3. **Footer** (optional, sticky) holds the one primary action, or quiet source
   and freshness info ("19 of 20 sources reporting").

Rows (`ListRow`): optional leading dot or 16 px icon, title (13/500 `ink-1`),
a second line in 12 `ink-2` or 11 `ink-3`, trailing value in mono. Hover
`surface-2`, selected `surface-3`. The whole row is the click target.

Empty states (`EmptyState`): a 16 px icon in a 32 px `surface-2` circle, one
line saying what goes here, one line saying how, and at most one button.

## Components

`src/components/ui/` holds the kit. Use it before writing a one-off.

- `panel.tsx`: `Panel`, `PanelSection`, `PanelFooter`
- `button.tsx`: `Button` (`primary` `secondary` `ghost` `danger`, `sm` `md`),
  `IconButton` (requires a `label`; shows it as the tooltip with an optional
  `kbd`)
- `segmented.tsx`: `Segmented` (2–5 options, optional counts)
- `field.tsx`: `TextField`, `TextArea`, `SearchField`, `Select`, `Switch`, `Checkbox`
- `list-row.tsx`: `ListRow`
- `tag.tsx`: `Tag` (quiet, outlined, 11 px, tones `neutral` `accent` `red`
  `amber` `green` `blue`), `Dot`
- `empty-state.tsx`: `EmptyState`
- `kbd.tsx`: `Kbd`
- `stat.tsx`: `Stat` (label, mono value, optional delta)
- `popover.tsx`: `Popover` (anchored, closes on Escape and outside click)

## Voice

- Sentence case everywhere: titles, buttons, tabs, labels.
- Say what it is and what to do. "Draw an area to see what's inside it and get
  told when it changes", not "STEP 1 — CHOOSE A SHAPE".
- Numbers are specific and formatted: `17,707 ships`, `4 min ago`, `M4.7`.
- Freshness is honest: "updated 2 min ago", "19 of 20 sources reporting".
- Buttons are verbs: "Add to map", "Play 1938–1945", "Back to live".
- TI talks like a colleague, not a mascot. No "Hey, I'm your…".

| Before | After |
|---|---|
| LIVE ALERTS 136 · 19/20 SOURCES LIVE | Alerts · 136 in the last day |
| AI OVERVIEW | Brief me |
| DRAWING TOOLS / STEP 1 — CHOOSE A SHAPE | Areas / Draw a shape |
| RECON TOOLKIT · 21 TOOLS · GLOBAL SWEEP | Recon · Look up an IP, domain, username or phone |
| ARCGIS INTEL · 0 LAYERS ACTIVE | ArcGIS layers · Nothing added yet |
| HIGH SEVERITY · 16H LEFT | Severe · ends in 16 h |
| HISTORY ▸ LIVE | History · Back to live |

## Map data

Owned by the map work, summarised here so the chrome and the data agree:
markers are small and calm at low zoom and gain detail as you zoom in; dense
point layers cluster; categorical colours come from the status/categorical
tokens above, slightly desaturated; lines (cables, routes) are thin and
translucent; every label uses Noto Sans with a dark halo. A camera its
operator lists but isn't streaming keeps its pin, faded, and says "Off air"
rather than opening a dead player.

## Phones

Desktop first. Phones get the map, search, a bottom sheet for one panel at a
time and the same tokens. The bottom bar holds Layers, Alerts, History, Space,
Recon, TI, Search and Route; Areas and ArcGIS stay on the desktop. Nothing on a
phone may depend on hover. Map / Space and Showing sit above the bottom bar, and
their popovers open over the map, never beside a sheet. While History or Replay
runs, its timeline sits between them and the bottom bar in two rows, without the
range menu (Go to and seeking earlier widen the range); an open sheet covers it.
