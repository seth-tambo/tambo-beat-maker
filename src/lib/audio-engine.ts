/**
 * Strudel audio engine -- class-based singleton.
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
 * Supports two playback modes:
 *   - "pads": pattern built from canvas-store pad/note state
 *   - "code": free-form Strudel code evaluated directly (via evaluateCode)
 */
'use client';

import { getState, setPlaying, subscribe } from './canvas-store';
import { getSoundForLabel, DEFAULT_BANK } from './sound-map';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlaybackMode = 'pads' | 'code';

export interface StrudelEngineState {
    isPlaying: boolean;
    isReady: boolean;
    error: string | null;
    mode: PlaybackMode;
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
    private _mode: PlaybackMode = 'pads';

    // Strudel functions captured after dynamic import
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private _evaluate:
        | ((code: string, autoplay?: boolean) => Promise<any>)
        | null = null;
    private _hush: (() => void) | null = null;

    // Debounce timer for live pattern updates
    private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    // Last evaluated pattern code -- skip evaluate when unchanged
    private _lastPatternCode: string | null = null;

    // Free-form code state (for evaluateCode / revert-on-failure)
    private _freeformCode: string | null = null;

    // Canvas store subscription teardown
    private unsubscribeFromStore: (() => void) | null = null;

    // State change listeners (for React context)
    private stateChangeCallbacks: StateChangeCallback[] = [];

    // Scheduler error capture
    private schedulerError: Error | null = null;
    private schedulerErrorResolve: ((error: Error | null) => void) | null =
        null;

    // ---------------------------------------------------------------------------
    // Singleton access
    // ---------------------------------------------------------------------------

    private constructor() {} // Private -- use .instance()

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

    get mode(): PlaybackMode {
        return this._mode;
    }

    getEngineState(): StrudelEngineState {
        return {
            isPlaying: this._isPlaying,
            isReady: this.isAudioInitialized,
            error: this._lastError,
            mode: this._mode
        };
    }

    // ---------------------------------------------------------------------------
    // State change notifications (for React context)
    // ---------------------------------------------------------------------------

