/**
 * Reactive canvas state store using useSyncExternalStore.
 * Module-level state so tools (which run outside React) can write to it
 * and React components can read reactively.
 */

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import type { SoundboardData } from "@/db/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PadColor {
  bg: string;
  glow: string;
  label: string;
}

export interface BeatPad {
  id: string;
  x: number;
  y: number;
  color: PadColor;
  size: number;
  muted: boolean;
}

export interface CanvasState {
  pads: BeatPad[];
  padNotes: Map<string, Set<string>>;
  openRollPadId: string | null;
  isPlaying: boolean;
  currentStep: number;
  bpm: number;
  playStartedAt: number | null;
  playStartedAtStep: number;
  volume: number; // 0–100
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PAD_COLORS: PadColor[] = [
  { bg: "#6d28d9", glow: "#a78bfa", label: "Kick" },
  { bg: "#dc2626", glow: "#f87171", label: "Snare" },
  { bg: "#d97706", glow: "#fbbf24", label: "Hi-Hat" },
  { bg: "#059669", glow: "#34d399", label: "Clap" },
  { bg: "#2563eb", glow: "#60a5fa", label: "Tom" },
  { bg: "#db2777", glow: "#f472b6", label: "Rim" },
  { bg: "#7c3aed", glow: "#a78bfa", label: "Perc" },
  { bg: "#ea580c", glow: "#fb923c", label: "FX" },
  { bg: "#0891b2", glow: "#22d3ee", label: "Sub" },
  { bg: "#4f46e5", glow: "#818cf8", label: "Open HH" },
  { bg: "#be123c", glow: "#fb7185", label: "Crash" },
  { bg: "#15803d", glow: "#4ade80", label: "Ride" },
];

// ---------------------------------------------------------------------------
// Module-level state + subscription
// ---------------------------------------------------------------------------

const STEPS = 32;

let state: CanvasState = {
  pads: [],
  padNotes: new Map(),
  openRollPadId: null,
  isPlaying: false,
  currentStep: 0,
  bpm: 120,
  playStartedAt: null,
  playStartedAtStep: 0,
  volume: 80,
};

let padCounter = 0;

const listeners = new Set<() => void>();

function emit() {
  // Create a new state reference so useSyncExternalStore detects the change
  state = { ...state };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Direct state accessor for non-React consumers (audio engine, tools). */
export function getState(): CanvasState {
  return state;
}

function getSnapshot(): CanvasState {
  return state;
}

// ---------------------------------------------------------------------------
// Mutations (callable from tools or React)
// ---------------------------------------------------------------------------

export function addPad(pad: Omit<BeatPad, "id" | "size" | "muted"> & { id?: string; size?: number; muted?: boolean }): BeatPad {
  const newPad: BeatPad = {
    id: pad.id ?? `pad-${padCounter++}`,
    x: pad.x,
    y: pad.y,
    color: pad.color,
    size: pad.size ?? 110,
    muted: false,
  };
  state = { ...state, pads: [...state.pads, newPad] };
  emit();
  return newPad;
}

export function removePad(id: string): boolean {
  const idx = state.pads.findIndex((p) => p.id === id);
  if (idx === -1) return false;

  const nextPads = state.pads.filter((p) => p.id !== id);
  const nextNotes = new Map(state.padNotes);
  nextNotes.delete(id);
  const nextRoll = state.openRollPadId === id ? null : state.openRollPadId;

  state = { ...state, pads: nextPads, padNotes: nextNotes, openRollPadId: nextRoll };
  emit();
  return true;
}

export function movePad(id: string, x: number, y: number) {
  state = {
    ...state,
    pads: state.pads.map((p) => (p.id === id ? { ...p, x, y } : p)),
  };
  emit();
}

export function toggleNote(padId: string, noteKey: string) {
  const nextNotes = new Map(state.padNotes);
  const notes = new Set(nextNotes.get(padId) ?? []);
  if (notes.has(noteKey)) notes.delete(noteKey);
  else notes.add(noteKey);
  nextNotes.set(padId, notes);
  state = { ...state, padNotes: nextNotes };
  emit();
}

export function setNotesForPad(padId: string, notes: Set<string>) {
  const nextNotes = new Map(state.padNotes);
  nextNotes.set(padId, new Set(notes));
  state = { ...state, padNotes: nextNotes };
  emit();
}

export function clearNotesForPad(padId: string) {
  const nextNotes = new Map(state.padNotes);
  nextNotes.delete(padId);
  state = { ...state, padNotes: nextNotes };
  emit();
}

export function openPianoRoll(padId: string) {
  if (state.openRollPadId === padId) return;
  state = { ...state, openRollPadId: padId };
  emit();
}

export function closePianoRoll() {
  if (!state.openRollPadId) return;
  state = { ...state, openRollPadId: null };
  emit();
}

export function clearAllPads() {
  state = {
    pads: [],
    padNotes: new Map(),
    openRollPadId: null,
    isPlaying: false,
    currentStep: 0,
    bpm: state.bpm,
    playStartedAt: null,
    playStartedAtStep: 0,
    volume: state.volume,
  };
  padCounter = 0;
  emit();
}

export function bringPadToFront(id: string) {
  const idx = state.pads.findIndex((p) => p.id === id);
  if (idx === -1 || idx === state.pads.length - 1) return;
  const copy = [...state.pads];
  const [moved] = copy.splice(idx, 1);
  copy.push(moved);
  state = { ...state, pads: copy };
  emit();
}

export function reorderPads(pads: BeatPad[]) {
  state = { ...state, pads };
  emit();
}

export function togglePadMute(id: string): boolean {
  const idx = state.pads.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  state = {
    ...state,
    pads: state.pads.map((p) => (p.id === id ? { ...p, muted: !p.muted } : p)),
  };
  emit();
  return true;
}

// Transport mutations

export function setPlaying(playing: boolean) {
  if (state.isPlaying === playing) return;
  state = {
    ...state,
    isPlaying: playing,
    playStartedAt: playing ? Date.now() : null,
    playStartedAtStep: state.currentStep,
  };
  emit();
}

function advanceStep() {
  state = { ...state, currentStep: (state.currentStep + 1) % STEPS };
  emit();
}

export function setBpm(bpm: number) {
  state = {
    ...state,
    bpm: Math.max(30, Math.min(300, bpm)),
    // Re-anchor the rAF loop so playhead stays in sync after tempo change
    playStartedAt: state.isPlaying ? Date.now() : null,
    playStartedAtStep: state.currentStep,
  };
  emit();
}

export function setVolume(volume: number) {
  state = { ...state, volume: Math.max(0, Math.min(100, volume)) };
  emit();
}

// ---------------------------------------------------------------------------
// Serialization / Hydration (for persistence)
// ---------------------------------------------------------------------------

/** Returns the full canvas state as a plain JSON-safe object. */
export function getSerializableState(): SoundboardData {
  return {
    pads: state.pads.map((pad) => ({
      id: pad.id,
      x: pad.x,
      y: pad.y,
      color: pad.color,
      size: pad.size,
      notes: Array.from(state.padNotes.get(pad.id) ?? []),
      muted: pad.muted || undefined,
    })),
    bpm: state.bpm,
  };
}

/** Replaces all canvas state from a saved soundboard. */
export function hydrateFromSoundboard(data: SoundboardData) {
  const padNotes = new Map<string, Set<string>>();
  let maxCounter = 0;

  for (const pad of data.pads) {
    if (pad.notes.length > 0) {
      padNotes.set(pad.id, new Set(pad.notes));
    }
    const match = pad.id.match(/^pad-(\d+)$/);
    if (match) {
      maxCounter = Math.max(maxCounter, parseInt(match[1], 10) + 1);
    }
  }

  padCounter = maxCounter;

  state = {
    pads: data.pads.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      color: p.color,
      size: p.size,
      muted: p.muted ?? false,
    })),
    padNotes,
    openRollPadId: null,
    isPlaying: false,
    currentStep: 0,
    bpm: data.bpm,
    volume: state.volume,
    playStartedAt: null,
    playStartedAtStep: 0,
  };
  emit();
}

