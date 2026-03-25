'use client';

import { useCallback, useState } from 'react';
import { useTamboThreadInput } from '@tambo-ai/react';
import { checkChatTrigger, triggerMoreCowbell } from '@/lib/easter-eggs';
import { useDemoMode } from '@/lib/use-demo-mode';
import {
    MessageInput,
    MessageInputSubmitButton,
    MessageInputTextarea,
    MessageInputToolbar
} from '@/components/tambo/message-input';
import {
    MessageSuggestions,
    MessageSuggestionsList,
    MessageSuggestionsStatus
} from '@/components/tambo/message-suggestions';
import { ScrollableMessageContainer } from '@/components/tambo/scrollable-message-container';
import {
    ThreadContent,
    ThreadContentMessages
} from '@/components/tambo/thread-content';
import type { Suggestion } from '@tambo-ai/react';

// Pool of initial suggestions covering pads, genres, synths, and effects.
// Three are picked at random on each mount so the experience feels fresh.
const allInitialSuggestions: Suggestion[] = [
    // --- Pad basics ---
    {
        id: 'init-kick',
        title: 'Add a Kick pad',
        detailedSuggestion: 'Add a Kick pad to the canvas',
        messageId: ''
    },
    {
        id: 'init-combo',
        title: 'Kick + Snare + Hi-Hat',
        detailedSuggestion:
            'Add a Kick, Snare, and Hi-Hat pad to the canvas and play them',
        messageId: ''
    },
    // --- Preset patterns ---
    {
        id: 'init-trap',
        title: 'Load a Trap beat',
        detailedSuggestion: 'Load a trap drum pattern and play it',
        messageId: ''
    },
    {
        id: 'init-four',
        title: 'Four on the floor',
        detailedSuggestion: 'Load a four-on-the-floor house beat and play it',
        messageId: ''
    },
    {
        id: 'init-funk',
        title: 'Funky breakbeat',
        detailedSuggestion: 'Load a funky breakbeat pattern and play it',
        messageId: ''
    },
    // --- Genre compositions (evaluatePattern) ---
    {
        id: 'init-lofi',
        title: 'Lo-fi hip hop vibes',
        detailedSuggestion:
            'Make a lo-fi hip hop beat with jazzy piano chords, warm drums, and reverb',
        messageId: ''
    },
    {
        id: 'init-synthwave',
        title: '80s synthwave',
        detailedSuggestion:
            'Play a synthwave arpeggio with filter sweep, reverb, and a driving beat',
        messageId: ''
    },
    {
        id: 'init-techno',
        title: 'Minimal techno groove',
        detailedSuggestion:
            'Create a dark minimal techno groove with a pulsing bass and modulated filter',
        messageId: ''
    },
    {
        id: 'init-ambient',
        title: 'Ambient soundscape',
        detailedSuggestion:
            'Play a dreamy ambient pad with slow filter movement and lots of reverb',
        messageId: ''
    },
    {
        id: 'init-dnb',
        title: 'Drum & bass roller',
        detailedSuggestion:
            'Make a drum and bass beat with a rolling bassline and fast breakbeat drums',
        messageId: ''
    },
    // --- Sound exploration ---
    {
        id: 'init-sounds',
        title: 'What sounds do you have?',
        detailedSuggestion: 'What instruments and sounds are available?',
        messageId: ''
    },
    {
        id: 'init-piano',
        title: 'Piano chords',
        detailedSuggestion: 'Play a mellow piano chord progression',
        messageId: ''
    }
];

function pickRandom<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

const initialSuggestions: Suggestion[] = pickRandom(allInitialSuggestions, 3);

