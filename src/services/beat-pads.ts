/**
 * Tool functions for AI to manipulate beat pads on the canvas.
 * These run outside React, writing directly to the canvas store.
 */

import {
  addPad,
  removePad,
  clearAllPads,
  getCanvasSnapshot,
  togglePadMute,
  setNotesForPad,
  PAD_COLORS,
  type PadColor,
} from "@/lib/canvas-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, PadColor> = {};
for (const c of PAD_COLORS) {
  COLOR_MAP[c.label.toLowerCase()] = c;
}

// Default step patterns so pads make sound immediately when created
const DEFAULT_STEPS: Record<string, number[]> = {
  kick:     [0, 8, 16, 24],
  snare:    [8, 24],
  "hi-hat": [0, 4, 8, 12, 16, 20, 24, 28],
  clap:     [8, 24],
  tom:      [12, 28],
  rim:      [4, 12, 20, 28],
  perc:     [2, 10, 18, 26],
  fx:       [0, 16],
  sub:      [0, 16],
  "open hh":[6, 22],
  crash:    [0],
  ride:     [0, 4, 8, 12, 16, 20, 24, 28],
};

function getDefaultSteps(label: string): number[] {
  const lower = label.toLowerCase();
  if (DEFAULT_STEPS[lower]) return DEFAULT_STEPS[lower];
  for (const [key, steps] of Object.entries(DEFAULT_STEPS)) {
    if (key.includes(lower) || lower.includes(key)) return steps;
  }
  return [0, 8, 16, 24]; // fallback: four-on-the-floor
}

function resolveColor(label: string): PadColor {
  // Try to match by label first
  const lower = label.toLowerCase();
  for (const c of PAD_COLORS) {
    if (c.label.toLowerCase() === lower) return c;
  }
  // Try partial match
  for (const c of PAD_COLORS) {
    if (c.label.toLowerCase().includes(lower) || lower.includes(c.label.toLowerCase())) return c;
  }
  // Pick a random color
  return PAD_COLORS[Math.floor(Math.random() * PAD_COLORS.length)];
}

// ---------------------------------------------------------------------------
// Grid placement
// ---------------------------------------------------------------------------

const PAD_SIZE = 110;
const GAP = 20;
const CELL = PAD_SIZE + GAP; // 130px per grid cell
const COLS = 4;

// Grid origin: aligned with centered transport columns (x=-250,-120,10,140),
// first row sits one CELL below the transport row (y=-130).
const GRID_X = -250;
const GRID_ROW0_Y = -CELL + CELL; // 0 — directly below transport row at y=-130

/** Find the next open grid cell, scanning left→right, top→bottom. */
function nextGridPosition(): { x: number; y: number } {
  const existing = getCanvasSnapshot().pads;

  for (let slot = 0; slot < 200; slot++) {
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const cx = GRID_X + col * CELL;
    const cy = GRID_ROW0_Y + row * CELL; // rows grow downward

    const occupied = existing.some(
      (p) => Math.abs(p.x - cx) < CELL / 2 && Math.abs(p.y - cy) < CELL / 2,
    );
    if (!occupied) return { x: cx, y: cy };
  }

  // Fallback (200+ pads): just extend the grid
  return { x: GRID_X, y: GRID_ROW0_Y + 50 * CELL };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function createBeatPad(input: { label: string; color?: string }) {
  const color = input.color
    ? resolveColor(input.color)
    : resolveColor(input.label);

  // Use the provided label (override the color's default label)
  const padColor: PadColor = { ...color, label: input.label };

  const { x, y } = nextGridPosition();
  const pad = addPad({ x, y, color: padColor });

  // Set default notes so the pad makes sound immediately
  const defaultSteps = getDefaultSteps(padColor.label);
  const notes = new Set<string>();
  for (const step of defaultSteps) {
    notes.add(`C3-${step}`);
  }
  setNotesForPad(pad.id, notes);

  return {
    id: pad.id,
    label: pad.color.label,
    color: pad.color.bg,
    x: pad.x,
    y: pad.y,
  };
}

export function removeBeatPad(input: { id?: string; label?: string }) {
  const snapshot = getCanvasSnapshot();

  if (input.id) {
    const removed = removePad(input.id);
    return { success: removed, removedId: input.id };
  }

  if (input.label) {
    const lower = input.label.toLowerCase();
    const match = snapshot.pads.find(
      (p) => p.label.toLowerCase() === lower,
    );
    if (match) {
      const removed = removePad(match.id);
      return { success: removed, removedId: match.id, label: match.label };
    }
    return { success: false, error: `No pad found with label "${input.label}"` };
  }

  return { success: false, error: "Provide either id or label" };
}

export function listBeatPads() {
  return getCanvasSnapshot().pads;
}

export function clearAllBeatPads() {
  clearAllPads();
  return { success: true, message: "All pads cleared" };
}

export function toggleBeatPadMute(input: { id?: string; label?: string }) {
  const snapshot = getCanvasSnapshot();

  if (input.id) {
    const pad = snapshot.pads.find((p) => p.id === input.id);
    if (!pad) return { success: false, error: `No pad found with id "${input.id}"` };
    togglePadMute(input.id);
    return { success: true, padId: input.id, muted: !pad.muted };
  }

  if (input.label) {
    const lower = input.label.toLowerCase();
    const match = snapshot.pads.find((p) => p.label.toLowerCase() === lower);
    if (match) {
      togglePadMute(match.id);
      return { success: true, padId: match.id, label: match.label, muted: !match.muted };
    }
    return { success: false, error: `No pad found with label "${input.label}"` };
  }

  return { success: false, error: "Provide either id or label" };
}
