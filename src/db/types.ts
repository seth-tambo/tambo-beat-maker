import { z } from "zod";

const padColorSchema = z.object({
  bg: z.string(),
  glow: z.string(),
  label: z.string(),
});

export const soundboardPadSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  color: padColorSchema,
  size: z.number(),
  notes: z.array(z.string()),
  muted: z.boolean().optional(),
  bank: z.string().optional(),
});

export const soundboardDataSchema = z.object({
  pads: z.array(soundboardPadSchema),
  bpm: z.number().min(30).max(300),
});

export type SoundboardData = z.infer<typeof soundboardDataSchema>;
export type SoundboardPadData = z.infer<typeof soundboardPadSchema>;
