import { Hono } from "hono";
import { registerAuthRoutes, type AppEnv } from "./auth";
import { registerProjectRoutes } from "./projects";
import { registerMediaRoutes } from "./media";
import { registerVariantRoutes } from "./variants";

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true }));

registerAuthRoutes(app);
registerProjectRoutes(app);
registerVariantRoutes(app);
registerMediaRoutes(app);

export default app;
