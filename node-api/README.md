# node-api

The FinanceAI API (Node.js 22, TypeScript, Fastify). It handles uploads, job status, dashboard and comparison data, and RAG research.

It never calls `python-worker`. The two share data only through Azure Storage (Blob + Queue), AI Search and Azure SQL. See the [architecture](../docs/architecture.md).

## Setup

```bash
cd node-api
npm ci
npm run dev        # http://localhost:3000/health
```

## Configuration

[`src/config.ts`](src/config.ts) reads the names in [`shared/.env.example`](../shared/.env.example), the single list shared with `python-worker`:

- **Locally:** from the repo-root `.env` (found by walking up from `node-api/`). Real environment variables win.
- **In a container:** from the environment.

The API **exits at startup** if a required value is missing or still holds a `<placeholder>`, listing every name to fix. Keys, the storage connection string and the SQL login are optional: when empty, the API uses `DefaultAzureCredential` (`az login` locally).

## Azure clients

[`src/plugins/azure.ts`](src/plugins/azure.ts) builds every client once and exposes them to all routes as `app.azure` (or `request.server.azure`):

| Client          | Use                                                                |
| --------------- | ------------------------------------------------------------------ |
| `openai`        | `AzureOpenAI`: query embeddings and chat on the shared deployments |
| `search`        | `SearchClient` on `AZURE_SEARCH_INDEX_NAME`                        |
| `blobContainer` | Container for uploaded PDFs                                        |
| `queue`         | Ingestion queue                                                    |
| `sql`           | `await app.azure.sql.getPool()`: an `mssql` pool                   |

```ts
app.get("/example", async (request) => {
  const pool = await request.server.azure.sql.getPool();
  const { recordset } = await pool.request().query("SELECT 1 AS ok");
  return recordset;
});
```

**Azure SQL** connects on first use, not at startup, so a paused serverless database doesn't stop the API from starting. The first connection waits up to 60 seconds and is retried 3 times while the database resumes. The pool closes on shutdown (`SIGINT`/`SIGTERM`).

**Tests** pass fake clients: `buildApp(config, { clients })`. See [`test/helpers.ts`](test/helpers.ts).

## Checks

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
```

Tests never read your real `.env` and never call Azure.
