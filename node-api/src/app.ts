import Fastify, { type FastifyInstance } from "fastify";
import type { AzureClients } from "./azure/clients.js";
import type { AppConfig } from "./config.js";
import { azurePlugin } from "./plugins/azure.js";

export interface BuildOptions {
  /** Inject Azure clients (tests). Real clients are built from config when omitted. */
  clients?: AzureClients;
}

export function buildApp(
  config: AppConfig,
  { clients }: BuildOptions = {},
): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === "development" && {
        transport: { target: "pino-pretty" },
      }),
    },
  });

  app.register(azurePlugin, { config, clients });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
