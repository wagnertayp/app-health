import { pgTable, uuid, text, jsonb, timestamp, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const healthfyEntities = pgTable("healthfy_entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequence: serial("sequence").notNull().unique(),
  kind: text("kind").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("healthfy_entities_kind_idx").on(table.kind)]);

export const insertHealthfyEntitySchema = createInsertSchema(healthfyEntities).omit({
  id: true, sequence: true, createdAt: true, updatedAt: true,
});
export type InsertHealthfyEntity = z.infer<typeof insertHealthfyEntitySchema>;
export type HealthfyEntity = typeof healthfyEntities.$inferSelect;
