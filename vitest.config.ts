import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    poolOptions: {
      workers: {
        // Ranged R2 reads trip vitest-pool-workers' isolated-storage frame popping,
        // so tests share storage; they stay independent via unique slugs.
        isolatedStorage: false,
        singleWorker: true,
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
