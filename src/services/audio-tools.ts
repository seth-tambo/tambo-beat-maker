/**
 * Tambo AI tool functions for audio playback control.
 * These run outside React, calling the audio engine + canvas store directly.
 */

import { setBpm, setNotesForPad, clearAllPads, getState } from "@/lib/canvas-store";
import { createBeatPad } from "@/services/beat-pads";
import { DRUM_PATTERNS, PATTERN_NAMES } from "@/lib/drum-patterns";

const STEPS = 32;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export async function playBeat() {
  const { play } = await import("@/lib/audio-engine");
  const success = await play();
  const { pads, bpm } = getState();
  return { success, bpm, padCount: pads.length };
}

export async function stopBeat() {
  const { stop } = await import("@/lib/audio-engine");
  stop();
  return { success: true };
}

export function setBeatBpm(input: { bpm: number }) {
  setBpm(input.bpm);
  return { success: true, bpm: getState().bpm };
}

export function setPatternForPad(input: {
  padId?: string;
  label?: string;
  steps: number[];
}) {
  const { pads, padNotes } = getState();

  // Find pad by id or label
  let pad;
  if (input.padId) {
    pad = pads.find((p) => p.id === input.padId);
  } else if (input.label) {
    const lower = input.label.toLowerCase();
    pad = pads.find((p) => p.color.label.toLowerCase() === lower);
  }

  if (!pad) {
    return {
      success: false,
      error: `No pad found with ${input.padId ? `id "${input.padId}"` : `label "${input.label}"`}`,
    };
  }

  // Build note set from step numbers. Use C3 as the default note row.
  const notes = new Set<string>();
  for (const step of input.steps) {
    if (step >= 0 && step < STEPS) {
      notes.add(`C3-${step}`);
    }
  }

  setNotesForPad(pad.id, notes);
  return { success: true, padId: pad.id, stepsActivated: input.steps.length };
}

export function addDrumPattern(input: { name: string }) {
  const lower = input.name.toLowerCase().replace(/\s+/g, "-");
  const pattern = DRUM_PATTERNS[lower];

  if (!pattern) {
    return {
      success: false,
      error: `Unknown pattern "${input.name}". Available: ${PATTERN_NAMES.join(", ")}`,
    };
  }

  // Clear existing pads
  clearAllPads();

  // Create pads and set their notes, passing the pattern's bank to each pad
  const createdPads: string[] = [];
  for (const padDef of pattern.pads) {
    const result = createBeatPad({
      label: padDef.label,
      color: padDef.color,
      bank: pattern.bank,
    });
    createdPads.push(result.id);

    // Set the step pattern
    const notes = new Set<string>();
    for (const step of padDef.steps) {
      notes.add(`C3-${step}`);
    }
    setNotesForPad(result.id, notes);
  }

  // Set BPM
  setBpm(pattern.bpm);

  return {
    success: true,
    patternName: pattern.name,
    bank: pattern.bank,
    padsCreated: createdPads.length,
    bpm: pattern.bpm,
  };
}
