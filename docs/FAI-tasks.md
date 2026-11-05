# FAI task list — AI-Powered Investor Intelligence Platform (hybrid)

Branch convention: `feature/FAI-XXX-short-name`. Commit messages: `FAI-XXX: message`. PR title: `FAI-XXX Title`.

| ID | Task | Depends on | Branch |
|---|---|---|---|
| FAI-001 | Scaffold monorepo | — | `feature/FAI-001-scaffold-monorepo` |
| FAI-002 | Define shared contracts | FAI-001 | `feature/FAI-002-define-shared-contracts` |
| FAI-003 | Provision Azure dev resources | FAI-002 | `feature/FAI-003-provision-azure-dev-resources` |
| FAI-004 | Local dev environment | FAI-002 | `feature/FAI-004-local-dev-environment` |
| FAI-005 | CI baseline | FAI-001 | `feature/FAI-005-ci-baseline` |
| FAI-006 | Python project setup | FAI-002 | `feature/FAI-006-python-project-setup` |
| FAI-007 | Azure OpenAI client module | FAI-006 | `feature/FAI-007-azure-openai-client-module` |
| FAI-008 | PDF to markdown | FAI-007 | `feature/FAI-008-pdf-to-markdown` |
| FAI-009 | Semantic chunker | FAI-008 | `feature/FAI-009-semantic-chunker` |
| FAI-010 | AI Search index | FAI-002, FAI-007 | `feature/FAI-010-ai-search-index` |
| FAI-011 | Upload chunks with embeddings | FAI-009, FAI-010 | `feature/FAI-011-upload-chunks-with-embeddings` |
| FAI-012 | KPI schema and extraction | FAI-011 | `feature/FAI-012-kpi-schema-and-extraction` |
| FAI-013 | Azure SQL schema | FAI-003 | `feature/FAI-013-azure-sql-schema` |
| FAI-014 | Persist KPIs | FAI-012, FAI-013 | `feature/FAI-014-persist-kpis` |
| FAI-015 | Queue-driven worker | FAI-014 | `feature/FAI-015-queue-driven-worker` |
| FAI-016 | Seed ingestion | FAI-015 | `feature/FAI-016-seed-ingestion` |
| FAI-017 | KPI accuracy eval | FAI-016 | `feature/FAI-017-kpi-accuracy-eval` |
| FAI-018 | Node project setup | FAI-002 | `feature/FAI-018-node-project-setup` |
| FAI-019 | Config and Azure clients plugin | FAI-018 | `feature/FAI-019-config-and-azure-clients-plugin` |
| FAI-020 | Document upload endpoint | FAI-019, FAI-013 | `feature/FAI-020-document-upload-endpoint` |
| FAI-021 | Job status endpoint | FAI-020 | `feature/FAI-021-job-status-endpoint` |
| FAI-022 | Dashboard endpoints | FAI-019, FAI-013 | `feature/FAI-022-dashboard-endpoints` |
| FAI-023 | Company comparison endpoint | FAI-022 | `feature/FAI-023-company-comparison-endpoint` |
| FAI-024 | RAG retriever | FAI-019 | `feature/FAI-024-rag-retriever` |
| FAI-025 | Prompt builder and generation | FAI-024 | `feature/FAI-025-prompt-builder-and-generation` |
| FAI-026 | Research endpoint with streaming | FAI-025 | `feature/FAI-026-research-endpoint-with-streaming` |
| FAI-027 | API hardening | FAI-026 | `feature/FAI-027-api-hardening` |
| FAI-028 | Frontend scaffold | FAI-001 | `feature/FAI-028-frontend-scaffold` |
| FAI-029 | Typed API client | FAI-028, FAI-027 | `feature/FAI-029-typed-api-client` |
| FAI-030 | Dashboard page | FAI-029 | `feature/FAI-030-dashboard-page` |
| FAI-031 | Comparison page | FAI-029 | `feature/FAI-031-comparison-page` |
| FAI-032 | Research page | FAI-029 | `feature/FAI-032-research-page` |
| FAI-033 | Upload page | FAI-029 | `feature/FAI-033-upload-page` |
| FAI-034 | Dockerfiles | FAI-015, FAI-027, FAI-033 | `feature/FAI-034-dockerfiles` |
| FAI-035 | Full-stack compose | FAI-034, FAI-004 | `feature/FAI-035-full-stack-compose` |
| FAI-036 | ACR build pipeline | FAI-034, FAI-005 | `feature/FAI-036-acr-build-pipeline` |
| FAI-037 | Kubernetes manifests | FAI-036 | `feature/FAI-037-kubernetes-manifests` |
| FAI-038 | Workload identity | FAI-037 | `feature/FAI-038-workload-identity` |
| FAI-039 | Deploy and validate | FAI-038 | `feature/FAI-039-deploy-and-validate` |
| FAI-040 | Docs and demo | FAI-039 | `feature/FAI-040-docs-and-demo` |

