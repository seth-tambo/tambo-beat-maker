/**
 * Preset drum patterns that AI tools can reference by name.
 * Each pattern defines which pads to create, which steps are active,
 * and optionally a drum machine bank for sonic variety.
 */

import type { DrumBank } from "./sound-map";

export interface PatternPad {
  label: string;
  color: string;
  steps: number[];
}

export interface DrumPattern {
  name: string;
  description: string;
  bpm: number;
  bank?: DrumBank;
  pads: PatternPad[];
}

export const DRUM_PATTERNS: Record<string, DrumPattern> = {
  // ---- Classic / Foundational ----

  "four-on-the-floor": {
    name: "Four on the Floor",
    description: "Classic dance beat with kick on every beat",
    bpm: 120,
    bank: "RolandTR909",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
    ],
  },

  "boom-bap": {
    name: "Boom Bap",
    description: "Classic hip-hop pattern with swing feel",
    bpm: 90,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 10, 16] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Open HH", color: "Open HH", steps: [6, 22] },
    ],
  },

  breakbeat: {
    name: "Breakbeat",
    description: "Funky broken beat with syncopated kicks",
    bpm: 130,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 6, 14, 16, 22] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
    ],
  },

  trap: {
    name: "Trap",
    description: "Modern trap beat with hi-hat rolls and 808 sub",
    bpm: 140,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 7, 14, 16, 24] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 6, 8, 10, 11, 12, 14, 16, 18, 20, 22, 23, 24, 26, 28, 30, 31] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
    ],
  },

  reggaeton: {
    name: "Reggaeton",
    description: "Dembow rhythm — the backbone of reggaeton",
    bpm: 95,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 6, 16, 22] },
      { label: "Snare", color: "Snare", steps: [4, 12, 20, 28] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Rim", color: "Rim", steps: [4, 12, 20, 28] },
    ],
  },

  "drum-and-bass": {
    name: "Drum and Bass",
    description: "Fast-paced jungle/DnB pattern with Amen-style kick placement",
    bpm: 174,
    bank: "RolandTR909",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 18] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
    ],
  },

  // ---- Electronic / Dance ----

  house: {
    name: "House",
    description: "Deep house groove with offbeat hats and claps",
    bpm: 124,
    bank: "RolandTR909",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [2, 6, 10, 14, 18, 22, 26, 30] },
      { label: "Open HH", color: "Open HH", steps: [4, 12, 20, 28] },
    ],
  },

  techno: {
    name: "Techno",
    description: "Driving techno with heavy kick and sparse percussion",
    bpm: 130,
    bank: "RolandTR909",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Ride", color: "Ride", steps: [2, 6, 10, 14, 18, 22, 26, 30] },
      { label: "Rim", color: "Rim", steps: [4, 20] },
    ],
  },

  "acid-house": {
    name: "Acid House",
    description: "Classic acid house pattern — 303-era Chicago",
    bpm: 126,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Open HH", color: "Open HH", steps: [4, 12, 20, 28] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
      { label: "Cowbell", color: "Cowbell", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
    ],
  },

  garage: {
    name: "UK Garage",
    description: "Shuffled 2-step garage beat with skippy hats",
    bpm: 132,
    bank: "RolandTR909",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 10, 16, 26] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27, 30] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
    ],
  },

  trance: {
    name: "Trance",
    description: "Uplifting trance beat with offbeat bass drum and rides",
    bpm: 138,
    bank: "RolandTR909",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [4, 12, 20, 28] },
      { label: "Ride", color: "Ride", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
    ],
  },

  dubstep: {
    name: "Dubstep",
    description: "Half-time dubstep pattern with deep sub hits",
    bpm: 140,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0] },
      { label: "Snare", color: "Snare", steps: [16] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Sub", color: "Sub", steps: [0, 6, 12] },
      { label: "Clap", color: "Clap", steps: [16] },
    ],
  },

  // ---- Hip-Hop Variants ----

  "lo-fi": {
    name: "Lo-Fi Hip Hop",
    description: "Chill lo-fi beat with lazy kick placement",
    bpm: 85,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 10, 16] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 6, 8, 12, 14, 16, 20, 22, 24, 28, 30] },
      { label: "Rim", color: "Rim", steps: [4, 20] },
    ],
  },

  drill: {
    name: "UK Drill",
    description: "Dark sliding 808 pattern with triplet hats",
    bpm: 142,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 5, 14, 16, 21] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 5, 6, 8, 10, 12, 13, 14, 16, 18, 20, 21, 22, 24, 26, 28, 29, 30] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
      { label: "Perc", color: "Perc", steps: [4, 12, 20, 28] },
    ],
  },

  "old-school-hip-hop": {
    name: "Old School Hip Hop",
    description: "Classic 80s hip-hop breakbeat feel",
    bpm: 96,
    bank: "LinnDrum",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 4, 10, 16, 20] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
      { label: "Cowbell", color: "Cowbell", steps: [0, 8, 16, 24] },
    ],
  },

  // ---- World / Latin ----

  samba: {
    name: "Samba",
    description: "Brazilian samba with surdo and shaker groove",
    bpm: 100,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 12, 16, 28] },
      { label: "Snare", color: "Snare", steps: [4, 8, 12, 20, 24, 28] },
      { label: "Shaker", color: "Shaker", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
      { label: "Rim", color: "Rim", steps: [2, 6, 10, 14, 18, 22, 26, 30] },
    ],
  },

  "bossa-nova": {
    name: "Bossa Nova",
    description: "Laid-back Brazilian rhythm with cross-stick pattern",
    bpm: 130,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 10, 16, 26] },
      { label: "Rim", color: "Rim", steps: [4, 8, 12, 20, 24, 28] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Shaker", color: "Shaker", steps: [2, 6, 10, 14, 18, 22, 26, 30] },
    ],
  },

  afrobeat: {
    name: "Afrobeat",
    description: "West African polyrhythmic groove in the Fela Kuti tradition",
    bpm: 110,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 6, 10, 16, 22, 26] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
      { label: "Shaker", color: "Shaker", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Conga", color: "Conga", steps: [2, 8, 14, 18, 24, 30] },
    ],
  },

  dancehall: {
    name: "Dancehall",
    description: "Jamaican dancehall one-drop riddim",
    bpm: 90,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 14, 24] },
      { label: "Snare", color: "Snare", steps: [10, 26] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Rim", color: "Rim", steps: [4, 12, 20, 28] },
    ],
  },

  cumbia: {
    name: "Cumbia",
    description: "Colombian cumbia groove with shaker and guiro feel",
    bpm: 95,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Snare", color: "Snare", steps: [4, 12, 20, 28] },
      { label: "Shaker", color: "Shaker", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
      { label: "Conga", color: "Conga", steps: [2, 6, 10, 18, 22, 26] },
    ],
  },

  // ---- Rock / Funk / Soul ----

  funk: {
    name: "Funk",
    description: "Tight funk groove with ghost snares and syncopation",
    bpm: 105,
    bank: "LinnDrum",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 6, 10, 16, 22, 26] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
      { label: "Open HH", color: "Open HH", steps: [4, 20] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
    ],
  },

  disco: {
    name: "Disco",
    description: "Classic disco four-on-the-floor with open hats and cowbell",
    bpm: 118,
    bank: "RolandTR909",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
      { label: "Open HH", color: "Open HH", steps: [4, 12, 20, 28] },
      { label: "Cowbell", color: "Cowbell", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
    ],
  },

  rock: {
    name: "Rock",
    description: "Standard rock beat with ride and crash",
    bpm: 120,
    bank: "LinnDrum",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 16] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Crash", color: "Crash", steps: [0] },
    ],
  },

  // ---- Synthwave / Retro ----

  synthwave: {
    name: "Synthwave",
    description: "80s-style synthwave with LinnDrum feel",
    bpm: 118,
    bank: "LinnDrum",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Snare", color: "Snare", steps: [8, 24] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Tom", color: "Tom", steps: [12, 28] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
    ],
  },

  // ---- Experimental ----

  halftime: {
    name: "Halftime",
    description: "Slow, heavy halftime pattern — great for bass music",
    bpm: 150,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 6] },
      { label: "Snare", color: "Snare", steps: [16] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 4, 8, 12, 16, 20, 24, 28] },
      { label: "Perc", color: "Perc", steps: [10, 26] },
    ],
  },

  footwork: {
    name: "Footwork",
    description: "Chicago juke/footwork with rapid-fire snare hits",
    bpm: 160,
    bank: "RolandTR808",
    pads: [
      { label: "Kick", color: "Kick", steps: [0, 8, 16, 24] },
      { label: "Snare", color: "Snare", steps: [4, 6, 8, 12, 14, 20, 22, 24, 28, 30] },
      { label: "Hi-Hat", color: "Hi-Hat", steps: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
      { label: "Clap", color: "Clap", steps: [8, 24] },
    ],
  },
};

export const PATTERN_NAMES = Object.keys(DRUM_PATTERNS);
