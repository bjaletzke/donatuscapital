# Donatus Capital site + hidden photography portfolio — Design

**Date:** 2026-08-09
**Status:** Approved

## Overview

Rebuild donatuscapital.com as a single new app that serves two purposes:

1. **Front page** — the existing Donatus Capital one-pager, content and imagery preserved, visually refreshed with 7ovr blocks on Tailwind v4, plus a discreet "Investor Login" link.
2. **Hidden portfolio** — a passphrase-gated photography/video portfolio behind `/investor`, backed by Cloudflare R2. First project: **Kenya 2026**.

The app supersedes the existing `donatuscapital-site` repo (Vite + React + Hono + Workers, Tailwind v3), which gets archived after domain cutover.

## Decisions (from brainstorming)

- **One app, one new public repo** serving all of donatuscapital.com. Old repo retired.
- **Auth tiers:** guest passphrase = view + download; admin passphrase = guest + upload/edit/delete/create projects.
- **Content scale:** curated JPEGs (~50–300 per project, a few MB each) + a few short MP4 clips. R2 free tier suffices.
- **Image variants:** Cloudflare Image Transformations on the fly (no pre-generation).
- **Upload:** admin UI inside the portfolio itself (no CLI workflow).
- **Metadata:** JSON manifests in R2, no database. D1 is the upgrade path if this outgrows manifests.

## Stack

- Vite + React 19 + TypeScript
- Hono on a single Cloudflare Worker (Cloudflare Vite plugin, same shape as the old site)
- Tailwind CSS v4
- shadcn CLI with Base UI primitives; blocks from the 7ovr registry (free/MIT-0 blocks only)
- React Router (library mode) for client routing
- Vitest + `@cloudflare/vitest-pool-workers` for tests

## Pages

| Route | Purpose |
|---|---|
| `/` | Front page, ported content/imagery, 7ovr-refreshed, "Investor Login" link in header/footer |
| `/investor` | Single passphrase field, styled as a sober investor-portal gate. No photography hints. |
| `/investor/projects` | Project grid with cover images |
| `/investor/projects/:slug` | Project landing: title, description, photo/video gallery, lightbox, per-item download dialog |

**Admin mode** is the same UI with extra controls when the session role is `admin`: create project, drag-drop upload, edit captions, reorder, set cover, delete. No separate admin app.

**Download dialog:** size (Web 1200px / Large 2560px / Original) × format (JPEG / WebP / AVIF). "Original" streams the uploaded file as-is. Videos download as-is only.

## Auth

- `POST /api/auth/login` — body `{ phrase }`. Constant-time compare against `GUEST_PASSPHRASE` and `ADMIN_PASSPHRASE` secrets. On match, set an HMAC-signed (SHA-256, `SESSION_SECRET`) HTTP-only, Secure, SameSite=Lax cookie carrying `{ role, exp }`. 30-day expiry.
- `POST /api/auth/logout` — clears cookie.
- `GET /api/auth/me` — returns `{ role }` or 401.
- All `/api/*` data/media routes require a valid session; admin routes require `role=admin`.
- Same generic error for wrong phrase regardless of tier (no role leakage).
- Per-IP rate limiting on login via the Workers rate-limiting binding; 429 after repeated failures.

## Media pipeline

R2 bucket is **fully private**; every byte flows through the auth-checked Worker.

**R2 layout:**

```
projects/index.json                  # [{ slug, title, cover, date }]
projects/<slug>/manifest.json        # { slug, title, description, cover, media: [...] }
media/<slug>/<id>.<ext>              # originals (photos and videos)
```

**Manifest media entry:** `{ id, type: "photo" | "video", key, filename, caption?, width, height, size, poster? }`. Array order = display order.

**Serving:**

- `GET /api/media/:key` — stream original from R2 (Range support for video).
- `GET /api/media/:key/variant?w=&format=` — Worker subrequest to its own media URL with `cf: { image: {...} }` and an internal signed token (so the transformer can re-fetch the private original without a session cookie). Edge-cached.
- `GET /api/media/:key/download?size=&format=` — same as variant plus `Content-Disposition: attachment` with a clean filename (e.g. `kenya-2026-014-large.jpg`).

**Manual prerequisite:** enable Image Transformations for the donatuscapital.com zone in the Cloudflare dashboard.

## Upload

- Admin drag-drops files onto a project. Browser reads image dimensions client-side, then `POST /api/projects/:slug/media` streams to R2 and appends to the manifest.
- Files > 95 MB automatically use R2 multipart (create / upload-part / complete endpoints), invisible to the admin.
- Per-file progress bar; failed files retry individually.

## API surface

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/projects                     (session)
POST   /api/projects                     (admin)
GET    /api/projects/:slug               (session)
PUT    /api/projects/:slug               (admin — title/description/cover/order/captions)
DELETE /api/projects/:slug               (admin)
POST   /api/projects/:slug/media         (admin — upload)
POST   /api/projects/:slug/media/multipart/*  (admin — large files)
DELETE /api/projects/:slug/media/:id     (admin)
GET    /api/media/:key                   (session)
GET    /api/media/:key/variant           (session or internal token)
GET    /api/media/:key/download          (session)
```

## Repo, secrets & deployment

- New **public** GitHub repo `bjaletzke/donatuscapital`, rooted in this folder.
- Secrets: `GUEST_PASSPHRASE`, `ADMIN_PASSPHRASE`, `SESSION_SECRET` — local in gitignored `.dev.vars`, production via `wrangler secret put`. Never in the repo.
- `.gitignore` written before any secret exists; gitleaks pre-commit scan as a backstop.
- Bindings: R2 bucket (`donatus-portfolio`), rate limiter.
- Deploy to `*.workers.dev` first for testing; after sign-off, move `donatuscapital.com` + `www` custom domains from the old Worker to the new one, then archive the old repo.

## Error handling

- Expired/missing session → redirect to `/investor` with a gentle message.
- Wrong phrase → generic "incorrect passphrase", 429 on rate limit.
- R2 misses → 404 page; upload failures → toast + per-file retry.

## Testing

- Unit/integration via Workers test pool: auth middleware (valid/invalid/expired/tampered cookies), manifest CRUD, media routes refuse unauthenticated requests (the property that matters most), download headers.
- Manual visual QA in browser preview.

## Known trade-offs

- **"Hidden" is soft:** public repo + visible login link reveal the portal's existence. Content stays locked.
- **No TIFF/RAW output:** transformations emit JPEG/WebP/AVIF/PNG; "Original" returns exactly what was uploaded.
- SPA route names ship in the public JS bundle (inherent to any SPA).

## Out of scope (future)

- Download-all / ZIP export
- Cloudflare Stream for long-form video
- D1 migration, multiple admins, per-project passphrases