    onStateChange(callback: StateChangeCallback): () => void {
        this.stateChangeCallbacks.push(callback);
        return () => {
            this.stateChangeCallbacks = this.stateChangeCallbacks.filter(
                (cb) => cb !== callback
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
    // This is CRITICAL -- Strudel is large and must not be in the initial bundle.
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
            console.log('[StrudelService] preloading Strudel...');
            const strudel = await import('@strudel/web');

            const CDN = 'https://strudel.b-cdn.net';

            // initStrudel():
            //  1. Calls initAudioOnFirstClick() -- registers a document mousedown
            //     listener that resumes the AudioContext on the user's next click
            //  2. Creates the webaudio REPL (scheduler + output)
            //  3. Runs defaultPrebake() -- loads synth sounds + evalScope (core, mini, tonal, webaudio)
            //  4. Runs our custom prebake (inline below) -- loads samples from CDN
            //
            // CRITICAL: samples() and aliasBank() MUST come from the same `strudel`
            // import that owns initStrudel. @strudel/web bundles its own internal
            // superdough -- any separate import (even of @strudel/web itself from
            // another file) can create a second module instance with a disconnected
            // sample registry.
            await strudel.initStrudel({
                prebake: async () => {
                    // --- Drum machines + aliases (core sounds) ---
                    await strudel.samples(
                        `${CDN}/tidal-drum-machines.json`,
                        `${CDN}/tidal-drum-machines/machines/`,
                        { prebake: true, tag: 'drum-machines' }
                    );
                    await strudel.aliasBank(
                        `${CDN}/tidal-drum-machines-alias.json`
                    );

                    // --- ZZFX procedural synth sounds (no download, instant) ---
                    // registerZZFXSounds is exported at runtime but missing from type defs
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (
                        typeof (strudel as any).registerZZFXSounds ===
                        'function'
                    ) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (strudel as any).registerZZFXSounds();
                    }

                    // --- Piano samples (enables melodic patterns) ---
                    await strudel.samples(
                        `${CDN}/piano.json`,
                        `${CDN}/piano/`,
                        { prebake: true }
                    );

                    // --- Dirt samples (ambient, textural variety) ---
                    await strudel.samples(
                        {
                            casio: [
                                'casio/high.wav',
                                'casio/low.wav',
                                'casio/noise.wav'
                            ],
                            crow: [
                                'crow/000_crow.wav',
                                'crow/001_crow2.wav',
                                'crow/002_crow3.wav',
                                'crow/003_crow4.wav'
                            ],
                            insect: [
                                'insect/000_everglades_conehead.wav',
                                'insect/001_robust_shieldback.wav',
                                'insect/002_seashore_meadow_katydid.wav'
                            ],
                            wind: [
                                'wind/000_wind1.wav',
                                'wind/001_wind10.wav',
                                'wind/002_wind2.wav',
                                'wind/003_wind3.wav',
                                'wind/004_wind4.wav',
                                'wind/005_wind5.wav',
                                'wind/006_wind6.wav',
                                'wind/007_wind7.wav',
                                'wind/008_wind8.wav',
                                'wind/009_wind9.wav'
                            ],
                            jazz: [
                                'jazz/000_BD.wav',
                                'jazz/001_CB.wav',
                                'jazz/002_FX.wav',
                                'jazz/003_HH.wav',
                                'jazz/004_OH.wav',
                                'jazz/005_P1.wav',
                                'jazz/006_P2.wav',
                                'jazz/007_SN.wav'
                            ],
                            metal: [
                                'metal/000_0.wav',
                                'metal/001_1.wav',
                                'metal/002_2.wav',
                                'metal/003_3.wav',
                                'metal/004_4.wav',
                                'metal/005_5.wav',
                                'metal/006_6.wav',
                                'metal/007_7.wav',
                                'metal/008_8.wav',
                                'metal/009_9.wav'
                            ],
                            east: [
                                'east/000_nipon_wood_block.wav',
                                'east/001_ohkawa_mute.wav',
                                'east/002_ohkawa_open.wav',
                                'east/003_shime_hi.wav',
                                'east/004_shime_hi_2.wav',
                                'east/005_shime_mute.wav',
                                'east/006_taiko_1.wav',
                                'east/007_taiko_2.wav',
                                'east/008_taiko_3.wav'
                            ],
                            space: [
                                'space/000_0.wav',
                                'space/001_1.wav',
                                'space/002_11.wav',
                                'space/003_12.wav',
                                'space/004_13.wav',
                                'space/005_14.wav',
                                'space/006_15.wav',
                                'space/007_16.wav',
                                'space/008_17.wav',
                                'space/009_18.wav',
                                'space/010_2.wav',
                                'space/011_3.wav',
                                'space/012_4.wav',
                                'space/013_5.wav',
                                'space/014_6.wav',
                                'space/015_7.wav',
                                'space/016_8.wav',
                                'space/017_9.wav'
                            ]
                        },
                        `${CDN}/Dirt-Samples/`,
                        { prebake: true }
                    );

                    console.log(
                        '[prebake] core samples loaded (drums, piano, dirt, zzfx)'
                    );
                }
            });
            console.log('[StrudelService] initStrudel complete');

            // --- Lazy-load extended sample libraries (non-blocking) ---
            Promise.all([
                strudel.samples(`${CDN}/vcsl.json`, `${CDN}/VCSL/`, {
                    prebake: true
                }),
                strudel.samples(
                    `${CDN}/uzu-drumkit.json`,
                    `${CDN}/uzu-drumkit/`,
                    { prebake: true, tag: 'drum-machines' }
                ),
                strudel.samples(
                    `${CDN}/uzu-wavetables.json`,
                    `${CDN}/uzu-wavetables/`,
                    { prebake: true }
                ),
                strudel.samples(`${CDN}/mridangam.json`, `${CDN}/mrid/`, {
                    prebake: true,
                    tag: 'drum-machines'
                })
            ])
                .then(() => {
                    console.log(
                        '[prebake] extended samples loaded (vcsl, uzu, mridangam)'
                    );
                })
                .catch((err) => {
                    console.warn(
                        '[prebake] some extended samples failed to load:',
                        err
                    );
                });

            // Capture functions from the ES module exports
            // Bind to the module object because Strudel's functions rely on internal context.
            this._evaluate = strudel.evaluate.bind(strudel);
            this._hush = strudel.hush.bind(strudel);

            console.log(
                '[StrudelService] captured functions -- evaluate:',
                typeof this._evaluate,
                'hush:',
                typeof this._hush
            );

            // Set up global error handlers for async scheduler errors
            // (missing samples surface as unhandled promise rejections)
            this.installErrorHandlers();

            this.isAudioInitialized = true;
            this.notifyStateChange();

            // Subscribe to canvas-store changes for live pattern updates.
            // We no longer skip rebuilds in "code" mode because we now blend them.
            // Stop immediately when nothing is playable (no pads, no code); debounce otherwise.
            this.unsubscribeFromStore = subscribe(() => {
                if (!this._isPlaying) return;
                if (this.rebuildTimer) clearTimeout(this.rebuildTimer);

                const { pads } = getState();
                if (pads.length === 0 && !this._freeformCode) {
                    this.stop();
                    return;
                }

                this.rebuildTimer = setTimeout(() => this.rebuildAndPlay(), 16);
            });
        } catch (err) {
            console.error('[StrudelService] Failed to preload Strudel:', err);
            // Clear the promise so a retry is possible
            this._initPromise = null;
        }
    }

