import { Hono } from "hono";
import { registerAuthRoutes, type AppEnv } from "./auth";

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true }));

registerAuthRoutes(app);

export default app;
