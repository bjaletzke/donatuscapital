import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getJSON, putJSON } from "../src/worker/r2";

describe("r2 json helpers", () => {
  it("round-trips json and returns null for missing keys", async () => {
    expect(await getJSON(env.BUCKET, "nope.json")).toBeNull();
    await putJSON(env.BUCKET, "t.json", { a: 1 });
    expect(await getJSON<{ a: number }>(env.BUCKET, "t.json")).toEqual({ a: 1 });
  });
});
