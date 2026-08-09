import type { Context, Hono, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Role, SessionPayload } from "../shared/types";

export const COOKIE = "dc_session";
export const THIRTY_DAYS = 60 * 60 * 24 * 30;
const enc = new TextEncoder();

export type AppEnv = { Bindings: Env; Variables: { session: SessionPayload } };

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

async function hmac(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await hmac(body, secret))}`;
}

export async function verifySession(
  token: string | undefined,
  secret: string
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let given: Uint8Array;
  try {
    given = b64urlDecode(sig);
  } catch {
    return null;
  }
  const expected = await hmac(body, secret);
  if (given.byteLength !== expected.byteLength) return null;
  if (!crypto.subtle.timingSafeEqual(given.buffer as ArrayBuffer, expected.buffer as ArrayBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    if (payload.role !== "guest" && payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

export async function phraseEquals(input: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(input)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export async function signMediaToken(key: string, exp: number, secret: string): Promise<string> {
  return b64url(await hmac(`media:${key}:${exp}`, secret));
}

export async function verifyMediaToken(
  token: string,
  key: string,
  exp: number,
  secret: string
): Promise<boolean> {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = await signMediaToken(key, exp, secret);
  const a = enc.encode(token);
  const b = enc.encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a.buffer as ArrayBuffer, b.buffer as ArrayBuffer);
}

const attempts = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(ip: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > windowMs) {
    attempts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function requireSession(role?: "admin") {
  return async (c: Context<AppEnv>, next: Next) => {
    const session = await verifySession(getCookie(c, COOKIE), c.env.SESSION_SECRET);
    if (!session) return c.json({ error: "unauthorized" }, 401);
    if (role === "admin" && session.role !== "admin") return c.json({ error: "forbidden" }, 403);
    c.set("session", session);
    await next();
  };
}

export function registerAuthRoutes(app: Hono<AppEnv>) {
  app.post("/api/auth/login", async (c) => {
    const ip = c.req.header("cf-connecting-ip") ?? "local";
    if (!checkRateLimit(ip)) return c.json({ error: "too many attempts" }, 429);
    let phrase: unknown;
    try {
      ({ phrase } = await c.req.json<{ phrase?: unknown }>());
    } catch {
      return c.json({ error: "incorrect passphrase" }, 401);
    }
    if (typeof phrase !== "string" || phrase.length === 0 || phrase.length > 256) {
      return c.json({ error: "incorrect passphrase" }, 401);
    }
    let role: Role | null = null;
    if (await phraseEquals(phrase, c.env.ADMIN_PASSPHRASE)) role = "admin";
    else if (await phraseEquals(phrase, c.env.GUEST_PASSPHRASE)) role = "guest";
    if (!role) return c.json({ error: "incorrect passphrase" }, 401);
    const exp = Math.floor(Date.now() / 1000) + THIRTY_DAYS;
    setCookie(c, COOKIE, await signSession({ role, exp }, c.env.SESSION_SECRET), {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: THIRTY_DAYS,
    });
    return c.json({ role });
  });

  app.post("/api/auth/logout", (c) => {
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/api/auth/me", requireSession(), (c) => c.json({ role: c.get("session").role }));
}
