import { SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import type { MediaItem } from "../src/shared/types";

const BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9, 9, 9, 9]);

async function loginAs(role: "admin" | "guest"): Promise<string> {
  const res = await SELF.fetch("https://example.com/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phrase: `${role}-test-phrase` }),
  });
  return res.headers.get("set-cookie")!.split(";")[0];
}

async function drain(res: Response): Promise<Response> {
  await res.arrayBuffer();
  return res;
}

describe("variants and downloads", () => {
  let admin: string;
  let guest: string;

  beforeAll(async () => {
    admin = await loginAs("admin");
    guest = await loginAs("guest");
  });

  async function setup(): Promise<{ slug: string; photo: MediaItem; video: MediaItem }> {
    const slug = `v-${crypto.randomUUID().slice(0, 8)}`;
    await drain(
      await SELF.fetch("https://example.com/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: admin },
        body: JSON.stringify({ slug, title: "Variant Test" }),
      })
    );
    const photoRes = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media?filename=Lion%20Portrait.jpg&type=photo&width=1600&height=1067`,
      { method: "POST", headers: { cookie: admin, "content-type": "image/jpeg" }, body: BYTES }
    );
    const photo = (await photoRes.json()) as MediaItem;
    const videoRes = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media?filename=clip.mp4&type=video&width=1920&height=1080`,
      { method: "POST", headers: { cookie: admin, "content-type": "video/mp4" }, body: BYTES }
    );
    const video = (await videoRes.json()) as MediaItem;
    return { slug, photo, video };
  }

  it("serves variants to sessions (fallback to original off-zone)", async () => {
    const { photo } = await setup();
    const res = await SELF.fetch(
      `https://example.com/api/media/${photo.key}/variant?w=600&format=webp`,
      { headers: { cookie: guest } }
    );
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES);

    const anon = await drain(
      await SELF.fetch(`https://example.com/api/media/${photo.key}/variant?w=600&format=webp`)
    );
    expect(anon.status).toBe(401);
  });

  it("downloads original with the stored filename", async () => {
    const { slug, photo } = await setup();
    const res = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media/${photo.id}/download?size=original`,
      { headers: { cookie: guest } }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="Lion Portrait.jpg"'
    );
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES);
  });

  it("downloads sized variants with generated filenames", async () => {
    const { slug, photo } = await setup();
    const res = await drain(
      await SELF.fetch(
        `https://example.com/api/projects/${slug}/media/${photo.id}/download?size=web&format=jpeg`,
        { headers: { cookie: guest } }
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="${slug}-001-web.jpg"`
    );
  });

  it("rejects invalid size/format combos and video resizing", async () => {
    const { slug, photo, video } = await setup();
    for (const qs of [
      `size=huge&format=jpeg`,
      `size=web&format=tiff`,
      `size=web`,
    ]) {
      const res = await drain(
        await SELF.fetch(
          `https://example.com/api/projects/${slug}/media/${photo.id}/download?${qs}`,
          { headers: { cookie: guest } }
        )
      );
      expect(res.status, qs).toBe(400);
    }
    const vid = await drain(
      await SELF.fetch(
        `https://example.com/api/projects/${slug}/media/${video.id}/download?size=web&format=jpeg`,
        { headers: { cookie: guest } }
      )
    );
    expect(vid.status).toBe(400);

    const vidOriginal = await drain(
      await SELF.fetch(
        `https://example.com/api/projects/${slug}/media/${video.id}/download?size=original`,
        { headers: { cookie: guest } }
      )
    );
    expect(vidOriginal.status).toBe(200);
    expect(vidOriginal.headers.get("content-disposition")).toBe('attachment; filename="clip.mp4"');
  });

  it("requires a session for downloads", async () => {
    const { slug, photo } = await setup();
    const res = await drain(
      await SELF.fetch(
        `https://example.com/api/projects/${slug}/media/${photo.id}/download?size=original`
      )
    );
    expect(res.status).toBe(401);
  });
});
