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
  /** Drum machine bank name, e.g. "RolandTR808", "RolandTR909" */
  bank?: string;
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

interface HistorySnapshot {
  pads: BeatPad[];
  padNotes: Map<string, Set<string>>;
  openRollPadId: string | null;
  bpm: number;
  volume: number;
  padCounter: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PAD_COLORS: PadColor[] = [
  // Core drums
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
  // Extended percussion
  { bg: "#b45309", glow: "#f59e0b", label: "Cowbell" },
  { bg: "#0d9488", glow: "#5eead4", label: "Shaker" },
  { bg: "#9333ea", glow: "#c084fc", label: "Tambourine" },
  { bg: "#c2410c", glow: "#fb923c", label: "Conga" },
  { bg: "#a16207", glow: "#facc15", label: "Bongo" },
  { bg: "#166534", glow: "#86efac", label: "Maracas" },
  { bg: "#7e22ce", glow: "#d8b4fe", label: "High Tom" },
  { bg: "#1d4ed8", glow: "#93c5fd", label: "Low Tom" },
];

// ---------------------------------------------------------------------------
// Module-level state + subscription
// ---------------------------------------------------------------------------

const STEPS = 32;
const MAX_HISTORY = 100;

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
const undoStack: HistorySnapshot[] = [];
const redoStack: HistorySnapshot[] = [];
let historyTransactionDepth = 0;
let historyTransactionCaptured = false;

const listeners = new Set<() => void>();

function cloneHistorySnapshot(snapshot: HistorySnapshot): HistorySnapshot {
  return {
    pads: snapshot.pads.map((pad) => ({ ...pad })),
    padNotes: new Map(
      Array.from(snapshot.padNotes.entries(), ([padId, notes]) => [padId, new Set(notes)]),
    ),
    openRollPadId: snapshot.openRollPadId,
    bpm: snapshot.bpm,
    volume: snapshot.volume,
    padCounter: snapshot.padCounter,
  };
}

function createHistorySnapshot(from: CanvasState): HistorySnapshot {
  return cloneHistorySnapshot({
    pads: from.pads,
    padNotes: from.padNotes,
    openRollPadId: from.openRollPadId,
    bpm: from.bpm,
    volume: from.volume,
    padCounter,
  });
}

function pushUndoSnapshot(snapshot: HistorySnapshot) {
  undoStack.push(snapshot);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
}

function recordHistory() {
  if (historyTransactionDepth > 0) {
    if (historyTransactionCaptured) return;
    pushUndoSnapshot(createHistorySnapshot(state));
    redoStack.length = 0;
    historyTransactionCaptured = true;
    return;
  }
  pushUndoSnapshot(createHistorySnapshot(state));
  redoStack.length = 0;
}

function applyHistorySnapshot(snapshot: HistorySnapshot) {
  const nextOpenRollPadId =
    snapshot.openRollPadId && snapshot.pads.some((pad) => pad.id === snapshot.openRollPadId)
      ? snapshot.openRollPadId
      : null;
  padCounter = snapshot.padCounter;
  state = {
    ...state,
    pads: snapshot.pads.map((pad) => ({ ...pad })),
    padNotes: new Map(
      Array.from(snapshot.padNotes.entries(), ([padId, notes]) => [padId, new Set(notes)]),
    ),
    openRollPadId: nextOpenRollPadId,
    bpm: snapshot.bpm,
    volume: snapshot.volume,
  };
}

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
  recordHistory();
  const newPad: BeatPad = {
    id: pad.id ?? `pad-${padCounter++}`,
    x: pad.x,
    y: pad.y,
    color: pad.color,
    size: pad.size ?? 110,
    muted: false,
    bank: pad.bank,
  };
  state = { ...state, pads: [...state.pads, newPad] };
  emit();
  return newPad;
}

