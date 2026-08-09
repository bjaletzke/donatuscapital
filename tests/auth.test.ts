import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const login = (phrase: string) =>
  SELF.fetch("https://example.com/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phrase }),
  });

describe("auth", () => {
  it("rejects a wrong phrase with a generic error", async () => {
    const res = await login("wrong");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "incorrect passphrase" });
  });

  it("logs in guest and admin, sets cookie, /me reflects role", async () => {
    for (const [phrase, role] of [
      ["guest-test-phrase", "guest"],
      ["admin-test-phrase", "admin"],
    ] as const) {
      const res = await login(phrase);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ role });
      const cookie = res.headers.get("set-cookie")!;
      expect(cookie).toContain("dc_session=");
      expect(cookie).toContain("HttpOnly");
      const me = await SELF.fetch("https://example.com/api/auth/me", {
        headers: { cookie: cookie.split(";")[0] },
      });
      expect(me.status).toBe(200);
      expect(await me.json()).toEqual({ role });
    }
  });

  it("rejects missing and tampered cookies", async () => {
    const anon = await SELF.fetch("https://example.com/api/auth/me");
    expect(anon.status).toBe(401);

    const res = await login("guest-test-phrase");
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const tampered = cookie.slice(0, -4) + "AAAA";
    const me = await SELF.fetch("https://example.com/api/auth/me", {
      headers: { cookie: tampered },
    });
    expect(me.status).toBe(401);
  });

  it("logout clears the session", async () => {
    const res = await login("guest-test-phrase");
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const out = await SELF.fetch("https://example.com/api/auth/logout", {
      method: "POST",
      headers: { cookie },
    });
    expect(out.status).toBe(200);
    const cleared = out.headers.get("set-cookie")!;
    expect(cleared).toContain("dc_session=;");
  });

  it("rate limits repeated failures per IP", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const res = await SELF.fetch("https://example.com/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "9.9.9.9",
        },
        body: JSON.stringify({ phrase: "wrong" }),
      });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
