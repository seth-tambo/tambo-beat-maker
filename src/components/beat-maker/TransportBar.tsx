'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    useCanvasStore,
    setBpm,
    setVolume,
    getSerializableState,
    clearAllPads
} from '@/lib/canvas-store';

const getAudioEngine = () => import('@/lib/audio-engine');

const TRANSPORT_COLOR = { bg: '#065f46', glow: '#34d399' };
const CONTROL_COLOR = { bg: '#27272a', glow: '#a1a1aa' };
const SHARE_COLOR = { bg: '#0c4a6e', glow: '#7dd3fc' };

export function TransportBar() {
    const { isPlaying, bpm, volume, pads } = useCanvasStore();
    const hasPads = pads.length > 0;

    const [isSaving, setIsSaving] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [shareName, setShareName] = useState('Untitled Beat');
    const [copied, setCopied] = useState(false);
    const shareDialogRef = useRef<HTMLDialogElement>(null);
    const clearDialogRef = useRef<HTMLDialogElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleShareClick = useCallback(async () => {
        if (isSaving) return;
        setIsSaving(true);
        setCopied(false);
        setShareUrl(null);

        try {
            const data = getSerializableState();
            const res = await fetch('/api/soundboards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: shareName, data })
            });

            if (!res.ok) throw new Error('Failed to save');

            const { id } = await res.json();
            const url = `${window.location.origin}/board/${id}`;
            setShareUrl(url);
            shareDialogRef.current?.showModal();
        } catch {
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

    const btnBase =
        'flex items-center justify-center rounded-lg transition-colors cursor-pointer';

    return (
        <>
            <div
                className="fixed z-50 flex items-center gap-2 px-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/10"
                style={{
                    height: 44,
                    boxShadow:
                        '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                    bottom: 24,
                    right: 'calc(max(300px, min(400px, 36vw)) + 40px)'
                }}
            >
                {/* Volume */}
                <div className="flex items-center gap-1.5">
                    <button
                        className={`${btnBase} w-6 h-6 text-xs font-bold`}
                        style={{
                            color: CONTROL_COLOR.glow,
                            background: 'rgba(255,255,255,0.06)'
                        }}
                        onClick={() => setVolume(volume - 5)}
                    >
                        &minus;
                    </button>
                    <div className="flex flex-col items-center min-w-[34px]">
                        <span
                            className="text-[9px] uppercase tracking-widest"
                            style={{ color: `${CONTROL_COLOR.glow}` }}
                        >
                            VOL
                        </span>
                        <span
                            className="text-sm font-bold tabular-nums leading-none"
                            style={{ color: 'rgba(255,255,255,0.9)' }}
                        >
                            {volume}
                        </span>
                    </div>
                    <button
                        className={`${btnBase} w-6 h-6 text-xs font-bold`}
                        style={{
                            color: CONTROL_COLOR.glow,
                            background: 'rgba(255,255,255,0.06)'
                        }}
                        onClick={() => setVolume(volume + 5)}
                    >
                        +
                    </button>
                </div>

                <div className="w-px h-6 bg-white/10" />

                {/* BPM */}
                <div className="flex items-center gap-1.5">
                    <button
                        className={`${btnBase} w-6 h-6 text-xs font-bold`}
                        style={{
                            color: CONTROL_COLOR.glow,
                            background: 'rgba(255,255,255,0.06)'
                        }}
                        onClick={() => setBpm(Math.floor((bpm - 1) / 5) * 5)}
                    >
                        &minus;
                    </button>
                    <div className="flex flex-col items-center min-w-[40px]">
                        <span
                            className="text-[9px] uppercase tracking-widest"
                            style={{ color: `${CONTROL_COLOR.glow}` }}
                        >
                            BPM
                        </span>
                        <span
                            className="text-sm font-bold tabular-nums leading-none"
                            style={{ color: 'rgba(255,255,255,0.9)' }}
                        >
                            {bpm}
                        </span>
                    </div>
                    <button
                        className={`${btnBase} w-6 h-6 text-xs font-bold`}
                        style={{
                            color: CONTROL_COLOR.glow,
                            background: 'rgba(255,255,255,0.06)'
                        }}
                        onClick={() => setBpm(Math.ceil((bpm + 1) / 5) * 5)}
                    >
                        +
                    </button>
                </div>

                <div className="w-px h-6 bg-white/10" />

                {/* Share */}
                <button
                    className={`${btnBase} gap-1.5 px-2.5 h-8 text-xs`}
                    disabled={!hasPads}
                    style={{
                        backgroundColor: SHARE_COLOR.bg,
                        color: SHARE_COLOR.glow,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        opacity: !hasPads ? 0.4 : 1,
                        cursor: !hasPads ? 'not-allowed' : 'pointer'
                    }}
                    onClick={handleShareClick}
                    title={!hasPads ? 'Add pads to share' : 'Share soundboard'}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={SHARE_COLOR.glow}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    {isSaving ? 'Saving...' : 'Share'}
                </button>

                <div className="w-px h-6 bg-white/10" />

                {/* Clear */}
                <button
                    className={`${btnBase} w-8 h-8`}
                    disabled={!hasPads}
                    style={{
                        backgroundColor: '#7f1d1d',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                        opacity: !hasPads ? 0.4 : 1,
                        cursor: !hasPads ? 'not-allowed' : 'pointer'
                    }}
                    onClick={() => clearDialogRef.current?.showModal()}
                    title={!hasPads ? 'No pads to clear' : 'Clear all pads'}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fca5a5"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>

                <div className="w-px h-6 bg-white/10" />

                {/* Play / Pause */}
                <button
                    className={`${btnBase} w-8 h-8`}
                    disabled={!hasPads && !isPlaying}
                    style={{
                        backgroundColor: TRANSPORT_COLOR.bg,
                        boxShadow: isPlaying
                            ? `0 0 12px ${TRANSPORT_COLOR.glow}40`
                            : `0 2px 4px rgba(0,0,0,0.3)`,
                        opacity: !hasPads && !isPlaying ? 0.4 : 1,
                        cursor:
                            !hasPads && !isPlaying ? 'not-allowed' : 'pointer'
                    }}
                    onClick={async () => {
                        const { play, stop } = await getAudioEngine();
                        if (isPlaying) stop();
                        else await play();
                    }}
                    title={
                        !hasPads && !isPlaying
                            ? 'Add pads to play'
                            : isPlaying
                              ? 'Pause'
                              : 'Play'
                    }
                >
                    {isPlaying ? (
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill={TRANSPORT_COLOR.glow}
                        >
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                    ) : (
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill={TRANSPORT_COLOR.glow}
                        >
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Clear confirmation dialog */}
            {mounted &&
                createPortal(
                    <dialog
                        ref={clearDialogRef}
                        className="backdrop:bg-black/60 bg-[#1a1625] text-white rounded-2xl border border-white/10 p-0 w-[380px] max-w-[90vw] shadow-2xl m-auto"
                        onClick={(e) => {
                            if (e.target === clearDialogRef.current)
                                clearDialogRef.current?.close();
                        }}
                    >
                        <div className="p-6 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h2
                                    className="text-lg font-bold tracking-wide"
                                    style={{ color: '#fca5a5' }}
                                >
                                    Clear Board
                                </h2>
                                <button
                                    onClick={() =>
                                        clearDialogRef.current?.close()
                                    }
                                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
                                >
                                    &times;
                                </button>
                            </div>

                            <p className="text-sm text-white/70">
                                This will remove all pads and their patterns.
                                You can undo this with the Undo button.
                            </p>

                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() =>
                                        clearDialogRef.current?.close()
                                    }
                                    className="px-4 py-2 rounded-lg font-medium text-sm cursor-pointer transition-colors bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        const { stop } = await getAudioEngine();
                                        stop();
                                        clearAllPads();
                                        clearDialogRef.current?.close();
                                    }}
                                    className="px-4 py-2 rounded-lg font-medium text-sm cursor-pointer transition-colors"
                                    style={{
                                        backgroundColor: '#7f1d1d',
                                        color: '#fca5a5',
                                        border: '1px solid rgba(252,165,165,0.25)'
                                    }}
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>
                    </dialog>,
                    document.body
                )}

            {/* Share dialog */}
            {mounted &&
                createPortal(
                    <dialog
                        ref={shareDialogRef}
                        className="backdrop:bg-black/60 bg-[#1a1625] text-white rounded-2xl border border-white/10 p-0 w-[380px] max-w-[90vw] shadow-2xl m-auto"
                        onClick={(e) => {
                            if (e.target === shareDialogRef.current)
                                shareDialogRef.current?.close();
                        }}
                    >
                        <div className="p-6 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <h2
                                    className="text-lg font-bold tracking-wide"
                                    style={{ color: TRANSPORT_COLOR.glow }}
                                >
                                    Share Soundboard
                                </h2>
                                <button
                                    onClick={() =>
                                        shareDialogRef.current?.close()
                                    }
                                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
                                >
                                    &times;
                                </button>
                            </div>

                            <div>
                                <label className="text-xs uppercase tracking-widest text-white/40 mb-1 block">
                                    Name
                                </label>
                                <input
                                    type="text"
                                    value={shareName}
                                    onChange={(e) =>
                                        setShareName(e.target.value)
                                    }
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                                    placeholder="My Beat"
                                />
                            </div>

                            {shareUrl ? (
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs uppercase tracking-widest text-white/40">
                                        Share Link
                                    </label>
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
                                                backgroundColor: copied
                                                    ? '#059669'
                                                    : TRANSPORT_COLOR.bg,
                                                color: TRANSPORT_COLOR.glow,
                                                border: `1px solid ${TRANSPORT_COLOR.glow}40`
                                            }}
                                        >
                                            {copied ? 'Copied!' : 'Copy'}
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
                                        border: `1px solid ${TRANSPORT_COLOR.glow}40`
                                    }}
                                >
                                    {isSaving ? 'Saving...' : 'Save & Get Link'}
                                </button>
                            )}
                        </div>
                    </dialog>,
                    document.body
                )}
        </>
    );
}
