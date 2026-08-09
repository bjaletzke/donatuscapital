import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.json" },
        miniflare: {
          bindings: {
            SESSION_SECRET: "test-session-secret",
            GUEST_PASSPHRASE: "guest-test-phrase",
            ADMIN_PASSPHRASE: "admin-test-phrase",
          },
        },
      },
    },
  },
});
