/**
 * Tambo AI tool for discovering available sounds at runtime.
 * Queries the Strudel soundMap and categorizes results.
 */

// Known synth waveforms
const SYNTH_WAVEFORMS = new Set([
  "sine", "sin", "triangle", "tri", "square", "sqr", "sawtooth", "saw",
  "supersaw", "pulse", "sbd", "bytebeat", "white", "pink", "brown", "crackle",
]);

// Drum machine prefixes
const DRUM_PREFIXES = [
  "roland", "tr", "linn", "oberheim", "dmx", "emu", "alesis",
  "boss", "korg", "simmons", "casio", "yamaha", "akai",
];

// Common drum sample names
const DRUM_SAMPLES = new Set([
  "bd", "sd", "hh", "oh", "cp", "rim", "cb", "cr", "rd", "ht", "mt", "lt", "perc", "tom",
]);

// Known sample pack names
const SAMPLE_PACKS = new Set([
  "casio", "crow", "insect", "wind", "jazz", "metal", "east", "space", "numbers", "num",
]);

export async function listSamples(input: { category?: string }): Promise<{ summary: string }> {
  const { soundMap } = await import("superdough");
  const sounds = soundMap.get();
  const soundNames = Object.keys(sounds);

  const categories: Record<string, string[]> = {
    synths: [],
    drums: [],
    instruments: [],
    soundfonts: [],
    samples: [],
    other: [],
  };

  for (const name of soundNames) {
    const lowerName = name.toLowerCase();

    if (SYNTH_WAVEFORMS.has(lowerName)) {
      categories.synths.push(name);
    } else if (lowerName.startsWith("gm_") || lowerName.includes("_sf2_")) {
      categories.soundfonts.push(name);
    } else if (
      DRUM_PREFIXES.some((prefix) => lowerName.includes(prefix)) ||
      DRUM_SAMPLES.has(lowerName) ||
      [...DRUM_SAMPLES].some((s) => lowerName.startsWith(s + "_"))
    ) {
      categories.drums.push(name);
    } else if (
      lowerName.includes("vcsl") ||
      ["piano", "violin", "cello", "flute", "trumpet", "timpani"].some((inst) =>
        lowerName.includes(inst),
      )
    ) {
      categories.instruments.push(name);
    } else if (SAMPLE_PACKS.has(lowerName)) {
      categories.samples.push(name);
    } else {
      categories.other.push(name);
    }
  }

  const { category } = input;

  // Filter by category if specified
  if (category) {
    const lowerCategory = category.toLowerCase();
    const matchedCategory = Object.keys(categories).find(
      (cat) => cat.includes(lowerCategory) || lowerCategory.includes(cat),
    );

    if (matchedCategory && categories[matchedCategory].length > 0) {
      const cat = matchedCategory;
      const list = categories[cat];
      return {
        summary: `## ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${list.length} sounds)\n\n${list.sort().join(", ")}`,
      };
    }

    // Search by name
    const matches = soundNames.filter((name) =>
      name.toLowerCase().includes(lowerCategory),
    );
    if (matches.length > 0) {
      return {
        summary: `## Search results for "${category}" (${matches.length} matches)\n\n${matches.sort().join(", ")}`,
      };
    }

    return {
      summary: `No sounds found matching "${category}". Try: synths, drums, instruments, soundfonts, samples`,
    };
  }

  // Return summary of all categories
  const lines: string[] = [`## Available Sounds (${soundNames.length} total)\n`];

  for (const [cat, catSounds] of Object.entries(categories)) {
    if (catSounds.length > 0) {
      const preview = catSounds.slice(0, 10).sort().join(", ");
      const more = catSounds.length > 10 ? ` ... and ${catSounds.length - 10} more` : "";
      lines.push(
        `**${cat.charAt(0).toUpperCase() + cat.slice(1)}** (${catSounds.length}): ${preview}${more}`,
      );
    }
  }

  lines.push(
    `\nUse listSamples with a category (synths, drums, instruments, soundfonts, samples) or search term for full lists.`,
  );

  return { summary: lines.join("\n") };
}
