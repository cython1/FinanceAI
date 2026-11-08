// FinanceAI dev environment (FAI-003).
//
// Creates every Azure resource the services need and gives the deploying user
// RBAC access to each one, so local development can run keyless with
// DefaultAzureCredential (az login). Deploy with infra/deploy.sh.
//
// Idempotent: re-deploying with the same parameters changes nothing.

targetScope = 'resourceGroup'

@description('Azure region for all resources. Must offer the OpenAI models below.')
param location string = resourceGroup().location

@minLength(2)
@maxLength(8)
@description('Short lowercase prefix used in resource names, e.g. "fai".')
param prefix string = 'fai'

@description('Object ID of the user who gets data access to every resource (az ad signed-in-user show --query id).')
param principalId string

@description('Login name (UPN) of that user. Becomes the Entra admin of the SQL server.')
param principalLogin string

@description('Your public IP address, allowed through the SQL server firewall. Empty = no client rule.')
param clientIpAddress string = ''

@description('Embedding model. Must match AZURE_OPENAI_EMBEDDING_DIMENSIONS (text-embedding-3-small = 1536, text-embedding-3-large = 3072).')
param embeddingModelName string = 'text-embedding-3-small'
param embeddingModelVersion string = '1'
@description('Embedding throughput in thousands of tokens per minute.')
param embeddingCapacity int = 30

@description('Chat model used for KPI extraction and RAG answers.')
param chatModelName string = 'gpt-4o-mini'
param chatModelVersion string = '2024-07-18'
@description('Chat throughput in thousands of tokens per minute.')
param chatCapacity int = 30

@allowed(['free', 'basic'])
@description('AI Search tier. "free" is $0 (50 MB, one per subscription); "basic" is about $74/month.')
param searchSku string = 'free'

@allowed(['F0', 'S0'])
@description('Document Intelligence tier. F0 is free (500 pages/month, one per subscription).')
param documentIntelligenceSku string = 'F0'

@description('Use the Azure SQL Database free offer (serverless, auto-pauses when the monthly free limit is used).')
param useSqlFreeLimit bool = true

param blobContainerName string = 'raw-pdfs'
param queueName string = 'ingestion-jobs'
param sqlDatabaseName string = 'financeai'

var suffix = take(uniqueString(resourceGroup().id), 6)
var names = {
  openai: '${prefix}-openai-${suffix}'
  docIntel: '${prefix}-docintel-${suffix}'
  search: '${prefix}-search-${suffix}'
  storage: toLower('${prefix}st${suffix}')
  sql: '${prefix}-sql-${suffix}'
  keyVault: '${prefix}-kv-${suffix}'
}
var tags = {
  project: 'FinanceAI'
  environment: 'dev'
}

// Built-in role definition IDs.
var roles = {
  openAiUser: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
  cognitiveServicesUser: 'a97b65f3-24c7-4388-baec-2e87135dc908'
  searchIndexDataContributor: '8ebe5a00-799e-43f5-93ac-243d3dce84a7'
  searchServiceContributor: '7ca78c08-252a-4471-8644-bb5ff32d4ba0'
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  storageQueueDataContributor: '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
  keyVaultSecretsOfficer: 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
}

// ---------------------------------------------------------------------------
// Azure OpenAI
// ---------------------------------------------------------------------------
resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: names.openai
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: names.openai
    publicNetworkAccess: 'Enabled'
  }
}

resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: embeddingModelName
  sku: {
    name: 'GlobalStandard'
    capacity: embeddingCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: embeddingModelName
      version: embeddingModelVersion
    }
  }
}

// Deployments on one account must be created one at a time.
resource chatDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openai
  name: chatModelName
  sku: {
    name: 'GlobalStandard'
    capacity: chatCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: chatModelName
      version: chatModelVersion
    }
  }
  dependsOn: [
    embeddingDeployment
  ]
}

