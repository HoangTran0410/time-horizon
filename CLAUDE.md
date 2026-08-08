# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server on :3000 (root is src/)
npm run lint     # tsc --noEmit — the only automated check in the repo
npm run build    # rm -rf assets && vite build  → emits into the REPO ROOT
npm run preview  # serve the built output
```

There is no test suite and no ESLint config. `npm run lint` (type-check) is the gate before committing.

### Data for local dev

Collection data lives in a **separate repo** mounted as the `data/` git submodule (`time-horizon-data`):

```bash
git submodule update --init   # populate data/
node data/server.cjs          # CORS static server on :5500 (ships with the data repo)
```

`data/server.cjs` strips the leading `/data` from request paths and serves the submodule directory,
so it lines up with the app's dev URL exactly.

In dev the app fetches from `http://localhost:5500/data`; in production from
`https://hoangtran99.is-a.dev/time-horizon-data` (`src/hooks/useCatalogCollections.ts`).
Without a server on :5500 the catalog is empty and the Explore panel shows nothing.

### Build output is committed

`vite.config.ts` sets `root: "src"`, `outDir: "../"`, `emptyOutDir: false`, `base: "./"` — the build
writes `index.html` + `assets/` into the repo root, and those files are **committed** (GitHub Pages
serves `main`). Hence the alternating `feature` / `build` commits in history.

- Edit `src/index.html`, never the generated root `index.html`.
- `privacy.html`, `terms.html`, `favicon.svg` at the root are hand-maintained, not build output.
- Ship a `npm run build` commit when the deployed site should change.

## Architecture

React 19 + TypeScript, Vite 6, Tailwind v4, Zustand 5 (immer + persist), `motion` for animation,
maplibre-gl for the optional map background. Everything is client-side; there is no backend.

`App.tsx` switches between two views — `LandingPage` and `Timeline` — based on URL params and the
persisted `lastOpenedView`.

### Single store: `src/stores/index.ts`

One ~2.6k-line Zustand store holds all app state, wrapped in `immer(persist(...))`.

- Persisted under `time-horizon:timeline-store:v1`, **version 5**. New state that must survive reload
  has to be added to the `partialize` whitelist at the bottom of the file.
- `sanitizePersistedTimelineState` re-validates *every* persisted field on rehydrate/merge. Persisted
  payloads also arrive from Google Drive and from user JSON/CSV imports, so this defensive layer is
  intentional — extend the matching `sanitize*` helper when adding persisted shapes.
- `merge` deliberately forces `syncConnectionStatus: "disconnected"` and
  `syncPreferences.onboardingCompleted: false` on every reload (the stored OAuth token may be stale).
- Pure helpers exported from the store module (`filterTimelineSearchEvents`, `sanitizeImportedEvents`,
  `findEventByIdInCollections`, …) are used directly by components; `hooks/useTimelineCollections.ts`
  only holds cross-slice derived values.

### Collections model

`collectionLibrary: Record<id, StoredTimelineCollection>` is the source of truth for any collection
whose events are actually loaded. `catalogMeta` / `syncableIds` mirror the remote catalog index and
carry only metadata until a collection is downloaded.

`CollectionOrigin` drives most branching:

- `catalog` — downloaded from the remote data repo, tracks upstream.
- `custom` — created locally or imported.
- `catalog-fork` — a catalog collection the user edited; `promoteCollectionToFork` performs the
  transition so upstream re-sync no longer clobbers local edits.

### Event identity: `id` vs `eventUid`

- `event.id` is a **runtime-only** deterministic id derived from event content
  (`assignRuntimeEventIds` in `src/helpers/index.ts`). It is stripped by `stripRuntimeEventIds`
  before persisting and before export. Use it for React keys, selection, hit-testing.
- `event.eventUid` is the **durable** identity used by Drive sync and conflict handling. It must be
  preserved across edits, imports, and re-downloads.

Never persist `id`, never use it as a cross-device key.

### Viewport engine: `src/hooks/useTimelineViewport.ts`

