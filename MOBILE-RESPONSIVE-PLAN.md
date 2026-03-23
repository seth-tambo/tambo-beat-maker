# Responsive Beat Maker: Mobile-First (Phases 1–4)

## Context

The beat maker is currently desktop-only: mouse events, no touch handlers, no breakpoints, fixed 110px pads on an infinite draggable canvas, a 780px piano roll, and a 300-400px fixed sidebar. On a phone, the app is unusable — pads can't be discovered on an infinite canvas, double-click doesn't exist for touch, and the piano roll overflows. This plan adds a native-feeling mobile experience. Tablet refinements and polish are deferred to a future session.

---

## Design Decisions

### Mobile (< 640px) — "Pad Grid" mode, no canvas
The infinite canvas is the wrong paradigm for a phone. Instead, mobile gets a **vertical stack layout** with pads in a CSS grid. This isn't degradation — it's adaptation. A beat maker on a phone should feel like a drum machine, not a shrunken desktop app. Pad order is by creation order; a dedicated **reorder dialog** (list view with drag handles) lets users rearrange without conflicting with grid tap/long-press gestures.

### Desktop / Tablet (>= 640px) — Unchanged for now
No regressions. Existing mouse-driven canvas, sidebar, and piano roll stay exactly as they are. Tablet touch refinements deferred.

---

## Phase 1: Foundation (no visual changes, no regressions)

### 1a. Breakpoint hook
**New file:** `src/hooks/use-breakpoint.ts`
- Returns `"mobile" | "tablet" | "desktop"` using `window.matchMedia`
- SSR-safe: defaults to `"desktop"` on server, corrects on mount
- Breakpoints: mobile < 640px, tablet 640–1024px, desktop > 1024px

### 1b. Pointer events migration
**Modify:** `src/components/beat-maker/BeatCanvas.tsx`
- Replace all `onMouseDown/Move/Up` with `onPointerDown/Move/Up` (Pointer Events API unifies mouse + touch)
- Replace `MouseEvent` type imports with `PointerEvent`
- Add `touch-action: none` on the canvas container to prevent browser scroll interference
- Desktop behavior must remain identical — this is a transparent refactor

### 1c. Viewport meta for safe areas
**Modify:** `src/app/layout.tsx`
- Export a Next.js `viewport` config with `viewportFit: "cover"` so `env(safe-area-inset-bottom)` works on notched phones

---

## Phase 2: Mobile Pad Grid + Transport

### 2a. Mobile pad grid
**New file:** `src/components/beat-maker/MobilePadGrid.tsx`
- Reads pads from `useCanvasStore()` (same store, different view)
- CSS Grid: 3 columns on phones, `gap-2`, pads at 90px
- Pads rendered by array order (x,y ignored)
- Single tap on pad → opens piano roll (full-screen overlay)
- Long-press (300ms) → shows action popover (Remove, Edit Pattern, Reorder)
- "Reorder" action opens a **reorder dialog**: a modal list of all pads (color swatch + label) with drag handles. User drags items to rearrange. Calls `reorderPads()` from canvas-store (already implemented at line ~203). This keeps reorder separate from the grid tap/long-press flow.
- Pad visual: same rounded-xl, glow, color styling as desktop — extract a shared `<PadVisual>` from BeatCanvas

### 2b. Extract shared PadVisual
**New file:** `src/components/beat-maker/PadVisual.tsx`
- Extracted from BeatCanvas pad rendering (lines ~355-413)
- Props: `pad`, `isActive`, `size`, `onClick`, `onLongPress`, `onRemove`, `onOpenRoll`
- Used by both `BeatCanvas` (desktop) and `MobilePadGrid` (mobile)

### 2c. Mobile transport bar
**New file:** `src/components/beat-maker/MobileTransport.tsx`
- Fixed to bottom of screen, ~64px tall, with `pb-[env(safe-area-inset-bottom)]`
- Horizontal layout: Play/Pause button, BPM stepper (−/value/+), Volume stepper
- Share button moves to top bar
- Dark theme: `bg-[#0d1512]/95 backdrop-blur-xl border-t border-white/[0.08]`

### 2d. Responsive layout shell
**New file:** `src/components/beat-maker/ResponsiveLayout.tsx`
- Uses `useBreakpoint()` hook for conditional rendering (not CSS show/hide — avoids mounting unused component trees and double audio subscriptions)
- Mobile: `<MobileLayout />` (grid + transport + top bar)
- Tablet/Desktop: `<BeatCanvas />` + `<ChatSidebar />` (current behavior)