## Epic 0 — Foundation

### FAI-001: Scaffold monorepo

Create repo layout: python-worker/, node-api/, frontend/, infra/, shared/, docs/. Add root README, .gitignore, .editorconfig.

**Acceptance criteria**
- [ ] Folders exist with placeholder READMEs
- [ ] Root README explains the hybrid architecture

**Depends on:** none
**Branch:** `feature/FAI-001-scaffold-monorepo`

### FAI-002: Define shared contracts

Add shared/ with .env.example (all env vars), JSON Schemas for the ingestion queue message and KPI record, and the AI Search index field list.

**Acceptance criteria**
- [ ] Embedding deployment name and index name defined once
- [ ] Both services will load the same values

**Depends on:** FAI-001
**Branch:** `feature/FAI-002-define-shared-contracts`

### FAI-003: Provision Azure dev resources

Script in infra/ (az CLI or Bicep) creating: Azure OpenAI (embedding + chat deployments), Azure AI Document Intelligence (used by FAI-008), AI Search, Azure SQL, Storage account (blob container + queue), Key Vault.

**Acceptance criteria**
- [ ] Script is idempotent
- [ ] Outputs written to a local .env (not committed), including the Document Intelligence endpoint and key

**Depends on:** FAI-002
**Branch:** `feature/FAI-003-provision-azure-dev-resources`

### FAI-004: Local dev environment

docker-compose.dev.yml with Azurite (blob + queue emulator) and a SQL Server container for offline development.

**Acceptance criteria**
- [ ] docker compose up starts both
- [ ] Connection strings documented in .env.example

**Depends on:** FAI-002
**Branch:** `feature/FAI-004-local-dev-environment`

### FAI-005: CI baseline

GitHub Actions workflow running lint + tests for each package on PRs, using path filters.

**Acceptance criteria**
- [ ] PR to any package runs only that package's checks

**Depends on:** FAI-001
**Branch:** `feature/FAI-005-ci-baseline`

## Epic 1 — Python ingestion worker

### FAI-006: Python project setup

pyproject.toml, ruff, pytest, pydantic-settings config loader reading shared env vars.

**Acceptance criteria**
- [ ] pytest runs green
- [ ] Settings fail fast on missing env vars

**Depends on:** FAI-002
**Branch:** `feature/FAI-006-python-project-setup`

### FAI-007: Azure OpenAI client module

llm/azure_openai.py: embedding client and chat client factories using azure-identity or API key.

**Acceptance criteria**
- [ ] Embed one string and one chat call in a smoke test

**Depends on:** FAI-006
**Branch:** `feature/FAI-007-azure-openai-client-module`

### FAI-008: PDF to markdown

ingestion/pdf_to_markdown.py using Azure Document Intelligence prebuilt-layout (markdown output), pymupdf4llm as local fallback.

**Acceptance criteria**
- [ ] Financial tables preserved as markdown tables
- [ ] Page numbers kept for citations

**Depends on:** FAI-007
**Branch:** `feature/FAI-008-pdf-to-markdown`

### FAI-009: Semantic chunker

chunking/semantic_chunker.py with LangChain SemanticChunker; attach metadata: company, fiscal_year, section, page.

**Acceptance criteria**
- [ ] Tables are not split mid-table
- [ ] Chunk size stats logged

**Depends on:** FAI-008
**Branch:** `feature/FAI-009-semantic-chunker`

### FAI-010: AI Search index

vectorstore/index.py: create index with vector field, filterable company/year/section, semantic config.

**Acceptance criteria**
- [ ] Index created from shared field list
- [ ] Re-running is safe

**Depends on:** FAI-002, FAI-007
**Branch:** `feature/FAI-010-ai-search-index`

### FAI-011: Upload chunks with embeddings

vectorstore/uploader.py: batch embed + upload with retry and deterministic chunk IDs.

**Acceptance criteria**
- [ ] Re-ingesting a document overwrites, not duplicates

**Depends on:** FAI-009, FAI-010
**Branch:** `feature/FAI-011-upload-chunks-with-embeddings`

### FAI-012: KPI schema and extraction

extraction/kpi_extractor.py: Pydantic model (revenue, net income, operating cash flow, total debt, operating margin, currency, fiscal year); retrieve relevant chunks and use structured output.

