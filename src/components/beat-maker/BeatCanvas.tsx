'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { PianoRoll } from './PianoRoll';
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
    beginHistoryTransaction,
    endHistoryTransaction,
    undo,
    redo,
    canUndo,
    canRedo
} from '@/lib/canvas-store';
import {
    PAD_SIZE,
    GRID_COLS,
    CELL,
    slotToPosition,
    positionToSlot,
    getOccupiedSlots
} from '@/lib/grid-constants';

interface OpenRollPos {
    padId: string;
    x: number;
    y: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

const INITIAL_PAD_LEFT = 50;
const SIDEBAR_WIDTH_MIN = 300;
const SIDEBAR_WIDTH_MAX = 400;
const SIDEBAR_WIDTH_RATIO = 0.36;
const SIDEBAR_RIGHT_GUTTER = 24;

export function BeatCanvas() {
    const { pads, padNotes, openRollPadId, isPlaying, currentStep } =
        useCanvasStore();
    usePlaybackTimer();

    const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
    const hasSetInitialCamera = useRef(false);
    const hasUserPositionedView = useRef(false);
    const [dragging, setDragging] = useState<
        | { type: 'canvas' }
        | {
              type: 'pad';
              id: string;
              offsetX: number;
              offsetY: number;
              startSlot: number;
          }
        | { type: 'pianoroll'; padId: string; offsetX: number; offsetY: number }
        | null
    >(null);

    // Sidebar-aware offset: shift canvas origin to center of visible area (left of chat)
    const [sidebarOffset, setSidebarOffset] = useState(0);

    const getSidebarOffset = useCallback((width: number) => {
        const sidebarWidth =
            Math.max(
                SIDEBAR_WIDTH_MIN,
                Math.min(SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_RATIO * width)
            ) + SIDEBAR_RIGHT_GUTTER;
        return sidebarWidth / 2;
    }, []);

    const getInitialCamera = useCallback(() => {
        // Center the grid in the viewport
        // We assume a default visual weight of ~3 rows for the initial view
        const gridCenterX = (GRID_COLS * CELL) / 2;
        const gridCenterY = (3 * CELL) / 2;

        return {
            x: -gridCenterX,
            y: -gridCenterY,
            zoom: 1
        };
    }, []);

    useEffect(() => {
        function computeOffset() {
            const w = window.innerWidth;
            const nextSidebarOffset = getSidebarOffset(w);
            setSidebarOffset(nextSidebarOffset);
            if (
                !hasSetInitialCamera.current ||
                !hasUserPositionedView.current
            ) {
                setCamera(getInitialCamera());
                hasSetInitialCamera.current = true;
            }
        }
        computeOffset();
        window.addEventListener('resize', computeOffset);
        return () => window.removeEventListener('resize', computeOffset);
    }, [getInitialCamera, getSidebarOffset]);

    // Reset to clean centered state when all pads are removed
    const prevPadCount = useRef(pads.length);
    useEffect(() => {
        if (pads.length === 0 && prevPadCount.current > 0) {
            setCamera(getInitialCamera());
            hasUserPositionedView.current = false;
        }
        prevPadCount.current = pads.length;
    }, [pads.length, getInitialCamera]);

    // Piano roll position is local UI state (not in the store)
    const [rollPos, setRollPos] = useState<OpenRollPos | null>(null);

    // Snap animation state
    const [isSnapping, setIsSnapping] = useState(false);

    // Track which slot the cursor is hovering during a pad drag
    const [hoverSlot, setHoverSlot] = useState<number | null>(null);

    const canUndoNow = canUndo();
    const canRedoNow = canRedo();

    const lastMouse = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const padPointerDownRef = useRef<{
        id: string;
        x: number;
        y: number;
    } | null>(null);
    const padDraggedRef = useRef(false);

    // Occupied slots map (slot index -> pad ID)
    const occupiedSlots = useMemo(() => getOccupiedSlots(pads), [pads]);

    // Ghost slots: show enough rows for all pads + 1 extra row
    const ghostSlotCount = useMemo(() => {
        const highestOccupied =
            pads.length > 0
                ? Math.max(...pads.map((p) => positionToSlot(p.x, p.y)))
                : -1;
        const minSlots = GRID_COLS * 2; // at least 2 rows
        const needed = highestOccupied + GRID_COLS + 1; // one extra row
        const total = Math.max(minSlots, needed);
        // Round up to full row
        return Math.ceil(total / GRID_COLS) * GRID_COLS;
    }, [pads]);

    // Keep rollPos.padId in sync with store's openRollPadId
    const effectiveRollPos = (() => {
        if (!openRollPadId) return null;
        if (rollPos && rollPos.padId === openRollPadId) return rollPos;
        const pad = pads.find((p) => p.id === openRollPadId);
        if (!pad) return null;
        return {
            padId: openRollPadId,
            x: pad.x + pad.size + 40,
            y: pad.y - 50
        };
    })();

    const activeRollPad = useMemo(
        () =>
            effectiveRollPos
                ? (pads.find((p) => p.id === effectiveRollPos.padId) ?? null)
                : null,
        [effectiveRollPos, pads]
    );

    const ghostSlots = useMemo(
        () =>
            Array.from({ length: ghostSlotCount }, (_, i) => {
                const pos = slotToPosition(i);
                const isOccupied = occupiedSlots.has(i);
                const isHover = hoverSlot === i && dragging?.type === 'pad';
                if (isOccupied && !isHover) return null;
                return (
                    <div
                        key={`ghost-${i}`}
                        className="absolute rounded-xl pointer-events-none"
                        style={{
                            left: pos.x,
                            top: pos.y,
                            width: PAD_SIZE,
                            height: PAD_SIZE,
                            border: isHover
                                ? '2px solid rgba(16,185,129,0.35)'
                                : '2px dashed rgba(255,255,255,0.12)',
                            backgroundColor: isHover
                                ? 'rgba(16,185,129,0.08)'
                                : 'transparent',
                            zIndex: 0,
                            transition:
                                'border-color 0.1s, background-color 0.1s'
                        }}
                    />
                );
            }),
        [ghostSlotCount, occupiedSlots, hoverSlot, dragging?.type]
    );

    // --- Canvas dragging ---
    const handleMouseDown = useCallback((e: MouseEvent) => {
        setDragging({ type: 'canvas' });
        hasUserPositionedView.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
    }, []);

    const handlePadDragStart = useCallback(
        (e: MouseEvent, padId: string) => {
            const pad = pads.find((p) => p.id === padId);
            if (!pad) return;
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;

            const canvasX =
                (e.clientX - rect.left - rect.width / 2 + sidebarOffset) /
                    camera.zoom -
                camera.x;
            const canvasY =
                (e.clientY - rect.top - rect.height / 2) / camera.zoom -
                camera.y;

            setDragging({
                type: 'pad',
                id: padId,
                offsetX: canvasX - pad.x,
                offsetY: canvasY - pad.y,
                startSlot: positionToSlot(pad.x, pad.y)
            });
            beginHistoryTransaction();
            padPointerDownRef.current = {
                id: padId,
                x: e.clientX,
                y: e.clientY
            };
            padDraggedRef.current = false;

            e.preventDefault();
            e.stopPropagation();
        },
        [pads, camera, sidebarOffset]
    );

    const handlePianoRollDragStart = useCallback(
        (e: MouseEvent) => {
            if (!effectiveRollPos) return;
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;

            const canvasX =
                (e.clientX - rect.left - rect.width / 2 + sidebarOffset) /
                    camera.zoom -
                camera.x;
            const canvasY =
                (e.clientY - rect.top - rect.height / 2) / camera.zoom -
                camera.y;

            setDragging({
                type: 'pianoroll',
                padId: effectiveRollPos.padId,
                offsetX: canvasX - effectiveRollPos.x,
                offsetY: canvasY - effectiveRollPos.y
            });

            e.preventDefault();
            e.stopPropagation();
        },
        [effectiveRollPos, camera, sidebarOffset]
    );

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!dragging) return;