// ---------------------------------------------------------------------------
// Azure AI Document Intelligence
// ---------------------------------------------------------------------------
resource docIntel 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: names.docIntel
  location: location
  tags: tags
  kind: 'FormRecognizer'
  sku: {
    name: documentIntelligenceSku
  }
  properties: {
    customSubDomainName: names.docIntel
    publicNetworkAccess: 'Enabled'
  }
}

// ---------------------------------------------------------------------------
// Azure AI Search (keys and Entra ID both accepted)
// ---------------------------------------------------------------------------
resource search 'Microsoft.Search/searchServices@2023-11-01' = {
  name: names.search
  location: location
  tags: tags
  sku: {
    name: searchSku
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    publicNetworkAccess: 'enabled'
    authOptions: {
      aadOrApiKey: {
        aadAuthFailureMode: 'http401WithBearerChallenge'
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Storage: blob container for PDFs + ingestion queue
// ---------------------------------------------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: names.storage
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: blobContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource queue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: queueName
}

// ---------------------------------------------------------------------------
// Azure SQL: Entra-only login, serverless database
// ---------------------------------------------------------------------------
resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: names.sql
  location: location
  tags: tags
  properties: {
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      azureADOnlyAuthentication: true
      login: principalLogin
      sid: principalId
      tenantId: subscription().tenantId
      principalType: 'User'
    }
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  tags: tags
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
    useFreeLimit: useSqlFreeLimit
    freeLimitExhaustionBehavior: useSqlFreeLimit ? 'AutoPause' : null
  }
}

// Lets Azure-hosted services (later: the containers) reach the server.
resource sqlAllowAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlAllowClient 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = if (!empty(clientIpAddress)) {
  parent: sqlServer
  name: 'AllowDeveloperIp'
  properties: {
    startIpAddress: clientIpAddress
    endIpAddress: clientIpAddress
  }
}

// ---------------------------------------------------------------------------
// Key Vault (RBAC mode), for secrets the containers will need later
// ---------------------------------------------------------------------------
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: names.keyVault
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

// ---------------------------------------------------------------------------
// Role assignments for the developer
// ---------------------------------------------------------------------------
resource raOpenAi 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: openai
  name: guid(openai.id, principalId, roles.openAiUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.openAiUser)
    principalId: principalId
    principalType: 'User'
  }
}

resource raDocIntel 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: docIntel
  name: guid(docIntel.id, principalId, roles.cognitiveServicesUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.cognitiveServicesUser)
    principalId: principalId
    principalType: 'User'
  }
}

resource raSearchData 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: search
  name: guid(search.id, principalId, roles.searchIndexDataContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.searchIndexDataContributor)
    principalId: principalId
    principalType: 'User'
  }
}

resource raSearchService 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: search
  name: guid(search.id, principalId, roles.searchServiceContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.searchServiceContributor)
    principalId: principalId
    principalType: 'User'
  }
}

resource raBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, principalId, roles.storageBlobDataContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageBlobDataContributor)
    principalId: principalId
    principalType: 'User'
  }
}

resource raQueue 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, principalId, roles.storageQueueDataContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.storageQueueDataContributor)
    principalId: principalId
    principalType: 'User'
  }
}

resource raKeyVault 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: keyVault
  name: guid(keyVault.id, principalId, roles.keyVaultSecretsOfficer)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsOfficer)
    principalId: principalId
    principalType: 'User'
  }
}

// ---------------------------------------------------------------------------
// Outputs: names and endpoints only, never keys
// ---------------------------------------------------------------------------
output openAiName string = openai.name
output openAiEndpoint string = openai.properties.endpoint
output embeddingDeploymentName string = embeddingDeployment.name
output chatDeploymentName string = chatDeployment.name
output documentIntelligenceName string = docIntel.name
output documentIntelligenceEndpoint string = docIntel.properties.endpoint
output searchName string = search.name
output searchEndpoint string = 'https://${search.name}.search.windows.net'
output storageAccountName string = storage.name
output storageBlobEndpoint string = storage.properties.primaryEndpoints.blob
output storageQueueEndpoint string = storage.properties.primaryEndpoints.queue
output blobContainerName string = blobContainer.name
output queueName string = queue.name
output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDatabase.name
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