export function ChatSidebar() {
    const [chatMinimized, setChatMinimized] = useState(false);
    const [hasMessages, setHasMessages] = useState(false);
    const [cowbellOverlay, setCowbellOverlay] = useState(false);
    const { value } = useTamboThreadInput();
    const { demoMode, demoSubmit } = useDemoMode();

    const handleSubmitCapture = useCallback(
        (e: React.FormEvent) => {
            // Easter egg check
            const trigger = checkChatTrigger(value);
            if (trigger === 'cowbell') {
                void triggerMoreCowbell();
                setCowbellOverlay(true);
                setTimeout(() => setCowbellOverlay(false), 4000);
            }

            // Demo mode: synchronously check for a match and block the real submit
            if (demoMode) {
                e.preventDefault();
                e.stopPropagation();
                void demoSubmit();
            }
        },
        [value, demoMode, demoSubmit]
    );

    return (
        <div
            className="fixed right-6 z-50 w-[min(400px,36vw)] min-w-[300px] flex flex-col rounded-xl border border-white/[0.08] bg-[#0d1512]/95 backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden"
            style={{
                boxShadow:
                    '0 8px 24px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)',
                bottom: 24,
                height: chatMinimized ? 44 : 'calc(100dvh - 48px)'
            }}
        >
            {/* Header */}
            <div
                className="shrink-0 flex items-center gap-3 px-4 cursor-pointer select-none hover:bg-white/[0.03] transition-colors"
                style={{ height: 44 }}
                onClick={() => setChatMinimized((v) => !v)}
            >
                <div className="w-2 h-2 rounded-full bg-emerald-400/80" />
                <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300/90">
                        Tambo
                    </span>
                    {!chatMinimized && (
                        <span className="text-xs text-white/40 ml-2">
                            Beat Pad Generator
                        </span>
                    )}
                </div>
                <span
                    className="text-white/30 hover:text-white/60 transition-all duration-300 text-[10px]"
                    style={{
                        transform: chatMinimized
                            ? 'rotate(180deg)'
                            : 'rotate(0deg)'
                    }}
                >
                    &#9660;
                </span>
            </div>

            {/* Collapsible body */}
            {!chatMinimized && (
                <>
                    <div className="border-t border-white/[0.06]" />

                    {/* Messages */}
                    <ScrollableMessageContainer className="flex-1 px-3 py-2 min-h-0 chat-scroll">
                        <ThreadContent variant="default">
                            <ThreadContentMessages
                                onMessageCountChange={(count) =>
                                    setHasMessages(count > 0)
                                }
                            />
                        </ThreadContent>
                    </ScrollableMessageContainer>

                    {/* Suggestions + Input */}
                    <div className="shrink-0 px-3 pb-3 pt-2">
                        {!hasMessages && (
                            <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                                <p className="text-[11px] uppercase tracking-widest text-emerald-300/90">
                                    New chat
                                </p>
                                <p className="mt-1 text-xs text-white/70">
                                    Start by adding pads, loading a pattern, or
                                    asking me to tweak BPM.
                                </p>
                            </div>
                        )}
                        <MessageSuggestions
                            maxSuggestions={3}
                            initialSuggestions={initialSuggestions}
                            className="px-0 pb-1"
                        >
                            {!demoMode && <MessageSuggestionsStatus />}
                            <MessageSuggestionsList />
                        </MessageSuggestions>
                        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                        <div onSubmitCapture={handleSubmitCapture}>
                            <MessageInput className="beat-chat-input">
                                <MessageInputTextarea placeholder="Add a pad, remove one, or ask about your beat..." />
                                <MessageInputToolbar>
                                    <MessageInputSubmitButton />
                                </MessageInputToolbar>
                            </MessageInput>
                        </div>
                    </div>

                    {/* More Cowbell overlay */}
                    {cowbellOverlay && (
                        <div className="absolute inset-x-0 top-12 flex items-center justify-center pointer-events-none z-50 px-4">
                            <div
                                className="rounded-lg px-4 py-3 text-center cowbell-overlay"
                                style={{
                                    background: 'rgba(180, 83, 9, 0.25)',
                                    border: '1px solid rgba(245, 158, 11, 0.4)'
                                }}
                            >
                                <p className="text-amber-300 text-sm font-bold tracking-wide">
                                    I got a fever...
                                </p>
                                <p className="text-amber-200/90 text-xs mt-1">
                                    and the only prescription is{' '}
                                    <span className="text-amber-300 font-black uppercase">
                                        more cowbell!
                                    </span>
                                </p>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
