/**
 * Maps pad labels to Strudel sound abbreviations.
 * Used by the audio engine to convert canvas pads into playable sounds.
 */

const LABEL_TO_SOUND: Record<string, string> = {
  kick: "bd",
  snare: "sd",
  "hi-hat": "hh",
  clap: "cp",
  tom: "mt",
  rim: "rim",
  perc: "perc",
  fx: "misc",
  sub: "bd:1",
  "open hh": "oh",
  crash: "cr",
  ride: "rd",
};

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

  return "bd";
}

export const AVAILABLE_SOUNDS = Object.entries(LABEL_TO_SOUND).map(
  ([label, sound]) => `${label} (${sound})`,
);
