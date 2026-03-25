'use client';

import { useEffect, useRef } from 'react';
import { BeatCanvas } from '@/components/beat-maker/BeatCanvas';
import { ChatSidebar } from '@/components/beat-maker/ChatSidebar';
import { TransportBar } from '@/components/beat-maker/TransportBar';
import { useAnonymousUserKey } from '@/lib/use-anonymous-user-key';
import { useLazyTamboConfig } from '@/lib/use-lazy-tambo-config';
import { hydrateFromSoundboard } from '@/lib/canvas-store';
import { useSoundboardAutosave } from '@/lib/use-soundboard-autosave';
import { StrudelProvider } from '@/lib/strudel-provider';
import { TamboProvider } from '@tambo-ai/react';
import type { SoundboardData } from '@/db/types';

interface BoardLoaderProps {
    soundboard: {
        id: string;
        name: string;
        data: SoundboardData;
    };
}

export function BoardLoader({ soundboard }: BoardLoaderProps) {
    const userKey = useAnonymousUserKey();
    const tamboConfig = useLazyTamboConfig({ includeContextHelpers: true });
    const lastHydratedId = useRef<string | null>(null);

    useSoundboardAutosave({
        soundboardId: soundboard.id
    });

    useEffect(() => {
        if (lastHydratedId.current !== soundboard.id) {
            hydrateFromSoundboard(soundboard.data);
            lastHydratedId.current = soundboard.id;
        }
    }, [soundboard.id, soundboard.data]);

    if (!tamboConfig) return null;

    return (
        <StrudelProvider>
            <TamboProvider
                apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
                components={tamboConfig.components}
                tools={tamboConfig.tools}
                contextHelpers={tamboConfig.contextHelpers}
                tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
                userKey={userKey}
            >
                <div className="beat-canvas dark h-dvh overflow-hidden bg-[#111111] select-none font-mono">
                    <TransportBar />
                    <BeatCanvas />
                    <ChatSidebar />
                </div>
            </TamboProvider>
        </StrudelProvider>
    );
}
