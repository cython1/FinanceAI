# infra

Azure provisioning for the FinanceAI dev environment (FAI-003). One command creates every resource the services need, gives your Azure account access to each one, and writes the repo-root `.env`.

| File | What it does |
| --- | --- |
| [`main.bicep`](main.bicep) | All resources, role assignments and outputs (names and endpoints only, never keys) |
| [`main.bicepparam`](main.bicepparam) | Defaults: name prefix, OpenAI models, free tiers |
| [`deploy.sh`](deploy.sh) | Creates or updates everything, then writes `.env` |
| [`destroy.sh`](destroy.sh) | Deletes everything and purges soft-deleted resources |
| [`scripts/write_env.py`](scripts/write_env.py) | Fills `.env` from `shared/.env.example` and the deployment outputs |

## What gets created

Everything lands in one resource group, `rg-financeai-dev` by default.

| Resource | Tier | Approx. cost |
| --- | --- | --- |
| Azure OpenAI + 2 deployments (`text-embedding-3-small`, `gpt-4o-mini`) | Standard, pay per token | Cents for this project |
| Azure AI Document Intelligence | F0 (500 pages/month) | $0 |
| Azure AI Search | Free (50 MB, 3 indexes) | $0 |
| Storage account + `raw-pdfs` container + `ingestion-jobs` queue | Standard LRS | Cents |
| Azure SQL server (Entra ID login only) + serverless database | Free offer, auto-pauses at the monthly limit | $0 |
| Key Vault (RBAC mode) | Standard | Cents |

Your account gets these roles, so services run keyless with `az login`:
OpenAI User, Cognitive Services User (Document Intelligence), Search Index Data Contributor, Search Service Contributor, Storage Blob Data Contributor, Storage Queue Data Contributor, Key Vault Secrets Officer, and Entra admin of the SQL server.

Free tiers allow **one** Free AI Search service and **one** F0 Document Intelligence resource per subscription. If you already have one, set `searchSku = 'basic'` (about $74/month) or `documentIntelligenceSku = 'S0'` in `main.bicepparam`.

## Prerequisites

- An Azure subscription where you are **Owner**, or **Contributor** + **User Access Administrator** (the template assigns roles).
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) 2.60 or newer, logged in:
  ```bash
  az login
  az account set --subscription "<subscription name or id>"
  az bicep install
  ```
- Resource providers registered (once per subscription):
  ```bash
  for p in Microsoft.CognitiveServices Microsoft.Search Microsoft.Sql Microsoft.Storage Microsoft.KeyVault; do az provider register -n "$p"; done
  ```
- The OpenAI models available in your region, with quota:
  ```bash
  az cognitiveservices model list --location eastus2 -o table | grep -E "text-embedding-3-small|gpt-4o-mini"
  az cognitiveservices usage list --location eastus2 -o table
  ```
- A **budget alert** (Cost Management → Budgets), for example $20/month.

## Deploy

From the repo root:

```bash
./infra/deploy.sh --what-if     # preview: shows what would be created, changes nothing
./infra/deploy.sh               # create or update (first run: about 5-10 minutes)
```

Optional settings:

| Variable | Default | Meaning |
| --- | --- | --- |
| `FAI_RESOURCE_GROUP` | `rg-financeai-dev` | Resource group name |
| `FAI_LOCATION` | `eastus2` | Region; must offer the OpenAI models |
| `FAI_USE_KEYS` | `0` | `1` also writes API keys and the storage connection string to `.env` |

Re-running is safe: Bicep changes only what differs, and `.env` keeps values you set yourself.

### What `.env` gets

Endpoints, deployment names, the embedding vector size (`AZURE_OPENAI_EMBEDDING_DIMENSIONS`), container, queue and SQL names, plus local-dev defaults for `CORS_ORIGIN`, `UPLOAD_MAX_BYTES`, `VITE_API_BASE_URL` and `AZURE_SEARCH_INDEX_NAME`. Keys stay empty unless `FAI_USE_KEYS=1`; empty keys mean the services use `DefaultAzureCredential`. `.env` is in `.gitignore`; never commit it.

### Check it worked

```bash
az resource list -g rg-financeai-dev -o table
az storage queue list --account-name <storage account> --auth-mode login -o table
az sql db show -g rg-financeai-dev -s <sql server> -n financeai --query status
```

Role assignments can take a few minutes to apply. If a data call returns 403 right after deploying, wait and retry.

## Destroy

```bash
./infra/destroy.sh
```

Deletes the resource group, then purges the soft-deleted OpenAI, Document Intelligence and Key Vault resources so the next deploy can reuse their names. Run it whenever you stop working on the project for a while.
