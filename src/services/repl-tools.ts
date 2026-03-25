/**
 * Tambo AI tool for evaluating free-form Strudel patterns.
 * The AI writes Strudel code behind the scenes -- the user never sees it.
 *
 * Includes sample validation with fuzzy-match suggestions so the AI
 * can self-correct on the first retry.
 */

import { StrudelService } from "@/lib/audio-engine";

// ---------------------------------------------------------------------------
// Sample validation helpers
// ---------------------------------------------------------------------------

/** Extract sample/sound names from Strudel code. */
function extractSampleNames(code: string): string[] {
  const samples: string[] = [];

  const patterns = [
    /(?:^|[^a-zA-Z])s\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /sound\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /\.s\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
    /\.sound\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      const words = match[1].match(/[a-zA-Z][a-zA-Z0-9_]*/g) || [];
      samples.push(...words);
    }
  }

  return [...new Set(samples)];
}

/** Find similar sample names using simple string matching. */
function findSimilarSamples(
  name: string,
  availableNames: Set<string>,
  limit = 3,
): string[] {
  const lowerName = name.toLowerCase();
  const similar: { name: string; score: number }[] = [];

  for (const available of availableNames) {
    const lowerAvailable = available.toLowerCase();
    if (lowerAvailable.includes(lowerName) || lowerName.includes(lowerAvailable)) {
      similar.push({ name: available, score: 2 });
    } else if (lowerAvailable.startsWith(lowerName.slice(0, 2))) {
      similar.push({ name: available, score: 1 });
    }
  }

  return similar
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.name);
}

// Known Strudel built-in functions/keywords to skip during validation
const BUILTINS = new Set([
  "bd", "sd", "hh", "oh", "cp", "rim", "cb", "cr", "rd", "ht", "mt", "lt",
  "stack", "cat", "seq", "note", "n", "gain", "room", "lpf", "hpf",
  "delay", "pan", "speed", "begin", "end", "cut", "bank", "sound", "s",
  "sine", "triangle", "square", "sawtooth", "supersaw", "pulse",
  "white", "pink", "brown", "crackle", "piano",
]);

/** Validate sample names against the runtime soundMap. */
async function validateSamples(
  sampleNames: string[],
): Promise<{ missing: string[]; suggestions: Map<string, string[]> }> {
  const { soundMap } = await import("superdough");
  const availableSounds = soundMap.get();
  const availableNames = new Set(Object.keys(availableSounds));

  const missing: string[] = [];
  const suggestions = new Map<string, string[]>();

  for (const name of sampleNames) {
    if (BUILTINS.has(name.toLowerCase())) continue;
    if (availableNames.has(name)) continue;

    // Check partial matches (e.g. bank-prefixed names)
    const nameLower = name.toLowerCase();
    let found = false;
    for (const avail of availableNames) {
      if (avail.toLowerCase().includes(nameLower) || nameLower.includes(avail.toLowerCase())) {
        found = true;
        break;
      }
    }
    if (found) continue;

    missing.push(name);
    const similar = findSimilarSamples(name, availableNames);
    if (similar.length > 0) {
      suggestions.set(name, similar);
    }
  }

  return { missing, suggestions };
}

// ---------------------------------------------------------------------------
// Tool implementation
// ---------------------------------------------------------------------------

export async function evaluatePattern(input: { code: string }): Promise<{
  success: boolean;
  error?: string;
}> {
  const service = StrudelService.instance();

  // Validate sample names before evaluating
  const sampleNames = extractSampleNames(input.code);
  if (sampleNames.length > 0) {
    const { missing, suggestions } = await validateSamples(sampleNames);
    if (missing.length > 0) {
      let errorMsg = `Error: Unknown sample(s): ${missing.join(", ")}.`;
      for (const [sample, similar] of suggestions) {
        if (similar.length > 0) {
          errorMsg += `\n  - "${sample}" -- did you mean: ${similar.join(", ")}?`;
        }
      }
      errorMsg += `\n\nUse the listSamples tool to see available sounds.\n\nCode:\n${input.code}`;
      return { success: false, error: errorMsg };
    }
  }

  return service.evaluateCode(input.code);
}
