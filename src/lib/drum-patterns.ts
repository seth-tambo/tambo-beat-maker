/**
 * Preset drum patterns that AI tools can reference by name.
 * Each pattern defines which pads to create and which steps are active.
 */

export interface PatternPad {
  label: string;
  color: string;
  steps: number[];
}

export interface DrumPattern {
  name: string;
  description: string;
  bpm: number;
  pads: PatternPad[];
}

export const DRUM_PATTERNS: Record<string, DrumPattern> = {
  "four-on-the-floor": {
    name: "Four on the Floor",
    description: "Classic dance beat with kick on every beat",
    bpm: 120,
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
    ],
  },
  "boom-bap": {
    name: "Boom Bap",
    description: "Classic hip-hop pattern",
    bpm: 90,
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 10, 16] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Open HH", color: "Open HH", steps: [6, 22] },
    ],
  },
  breakbeat: {
    name: "Breakbeat",
    description: "Funky broken beat pattern",
    bpm: 130,
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 6, 14, 16, 22] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
    ],
  },
  trap: {
    name: "Trap",
    description: "Modern trap beat with hi-hat rolls",
    bpm: 140,
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 7, 14, 16, 24] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 6, 8, 10, 11, 12, 14, 16, 18, 20, 22, 23, 24, 26, 28, 30, 31] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
    ],
  },
  reggaeton: {
    name: "Reggaeton",
    description: "Dembow rhythm pattern",
    bpm: 95,
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 6, 16, 22] },
      { label: "Snare", color: "Snare", steps: [4, 12, 20, 28] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Rim", color: "Rim", steps: [4, 12, 20, 28] },
    ],
  },
  "drum-and-bass": {
    name: "Drum and Bass",
    description: "Fast-paced jungle/DnB pattern",
    bpm: 174,
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 18] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
    ],
  },
};

export const PATTERN_NAMES = Object.keys(DRUM_PATTERNS);
