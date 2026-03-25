/**
 * Demo mode hook.
 *
 * When `NEXT_PUBLIC_DEMO_MODE=true` or `?demo=1` is in the URL,
 * this hook provides an intercepted submit function that runs
 * scripted tool calls and injects messages into the Tambo thread
 * via the stream dispatch, bypassing the real API.
 */

"use client";

import { useCallback, useMemo, useRef } from "react";
import { useTambo, useTamboThreadInput } from "@tambo-ai/react";
import type { TamboThreadMessage } from "@tambo-ai/react";
import { findDemoEntry } from "./demo-script";

function isDemoEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search).has("demo");
  }
  return false;
}

let msgCounter = 0;
function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${++msgCounter}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns `{ demoMode, demoSubmit }`.
 *
 * - `demoMode` -- whether demo mode is active
 * - `demoSubmit` -- call this instead of the normal submit. It returns
 *   `true` if a demo script matched (caller should skip real submit)
 *   or `false` if no match (caller should fall through to real submit).
 */
export function useDemoMode() {
  const demoMode = useMemo(isDemoEnabled, []);
  const { dispatch, currentThreadId, messages } = useTambo();
  const { value, setValue } = useTamboThreadInput();
  const runningRef = useRef(false);
  // Keep a mutable ref to messages so the async callback always reads current state
  const messagesRef = useRef<TamboThreadMessage[]>(messages);
  messagesRef.current = messages;

  const demoSubmit = useCallback(async (): Promise<boolean> => {
    if (!demoMode) return false;

    const entry = findDemoEntry(value);
    if (!entry) return false;

    if (runningRef.current) return true;
    runningRef.current = true;

    const userText = value;
    setValue("");

    const userMsg: TamboThreadMessage = {
      id: nextId("demo-user"),
      role: "user",
      content: [{ type: "text", text: userText }],
      createdAt: new Date().toISOString(),
    };

    // Inject user message immediately
    dispatch({
      type: "LOAD_THREAD_MESSAGES",
      threadId: currentThreadId,
      messages: [...messagesRef.current, userMsg],
    });

    // Run steps sequentially with delays
    for (const step of entry.steps) {
      await sleep(step.delay);
      try {
        await step.action();
      } catch (err) {
        console.error(`[demo] step failed:`, err);
      }
    }

    // Small pause before showing the reply
    await sleep(300);

    const assistantMsg: TamboThreadMessage = {
      id: nextId("demo-assistant"),
      role: "assistant",
      content: [{ type: "text", text: entry.assistantMessage }],
      createdAt: new Date().toISOString(),
    };

    // Inject assistant message (append to whatever messages exist now)
    dispatch({
      type: "LOAD_THREAD_MESSAGES",
      threadId: currentThreadId,
      messages: [...messagesRef.current, assistantMsg],
    });

    runningRef.current = false;
    return true;
  }, [demoMode, value, setValue, dispatch, currentThreadId]);

  return { demoMode, demoSubmit };
}
