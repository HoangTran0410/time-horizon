<div align="center">

# Time Horizon

### 13.8 billion years on one axis, down to a single second.

Scroll from the Big Bang to this afternoon on one continuous canvas — no page breaks,
no scale switches, no reloading.

**[→ Open the timeline](https://hoangtran99.is-a.dev/time-horizon/)**

[![Deploy](https://github.com/HoangTran0410/time-horizon/actions/workflows/deploy.yml/badge.svg)](https://github.com/HoangTran0410/time-horizon/actions/workflows/deploy.yml)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Vite 6](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![No backend](https://img.shields.io/badge/backend-none-1f6f5c)
![MIT](https://img.shields.io/badge/license-MIT-blue)

<img src=".github/readme/timeline.jpg" alt="Cosmic Origins and Earth &amp; Life on one axis, eleven billion years across the screen" width="100%">

</div>

---

## Why this exists

Put the Cambrian explosion, the Roman Empire and the invention of paper in one sentence
and you hit the problem immediately: they live eight orders of magnitude apart. Every
timeline tool solves this by picking a band — geological, historical, or personal — and
staying inside it. Cross the boundary and you change tools, units, and mental model.

Time Horizon refuses to pick a band. **The hard part is the camera:** the entire view is
two numbers — the year at the centre of the screen, and the *log* of pixels-per-year.
Because zoom lives in log space, one flick of the wheel crosses nine orders of magnitude
without ever changing mode, breaking the layout, or asking which "era" you'd like.
Everything else falls out of that — ticks that re-derive their unit as you fall, events
that cluster and unfold, rings that name the scale you're standing in.

<img src=".github/readme/timeline-zoom.jpg" alt="The timeline at a 165-year window, reference rings marking the 5, 10 and 50 year scales" width="100%">

<sub>The same axis as the picture above, eight orders of magnitude closer.</sub>

## Compared to what's out there

| | Great at | Where it stops |
|---|---|---|
| **[Histography](http://histography.io/)** | A gorgeous WebGL wall of Wikipedia events, Big Bang to today | Fixed era buckets; read-only — none of it is your data |
| **[TimelineJS](https://timeline.knightlab.com/)** | Storytelling: rich media, one slide at a time, driven by a spreadsheet | Slides, not a continuous axis; comparing distant eras isn't the goal |
| **Tiki-Toki, Preceden** | Polished hosted builders, sharing and teams handled for you | Account required, data lives on their servers, tiered plans |
| **[vis-timeline](https://visjs.github.io/vis-timeline/)** | A solid library for scheduling-scale ranges | It's a library, not an atlas; one DOM node per event |
| **Time Horizon** | One continuous log-zoom axis, layered collections, your data stays yours | No collaboration, no media-rich slides — deliberately |

## What it does

- **Fly across 13.8 billion years** — wheel, drag, pinch, or jump straight to a date.
- **Layer collections** — cosmology, empires, inventions, art, religion, Vietnamese
  school history. Stack them and compare, or keep one at a time.
- **Put history on a map** — spatial mode anchors events to coordinates and drifts the
  map as you travel.
- **Bring your own** — create, import JSON/CSV, edit, sync to *your* Google Drive
  (`drive.file` scope: the app only ever sees files it made). No server to trust.
- **Share the exact view** — year, zoom, layers and focused event live in the URL.
- **Vietnamese and English** — for the interface *and* the event content.

<img src=".github/readme/landing-hero.jpg" alt="The Time Horizon landing page" width="100%">

## Run it locally

Collection data lives in a **separate repository**, mounted here as a submodule.

```bash
git clone https://github.com/HoangTran0410/time-horizon.git
cd time-horizon
npm install
git submodule update --init   # populates data/

node data/server.cjs          # CORS static server for the data, on :5500
npm run dev                   # app on :3000
```

Both must run — without `:5500` the catalog comes up empty.
Then: `npm run lint` (tsc), `npm test` (vitest), `npm run build`.

## How it's built

No backend, no database, no accounts — everything runs in the browser and persists to
`localStorage`.

| | |
|---|---|
| **UI** | React 19 · TypeScript · Tailwind v4 · `motion` |
| **Build** | Vite 6 → GitHub Pages and Cloudflare Pages |
| **State** | one Zustand store, `immer` + `persist`, every rehydrated field re-validated — payloads arrive from share links, CSVs and Drive |
| **Rendering** | the timeline is a single `<canvas>`; React DOM handles only the panels around it |
| **Camera** | `focusYear` + `logZoom` as motion values; ticks, layout and clustering run in rAF, outside React rendering |
| **Maps** | maplibre-gl, lazily loaded so it stays off the main chunk |

Touching the code? [`CLAUDE.md`](CLAUDE.md) is the architecture guide — store layout,
event identity rules, viewport engine, and the traps worth knowing first.

## Data

Collections live in **[time-horizon-data](https://github.com/HoangTran0410/time-horizon-data)**
as plain JSON, one file per collection plus an index. Adding history is a pull request
against that repo — no build step, no code change here.

## License

MIT
