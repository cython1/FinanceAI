# Copilot instructions — FinanceAI

Read `AGENTS.md` at the repo root before doing anything. It is the full guide; this file is the short version.

- Work one GitHub issue at a time. Issue titles are `FAI-XXX <title>` and issue #N is FAI-N.
- Use the branch name written in the issue (`feature/FAI-XXX-short-name`), commit as `FAI-XXX: message`, and put `Closes #XXX` in the PR body.
- Meet every acceptance criterion in the issue, and list them as a checklist in the PR.
- Check the issue's "Depends on" line. If a dependency is not merged yet, stop and say so in the PR.
- Hybrid stack: Python 3.12 in `python-worker/`, Node 22 + TypeScript (Fastify) in `node-api/`, React + Vite in `frontend/`, contracts in `shared/`. The two services talk only through Azure (Blob, Queue, AI Search, SQL), never directly.
- Never commit secrets; read config from env vars and add new ones to `shared/.env.example`.
- Both services must use the embedding deployment from `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`.
- Never invent financial figures: return `null` when a KPI is not found and keep source page numbers.
- Add tests with every change and mock Azure services in them.
