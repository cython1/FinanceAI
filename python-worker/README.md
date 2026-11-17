# python-worker

The FinanceAI ingestion worker (Python 3.12). It turns annual-report PDFs into searchable chunks and KPI records:

PDF → markdown (Document Intelligence) → semantic chunks → embeddings → Azure AI Search; KPI extraction → Azure SQL.

It never calls `node-api`. The two services share data only through Azure Storage (Blob + Queue), AI Search and Azure SQL. See the [architecture](../docs/architecture.md).

## Setup

Requires Python 3.12+. For Azure SQL, install [Microsoft ODBC Driver 18 for SQL Server](https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server).

With pip:

```bash
cd python-worker
python -m venv .venv
.venv\Scripts\activate          # Windows; macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
```

Or with uv:

```bash
cd python-worker
uv venv --python 3.12
uv pip install -e ".[dev]"
```

## Configuration

Settings live in [`src/financeai_worker/config.py`](src/financeai_worker/config.py). They read the variable names from [`shared/.env.example`](../shared/.env.example), the single list shared with `node-api`:

- **Locally:** from the repo-root `.env` (copy `shared/.env.example`, or generate it from the Pulumi stack). Real environment variables override the file.
- **In a container:** from the environment.

The worker **fails at startup** if a required value is missing or still holds a `<placeholder>`, and lists every name to fix. Keys, the storage connection string and the SQL login are optional: when empty, the worker uses `DefaultAzureCredential` (`az login` locally).

```python
from financeai_worker.config import get_settings

settings = get_settings()
settings.azure_openai_embedding_deployment
```

## Azure OpenAI

All embedding and chat calls go through [`llm/azure_openai.py`](src/financeai_worker/llm/azure_openai.py):

| Function | Use |
| --- | --- |
| `embed_texts(texts)` | Vectors for chunks, batched, checked against `AZURE_OPENAI_EMBEDDING_DIMENSIONS` |
| `chat(messages)` | One completion on the chat deployment (`max_completion_tokens`; gpt-5 models take no `temperature`) |
| `get_openai_client()` | The shared `AzureOpenAI` client, for anything else (e.g. structured outputs in FAI-012) |
| `create_langchain_embeddings()` | LangChain embeddings on the same deployment, for `SemanticChunker` (FAI-009) |

Authentication uses `AZURE_OPENAI_API_KEY` when set, otherwise Entra ID via `az login`.

**Smoke test** against your real deployments (one embedding and one chat call, a fraction of a cent):

```bash
python -m financeai_worker.llm.smoke
```

## Checks

```bash
ruff check . && ruff format --check .
pytest
```

Tests never read your real `.env` and never call Azure. To also run the live Azure test:

```bash
RUN_AZURE_TESTS=1 pytest -m azure          # PowerShell: $env:RUN_AZURE_TESTS=1; pytest -m azure
```
