/**
 * Tool functions for AI to save, load, and list soundboards.
 * These run client-side and call the API routes via fetch.
 */

import { getSerializableState, hydrateFromSoundboard } from "@/lib/canvas-store";

export async function saveSoundboard(input: { name: string }) {
  const data = getSerializableState();

  const res = await fetch("/api/soundboards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.name, data }),
  });

  if (!res.ok) {
    return { id: "", name: input.name, shareUrl: "", error: "Failed to save soundboard" };
  }

  const { id, name } = await res.json();
  const shareUrl = `${window.location.origin}/board/${id}`;

  return { id, name, shareUrl };
}

export async function loadSoundboard(input: { id: string }) {
  const res = await fetch(`/api/soundboards/${input.id}`);

  if (!res.ok) {
    return { success: false, error: "Soundboard not found" };
  }

  const soundboard = await res.json();
  hydrateFromSoundboard(soundboard.data);

  return { success: true, name: soundboard.name };
}

export async function listSoundboards() {
  const res = await fetch("/api/soundboards");

  if (!res.ok) {
    return [];
  }

  return res.json();
}
