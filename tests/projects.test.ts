import { SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import type { ProjectIndexEntry, ProjectManifest } from "../src/shared/types";

async function loginAs(role: "admin" | "guest"): Promise<string> {
  const res = await SELF.fetch("https://example.com/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phrase: `${role}-test-phrase` }),
  });
  return res.headers.get("set-cookie")!.split(";")[0];
}

const json = (cookie: string, method: string, path: string, body?: unknown) =>
  SELF.fetch(`https://example.com${path}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("projects", () => {
  let admin: string;
  let guest: string;

  beforeAll(async () => {
    admin = await loginAs("admin");
    guest = await loginAs("guest");
  });

  it("requires a session for reads and admin for writes", async () => {
    const anon = await SELF.fetch("https://example.com/api/projects");
    expect(anon.status).toBe(401);
    const res = await json(guest, "POST", "/api/projects", {
      slug: "x-1",
      title: "X",
    });
    expect(res.status).toBe(403);
  });

  it("validates slugs", async () => {
    for (const slug of ["API!", "media", "projects", "-bad", "a"]) {
      const res = await json(admin, "POST", "/api/projects", { slug, title: "Bad" });
      expect(res.status, `slug ${slug}`).toBe(400);
    }
  });

  it("creates, lists, reads, updates, deletes a project", async () => {
    const create = await json(admin, "POST", "/api/projects", {
      slug: "kenya-2026",
      title: "Kenya 2026",
      description: "First safari",
      date: "2026",
    });
    expect(create.status).toBe(201);
    const manifest = (await create.json()) as ProjectManifest;
    expect(manifest).toMatchObject({ slug: "kenya-2026", title: "Kenya 2026", media: [] });

    const dup = await json(admin, "POST", "/api/projects", { slug: "kenya-2026", title: "Again" });
    expect(dup.status).toBe(409);

    const list = await json(guest, "GET", "/api/projects");
    const index = (await list.json()) as ProjectIndexEntry[];
    expect(index).toEqual([{ slug: "kenya-2026", title: "Kenya 2026", date: "2026" }]);

    const read = await json(guest, "GET", "/api/projects/kenya-2026");
    expect(((await read.json()) as ProjectManifest).description).toBe("First safari");

    const update = await json(admin, "PUT", "/api/projects/kenya-2026", { title: "Kenya '26" });
    expect(update.status).toBe(200);
    const afterList = (await (await json(guest, "GET", "/api/projects")).json()) as ProjectIndexEntry[];
    expect(afterList[0].title).toBe("Kenya '26");

    const guestDelete = await json(guest, "DELETE", "/api/projects/kenya-2026");
    expect(guestDelete.status).toBe(403);
    const del = await json(admin, "DELETE", "/api/projects/kenya-2026");
    expect(del.status).toBe(200);
    const gone = await json(guest, "GET", "/api/projects/kenya-2026");
    expect(gone.status).toBe(404);
    const emptyList = (await (await json(guest, "GET", "/api/projects")).json()) as ProjectIndexEntry[];
    expect(emptyList).toEqual([]);
  });
});
