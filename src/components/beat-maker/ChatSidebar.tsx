"use client";

import { useState } from "react";
import {
  MessageInput,
  MessageInputSubmitButton,
  MessageInputTextarea,
  MessageInputToolbar,
} from "@/components/tambo/message-input";
import {
  MessageSuggestions,
  MessageSuggestionsList,
  MessageSuggestionsStatus,
} from "@/components/tambo/message-suggestions";
import { ScrollableMessageContainer } from "@/components/tambo/scrollable-message-container";
import {
  ThreadContent,
  ThreadContentMessages,
} from "@/components/tambo/thread-content";
import type { Suggestion } from "@tambo-ai/react";

const initialSuggestions: Suggestion[] = [
  {
    id: "init-kick",
    title: "Add a Kick pad",
    detailedSuggestion: "Add a Kick pad to the canvas",
    messageId: "",
  },
  {
    id: "init-trap",
    title: "Load a Trap beat",
    detailedSuggestion: "Load a trap drum pattern and play it",
    messageId: "",
  },
  {
    id: "init-combo",
    title: "Add Snare + Hi-Hat",
    detailedSuggestion: "Add a Snare pad and a Hi-Hat pad to the canvas",
    messageId: "",
  },
];

export function ChatSidebar() {
  const [chatMinimized, setChatMinimized] = useState(false);
  const [hasMessages, setHasMessages] = useState(false);

  return (
    <div
      className="fixed right-6 z-50 w-[min(400px,36vw)] min-w-[300px] flex flex-col rounded-xl border border-white/[0.08] bg-[#0d1512]/95 backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)",
        bottom: 24,
        height: chatMinimized ? 44 : "calc(100dvh - 48px)",
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
            <span className="text-xs text-white/40 ml-2">Beat Pad Generator</span>
          )}
        </div>
        <span
          className="text-white/30 hover:text-white/60 transition-all duration-300 text-[10px]"
          style={{
            transform: chatMinimized ? "rotate(180deg)" : "rotate(0deg)",
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
                onMessageCountChange={(count) => setHasMessages(count > 0)}
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
                  Start by adding pads, loading a pattern, or asking me to tweak BPM.
                </p>
              </div>
            )}
            <MessageSuggestions
              maxSuggestions={3}
              initialSuggestions={initialSuggestions}
              className="px-0 pb-1"
            >
              <MessageSuggestionsStatus />
              <MessageSuggestionsList />
            </MessageSuggestions>
            <MessageInput className="beat-chat-input">
              <MessageInputTextarea placeholder="Add a pad, remove one, or ask about your beat..." />
              <MessageInputToolbar>
                <MessageInputSubmitButton />
              </MessageInputToolbar>
            </MessageInput>
          </div>
        </>
      )}
    </div>
  );
}
