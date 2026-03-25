/**
 * Easter egg triggers for the beat maker.
 * Chat messages are checked against known phrases before being sent to Tambo.
 */

import {
  addPad,
  setNotesForPad,
  setVolume,
  getCanvasSnapshot,
  type PadColor,
} from "@/lib/canvas-store";
import {
  centerLeftAnchorSlot,
  getOccupiedSlots,
  nearestOpenSlot,
  slotToPosition,
} from "@/lib/grid-constants";

// ---------------------------------------------------------------------------
// Trigger detection
// ---------------------------------------------------------------------------

const COWBELL_RE = /more\s*cowbell/i;

/**
 * Check a chat message for Easter egg triggers.
 * Returns a trigger key ("cowbell") or null.
 */
export function checkChatTrigger(message: string): string | null {
  if (COWBELL_RE.test(message)) return "cowbell";
  return null;
}

// ---------------------------------------------------------------------------
// More Cowbell
// ---------------------------------------------------------------------------

const COWBELL_COLOR: PadColor = {
  bg: "#b45309",
  glow: "#f59e0b",
  label: "Cowbell",
};

export async function triggerMoreCowbell(): Promise<void> {
  const snapshot = getCanvasSnapshot();

  // Find existing cowbell pad or create one
  const existing = snapshot.pads.find(
    (p) => p.label.toLowerCase() === "cowbell",
  );

  let padId: string;

  if (existing) {
    padId = existing.id;
  } else {
    // getCanvasSnapshot returns flat objects; use the full store for positions
    const fullPads = (await import("@/lib/canvas-store")).getState().pads;
    const occupiedSlots = getOccupiedSlots(fullPads);
    const occupiedSet = new Set(occupiedSlots.keys());
    const anchorSlot = centerLeftAnchorSlot(occupiedSet);
    const slot = nearestOpenSlot(occupiedSet, anchorSlot);
    const { x, y } = slotToPosition(slot);

    const pad = addPad({ x, y, color: COWBELL_COLOR });
    padId = pad.id;
  }

  // ALL 32 steps active
  const allSteps = new Set(
    Array.from({ length: 32 }, (_, i) => `C3-${i}`),
  );
  setNotesForPad(padId, allSteps);

  // Crank it
  setVolume(100);

  // Start playback
  const { play } = await import("@/lib/audio-engine");
  await play();
}
