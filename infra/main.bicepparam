// Defaults for the dev environment. principalId, principalLogin and
// clientIpAddress are filled in by deploy.sh from your az login.
using 'main.bicep'

param prefix = 'fai'

// OpenAI models. Check availability and quota in your region first:
//   az cognitiveservices model list --location <region> -o table
param embeddingModelName = 'text-embedding-3-small'
param embeddingModelVersion = '1'
param chatModelName = 'gpt-4o-mini'
param chatModelVersion = '2024-07-18'

// Cheapest tiers. Switch searchSku to 'basic' (~$74/month) only if the free
// tier's 50 MB runs out; F0 Document Intelligence covers 500 pages/month.
param searchSku = 'free'
param documentIntelligenceSku = 'F0'
param useSqlFreeLimit = true

// Placeholders; deploy.sh overrides these.
param principalId = ''
param principalLogin = ''
param clientIpAddress = ''
