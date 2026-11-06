import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = buildApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }));
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
