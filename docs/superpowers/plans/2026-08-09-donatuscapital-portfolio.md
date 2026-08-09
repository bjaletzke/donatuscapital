# Donatus Capital Site + Hidden Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild donatuscapital.com as one app: the existing front page (refreshed) plus a passphrase-gated photo/video portfolio at `/investor`, backed by private R2 storage, with multi-size/format downloads and an in-app admin upload UI.

**Architecture:** Single Cloudflare Worker (Hono) serving a Vite React SPA. All portfolio bytes stream through the auth-checked Worker from a private R2 bucket; metadata lives in JSON manifests in R2. Image variants come from Cloudflare Image Transformations at the edge, with a plain-original fallback when transformations aren't available (local dev, workers.dev).

**Tech Stack:** Vite 6 + React 19 + TypeScript, Hono 4, Cloudflare Workers (`@cloudflare/vite-plugin`), Tailwind CSS v4, shadcn CLI + Base UI blocks from the 7ovr registry, React Router 7 (library mode), Vitest + `@cloudflare/vitest-pool-workers`.

**Spec:** `docs/superpowers/specs/2026-08-09-donatuscapital-portfolio-design.md`

## Global Constraints

- Working directory / repo root: `/Users/bfj/Documents/BFJ POrtfolio` (repo `bjaletzke/donatuscapital`, public — NO secrets in any commit, ever).
- Old site (asset + copy source): `/Users/bfj/Documents/DonatusCapital/donatuscapital-site` — read-only except recovering images via `git show HEAD:<path>`.
- Secrets: `SESSION_SECRET`, `GUEST_PASSPHRASE`, `ADMIN_PASSPHRASE`. Local: `.dev.vars` (gitignored). Prod: `wrangler secret put`.
- Cookie name: `dc_session`. HTTP-only, Secure, SameSite=Lax, Path=/, 30-day expiry.
- R2 bucket name: `donatus-portfolio`, binding name `BUCKET`. Object keys: `projects/index.json`, `projects/<slug>/manifest.json`, media at `<slug>/<mediaId>.<ext>`.
- Reserved slugs (reject on create): `projects`, `api`, `media`, `investor`, `admin`. Slug regex: `^[a-z0-9][a-z0-9-]{1,62}$`.
- Login errors are always the same generic message regardless of which phrase tier failed.
- Download sizes: `web` = 1200px, `large` = 2560px, `original` = passthrough. Formats: `jpeg`, `webp`, `avif` (original = as uploaded).
- Front page copy and imagery are preserved verbatim (including the footer line "Don't contact us."), palette `#F5F5F3` / `#181b19`.
- Worker must set `run_worker_first: ["/api/*"]` in the assets config — otherwise `<a href>` downloads (navigation requests) get index.html instead of the API.
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: App scaffold (Vite + React + Hono Worker + Tailwind v4)

**Files:**
- Create: `package.json`, `vite.config.ts`, `wrangler.json`, `index.html`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.worker.json`, `.dev.vars`, `.githooks/pre-commit`
- Create: `src/react-app/main.tsx`, `src/react-app/index.css`, `src/react-app/App.tsx`
- Create: `src/worker/index.ts`

**Interfaces:**
- Produces: dev server (`npm run dev`), build (`npm run build`), `/api/health` → `{ ok: true }`, Tailwind v4 active, `Env` types via `npm run cf-typegen`.

- [ ] **Step 1: Write config files**

`package.json`:

```json
{
  "name": "donatuscapital",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b && vite build",
    "cf-typegen": "wrangler types",
    "check": "tsc -b && vite build && wrangler deploy --dry-run",
    "deploy": "npm run build && wrangler deploy",
    "dev": "vite",
    "lint": "eslint .",
    "test": "vitest run",
    "preview": "npm run build && vite preview"
  },
  "dependencies": {
    "hono": "^4.11.1",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "react-router": "^7.1.0"
  },
  "devDependencies": {
    "@cloudflare/vite-plugin": "^1.15.3",
    "@cloudflare/vitest-pool-workers": "^0.8.0",
    "@tailwindcss/vite": "^4.1.0",
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "tailwindcss": "^4.1.0",
    "typescript": "~5.8.3",
    "vite": "^6.0.0",
    "vitest": "~3.2.0",
    "wrangler": "^4.56.0"
  }
}
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), cloudflare(), tailwindcss()],
});
```

`wrangler.json`:

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "donatuscapital",
  "main": "./src/worker/index.ts",
  "compatibility_date": "2025-10-08",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "upload_source_maps": true,
  "assets": {
    "directory": "./dist/client",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "r2_buckets": [
    { "binding": "BUCKET", "bucket_name": "donatus-portfolio" }
  ]
}
```

`.dev.vars` (gitignored — verify with `git check-ignore .dev.vars` before proceeding):

```
SESSION_SECRET=dev-only-session-secret-not-for-prod
GUEST_PASSPHRASE=guest-dev
ADMIN_PASSPHRASE=admin-dev
```

