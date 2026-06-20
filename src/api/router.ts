import { Hono } from "hono";
import { Env } from "../lib/types";
import { createProviderRoutes } from "./providers";

export function createApiRouter() {
  const api = new Hono<{ Bindings: Env }>();
  api.route("/provider", createProviderRoutes());
  return api;
}
