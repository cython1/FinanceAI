# shared

The contracts between `python-worker`, `node-api` and `frontend`. These files are the source of truth. If you change one, update both services in the same PR (see [AGENTS.md](../AGENTS.md)).

| File | What it defines |
| --- | --- |
| [`.env.example`](.env.example) | Every environment variable, defined once, with which service reads it |
| [`schemas/ingestion-queue-message.schema.json`](schemas/ingestion-queue-message.schema.json) | Message node-api enqueues and python-worker consumes |
| [`schemas/kpi-record.schema.json`](schemas/kpi-record.schema.json) | One KPI value (one metric, one company, one fiscal year) |
| [`search/index-fields.json`](search/index-fields.json) | AI Search index fields, vector profile and semantic configuration |
| [`schemas/search-index-fields.schema.json`](schemas/search-index-fields.schema.json) | Shape of `index-fields.json` |
| [`examples/`](examples/) | Example documents: `valid/` must pass their schema, `invalid/` must fail it |
| [`scripts/check_contracts.py`](scripts/check_contracts.py) | Checks everything above (also runs in CI) |

## One definition, same values in both services

- **Names are defined once.** Each variable appears exactly once in `.env.example`, and the check script fails on duplicates. This includes `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`, `AZURE_OPENAI_EMBEDDING_DIMENSIONS` and `AZURE_SEARCH_INDEX_NAME`.
- **Values are set once.** Each environment has a single `.env` file (or ConfigMap/Key Vault on AKS) built from `.env.example`, and both services load the same file. Neither service hard-codes a deployment name, model name, index name or vector size, and neither defines a default for them. A service must fail at startup if one is missing.
- **The index name is not in `index-fields.json`.** It comes only from `AZURE_SEARCH_INDEX_NAME`. The vector size is written as `${AZURE_OPENAI_EMBEDDING_DIMENSIONS}` and resolved from the environment when the index is created.

## Authentication

Every `*_API_KEY`, `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_SQL_USER`/`AZURE_SQL_PASSWORD` is optional:

- **Set:** the service uses the key, connection string or SQL login.
- **Empty:** the service uses `DefaultAzureCredential` (`az login` locally, workload identity on AKS).

## Conventions

- JSON field names are `snake_case`.
- `company` is the upper-case stock ticker.
- Timestamps are RFC 3339 in UTC.
- IDs (`job_id`, `document_id`) are UUIDs.
- The queue message body is UTF-8 JSON text.
- **KPI values:**
  - Money is stored in full currency units with an ISO 4217 `currency`.
  - `operating_margin` is stored as a ratio (`0.315` = 31.5%) with `currency: null`.
  - A metric not found in the report has `value: null` and `source_page: null`. The value is never guessed.
- **Search chunk IDs** are deterministic: `<document_id>_<chunk_index>`.
- **Breaking change to the queue message:** bump `schema_version`.

## Check the contracts

From the repo root:

```bash
pip install -r shared/scripts/requirements.txt
python shared/scripts/check_contracts.py
```

CI runs the same check on every PR into `main` that touches `shared/` ([shared-contracts-ci.yml](../.github/workflows/shared-contracts-ci.yml)).
