import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import * as oidc from "openid-client";
import { clearSession, createSession, getOidcConfig, getSessionId, SESSION_COOKIE, SESSION_TTL, isAllowedAdmin, type SessionData } from "../lib/auth";

const router: IRouter = Router();
function getOrigin(req: Request): string {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0]!.trim();
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) throw new Error("Invalid host");
  return `https://${host}`;
}
function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
  return value;
}
function setCookie(res: Response, name: string, value: string, maxAge: number) {
  res.cookie(name, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge });
}
router.get("/auth/user", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetCurrentAuthUserResponse.parse({ user: req.isAuthenticated() ? req.user : null }));
});
router.get("/login", async (req, res): Promise<void> => {
  const config = await getOidcConfig();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: `${getOrigin(req)}/api/callback`, scope: "openid email profile offline_access",
    code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier), code_challenge_method: "S256",
    prompt: "login consent", state, nonce,
  });
  for (const [name, value] of Object.entries({ code_verifier: codeVerifier, nonce, state, return_to: getSafeReturnTo(req.query.returnTo) })) {
    setCookie(res, name, value, 10 * 60 * 1000);
  }
  res.redirect(redirectTo.href);
});
router.get("/callback", async (req, res): Promise<void> => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const codeVerifier = req.cookies?.code_verifier;
  const expectedState = req.cookies?.state;
  const nonce = req.cookies?.nonce;
  if (!codeVerifier || !expectedState || !nonce) { res.redirect("/api/login"); return; }
  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    const currentUrl = new URL(`${callbackUrl}?${new URL(req.url, "https://local.invalid").searchParams}`);
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier, expectedState, expectedNonce: nonce, idTokenExpected: true,
    });
  } catch {
    req.log.warn("Login callback validation failed");
    res.redirect("/?login_error=1"); return;
  }
  const returnTo = getSafeReturnTo(req.cookies?.return_to);
  for (const name of ["code_verifier", "nonce", "state", "return_to"]) res.clearCookie(name, { path: "/" });
  const claims = tokens.claims();
  if (!claims?.sub) { res.redirect("/?login_error=1"); return; }
  const user = {
    id: claims.sub, email: typeof claims.email === "string" ? claims.email : null,
    firstName: typeof claims.first_name === "string" ? claims.first_name : null,
    lastName: typeof claims.last_name === "string" ? claims.last_name : null,
    profileImageUrl: typeof claims.profile_image_url === "string" ? claims.profile_image_url : null,
  };
  const emailVerified = claims.email_verified !== false;
  // Only authorized accounts are persisted; signing in is not administrative authorization.
  if (emailVerified && isAllowedAdmin(user.email)) {
    await db.insert(usersTable).values(user).onConflictDoUpdate({ target: usersTable.id, set: { ...user, updatedAt: new Date() } });
  }
  const session: SessionData = {
    user, emailVerified, access_token: tokens.access_token, refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? Math.floor(Date.now() / 1000) + tokens.expiresIn()! : claims.exp,
  };
  setCookie(res, SESSION_COOKIE, await createSession(session), SESSION_TTL);
  res.redirect(returnTo);
});
router.get("/logout", async (req, res): Promise<void> => {
  await clearSession(res, getSessionId(req));
  const config = await getOidcConfig();
  res.redirect(oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: new URL(getSafeReturnTo(req.query.returnTo), `${getOrigin(req)}/`).href,
  }).href);
});
export default router;
