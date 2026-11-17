import fp from "fastify-plugin";
import { createAzureClients, type AzureClients } from "../azure/clients.js";
import type { AppConfig } from "../config.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Azure clients for every route: `request.server.azure` or `app.azure`. */
    azure: AzureClients;
  }
}

export interface AzurePluginOptions {
  config: AppConfig;
  /** Pre-built clients, e.g. fakes in tests. Built from config when omitted. */
  clients?: AzureClients;
}

/**
 * Registers the Azure clients on the app and closes the SQL pool on shutdown.
 * fastify-plugin makes `app.azure` visible to every route, not just this plugin's scope.
 */
export const azurePlugin = fp<AzurePluginOptions>(
  async (app, { config, clients }) => {
    app.decorate("azure", clients ?? createAzureClients(config));
    app.addHook("onClose", async (instance) => {
      await instance.azure.sql.close();
    });
  },
  { name: "azure-clients" },
);
