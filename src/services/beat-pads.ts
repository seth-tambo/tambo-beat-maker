/**
 * Tool functions for AI to manipulate beat pads on the canvas.
 * These run outside React, writing directly to the canvas store.
 */

import {
    addPad,
    removePad,
    clearAllPads,
    getCanvasSnapshot,
    togglePadMute,
    setNotesForPad,
    PAD_COLORS,
    type PadColor
} from '@/lib/canvas-store';
import {
    MAX_PADS,
    getOccupiedSlots,
    nextEmptySlot,
    slotToPosition
} from '@/lib/grid-constants';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Default step patterns so pads make sound immediately when created
const DEFAULT_STEPS: Record<string, number[]> = {
    kick: [0, 8, 16, 24],
    snare: [8, 24],
    'hi-hat': [0, 4, 8, 12, 16, 20, 24, 28],
    clap: [8, 24],
    tom: [12, 28],
    'high tom': [12, 28],
    'low tom': [4, 20],
    rim: [4, 12, 20, 28],
    perc: [2, 10, 18, 26],
    fx: [0, 16],
    sub: [0, 16],
    'open hh': [6, 22],
    crash: [0],
    ride: [0, 4, 8, 12, 16, 20, 24, 28],
    cowbell: [0, 4, 8, 12, 16, 20, 24, 28],
    shaker: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
    tambourine: [2, 6, 10, 14, 18, 22, 26, 30],
    conga: [2, 8, 14, 18, 24, 30],
    bongo: [4, 10, 20, 26],
    maracas: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
    guiro: [0, 8, 16, 24],
    cabasa: [2, 6, 10, 14, 18, 22, 26, 30],
    'noise hit': [0, 16]
};

function getDefaultSteps(label: string): number[] {
    const lower = label.toLowerCase();
    if (DEFAULT_STEPS[lower]) return DEFAULT_STEPS[lower];
    for (const [key, steps] of Object.entries(DEFAULT_STEPS)) {
        if (key.includes(lower) || lower.includes(key)) return steps;
    }
    return [0, 8, 16, 24]; // fallback: four-on-the-floor
}

function resolveColor(label: string): PadColor {
    // Try to match by label first
    const lower = label.toLowerCase();
    for (const c of PAD_COLORS) {
        if (c.label.toLowerCase() === lower) return c;
    }
    // Try partial match
    for (const c of PAD_COLORS) {
        if (
            c.label.toLowerCase().includes(lower) ||
            lower.includes(c.label.toLowerCase())
        )
            return c;
    }
    // Pick a random color
    return PAD_COLORS[Math.floor(Math.random() * PAD_COLORS.length)];
}

// ---------------------------------------------------------------------------
// Grid placement
// ---------------------------------------------------------------------------

/** Find the next open grid cell using shared grid constants. */
function nextGridPosition(): { x: number; y: number } {
    const snapshot = getCanvasSnapshot();
    const occupied = getOccupiedSlots(snapshot.pads);
    const occupiedSet = new Set(occupied.keys());
    const slot = nextEmptySlot(occupiedSet);
    return slotToPosition(slot);
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function createBeatPad(input: {
    label: string;
    color?: string;
    bank?: string;
}) {
    if (getCanvasSnapshot().pads.length >= MAX_PADS) {
        throw new Error(`Cannot create more than ${MAX_PADS} pads.`);
    }

    const color = input.color
        ? resolveColor(input.color)
        : resolveColor(input.label);

    // Use the provided label (override the color's default label)
    const padColor: PadColor = { ...color, label: input.label };

    const { x, y } = nextGridPosition();
    const pad = addPad({ x, y, color: padColor, bank: input.bank });

    // Set default notes so the pad makes sound immediately
    const defaultSteps = getDefaultSteps(padColor.label);
    const notes = new Set<string>();
    for (const step of defaultSteps) {
        notes.add(`C3-${step}`);
    }
    setNotesForPad(pad.id, notes);

    return {
        id: pad.id,
        label: pad.color.label,
        color: pad.color.bg,
        bank: pad.bank,
        x: pad.x,
        y: pad.y
    };
}

export function removeBeatPad(input: { id?: string; label?: string }) {
    const snapshot = getCanvasSnapshot();

    if (input.id) {
        const removed = removePad(input.id);
        return { success: removed, removedId: input.id };
    }

    if (input.label) {
        const lower = input.label.toLowerCase();
        const match = snapshot.pads.find(
            (p) => p.label.toLowerCase() === lower
        );
        if (match) {
            const removed = removePad(match.id);
            return {
                success: removed,
                removedId: match.id,
                label: match.label
            };
        }
        return {
            success: false,
            error: `No pad found with label "${input.label}"`
        };
    }

    return { success: false, error: 'Provide either id or label' };
}

export function listBeatPads() {
    return getCanvasSnapshot().pads;
}

export function clearAllBeatPads() {
    clearAllPads();
    return { success: true, message: 'All pads cleared' };
}

export function toggleBeatPadMute(input: { id?: string; label?: string }) {
    const snapshot = getCanvasSnapshot();

    if (input.id) {
        const pad = snapshot.pads.find((p) => p.id === input.id);
        if (!pad)
            return {
                success: false,
                error: `No pad found with id "${input.id}"`
            };
        togglePadMute(input.id);
        return { success: true, padId: input.id, muted: !pad.muted };
    }

    if (input.label) {
        const lower = input.label.toLowerCase();
        const match = snapshot.pads.find(
            (p) => p.label.toLowerCase() === lower
        );
        if (match) {
            togglePadMute(match.id);
            return {
                success: true,
                padId: match.id,
                label: match.label,
                muted: !match.muted
            };
        }
        return {
            success: false,
            error: `No pad found with label "${input.label}"`
        };
    }

    return { success: false, error: 'Provide either id or label' };
}