export function removePad(id: string): boolean {
  const idx = state.pads.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  recordHistory();

  const nextPads = state.pads.filter((p) => p.id !== id);
  const nextNotes = new Map(state.padNotes);
  nextNotes.delete(id);
  const nextRoll = state.openRollPadId === id ? null : state.openRollPadId;

  state = { ...state, pads: nextPads, padNotes: nextNotes, openRollPadId: nextRoll };
  emit();
  return true;
}

export function movePad(id: string, x: number, y: number) {
  const pad = state.pads.find((p) => p.id === id);
  if (!pad || (pad.x === x && pad.y === y)) return;
  recordHistory();
  state = {
    ...state,
    pads: state.pads.map((p) => (p.id === id ? { ...p, x, y } : p)),
  };
  emit();
}

export function toggleNote(padId: string, noteKey: string) {
  recordHistory();
  const nextNotes = new Map(state.padNotes);
  const notes = new Set(nextNotes.get(padId) ?? []);
  if (notes.has(noteKey)) notes.delete(noteKey);
  else notes.add(noteKey);
  nextNotes.set(padId, notes);
  state = { ...state, padNotes: nextNotes };
  emit();
}

export function setNotesForPad(padId: string, notes: Set<string>) {
  const currentNotes = state.padNotes.get(padId) ?? new Set<string>();
  if (
    currentNotes.size === notes.size &&
    Array.from(currentNotes).every((note) => notes.has(note))
  ) {
    return;
  }
  recordHistory();
  const nextNotes = new Map(state.padNotes);
  nextNotes.set(padId, new Set(notes));
  state = { ...state, padNotes: nextNotes };
  emit();
}

export function clearNotesForPad(padId: string) {
  if (!state.padNotes.has(padId)) return;
  recordHistory();
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
  if (state.pads.length === 0 && state.padNotes.size === 0) return;
  recordHistory();
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
  recordHistory();
  const copy = [...state.pads];
  const [moved] = copy.splice(idx, 1);
  copy.push(moved);
  state = { ...state, pads: copy };
  emit();
}

export function reorderPads(pads: BeatPad[]) {
  recordHistory();
  state = { ...state, pads };
  emit();
}

export function togglePadMute(id: string): boolean {
  const idx = state.pads.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  recordHistory();
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
  const nextBpm = Math.max(30, Math.min(300, bpm));
  if (state.bpm === nextBpm) return;
  recordHistory();
  state = {
    ...state,
    bpm: nextBpm,
    // Re-anchor the rAF loop so playhead stays in sync after tempo change
    playStartedAt: state.isPlaying ? Date.now() : null,
    playStartedAtStep: state.currentStep,
  };
  emit();
}

export function setVolume(volume: number) {
  const nextVolume = Math.max(0, Math.min(100, volume));
  if (state.volume === nextVolume) return;
  recordHistory();
  state = { ...state, volume: nextVolume };
  emit();
}

export function beginHistoryTransaction() {
  historyTransactionDepth += 1;
  if (historyTransactionDepth === 1) historyTransactionCaptured = false;
}

export function endHistoryTransaction() {
  if (historyTransactionDepth === 0) return;
  historyTransactionDepth -= 1;
  if (historyTransactionDepth === 0) historyTransactionCaptured = false;
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

export function undo() {
  const previous = undoStack.pop();
  if (!previous) return false;
  redoStack.push(createHistorySnapshot(state));
  applyHistorySnapshot(previous);
  emit();
  return true;
}

export function redo() {
  const next = redoStack.pop();
  if (!next) return false;
  undoStack.push(createHistorySnapshot(state));
  applyHistorySnapshot(next);
  emit();
  return true;
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
      bank: pad.bank,
    })),
    bpm: state.bpm,
  };
}

/** Replaces all canvas state from a saved soundboard. */
export function hydrateFromSoundboard(data: SoundboardData) {
  recordHistory();
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
      bank: p.bank,
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
        bank: p.bank,
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
