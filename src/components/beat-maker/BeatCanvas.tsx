"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { MouseEvent } from "react";
import { PianoRoll } from "./PianoRoll";
import {
  useCanvasStore,
  usePlaybackTimer,
  movePad,
  bringPadToFront,
  removePad,
  togglePadMute,
  toggleNote,
  openPianoRoll,
  closePianoRoll,
  setPlaying,
  setBpm,
  setVolume,
  getSerializableState,
} from "@/lib/canvas-store";
// Audio engine is imported lazily to avoid bundling @strudel/web at build time
const getAudioEngine = () => import("@/lib/audio-engine");

interface OpenRollPos {
  padId: string;
  x: number;
  y: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const PAD_SIZE = 110;

const TRANSPORT_COLOR = { bg: "#065f46", glow: "#34d399" };
const CONTROL_COLOR = { bg: "#27272a", glow: "#a1a1aa" }; // muted zinc
const SHARE_COLOR = { bg: "#0c4a6e", glow: "#7dd3fc" }; // light blue

// Strict 4-column grid.  CELL = pad + gap.  Grid is centered at origin.
const GRID_GAP = 20;
const CELL = PAD_SIZE + GRID_GAP; // 130
const GRID_COLS = 4;
// Grid origin: top-left of the 4-column block, centered horizontally
const GRID_LEFT = -(GRID_COLS * CELL - GRID_GAP) / 2; // -250

/** Compute the {x,y} for a given (col, row) in the grid. */
function gridPos(col: number, row: number) {
  return { x: GRID_LEFT + col * CELL, y: row * CELL };
}

// Transport always occupies row 0, cols 0-3.
const DEFAULT_TRANSPORT_POS = {
  playPause: gridPos(0, 0),
  bpm: gridPos(1, 0),
  volume: gridPos(2, 0),
  share: gridPos(3, 0),
};

export function BeatCanvas() {
  const { pads, padNotes, openRollPadId, isPlaying, currentStep, bpm, playStartedAt, playStartedAtStep, volume } = useCanvasStore();
  usePlaybackTimer();

  const [mounted, setMounted] = useState(false);

  // StrudelProvider handles preload; just track mount state here.
  useEffect(() => {
    setMounted(true);
  }, []);

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState<
    | { type: "canvas" }
    | { type: "pad"; id: string; offsetX: number; offsetY: number }
    | { type: "pianoroll"; padId: string; offsetX: number; offsetY: number }
    | { type: "transport"; id: string; offsetX: number; offsetY: number }
    | null
  >(null);
  const [activePad, setActivePad] = useState<string | null>(null);
  const [transportPos, setTransportPos] = useState(DEFAULT_TRANSPORT_POS);

  // Sidebar-aware offset: shift canvas origin to center of visible area (left of chat)
  const [sidebarOffset, setSidebarOffset] = useState(0);
  useEffect(() => {
    function computeOffset() {
      const w = window.innerWidth;
      // Mirrors ChatSidebar CSS: w-[min(400px,36vw)] min-w-[300px] + right-6 (24px)
      const sidebarWidth = Math.max(300, Math.min(400, 0.36 * w)) + 24;
      setSidebarOffset(sidebarWidth / 2);
    }
    computeOffset();
    window.addEventListener("resize", computeOffset);
    return () => window.removeEventListener("resize", computeOffset);
  }, []);

  // Reset to clean centered state when all pads are removed
  const prevPadCount = useRef(pads.length);
  useEffect(() => {
    if (pads.length === 0 && prevPadCount.current > 0) {
      setTransportPos(DEFAULT_TRANSPORT_POS);
      setCamera({ x: 0, y: 0, zoom: 1 });
    }
    prevPadCount.current = pads.length;
  }, [pads.length]);

  // Piano roll position is local UI state (not in the store)
  const [rollPos, setRollPos] = useState<OpenRollPos | null>(null);

  // Organize animation state
  const [isOrganizing, setIsOrganizing] = useState(false);

  // Share dialog state
  const shareDialogRef = useRef<HTMLDialogElement>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareName, setShareName] = useState("Untitled Beat");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const lastMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep rollPos.padId in sync with store's openRollPadId
  // If store says open a different pad, update position
  const effectiveRollPos = (() => {
    if (!openRollPadId) return null;
    if (rollPos && rollPos.padId === openRollPadId) return rollPos;
    // Store opened a pad we don't have a position for — compute one
    const pad = pads.find((p) => p.id === openRollPadId);
    if (!pad) return null;
    return {
      padId: openRollPadId,
      x: pad.x + pad.size + 40,
      y: pad.y - 50,
    };
  })();

