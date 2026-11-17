import {
  DefaultAzureCredential,
  getBearerTokenProvider,
  type TokenCredential,
} from "@azure/identity";
import { AzureKeyCredential, SearchClient } from "@azure/search-documents";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { QueueServiceClient, type QueueClient } from "@azure/storage-queue";
import sql from "mssql";
import { AzureOpenAI } from "openai";
import type { AppConfig } from "../config.js";

/**
 * Every Azure client node-api uses, built once from config.
 * Routes reach them as `app.azure` (see plugins/azure.ts); tests inject fakes.
 */
export interface AzureClients {
  openai: AzureOpenAI;
  /** Index from AZURE_SEARCH_INDEX_NAME. Fields: shared/search/index-fields.json. */
  search: SearchClient<Record<string, unknown>>;
  /** Container for uploaded PDFs (AZURE_STORAGE_BLOB_CONTAINER). */
  blobContainer: ContainerClient;
  /** Ingestion queue (AZURE_STORAGE_QUEUE_NAME). */
  queue: QueueClient;
  sql: SqlDatabase;
}

/** Azure SQL access that connects on first use, so a paused database doesn't block startup. */
export interface SqlDatabase {
  getPool(): Promise<sql.ConnectionPool>;
  close(): Promise<void>;
}

const COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default";

let defaultCredential: TokenCredential | undefined;
function credential(): TokenCredential {
  defaultCredential ??= new DefaultAzureCredential();
  return defaultCredential;
}

export function createOpenAIClient(config: AppConfig): AzureOpenAI {
  return new AzureOpenAI({
    endpoint: config.AZURE_OPENAI_ENDPOINT,
    apiVersion: config.AZURE_OPENAI_API_VERSION,
    maxRetries: 5,
    ...(config.AZURE_OPENAI_API_KEY
      ? { apiKey: config.AZURE_OPENAI_API_KEY }
      : {
          azureADTokenProvider: getBearerTokenProvider(
            credential(),
            COGNITIVE_SERVICES_SCOPE,
          ),
        }),
  });
}

export function createSearchClient(
  config: AppConfig,
): SearchClient<Record<string, unknown>> {
  return new SearchClient(
    config.AZURE_SEARCH_ENDPOINT,
    config.AZURE_SEARCH_INDEX_NAME,
    config.AZURE_SEARCH_API_KEY
      ? new AzureKeyCredential(config.AZURE_SEARCH_API_KEY)
      : credential(),
  );
}

export function createBlobContainerClient(config: AppConfig): ContainerClient {
  const service = config.AZURE_STORAGE_CONNECTION_STRING
    ? BlobServiceClient.fromConnectionString(
        config.AZURE_STORAGE_CONNECTION_STRING,
      )
    : new BlobServiceClient(config.AZURE_STORAGE_BLOB_ENDPOINT!, credential());
  return service.getContainerClient(config.AZURE_STORAGE_BLOB_CONTAINER);
}

export function createQueueClient(config: AppConfig): QueueClient {
  const service = config.AZURE_STORAGE_CONNECTION_STRING
    ? QueueServiceClient.fromConnectionString(
        config.AZURE_STORAGE_CONNECTION_STRING,
      )
    : new QueueServiceClient(
        config.AZURE_STORAGE_QUEUE_ENDPOINT!,
        credential(),
      );
  return service.getQueueClient(config.AZURE_STORAGE_QUEUE_NAME);
}

/** Connection settings for mssql. SQL login when set, otherwise Entra ID. */
export function sqlConfig(config: AppConfig): sql.config {
  return {
    server: config.AZURE_SQL_SERVER,
    port: config.AZURE_SQL_PORT,
    database: config.AZURE_SQL_DATABASE,
    ...(config.AZURE_SQL_USER
      ? { user: config.AZURE_SQL_USER, password: config.AZURE_SQL_PASSWORD }
      : {
          authentication: {
            type: "azure-active-directory-default",
            options: {},
          },
        }),
    options: {
      encrypt: config.AZURE_SQL_ENCRYPT,
      trustServerCertificate: config.AZURE_SQL_TRUST_SERVER_CERTIFICATE,
    },
    // A serverless database resumes from auto-pause in up to about a minute.
    connectionTimeout: 60_000,
    requestTimeout: 30_000,
    pool: { min: 0, max: 10, idleTimeoutMillis: 30_000 },
  };
}

export interface SqlRetryOptions {
  attempts?: number;
  delayMs?: number;
  connect?: (config: sql.config) => Promise<sql.ConnectionPool>;
}

/**
 * Lazily connected pool. The first query after an auto-pause can fail while the database
 * wakes up, so connecting is retried; a failed connection is not cached.
 */
export function createSqlDatabase(
  config: AppConfig,
  {
    attempts = 3,
    delayMs = 5_000,
    connect = (c) => new sql.ConnectionPool(c).connect(),
  }: SqlRetryOptions = {},
): SqlDatabase {
  let pending: Promise<sql.ConnectionPool> | undefined;

  async function connectWithRetry(): Promise<sql.ConnectionPool> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await connect(sqlConfig(config));
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }

  return {
    getPool() {
      pending ??= connectWithRetry().catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
      return pending;
    },
    async close() {
      if (!pending) return;
      const pool = await pending.catch(() => undefined);
      pending = undefined;
      await pool?.close();
    },
  };
}

export function createAzureClients(config: AppConfig): AzureClients {
  return {
    openai: createOpenAIClient(config),
    search: createSearchClient(config),
    blobContainer: createBlobContainerClient(config),
    queue: createQueueClient(config),
    sql: createSqlDatabase(config),
  };
}
