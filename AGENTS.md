# AGENTS.md — FinanceAI

Instructions for AI coding agents (GitHub Copilot coding agent, Claude Code, Codex and others) and a quick orientation for human developers.

## What this project is

An AI-Powered Investor Intelligence Platform. It ingests company annual reports (Tesla, Apple, Microsoft), extracts financial KPIs, and serves dashboards plus RAG-based research over the reports.

It is a **hybrid** system:

| Part | Language | Folder | Job |
|---|---|---|---|
| Ingestion worker | Python 3.12 | `python-worker/` | PDF → markdown → semantic chunks → embeddings → Azure AI Search; KPI extraction → Azure SQL |
| API | Node.js 22 + TypeScript (Fastify) | `node-api/` | Uploads, job status, dashboard/comparison data, RAG research endpoint |
| Frontend | React + Vite + TypeScript | `frontend/` | Dashboard, Comparison, Research and Upload pages |
| Shared contracts | JSON / env | `shared/` | Env var names, queue message schema, KPI schema, search index fields |
| Infrastructure | Bicep / az CLI, Docker, Kubernetes | `infra/` | Azure resources, containers, AKS manifests |

The Python worker and Node API **never call each other**. They communicate only through Azure:
Blob storage (raw PDFs), Storage Queue (ingestion jobs), AI Search (chunks + vectors) and Azure SQL (KPIs). Both use Azure OpenAI.

See `docs/architecture.md` for the diagram and `docs/FAI-tasks.md` for the full task list.

## How work is organized

- Every unit of work is a GitHub issue titled `FAI-XXX <title>`. Issue #N is FAI-N.
- Each issue lists **acceptance criteria**, **dependencies** and its **branch name**.
- Do not start an issue until the issues it depends on are merged. If a dependency is missing, say so in the PR instead of building it yourself.
- Keep the scope of a PR to one issue. Note anything out of scope as a follow-up in the PR description.

### Branches, commits, PRs

- Branch: `feature/FAI-XXX-short-name` (use the exact name from the issue).
- Commits: `FAI-XXX: short imperative message`.
- PR title: `FAI-XXX <issue title>`; body must include `Closes #XXX` and a checklist of the acceptance criteria.
- Target branch: `main`. Squash merge.

### Agents on this repo

| Agent | How to give it a task | Config |
|---|---|---|
| Claude (GitHub Action) | Add the `claude` label to an issue, or comment `@claude ...` on an issue or PR | `.github/workflows/claude.yml` |
| GitHub Copilot cloud agent | Assign the issue to Copilot | `.github/copilot-instructions.md`, `.github/workflows/copilot-setup-steps.yml` |
| Claude Code (local or claude.ai/code) | Ask it to work an issue by number | `CLAUDE.md` → this file |

Give each issue to only one agent at a time. The Claude Action names its branches `feature/FAI-<issue number>-<title words>` (no zero padding); that is accepted in place of the issue's branch name.

### MCP servers

`.mcp.json` defines the MCP servers every Claude session uses (locally and in the GitHub Action):

- **microsoft-learn**: official Microsoft/Azure docs. Check it before using any Azure SDK (OpenAI, AI Search, Document Intelligence, SQL, Storage, AKS), because those APIs change often.
- **context7**: current docs for libraries such as Fastify, LangChain, React, TanStack Query and Pydantic.

Prefer these over memory when an API detail matters. Do not add MCP servers that need secrets to `.mcp.json`; pass those in the workflow from GitHub Secrets.

## Rules that must not be broken

1. **No secrets in the repo.** Read config from environment variables only. Add every new variable to `shared/.env.example` with a placeholder value.
2. **One embedding model.** Python (indexing) and Node (querying) must use the same Azure OpenAI embedding deployment, read from `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`. Never hard-code a model name in either service.
3. **Shared contracts are the source of truth.** If you change the queue message, KPI record or index fields, update `shared/` in the same PR and update both services.
4. **Never invent financial numbers.** KPI extraction returns `null` when a value is not found, and every KPI keeps its source page. RAG answers must cite retrieved chunks and decline when the context is insufficient.
5. **Idempotency.** Re-running ingestion for the same document must overwrite, not duplicate (deterministic chunk IDs, SQL upserts).
6. **Tests with every change.** Add or update tests. Mock Azure services in unit tests; never call real Azure from CI.

## Commands

Run from the package folder. These become valid as each scaffold task lands (FAI-006, FAI-018, FAI-028).

### Python worker (`python-worker/`)
```bash
pip install -e ".[dev]"
ruff check . && ruff format --check .
pytest
```

### Node API (`node-api/`)
```bash
npm ci
npm run lint
npm run format:check   # Prettier; CI also runs this on PRs into main
npm run typecheck
npm test
npm run dev        # http://localhost:3000/health
```

### Frontend (`frontend/`)
```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run dev        # http://localhost:5173
```

### Shared contracts (`shared/`)
```bash
pip install -r shared/scripts/requirements.txt
python shared/scripts/check_contracts.py   # run from the repo root
```

### Local services
```bash
docker compose -f docker-compose.dev.yml up -d   # Azurite (blob + queue) and SQL Server
```

## Code style

- **Python:** type hints everywhere, Pydantic models for data crossing a boundary, `pydantic-settings` for config, ruff for lint/format, pytest.
- **TypeScript:** `strict` mode, zod schemas for request/response validation, no `any`, ESLint + Prettier, vitest.
- **React:** function components, TanStack Query for server state, no global state library unless an issue asks for one.
- Prefer small modules with one responsibility. Match the module paths named in each issue.

## Before opening a PR

- [ ] Lint, typecheck and tests pass for every package you touched
- [ ] Every acceptance criterion in the issue is met or explained
- [ ] New env vars added to `shared/.env.example`
- [ ] README or docs updated if setup steps changed