tsconfigs: copy from the old site (`tsconfig.json` references app/node/worker projects; `tsconfig.worker.json` includes `worker-configuration.d.ts` and `src/worker`; `tsconfig.app.json` covers `src/react-app` + `src/shared` with `"jsx": "react-jsx"`). Add `"src/shared"` to both app and worker includes.

- [ ] **Step 2: Write minimal app + worker**

`index.html` (root):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Donatus Capital</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/react-app/main.tsx"></script>
  </body>
</html>
```

`src/react-app/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-cream: #f5f5f3;
  --color-ink: #181b19;
}
```

`src/react-app/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`src/react-app/App.tsx` (placeholder until Task 9):

```tsx
function App() {
  return <div className="min-h-screen bg-cream text-ink p-8">Donatus Capital</div>;
}
export default App;
```

`src/worker/index.ts`:

```ts
import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 3: Install and verify**

Run: `npm install && npm run cf-typegen && npm run build`
Expected: build succeeds, `dist/client/` exists, `worker-configuration.d.ts` generated (commit it).

Run: `npm run dev` briefly (background), `curl -s http://localhost:5173/api/health`
Expected: `{"ok":true}`. Kill dev server.

- [ ] **Step 4: Secret-scan pre-commit hook**

`.githooks/pre-commit` (then `git config core.hooksPath .githooks` and `chmod +x`):

```bash
#!/bin/sh
# Block obvious secrets from entering a public repo.
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --no-banner || exit 1
else
  if git diff --cached --name-only | grep -qE '(^|/)\.dev\.vars|(^|/)\.env'; then
    echo "BLOCKED: attempting to commit a secrets file" >&2
    exit 1
  fi
  if git diff --cached -U0 | grep -qE '(PASSPHRASE|SESSION_SECRET|API_KEY|SECRET_KEY)\s*[=:]\s*["'"'"']?[A-Za-z0-9+/_-]{12,}'; then
    echo "BLOCKED: staged diff looks like it contains a secret value" >&2
    exit 1
  fi
fi
exit 0
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite + React + Hono Worker app with Tailwind v4"
```

---

### Task 2: Test harness, shared types, R2 JSON helpers

**Files:**
- Create: `vitest.config.ts`, `tests/tsconfig.json`, `src/shared/types.ts`, `src/worker/r2.ts`, `tests/r2.test.ts`

**Interfaces:**
- Produces:
  - `Role`, `SessionPayload { role: Role; exp: number }`, `MediaItem { id, type: "photo"|"video", key, filename, caption?, width, height, size, contentType }`, `ProjectManifest { slug, title, description, date, cover?, media: MediaItem[] }`, `ProjectIndexEntry { slug, title, date, cover? }` from `src/shared/types.ts`
  - `getJSON<T>(bucket: R2Bucket, key: string): Promise<T | null>` and `putJSON(bucket: R2Bucket, key: string, value: unknown): Promise<void>` from `src/worker/r2.ts`

- [ ] **Step 1: Vitest config**

`vitest.config.ts`:

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.json" },
        miniflare: {
          bindings: {
            SESSION_SECRET: "test-session-secret",
            GUEST_PASSPHRASE: "guest-test-phrase",
            ADMIN_PASSPHRASE: "admin-test-phrase",
          },
        },
      },
    },
  },
});
```

- [ ] **Step 2: Shared types** — write `src/shared/types.ts` exactly as in Interfaces above (each field typed; `type` union `"photo" | "video"`; `size` in bytes; `key` is the full R2 object key like `kenya-2026/ab12cd34.jpg`).

- [ ] **Step 3: Failing test**

`tests/r2.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getJSON, putJSON } from "../src/worker/r2";

describe("r2 json helpers", () => {
  it("round-trips json and returns null for missing keys", async () => {
    expect(await getJSON(env.BUCKET, "nope.json")).toBeNull();
    await putJSON(env.BUCKET, "t.json", { a: 1 });
    expect(await getJSON<{ a: number }>(env.BUCKET, "t.json")).toEqual({ a: 1 });
  });
});
```

Also create `tests/tsconfig.json` extending worker tsconfig with `"types": ["@cloudflare/vitest-pool-workers"]` and `cloudflare:test` env declaration (`declare module "cloudflare:test" { interface ProvidedEnv extends Env {} }` in `tests/env.d.ts`).

Run: `npm test` → Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/worker/r2.ts`**

```ts
export async function getJSON<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  return (await obj.json()) as T;
}

export async function putJSON(bucket: R2Bucket, key: string, value: unknown): Promise<void> {
  await bucket.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: "application/json" },
  });
}
```

- [ ] **Step 5: Run `npm test`** → Expected: PASS.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: test harness, shared types, R2 JSON helpers"`

---

### Task 3: Auth — cookie signing, login/logout/me, middleware, rate limit

**Files:**
- Create: `src/worker/auth.ts`, `tests/auth.test.ts`
- Modify: `src/worker/index.ts`