**Acceptance criteria**
- [ ] Each KPI includes source page
- [ ] Null instead of guessing when not found

**Depends on:** FAI-011
**Branch:** `feature/FAI-012-kpi-schema-and-extraction`

### FAI-013: Azure SQL schema

Migration scripts for companies, documents, kpis, processing_jobs tables.

**Acceptance criteria**
- [ ] Migrations run against local and Azure SQL

**Depends on:** FAI-003
**Branch:** `feature/FAI-013-azure-sql-schema`

### FAI-014: Persist KPIs

database/azure_sql.py: upsert KPI rows keyed by company + fiscal_year + metric.

**Acceptance criteria**
- [ ] Idempotent upsert
- [ ] Unit tests with a local DB

**Depends on:** FAI-012, FAI-013
**Branch:** `feature/FAI-014-persist-kpis`

### FAI-015: Queue-driven worker

worker.py: listen on the ingestion queue, run parse → chunk → index → extract → persist, update processing_jobs status.

**Acceptance criteria**
- [ ] Failed jobs marked failed with error message
- [ ] Poison messages don't loop forever

**Depends on:** FAI-014
**Branch:** `feature/FAI-015-queue-driven-worker`

### FAI-016: Seed ingestion

Script that ingests Tesla, Apple and Microsoft annual reports from data/raw_pdfs/.

**Acceptance criteria**
- [ ] All three companies visible in SQL and AI Search

**Depends on:** FAI-015
**Branch:** `feature/FAI-016-seed-ingestion`

### FAI-017: KPI accuracy eval

Small eval set of known KPI values from the reports; test reports accuracy per metric.

**Acceptance criteria**
- [ ] Eval runnable with one command
- [ ] Results table printed

**Depends on:** FAI-016
**Branch:** `feature/FAI-017-kpi-accuracy-eval`

## Epic 2 — Node.js API

### FAI-018: Node project setup

Fastify + TypeScript (tsx for dev), zod, vitest, pino logging, ESLint.

**Acceptance criteria**
- [ ] npm run dev serves /health

**Depends on:** FAI-002
**Branch:** `feature/FAI-018-node-project-setup`

### FAI-019: Config and Azure clients plugin

Fastify plugin registering AzureOpenAI, SearchClient, mssql pool, Blob and Queue clients from shared env.

**Acceptance criteria**
- [ ] Clients injectable in routes
- [ ] Graceful shutdown closes pool

**Depends on:** FAI-018
**Branch:** `feature/FAI-019-config-and-azure-clients-plugin`

### FAI-020: Document upload endpoint

POST /documents: multipart upload → Blob, insert processing_jobs row, enqueue message matching shared schema.

**Acceptance criteria**
- [ ] Rejects non-PDF and oversized files
- [ ] Returns jobId

**Depends on:** FAI-019, FAI-013
**Branch:** `feature/FAI-020-document-upload-endpoint`

### FAI-021: Job status endpoint

GET /jobs/:id returns status, timestamps and error.

**Acceptance criteria**
- [ ] 404 for unknown job

**Depends on:** FAI-020
**Branch:** `feature/FAI-021-job-status-endpoint`

### FAI-022: Dashboard endpoints

GET /dashboard/summary and /companies/:id/kpis reading Azure SQL.

**Acceptance criteria**
- [ ] Zod-validated responses
- [ ] Documents-processed count included

**Depends on:** FAI-019, FAI-013
**Branch:** `feature/FAI-022-dashboard-endpoints`

### FAI-023: Company comparison endpoint

GET /compare?companies=AAPL,MSFT&metric=revenue returning year-by-year series.

**Acceptance criteria**
- [ ] Supports 2–3 companies
- [ ] Missing years returned as null

**Depends on:** FAI-022
**Branch:** `feature/FAI-023-company-comparison-endpoint`

### FAI-024: RAG retriever

rag/retriever.ts: hybrid (vector + keyword) search with company/year filters, top-k configurable.

**Acceptance criteria**
- [ ] Uses same embedding deployment as Python
- [ ] Returns chunk text + metadata

**Depends on:** FAI-019
**Branch:** `feature/FAI-024-rag-retriever`

### FAI-025: Prompt builder and generation

rag/generate.ts: grounded prompt with numbered sources; answer must cite chunk IDs; refuse when context is insufficient.

**Acceptance criteria**
- [ ] Citations map to page numbers
- [ ] Unit tests with mocked retriever

**Depends on:** FAI-024
**Branch:** `feature/FAI-025-prompt-builder-and-generation`

