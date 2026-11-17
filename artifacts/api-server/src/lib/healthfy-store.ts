import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, healthfyEntities } from "@workspace/db";

export type Entity = Record<string, unknown> & { id: string; createdAt: string };
type Executor = Pick<typeof db, "select" | "insert" | "update" | "delete">;
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function list<T>(kind: string, executor: Executor = db): Promise<T[]> {
  const rows = await executor.select().from(healthfyEntities)
    .where(eq(healthfyEntities.kind, kind)).orderBy(desc(healthfyEntities.sequence));
  return rows.map(row => row.data as T);
}

export async function find<T>(kind: string, id: unknown, executor: Executor = db): Promise<T | undefined> {
  if (!isUuid(id)) return undefined;
  const [row] = await executor.select().from(healthfyEntities)
    .where(and(eq(healthfyEntities.kind, kind), eq(healthfyEntities.id, id)));
  return row?.data as T | undefined;
}

export async function insert(kind: string, data: Record<string, unknown>, executor: Executor = db) {
  const id = randomUUID();
  const entity = { ...data, id, createdAt: new Date().toISOString() };
  const [row] = await executor.insert(healthfyEntities).values({ id, kind, data: entity }).returning();
  return { entity, sequence: row!.sequence };
}

export async function replace(kind: string, id: string, data: Record<string, unknown>, executor: Executor = db) {
  const [row] = await executor.update(healthfyEntities).set({ data, updatedAt: new Date() })
    .where(and(eq(healthfyEntities.kind, kind), eq(healthfyEntities.id, id))).returning();
  return row?.data;
}

export async function remove(kind: string, id: string, executor: Executor = db) {
  const [row] = await executor.delete(healthfyEntities)
    .where(and(eq(healthfyEntities.kind, kind), eq(healthfyEntities.id, id))).returning();
  return row;
}

export async function activity(title: string, description: string, entityType: string, entityId: string, executor: Executor = db) {
  await insert("activity", { title, description, entityType, entityId }, executor);
}

export const money = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
