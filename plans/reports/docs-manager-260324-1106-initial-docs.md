# docs-manager: Initial Documentation — Time Horizon

**Date**: 2026-03-24
**Slug**: initial-docs

## Actions Taken

### Docs Replaced (claudekit-engineer → Time Horizon)

Overwrote all 6 existing docs with accurate Time Horizon content:

| File | Lines | Notes |
|---|---|---|
| `docs/project-overview-pdr.md` | ~110 | Project purpose, features, tech stack, state mgmt, missing items |
| `docs/codebase-summary.md` | ~130 | File map, responsibilities, data flow, animation pipeline |
| `docs/code-standards.md` | ~160 | TypeScript rules, state management, Tailwind usage, animation patterns |
| `docs/system-architecture.md` | ~200 | Component tree, time scale engine, gesture system, layout engine, tick generation |
| `docs/project-roadmap.md` | ~210 | 5 phases, must-fix list, milestone tracking |
| `docs/design-guidelines.md` | ~220 | Color system, typography, layout, components, accessibility, do/don't |
| `docs/deployment-guide.md` | ~110 | Dev commands, Netlify/Vercel/GH Pages deployment, env vars |

### Docs Deleted (claudekit-engineer artifacts)

- `docs/agent-teams-guide.md` — AI agent orchestration framework doc, irrelevant
- `docs/skill-native-task.md` — skill development doc, irrelevant
- `docs/skills-interconnection-map.md` — skills graph doc, irrelevant

### Key Corrections Applied

1. **Stack**: React 19 + Tailwind v4 + Motion, NOT React 18 + `@use-gesture/react` + `@tanstack/react-virtual`
2. **State**: `useState` in `Timeline.tsx`, NOT Context + `PanZoomContext` + `TimelineDataContext`
3. **Persistence**: None (in-memory), NOT IndexedDB
4. **Groups**: Free-form string arrays, NOT a `Group` entity with CRUD
5. **Year convention**: `year = 0` = present, negative = past, NOT Big Bang = 0
6. **File count**: 8 source files, NOT the multi-folder structure in old docs
7. **No tests, no CI/CD**: Added to roadmap as Phase 4 items
8. **No import/export**: Added as Phase 5 item

### Discrepancies Noted

The old `system-architecture.md` described a fully-designed v2 plan (IndexedDB, gesture library, virtual scrolling, group CRUD). This was misleading — noted in the new `system-architecture.md` as a "What's NOT Implemented" table.

---

## Doc Size Summary

All files under 800 LOC ✓

| File | LOC (est.) |
|---|---|
| project-overview-pdr.md | ~110 |
| codebase-summary.md | ~130 |
| code-standards.md | ~160 |
| system-architecture.md | ~200 |
| project-roadmap.md | ~210 |
| design-guidelines.md | ~220 |
| deployment-guide.md | ~110 |
| **Total** | **~1,140** |

---

## Unresolved Questions

1. **Add Event UX**: No "Add Event" flow exists — only Edit. Confirm preferred approach (Option A: pre-fill editor / Option B: dedicated modal)?
2. **Persistence path**: localStorage (quick) vs. IndexedDB (structured) — which for Phase 3?
3. **Group management**: Free-form strings (v1) vs. CRUD with colors (v2)?
4. **Hosting target**: Which platform (Netlify / Vercel / GH Pages)?
5. **Custom domain**: Any plans for a branded URL?