            if (dragging.type === 'canvas') {
                const dx = e.clientX - lastMouse.current.x;
                const dy = e.clientY - lastMouse.current.y;
                lastMouse.current = { x: e.clientX, y: e.clientY };
                setCamera((c) => ({
                    ...c,
                    x: c.x + dx / c.zoom,
                    y: c.y + dy / c.zoom
                }));
            } else if (dragging.type === 'pad') {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const pointerDown = padPointerDownRef.current;
                if (pointerDown && pointerDown.id === dragging.id) {
                    const moved = Math.hypot(
                        e.clientX - pointerDown.x,
                        e.clientY - pointerDown.y
                    );
                    if (moved > 8 && !padDraggedRef.current) {
                        padDraggedRef.current = true;
                        bringPadToFront(dragging.id);
                    }
                }
                const canvasX =
                    (e.clientX - rect.left - rect.width / 2 + sidebarOffset) /
                        camera.zoom -
                    camera.x;
                const canvasY =
                    (e.clientY - rect.top - rect.height / 2) / camera.zoom -
                    camera.y;
                const newX = canvasX - dragging.offsetX;
                const newY = canvasY - dragging.offsetY;
                movePad(dragging.id, newX, newY);
                // Update hover slot for ghost highlight
                setHoverSlot(
                    positionToSlot(newX + PAD_SIZE / 2, newY + PAD_SIZE / 2)
                );
            } else if (dragging.type === 'pianoroll') {
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const canvasX =
                    (e.clientX - rect.left - rect.width / 2 + sidebarOffset) /
                        camera.zoom -
                    camera.x;
                const canvasY =
                    (e.clientY - rect.top - rect.height / 2) / camera.zoom -
                    camera.y;
                setRollPos((prev) =>
                    prev && prev.padId === dragging.padId
                        ? {
                              ...prev,
                              x: canvasX - dragging.offsetX,
                              y: canvasY - dragging.offsetY
                          }
                        : prev
                );
            }
        },
        [dragging, camera, sidebarOffset]
    );

    const handleMouseUp = useCallback(() => {
        padPointerDownRef.current = null;
        setHoverSlot(null);

        if (dragging?.type === 'pad') {
            const pad = pads.find((p) => p.id === dragging.id);
            if (pad && padDraggedRef.current) {
                // Snap to nearest grid slot
                const targetSlot = positionToSlot(
                    pad.x + PAD_SIZE / 2,
                    pad.y + PAD_SIZE / 2
                );
                const occupantId = occupiedSlots.get(targetSlot);

                if (occupantId && occupantId !== dragging.id) {
                    // Slot is occupied by another pad: swap them
                    const targetPos = slotToPosition(targetSlot);
                    movePad(dragging.id, targetPos.x, targetPos.y);
                    const startPos = slotToPosition(dragging.startSlot);
                    movePad(occupantId, startPos.x, startPos.y);
                } else {
                    // Snap to the target slot
                    const pos = slotToPosition(targetSlot);
                    movePad(dragging.id, pos.x, pos.y);
                }

                // Animate the snap
                setIsSnapping(true);
                setTimeout(() => setIsSnapping(false), 180);
            }
            endHistoryTransaction();
        }

        setDragging(null);
    }, [dragging, pads, occupiedSlots]);

    // Prevent default scroll/zoom on the canvas (zoom is buttons-only)
    // but allow scrolling inside the piano roll
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const prevent = (e: WheelEvent) => {
            if ((e.target as HTMLElement).closest('.piano-grid-scroll')) return;
            e.preventDefault();
        };
        el.addEventListener('wheel', prevent, { passive: false });
        return () => el.removeEventListener('wheel', prevent);
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
                y: pad.y - 50
            });
            openPianoRoll(padId);
        },
        [openRollPadId, pads]
    );

    const handleClosePianoRoll = useCallback(() => {
        closePianoRoll();
    }, []);

    const handleToggleNote = useCallback(
        (noteKey: string) => {
            if (!openRollPadId) return;
            toggleNote(openRollPadId, noteKey);
        },
        [openRollPadId]
    );

    const handleRemovePad = useCallback(
        (padId: string, e: React.MouseEvent) => {
            e.stopPropagation();
            removePad(padId);
        },
        []
    );

    const handleToggleMute = useCallback((padId: string) => {
        togglePadMute(padId);
    }, []);

    const hasPianoRoll = (padId: string) => openRollPadId === padId;

    // ---- Sort layout ----
    // Pads are always on-grid, so sort just reorders them alphabetically by label.
    const handleSort = useCallback(() => {
        hasUserPositionedView.current = true;
        setIsSnapping(true);
        beginHistoryTransaction();

        const sorted = [...pads].sort((a, b) =>
            a.color.label.localeCompare(b.color.label, undefined, {
                sensitivity: 'base'
            })
        );
        sorted.forEach((pad, i) => {
            const pos = slotToPosition(i);
            movePad(pad.id, pos.x, pos.y);
        });
        endHistoryTransaction();

        // Center the view on the sorted grid
        setCamera((c) => ({ x: 0, y: 0, zoom: c.zoom }));

        setTimeout(() => setIsSnapping(false), 350);
    }, [pads]);

    return (
        <>
            {/* Canvas viewport */}
            <div
                ref={containerRef}
                className="canvas-dots w-full h-full cursor-grab active:cursor-grabbing"
                style={{
                    backgroundSize: `${28 * camera.zoom}px ${28 * camera.zoom}px`,
                    backgroundPosition: `calc(50% - ${sidebarOffset}px + ${camera.x * camera.zoom}px) calc(50% + ${camera.y * camera.zoom}px)`
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
                        transformOrigin: '0 0'
                    }}
                >
                    {/* Ghost grid slots */}
                    {ghostSlots}

                    {/* Tether line between pad and its piano roll */}
                    <svg
                        className="absolute pointer-events-none"
                        style={{
                            left: 0,
                            top: 0,
                            overflow: 'visible',
                            zIndex: 0
                        }}
                        width="0"
                        height="0"
                    >
                        {effectiveRollPos &&
                            activeRollPad &&
                            (() => {
                                const padCx =
                                    activeRollPad.x + activeRollPad.size / 2;
                                const padCy =
                                    activeRollPad.y + activeRollPad.size / 2;
                                const prAx = effectiveRollPos.x;
                                const prAy = effectiveRollPos.y + 20;
                                const midX = (padCx + prAx) / 2;
                                return (
                                    <g>
                                        <path
                                            d={`M ${padCx} ${padCy} C ${midX} ${padCy} ${midX} ${prAy} ${prAx} ${prAy}`}
                                            stroke={activeRollPad.color.glow}
                                            strokeOpacity={0.25}
                                            strokeWidth={2}
                                            strokeDasharray="6 4"
                                            fill="none"
                                        />
                                        <circle
                                            cx={padCx}
                                            cy={padCy}
                                            r={4}
                                            fill={activeRollPad.color.glow}
                                            fillOpacity={0.4}
                                        />
                                        <circle
                                            cx={prAx}
                                            cy={prAy}
                                            r={4}
                                            fill={activeRollPad.color.glow}
                                            fillOpacity={0.4}
                                        />
                                    </g>
                                );
                            })()}
                    </svg>

                    {pads.map((pad, i) => {
                        const isDraggingThis =
                            dragging?.type === 'pad' && dragging.id === pad.id;
                        return (
                            <div
                                key={pad.id}
                                className="beat-pad group/pad absolute rounded-xl cursor-pointer transition-shadow"
                                style={{
                                    left: pad.x,
                                    top: pad.y,
                                    width: pad.size,
                                    height: pad.size,
                                    backgroundColor: pad.color.bg,
                                    border: `2px solid ${pad.color.bg}80`,
                                    filter: pad.muted
                                        ? 'saturate(0.2) brightness(0.45)'
                                        : 'none',
                                    boxShadow: `0 4px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25), inset 0 1px 0 ${pad.color.glow}20, inset 0 -1px 0 rgba(0,0,0,0.2)`,
                                    zIndex: isDraggingThis ? 999 : i + 1,
                                    transition:
                                        isSnapping && !isDraggingThis
                                            ? 'left 0.18s ease-out, top 0.18s ease-out, filter 0.15s ease'
                                            : 'filter 0.15s ease'
                                }}
                                onMouseDown={(e) => {
                                    handlePadDragStart(e, pad.id);
                                }}
                                onClick={(e) => {
                                    if (
                                        (e.target as HTMLElement).closest(
                                            'button'
                                        )
                                    )
                                        return;
                                    if (padDraggedRef.current) {
                                        padDraggedRef.current = false;
                                        padPointerDownRef.current = null;
                                        return;
                                    }
                                    if (e.detail !== 1) return;
                                    handleToggleMute(pad.id);
                                }}
                                onDoubleClick={() => {
                                    // Undo the mute toggle from the first click of the double-click
                                    handleToggleMute(pad.id);
                                    handleOpenPianoRoll(pad.id);
                                }}
                            >
                                {/* Action button drawer */}
                                <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1.5 z-[3] opacity-0 translate-y-1 group-hover/pad:opacity-100 group-hover/pad:translate-y-0 transition-all duration-150 ease-out">
                                    {!hasPianoRoll(pad.id) && (
                                        <button
                                            className="w-[22px] h-[22px] rounded-md text-white/60 hover:text-white text-xs flex items-center justify-center cursor-pointer transition-colors"
                                            style={{
                                                backgroundColor: '#111118',
                                                boxShadow:
                                                    '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)'
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                handleOpenPianoRoll(pad.id);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            title="Open piano roll"
                                        >
                                            &#9835;
                                        </button>
                                    )}
                                    <button
                                        className="w-[22px] h-[22px] rounded-md text-white/60 hover:bg-red-600 hover:text-white text-sm flex items-center justify-center cursor-pointer transition-colors"
                                        style={{
                                            backgroundColor: '#111118',
                                            boxShadow:
                                                '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)'
                                        }}
                                        onMouseDown={(e) =>
                                            handleRemovePad(pad.id, e)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        title="Remove pad"
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1 relative z-[2]">
                                    <span
                                        className="text-sm font-bold uppercase tracking-wider"
                                        style={{
                                            color: pad.color.glow,
                                            textShadow: `0 1px 3px rgba(0,0,0,0.5), 0 0 8px ${pad.color.glow}30`
                                        }}
                                    >
                                        {pad.color.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Piano roll (single) */}
                    {effectiveRollPos && activeRollPad && (
                        <PianoRoll
                            key={effectiveRollPos.padId}
                            x={effectiveRollPos.x}
                            y={effectiveRollPos.y}
                            zIndex={pads.length + 20}
                            padLabel={activeRollPad.color.label}
                            padBg={activeRollPad.color.bg}
                            padGlow={activeRollPad.color.glow}
                            notes={
                                padNotes.get(effectiveRollPos.padId) ??
                                new Set()
                            }
                            onToggleNote={handleToggleNote}
                            onTitleBarMouseDown={handlePianoRollDragStart}
                            onClose={handleClosePianoRoll}
                            currentStep={currentStep}
                            isPlaying={isPlaying}
                        />
                    )}
                </div>
            </div>

            {/* HUD: zoom + sort + undo/redo */}
            <div
                className="fixed bottom-6 left-4 z-50 flex items-center gap-2 px-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10"
                style={{
                    height: 44,
                    boxShadow:
                        '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
                }}
            >
                <button
                    onClick={() =>
                        setCamera((c) => ({
                            ...c,
                            zoom: Math.max(MIN_ZOOM, c.zoom - 0.1)
                        }))
                    }
                    className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                    &minus;
                </button>
                <span className="text-sm text-white/85 w-12 text-center">
                    {Math.round(camera.zoom * 100)}%
                </span>
                <button
                    onClick={() =>
                        setCamera((c) => ({
                            ...c,
                            zoom: Math.min(MAX_ZOOM, c.zoom + 0.1)
                        }))
                    }
                    className="text-sm text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                    +
                </button>
                <div className="w-px h-4 bg-white/15 mx-1" />
                <button
                    onClick={() => {
                        const gridCenterX = (GRID_COLS * CELL) / 2;
                        const gridCenterY =
                            (Math.max(2, Math.ceil(pads.length / GRID_COLS)) *
                                CELL) /
                            2;
                        setCamera({
                            x: -gridCenterX,
                            y: -gridCenterY,
                            zoom: 1
                        });
                        hasUserPositionedView.current = false;
                    }}
                    className="text-xs text-white/70 hover:text-white transition-colors cursor-pointer px-1"
                    title="Center view"
                >
                    Center
                </button>
                <div className="w-px h-4 bg-white/15 mx-1" />
                <button
                    onClick={handleSort}
                    className="text-xs text-white/70 hover:text-white transition-colors cursor-pointer px-1"
                    title="Sort pads alphabetically into the grid"
                >
                    Sort
                </button>
                <div className="w-px h-4 bg-white/15 mx-1" />
                <button
                    onClick={() => undo()}
                    disabled={!canUndoNow}
                    className="text-xs transition-colors px-1 disabled:opacity-40 disabled:cursor-not-allowed text-white/70 hover:text-white cursor-pointer"
                    title="Undo"
                >
                    Undo
                </button>
                <button
                    onClick={() => redo()}
                    disabled={!canRedoNow}
                    className="text-xs transition-colors px-1 disabled:opacity-40 disabled:cursor-not-allowed text-white/70 hover:text-white cursor-pointer"
                    title="Redo"
                >
                    Redo
                </button>
            </div>
        </>
    );
}
