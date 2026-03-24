"use client";

import { useEffect, useMemo, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { getSerializableState, subscribe } from "@/lib/canvas-store";

interface UseSoundboardAutosaveOptions {
  soundboardId: string;
  delayMs?: number;
}

const DEFAULT_DELAY_MS = 1200;

export function useSoundboardAutosave({
  soundboardId,
  delayMs = DEFAULT_DELAY_MS,
}: UseSoundboardAutosaveOptions) {
  const hasHydratedRef = useRef(false);
  const lastSerializedRef = useRef<string>("");

  useEffect(() => {
    hasHydratedRef.current = false;
    lastSerializedRef.current = "";
  }, [soundboardId]);

  const saveDebounced = useDebouncedCallback((serialized: string) => {
    void fetch(`/api/soundboards/${soundboardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: JSON.parse(serialized) }),
    }).then((response) => {
      if (!response.ok) {
        console.error(
          "Soundboard autosave failed:",
          response.status,
          response.statusText,
        );
      }
    }).catch((error: unknown) => {
      console.error("Soundboard autosave request failed:", error);
    });
  }, delayMs);

  const saveNow = useMemo(
    () => () => {
      const next = getSerializableState();
      const serialized = JSON.stringify(next);

      if (!hasHydratedRef.current) {
        hasHydratedRef.current = true;
        lastSerializedRef.current = serialized;
        return;
      }

      if (serialized === lastSerializedRef.current) {
        return;
      }

      lastSerializedRef.current = serialized;
      saveDebounced(serialized);
    },
    [saveDebounced],
  );

  useEffect(() => {
    const unsubscribe = subscribe(saveNow);
    return () => {
      unsubscribe();
      saveDebounced.cancel();
    };
  }, [saveDebounced, saveNow]);
}
