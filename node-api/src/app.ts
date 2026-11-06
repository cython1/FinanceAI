import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig } from "./config.js";

export function buildApp(config: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === "development" && {
        transport: { target: "pino-pretty" },
      }),
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
