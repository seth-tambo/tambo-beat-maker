# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: This is a Tambo AI Template

**This is a template application for Tambo AI.** Before writing any new code:

1. **Check the package** - Read `node_modules/@tambo-ai/react` to understand the latest available hooks, components, and features

Always check the `@tambo-ai/react` package exports for the most up-to-date functionality. The template may not showcase all available features.

## Essential Commands

```bash
# Development
npm run dev          # Start development server (localhost:3000)
npm run build        # Build production bundle
npm run start        # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix


## Architecture Overview

This is a Next.js 15 app with Tambo AI integration for building generative UI/UX applications. The architecture enables AI to dynamically generate and control React components.

### Core Technologies
- **Next.js 15.4.1** with App Router
- **React 19.1.0** with TypeScript
- **Tambo AI SDK**
- **Strudel** (`@strudel/web`) for audio synthesis via Web Audio API
- **Tailwind CSS v4** with dark mode support
- **Zod** for schema validation

### Key Architecture Patterns

1. **Component Registration System**
   - Components are registered in `src/lib/tambo.ts` with Zod schemas
   - AI can dynamically render these components based on user input
   - Each component has a name, description, component reference, and propsSchema

2. **Tool System**
   - External functions registered as "tools" in `src/lib/tambo.ts`
   - AI can invoke these tools to fetch data or perform actions
   - Tools have schemas defining their inputs and outputs

3. **Provider Pattern**
   - `StrudelProvider` wraps `TamboProvider` in `src/app/page.tsx`
   - `StrudelProvider` initializes the audio engine and exposes reactive state via `useStrudel()`
   - `TamboProvider` provides API key, registered components, and tools to the entire app
   - Provider nesting: `StrudelProvider → TamboProvider → AppContent`

4. **Streaming Architecture**
   - Real-time streaming of AI-generated content via `useTamboStreaming` hook
   - Support for progressive UI updates during generation

### File Structure

```
src/
├── app/                        # Next.js App Router pages
│   └── layout.tsx              # Root layout with TamboProvider
├── components/
│   └── beat-maker/             # Beat maker UI
│       ├── BeatCanvas.tsx      # 2D canvas with draggable pads + transport
│       ├── PianoRoll.tsx       # 32-step sequencer modal
│       └── ChatSidebar.tsx     # AI chat panel
├── lib/
│   ├── tambo.ts                # CENTRAL CONFIG: Component & tool registration
│   ├── canvas-store.ts         # Reactive state store (pads, notes, BPM)
│   ├── audio-engine.ts         # StrudelService class singleton (play/stop/rebuild)
│   ├── strudel-provider.tsx    # React context wrapping StrudelService
│   ├── prebake.ts              # Strudel sample/synth preloading
│   ├── sound-map.ts            # Pad label → Strudel sound mapping
│   ├── drum-patterns.ts        # Preset beat patterns
│   └── utils.ts                # Utility functions
├── services/
│   ├── beat-pads.ts            # Tambo tools: pad CRUD
│   └── audio-tools.ts          # Tambo tools: play/stop/BPM/patterns
└── types/
    └── strudel.d.ts            # Type declarations for all Strudel modules
