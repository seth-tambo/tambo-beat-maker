"use client";

import { BeatCanvas } from "@/components/beat-maker/BeatCanvas";
import { ChatSidebar } from "@/components/beat-maker/ChatSidebar";
import { components, tools, contextHelpers } from "@/lib/tambo";
import { useAnonymousUserKey } from "@/lib/use-anonymous-user-key";
import { StrudelProvider } from "@/lib/strudel-provider";
import { TamboProvider } from "@tambo-ai/react";

export default function Home() {
  const userKey = useAnonymousUserKey();

  return (
    <StrudelProvider>
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
    </StrudelProvider>
  );
}
