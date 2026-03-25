'use client';

import { useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
    getSerializableState,
    hydrateFromSoundboard,
    subscribe
} from '@/lib/canvas-store';
import { soundboardDataSchema } from '@/db/types';

const STORAGE_KEY = 'tambo-beat-maker:canvas';
const SAVE_DELAY_MS = 800;

/**
 * Persists canvas state to localStorage and restores it on mount.
 * Only used on the main `/` route — the board route uses DB autosave instead.
 */
export function useLocalAutosave() {
    const hasHydratedRef = useRef(false);
    const lastSerializedRef = useRef<string>('');

    // Restore from localStorage on mount, before any user interaction.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as unknown;
                const result = soundboardDataSchema.safeParse(parsed);
                if (result.success) {
                    hydrateFromSoundboard(result.data);
                }
            }
        } catch {
            // Ignore malformed or missing data.
        }
        hasHydratedRef.current = true;
        lastSerializedRef.current = JSON.stringify(getSerializableState());
    }, []);

    const saveDebounced = useDebouncedCallback((serialized: string) => {
        try {
            localStorage.setItem(STORAGE_KEY, serialized);
        } catch {
            // Ignore quota errors silently.
        }
    }, SAVE_DELAY_MS);

    useEffect(() => {
        const unsubscribe = subscribe(() => {
            if (!hasHydratedRef.current) return;
            const serialized = JSON.stringify(getSerializableState());
            if (serialized === lastSerializedRef.current) return;
            lastSerializedRef.current = serialized;
            saveDebounced(serialized);
        });
        return () => {
            unsubscribe();
            saveDebounced.cancel();
        };
    }, [saveDebounced]);
}
