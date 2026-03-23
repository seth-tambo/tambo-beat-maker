/**
 * Strudel sample/synth preloading configuration.
 * Loads drum machine sample banks from CDN and registers
 * short aliases (bd, sd, hh, etc.) so patterns can use plain sound names.
 *
 * Called by StrudelService during initialization as the `prebake` option
 * passed to `initStrudel()`. At this point, Strudel's webaudio system
 * is already set up, so we only need to load additional sample banks.
 *
 * IMPORTANT: Both `samples` and `aliasBank` must come from `@strudel/web`
 * (the same module that owns the initStrudel lifecycle). `@strudel/web`
 * bundles its own internal copy of superdough — importing the standalone
 * `superdough` package would register samples in a separate, disconnected
 * registry that the audio output never reads from.
 */

const CDN = "https://strudel.b-cdn.net";

/**
 * Custom prebake function passed to `initStrudel({ prebake })`.
 * Strudel's `defaultPrebake()` already registers synth sounds;
 * this adds drum machine sample banks and short aliases.
 */
export async function prebake(): Promise<void> {
  const { samples, aliasBank } = await import("@strudel/web");

  // Load drum machine sample banks from CDN
  await samples(
    `${CDN}/tidal-drum-machines.json`,
    `${CDN}/tidal-drum-machines/machines/`,
    { prebake: true, tag: "drum-machines" },
  );

  // Create short aliases (bd, sd, hh, etc.) so patterns use plain sound names.
  // Without aliasBank, only compound keys like "RolandTR808_bd" exist.
  await aliasBank(`${CDN}/tidal-drum-machines-alias.json`);

  console.log("[prebake] drum samples + aliases loaded");
}
