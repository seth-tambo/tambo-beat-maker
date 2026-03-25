/**
 * Single source of truth for the pad grid layout.
 * Both BeatCanvas.tsx and beat-pads.ts (Tambo tools) import from here
 * so new pads and the organize/sort button always agree on coordinates.
 */

// ---------------------------------------------------------------------------
// Dimensions
// ---------------------------------------------------------------------------

export const PAD_SIZE = 110;
export const GAP = 20;
export const CELL = PAD_SIZE + GAP; // 130px per grid cell
export const GRID_COLS = 4;

/** Top-left corner of the pad grid in canvas coordinates. */
export const GRID_ORIGIN_X = 0;
export const GRID_ORIGIN_Y = 0;

/** Soft cap to prevent runaway pad creation via AI tools. */
export const MAX_PADS = 32;

// ---------------------------------------------------------------------------
// Slot <-> Position conversion
// ---------------------------------------------------------------------------

/** Convert a linear slot index (0, 1, 2, ...) to canvas {x, y}. */
export function slotToPosition(slot: number): { x: number; y: number } {
  const col = slot % GRID_COLS;
  const row = Math.floor(slot / GRID_COLS);
  return {
    x: GRID_ORIGIN_X + col * CELL,
    y: GRID_ORIGIN_Y + row * CELL,
  };
}

/** Find the nearest slot index for a given canvas position. */
export function positionToSlot(x: number, y: number): number {
  const col = Math.max(0, Math.round((x - GRID_ORIGIN_X) / CELL));
  const row = Math.max(0, Math.round((y - GRID_ORIGIN_Y) / CELL));
  return row * GRID_COLS + Math.min(col, GRID_COLS - 1);
}

/** Build a map of slot index -> pad ID from the current pad list. */
export function getOccupiedSlots(pads: { id: string; x: number; y: number }[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const pad of pads) {
    const slot = positionToSlot(pad.x, pad.y);
    map.set(slot, pad.id);
  }
  return map;
}

/** Return the first unoccupied slot index, scanning left-to-right, top-to-bottom. */
export function nextEmptySlot(occupied: Set<number>): number {
  for (let i = 0; i < MAX_PADS; i++) {
    if (!occupied.has(i)) return i;
  }
  return occupied.size; // fallback: next slot after all occupied
}

/**
 * Choose an anchor slot around the center-left of the active pad area.
 * This keeps new pads in open space to the left side of the workspace.
 */
export function centerLeftAnchorSlot(occupied: Set<number>): number {
  if (occupied.size === 0) return 1; // col=1, row=0 for a 4-col grid

  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  for (const slot of occupied) {
    const row = Math.floor(slot / GRID_COLS);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  }

  const row = Math.round((minRow + maxRow) / 2);
  const col = Math.min(1, GRID_COLS - 1);
  return row * GRID_COLS + col;
}

/**
 * Find the nearest unoccupied slot to an anchor slot.
 * Ties are resolved toward upper rows, then left columns for deterministic output.
 */
export function nearestOpenSlot(
  occupied: Set<number>,
  anchorSlot: number,
  maxSlots = MAX_PADS,
): number {
  if (maxSlots <= 0) return 0;

  const anchorCol = ((anchorSlot % GRID_COLS) + GRID_COLS) % GRID_COLS;
  const anchorRow = Math.max(0, Math.floor(anchorSlot / GRID_COLS));

  let bestSlot = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  let bestRow = Number.POSITIVE_INFINITY;
  let bestCol = Number.POSITIVE_INFINITY;

  for (let slot = 0; slot < maxSlots; slot++) {
    if (occupied.has(slot)) continue;
    const col = slot % GRID_COLS;
    const row = Math.floor(slot / GRID_COLS);
    const dCol = col - anchorCol;
    const dRow = row - anchorRow;
    const dist = dCol * dCol + dRow * dRow;

    if (
      dist < bestDist ||
      (dist === bestDist && row < bestRow) ||
      (dist === bestDist && row === bestRow && col < bestCol)
    ) {
      bestSlot = slot;
      bestDist = dist;
      bestRow = row;
      bestCol = col;
    }
  }

  if (bestSlot !== -1) return bestSlot;
  return nextEmptySlot(occupied);
}
