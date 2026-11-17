import type sql from "mssql";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import {
  createAzureClients,
  createSqlDatabase,
  sqlConfig,
} from "../src/azure/clients.js";
import { fakeClients, testConfig } from "./helpers.js";

describe("azure plugin", () => {
  it("makes the injected clients available in routes", async () => {
    const clients = fakeClients();
    const app = buildApp(testConfig(), { clients });
    app.get("/probe", async (request) => ({
      sameClients: request.server.azure === clients,
      hasQueue: request.server.azure.queue === clients.queue,
    }));
    const res = await app.inject({ method: "GET", url: "/probe" });
    expect(res.json()).toEqual({ sameClients: true, hasQueue: true });
    await app.close();
  });

  it("closes the SQL pool on graceful shutdown", async () => {
    const clients = fakeClients();
    const app = buildApp(testConfig(), { clients });
    await app.ready();
    await app.close();
    expect(clients.sql.close).toHaveBeenCalledOnce();
  });

  it("builds real clients from config without connecting to anything", () => {
    const clients = createAzureClients(testConfig());
    expect(clients.blobContainer.containerName).toBe("raw-pdfs");
    expect(clients.queue.name).toBe("ingestion-jobs");
    expect(clients.search.indexName).toBe("financial-reports");
  });
});

describe("Azure SQL", () => {
  it("uses the SQL login when set, with cold-start timeouts", () => {
    const config = sqlConfig(testConfig());
    expect(config.user).toBe("faiadmin");
    expect(config.authentication).toBeUndefined();
    expect(config.connectionTimeout).toBe(60_000);
    expect(config.options?.encrypt).toBe(true);
  });

  it("uses Entra ID when no SQL login is set", () => {
    const config = sqlConfig(
      testConfig({ AZURE_SQL_USER: "", AZURE_SQL_PASSWORD: "" }),
    );
    expect(config.user).toBeUndefined();
    expect(config.authentication?.type).toBe("azure-active-directory-default");
  });

  it("connects lazily, retries while the database wakes up, and reuses the pool", async () => {
    const pool = {
      close: vi.fn(async () => {}),
    } as unknown as sql.ConnectionPool;
    const connect = vi
      .fn<(c: sql.config) => Promise<sql.ConnectionPool>>()
      .mockRejectedValueOnce(new Error("database is resuming"))
      .mockResolvedValue(pool);
    const db = createSqlDatabase(testConfig(), { connect, delayMs: 0 });

    expect(connect).not.toHaveBeenCalled();
    expect(await db.getPool()).toBe(pool);
    expect(await db.getPool()).toBe(pool);
    expect(connect).toHaveBeenCalledTimes(2);

    await db.close();
    expect(pool.close).toHaveBeenCalledOnce();
  });

  it("does not cache a failed connection", async () => {
    const connect = vi
      .fn<(c: sql.config) => Promise<sql.ConnectionPool>>()
      .mockRejectedValue(new Error("unreachable"));
    const db = createSqlDatabase(testConfig(), {
      connect,
      attempts: 2,
      delayMs: 0,
    });
    await expect(db.getPool()).rejects.toThrow("unreachable");
    await expect(db.getPool()).rejects.toThrow("unreachable");
    expect(connect).toHaveBeenCalledTimes(4);
  });
});
