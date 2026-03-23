/**
 * Central configuration for Tambo components and tools.
 * Registers beat-pad tools, audio tools, and canvas context helpers.
 */

import {
  createBeatPad,
  removeBeatPad,
  listBeatPads,
  clearAllBeatPads,
  toggleBeatPadMute,
} from "@/services/beat-pads";
import {
  playBeat,
  stopBeat,
  setBeatBpm,
  setPatternForPad,
  addDrumPattern,
} from "@/services/audio-tools";
import {
  saveSoundboard,
  loadSoundboard,
  listSoundboards,
} from "@/services/soundboards";
import { getCanvasSnapshot } from "@/lib/canvas-store";
import { StrudelService } from "@/lib/audio-engine";
import { PATTERN_NAMES } from "@/lib/drum-patterns";
import type { TamboComponent, TamboTool, ContextHelpers } from "@tambo-ai/react";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const tools: TamboTool[] = [
  // --- Pad management ---
  {
    name: "createBeatPad",
    description:
      "Create a new beat pad on the canvas. Use a short, descriptive label like 'Bass', 'Snare', 'Kick', 'Lead', 'Synth', etc. Optionally specify a color hint that maps to an existing pad color.",
    tool: createBeatPad,
    inputSchema: z.object({
      label: z.string().describe("Short name for the pad, e.g. 'Bass', 'Snare'"),
      color: z
        .string()
        .optional()
        .describe("Optional color hint matching an existing color name like 'Kick', 'Snare', 'Hi-Hat'"),
    }),
    outputSchema: z.object({
      id: z.string(),
      label: z.string(),
      color: z.string(),
      x: z.number(),
      y: z.number(),
    }),
  },
  {
    name: "removeBeatPad",
    description:
      "Remove a beat pad from the canvas by its id or label. Use listBeatPads first if you need to find the pad.",
    tool: removeBeatPad,
    inputSchema: z.object({
      id: z.string().optional().describe("The pad id to remove"),
      label: z.string().optional().describe("The pad label to remove (case-insensitive match)"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      removedId: z.string().optional(),
      label: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "listBeatPads",
    description:
      "List all beat pads currently on the canvas with their id, label, color, position, and note count.",
    tool: listBeatPads,
    inputSchema: z.object({}),
    outputSchema: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        color: z.string(),
        x: z.number(),
        y: z.number(),
        muted: z.boolean(),
        hasNotes: z.boolean(),
        noteCount: z.number(),
      }),
    ),
  },
  {
    name: "clearAllBeatPads",
    description: "Remove all beat pads from the canvas.",
    tool: clearAllBeatPads,
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },
  {
    name: "toggleBeatPadMute",
    description:
      "Toggle the mute state of a beat pad. When muted, the pad stays visible but produces no sound during playback.",
    tool: toggleBeatPadMute,
    inputSchema: z.object({
      id: z.string().optional().describe("The pad id to toggle"),
      label: z.string().optional().describe("The pad label to toggle (case-insensitive match)"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      padId: z.string().optional(),
      label: z.string().optional(),
      muted: z.boolean().optional(),
      error: z.string().optional(),
    }),
  },
  // --- Audio playback ---
  {
    name: "playBeat",
    description:
      "Start playing the beat. Converts all pad patterns into audio using Strudel. Pads must have notes set in their piano rolls first.",
    tool: playBeat,
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      bpm: z.number(),
      padCount: z.number(),
    }),
  },
  {
    name: "stopBeat",
    description: "Stop playing the beat.",
    tool: stopBeat,
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
    }),
  },
  {
    name: "setBeatBpm",
    description: "Set the tempo in beats per minute (30-300).",
    tool: setBeatBpm,
    inputSchema: z.object({
      bpm: z.number().min(30).max(300).describe("Tempo in BPM"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      bpm: z.number(),
    }),
  },
  {
    name: "setPatternForPad",
    description:
      "Set the step pattern for an existing pad. Provide step numbers (0-31) where the sound should trigger. Each step is a sixteenth note. Steps 0,8,16,24 = quarter notes. Use this after creating a pad to define its rhythm.",
    tool: setPatternForPad,
    inputSchema: z.object({
      padId: z.string().optional().describe("Pad id to set pattern for"),
      label: z.string().optional().describe("Pad label to find (case-insensitive)"),
      steps: z.array(z.number().min(0).max(31)).describe("Step numbers where the sound triggers (0-31)"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      padId: z.string().optional(),
      stepsActivated: z.number().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "addDrumPattern",
    description: `Load a preset drum pattern. This clears existing pads and creates a complete beat. Available patterns: ${PATTERN_NAMES.join(", ")}. After loading, call playBeat to start playing.`,
    tool: addDrumPattern,
    inputSchema: z.object({
      name: z.string().describe(`Pattern name: ${PATTERN_NAMES.join(", ")}`),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      patternName: z.string().optional(),
      padsCreated: z.number().optional(),
      bpm: z.number().optional(),
      error: z.string().optional(),
    }),
  },
  // --- Soundboard persistence ---
  {
    name: "saveSoundboard",
    description:
      "Save the current canvas state (all pads, notes, BPM) as a named soundboard. Returns a shareable URL that anyone can open to play the beat.",
    tool: saveSoundboard,
    inputSchema: z.object({
      name: z.string().describe("Name for the soundboard, e.g. 'Trap Beat 1'"),
    }),
    outputSchema: z.object({
      id: z.string(),
      name: z.string(),
      shareUrl: z.string(),
      error: z.string().optional(),
    }),
  },
  {
    name: "loadSoundboard",
    description:
      "Load a saved soundboard by its ID, replacing the current canvas state with the saved pads, notes, and BPM.",
    tool: loadSoundboard,
    inputSchema: z.object({
      id: z.string().describe("The soundboard ID to load"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      name: z.string().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "listSoundboards",
    description: "List all saved soundboards with their IDs, names, and creation dates.",
    tool: listSoundboards,
    inputSchema: z.object({}),
    outputSchema: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        createdAt: z.string(),
      }),
    ),
  },
];

// ---------------------------------------------------------------------------
// Components (pads live on canvas, not in chat — empty for now)
// ---------------------------------------------------------------------------

export const components: TamboComponent[] = [];

// ---------------------------------------------------------------------------
// Context Helpers
// ---------------------------------------------------------------------------

export const contextHelpers: ContextHelpers = {
  canvasState: () => getCanvasSnapshot(),
  audioEngineState: () => {
    const service = StrudelService.instance();
    const state = service.getEngineState();
    return {
      isPlaying: state.isPlaying,
      isReady: state.isReady,
      error: state.error,
      instruction: state.error
        ? "There is an audio error. Check the pattern or sounds."
        : null,
    };
  },
};
