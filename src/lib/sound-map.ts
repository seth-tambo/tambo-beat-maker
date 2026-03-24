/**
 * Maps pad labels to Strudel sound abbreviations.
 * Used by the audio engine to convert canvas pads into playable sounds.
 */

const LABEL_TO_SOUND: Record<string, string> = {
  // Core drums
  kick: "bd",
  snare: "sd",
  "hi-hat": "hh",
  clap: "cp",
  tom: "mt",
  "high tom": "ht",
  "low tom": "lt",
  rim: "rim",
  perc: "perc",
  sub: "bd:1",
  "open hh": "oh",
  crash: "cr",
  ride: "rd",
  // Extended percussion
  cowbell: "cb",
  shaker: "hh:3",
  tambourine: "oh:2",
  conga: "ht:1",
  bongo: "mt:1",
  maracas: "hh:2",
  guiro: "rim:1",
  cabasa: "hh:4",
  // Tonal / FX
  fx: "misc",
  "noise hit": "perc:2",
};

/**
 * Available drum machine banks from Tidal Drum Machines CDN.
 * Each bank provides bd, sd, hh, oh, cp, rim, cb, cr, rd, etc.
 */
export const DRUM_BANKS = [
  "RolandTR808",
  "RolandTR909",
  "LinnDrum",
  "RolandCR78",
  "AkaiLinn",
  "RhythmAce",
  "ViscoSpaceDrum",
  "KorgMini",
  "KorgKPR77",
  "RolandTR707",
  "RolandTR606",
  "RolandTR505",
  "RolandCompuRhythm",
  "Oberheim",
  "Alesis",
  "Boss",
  "Casio",
  "Yamaha",
  "Simmons",
] as const;

export type DrumBank = (typeof DRUM_BANKS)[number];
export const DEFAULT_BANK: DrumBank = "RolandTR808";

/**
 * Resolve a pad label to a Strudel sound name.
 * Tries exact match, then partial match, then defaults to "bd".
 */
export function getSoundForLabel(label: string): string {
  const lower = label.toLowerCase();

  // Exact match
  if (LABEL_TO_SOUND[lower]) return LABEL_TO_SOUND[lower];

  // Partial match
  for (const [key, sound] of Object.entries(LABEL_TO_SOUND)) {
    if (key.includes(lower) || lower.includes(key)) return sound;
  }

  // Common aliases
  if (lower.includes("bass")) return "bd";
  if (lower.includes("hat") || lower === "hh") return "hh";
  if (lower.includes("cymbal")) return "cr";
  if (lower.includes("bell")) return "cb";
  if (lower.includes("shake") || lower.includes("maraca")) return "hh:3";
  if (lower.includes("tamb")) return "oh:2";

  return "bd";
}

export const AVAILABLE_SOUNDS = Object.entries(LABEL_TO_SOUND).map(
  ([label, sound]) => `${label} (${sound})`,
);