**Interfaces:**
- Consumes: `SessionPayload`, `Role` from `src/shared/types.ts`.
- Produces (from `src/worker/auth.ts`):
  - `signSession(payload: SessionPayload, secret: string): Promise<string>`
  - `verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null>`
  - `phraseEquals(input: string, expected: string): Promise<boolean>` (constant-time via SHA-256 digests + `crypto.subtle.timingSafeEqual`)
  - `signMediaToken(key: string, exp: number, secret: string): Promise<string>` / `verifyMediaToken(token: string, key: string, exp: number, secret: string): Promise<boolean>`
  - `requireSession(role?: "admin")` — Hono middleware; 401 no/bad session, 403 wrong role; sets `c.set("session", payload)`
  - `checkRateLimit(ip: string): boolean` — in-memory sliding window, 8 attempts / 60 s per IP (module-level `Map`, prune on access)
  - Routes on the app: `POST /api/auth/login` (`{ phrase }` → sets `dc_session` cookie, returns `{ role }`; 401 generic `{"error":"incorrect passphrase"}`; 429 when rate-limited), `POST /api/auth/logout`, `GET /api/auth/me` → `{ role }` or 401.

Cookie format: `base64url(JSON payload) + "." + base64url(HMAC-SHA256(payloadB64, SESSION_SECRET))`. Media token format: same HMAC over `"media:" + key + ":" + exp`.

- [ ] **Step 1: Failing tests** — `tests/auth.test.ts` using `SELF` from `cloudflare:test`:

```ts
import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const login = (phrase: string) =>
  SELF.fetch("https://example.com/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phrase }),
  });

describe("auth", () => {
  it("rejects a wrong phrase with a generic error", async () => {
    const res = await login("wrong");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "incorrect passphrase" });
  });

  it("logs in guest and admin, sets cookie, /me reflects role", async () => {
    for (const [phrase, role] of [["guest-test-phrase", "guest"], ["admin-test-phrase", "admin"]] as const) {
      const res = await login(phrase);
      expect(res.status).toBe(200);
      const cookie = res.headers.get("set-cookie")!;
      expect(cookie).toContain("dc_session=");
      expect(cookie).toContain("HttpOnly");
      const me = await SELF.fetch("https://example.com/api/auth/me", { headers: { cookie } });
      expect(await me.json()).toEqual({ role });
    }
  });

  it("rejects tampered cookies", async () => {
    const res = await login("guest-test-phrase");
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const tampered = cookie.slice(0, -4) + "AAAA";
    const me = await SELF.fetch("https://example.com/api/auth/me", { headers: { cookie: tampered } });
    expect(me.status).toBe(401);
  });

  it("rate limits repeated failures per IP", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const res = await SELF.fetch("https://example.com/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": "9.9.9.9" },
        body: JSON.stringify({ phrase: "wrong" }),
      });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
```

Run: `npm test` → Expected: FAIL (404s — routes missing).

- [ ] **Step 2: Implement `src/worker/auth.ts`**

```ts
import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Role, SessionPayload } from "../shared/types";

export const COOKIE = "dc_session";
export const THIRTY_DAYS = 60 * 60 * 24 * 30;
const enc = new TextEncoder();

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
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(await hmac(body, secret))}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body, secret);
  const given = b64urlDecode(sig);
  if (given.byteLength !== expected.byteLength) return null;
  if (!crypto.subtle.timingSafeEqual(given.buffer as ArrayBuffer, expected.buffer as ArrayBuffer)) return null;
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
export async function verifyMediaToken(token: string, key: string, exp: number, secret: string): Promise<boolean> {
  if (exp < Date.now() / 1000) return false;
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

type AuthEnv = { Bindings: Env; Variables: { session: SessionPayload } };

export function requireSession(role?: "admin") {
  return async (c: Context<AuthEnv>, next: Next) => {
    const session = await verifySession(getCookie(c, COOKIE), c.env.SESSION_SECRET);
    if (!session) return c.json({ error: "unauthorized" }, 401);
    if (role === "admin" && session.role !== "admin") return c.json({ error: "forbidden" }, 403);
    c.set("session", session);
    await next();
  };
}

export function registerAuthRoutes(app: import("hono").Hono<AuthEnv>) {
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
      httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: THIRTY_DAYS,
    });
    return c.json({ role });
  });

  app.post("/api/auth/logout", (c) => {
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/api/auth/me", requireSession(), (c) => c.json({ role: c.get("session").role }));
}
```

In `src/worker/index.ts`, type the app as `new Hono<{ Bindings: Env; Variables: { session: SessionPayload } }>()` and call `registerAuthRoutes(app)`. Add `SESSION_SECRET`, `GUEST_PASSPHRASE`, `ADMIN_PASSPHRASE` as `string` to Env via `.dev.vars` + `npm run cf-typegen` (typegen picks up dev vars).

- [ ] **Step 3: Run `npm test`** → Expected: PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat: passphrase auth with signed session cookies and rate limiting"`

---

### Task 4: Projects CRUD

**Files:**
- Create: `src/worker/projects.ts`, `tests/projects.test.ts`
- Modify: `src/worker/index.ts`