    // ---------------------------------------------------------------------------
    // Error handling
    // ---------------------------------------------------------------------------

    private installErrorHandlers(): void {
        if (typeof window === 'undefined') return;

        window.addEventListener('unhandledrejection', (event) => {
            const msg = this.toErrorMessage(event.reason);
            if (this.isSampleError(msg)) {
                this.captureSchedulerError(
                    event.reason instanceof Error
                        ? event.reason
                        : new Error(msg)
                );
            }
        });
    }

    private toErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object' && 'type' in error) {
            const type = (error as { type?: unknown }).type;
            if (typeof type === 'string' && type.length > 0) {
                return `Audio engine error event: ${type}`;
            }
        }

        const fallback = String(error);
        return fallback === '[object Event]'
            ? 'Audio engine error event'
            : fallback;
    }

    private isSampleError(msg: string): boolean {
        if (!msg) return false;
        const lower = msg.toLowerCase();
        return (
            lower.includes('not found') ||
            lower.includes('unknown sound') ||
            lower.includes('no sample')
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

        const patternCodes: string[] = [];

        for (const pad of pads) {
            if (pad.muted) continue;
            const notes = padNotes.get(pad.id);
            if (!notes || notes.size === 0) continue;

            const sound = getSoundForLabel(pad.color.label);

            // Collect which steps have any active note
            const activeSteps = new Set<number>();
            for (const noteKey of notes) {
                const stepStr = noteKey.split('-').pop();
                if (stepStr !== undefined) {
                    activeSteps.add(parseInt(stepStr, 10));
                }
            }

            if (activeSteps.size === 0) continue;

            // Build 32-slot mini-notation: sound name or ~ for rest
            const slots: string[] = [];
            for (let i = 0; i < STEPS; i++) {
                slots.push(activeSteps.has(i) ? sound : '~');
            }

            const bank = pad.bank ?? DEFAULT_BANK;
            patternCodes.push(`s("${slots.join(' ')}").bank("${bank}")`);
        }

        if (this._freeformCode) {
            patternCodes.push(`(\n${this._freeformCode}\n)`);
        }

        if (patternCodes.length === 0) return null;

        // Stack all pad patterns and set tempo.
        // One cycle = one full pass through the 32-slot pattern = 8 beats (32 sixteenth notes).
        // cpm (cycles per minute) = bpm / 8
        const cpm = bpm / 8;
        const gain = volume / 100;
        const combined =
            patternCodes.length === 1
                ? patternCodes[0]
                : `stack(\n${patternCodes.map((c) => `  ${c}`).join(',\n')}\n)`;

        return `${combined}.cpm(${cpm}).gain(${gain})`;
    }

    // ---------------------------------------------------------------------------
    // AudioContext resume helper
    // Strudel v1.3.0 has an operator-precedence bug that prevents
    // initAudioOnFirstClick from ever calling AudioContext.resume().
    // We work around this by resuming manually.
    // ---------------------------------------------------------------------------

    private async resumeAudioContext(): Promise<void> {
        const { getAudioContext } = await import('@strudel/web');
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
    }

    // ---------------------------------------------------------------------------
    // Playback controls
    // ---------------------------------------------------------------------------

    /**
     * Build the pattern from canvas state, evaluate it, and start playback.
     * Switches to "pads" mode, cancelling any active code-mode playback.
     * If preload hasn't been called yet (e.g. tool invocation), does it now.
     */
    async play(): Promise<boolean> {
        if (!this.isAudioInitialized) await this.preload();
        if (!this.isAudioInitialized || !this._evaluate) {
            console.error('[StrudelService] Failed to initialize, cannot play');
            return false;
        }

        // Always use pads mode, which now combines pads + freeformCode
        this._mode = 'pads';

        const code = this.buildPatternCode();
        console.log('[StrudelService] pattern code:', code);
        if (!code) {
            console.warn(
                '[StrudelService] No pattern to play (no pads with notes)'
            );
            return false;
        }

        try {
            this.clearError();

            // Strudel v1.3.0 has an operator-precedence bug that prevents
            // initAudioOnFirstClick from ever calling AudioContext.resume().
            // Work around it by resuming manually -- play() is always called
            // from a user-gesture handler so the browser will allow it.
            await this.resumeAudioContext();

            // Capture playStartedAt BEFORE _evaluate() so the visual clock
            // starts at the same moment Strudel begins scheduling audio.
            // If _evaluate() throws we revert via setPlaying(false) in catch.
            this._isPlaying = true;
            setPlaying(true);

            await this._evaluate(code);
            this.notifyStateChange();
            console.log('[StrudelService] playing!');
            return true;
        } catch (err) {
            this._isPlaying = false;
            setPlaying(false);
            this._lastError = this.toErrorMessage(err);
            console.error('[StrudelService] Failed to play pattern:', err);
            this.notifyStateChange();
            return false;
        }
    }

    stop(): void {
        this._isPlaying = false;
        this._lastPatternCode = null;
        // Stop the visual clock before hushing audio so they halt together.
        setPlaying(false);
        if (this._hush) this._hush();
        if (this.rebuildTimer) {
            clearTimeout(this.rebuildTimer);
            this.rebuildTimer = null;
        }
        this.notifyStateChange();
    }

    /**
     * Rebuild and hot-swap the pattern while playing.
     * Called on canvas-store changes (debounced). Skipped in code mode.
     */
    async rebuildAndPlay(): Promise<void> {
        if (!this._isPlaying) return;
        if (!this.isAudioInitialized || !this._evaluate) return;

        const code = this.buildPatternCode();
        if (!code) {
            this.stop();
            return;
        }

        if (code === this._lastPatternCode) return;

        try {
            await this.resumeAudioContext();
            await this._evaluate(code);
            this._lastPatternCode = code;
        } catch (err) {
            console.error('[StrudelService] Failed to rebuild pattern:', err);
        }
    }

    // ---------------------------------------------------------------------------
    // Free-form code evaluation (for evaluatePattern tool)
    // ---------------------------------------------------------------------------

    /**
     * Evaluate arbitrary Strudel code and start playback.
     * On failure, reverts to previous code (or stops if no previous code).
     */
    async evaluateCode(
        code: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!this.isAudioInitialized) await this.preload();
        if (!this.isAudioInitialized || !this._evaluate) {
            return { success: false, error: 'Audio engine not initialized' };
        }

        const previousCode = this._freeformCode;
        const wasPlaying = this._isPlaying;

        try {
            // Stop current playback
            if (this._isPlaying) {
                if (this._hush) this._hush();
                this._isPlaying = false;
            }

            this.clearError();
            this._mode = 'pads'; // Always use unified mode now

            // Treat empty string as "clear AI code"
            this._freeformCode = code.trim() ? code : null;

            const combinedCode = this.buildPatternCode();

            if (!combinedCode) {
                // Nothing to play (no pads, empty code)
                this._isPlaying = true;
                setPlaying(true);
                this.notifyStateChange();
                return { success: true };
            }

            await this.resumeAudioContext();
            await this._evaluate(combinedCode);
            this._lastPatternCode = combinedCode;

            // Wait for async scheduler errors (missing samples, etc.)
            const schedulerErr = await this.waitForSchedulerError(500);

            if (schedulerErr) {
                // Revert on scheduler error
                await this.revertCode(previousCode, wasPlaying);
                return {
                    success: false,
                    error: `Runtime error: ${schedulerErr.message}\n\nCode:\n${code}`
                };
            }

            // Success
            this._isPlaying = true;
            setPlaying(true);
            this.notifyStateChange();
            return { success: true };
        } catch (err) {
            // Revert on eval error
            const errorMsg = this.toErrorMessage(err);
            await this.revertCode(previousCode, wasPlaying);
            return {
                success: false,
                error: `Evaluation error: ${errorMsg}\n\nCode:\n${code}`
            };
        }
    }

    /**
     * Revert to previous free-form code after a failed evaluation.
     */
    private async revertCode(
        previousCode: string | null,
        wasPlaying: boolean
    ): Promise<void> {
        this._freeformCode = previousCode;

        if (wasPlaying && this._evaluate) {
            try {
                const fallbackCode = this.buildPatternCode();
                if (fallbackCode) {
                    await this._evaluate(fallbackCode);
                    this._lastPatternCode = fallbackCode;
                    this._isPlaying = true;
                    setPlaying(true);
                } else {
                    this.stop();
                }
            } catch {
                // If revert also fails, just stop
                this.stop();
            }
        } else {
            this.stop();
        }
        this.notifyStateChange();
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
// Convenience exports -- backwards-compatible module-level functions
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
