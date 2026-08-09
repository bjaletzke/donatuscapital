import { SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import type { MediaItem, ProjectManifest } from "../src/shared/types";

const PART = new Uint8Array(5 * 1024 * 1024).fill(7);

async function loginAs(role: "admin" | "guest"): Promise<string> {
  const res = await SELF.fetch("https://example.com/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phrase: `${role}-test-phrase` }),
  });
  return res.headers.get("set-cookie")!.split(";")[0];
}

describe("multipart upload", () => {
  let admin: string;
  let guest: string;
  let slug: string;

  beforeAll(async () => {
    admin = await loginAs("admin");
    guest = await loginAs("guest");
    slug = `mp-${crypto.randomUUID().slice(0, 8)}`;
    const res = await SELF.fetch("https://example.com/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: admin },
      body: JSON.stringify({ slug, title: "Multipart Test" }),
    });
    await res.arrayBuffer();
  });

  it("uploads a large file in parts and lands it in the manifest", async () => {
    const createRes = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media/multipart/create?filename=big.mp4&contentType=video/mp4`,
      { method: "POST", headers: { cookie: admin } }
    );
    expect(createRes.status).toBe(200);
    const { key, uploadId } = (await createRes.json()) as { key: string; uploadId: string };
    expect(key.startsWith(`${slug}/`)).toBe(true);

    const parts: Array<{ partNumber: number; etag: string }> = [];
    for (const partNumber of [1, 2]) {
      const partRes = await SELF.fetch(
        `https://example.com/api/projects/${slug}/media/multipart/${uploadId}/part?key=${encodeURIComponent(key)}&part=${partNumber}`,
        { method: "PUT", headers: { cookie: admin }, body: PART }
      );
      expect(partRes.status).toBe(200);
      parts.push((await partRes.json()) as { partNumber: number; etag: string });
    }

    const completeRes = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media/multipart/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: admin },
        body: JSON.stringify({
          key,
          uploadId,
          parts,
          filename: "big.mp4",
          type: "video",
          width: 1920,
          height: 1080,
        }),
      }
    );
    expect(completeRes.status).toBe(201);
    const item = (await completeRes.json()) as MediaItem;
    expect(item.size).toBe(PART.length * 2);
    expect(item.type).toBe("video");

    const manifest = (await (
      await SELF.fetch(`https://example.com/api/projects/${slug}`, {
        headers: { cookie: admin },
      })
    ).json()) as ProjectManifest;
    expect(manifest.media.map((m) => m.id)).toContain(item.id);
  });

  it("rejects non-admin multipart calls", async () => {
    const res = await SELF.fetch(
      `https://example.com/api/projects/${slug}/media/multipart/create?filename=big.mp4&contentType=video/mp4`,
      { method: "POST", headers: { cookie: guest } }
    );
    await res.arrayBuffer();
    expect(res.status).toBe(403);
  });
});