**Interfaces:**
- Consumes: `requireSession`, `getJSON`/`putJSON`, `ProjectManifest`, `ProjectIndexEntry`.
- Produces routes:
  - `GET /api/projects` (session) → `ProjectIndexEntry[]` (empty array if no index yet)
  - `POST /api/projects` (admin) — body `{ slug, title, description?, date? }`; validates slug against `^[a-z0-9][a-z0-9-]{1,62}$` and reserved list; 409 if exists; creates manifest `{ slug, title, description: description ?? "", date: date ?? "", media: [] }` and index entry → 201 with manifest
  - `GET /api/projects/:slug` (session) → manifest or 404
  - `PUT /api/projects/:slug` (admin) — body may contain `title`, `description`, `date`, `cover`, `media` (full replacement array; server keeps only ids that already exist in the stored manifest — reorder/caption/cover editing, not injection); syncs index entry → updated manifest
  - `DELETE /api/projects/:slug` (admin) — deletes manifest, all R2 objects under `<slug>/` (list + delete loop), index entry → `{ ok: true }`
- Produces helper: `syncIndex(bucket, manifest)` internal; index at `projects/index.json`.

- [ ] **Step 1: Failing tests** — `tests/projects.test.ts`: helper `loginAs("admin" | "guest")` returning cookie header (same login fetch as Task 3). Tests: guest cannot POST (403); admin creates `kenya-2026` (201); duplicate → 409; bad slug `"API!"` → 400; reserved slug `"media"` → 400; GET index contains entry; GET manifest matches; PUT title updates manifest + index; DELETE removes both; GET without cookie → 401. Run → FAIL.
- [ ] **Step 2: Implement `src/worker/projects.ts`** — `registerProjectRoutes(app)` mirroring the auth module pattern. Index/manifest keys per Global Constraints. `RESERVED = new Set(["projects", "api", "media", "investor", "admin"])`. For DELETE, list with `bucket.list({ prefix: slug + "/" })`, loop `truncated`/`cursor`, `bucket.delete(keys)` in batches. For PUT's media replacement: `const allowed = new Map(stored.media.map(m => [m.id, m])); manifest.media = body.media.map(m => { const s = allowed.get(m.id); return s ? { ...s, caption: typeof m.caption === "string" ? m.caption : s.caption } : null; }).filter(Boolean)` — order from client, bytes-metadata from server. Wire into `index.ts`.
- [ ] **Step 3: Run `npm test`** → PASS. Then `npm run check` → typecheck + dry-run deploy pass.
- [ ] **Step 4: Commit** — `git commit -m "feat: project manifest CRUD with R2-backed index"`

---

### Task 5: Media upload, serve (with Range), delete

**Files:**
- Create: `src/worker/media.ts`, `tests/media.test.ts`
- Modify: `src/worker/index.ts`

**Interfaces:**
- Consumes: `requireSession`, `verifyMediaToken`, manifest helpers from Task 4 (`getJSON`/`putJSON`), `MediaItem`.
- Produces routes:
  - `POST /api/projects/:slug/media` (admin) — query `filename`, `type` (`photo`|`video`), `width`, `height`; raw binary body streamed via `bucket.put(key, c.req.raw.body, { httpMetadata: { contentType } })`; `id = crypto.randomUUID().slice(0, 8)`; `ext` from filename (lowercased, whitelist `jpg|jpeg|png|webp|avif|heic|mp4|mov|webm`, else 400); key `` `${slug}/${id}.${ext}` ``; appends `MediaItem` to manifest (size from returned `R2Object.size`) → 201 `MediaItem`
  - `GET /api/media/:slug/:file` (session OR valid `?token=&exp=` media token) — object key `` `${slug}/${file}` ``; `bucket.get(key, { range: c.req.raw.headers })`; 404 if missing; 206 + `Content-Range` when `obj.range` set, else 200; always `writeHttpMetadata`, `etag`, `accept-ranges: bytes`, `cache-control: private, max-age=3600`
  - `DELETE /api/projects/:slug/media/:id` (admin) — removes object + manifest entry (and clears `cover` if it pointed at the id) → `{ ok: true }`

- [ ] **Step 1: Failing tests** — upload a small PNG byte array as admin → 201, manifest gains item with correct `size`/`contentType`; GET media with guest cookie → 200 with body equal to uploaded bytes; GET with `Range: bytes=0-3` → 206, `content-range` present, 4-byte body; GET with no cookie and no token → 401; GET with valid signed token (import `signMediaToken`, exp now+60) → 200; expired token → 401; guest upload → 403; DELETE as admin removes manifest entry and object (subsequent GET → 404... after session, expect 404). Run → FAIL.
- [ ] **Step 2: Implement `src/worker/media.ts`** (`registerMediaRoutes(app)`). Range handling exactly:

```ts
const obj = await c.env.BUCKET.get(key, { range: c.req.raw.headers });
if (!obj) return c.json({ error: "not found" }, 404);
const headers = new Headers();
obj.writeHttpMetadata(headers);
headers.set("etag", obj.httpEtag);
headers.set("accept-ranges", "bytes");
headers.set("cache-control", "private, max-age=3600");
if (obj.range && "offset" in obj.range) {
  const offset = obj.range.offset ?? 0;
  const length = obj.range.length ?? obj.size - offset;
  headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
  headers.set("content-length", String(length));
  return new Response(obj.body, { status: 206, headers });
}
headers.set("content-length", String(obj.size));
return new Response(obj.body, { status: 200, headers });
```

