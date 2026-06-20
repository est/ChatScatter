import { Hono } from "hono";
import { Env } from "./lib/types";
import { createApiRouter } from "./api/router";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api", createApiRouter());

export default app;
