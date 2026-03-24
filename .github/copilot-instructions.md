# Copilot Instructions for `tambo-beat-maker`

## Build, lint, and verification commands

Use npm scripts from `package.json`:

- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run lint` — run ESLint
- `npm run lint:fix` — auto-fix lint issues where possible

Database/Drizzle commands used in this repo:

- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:push`
- `npm run db:studio`

### Test command status

There is currently no automated test runner configured (no Jest/Vitest/Playwright/Cypress scripts/configs). For now, validate changes with:

- `npm run lint`
- `npm run build`
- manual verification in `npm run dev`

Single-test command is not available until a test framework is added.

## High-level architecture

This repo is a Next.js App Router app that combines a Tambo chat agent with a Strudel-powered beat canvas.

### Runtime composition

The primary beat-maker route (`/`) composes providers and UI as:

`StrudelProvider -> TamboProvider -> BeatCanvas + ChatSidebar`

- `StrudelProvider` (`src/lib/strudel-provider.tsx`) exposes playback state and controls from a singleton audio engine.
- `TamboProvider` is configured in route components with tools/context helpers from `src/lib/tambo.ts`.

Shared/saved beat route (`/board/[id]`) loads from Postgres on the server and hydrates client canvas state via `BoardLoader`.

### Core state and execution model

`src/lib/canvas-store.ts` is the single source of truth for beat pads, pad notes, transport state (playhead, BPM, volume), and serialization.

Important pattern: tools in `src/services/*` run outside React and mutate the same module-level store used by React components. UI and tools stay in sync via `useSyncExternalStore` subscriptions.

### Audio pipeline

`src/lib/audio-engine.ts` contains `StrudelService` (singleton):

1. dynamically imports `@strudel/web` in `preload()` (no top-level Strudel imports)
2. preloads samples/aliases
3. converts canvas notes into 32-step Strudel mini-notation
4. evaluates pattern and hot-rebuilds while playing

Data flow:

`PianoRoll/Pad tools -> canvas-store -> StrudelService pattern builder -> Strudel playback`

### AI tools and context

`src/lib/tambo.ts` registers tools (pads, transport/patterns, soundboard persistence) and context helpers:

- `canvasState` helper exposes a plain snapshot for prompting/context
- `audioEngineState` helper surfaces readiness/playback/errors

No Tambo generative components are currently registered (`components` is intentionally empty); this project is tool-driven and canvas-driven.

### Persistence path

- Postgres + Drizzle schema in `src/db/*`
- API routes in `src/app/api/soundboards/*`
- client save/load tools in `src/services/soundboards.ts`

Share links are generated as `/board/{id}` and loaded server-side before client hydration.

## Key repository conventions

## 1) Treat `canvas-store` as canonical state

When adding behavior for pads/notes/transport, update `src/lib/canvas-store.ts` first and consume that from both UI and tools. Avoid duplicating pad or sequence state in component-local state.

## 2) Keep Strudel imports lazy and singleton-based

Follow existing pattern in `audio-engine.ts`: dynamic import inside service methods, singleton access via `StrudelService.instance()`, and no alternate Strudel initialization paths.

## 3) Register AI-facing capabilities centrally

All AI tool registration lives in `src/lib/tambo.ts` with Zod schemas for input/output. New tools should be implemented in `src/services/` and then wired in `tambo.ts`.

## 4) Beat sequencing assumptions are fixed at 32 steps

Multiple files assume 32-step, sixteenth-note sequencing (`canvas-store`, `audio-tools`, `PianoRoll`, `audio-engine`). Keep step-index logic aligned (`0..31`) when extending features.

## 5) Dark-theme styling is explicit, not token-default

The beat-maker UI runs on a near-black background. For chat/canvas UI work, follow the explicit contrast approach and override strategy in:

- `CLAUDE.md` (Dark Theme Contrast Guide)
- `src/app/globals.css` sections:
  - `/* ---- Beat chat dark-theme overrides ---- */`
  - `/* ---- Suggestion chip overrides ---- */`

Do not assume generic `bg-background`/`text-foreground`/`border-*` utility combinations are legible in beat-maker surfaces.

## 6) Tambo package capability checks

Before introducing new Tambo hooks/components/patterns, check current `@tambo-ai/react` exports in `node_modules` (template docs may lag package capabilities).