  // --- Canvas dragging ---
  const handleMouseDown = useCallback((e: MouseEvent) => {
    setDragging({ type: "canvas" });
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const handlePadDragStart = useCallback(
    (e: MouseEvent, padId: string) => {
      const pad = pads.find((p) => p.id === padId);
      if (!pad) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const canvasX = (e.clientX - rect.left - rect.width / 2 + sidebarOffset) / camera.zoom - camera.x;
      const canvasY = (e.clientY - rect.top - rect.height / 2) / camera.zoom - camera.y;

      setDragging({
        type: "pad",
        id: padId,
        offsetX: canvasX - pad.x,
        offsetY: canvasY - pad.y,
      });

      bringPadToFront(padId);
      e.preventDefault();
      e.stopPropagation();
    },
    [pads, camera, sidebarOffset],
  );

  const handlePianoRollDragStart = useCallback(
    (e: MouseEvent) => {
      if (!effectiveRollPos) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const canvasX = (e.clientX - rect.left - rect.width / 2 + sidebarOffset) / camera.zoom - camera.x;
      const canvasY = (e.clientY - rect.top - rect.height / 2) / camera.zoom - camera.y;

      setDragging({
        type: "pianoroll",
        padId: effectiveRollPos.padId,
        offsetX: canvasX - effectiveRollPos.x,
        offsetY: canvasY - effectiveRollPos.y,
      });

      e.preventDefault();
      e.stopPropagation();
    },
    [effectiveRollPos, camera, sidebarOffset],
  );

  const handleTransportDragStart = useCallback(
    (e: MouseEvent, id: "playPause" | "bpm" | "volume" | "share") => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvasX = (e.clientX - rect.left - rect.width / 2 + sidebarOffset) / camera.zoom - camera.x;
      const canvasY = (e.clientY - rect.top - rect.height / 2) / camera.zoom - camera.y;
      const pos = transportPos[id];
      setDragging({
        type: "transport",
        id,
        offsetX: canvasX - pos.x,
        offsetY: canvasY - pos.y,
      });
      e.preventDefault();
      e.stopPropagation();
    },
    [camera, transportPos, sidebarOffset],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;

      if (dragging.type === "canvas") {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        setCamera((c) => ({ ...c, x: c.x + dx / c.zoom, y: c.y + dy / c.zoom }));
      } else if (dragging.type === "pad") {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const canvasX = (e.clientX - rect.left - rect.width / 2 + sidebarOffset) / camera.zoom - camera.x;
        const canvasY = (e.clientY - rect.top - rect.height / 2) / camera.zoom - camera.y;
        movePad(dragging.id, canvasX - dragging.offsetX, canvasY - dragging.offsetY);
      } else if (dragging.type === "pianoroll") {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const canvasX = (e.clientX - rect.left - rect.width / 2 + sidebarOffset) / camera.zoom - camera.x;
        const canvasY = (e.clientY - rect.top - rect.height / 2) / camera.zoom - camera.y;
        setRollPos((prev) =>
          prev && prev.padId === dragging.padId
            ? { ...prev, x: canvasX - dragging.offsetX, y: canvasY - dragging.offsetY }
            : prev,
        );
      } else if (dragging.type === "transport") {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const canvasX = (e.clientX - rect.left - rect.width / 2 + sidebarOffset) / camera.zoom - camera.x;
        const canvasY = (e.clientY - rect.top - rect.height / 2) / camera.zoom - camera.y;
        const id = dragging.id as "playPause" | "bpm" | "volume" | "share";
        setTransportPos((prev) => ({
          ...prev,
          [id]: { x: canvasX - dragging.offsetX, y: canvasY - dragging.offsetY },
        }));
      }
    },
    [dragging, camera, sidebarOffset],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setCamera((c) => ({
      ...c,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom + delta * c.zoom)),
    }));
  }, []);

  // Attach wheel listener with { passive: false } so preventDefault() works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // --- Pad tap (visual pulse) ---
  const handlePadTap = useCallback((padId: string) => {
    setActivePad(padId);
    setTimeout(() => setActivePad(null), 150);
  }, []);

  // --- Piano roll management ---
  const handleOpenPianoRoll = useCallback(
    (padId: string) => {
      if (openRollPadId === padId) return;
      const pad = pads.find((p) => p.id === padId);
      if (!pad) return;

      setRollPos({
        padId,
        x: pad.x + pad.size + 40,
        y: pad.y - 50,
      });
      openPianoRoll(padId);
    },
    [openRollPadId, pads],
  );

  const handleClosePianoRoll = useCallback(() => {
    closePianoRoll();
  }, []);

  const handleToggleNote = useCallback(
    (noteKey: string) => {
      if (!openRollPadId) return;
      toggleNote(openRollPadId, noteKey);
    },
    [openRollPadId],
  );

  const handleRemovePad = useCallback((padId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removePad(padId);
  }, []);

  const handleToggleMute = useCallback((padId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    togglePadMute(padId);
  }, []);

  const hasPianoRoll = (padId: string) => openRollPadId === padId;

  const handleShareClick = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setCopied(false);
    setShareUrl(null);

    try {
      const data = getSerializableState();
      const res = await fetch("/api/soundboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: shareName, data }),
      });

      if (!res.ok) throw new Error("Failed to save");

      const { id } = await res.json();
      const url = `${window.location.origin}/board/${id}`;
      setShareUrl(url);
      shareDialogRef.current?.showModal();
    } catch {
      // If save fails, still open dialog to show error state
      shareDialogRef.current?.showModal();
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, shareName]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  // ---- Organize layout ----
  // Strict 4×N grid.  Row 0 = transport, rows 1+ = drum pads.
  const handleOrganize = useCallback(() => {
    setIsOrganizing(true);

    // Row 0: transport controls (always cols 0-3)
    setTransportPos({
      playPause: gridPos(0, 0),
      bpm: gridPos(1, 0),
      volume: gridPos(2, 0),
      share: gridPos(3, 0),
    });

    // Rows 1+: drum pads, 4 per row
    pads.forEach((pad, i) => {
      const col = i % GRID_COLS;
      const row = 1 + Math.floor(i / GRID_COLS);
      const pos = gridPos(col, row);
      movePad(pad.id, pos.x, pos.y);
    });

    // Fit-to-view: reset pan, auto-zoom
    const totalRows = 1 + Math.ceil(pads.length / GRID_COLS);
    const contentW = GRID_COLS * CELL;
    const contentH = totalRows * CELL;

    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const viewW = rect.width - sidebarOffset * 2;
      const viewH = rect.height;
      const margin = 100;
      const fitZoom = Math.min(
        (viewW - margin) / contentW,
        (viewH - margin) / contentH,
        MAX_ZOOM,
      );
      setCamera({ x: 0, y: 0, zoom: Math.max(MIN_ZOOM, fitZoom) });
    } else {
      setCamera({ x: 0, y: 0, zoom: 1 });
    }

    setTimeout(() => setIsOrganizing(false), 350);
  }, [pads, sidebarOffset]);

  return (
    <>
      {/* Canvas viewport */}
      <div
        ref={containerRef}
        className="canvas-dots w-full h-full cursor-grab active:cursor-grabbing"
        style={{
          backgroundSize: `${28 * camera.zoom}px ${28 * camera.zoom}px`,
          backgroundPosition: `calc(50% - ${sidebarOffset}px + ${camera.x * camera.zoom}px) calc(50% + ${camera.y * camera.zoom}px)`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="w-full h-full"
          style={{
            transform: `translate(calc(50% - ${sidebarOffset}px), 50%) scale(${camera.zoom}) translate(${camera.x}px, ${camera.y}px)`,
            transformOrigin: "0 0",
          }}
        >
          {/* Empty state */}
          {pads.length === 0 && (
            <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="text-white/30 text-lg font-medium tracking-wide">
                No pads yet
              </p>
              <p className="text-white/20 text-sm mt-1">
                Use the chat to add beat pads, or double-click a pad to open its piano roll
              </p>
            </div>
          )}

          {/* Tether line between pad and its piano roll */}
          <svg
            className="absolute pointer-events-none"
            style={{ left: 0, top: 0, overflow: "visible", zIndex: 0 }}
            width="0"
            height="0"
          >
            {effectiveRollPos &&
              (() => {
                const pad = pads.find((p) => p.id === effectiveRollPos.padId);
                if (!pad) return null;
                const padCx = pad.x + pad.size / 2;
                const padCy = pad.y + pad.size / 2;
                const prAx = effectiveRollPos.x;
                const prAy = effectiveRollPos.y + 20;
                const midX = (padCx + prAx) / 2;
                return (
                  <g>
                    <path
                      d={`M ${padCx} ${padCy} C ${midX} ${padCy} ${midX} ${prAy} ${prAx} ${prAy}`}
                      stroke={pad.color.glow}
                      strokeOpacity={0.25}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      fill="none"
                    />
                    <circle cx={padCx} cy={padCy} r={4} fill={pad.color.glow} fillOpacity={0.4} />
                    <circle cx={prAx} cy={prAy} r={4} fill={pad.color.glow} fillOpacity={0.4} />
                  </g>
                );
              })()}
          </svg>

          {pads.map((pad, i) => (
            <div
              key={pad.id}
              className="beat-pad group/pad absolute rounded-xl cursor-pointer transition-shadow"
              style={{
                left: pad.x,
                top: pad.y,
                width: pad.size,
                height: pad.size,
                backgroundColor: pad.color.bg,
                opacity: pad.muted ? 0.35 : 1,
                boxShadow:
                  activePad === pad.id
                    ? `0 2px 4px rgba(0,0,0,0.3), inset 0 0 20px ${pad.color.glow}60, inset 0 2px 6px rgba(0,0,0,0.3)`
                    : `0 4px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 ${pad.color.glow}20, inset 0 -1px 0 rgba(0,0,0,0.2)`,
                zIndex: i + 1,
                transition: isOrganizing
                  ? "left 0.3s ease, top 0.3s ease, opacity 0.15s ease, box-shadow 0.2s ease"
                  : "opacity 0.15s ease, box-shadow 0.2s ease",
              }}
              onMouseDown={(e) => {
                handlePadTap(pad.id);
                handlePadDragStart(e, pad.id);
              }}
              onDoubleClick={() => handleOpenPianoRoll(pad.id)}
            >
              {/* Action button drawer — slides up from bottom on hover */}
              <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1.5 z-[3] opacity-0 translate-y-1 group-hover/pad:opacity-100 group-hover/pad:translate-y-0 transition-all duration-150 ease-out">
                {/* Mute toggle */}
                <button
                  className="w-[22px] h-[22px] rounded-md text-white/60 hover:text-white text-xs flex items-center justify-center cursor-pointer transition-colors"
                  style={{ backgroundColor: "#111118", boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)" }}
                  onMouseDown={(e) => handleToggleMute(pad.id, e)}
                  title={pad.muted ? "Unmute" : "Mute"}
                >
                  {pad.muted ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>
                {/* Piano roll */}
                {!hasPianoRoll(pad.id) && (
                  <button
                    className="w-[22px] h-[22px] rounded-md text-white/60 hover:text-white text-xs flex items-center justify-center cursor-pointer transition-colors"
                    style={{ backgroundColor: "#111118", boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)" }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleOpenPianoRoll(pad.id);
                    }}
                    title="Open piano roll"
                  >
                    &#9835;
                  </button>
                )}
                {/* Remove */}
                <button
                  className="w-[22px] h-[22px] rounded-md text-white/60 hover:bg-red-600 hover:text-white text-sm flex items-center justify-center cursor-pointer transition-colors"
                  style={{ backgroundColor: "#111118", boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)" }}
                  onMouseDown={(e) => handleRemovePad(pad.id, e)}
                  title="Remove pad"
                >
                  &times;
                </button>
              </div>
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative z-[2]">
                <span
                  className="text-sm font-bold uppercase tracking-wider"
                  style={{ color: pad.color.glow, textShadow: `0 1px 3px rgba(0,0,0,0.5), 0 0 8px ${pad.color.glow}30` }}
                >
                  {pad.color.label}
                </span>
              </div>
              {/* Pulse overlay */}
              {activePad === pad.id && (
                <div
                  className="absolute inset-0 rounded-xl animate-ping-once"
                  style={{ backgroundColor: `${pad.color.glow}30` }}
                />
              )}
            </div>
          ))}

          {/* Transport pad (play/pause toggle) */}
          <div
            className="beat-pad absolute rounded-xl cursor-pointer transition-shadow"
            style={{
              left: transportPos.playPause.x,
              top: transportPos.playPause.y,
              width: PAD_SIZE,
              height: PAD_SIZE,
              backgroundColor: TRANSPORT_COLOR.bg,
              boxShadow: isPlaying
                ? `0 2px 4px rgba(0,0,0,0.3), inset 0 0 16px ${TRANSPORT_COLOR.glow}30, inset 0 2px 4px rgba(0,0,0,0.25)`
                : `0 4px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 ${TRANSPORT_COLOR.glow}15, inset 0 -1px 0 rgba(0,0,0,0.2)`,
              zIndex: pads.length + 10,
              ...(isOrganizing && { transition: "left 0.3s ease, top 0.3s ease" }),
            }}
            onMouseDown={(e) => handleTransportDragStart(e, "playPause")}
            onClick={async () => {
              const { play, stop } = await getAudioEngine();
              if (isPlaying) {
                stop();
                setPlaying(false);
              } else {
                await play();
                setPlaying(true);
              }
            }}
          >
            <div className="w-full h-full flex items-center justify-center relative z-[2]">
              {isPlaying ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill={TRANSPORT_COLOR.glow} style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.4))` }}>
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill={TRANSPORT_COLOR.glow} style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.4))` }}>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </div>

          {/* BPM pad */}
          <div
            className="beat-pad absolute rounded-xl cursor-pointer transition-shadow"
            style={{
              left: transportPos.bpm.x,
              top: transportPos.bpm.y,
              width: PAD_SIZE,
              height: PAD_SIZE,
              backgroundColor: CONTROL_COLOR.bg,
              boxShadow: `0 4px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 ${CONTROL_COLOR.glow}15, inset 0 -1px 0 rgba(0,0,0,0.2)`,
              zIndex: pads.length + 10,
              ...(isOrganizing && { transition: "left 0.3s ease, top 0.3s ease" }),
            }}
            onMouseDown={(e) => handleTransportDragStart(e, "bpm")}
          >
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative z-[2]">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: `${CONTROL_COLOR.glow}90`, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                BPM
              </span>
              <span className="text-2xl font-bold tabular-nums" style={{ color: CONTROL_COLOR.glow, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                {bpm}
              </span>
              <div className="flex gap-3 mt-0.5">
                <button
                  className="w-7 h-7 rounded-md flex items-center justify-center text-lg font-bold cursor-pointer transition-colors"
                  style={{ color: CONTROL_COLOR.glow, background: "rgba(255,255,255,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)" }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setBpm(bpm - 5); }}
                >
                  &minus;
                </button>
                <button
                  className="w-7 h-7 rounded-md flex items-center justify-center text-lg font-bold cursor-pointer transition-colors"
                  style={{ color: CONTROL_COLOR.glow, background: "rgba(255,255,255,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)" }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setBpm(bpm + 5); }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Volume pad */}
          <div
            className="beat-pad absolute rounded-xl cursor-pointer transition-shadow"
            style={{
              left: transportPos.volume.x,
              top: transportPos.volume.y,
              width: PAD_SIZE,
              height: PAD_SIZE,
              backgroundColor: CONTROL_COLOR.bg,
              boxShadow: `0 4px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 ${CONTROL_COLOR.glow}15, inset 0 -1px 0 rgba(0,0,0,0.2)`,
              zIndex: pads.length + 10,
              ...(isOrganizing && { transition: "left 0.3s ease, top 0.3s ease" }),
            }}
            onMouseDown={(e) => handleTransportDragStart(e, "volume")}
          >
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative z-[2]">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: `${CONTROL_COLOR.glow}90`, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                VOL
              </span>
              <span className="text-2xl font-bold tabular-nums" style={{ color: CONTROL_COLOR.glow, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                {volume}
              </span>
              <div className="flex gap-3 mt-0.5">
                <button
                  className="w-7 h-7 rounded-md flex items-center justify-center text-lg font-bold cursor-pointer transition-colors"
                  style={{ color: CONTROL_COLOR.glow, background: "rgba(255,255,255,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)" }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setVolume(volume - 5); }}
                >
                  &minus;
                </button>
                <button
                  className="w-7 h-7 rounded-md flex items-center justify-center text-lg font-bold cursor-pointer transition-colors"
                  style={{ color: CONTROL_COLOR.glow, background: "rgba(255,255,255,0.06)", boxShadow: "0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)" }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setVolume(volume + 5); }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Share pad */}
          <div
            className="beat-pad absolute rounded-xl cursor-pointer transition-shadow"
            style={{
              left: transportPos.share.x,
              top: transportPos.share.y,
              width: PAD_SIZE,
              height: PAD_SIZE,
              backgroundColor: SHARE_COLOR.bg,
              boxShadow: isSaving
                ? `0 2px 4px rgba(0,0,0,0.3), inset 0 0 16px ${SHARE_COLOR.glow}30, inset 0 2px 4px rgba(0,0,0,0.25)`
                : `0 4px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 ${SHARE_COLOR.glow}15, inset 0 -1px 0 rgba(0,0,0,0.2)`,
              zIndex: pads.length + 10,
              ...(isOrganizing && { transition: "left 0.3s ease, top 0.3s ease" }),
            }}
            onMouseDown={(e) => handleTransportDragStart(e, "share")}
            onClick={handleShareClick}
          >
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative z-[2]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={SHARE_COLOR.glow} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: SHARE_COLOR.glow, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
              >
                {isSaving ? "Saving..." : "Share"}
              </span>
            </div>
          </div>

          {/* Piano roll (single) */}
          {effectiveRollPos &&
            (() => {
              const pad = pads.find((p) => p.id === effectiveRollPos.padId);
              if (!pad) return null;
              return (
                <PianoRoll
                  key={effectiveRollPos.padId}
                  x={effectiveRollPos.x}
                  y={effectiveRollPos.y}
                  zIndex={pads.length + 20}
                  padLabel={pad.color.label}
                  padBg={pad.color.bg}
                  padGlow={pad.color.glow}
                  notes={padNotes.get(effectiveRollPos.padId) ?? new Set()}
                  onToggleNote={handleToggleNote}
                  onTitleBarMouseDown={handlePianoRollDragStart}
                  onClose={handleClosePianoRoll}
                  currentStep={currentStep}
                  isPlaying={isPlaying}
                  bpm={bpm}
                  playStartedAt={playStartedAt}
                  playStartedAtStep={playStartedAtStep}
                />
              );
            })()}
        </div>
      </div>

      {/* Share dialog — portalled to body to escape CSS transforms that break dialog centering */}
      {mounted &&
        createPortal(
          <dialog
            ref={shareDialogRef}
            className="backdrop:bg-black/60 bg-[#1a1625] text-white rounded-2xl border border-white/10 p-0 w-[380px] max-w-[90vw] shadow-2xl m-auto"
            onClick={(e) => {
              if (e.target === shareDialogRef.current) shareDialogRef.current?.close();
            }}
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-wide" style={{ color: TRANSPORT_COLOR.glow }}>
                  Share Soundboard
                </h2>
                <button
                  onClick={() => shareDialogRef.current?.close()}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-white/40 mb-1 block">Name</label>
                <input
                  type="text"
                  value={shareName}
                  onChange={(e) => setShareName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                  placeholder="My Beat"
                />
              </div>

              {shareUrl ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-widest text-white/40">Share Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono truncate focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-4 py-2 rounded-lg font-medium text-sm cursor-pointer transition-colors"
                      style={{
                        backgroundColor: copied ? "#059669" : TRANSPORT_COLOR.bg,
                        color: TRANSPORT_COLOR.glow,
                        border: `1px solid ${TRANSPORT_COLOR.glow}40`,
                      }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleShareClick}
                  disabled={isSaving || !shareName.trim()}
                  className="w-full py-2.5 rounded-lg font-medium text-sm cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: TRANSPORT_COLOR.bg,
                    color: TRANSPORT_COLOR.glow,
                    border: `1px solid ${TRANSPORT_COLOR.glow}40`,
                  }}
                >
                  {isSaving ? "Saving..." : "Save & Get Link"}
                </button>
              )}
            </div>
          </dialog>,
          document.body,
        )}

      {/* HUD: zoom + organize */}
      <div
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10"
        style={{ boxShadow: "0 3px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)" }}
      >
        <button
          onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(MIN_ZOOM, c.zoom - 0.1) }))}
          className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer"
        >
          &minus;
        </button>
        <span className="text-sm text-white/85 w-12 text-center">
          {Math.round(camera.zoom * 100)}%
        </span>
        <button
          onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(MAX_ZOOM, c.zoom + 0.1) }))}
          className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer"
        >
          +
        </button>
        <div className="w-px h-4 bg-white/15 mx-1" />
        <button
          onClick={handleOrganize}
          className="text-xs text-white/70 hover:text-white transition-colors cursor-pointer px-1"
          title="Organize pads into a grid"
        >
          Organize
        </button>
      </div>
    </>
  );
}
