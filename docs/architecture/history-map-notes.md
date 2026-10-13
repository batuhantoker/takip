# Map notes for History

The map side of History (event markers, WWII borders, country colouring, deep time) is styled in `src/components/map/layers/history/` and `src/lib/`. The panel's legends already read the same values, so they stay in step automatically:

- Event family colours: `HISTORY_FAMILIES` and `HISTORY_FALLBACK_COLOR` in `src/lib/history/popup.ts` (design-token categorical colours, desaturated).
- WWII alignment colours: `ALIGNMENTS` in `src/lib/history/war-layers.ts` (diverging blue to red, desaturated; "Not at war" is a cool dark grey).
- Country colouring ramp: `rampFor(dark)` in `src/lib/history/series.ts` (a quiet steel-blue sequential ramp, even OKLCH steps).
- Popups for events and borders use the shared map popup kit (`src/lib/map/popups/kit.ts`).
- While WWII borders are shown, the basemap's modern country names and borders are hidden (`use-war-layers.ts`), so 1939 names don't sit beside today's.

If a legend needs a colour that isn't exported yet, add the export in `src/lib` rather than copying a hex value into the panel.
