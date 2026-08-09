import type { Context, Hono } from "hono";
import { requireSession, signMediaToken, type AppEnv } from "./auth";
import { getJSON } from "./r2";
import { manifestKey } from "./projects";
import { streamObject } from "./media";
import type { ProjectManifest } from "../shared/types";

/** Image Transformations only run on the production zone; everywhere else we
 *  serve originals (local dev, workers.dev, tests). */
const TRANSFORM_HOSTS = new Set(["donatuscapital.com", "www.donatuscapital.com"]);

const SIZE_WIDTHS = { web: 1200, large: 2560 } as const;
const FORMATS = new Set(["jpeg", "webp", "avif"] as const);
type Format = "jpeg" | "webp" | "avif";

async function transformOrOriginal(
  c: Context<AppEnv>,
  key: string,
  width: number,
  format: Format
): Promise<Response> {
  const url = new URL(c.req.url);
  if (TRANSFORM_HOSTS.has(url.hostname)) {
    const exp = Math.floor(Date.now() / 1000) + 300;
    const token = await signMediaToken(key, exp, c.env.SESSION_SECRET);
    const origin = `${url.origin}/api/media/${key}?token=${token}&exp=${exp}`;
    try {
      // The transformation layer re-fetches `origin` through the zone; that
      // request arrives back at this Worker with `via: image-resizing` and
      // authenticates via the signed token, not cookies.
      const resp = await fetch(origin, {
        cf: { image: { width, format, quality: 85, fit: "scale-down" } },
      } as RequestInit);
      if (resp.ok) {
        const headers = new Headers(resp.headers);
        headers.set("cache-control", "private, max-age=86400");
        return new Response(resp.body, { status: 200, headers });
      }
    } catch {
      // fall through to original
    }
  }
  return streamObject(c, key, { range: false });
}

function attachment(res: Response, filename: string): Response {
  const headers = new Headers(res.headers);
  headers.set("content-disposition", `attachment; filename="${filename.replace(/["\\\r\n]/g, "")}"`);
  return new Response(res.body, { status: res.status, headers });
}

export function registerVariantRoutes(app: Hono<AppEnv>) {
  app.get("/api/media/:slug/:file/variant", requireSession(), async (c) => {
    const key = `${c.req.param("slug") ?? ""}/${c.req.param("file") ?? ""}`;
    const width = Number(c.req.query("w") ?? 2048);
    const format = c.req.query("format") ?? "webp";
    if (!Number.isFinite(width) || width < 16 || width > 4096) {
      return c.json({ error: "invalid width" }, 400);
    }
    if (!FORMATS.has(format as Format)) return c.json({ error: "invalid format" }, 400);
    return transformOrOriginal(c, key, Math.round(width), format as Format);
  });

  app.get("/api/projects/:slug/media/:id/download", requireSession(), async (c) => {
    const slug = c.req.param("slug") ?? "";
    const id = c.req.param("id") ?? "";
    const manifest = await getJSON<ProjectManifest>(c.env.BUCKET, manifestKey(slug));
    if (!manifest) return c.json({ error: "not found" }, 404);
    const pos = manifest.media.findIndex((m) => m.id === id);
    if (pos === -1) return c.json({ error: "not found" }, 404);
    const item = manifest.media[pos];

    const size = c.req.query("size");
    if (size === "original") {
      const res = await streamObject(c, item.key, { range: false });
      if (res.status !== 200) return res;
      return attachment(res, item.filename);
    }
    if (size !== "web" && size !== "large") return c.json({ error: "invalid size" }, 400);
    if (item.type === "video") return c.json({ error: "videos download as original only" }, 400);
    const format = c.req.query("format");
    if (!format || !FORMATS.has(format as Format)) return c.json({ error: "invalid format" }, 400);

    const res = await transformOrOriginal(c, item.key, SIZE_WIDTHS[size], format as Format);
    if (res.status !== 200) return res;
    const ext = format === "jpeg" ? "jpg" : format;
    const name = `${slug}-${String(pos + 1).padStart(3, "0")}-${size}.${ext}`;
    return attachment(res, name);
  });
}
