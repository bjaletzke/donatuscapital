import type { Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import { COOKIE, requireSession, verifyMediaToken, verifySession, type AppEnv } from "./auth";
import { getJSON, putJSON } from "./r2";
import { manifestKey, syncIndex } from "./projects";
import type { MediaItem, ProjectManifest } from "../shared/types";

const EXT_WHITELIST = new Set(["jpg", "jpeg", "png", "webp", "avif", "heic", "mp4", "mov", "webm"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "webm"]);

export function extensionOf(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_WHITELIST.has(ext) ? ext : null;
}

/** Session cookie OR signed media token (used by the image-transformation origin fetch). */
async function authorizeMediaRequest(c: Context<AppEnv>, key: string): Promise<boolean> {
  const session = await verifySession(getCookie(c, COOKIE), c.env.SESSION_SECRET);
  if (session) return true;
  const token = c.req.query("token");
  const exp = Number(c.req.query("exp"));
  if (!token) return false;
  return verifyMediaToken(token, key, exp, c.env.SESSION_SECRET);
}

export async function streamObject(
  c: Context<AppEnv>,
  key: string,
  opts: { range?: boolean } = { range: true }
): Promise<Response> {
  const wantsRange = opts.range && c.req.header("range");
  const obj = await c.env.BUCKET.get(key, wantsRange ? { range: c.req.raw.headers } : undefined);
  if (!obj) return c.json({ error: "not found" }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=3600");
  if (wantsRange && obj.range && "offset" in obj.range) {
    const offset = obj.range.offset ?? 0;
    const length = obj.range.length ?? obj.size - offset;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set("content-length", String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("content-length", String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}

export function registerMediaRoutes(app: Hono<AppEnv>) {
  app.post("/api/projects/:slug/media", requireSession("admin"), async (c) => {
    const slug = c.req.param("slug") ?? "";
    const manifest = await getJSON<ProjectManifest>(c.env.BUCKET, manifestKey(slug));
    if (!manifest) return c.json({ error: "project not found" }, 404);

    const filename = c.req.query("filename") ?? "";
    const type = c.req.query("type");
    const width = Number(c.req.query("width"));
    const height = Number(c.req.query("height"));
    const ext = extensionOf(filename);
    if (!ext) return c.json({ error: "unsupported file type" }, 400);
    if (type !== "photo" && type !== "video") return c.json({ error: "invalid type" }, 400);
    if (type === "video" !== VIDEO_EXTS.has(ext)) return c.json({ error: "type/extension mismatch" }, 400);
    if (!c.req.raw.body) return c.json({ error: "empty body" }, 400);

    const id = crypto.randomUUID().slice(0, 8);
    const key = `${slug}/${id}.${ext}`;
    const contentType = c.req.header("content-type") ?? "application/octet-stream";
    const stored = await c.env.BUCKET.put(key, c.req.raw.body, {
      httpMetadata: { contentType },
    });

    const item: MediaItem = {
      id,
      type,
      key,
      filename,
      width: Number.isFinite(width) ? width : 0,
      height: Number.isFinite(height) ? height : 0,
      size: stored.size,
      contentType,
    };
    manifest.media.push(item);
    await putJSON(c.env.BUCKET, manifestKey(slug), manifest);
    await syncIndex(c.env.BUCKET, manifest);
    return c.json(item, 201);
  });

  app.get("/api/media/:slug/:file", async (c) => {
    const key = `${c.req.param("slug") ?? ""}/${c.req.param("file") ?? ""}`;
    if (!(await authorizeMediaRequest(c, key))) return c.json({ error: "unauthorized" }, 401);
    return streamObject(c, key);
  });

  app.delete("/api/projects/:slug/media/:id", requireSession("admin"), async (c) => {
    const slug = c.req.param("slug") ?? "";
    const id = c.req.param("id") ?? "";
    const manifest = await getJSON<ProjectManifest>(c.env.BUCKET, manifestKey(slug));
    if (!manifest) return c.json({ error: "project not found" }, 404);
    const item = manifest.media.find((m) => m.id === id);
    if (!item) return c.json({ error: "not found" }, 404);
    await c.env.BUCKET.delete(item.key);
    manifest.media = manifest.media.filter((m) => m.id !== id);
    if (manifest.cover === id) manifest.cover = undefined;
    await putJSON(c.env.BUCKET, manifestKey(slug), manifest);
    await syncIndex(c.env.BUCKET, manifest);
    return c.json({ ok: true });
  });
}
