"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { MouseEvent } from "react";

const NOTES = (() => {
  const names = ["B", "A#", "A", "G#", "G", "F#", "F", "E", "D#", "D", "C#", "C"];
  const result: string[] = [];
  for (let octave = 5; octave >= 3; octave--) {
    for (const name of names) {
      result.push(`${name}${octave}`);
    }
  }
  return result;
})();

const STEPS = 32;
const CELL_W = 28;
const CELL_H = 22;
const KEY_COL_W = 64;

const isBlackKey = (note: string) => note.includes("#");

interface PianoRollProps {
  x: number;
  y: number;
  zIndex: number;
  padLabel: string;
  padBg: string;
  padGlow: string;
  notes: Set<string>;
  onToggleNote: (key: string) => void;
  onTitleBarMouseDown: (e: MouseEvent) => void;
  onClose: () => void;
  currentStep: number;
  isPlaying: boolean;
  bpm: number;
  playStartedAt: number | null;
  playStartedAtStep: number;
}

function usePlayheadPosition(
  isPlaying: boolean,
  bpm: number,
  playStartedAt: number | null,
  playStartedAtStep: number,
) {
  const [position, setPosition] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying || playStartedAt === null) {
      rafRef.current && cancelAnimationFrame(rafRef.current);
      return;
    }

    const stepsPerMs = (bpm / 60) * 4 / 1000; // 16th notes per ms

    function tick() {
      const elapsed = Date.now() - playStartedAt!;
      const pos = (playStartedAtStep + elapsed * stepsPerMs) % STEPS;
      setPosition(pos);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, bpm, playStartedAt, playStartedAtStep]);

  return position;
}

export function PianoRoll({
  x,
  y,
  zIndex,
  padLabel,
  padBg,
  padGlow,
  notes,
  onToggleNote,
  onTitleBarMouseDown,
  onClose,
  currentStep,
  isPlaying,
  bpm,
  playStartedAt,
  playStartedAtStep,
}: PianoRollProps) {
  const playheadPos = usePlayheadPosition(isPlaying, bpm, playStartedAt, playStartedAtStep);
  const gridRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleGridScroll = useCallback(() => {
    if (gridRef.current && keysRef.current) {
      keysRef.current.scrollTop = gridRef.current.scrollTop;
    }
  }, []);

  return (
    <div
      className="absolute rounded-xl bg-[#0e1a16]/95 backdrop-blur-sm flex flex-col"
      style={{
        left: x,
        top: y,
        width: 780,
        height: 520,
        zIndex,
        border: `1px solid ${padGlow}30`,
        boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Title bar */}
      <div
        className="shrink-0 flex items-center gap-2.5 px-4 py-2.5 cursor-grab active:cursor-grabbing"
        style={{ borderBottom: `1px solid ${padGlow}20` }}
        onMouseDown={onTitleBarMouseDown}
      >
        <div
          className="w-3.5 h-3.5 rounded-sm shrink-0"
          style={{
            backgroundColor: padBg,
            boxShadow: `0 0 6px ${padGlow}60`,
          }}
        />
        <span
          className="text-sm font-bold uppercase tracking-wider flex-1"
          style={{ color: padGlow }}
        >
          {padLabel} — Piano Roll
        </span>
        <div className="flex items-center gap-1.5">
          <kbd
            className="text-[10px] text-white/30 bg-white/[0.06] border border-white/10 rounded px-1 py-0.5 leading-none font-mono"
            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.2)", borderBottom: "2px solid rgba(0,0,0,0.3)" }}
          >
            ESC
          </kbd>
          <button
            className="w-6 h-6 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-sm"
            onMouseDown={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            &times;
          </button>
        </div>
      </div>

      {/* Body: keys column + scrollable grid */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Keys column — syncs vertical scroll with grid */}
        <div
          ref={keysRef}
          className="shrink-0 overflow-hidden border-r border-white/10"
          style={{ width: KEY_COL_W }}
        >
          {NOTES.map((note) => (
            <div
              key={note}
              className={`flex items-center justify-end pr-2 text-sm font-medium border-b border-white/5 ${
                isBlackKey(note)
                  ? "bg-white/[0.06] text-white/60"
                  : "bg-white/[0.03] text-white/80"
              }`}
              style={{ height: CELL_H }}
            >
              {note}
            </div>
          ))}
        </div>

        {/* Grid — scrolls both axes */}
        <div
          ref={gridRef}
          className="flex-1 overflow-auto piano-grid-scroll"
          onScroll={handleGridScroll}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{ width: STEPS * CELL_W, minWidth: "100%", position: "relative" }}>
            {/* Playhead overlay */}
            <div
              className="absolute top-0 pointer-events-none"
              style={{
                left: playheadPos * CELL_W,
                width: CELL_W,
                height: NOTES.length * CELL_H,
                backgroundColor: isPlaying ? `${padGlow}12` : "transparent",
                borderLeft: isPlaying ? `2px solid ${padGlow}` : "none",
                zIndex: 10,
              }}
            />
            {NOTES.map((note) => (
              <div key={note} className="flex" style={{ height: CELL_H }}>
                {Array.from({ length: STEPS }, (_, step) => {
                  const cellKey = `${note}-${step}`;
                  const isActive = notes.has(cellKey);
                  const isBeatBorder = (step + 1) % 4 === 0;
                  const isPlayheadHere = isPlaying && step === currentStep;
                  return (
                    <div
                      key={step}
                      className={`piano-cell shrink-0 border-b border-r cursor-pointer ${
                        isBlackKey(note) ? "bg-white/[0.06]" : "bg-white/[0.03]"
                      } ${
                        isBeatBorder ? "border-r-white/20" : "border-r-white/[0.07]"
                      } border-b-white/[0.07]`}
                      style={{ width: CELL_W, height: CELL_H }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onToggleNote(cellKey);
                      }}
                    >
                      {isActive && (
                        <div
                          className="w-full h-full rounded-sm"
                          style={{
                            backgroundColor: padGlow,
                            boxShadow: isPlayheadHere
                              ? `0 0 14px ${padGlow}, 0 0 28px ${padGlow}80`
                              : `0 0 8px ${padGlow}99`,
                            transform: isPlayheadHere ? "scale(1.08)" : "none",
                            transition: "box-shadow 80ms ease, transform 80ms ease",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Step numbers */}
          <div
            className="flex border-t border-white/10 sticky bottom-0 bg-[#0e1a16]"
            style={{ width: STEPS * CELL_W }}
          >
            {Array.from({ length: STEPS }, (_, i) => (
              <div
                key={i}
                className={`shrink-0 text-center text-xs py-1 ${
                  (i + 1) % 4 === 0
                    ? "border-r border-r-white/20"
                    : "border-r border-r-white/[0.07]"
                } ${isPlaying && i === currentStep ? "font-bold" : "text-white/50"}`}
                style={{
                  width: CELL_W,
                  ...(isPlaying && i === currentStep ? { color: padGlow } : {}),
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
