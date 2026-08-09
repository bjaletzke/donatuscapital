import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import type { MediaItem, ProjectManifest } from "../src/shared/types";
import { signMediaToken } from "../src/worker/auth";

const BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

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

describe("media", () => {
  let admin: string;
  let guest: string;

  beforeAll(async () => {
    admin = await loginAs("admin");
    guest = await loginAs("guest");
  });

  /** Creates a uniquely-named project and uploads one photo (storage is shared across tests). */
  async function setupProjectWithPhoto(): Promise<{ slug: string; item: MediaItem }> {
    const slug = `t-${crypto.randomUUID().slice(0, 8)}`;
    await drain(
      await SELF.fetch("https://example.com/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: admin },
        body: JSON.stringify({ slug, title: "Test Project" }),
      })
    );
    const res = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media?filename=Test%20Photo.PNG&type=photo&width=1600&height=1067`,
      {
        method: "POST",
        headers: { cookie: admin, "content-type": "image/png" },
        body: BYTES,
      }
    );
    expect(res.status).toBe(201);
    return { slug, item: (await res.json()) as MediaItem };
  }

  it("guest cannot upload", async () => {
    const res = await SELF.fetch(
      "https://example.com/api/projects/no-such-project/media?filename=a.png&type=photo&width=10&height=10",
      { method: "POST", headers: { cookie: guest }, body: BYTES }
    );
    await drain(res);
    expect(res.status).toBe(403);
  });

  it("admin upload produces a valid manifest item", async () => {
    const { slug, item } = await setupProjectWithPhoto();
    expect(item).toMatchObject({
      type: "photo",
      filename: "Test Photo.PNG",
      width: 1600,
      height: 1067,
      size: BYTES.length,
      contentType: "image/png",
    });
    expect(item.key).toMatch(new RegExp(`^${slug}/[a-f0-9-]{8}\\.png$`));

    const manifest = (await (
      await SELF.fetch(`https://example.com/api/projects/${slug}`, {
        headers: { cookie: admin },
      })
    ).json()) as ProjectManifest;
    expect(manifest.media.map((m) => m.id)).toContain(item.id);
  });

  it("stores takenAt and keywords from upload params", async () => {
    const { slug } = await setupProjectWithPhoto();
    const res = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media?filename=b.png&type=photo&width=10&height=10&takenAt=2026-03-04T08:30:00Z&keywords=${encodeURIComponent("Lions, Masai Mara, lions , ")}`,
      { method: "POST", headers: { cookie: admin, "content-type": "image/png" }, body: BYTES }
    );
    expect(res.status).toBe(201);
    const item = (await res.json()) as MediaItem;
    expect(item.takenAt).toBe("2026-03-04T08:30:00.000Z");
    expect(item.keywords).toEqual(["Lions", "Masai Mara"]);
  });

  it("merges takenAt and keywords via project PUT", async () => {
    const { slug, item } = await setupProjectWithPhoto();
    const put = await SELF.fetch(`https://example.com/api/projects/${slug}`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: admin },
      body: JSON.stringify({
        media: [
          { id: item.id, caption: "cap", takenAt: "2026-03-05", keywords: ["dawn", "camp"] },
        ],
      }),
    });
    expect(put.status).toBe(200);
    const manifest = (await put.json()) as ProjectManifest;
    expect(manifest.media[0]).toMatchObject({
      caption: "cap",
      takenAt: "2026-03-05T00:00:00.000Z",
      keywords: ["dawn", "camp"],
    });
  });

  it("rejects unknown extensions", async () => {
    const { slug } = await setupProjectWithPhoto();
    const res = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media?filename=run.exe&type=photo&width=1&height=1`,
      { method: "POST", headers: { cookie: admin }, body: BYTES }
    );
    await drain(res);
    expect(res.status).toBe(400);
  });

  it("serves media to sessions, with Range support", async () => {
    const { item } = await setupProjectWithPhoto();
    const full = await SELF.fetch(`https://example.com/api/media/${item.key}`, {
      headers: { cookie: guest },
    });
    expect(full.status).toBe(200);
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(BYTES);
    expect(full.headers.get("accept-ranges")).toBe("bytes");

    const partial = await SELF.fetch(`https://example.com/api/media/${item.key}`, {
      headers: { cookie: guest, range: "bytes=0-3" },
    });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe(`bytes 0-3/${BYTES.length}`);
    expect((await partial.arrayBuffer()).byteLength).toBe(4);
  });

  it("refuses anonymous access but honors signed media tokens", async () => {
    const { item } = await setupProjectWithPhoto();
    const anon = await drain(await SELF.fetch(`https://example.com/api/media/${item.key}`));
    expect(anon.status).toBe(401);

    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = await signMediaToken(item.key, exp, "test-session-secret");
    const ok = await drain(
      await SELF.fetch(`https://example.com/api/media/${item.key}?token=${token}&exp=${exp}`)
    );
    expect(ok.status).toBe(200);

    const past = Math.floor(Date.now() / 1000) - 10;
    const staleToken = await signMediaToken(item.key, past, "test-session-secret");
    const stale = await drain(
      await SELF.fetch(`https://example.com/api/media/${item.key}?token=${staleToken}&exp=${past}`)
    );
    expect(stale.status).toBe(401);
  });

  it("admin deletes an item: manifest entry and object removed", async () => {
    const { slug, item } = await setupProjectWithPhoto();
    const del = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media/${item.id}`,
      { method: "DELETE", headers: { cookie: admin } }
    );
    await drain(del);
    expect(del.status).toBe(200);

    const manifest = (await (
      await SELF.fetch(`https://example.com/api/projects/${slug}`, {
        headers: { cookie: admin },
      })
    ).json()) as ProjectManifest;
    expect(manifest.media).toEqual([]);
    expect(await env.BUCKET.head(item.key)).toBeNull();

    const gone = await drain(
      await SELF.fetch(`https://example.com/api/media/${item.key}`, {
        headers: { cookie: guest },
      })
    );
    expect(gone.status).toBe(404);
  });
});
