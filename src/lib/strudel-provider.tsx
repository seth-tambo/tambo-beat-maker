/**
 * React context wrapping the StrudelService singleton.
 *
 * Follows the StrudelLM guide pattern: the singleton holds the audio engine
 * and state; this provider subscribes to state changes and re-renders
 * consumers reactively via useStrudel().
 *
 * This sits alongside canvas-store (which owns pad/note/BPM state).
 * StrudelProvider owns audio-engine-specific state: isReady, isPlaying, error.
 */
"use client";

import * as React from "react";
import { StrudelService, type StrudelEngineState } from "./audio-engine";

type StrudelContextValue = {
  isPlaying: boolean;
  isReady: boolean;
  error: string | null;
  play: () => Promise<boolean>;
  stop: () => void;
};

const StrudelContext = React.createContext<StrudelContextValue | null>(null);

const strudelService = StrudelService.instance();

export function StrudelProvider({ children }: { children: React.ReactNode }) {
  const [engineState, setEngineState] = React.useState<StrudelEngineState>(
    () => strudelService.getEngineState(),
  );

  React.useEffect(() => {
    const unsubscribe = strudelService.onStateChange((newState) => {
      setEngineState(newState);
    });

    // Preload Strudel on mount so initAudioOnFirstClick's mousedown listener
    // is registered before the user clicks play.
    if (!strudelService.isReady) {
      strudelService.preload();
    }

    return unsubscribe;
  }, []);

  const value = React.useMemo<StrudelContextValue>(
    () => ({
      isPlaying: engineState.isPlaying,
      isReady: engineState.isReady,
      error: engineState.error,
      play: () => strudelService.play(),
      stop: () => strudelService.stop(),
    }),
    [engineState],
  );

  return (
    <StrudelContext.Provider value={value}>{children}</StrudelContext.Provider>
  );
}

export function useStrudel(): StrudelContextValue {
  const context = React.useContext(StrudelContext);
  if (!context) {
    throw new Error("useStrudel must be used within a StrudelProvider");
  }
  return context;
}
