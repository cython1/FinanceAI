import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";
import { testConfig, VALID_ENV } from "./helpers.js";

describe("loadConfig", () => {
  it("parses required values, types and defaults", () => {
    const config = testConfig();
    expect(config.AZURE_OPENAI_EMBEDDING_DEPLOYMENT).toBe(
      "text-embedding-3-small",
    );
    expect(config.AZURE_OPENAI_EMBEDDING_DIMENSIONS).toBe(1536);
    expect(config.AZURE_SQL_PORT).toBe(1433);
    expect(config.AZURE_SQL_ENCRYPT).toBe(true);
    expect(config.AZURE_SQL_TRUST_SERVER_CERTIFICATE).toBe(false);
    expect(config.PORT).toBe(3000);
    expect(config.CORS_ORIGIN).toBe("http://localhost:5173");
  });

  it("treats empty values as not set, for DefaultAzureCredential", () => {
    const config = testConfig({
      AZURE_OPENAI_API_KEY: "",
      AZURE_SQL_USER: "",
      AZURE_SQL_PASSWORD: "",
    });
    expect(config.AZURE_OPENAI_API_KEY).toBeUndefined();
    expect(config.AZURE_SQL_USER).toBeUndefined();
  });

  it("fails fast and lists every missing variable", () => {
    const env = { ...VALID_ENV };
    delete env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT;
    delete env.AZURE_SEARCH_INDEX_NAME;
    expect(() => loadConfig(env)).toThrow(ConfigError);
    try {
      loadConfig(env);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("AZURE_OPENAI_EMBEDDING_DEPLOYMENT: missing");
      expect(message).toContain("AZURE_SEARCH_INDEX_NAME: missing");
    }
  });

  it("rejects unfilled placeholders from .env.example", () => {
    expect(() =>
      testConfig({ AZURE_SEARCH_INDEX_NAME: "<index-name>" }),
    ).toThrow(/AZURE_SEARCH_INDEX_NAME: still has a placeholder/);
  });

  it("rejects a non-numeric vector size", () => {
    expect(() =>
      testConfig({ AZURE_OPENAI_EMBEDDING_DIMENSIONS: "abc" }),
    ).toThrow(/AZURE_OPENAI_EMBEDDING_DIMENSIONS/);
  });

  it("needs a storage connection string or both endpoints", () => {
    expect(() =>
      testConfig({
        AZURE_STORAGE_CONNECTION_STRING: "",
        AZURE_STORAGE_BLOB_ENDPOINT: "https://faisttest.blob.core.windows.net",
      }),
    ).toThrow(/AZURE_STORAGE_CONNECTION_STRING/);
    const config = testConfig({
      AZURE_STORAGE_CONNECTION_STRING: "",
      AZURE_STORAGE_BLOB_ENDPOINT: "https://faisttest.blob.core.windows.net",
      AZURE_STORAGE_QUEUE_ENDPOINT: "https://faisttest.queue.core.windows.net",
    });
    expect(config.AZURE_STORAGE_CONNECTION_STRING).toBeUndefined();
  });

  it("needs the SQL user and password together", () => {
    expect(() => testConfig({ AZURE_SQL_PASSWORD: "" })).toThrow(
      /AZURE_SQL_USER and AZURE_SQL_PASSWORD/,
    );
  });

  it("parses boolean flags", () => {
    expect(
      testConfig({ AZURE_SQL_TRUST_SERVER_CERTIFICATE: "true" })
        .AZURE_SQL_TRUST_SERVER_CERTIFICATE,
    ).toBe(true);
  });
});
