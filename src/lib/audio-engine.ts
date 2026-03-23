/**
 * Strudel audio engine — class-based singleton.
 *
 * Both React components (via StrudelProvider context) and Tambo tools
 * (which run outside React's render tree) access the same instance via
 * StrudelService.instance(). This guarantees a single AudioContext and
 * consistent state.
 *
 * Follows the StrudelLM guide pattern:
 *   - Private constructor, public static instance()
 *   - All Strudel modules dynamically imported (never top-level)
 *   - Prebake inlined to guarantee single module instance
 *   - State change notifications for React context
 *   - Error capture with async scheduler error wait
 *   - Revert-on-failure for pattern evaluation
 *
 * Reads pad/note/BPM state from canvas-store — never duplicates it.
 */
"use client";

import { getState, subscribe } from "./canvas-store";
import { getSoundForLabel } from "./sound-map";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StrudelEngineState {
  isPlaying: boolean;
  isReady: boolean;
  error: string | null;
}

type StateChangeCallback = (state: StrudelEngineState) => void;

// ---------------------------------------------------------------------------
// StrudelService singleton
// ---------------------------------------------------------------------------

const STEPS = 32;

export class StrudelService {
  private static _instance: StrudelService | null = null;

  private isAudioInitialized = false;
  private _initPromise: Promise<void> | null = null;
  private _isPlaying = false;
  private _lastError: string | null = null;

  // Strudel functions captured after dynamic import
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _evaluate: ((code: string, autoplay?: boolean) => Promise<any>) | null = null;
  private _hush: (() => void) | null = null;

  // Debounce timer for live pattern updates
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;

  // Canvas store subscription teardown
  private unsubscribeFromStore: (() => void) | null = null;

  // State change listeners (for React context)
  private stateChangeCallbacks: StateChangeCallback[] = [];

  // Scheduler error capture
  private schedulerError: Error | null = null;
  private schedulerErrorResolve: ((error: Error | null) => void) | null = null;

  // ---------------------------------------------------------------------------
  // Singleton access
  // ---------------------------------------------------------------------------

  private constructor() {} // Private — use .instance()

  static instance(): StrudelService {
    if (!StrudelService._instance) {
      StrudelService._instance = new StrudelService();
    }
    return StrudelService._instance;
  }

  // ---------------------------------------------------------------------------
  // Public state accessors
  // ---------------------------------------------------------------------------

  get isReady(): boolean {
    return this.isAudioInitialized;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  getEngineState(): StrudelEngineState {
    return {
      isPlaying: this._isPlaying,
      isReady: this.isAudioInitialized,
      error: this._lastError,
    };
  }

  // ---------------------------------------------------------------------------
  // State change notifications (for React context)
  // ---------------------------------------------------------------------------

  onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.push(callback);
    return () => {
      this.stateChangeCallbacks = this.stateChangeCallbacks.filter(
        (cb) => cb !== callback,
      );
    };
  }