The camera is two motion values: `focusYear` (absolute year at viewport center) and `logZoom`
(natural log of pixels-per-year, clamped to `MIN_ZOOM`/`MAX_ZOOM`); `zoom = exp(logZoom)`. Log space
is what makes a single gesture span 13.8 billion years down to a day.

Tick generation, per-event row layout, collapsed-group clustering, warp overlays, and FPS sampling
all run **imperatively** from motion-value subscriptions inside rAF, outside React rendering. Only
coarse results (`ticks`, `collapsedGroups`, labels, fps) are lifted into `useState`, throttled by the
`ZOOM_*_THROTTLE_MS` constants in `src/constants/index.ts`. Adding per-frame work to a React render
path here will visibly cost frames — follow the existing ref + rAF pattern.

### Canvas rendering: `src/components/TimelineCanvasViewport.tsx`

The timeline itself (ticks, event cards, emoji, labels, ruler, hover states) is drawn into one
`<canvas>` each frame, with manual hit-testing for hover/click. React DOM is used only for overlays:
panels, dialogs, toolbar, markers, warp overlay. **Changing how an event looks means editing canvas
draw code and its hit-test region, not JSX.** Text wrapping/measurement is cached per event.

### Share URLs: `src/hooks/useTimelineShareUrl.ts`

View state is encoded in short query params — `t` (timeline view), `c` (visible collections),
`e` (focused event), `y`/`z` (focus year / log zoom), `o` (orientation), `l` (landing), and the
`sm*` family for spatial mapping. Updates go through `history.replaceState` plus a custom
`time-horizon:url-change` window event so all listeners stay in sync without a router.

### Google Drive sync: `src/sync/`

- `sync/index.ts` is pure: `buildSyncProjectionSnapshot` turns store state into a serializable
  snapshot; `isCollectionSyncable` / `hasPendingSyncableChanges` decide what needs uploading.
- `sync/googleDrive.ts` handles Google Identity Services token flow (`drive.file` scope only) and the
  Drive REST calls, including folder bootstrapping and merge-vs-overwrite backup modes.
- Dirtiness is per collection (`sync.dirty` + `dirtyReason: content | metadata | color | delete`);
  deletions leave tombstones in `deletedCollectionSyncTombstones` so they propagate.

Store mutations that change syncable data must call `markCollectionSyncStateDirty`, or the change
silently never uploads.

### i18n and localized content

Two layers:

1. **UI strings** — flat key maps in `src/i18n/en.json` and `src/i18n/vi.json`, read via
   `useI18n().t(key, params)` with `{placeholder}` and ICU plural support. Default language is **`vi`**
   (`DEFAULT_LANGUAGE` in `src/helpers/localization.ts`). Keep both files at exact key parity.
2. **Event content** — `LocalizedText = string | Record<lang, string>`. Always read titles and
   descriptions through `getLocalizedText` / `getLocalizedEventTitle` / `getSearchableLocalizedText`,
   never `event.title` directly.

### Other notes

- Time is `EventTime = [year, month?, day?, hour?, minute?, second?]`, year-only being the common
  case; negative years are BCE and `BIG_BANG_YEAR = -13.8e9` is the floor. Convert with
  `getEventTimelineYear` / `normalizeEventTimeParts` rather than by hand.
- `maplibre-gl` is code-split behind `lazy()` (`TimelineSpatialBackground`) — keep it off the main
  chunk. `vite.config.ts` also splits react/zustand/motion/lucide vendor chunks manually.
- Import/export supports JSON and CSV (`src/helpers/csv.ts`, first line is a `#meta;...` header).
- `scripts/` are one-off data utilities run manually (`node scripts/x.js`, or `tsx scripts/json-to-csv.ts`),
  not part of any build step. The Histography ones still point at an old `src/data/` layout that no
  longer exists; `json-to-csv.ts` targets the current `data/collections/`.
- Imports are relative throughout; the `@/*` tsconfig alias is declared but unused.