### 2e. Wire it up
**Modify:** `src/app/page.tsx`
- Replace `<BeatCanvas /><ChatSidebar />` with `<ResponsiveLayout />`

---

## Phase 3: Mobile Piano Roll

### 3a. Extract shared grid renderer
**Modify:** `src/components/beat-maker/PianoRoll.tsx`
- Extract the note grid (rows, columns, playhead, toggle logic) into `<PianoRollGrid>` sub-component
- Props: `width`, `height`, `cellWidth`, `cellHeight`, `steps` (visible range), `padId`, `padColor`
- Desktop `PianoRoll` passes fixed 780×520 and 28×22 cell sizes

### 3b. Mobile piano roll overlay
**New file:** `src/components/beat-maker/MobilePianoRoll.tsx`
- Full-screen overlay, slides up with `framer-motion` (already installed)
- Header: back arrow + pad color swatch + pad label (48px)
- Key column: 48px wide (down from 64px)
- Shows 16 steps at a time, cell width = `Math.floor((viewportWidth - 48) / 16)`
- Cell height: 28px (larger touch targets than desktop's 22px)
- Segment control below header: "1–16" | "17–32" for quick step range switching
- Default note range: 2 octaves (C3–B4) with octave up/down buttons to reduce scrolling
- Tap to toggle notes (same as desktop click)

---

## Phase 4: Mobile Chat

### 4a. Chat bottom sheet
**New file:** `src/components/beat-maker/ChatBottomSheet.tsx`
- Reuses existing Tambo components: `ThreadContent`, `MessageInput`, `MessageSuggestions`
- **Collapsed state** (default): thin bar (~56px) above the transport bar, shows input field + send button. Suggestion chips in a horizontal scroll row above input.
- **Expanded state** (tap input or swipe up): slides up to ~75% viewport height via `framer-motion`. Full message history with scroll. Input pinned at bottom. Drag handle at top. Tap outside to collapse.
- Dark theme overrides in `globals.css` following existing `data-slot` pattern

### 4b. Integrate into mobile layout
**Modify:** `src/components/beat-maker/ResponsiveLayout.tsx`
- Add `ChatBottomSheet` to the mobile layout, positioned between pad grid and transport

---

## Deferred (future session)
- **Tablet refinements**: pinch-to-zoom, bottom-sheet piano roll, slide-over chat
- **Polish**: framer-motion transitions for all sheets, haptic feedback, mobile empty state, iOS Safari / Android Chrome testing

---

## Key Architecture Rules

1. **One store, multiple views.** `canvas-store.ts` is layout-agnostic. Mobile ignores x,y; desktop uses them. No new state fields for layout mode.
2. **Conditional rendering via JS hook, not CSS display toggling.** Avoids mounting unused component trees and prevents double audio-engine subscriptions.
3. **Pointer Events unify mouse + touch.** One handler codepath in BeatCanvas, not separate mouse/touch handlers.
4. **Shared components over duplication.** `PadVisual` and `PianoRollGrid` are shared across mobile/desktop to avoid duplicating bugs.

## Files to Create
- `src/hooks/use-breakpoint.ts`
- `src/components/beat-maker/PadVisual.tsx`
- `src/components/beat-maker/MobilePadGrid.tsx` (includes reorder dialog)
- `src/components/beat-maker/MobileTransport.tsx`
- `src/components/beat-maker/MobilePianoRoll.tsx`
- `src/components/beat-maker/ChatBottomSheet.tsx`
- `src/components/beat-maker/ResponsiveLayout.tsx`

## Files to Modify
- `src/components/beat-maker/BeatCanvas.tsx` — pointer events, extract PadVisual
- `src/components/beat-maker/PianoRoll.tsx` — extract PianoRollGrid
- `src/app/page.tsx` — swap to ResponsiveLayout
- `src/app/layout.tsx` — viewport-fit meta
- `src/app/globals.css` — dark theme overrides for new mobile components

## Verification
1. **Desktop**: Open at >1024px width — everything should behave exactly as before (no regressions)
2. **Mobile**: Chrome DevTools device mode (iPhone 14, 390px) — pad grid visible, transport docked, tap pad opens full-screen piano roll, chat bottom sheet works, reorder dialog reorders pads
3. **Audio**: Play/stop works on mobile (Strudel reads from same store)
4. **Shared boards**: Open a `/board/[id]` link on mobile — pads hydrate into grid correctly