  private notifyStateChange(): void {
    const state = this.getEngineState();
    this.stateChangeCallbacks.forEach((cb) => cb(state));
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // All Strudel modules are dynamically imported to keep the bundle small.
  // This is CRITICAL — Strudel is large and must not be in the initial bundle.
  // ---------------------------------------------------------------------------

  /**
   * Preload Strudel and register the audio-on-first-click listener.
   * Call this on component mount (useEffect) so the mousedown listener
   * is ready before the user clicks play.
   *
   * Returns a shared promise so concurrent callers (e.g. StrudelProvider
   * mount + user clicking play) wait for the same initialization.
   */
  preload(): Promise<void> {
    if (this.isAudioInitialized) return Promise.resolve();
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doPreload();
    return this._initPromise;
  }

  private async _doPreload(): Promise<void> {
    try {
      console.log("[StrudelService] preloading Strudel...");
      const strudel = await import("@strudel/web");

      const CDN = "https://strudel.b-cdn.net";

      // initStrudel():
      //  1. Calls initAudioOnFirstClick() — registers a document mousedown
      //     listener that resumes the AudioContext on the user's next click
      //  2. Creates the webaudio REPL (scheduler + output)
      //  3. Runs defaultPrebake() — loads synth sounds
      //  4. Runs our custom prebake (inline below) — loads drum samples from CDN
      //
      // CRITICAL: samples() and aliasBank() MUST come from the same `strudel`
      // import that owns initStrudel. @strudel/web bundles its own internal
      // superdough — any separate import (even of @strudel/web itself from
      // another file) can create a second module instance with a disconnected
      // sample registry.
      await strudel.initStrudel({
        prebake: async () => {
          await strudel.samples(
            `${CDN}/tidal-drum-machines.json`,
            `${CDN}/tidal-drum-machines/machines/`,
            { prebake: true, tag: "drum-machines" },
          );
          await strudel.aliasBank(`${CDN}/tidal-drum-machines-alias.json`);
          console.log("[prebake] drum samples + aliases loaded");
        },
      });
      console.log("[StrudelService] initStrudel complete");

      // Capture functions from the ES module exports
      this._evaluate = strudel.evaluate;
      this._hush = strudel.hush;

      console.log(
        "[StrudelService] captured functions — evaluate:",
        typeof this._evaluate,
        "hush:",
        typeof this._hush,
      );

      // Set up global error handlers for async scheduler errors
      // (missing samples surface as unhandled promise rejections)
      this.installErrorHandlers();

      this.isAudioInitialized = true;
      this.notifyStateChange();

      // Subscribe to canvas-store changes for live pattern updates
      this.unsubscribeFromStore = subscribe(() => {
        if (!this._isPlaying) return;
        if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
        this.rebuildTimer = setTimeout(() => this.rebuildAndPlay(), 100);
      });
    } catch (err) {
      console.error("[StrudelService] Failed to preload Strudel:", err);
      // Clear the promise so a retry is possible
      this._initPromise = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  private installErrorHandlers(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("unhandledrejection", (event) => {
      const msg = event.reason?.message ?? String(event.reason);
      if (this.isSampleError(msg)) {
        this.captureSchedulerError(event.reason instanceof Error
          ? event.reason
          : new Error(msg));
      }
    });
  }

  private isSampleError(msg: string): boolean {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return (
      lower.includes("not found") ||
      lower.includes("unknown sound") ||
      lower.includes("no sample")
    );
  }

  private captureSchedulerError(error: Error): void {
    this.schedulerError = error;
    if (this.schedulerErrorResolve) {
      this.schedulerErrorResolve(error);
      this.schedulerErrorResolve = null;
    }
  }

  private clearError(): void {
    this.schedulerError = null;
    this._lastError = null;
  }

  /**
   * Wait for an async scheduler error (e.g. missing sample).
   * Strudel fires these asynchronously after evaluate() returns.
   */
  private waitForSchedulerError(timeoutMs: number): Promise<Error | null> {
    if (this.schedulerError) {
      const err = this.schedulerError;
      this.schedulerError = null;
      return Promise.resolve(err);
    }

    return new Promise<Error | null>((resolve) => {
      const timer = setTimeout(() => {
        this.schedulerErrorResolve = null;
        resolve(null);
      }, timeoutMs);

      this.schedulerErrorResolve = (error) => {
        clearTimeout(timer);
        resolve(error);
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Pattern generation from canvas state
  // ---------------------------------------------------------------------------

  private buildPatternCode(): string | null {
    const { pads, padNotes, bpm, volume } = getState();
    if (pads.length === 0) return null;

    const padPatternCodes: string[] = [];

    for (const pad of pads) {
      if (pad.muted) continue;
      const notes = padNotes.get(pad.id);
      if (!notes || notes.size === 0) continue;

      const sound = getSoundForLabel(pad.color.label);

      // Collect which steps have any active note
      const activeSteps = new Set<number>();
      for (const noteKey of notes) {
        const stepStr = noteKey.split("-").pop();
        if (stepStr !== undefined) {
          activeSteps.add(parseInt(stepStr, 10));
        }
      }

      if (activeSteps.size === 0) continue;

      // Build 32-slot mini-notation: sound name or ~ for rest
      const slots: string[] = [];
      for (let i = 0; i < STEPS; i++) {
        slots.push(activeSteps.has(i) ? sound : "~");
      }

      padPatternCodes.push(`s("${slots.join(" ")}").bank("RolandTR808")`);
    }

    if (padPatternCodes.length === 0) return null;

    // Stack all pad patterns and set tempo.
    // One cycle = one full pass through the 32-slot pattern = 8 beats (32 sixteenth notes).
    // cpm (cycles per minute) = bpm / 8
    const cpm = bpm / 8;
    const gain = volume / 100;
    const combined =
      padPatternCodes.length === 1
        ? padPatternCodes[0]
        : `stack(${padPatternCodes.join(", ")})`;

    return `${combined}.cpm(${cpm}).gain(${gain})`;
  }

  // ---------------------------------------------------------------------------
  // AudioContext resume helper
  // Strudel v1.3.0 has an operator-precedence bug that prevents
  // initAudioOnFirstClick from ever calling AudioContext.resume().
  // We work around this by resuming manually.
  // ---------------------------------------------------------------------------

  private async resumeAudioContext(): Promise<void> {
    const { getAudioContext } = await import("@strudel/web");
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
  }

  // ---------------------------------------------------------------------------
  // Playback controls
  // ---------------------------------------------------------------------------

  /**
   * Build the pattern from canvas state, evaluate it, and start playback.
   * If preload hasn't been called yet (e.g. tool invocation), does it now.
   */
  async play(): Promise<void> {
    if (!this.isAudioInitialized) await this.preload();
    if (!this.isAudioInitialized || !this._evaluate) {
      console.error("[StrudelService] Failed to initialize, cannot play");
      return;
    }

    const code = this.buildPatternCode();
    console.log("[StrudelService] pattern code:", code);
    if (!code) {
      console.warn("[StrudelService] No pattern to play (no pads with notes)");
      return;
    }

    try {
      this.clearError();

      // Strudel v1.3.0 has an operator-precedence bug that prevents
      // initAudioOnFirstClick from ever calling AudioContext.resume().
      // Work around it by resuming manually — play() is always called
      // from a user-gesture handler so the browser will allow it.
      await this.resumeAudioContext();

      await this._evaluate(code);
      this._isPlaying = true;
      this.notifyStateChange();
      console.log("[StrudelService] playing!");
    } catch (err) {
      this._lastError = (err as Error).message;
      console.error("[StrudelService] Failed to play pattern:", err);
      this.notifyStateChange();
    }
  }

  stop(): void {
    this._isPlaying = false;
    if (this._hush) this._hush();
    this.notifyStateChange();
  }

  /**
   * Rebuild and hot-swap the pattern while playing.
   * Called on canvas-store changes (debounced 100ms).
   */
  async rebuildAndPlay(): Promise<void> {
    if (!this._isPlaying || !this.isAudioInitialized || !this._evaluate) return;

    const code = this.buildPatternCode();
    if (!code) {
      this.stop();
      return;
    }

    try {
      await this.resumeAudioContext();
      await this._evaluate(code);
    } catch (err) {
      console.error("[StrudelService] Failed to rebuild pattern:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup (for hot-module-replacement)
  // ---------------------------------------------------------------------------

  dispose(): void {
    this.stop();
    if (this.unsubscribeFromStore) {
      this.unsubscribeFromStore();
      this.unsubscribeFromStore = null;
    }
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience exports — backwards-compatible module-level functions
// These delegate to the singleton so existing consumers keep working.
// ---------------------------------------------------------------------------

const service = StrudelService.instance();

export const preload = () => service.preload();
export const play = () => service.play();
export const stop = () => service.stop();
export const rebuildAndPlay = () => service.rebuildAndPlay();
export const getIsPlaying = () => service.isPlaying;
export const getIsInitialized = () => service.isReady;
export const dispose = () => service.dispose();