```

### Audio Architecture (Strudel)

The audio engine (`src/lib/audio-engine.ts`) is a **class-based singleton** (`StrudelService`) following the StrudelLM guide pattern:

1. **Singleton** — `StrudelService.instance()` guarantees a single `AudioContext` and consistent state. Both React components (via `StrudelProvider` context) and Tambo tools (which run outside React) access the same instance.
2. **Dynamic imports** — All Strudel modules are `await import()`'d inside `preload()`. Never top-level imported to avoid SSR/bundle issues.
3. **Prebake** — `src/lib/prebake.ts` registers synth sounds, ZZFX sounds, drum machine sample banks from CDN, and sets up `evalScope` so patterns can use `s()`, `note()`, `stack()`, etc.
4. **Pattern generation** — Reads pads + notes from canvas-store, converts each pad's active steps into Strudel mini-notation (`s("bd ~ ~ ~ bd ~ ~ ~ ...")`), stacks all pads, and sets tempo via `.cpm()`.
5. **Live updates** — Subscribes to canvas-store emissions; when notes change during playback, rebuilds and hot-swaps the pattern (debounced 100ms).
6. **Error handling** — Captures async scheduler errors (missing samples) via `unhandledrejection` listener, waits 500ms after evaluation for late errors, and reports errors via state change notifications.
7. **React context** — `StrudelProvider` (`src/lib/strudel-provider.tsx`) wraps the singleton, calling `preload()` on mount and subscribing to state changes. Exposes `useStrudel()` hook.
8. **Sound mapping** — `src/lib/sound-map.ts` maps pad labels (Kick, Snare, etc.) to Strudel sound abbreviations (bd, sd, etc.).
9. **One drum sound per pad** — Piano roll collapses to 1D: if any note is active at step N, the pad's sound fires at step N.
10. **Convenience exports** — Module-level `play()`, `stop()`, `preload()`, etc. delegate to the singleton for backwards compatibility with existing consumers.

Data flow: `Piano Roll → canvas-store (notes) → StrudelService (pattern) → Strudel (audio)`
Provider nesting: `StrudelProvider → TamboProvider → AppContent`

## Key Tambo Hooks

- **`useTamboRegistry`**: Component and tool registration
- **`useTamboThread`**: Thread state and message management
- **`useTamboThreadInput`**: Input handling for chat
- **`useTamboStreaming`**: Real-time content streaming
- **`useTamboSuggestions`**: AI suggestion management
- **`withInteractable`**: Interactable component wrapper

## When Working on This Codebase

1. **Adding New Components for AI Control**
   - Define component in `src/components/tambo/`
   - Create Zod schema for props validation
   - use z.infer<typeof schema> to type the props
   - Register in `src/lib/tambo.ts` components array

2. **Adding New Tools**
   - Implement tool function in `src/services/`
   - Define Zod schema for inputs/outputs
   - Register in `src/lib/tambo.ts` tools array

3. **Styling Guidelines**
   - Use Tailwind CSS classes
   - Follow existing dark mode patterns using CSS variables
   - Components should support variant and size props
   - **See "Dark Theme Contrast Guide" below** — all UI must be legible on the dark canvas background

4. **TypeScript Requirements**
   - Strict mode is enabled
   - All components and tools must be fully typed
   - Use Zod schemas for runtime validation

5. **Testing Approach**
   - No test framework is currently configured
   - Manual testing via development server
   - Verify AI can properly invoke components and tools
```

## Dark Theme Contrast Guide

**This app runs on a near-black background (`#0d1512`).** Every piece of UI must be legible against it. Generic Tailwind/shadcn CSS variable classes (`bg-background`, `text-foreground`, `border-flat`, `bg-muted`, etc.) often resolve to invisible dark-on-dark values in this context. **Never rely on them for visibility.**

### Required approach for all new UI

1. **Text**: Use explicit light colours — `text-white/85`, `text-white/60`, `text-emerald-300/90`, etc. Never use `text-foreground` or `text-muted-foreground` without verifying contrast.
2. **Backgrounds**: Use `rgba(255,255,255,0.04–0.08)` or emerald-tinted equivalents. Never use `bg-background`, `bg-card`, or `bg-muted` — they are effectively black.
3. **Borders**: Use `border-white/10` or `border-emerald-500/30`. Never use `border-flat` or `border-border`.
4. **Hover states**: Brighten toward `rgba(16,185,129,0.18)` (emerald tint) or `white/10`. Must be visibly distinct from the resting state.
5. **Disabled states**: At minimum `white/40` text, `white/3` background — faded but still perceptible.

### Existing override patterns (globals.css)

All Tambo template components used inside the beat-maker are overridden in `src/app/globals.css` under the `/* ---- Beat chat dark-theme overrides ---- */` and `/* ---- Suggestion chip overrides ---- */` sections. **When adding any new Tambo component, add corresponding dark-theme overrides in globals.css.** Use the `data-slot` attributes on Tambo components as selectors.

### Quick contrast check

Before finishing any UI work, ask: "If I screenshot this on a black background, can I read every element?" If the answer is no, fix it.

<!-- tambo-docs-v1.0 -->

## Tambo AI Framework

This project uses **Tambo AI** for building AI assistants with generative UI and MCP support.

**Documentation**: https://docs.tambo.co/llms.txt

**CLI**: Use `npx tambo` to add UI components or upgrade. Run `npx tambo help` to learn more.