### FAI-026: Research endpoint with streaming

POST /research streams the answer via SSE, then sends citations.

**Acceptance criteria**
- [ ] Works with curl
- [ ] Client disconnect cancels the OpenAI call

**Depends on:** FAI-025
**Branch:** `feature/FAI-026-research-endpoint-with-streaming`

### FAI-027: API hardening

Central error handler, request IDs, rate limiting, CORS, OpenAPI docs via @fastify/swagger.

**Acceptance criteria**
- [ ] /docs renders
- [ ] Errors return consistent JSON

**Depends on:** FAI-026
**Branch:** `feature/FAI-027-api-hardening`

## Epic 3 — React frontend

### FAI-028: Frontend scaffold

Vite + React + TypeScript, react-router, TanStack Query, app layout and nav.

**Acceptance criteria**
- [ ] Routes for Dashboard, Compare, Research, Upload

**Depends on:** FAI-001
**Branch:** `feature/FAI-028-frontend-scaffold`

### FAI-029: Typed API client

api/ module with typed fetchers and query hooks for every endpoint.

**Acceptance criteria**
- [ ] Base URL from env
- [ ] Shared error handling

**Depends on:** FAI-028, FAI-027
**Branch:** `feature/FAI-029-typed-api-client`

### FAI-030: Dashboard page

KPI cards (revenue, net income, cash flow, debt, documents processed) with company selector.

**Acceptance criteria**
- [ ] Loading and empty states

**Depends on:** FAI-029
**Branch:** `feature/FAI-030-dashboard-page`

### FAI-031: Comparison page

Recharts line charts for revenue and profit trends across selected companies.

**Acceptance criteria**
- [ ] Metric switcher
- [ ] Handles missing years

**Depends on:** FAI-029
**Branch:** `feature/FAI-031-comparison-page`

### FAI-032: Research page

Chat-style UI consuming SSE stream, rendering citations with company/page.

**Acceptance criteria**
- [ ] Stop button cancels stream
- [ ] Example questions shown

**Depends on:** FAI-029
**Branch:** `feature/FAI-032-research-page`

### FAI-033: Upload page

Drag-and-drop PDF upload with job status polling.

**Acceptance criteria**
- [ ] Shows queued / processing / done / failed

**Depends on:** FAI-029
**Branch:** `feature/FAI-033-upload-page`

## Epic 4 — Containers & AKS

### FAI-034: Dockerfiles

Multi-stage Dockerfiles for python-worker (with ODBC Driver 18), node-api, frontend (nginx).

**Acceptance criteria**
- [ ] Images build locally
- [ ] Non-root users

**Depends on:** FAI-015, FAI-027, FAI-033
**Branch:** `feature/FAI-034-dockerfiles`

### FAI-035: Full-stack compose

docker-compose.yml running all three services against Azurite + SQL.

**Acceptance criteria**
- [ ] Upload → dashboard works end to end locally

**Depends on:** FAI-034, FAI-004
**Branch:** `feature/FAI-035-full-stack-compose`

### FAI-036: ACR build pipeline

GitHub Actions building and pushing tagged images to Azure Container Registry.

**Acceptance criteria**
- [ ] Images tagged with git SHA

**Depends on:** FAI-034, FAI-005
**Branch:** `feature/FAI-036-acr-build-pipeline`

### FAI-037: Kubernetes manifests

Deployments, Services, Ingress, ConfigMap; secrets via Key Vault CSI driver; worker scales on queue length (KEDA optional).

**Acceptance criteria**
- [ ] kubectl apply -k works for dev overlay

**Depends on:** FAI-036
**Branch:** `feature/FAI-037-kubernetes-manifests`

### FAI-038: Workload identity

Replace keys with AKS workload identity + managed identity RBAC for OpenAI, Search, SQL, Storage.

**Acceptance criteria**
- [ ] No secrets for Azure services in cluster

**Depends on:** FAI-037
**Branch:** `feature/FAI-038-workload-identity`

### FAI-039: Deploy and validate

Deploy workflow to AKS plus smoke tests: health checks, one ingestion, one research query.

**Acceptance criteria**
- [ ] Pipeline fails on smoke test failure

**Depends on:** FAI-038
**Branch:** `feature/FAI-039-deploy-and-validate`

### FAI-040: Docs and demo

README with architecture diagram, setup steps, design decisions, and a short demo recording.

**Acceptance criteria**
- [ ] A new reader can run it locally from README

**Depends on:** FAI-039
**Branch:** `feature/FAI-040-docs-and-demo`
