import { z } from "zod";

/**
 * node-api configuration from environment variables.
 *
 * Names come from shared/.env.example, the single list shared with python-worker.
 * Deployment, index and model names have no defaults (shared/README.md): a missing value,
 * or a <placeholder> copied from .env.example, stops the API at startup with a list of
 * every variable to fix. Keys, the storage connection string and the SQL login are
 * optional; when empty the API uses DefaultAzureCredential (az login locally).
 */

const PLACEHOLDER = /<[^>]+>/;

/** "" (an empty KEY= line in .env) counts as not set. */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const text = () =>
  z
    .string()
    .trim()
    .min(1)
    .refine((v) => !PLACEHOLDER.test(v), {
      message: "still has a placeholder from .env.example",
    });

const required = () => z.preprocess(emptyToUndefined, text());
const optional = () => z.preprocess(emptyToUndefined, text().optional());
const flag = (fallback: boolean) =>
  z.preprocess(emptyToUndefined, z.stringbool().default(fallback));
const integer = () => z.coerce.number().int().positive();

const envSchema = z
  .object({
    // Runtime
    NODE_ENV: z.preprocess(
      emptyToUndefined,
      z.enum(["development", "test", "production"]).default("development"),
    ),
    PORT: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(0).max(65535).default(3000),
    ),
    HOST: z.preprocess(emptyToUndefined, z.string().default("0.0.0.0")),
    LOG_LEVEL: z.preprocess(
      emptyToUndefined,
      z
        .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
        .default("info"),
    ),
    CORS_ORIGIN: z.preprocess(
      emptyToUndefined,
      text().default("http://localhost:5173"),
    ),
    UPLOAD_MAX_BYTES: z.preprocess(
      emptyToUndefined,
      integer().default(50 * 1024 * 1024),
    ),

    // Azure OpenAI
    AZURE_OPENAI_ENDPOINT: required(),
    AZURE_OPENAI_API_KEY: optional(),
    AZURE_OPENAI_API_VERSION: required(),
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT: required(),
    AZURE_OPENAI_EMBEDDING_DIMENSIONS: z.preprocess(
      emptyToUndefined,
      integer(),
    ),
    AZURE_OPENAI_CHAT_DEPLOYMENT: required(),

    // Azure AI Search
    AZURE_SEARCH_ENDPOINT: required(),
    AZURE_SEARCH_API_KEY: optional(),
    AZURE_SEARCH_INDEX_NAME: required(),

    // Azure Storage: connection string (e.g. Azurite) or both endpoints
    AZURE_STORAGE_CONNECTION_STRING: optional(),
    AZURE_STORAGE_BLOB_ENDPOINT: optional(),
    AZURE_STORAGE_QUEUE_ENDPOINT: optional(),
    AZURE_STORAGE_BLOB_CONTAINER: required(),
    AZURE_STORAGE_QUEUE_NAME: required(),

    // Azure SQL: user + password, or both empty for Entra ID
    AZURE_SQL_SERVER: required(),
    AZURE_SQL_PORT: z.preprocess(emptyToUndefined, integer().default(1433)),
    AZURE_SQL_DATABASE: required(),
    AZURE_SQL_USER: optional(),
    AZURE_SQL_PASSWORD: optional(),
    AZURE_SQL_ENCRYPT: flag(true),
    AZURE_SQL_TRUST_SERVER_CERTIFICATE: flag(false),
  })
  .superRefine((env, ctx) => {
    if (
      !env.AZURE_STORAGE_CONNECTION_STRING &&
      !(env.AZURE_STORAGE_BLOB_ENDPOINT && env.AZURE_STORAGE_QUEUE_ENDPOINT)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["AZURE_STORAGE_CONNECTION_STRING"],
        message:
          "set it, or both AZURE_STORAGE_BLOB_ENDPOINT and AZURE_STORAGE_QUEUE_ENDPOINT",
      });
    }
    if (!env.AZURE_SQL_USER !== !env.AZURE_SQL_PASSWORD) {
      ctx.addIssue({
        code: "custom",
        path: ["AZURE_SQL_USER"],
        message:
          "set both AZURE_SQL_USER and AZURE_SQL_PASSWORD, or neither (Entra ID)",
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  override name = "ConfigError";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (result.success) return result.data;
  const lines = result.error.issues.map((issue) => {
    const name = issue.path.join(".") || "config";
    const reason =
      issue.code === "invalid_type" && issue.input === undefined
        ? "missing"
        : issue.message;
    return `  - ${name}: ${reason}`;
  });
  throw new ConfigError(
    `API configuration is incomplete. Set these in .env (see shared/.env.example):\n${lines.join("\n")}`,
  );
}