Auth for GET: run `verifySession` on the cookie first; if absent, accept `token`/`exp` query verified with `verifyMediaToken(token, key, Number(exp), c.env.SESSION_SECRET)`; else 401. (No `requireSession` middleware on this route — it has the dual path.)

- [ ] **Step 3: `npm test`** → PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat: media upload, authenticated serving with Range support, delete"`

---

### Task 6: Variants and downloads (Image Transformations)

**Files:**
- Create: `src/worker/variants.ts`, `tests/variants.test.ts`
- Modify: `src/worker/index.ts`

**Interfaces:**
- Consumes: `signMediaToken`, manifest lookup, media serving from Task 5.
- Produces routes:
  - `GET /api/media/:slug/:file/variant?w=<px>&format=<jpeg|webp|avif>` (session) — builds origin URL `` `${url.origin}/api/media/${slug}/${file}?token=${t}&exp=${e}` `` (exp = now + 300 s) and fetches it with `cf: { image: { width, format, quality: 85, fit: "scale-down" } }`. If the current hostname is `localhost`, `127.0.0.1`, or ends in `.workers.dev`, OR the transform fetch fails/non-OK: fall back to streaming the original from R2 (same code path as Task 5 GET, no Range). Cache successful variant responses with `cache-control: private, max-age=86400`.
  - `GET /api/projects/:slug/media/:id/download?size=<web|large|original>&format=<jpeg|webp|avif>` (session) — loads manifest, finds item by id (404 if absent). `original` → stream R2 object. Otherwise transform with width from `{ web: 1200, large: 2560 }`. Filename: 1-based position in `manifest.media` → `` `${slug}-${String(pos).padStart(3, "0")}-${size}.${format === "jpeg" ? "jpg" : format}` `` (original keeps stored `filename`). Set `content-disposition: attachment; filename="<name>"`. Videos: only `original` allowed; other sizes → 400.
- Key facts for the implementer: in production the transformation layer re-fetches the origin URL and that request arrives back at this Worker carrying header `via: image-resizing` — the token query param is how it authenticates (cookies are not forwarded). Never mark the variant route `run_worker_first`-exempt; it's under `/api/*` already.

- [ ] **Step 1: Failing tests** — in the test environment `cf.image` is inert and hostname is `example.com`… so force the fallback branch: upload a photo as admin, then GET variant with guest cookie → 200 and body equals original bytes (fallback works, no crash). Download original → `content-disposition` contains stored filename; download `size=web&format=jpeg` → 200 + `content-disposition: attachment; filename="kenya-2026-001-web.jpg"` (fallback body = original bytes is fine — assert the header, not the pixels); download for a video item with `size=web` → 400; unauthenticated download → 401. Run → FAIL.
- [ ] **Step 2: Implement `src/worker/variants.ts`** with a single internal helper `transformOrOriginal(c, key, { width, format }): Promise<Response>` used by both routes; hostname check via `new URL(c.req.url).hostname`. Wire in.
- [ ] **Step 3: `npm test`** → PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat: image variants and multi-format downloads via edge transformations"`

---### Task 7: Multipart upload for large files

**Files:**
- Create: `src/worker/multipart.ts`, `tests/multipart.test.ts`
- Modify: `src/worker/index.ts`

**Interfaces:**
- Produces routes (all admin):
  - `POST /api/projects/:slug/media/multipart/create?filename=&contentType=` → `{ key, uploadId }` (`bucket.createMultipartUpload(key)`, same id/ext rules as Task 5)
  - `PUT /api/projects/:slug/media/multipart/:uploadId/part?key=&part=<n>` raw body → `{ partNumber, etag }` (`bucket.resumeMultipartUpload(key, uploadId).uploadPart(n, c.req.raw.body!)`)
  - `POST /api/projects/:slug/media/multipart/complete` — body `{ key, uploadId, parts: [{ partNumber, etag }], filename, type, width, height }` → completes upload, appends `MediaItem` to manifest (size from completed `R2Object`) → 201 `MediaItem`
- Client chunk size: 50 MiB (Task 12 consumes this).

- [ ] **Step 1: Failing test** — create → upload 2 parts (5 MiB minimum for non-final parts: use two 5 MiB buffers) → complete → manifest contains item with `size` = 10 MiB; part upload with guest cookie → 403. Run → FAIL.
- [ ] **Step 2: Implement + wire.** `npm test` → PASS.
- [ ] **Step 3: Commit** — `git commit -m "feat: R2 multipart upload endpoints for large media"`

---

### Task 8: shadcn + Base UI + 7ovr registry setup

**Files:**
- Create: `components.json`, `src/react-app/lib/utils.ts`, `src/react-app/components/ui/*`
- Modify: `src/react-app/index.css`, `package.json`

