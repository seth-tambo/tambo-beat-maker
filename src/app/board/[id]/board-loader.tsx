"use client";

import { useEffect, useRef } from "react";
import { BeatCanvas } from "@/components/beat-maker/BeatCanvas";
import { ChatSidebar } from "@/components/beat-maker/ChatSidebar";
import { components, tools, contextHelpers } from "@/lib/tambo";
import { useAnonymousUserKey } from "@/lib/use-anonymous-user-key";
import { hydrateFromSoundboard } from "@/lib/canvas-store";
import { TamboProvider } from "@tambo-ai/react";
import type { SoundboardData } from "@/db/types";

interface BoardLoaderProps {
  soundboard: {
    id: string;
    name: string;
    data: SoundboardData;
  };
}

export function BoardLoader({ soundboard }: BoardLoaderProps) {
  const userKey = useAnonymousUserKey();
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrateFromSoundboard(soundboard.data);
      hydrated.current = true;
    }
  }, [soundboard.data]);

  return (
    <TamboProvider
      apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
      components={components}
      tools={tools}
      contextHelpers={contextHelpers}
      tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
      userKey={userKey}
    >
      <div className="beat-canvas dark h-dvh overflow-hidden bg-[#0c0a14] select-none font-mono">
        <BeatCanvas />
        <ChatSidebar />
      </div>
    </TamboProvider>
  );
}
