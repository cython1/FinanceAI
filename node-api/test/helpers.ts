import type sql from "mssql";
import { vi } from "vitest";
import type { AzureClients, SqlDatabase } from "../src/azure/clients.js";
import { loadConfig, type AppConfig } from "../src/config.js";

/** Every required variable, with test values. Tests never read a real .env or call Azure. */
export const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  AZURE_OPENAI_ENDPOINT: "https://fai-openai-test.openai.azure.com/",
  AZURE_OPENAI_API_KEY: "test-key",
  AZURE_OPENAI_API_VERSION: "2025-04-01-preview",
  AZURE_OPENAI_EMBEDDING_DEPLOYMENT: "text-embedding-3-small",
  AZURE_OPENAI_EMBEDDING_DIMENSIONS: "1536",
  AZURE_OPENAI_CHAT_DEPLOYMENT: "gpt-5-mini",
  AZURE_SEARCH_ENDPOINT: "https://fai-search-test.search.windows.net",
  AZURE_SEARCH_API_KEY: "test-search-key",
  AZURE_SEARCH_INDEX_NAME: "financial-reports",
  AZURE_STORAGE_CONNECTION_STRING: "UseDevelopmentStorage=true",
  AZURE_STORAGE_BLOB_CONTAINER: "raw-pdfs",
  AZURE_STORAGE_QUEUE_NAME: "ingestion-jobs",
  AZURE_SQL_SERVER: "fai-sql-test.database.windows.net",
  AZURE_SQL_DATABASE: "financeai",
  AZURE_SQL_USER: "faiadmin",
  AZURE_SQL_PASSWORD: "test-password",
};

export function testConfig(overrides: NodeJS.ProcessEnv = {}): AppConfig {
  return loadConfig({ ...VALID_ENV, ...overrides });
}

/** Fake clients; only the SQL close is observable, which is all the plugin touches. */
export function fakeClients(): AzureClients & { sql: SqlDatabase } {
  const sqlDatabase: SqlDatabase = {
    getPool: vi.fn(async () => ({}) as sql.ConnectionPool),
    close: vi.fn(async () => {}),
  };
  return {
    openai: {} as AzureClients["openai"],
    search: {} as AzureClients["search"],
    blobContainer: {} as AzureClients["blobContainer"],
    queue: {} as AzureClients["queue"],
    sql: sqlDatabase,
  };
}
