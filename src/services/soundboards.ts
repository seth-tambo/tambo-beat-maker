/**
 * Tool functions for AI to save, load, and list soundboards.
 * These run client-side and call the API routes via fetch.
 */

import { getSerializableState, hydrateFromSoundboard } from "@/lib/canvas-store";

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = await res.json();
    if (payload && typeof payload === "object" && "error" in payload) {
      const error = (payload as { error?: unknown }).error;
      if (typeof error === "string" && error.trim().length > 0) {
        return error;
      }
    }
  } catch {
    // Ignore JSON parse failures and use fallback below.
  }
  return fallback;
}

export async function saveSoundboard(input: { name: string }) {
  const data = getSerializableState();

  const res = await fetch("/api/soundboards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.name, data }),
  });

  if (!res.ok) {
    const error = await extractErrorMessage(res, "Failed to save soundboard");
    return { id: "", name: input.name, shareUrl: "", error };
  }

  const { id, name } = await res.json();
  const shareUrl = `${window.location.origin}/board/${id}`;

  return { id, name, shareUrl };
}

export async function loadSoundboard(input: { id: string }) {
  const res = await fetch(`/api/soundboards/${input.id}`);

  if (!res.ok) {
    const fallback = res.status === 404 ? "Soundboard not found" : "Failed to load soundboard";
    const error = await extractErrorMessage(res, fallback);
    return { success: false, error };
  }

  const soundboard = await res.json();
  hydrateFromSoundboard(soundboard.data);

  return { success: true, name: soundboard.name };
}

export async function listSoundboards() {
  const res = await fetch("/api/soundboards");

  if (!res.ok) {
    const error = await extractErrorMessage(res, "Failed to list soundboards");
    console.error(error);
    return [];
  }

  return res.json();
}
