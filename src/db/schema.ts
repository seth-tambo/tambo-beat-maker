import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import type { SoundboardData } from "./types";

export const soundboards = pgTable("soundboards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  data: jsonb("data").notNull().$type<SoundboardData>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