// ---------------------------------------------------------------------------
// Snapshot for tools / context helpers (plain-object, no Sets/Maps)
// ---------------------------------------------------------------------------

export function getCanvasSnapshot() {
  return {
    pads: state.pads.map((p) => {
      const notes = state.padNotes.get(p.id);
      const activeSteps: number[] = [];
      if (notes) {
        for (const noteKey of notes) {
          const stepStr = noteKey.split("-").pop();
          if (stepStr !== undefined) {
            const step = parseInt(stepStr, 10);
            if (!activeSteps.includes(step)) activeSteps.push(step);
          }
        }
        activeSteps.sort((a, b) => a - b);
      }
      return {
        id: p.id,
        label: p.color.label,
        color: p.color.bg,
        x: p.x,
        y: p.y,
        muted: p.muted,
        hasNotes: (notes?.size ?? 0) > 0,
        noteCount: notes?.size ?? 0,
        activeSteps,
      };
    }),
    totalPads: state.pads.length,
    isPlaying: state.isPlaying,
    bpm: state.bpm,
  };
}

// ---------------------------------------------------------------------------
// Playback timer hook — call once in the top-level canvas component
// ---------------------------------------------------------------------------

export function usePlaybackTimer() {
  const { isPlaying, bpm } = useCanvasStore();

  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = (60 / bpm / 4) * 1000; // 16th-note interval
    const id = setInterval(advanceStep, intervalMs);
    return () => clearInterval(id);
  }, [isPlaying, bpm]);
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useCanvasStore(): CanvasState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export { padCounter };