**Interfaces:**
- Produces: working `cn()` helper; installed ui components `button`, `input`, `dialog`, `dropdown-menu`, `label`, `progress`, `sonner` (toasts); 7ovr registry reachable as `@7ovr` namespace for later block pulls.

- [ ] **Step 1: Fetch current install instructions** — WebFetch `https://7ovr.com/docs` (and/or a free block's page) for the exact CLI form. Expected shape: `npx shadcn@latest init` (choose Base UI when prompted / via flag) then `npx shadcn@latest add @7ovr/<block>` with a `registries` entry in `components.json` like `{ "@7ovr": "https://7ovr.com/r/{name}.json" }`. Follow what the docs actually say — do not guess flags.
- [ ] **Step 2: Run init + add the components listed above.** If the CLI insists on interactive prompts, create `components.json` manually per the 7ovr docs and re-run `add`.
- [ ] **Step 3: Verify** — `npm run build` passes; render a `<Button>` temporarily on the placeholder App and check it styles correctly in `npm run dev`; remove the temporary usage.
- [ ] **Step 4: Commit** — `git commit -m "feat: shadcn/Base UI setup with 7ovr registry"`

---

### Task 9: Session context, router shell, login page

**Files:**
- Create: `src/react-app/lib/api.ts`, `src/react-app/lib/session.tsx`, `src/react-app/pages/InvestorLogin.tsx`
- Modify: `src/react-app/App.tsx`, `src/react-app/main.tsx`

**Interfaces:**
- Produces:
  - `api<T>(path: string, init?: RequestInit): Promise<T>` — fetch wrapper, JSON, throws `ApiError { status, message }` on non-2xx
  - `SessionProvider` / `useSession(): { role: "guest" | "admin" | null, loading: boolean, login(phrase): Promise<void>, logout(): Promise<void> }` — `role: null` = signed out; initial `GET /api/auth/me` (401 → null, not an error)
  - `<RequireSession>` wrapper component: while loading show nothing; if null redirect to `/investor`
  - Routes in `App.tsx` via `BrowserRouter`: `/` → `Home` (placeholder div until Task 13), `/investor` → `InvestorLogin`, `/investor/projects` → `Projects` (placeholder), `/investor/projects/:slug` → `ProjectPage` (placeholder), both wrapped in `RequireSession`.
- Login page: centered card on `bg-ink`, "Investor Access" heading, one password-type input ("Access phrase"), submit Button; on success `navigate("/investor/projects")`; on 401 show "Incorrect passphrase."; on 429 show "Too many attempts — try again in a minute."; never mention photography.

- [ ] **Step 1: Implement all files.** Keep `session.tsx` under ~80 lines; login submits on Enter; disable button while pending.
- [ ] **Step 2: Verify in dev** — `npm run dev`; wrong phrase shows error; `guest-dev` logs in and lands on the (placeholder) projects page; hard refresh stays logged in; `/investor/projects` when signed out redirects to `/investor`.
- [ ] **Step 3: Commit** — `git commit -m "feat: session context, router, investor login page"`

---

### Task 10: Projects grid, project gallery, lightbox

**Files:**
- Create: `src/react-app/pages/Projects.tsx`, `src/react-app/pages/ProjectPage.tsx`, `src/react-app/components/gallery/MediaTile.tsx`, `src/react-app/components/gallery/Lightbox.tsx`
- Modify: `src/react-app/App.tsx` (swap placeholders)

**Interfaces:**
- Consumes: `api`, `useSession`, worker routes from Tasks 4–6. Variant URL helper (put in `lib/api.ts`): `variantUrl(key: string, w: number, format = "webp")` → `` `/api/media/${key}/variant?w=${w}&format=${format}` ``; raw URL: `` `/api/media/${key}` ``.
- Produces:
  - `Projects.tsx` — fetches `GET /api/projects`; responsive card grid (cover via `variantUrl(coverKey, 800)`); empty state "No projects yet."; header bar with wordmark + Logout (and role badge when admin)
  - `ProjectPage.tsx` — fetches manifest; title/description/date header; CSS-columns masonry (`columns-1 sm:columns-2 lg:columns-3 gap-4`) of `MediaTile`s in manifest order
  - `MediaTile` — photo: `<img loading="lazy" src={variantUrl(key, 800)}>` with aspect-ratio box from `width`/`height`; video: `<video controls preload="metadata" src={rawUrl}>`; click photo → opens lightbox at that index; hover reveals a download icon button (wired in Task 11)
  - `Lightbox` — full-screen Dialog, image at `variantUrl(key, 2048)`, caption below, ←/→ keys + buttons, Esc closes, X button, download button (Task 11)

- [ ] **Step 1: Implement.** Use installed ui components (Dialog, Button, DropdownMenu). Keep each file focused; extract shared gallery types from `src/shared/types.ts`.
- [ ] **Step 2: Verify in dev** — seed via curl: login as `admin-dev`, create `kenya-2026`, upload 3–4 local test images (any jpgs) with curl, then browse as guest: grid renders, order correct, lightbox navigates, video tile plays if a small mp4 is uploaded.

```bash
# seed example (dev)
curl -s -c /tmp/dc.jar -H 'content-type: application/json' -d '{"phrase":"admin-dev"}' http://localhost:5173/api/auth/login
curl -s -b /tmp/dc.jar -H 'content-type: application/json' -d '{"slug":"kenya-2026","title":"Kenya 2026","date":"2026"}' http://localhost:5173/api/projects
curl -s -b /tmp/dc.jar --data-binary @/path/to/test.jpg 'http://localhost:5173/api/projects/kenya-2026/media?filename=test.jpg&type=photo&width=1600&height=1067'
```

- [ ] **Step 3: Commit** — `git commit -m "feat: project grid, gallery with lightbox and video tiles"`

---

### Task 11: Download dialog

**Files:**
- Create: `src/react-app/components/gallery/DownloadDialog.tsx`
- Modify: `MediaTile.tsx`, `Lightbox.tsx` (wire the download buttons)

**Interfaces:**
- Consumes: download route from Task 6: `/api/projects/:slug/media/:id/download?size=&format=`.
- Produces: `DownloadDialog({ slug, item, open, onOpenChange })` — for photos: two radio groups (Size: Web 1200px / Large 2560px / Original; Format: JPEG / WebP / AVIF — format group disabled when Original) + a Download button that triggers `window.location.assign(downloadUrl)` then closes; for videos: single "Download original" button. Include a one-line hint of approximate use ("Web — social & email", "Large — screens & small prints", "Original — full resolution").

- [ ] **Step 1: Implement + wire into tile hover button and lightbox.**
- [ ] **Step 2: Verify in dev** — downloads arrive with correct filenames (`kenya-2026-001-web.jpg` pattern; original keeps upload name); browser saves rather than navigates.
- [ ] **Step 3: Commit** — `git commit -m "feat: per-item download dialog with size and format options"`

---

### Task 12: Admin — create project, upload with progress

**Files:**
- Create: `src/react-app/components/admin/NewProjectDialog.tsx`, `src/react-app/components/admin/UploadZone.tsx`, `src/react-app/lib/upload.ts`
- Modify: `Projects.tsx`, `ProjectPage.tsx`

**Interfaces:**
- Consumes: Tasks 4/5/7 endpoints; `useSession` role.
- Produces:
  - `NewProjectDialog` — admin-only button on `Projects`; fields slug (auto-suggested from title: lowercase, spaces→dashes, stripped to slug charset), title, description, date; client-side slug validation mirroring the server regex; on success navigate to the new project
  - `lib/upload.ts` — `uploadFile(slug, file, onProgress: (pct: number) => void): Promise<MediaItem>`: reads dimensions (`createImageBitmap` for images; `<video>` `loadedmetadata` for videos), decides `type` from MIME, then: ≤ 95 MB → single XHR POST (XHR for `upload.onprogress`); > 95 MB → multipart with 50 MiB chunks via Task 7 endpoints, progress aggregated across parts
  - `UploadZone` — admin-only on `ProjectPage`: drag-drop area + file picker (`accept="image/*,video/mp4,video/quicktime,video/webm"`), queue with per-file progress bars, per-file retry on failure, toast on completion; appends new items to the gallery without full refetch

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in dev** — upload 5 images at once as admin: progress bars advance independently, gallery updates; kill dev server mid-upload to confirm the failed file shows retry (restart, retry works); guest sees no admin controls.
- [ ] **Step 3: Commit** — `git commit -m "feat: admin project creation and drag-drop upload with progress"`

---

### Task 13: Admin — captions, reorder, cover, delete

**Files:**
- Create: `src/react-app/components/admin/EditBar.tsx`
- Modify: `ProjectPage.tsx`, `MediaTile.tsx`

**Interfaces:**
- Consumes: `PUT /api/projects/:slug` (media array replacement semantics from Task 4), `DELETE /api/projects/:slug/media/:id`, `DELETE /api/projects/:slug`.
- Produces: admin-only "Edit" toggle on `ProjectPage`. In edit mode each tile gets: caption input (local state), ↑/↓ reorder buttons, "Set cover" button, delete button (confirm dialog). A sticky `EditBar` shows Save / Discard; Save sends one `PUT` with the full reordered `media` array (`{ id, caption }` entries) + `cover`, then exits edit mode. Project-level: edit title/description/date fields in the header while in edit mode; "Delete project" (typed-confirmation dialog: must type the slug) at the bottom.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify in dev** — reorder + captions survive refresh; cover shows on grid; deleting an item removes it; deleting the project returns to the grid.
- [ ] **Step 3: Run full `npm test` + `npm run check`** → all green.
- [ ] **Step 4: Commit** — `git commit -m "feat: admin editing — captions, ordering, cover, deletion"`

---

### Task 14: Front page port + header/footer + Investor Login link

**Files:**
- Create: `src/react-app/pages/Home.tsx`, `public/` assets
- Modify: `src/react-app/App.tsx`, `src/react-app/index.css` (fonts if needed)

**Interfaces:**
- Consumes: old site `App.tsx` content (source of truth for copy) and its public assets.
- Produces: `/` renders the ported front page with an added minimal fixed header (wordmark left, "Investor Login" right, transparent over the hero, `backdrop-blur` after scroll) and the existing footer gains a small "Investor Login" link. All body copy identical to the old site.

- [ ] **Step 1: Recover assets from the old repo's git (working tree deleted them):**

```bash
cd "/Users/bfj/Documents/DonatusCapital/donatuscapital-site"
for f in jony-y-7IR2CV2zlWo-unsplash.jpg roberto-shumski-iA2Z1U98svg-unsplash.jpg venti-views-_JwjoWbXt7c-unsplash.jpg; do
  git show "HEAD:public/$f" > "/Users/bfj/Documents/BFJ POrtfolio/public/$f"
done
cp public/DC_clean.svg "/Users/bfj/Documents/BFJ POrtfolio/public/" 2>/dev/null || git show HEAD:public/DC_clean.svg > "/Users/bfj/Documents/BFJ POrtfolio/public/DC_clean.svg"
```

Also copy any favicon files in old `public/`.

- [ ] **Step 2: Port `Home.tsx`** — copy old `App.tsx` JSX (hero, Our Approach, Investment Philosophy, quote box, three-column Discovery section, footer) adapting only: Tailwind v4 classnames are compatible as written; add the header component; add footer link to `/investor`.
- [ ] **Step 3: Verify in dev** — `/` visually matches the old site (compare against old repo running if in doubt); header link navigates to `/investor`.
- [ ] **Step 4: Commit** — `git commit -m "feat: port front page with investor login entry points"`

---

### Task 15: Production deploy to workers.dev

**Files:**
- Modify: `README.md` (create — setup, secrets, deploy runbook, domain-cutover steps)

- [ ] **Step 1: Verify Cloudflare auth** — `npx wrangler whoami`. If not logged in, STOP and ask the user to run `npx wrangler login`.
- [ ] **Step 2: Create bucket** — `npx wrangler r2 bucket create donatus-portfolio` (idempotent-check with `r2 bucket list` first).
- [ ] **Step 3: Set secrets** — generate: `SESSION_SECRET` = `openssl rand -hex 32`; two word-style passphrases (e.g. `openssl rand -hex 8`-seeded three-word phrases assembled locally — do NOT reuse dev values). `printf '%s' "<value>" | npx wrangler secret put <NAME>` for each. Record the two passphrases to report privately to the user at the end (chat only — never in a file or commit).
- [ ] **Step 4: Deploy** — `npm run deploy`. Note the `*.workers.dev` URL.
- [ ] **Step 5: Smoke test against the deployed URL** — `/api/health` OK; login with real guest phrase; create nothing (bucket empty is fine — grid shows empty state); admin login works; front page renders with images.
- [ ] **Step 6: Write README** — local dev setup, secret management (`wrangler secret put`), deploy command, the two manual steps left for the user: (a) enable Image Transformations for the donatuscapital.com zone (Dashboard → Images → Transformations), (b) domain cutover: remove custom domains from old `donatuscapital-site` Worker, add `donatuscapital.com` + `www` routes to this one (`wrangler.json` routes block provided in README, commented out until cutover), then archive the old repo.
- [ ] **Step 7: Commit + push** — `git add -A && git commit -m "docs: deployment runbook" && git push`

---

### Task 16: Visual polish pass + final QA

- [ ] **Step 1: Polish** — using the frontend-design skill, refine (without changing copy): front-page header/footer, login card, project grid, gallery spacing, lightbox chrome, download dialog. Pull specific free 7ovr blocks where they fit (hero/footer/auth patterns). Palette stays `#F5F5F3`/`#181b19`; typography: keep the light-weight tracking-wide look of the old site.
- [ ] **Step 2: Full QA sweep in browser preview** — as guest: login, browse, lightbox, download each size/format, video playback, logout. As admin: create test project, upload, caption, reorder, cover, delete item, delete project. Mobile viewport check (375px): grid, lightbox, admin controls usable.
- [ ] **Step 3: `npm test` + `npm run check`** → green.
- [ ] **Step 4: Commit + push, redeploy** — `npm run deploy`, re-verify live URL.

---

## Self-review notes

- Spec coverage: auth (T3), projects CRUD (T4), media pipeline (T5–6), multipart (T7), UI (T8–13), front page (T14), deploy/secrets/runbook (T15), polish/QA (T16). Domain cutover + zone transformations are user-facing manual steps documented in T15's README — matches spec's "Manual prerequisite".
- Deviation from spec (recorded): login rate limiting is an in-Worker in-memory window rather than the Workers rate-limit binding — the binding is an `unsafe` beta and breaks the vitest workers pool config; a Cloudflare WAF rule can be added later as hardening. Spec updated in the same commit as this plan.
- Type consistency: media object keys are `` `${slug}/${id}.${ext}` `` everywhere (manifest `key` field, media routes, variant origin URL); downloads address items by manifest id, raw/variant serving addresses by key. Session variable is `c.get("session")` typed via `Variables`.
