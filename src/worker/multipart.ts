import type { Hono } from "hono";
import { requireSession, type AppEnv } from "./auth";
import { getJSON, putJSON } from "./r2";
import { manifestKey, syncIndex } from "./projects";
import { extensionOf } from "./media";
import type { MediaItem, ProjectManifest } from "../shared/types";

export function registerMultipartRoutes(app: Hono<AppEnv>) {
  app.post(
    "/api/projects/:slug/media/multipart/create",
    requireSession("admin"),
    async (c) => {
      const slug = c.req.param("slug") ?? "";
      if (!(await c.env.BUCKET.head(manifestKey(slug)))) {
        return c.json({ error: "project not found" }, 404);
      }
      const filename = c.req.query("filename") ?? "";
      const contentType = c.req.query("contentType") ?? "application/octet-stream";
      const ext = extensionOf(filename);
      if (!ext) return c.json({ error: "unsupported file type" }, 400);
      const id = crypto.randomUUID().slice(0, 8);
      const key = `${slug}/${id}.${ext}`;
      const upload = await c.env.BUCKET.createMultipartUpload(key, {
        httpMetadata: { contentType },
      });
      return c.json({ key: upload.key, uploadId: upload.uploadId });
    }
  );

  app.put(
    "/api/projects/:slug/media/multipart/:uploadId/part",
    requireSession("admin"),
    async (c) => {
      const slug = c.req.param("slug") ?? "";
      const uploadId = c.req.param("uploadId") ?? "";
      const key = c.req.query("key") ?? "";
      const partNumber = Number(c.req.query("part"));
      if (!key.startsWith(`${slug}/`)) return c.json({ error: "key/project mismatch" }, 400);
      if (!Number.isInteger(partNumber) || partNumber < 1) {
        return c.json({ error: "invalid part number" }, 400);
      }
      if (!c.req.raw.body) return c.json({ error: "empty body" }, 400);
      const upload = c.env.BUCKET.resumeMultipartUpload(key, uploadId);
      const part = await upload.uploadPart(partNumber, c.req.raw.body);
      return c.json({ partNumber: part.partNumber, etag: part.etag });
    }
  );

  app.post(
    "/api/projects/:slug/media/multipart/complete",
    requireSession("admin"),
    async (c) => {
      const slug = c.req.param("slug") ?? "";
      const manifest = await getJSON<ProjectManifest>(c.env.BUCKET, manifestKey(slug));
      if (!manifest) return c.json({ error: "project not found" }, 404);
      const body = await c.req.json<{
        key?: unknown;
        uploadId?: unknown;
        parts?: unknown;
        filename?: unknown;
        type?: unknown;
        width?: unknown;
        height?: unknown;
      }>();
      const key = typeof body.key === "string" ? body.key : "";
      const uploadId = typeof body.uploadId === "string" ? body.uploadId : "";
      const filename = typeof body.filename === "string" ? body.filename : "";
      const type = body.type === "video" ? "video" : "photo";
      if (!key.startsWith(`${slug}/`)) return c.json({ error: "key/project mismatch" }, 400);
      if (!Array.isArray(body.parts) || body.parts.length === 0) {
        return c.json({ error: "missing parts" }, 400);
      }
      const upload = c.env.BUCKET.resumeMultipartUpload(key, uploadId);
      const parts = (body.parts as Array<{ partNumber: number; etag: string }>).map((p) => ({
        partNumber: p.partNumber,
        etag: p.etag,
      }));
      const stored = await upload.complete(parts);
      const contentType = stored.httpMetadata?.contentType ?? "application/octet-stream";

      const item: MediaItem = {
        id: key.split("/")[1]?.split(".")[0] ?? crypto.randomUUID().slice(0, 8),
        type,
        key,
        filename,
        width: typeof body.width === "number" ? body.width : 0,
        height: typeof body.height === "number" ? body.height : 0,
        size: stored.size,
        contentType,
      };
      manifest.media.push(item);
      await putJSON(c.env.BUCKET, manifestKey(slug), manifest);
      await syncIndex(c.env.BUCKET, manifest);
      return c.json(item, 201);
    }
  );
}
