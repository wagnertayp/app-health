import crypto from "node:crypto";
import type { AuthUser } from "@workspace/api-zod";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import * as client from "openid-client";

export const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";
export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const AUTH_DRIVER = process.env.AUTH_DRIVER ?? "replit";
if (AUTH_DRIVER !== "replit" && AUTH_DRIVER !== "local") throw new Error("AUTH_DRIVER deve ser 'replit' ou 'local'.");
export const isLocalAuth = () => AUTH_DRIVER === "local";

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = encoded.split("$");
  if (scheme !== "scrypt" || !/^[0-9a-f]{32}$/i.test(saltHex || "") || !/^[0-9a-f]{128}$/i.test(keyHex || "")) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await derivePassword(password, Buffer.from(saltHex, "hex"));
  return crypto.timingSafeEqual(actual, expected);
}

export interface SessionData {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  emailVerified?: boolean;
}
let oidcConfig: client.Configuration | null = null;
export async function getOidcConfig(): Promise<client.Configuration> {
  if (!oidcConfig) oidcConfig = await client.discovery(new URL(ISSUER_URL), process.env.REPL_ID!);
  return oidcConfig;
}
export function isAllowedAdmin(email: string | null | undefined) {
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.trim().toLowerCase());
}
export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({ sid, sess: data as unknown as Record<string, unknown>, expire: new Date(Date.now() + SESSION_TTL) });
  return sid;
}
export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid));
  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }
  return row.sess as unknown as SessionData;
}
export async function updateSession(sid: string, data: SessionData): Promise<void> {
  await db.update(sessionsTable).set({ sess: data as unknown as Record<string, unknown>, expire: new Date(Date.now() + SESSION_TTL) }).where(eq(sessionsTable.sid, sid));
}
export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}
export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return req.cookies?.[SESSION_COOKIE];
}
