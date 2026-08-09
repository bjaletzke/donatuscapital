import type { Hono } from "hono";
import { requireSession, type AppEnv } from "./auth";
import { parseTakenAt, sanitizeKeywords } from "./media";
import { getJSON, putJSON } from "./r2";
import type { MediaItem, ProjectIndexEntry, ProjectManifest } from "../shared/types";

export const INDEX_KEY = "projects/index.json";
export const manifestKey = (slug: string) => `projects/${slug}/manifest.json`;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;
const RESERVED = new Set(["projects", "api", "media", "investor", "admin"]);

export async function readIndex(bucket: R2Bucket): Promise<ProjectIndexEntry[]> {
  return (await getJSON<ProjectIndexEntry[]>(bucket, INDEX_KEY)) ?? [];
}

export async function syncIndex(bucket: R2Bucket, manifest: ProjectManifest): Promise<void> {
  const index = await readIndex(bucket);
  // The index stores the cover's R2 key (not its id) so grids can render
  // covers without loading each manifest. Fall back to the first photo.
  const coverKey =
    manifest.media.find((m) => m.id === manifest.cover)?.key ??
    manifest.media.find((m) => m.type === "photo")?.key;
  const entry: ProjectIndexEntry = {
    slug: manifest.slug,
    title: manifest.title,
    date: manifest.date,
    ...(manifest.description ? { description: manifest.description } : {}),
    ...(coverKey ? { cover: coverKey } : {}),
  };
  const i = index.findIndex((e) => e.slug === manifest.slug);
  if (i === -1) index.push(entry);
  else index[i] = entry;
  await putJSON(bucket, INDEX_KEY, index);
}

export async function deleteProjectObjects(bucket: R2Bucket, slug: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const listing = await bucket.list({ prefix: `${slug}/`, cursor });
    const keys = listing.objects.map((o) => o.key);
    if (keys.length > 0) await bucket.delete(keys);
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
}

export function registerProjectRoutes(app: Hono<AppEnv>) {
  app.get("/api/projects", requireSession(), async (c) => {
    return c.json(await readIndex(c.env.BUCKET));
  });

  app.post("/api/projects", requireSession("admin"), async (c) => {
    const body = await c.req.json<{
      slug?: unknown;
      title?: unknown;
      description?: unknown;
      date?: unknown;
    }>();
    const slug = typeof body.slug === "string" ? body.slug : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!SLUG_RE.test(slug) || RESERVED.has(slug)) {
      return c.json({ error: "invalid slug" }, 400);
    }
    if (!title) return c.json({ error: "title is required" }, 400);
    if (await c.env.BUCKET.head(manifestKey(slug))) {
      return c.json({ error: "project already exists" }, 409);
    }
    const manifest: ProjectManifest = {
      slug,
      title,
      description: typeof body.description === "string" ? body.description : "",
      date: typeof body.date === "string" ? body.date : "",
      media: [],
    };
    await putJSON(c.env.BUCKET, manifestKey(slug), manifest);
    await syncIndex(c.env.BUCKET, manifest);
    return c.json(manifest, 201);
  });

  app.get("/api/projects/:slug", requireSession(), async (c) => {
    const manifest = await getJSON<ProjectManifest>(
      c.env.BUCKET,
      manifestKey((c.req.param("slug") ?? ""))
    );
    if (!manifest) return c.json({ error: "not found" }, 404);
    return c.json(manifest);
  });

  app.put("/api/projects/:slug", requireSession("admin"), async (c) => {
    const slug = (c.req.param("slug") ?? "");
    const stored = await getJSON<ProjectManifest>(c.env.BUCKET, manifestKey(slug));
    if (!stored) return c.json({ error: "not found" }, 404);
    const body = await c.req.json<{
      title?: unknown;
      description?: unknown;
      date?: unknown;
      cover?: unknown;
      media?: unknown;
    }>();
    if (typeof body.title === "string" && body.title.trim()) stored.title = body.title.trim();
    if (typeof body.description === "string") stored.description = body.description;
    if (typeof body.date === "string") stored.date = body.date;
    if (typeof body.cover === "string" || body.cover === null) {
      stored.cover = body.cover ?? undefined;
    }
    if (Array.isArray(body.media)) {
      // Reorder/caption only: keep server-side metadata, accept order and captions
      // from the client, drop unknown ids.
      const allowed = new Map(stored.media.map((m) => [m.id, m]));
      const next: MediaItem[] = [];
      for (const entry of body.media as Array<{
        id?: unknown;
        caption?: unknown;
        takenAt?: unknown;
        keywords?: unknown;
      }>) {
        if (typeof entry?.id !== "string") continue;
        const existing = allowed.get(entry.id);
        if (!existing) continue;
        const merged: MediaItem = {
          ...existing,
          caption: typeof entry.caption === "string" ? entry.caption : existing.caption,
        };
        if (entry.takenAt === null) delete merged.takenAt;
        else {
          const takenAt = parseTakenAt(entry.takenAt);
          if (takenAt) merged.takenAt = takenAt;
        }
        if (Array.isArray(entry.keywords)) {
          const keywords = sanitizeKeywords(entry.keywords);
          if (keywords.length) merged.keywords = keywords;
          else delete merged.keywords;
        }
        next.push(merged);
      }
      // Items the payload didn't mention are KEPT (in their existing order) —
      // removal goes through DELETE, so a partial or empty array can't wipe media.
      const mentioned = new Set(next.map((m) => m.id));
      for (const m of stored.media) {
        if (!mentioned.has(m.id)) next.push(m);
      }
      stored.media = next;
    }
    if (stored.cover && !stored.media.some((m) => m.id === stored.cover)) {
      stored.cover = undefined;
    }
    await putJSON(c.env.BUCKET, manifestKey(slug), stored);
    await syncIndex(c.env.BUCKET, stored);
    return c.json(stored);
  });

  app.delete("/api/projects/:slug", requireSession("admin"), async (c) => {
    const slug = (c.req.param("slug") ?? "");
    if (!(await c.env.BUCKET.head(manifestKey(slug)))) {
      return c.json({ error: "not found" }, 404);
    }
    await c.env.BUCKET.delete(manifestKey(slug));
    await deleteProjectObjects(c.env.BUCKET, slug);
    const index = (await readIndex(c.env.BUCKET)).filter((e) => e.slug !== slug);
    await putJSON(c.env.BUCKET, INDEX_KEY, index);
    return c.json({ ok: true });
  });
}
