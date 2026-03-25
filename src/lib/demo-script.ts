/**
 * Demo mode scripted sequences.
 *
 * Each entry maps a trigger phrase to a list of steps.
 * Steps run sequentially with delays between them so the demo
 * looks organic. Tool functions are called directly (not through Tambo)
 * and the assistant reply is injected into the thread UI.
 */

export interface DemoStep {
    /** Delay in ms before this step executes */
    delay: number;
    /** Tool function to call (async-safe) */
    action: () => Promise<unknown> | unknown;
    /** Optional tool-call label shown in the message (e.g. "createBeatPad") */
    toolLabel?: string;
}

export interface DemoEntry {
    /** The assistant's text reply shown in the chat */
    assistantMessage: string;
    /** Ordered steps to execute */
    steps: DemoStep[];
}

// ---------------------------------------------------------------------------
// Lazy imports so this module stays side-effect-free at import time
// ---------------------------------------------------------------------------

async function tools() {
    const [beatPads, audio] = await Promise.all([
        import('@/services/beat-pads'),
        import('@/services/audio-tools')
    ]);
    return { ...beatPads, ...audio };
}

// ---------------------------------------------------------------------------
// Script registry
// ---------------------------------------------------------------------------

/**
 * Find a matching demo entry for the given user input.
 * Returns null if no script matches (fall through to real Tambo).
 */
export function findDemoEntry(userInput: string): DemoEntry | null {
    const lower = userInput.toLowerCase().trim();

    for (const [trigger, builder] of DEMO_SCRIPTS) {
        if (typeof trigger === 'string' && lower.includes(trigger))
            return builder(lower);
        if (trigger instanceof RegExp && trigger.test(lower))
            return builder(lower);
    }

    return null;
}

// ---------------------------------------------------------------------------
// Scripts
// ---------------------------------------------------------------------------

const DEMO_SCRIPTS: Array<[string | RegExp, (input: string) => DemoEntry]> = [
    // ── Trap beat ──────────────────────────────────────────────
    [
        /trap/i,
        () => ({
            assistantMessage:
                "Here's a trap beat at 140 BPM! I set up a Kick, 808, Snare, Hi-Hat with rolls, an Open Hat, and a Bell. Hit play to hear it.",
            steps: [
                {
                    delay: 500,
                    toolLabel: 'setBeatBpm',
                    action: async () => (await tools()).setBeatBpm({ bpm: 140 })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Kick',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: '808',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Snare',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Hi-Hat',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Open HH',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Cowbell',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 800,
                    toolLabel: 'playBeat',
                    action: async () => (await tools()).playBeat()
                }
            ]
        })
    ],

    // ── House beat ─────────────────────────────────────────────
    [
        /house|four.on.the.floor/i,
        () => ({
            assistantMessage:
                'Groovy house beat coming up! Four-on-the-floor kick, offbeat hats, snare on 2 & 4, plus some percussion.',
            steps: [
                {
                    delay: 500,
                    toolLabel: 'setBeatBpm',
                    action: async () => (await tools()).setBeatBpm({ bpm: 125 })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Kick',
                            bank: 'RolandTR909'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Snare',
                            bank: 'RolandTR909'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Hi-Hat',
                            bank: 'RolandTR909'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Clap',
                            bank: 'RolandTR909'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Ride',
                            bank: 'RolandTR909'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Cowbell',
                            bank: 'RolandTR909'
                        })
                },
                {
                    delay: 800,
                    toolLabel: 'playBeat',
                    action: async () => (await tools()).playBeat()
                }
            ]
        })
    ],

    // ── Full kit ───────────────────────────────────────────────
    [
        /full.*kit|full.*drum/i,
        () => ({
            assistantMessage:
                'Full drum kit loaded! Kick, Snare, Hi-Hat, Open Hat, Clap, Rimshot, Tom, and Crash -- all with unique patterns.',
            steps: [
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Kick' })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Snare' })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Hi-Hat' })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Open HH' })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Clap' })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Rim' })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Tom' })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Crash' })
                },
                {
                    delay: 800,
                    toolLabel: 'playBeat',
                    action: async () => (await tools()).playBeat()
                }
            ]
        })
    ],

    // ── Lo-fi hip hop ──────────────────────────────────────────
    [
        /lo.?fi/i,
        () => ({
            assistantMessage:
                'Lo-fi hip hop vibes! Kick, Snare, Hi-Hat, Shaker, Rim, and a relaxed groove at 85 BPM.',
            steps: [
                {
                    delay: 500,
                    toolLabel: 'setBeatBpm',
                    action: async () => (await tools()).setBeatBpm({ bpm: 85 })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Kick',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Snare',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Hi-Hat',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Shaker',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({
                            label: 'Rim',
                            bank: 'RolandTR808'
                        })
                },
                {
                    delay: 800,
                    toolLabel: 'playBeat',
                    action: async () => (await tools()).playBeat()
                }
            ]
        })
    ],

    // ── Kick + Snare + Hi-Hat (simple) ─────────────────────────
    [
        /kick.*snare.*hat|add.*kick/i,
        () => ({
            assistantMessage:
                'Done! Added Kick, Snare, and Hi-Hat pads with patterns. Playing now.',
            steps: [
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Kick' })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Snare' })
                },
                {
                    delay: 500,
                    toolLabel: 'createBeatPad',
                    action: async () =>
                        (await tools()).createBeatPad({ label: 'Hi-Hat' })
                },
                {
                    delay: 800,
                    toolLabel: 'playBeat',
                    action: async () => (await tools()).playBeat()
                }
            ]
        })
    ],

    // ── Add a single pad (follow-up after initial beat) ────────
    [
        /add.*(clap|rim|tom|crash|shaker|tambourine|cowbell|conga|bongo|ride|perc)/i,
        (input: string) => {
            const m =
                /add.*(clap|rim|tom|crash|shaker|tambourine|cowbell|conga|bongo|ride|perc)/i.exec(
                    input
                );
            const label = m
                ? m[1].charAt(0).toUpperCase() + m[1].slice(1)
                : 'Clap';
            return {
                assistantMessage: `Added a ${label} pad with a pattern. It's already part of the beat!`,
                steps: [
                    {
                        delay: 500,
                        toolLabel: 'createBeatPad',
                        action: async () =>
                            (await tools()).createBeatPad({ label })
                    }
                ]
            };
        }
    ]
];
