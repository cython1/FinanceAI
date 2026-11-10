# infra

Azure infrastructure for the FinanceAI dev environment, written in TypeScript with [Pulumi](https://www.pulumi.com/) (`@pulumi/azure-native`). Tracked in FAI-003.

## What it creates

Everything lives in the resource group `rg-financeai-dev` in **East US 2** (AI Search is the one exception, see below). Globally unique names end in a random 6-character suffix (`random.RandomString`), which stays stable across `pulumi up` runs and changes after `pulumi destroy`, so Azure's soft-deleted names never block a redeploy.

| Resource | Pulumi name | Tier | Cost |
| --- | --- | --- | --- |
| Resource group `rg-financeai-dev` | `resourceGroup` | — | $0 |
| Azure OpenAI account `fai-openai-<suffix>` | `openai` | S0 (pay per token) | $0 when idle |
| Embedding deployment `text-embedding-3-small` (v1) | `embedding` | GlobalStandard, 30K tokens/min | Cents for this project |
| Chat deployment `gpt-5-mini` (2025-08-07) | `chat` | GlobalStandard, 10K tokens/min | Cents to a few dollars |
| Document Intelligence `fai-docintel-<suffix>` | `docIntel` | F0 (500 pages/month free) | $0 |
| AI Search `fai-search-<suffix>` (**Central US**) | `search` | Free (50 MB, 3 indexes) | $0 |
| Storage account `faist<suffix>` | `storage` | StorageV2, Standard LRS; no public blob access, TLS 1.2, HTTPS only | Cents |
| Blob container `raw-pdfs` | `rawPdfs` | Private | — |
| Queue `ingestion-jobs` | `ingestionQueue` | — | — |

Still to add for FAI-003: Azure SQL (free offer) and the script that writes `.env`.

### Region exception
AI Search runs in **Central US**: creating it in East US 2 failed with `InsufficientResourcesAvailable` (no Search capacity in that region). It is overridden with `location` on that resource only. Services reach it through `AZURE_SEARCH_ENDPOINT`, so the region makes no difference to the code; latency within the US is a few milliseconds.

### Model notes
- `gpt-4o-mini` 2024-07-18 can no longer be deployed (`ServiceModelDeprecating`), and this subscription has no quota for `gpt-5.4-mini`, so the chat model is **`gpt-5-mini`**. It retires **2027-07-13**; switch to `gpt-5.4-mini` when quota is available. Services read the deployment name from `AZURE_OPENAI_CHAT_DEPLOYMENT`, so only this file and `.env` change.
- Check a model before using it:
  ```bash
  az cognitiveservices model list --location eastus2 --query "[?model.name=='gpt-5-mini'].{version:model.version, status:model.lifecycleStatus, retires:model.deprecation.inference}" -o table
  ```

## Prerequisites

- Node.js 22, the [Pulumi CLI](https://www.pulumi.com/docs/install/) and the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
- An Azure subscription (the free account's $200 credit covers this)
- Signed in to both:
  ```bash
  az login --tenant <tenant-id>    # completes the MFA prompt Azure requires
  az account set --subscription "<subscription name or id>"
  pulumi login
  ```

## Usage

From `infra/`:

```bash
npm ci
pulumi stack select dev
pulumi preview      # shows the plan, creates nothing
pulumi up           # creates or updates resources; a second run reports no changes
pulumi stack output # endpoints and deployment names
```

## Outputs

| Output | Used for |
| --- | --- |
| `openAiEndpoint` | `AZURE_OPENAI_ENDPOINT` |
| `embeddingDeploymentName` | `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` |
| `chatDeploymentName` | `AZURE_OPENAI_CHAT_DEPLOYMENT` |
| `documentIntelligenceEndpoint` | `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` |
| `searchEndpoint` | `AZURE_SEARCH_ENDPOINT` |
| `storageBlobEndpoint` | `AZURE_STORAGE_BLOB_ENDPOINT` |
| `storageQueueEndpoint` | `AZURE_STORAGE_QUEUE_ENDPOINT` |
| `blobContainerName` | `AZURE_STORAGE_BLOB_CONTAINER` |
| `queueName` | `AZURE_STORAGE_QUEUE_NAME` |
| `storageAccountName` | Reference (keys, portal) |
| `resourceGroupName`, `nameSuffix` | Reference |

## Tear down

```bash
pulumi destroy
```

Deletes everything in the stack. Run it when you stop working on the project for a while; `pulumi up` recreates it in a few minutes.
