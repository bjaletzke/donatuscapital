import { Hono } from "hono";
import { registerAuthRoutes, type AppEnv } from "./auth";
import { registerProjectRoutes } from "./projects";

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true }));

registerAuthRoutes(app);
registerProjectRoutes(app);

export default app;
