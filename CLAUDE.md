# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: This is a Tambo AI Template

**This is a template application for Tambo AI.** Before writing any new code:

1. **Check the package** - Read `node_modules/@tambo-ai/react` to understand the latest available hooks, components, and features

Always check the `@tambo-ai/react` package exports for the most up-to-date functionality. The template may not showcase all available features.

## Essential Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build production bundle
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix

# Database (Drizzle)
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema changes
npm run db:studio    # Open Drizzle Studio
```

No test framework is configured. Validate changes with `npm run lint` + `npm run build` + manual testing in `npm run dev`.

## Architecture Overview

Next.js 15 App Router app combining a Tambo chat agent with a Strudel-powered beat canvas.

### Runtime Composition

The primary beat-maker route (`/`) composes providers and UI as:

`StrudelProvider -> TamboProvider -> TransportBar + BeatCanvas + ChatSidebar`

- `StrudelProvider` (`src/lib/strudel-provider.tsx`) exposes playback state and controls from a singleton audio engine.
- `TamboProvider` is configured with tools, components, and context helpers from `src/lib/tambo.ts`.
- A `strudelKnowledge` context helper sends the Strudel system prompt (`src/lib/strudel-prompt.ts`) to the AI with every message.

Shared/saved beat route (`/board/[id]`) loads from Postgres on the server and hydrates client canvas state.

### Core State and Execution Model

`src/lib/canvas-store.ts` is the single source of truth for beat pads, pad notes, transport state (playhead, BPM, volume), and serialization. Uses `useSyncExternalStore` for React reactivity.

**Critical pattern:** Tools in `src/services/*` run outside React and mutate the same module-level store used by React components. UI and tools stay in sync via store subscriptions.

### Dual Playback Modes

The audio engine (`src/lib/audio-engine.ts`) supports two mutually exclusive playback modes:

1. **"pads" mode** (default) -- Pattern built from canvas-store pad/note state. The 32-step grid is converted to Strudel mini-notation. This is the visual mode where users see pads on the canvas.

2. **"code" mode** -- Free-form Strudel code evaluated directly via `evaluateCode()`. Used by the `evaluatePattern` tool for melodies, synth layers, effects, and complex compositions that pads can't express. The user never sees the code.

Calling `play()` switches to pads mode. Calling `evaluateCode()` switches to code mode. The canvas-store subscription skips rebuilds in code mode.

### Audio Pipeline (Strudel)

`StrudelService` in `src/lib/audio-engine.ts` is a class-based singleton:

1. **Dynamic imports** -- All Strudel modules are `await import()`'d inside `preload()`. Never top-level import Strudel to avoid SSR/bundle issues.
2. **Prebake** -- `initStrudel()` runs `defaultPrebake()` (synth sounds + evalScope) then our custom prebake (drum machines, piano, ZZFX, dirt samples). Extended samples (VCSL, wavetables, mridangam) load lazily after init.
3. **Pattern generation** -- In pads mode, reads pads + notes from canvas-store, builds mini-notation, stacks patterns, sets tempo via `.cpm()`.
4. **Live updates** -- Subscribes to canvas-store; when notes change during playback, rebuilds and hot-swaps the pattern (debounced 16ms).
5. **Error handling** -- Captures async scheduler errors (missing samples) via `unhandledrejection` listener, waits 500ms after evaluation for late errors.

**CRITICAL module ownership rule:** `samples()`, `aliasBank()`, and any sample registration functions MUST come from the same `@strudel/web` dynamic import that owns `initStrudel`. Using a separate import creates a disconnected sample registry where loaded samples are invisible to the audio output.

Data flow: `Piano Roll / Pad tools -> canvas-store -> StrudelService pattern builder -> Strudel playback`

### AI Tools and Context

`src/lib/tambo.ts` is the central registration for all AI-facing capabilities:

**Pad tools** (visual grid): `createBeatPad`, `removeBeatPad`, `listBeatPads`, `clearAllBeatPads`, `toggleBeatPadMute`, `playBeat`, `stopBeat`, `setBeatBpm`, `setPatternForPad`, `addDrumPattern`

**Audio tools** (full Strudel): `evaluatePattern` (free-form Strudel code, validated with sample checking and revert-on-failure), `listSamples` (runtime sound discovery from superdough soundMap)

**Persistence tools**: `saveSoundboard`, `loadSoundboard`, `listSoundboards`

**Context helpers**: `strudelKnowledge` (system prompt), `canvasState` (pad grid snapshot), `audioEngineState` (playback/error/mode status)

No Tambo generative components are registered (`components` is empty); this project is tool-driven and canvas-driven.

### Strudel System Prompt

`src/lib/strudel-prompt.ts` contains the AI's music production knowledge. Key constraints baked into the prompt:
- **Default to pad tools** for drum/percussion requests so users see visual pads
- **Only use evaluatePattern** when melodies, synths, or effects are needed
- **Never use `$name:` label syntax** -- causes runtime errors in this environment. Always use `stack()` instead.
- **Never use `setCpm()` standalone** -- chain `.cpm(bpm/4)` on the pattern
- **Never use visualization functions** (`_pianoroll`, `_scope`, etc.) -- not supported
- **Never show Strudel code to the user** -- describe music, not implementation

### Persistence

- Postgres + Drizzle schema in `src/db/*`
- API routes in `src/app/api/soundboards/*`
- Client save/load tools in `src/services/soundboards.ts`
- Share links: `/board/{id}`, loaded server-side before client hydration

## When Working on This Codebase

1. **Adding New Tools**
   - Implement tool function in `src/services/`
   - Define Zod schemas for inputs/outputs using `inputSchema`/`outputSchema` (not the deprecated `toolSchema`)
   - Register in `src/lib/tambo.ts` tools array

2. **Adding New Components for AI Control**
   - Define component in `src/components/tambo/`
   - Create Zod schema for props validation
   - Use `z.infer<typeof schema>` to type the props
   - Register in `src/lib/tambo.ts` components array

3. **Grid layout** is defined in `src/lib/grid-constants.ts`. Both `BeatCanvas.tsx` and `beat-pads.ts` import from there so pad placement stays consistent. Beat sequencing is fixed at 32 steps (sixteenth notes).

4. **Strudel imports must stay lazy and singleton-based.** Follow the pattern in `audio-engine.ts`: dynamic import inside service methods, singleton access via `StrudelService.instance()`, no alternate initialization paths.

## Dark Theme Contrast Guide

**This app runs on a near-black background (`#0c0a14`).** Every piece of UI must be legible against it. Generic Tailwind/shadcn CSS variable classes (`bg-background`, `text-foreground`, `border-flat`, `bg-muted`, etc.) often resolve to invisible dark-on-dark values in this context. **Never rely on them for visibility.**

### Required approach for all new UI

1. **Text**: Use explicit light colours -- `text-white/85`, `text-white/60`, `text-emerald-300/90`, etc. Never use `text-foreground` or `text-muted-foreground` without verifying contrast.
2. **Backgrounds**: Use `rgba(255,255,255,0.04-0.08)` or emerald-tinted equivalents. Never use `bg-background`, `bg-card`, or `bg-muted` -- they are effectively black.
3. **Borders**: Use `border-white/10` or `border-emerald-500/30`. Never use `border-flat` or `border-border`.
4. **Hover states**: Brighten toward `rgba(16,185,129,0.18)` (emerald tint) or `white/10`. Must be visibly distinct from the resting state.
5. **Disabled states**: At minimum `white/40` text, `white/3` background -- faded but still perceptible.

### Existing override patterns (globals.css)

All Tambo template components used inside the beat-maker are overridden in `src/app/globals.css` under the `/* ---- Beat chat dark-theme overrides ---- */` and `/* ---- Suggestion chip overrides ---- */` sections. **When adding any new Tambo component, add corresponding dark-theme overrides in globals.css.** Use the `data-slot` attributes on Tambo components as selectors.

### Quick contrast check

Before finishing any UI work, ask: "If I screenshot this on a black background, can I read every element?" If the answer is no, fix it.

## Tambo AI Framework

This project uses **Tambo AI** for building AI assistants with generative UI and MCP support.

**Documentation**: https://docs.tambo.co/llms.txt

**CLI**: Use `npx tambo` to add UI components or upgrade. Run `npx tambo help` to learn more.
