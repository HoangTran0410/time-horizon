# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Time Horizon** is an interactive, zoomable timeline visualization web app built with React 19, TypeScript, and Vite. Users can explore historical events across cosmic timescales (Big Bang to present), browse collections, search, and share specific views via URL.

## Commands

```bash
npm run dev          # Start dev server on port 3000, binds to 0.0.0.0
npm run build        # Clean assets/ then vite build
npm run preview      # Serve the production build
npm run clean        # Remove dist/
npm run lint         # TypeScript type-check only (tsc --noEmit)
npm run generate:histography  # Run all three data pipeline scripts in sequence
```

**Dev server entry point:** `src/index.html` (Vite root = `src/`). The root `index.html` is the production build output.

## Architecture

### State Management
Single Zustand store at `src/stores/index.ts` (~1700 lines) manages all state: collections, events, viewport, search, theme. Uses `persist` middleware with localStorage and versioned migration from legacy formats.

### Core Hooks
- **`useTimelineViewport.ts`** (~1543 lines) — The pan/zoom engine. Exposes `focusPixel`, `focusYear`, `logZoom` as Framer Motion `MotionValue`s. Handles wheel, pointer drag, pinch-to-zoom with inertia, collision-aware event row layout, tick generation, and auto-fit.
- **`useTimelineShareUrl.ts`** — URL param parsing/writing for shareable views. Params: `t` (timeline view), `c` (collections), `e` (event), `y` (year), `z` (zoom), `l` (landing).

### Data Model
```ts
type EventTime = [year, month?, day?, hour?, minute?, seconds?];
// Year floats: 2024.5 = mid-2024. BC years are negative.
// Fractional years computed from Date.getTime() arithmetic.

interface Event {
  id: string; title: string; description: string;
  link?: string; image?: string; video?: string;
  time: EventTime; duration?: number;
  emoji: string; color?: string | null; priority: number;
}

interface EventCollectionMeta {
  id: string; name: string; emoji: string; description: string;
  author: string; createdAt: string; color?: string | null; dataUrl?: string;
}
```

### Styling
Tailwind CSS v4 via `@tailwindcss/vite`. Theme uses CSS `data-theme` attribute with dark/light palettes. Custom tokens in `src/index.css` (`@theme inline`).

### Data / Collections
- Built-in: `src/data/` (TypeScript exports)
- External: fetched lazily from CDN (`hoangtran99.is-a.dev/time-horizon-data`)
- Git submodule: `data/` → `HoangTran0410/time-horizon-data` (not initialized locally)

### Component Structure
25+ components in `src/components/`. Key ones:
- `TimelineCanvasViewport.tsx` — canvas rendering layer
- `TimelineMarkers.tsx` — axis tick marks
- `Toolbar.tsx`, `Sidebar.tsx`, `NavigationPanel.tsx` — UI chrome
- `SearchPanel.tsx` — search and filters
- `EventInfoPanel.tsx` / `MobileEventInfoPanel.tsx` — event detail
- `EventEditor.tsx` — event editing
- `ExploreCollectionsModal.tsx` — catalog browser
- `ShareModal.tsx` — share URL generation
- `LandingPage.tsx` — entry/marketing page

## Notable Technical Decisions

- **WeakMap caching** in helpers (`src/helpers/index.ts`) for deterministic year computation — safe because events are immutable.
- **No test suite** is configured.
- **No SSR** — pure client-side SPA.
