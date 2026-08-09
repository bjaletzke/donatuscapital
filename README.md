# Donatus Capital

The donatuscapital.com site: a public front page, and a passphrase-gated photography portfolio behind **Investor Login**, backed by Cloudflare Workers + R2.

- **Stack:** Vite + React 19 + TypeScript · Hono on Cloudflare Workers · Tailwind CSS v4 · shadcn/Base UI (basecn) + 7ovr blocks · React Router 7
- **Storage:** one private R2 bucket (`donatus-portfolio`) — originals under `<slug>/<id>.<ext>`, metadata in `projects/index.json` and `projects/<slug>/manifest.json`
- **Auth:** two passphrases (guest = view + download, admin = + manage) stored as Worker secrets; HMAC-signed HTTP-only session cookie, 30 days
- **Images:** served through the auth-checked Worker; sizes/formats via Cloudflare Image Transformations on the production zone (falls back to originals in dev / workers.dev)

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
```

Local secrets live in `.dev.vars` (gitignored):

```
SESSION_SECRET=dev-only-session-secret-not-for-prod
GUEST_PASSPHRASE=guest-dev
ADMIN_PASSPHRASE=admin-dev
```

Tests and checks:

```bash
npm test           # vitest + workers pool (22 tests)
npm run check      # typecheck + build + deploy dry-run
```

## First-time production setup

1. **Enable R2** (one-time, dashboard only): [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → activate. Requires a payment method on file; the free tier (10 GB) is plenty for this site.
2. **Create the bucket:**
   ```bash
   npx wrangler r2 bucket create donatus-portfolio
   ```
3. **Set production secrets** (never reuse the dev values):
   ```bash
   openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
   printf '%s' 'your-guest-phrase'  | npx wrangler secret put GUEST_PASSPHRASE
   printf '%s' 'your-admin-phrase'  | npx wrangler secret put ADMIN_PASSPHRASE
   ```
4. **Deploy:**
   ```bash
   npm run deploy
   ```
   This publishes to `donatuscapital.<subdomain>.workers.dev` first — test everything there.

## Domain cutover (after workers.dev sign-off)

1. **Enable Image Transformations** for the zone: dashboard → **Images → Transformations** → enable for donatuscapital.com. Without this, galleries still work but serve originals instead of resized variants.
2. In the dashboard, remove the `donatuscapital.com` and `www.donatuscapital.com` custom domains from the old `donatuscapital-site` Worker.
3. Add this routes block to `wrangler.json`:
   ```jsonc
   "routes": [
     { "pattern": "donatuscapital.com", "custom_domain": true },
     { "pattern": "www.donatuscapital.com", "custom_domain": true }
   ]
   ```
4. `npm run deploy` again, verify the domain, then archive the old repo.

## Content model

Everything is managed in the browser as admin: create projects, drag-drop photos/videos (files >95 MB automatically use multipart upload), edit captions, reorder, set covers, delete. No CLI needed.

## Security notes

- The R2 bucket is private; every media byte streams through the Worker's session check.
- Login is rate-limited per IP and compares phrases in constant time; both tiers get the same generic error.
- This repo is public: secrets exist only in `.dev.vars` (gitignored) and `wrangler secret`. A pre-commit hook (`.githooks/`, enabled via `git config core.hooksPath .githooks`) blocks obvious secret leaks; install [gitleaks](https://github.com/gitleaks/gitleaks) for a stronger scan.
