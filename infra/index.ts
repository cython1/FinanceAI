import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as random from "@pulumi/random";
import * as cs from "@pulumi/azure-native/cognitiveservices";
import * as storage from "@pulumi/azure-native/storage";
import * as search from "@pulumi/azure-native/search";
import * as sql from "@pulumi/azure-native/sql";

const tags = { project: "FinanceAI", environment: "dev" };
const config = new pulumi.Config();
const sqlAdminLogin = config.get("sqlAdminLogin") ?? "faiadmin";
const sqlAdminPassword = config.requireSecret("sqlAdminPassword");
//const clientIp = pulumi.output(config.getSecret("clientIp") ?? "0.0.0.0");
const sqlLocation = config.get("sqlLocation") ?? "centralus";
// Random suffix: keeps globally unique names stable; a new one after destroy avoids soft-delete name conflicts
const suffix = new random.RandomString("suffix", {
  length: 6,
  special: false,
  upper: false,
});
export const nameSuffix = suffix.result;

// Resource group
const resourceGroup = new resources.ResourceGroup("resourceGroup", {
  resourceGroupName: "rg-financeai-dev",
  tags,
});
export const resourceGroupName = resourceGroup.name;

// Azure OpenAI account
const openAiName = pulumi.interpolate`fai-openai-${suffix.result}`;

const openAiAccount = new cs.Account("openai", {
  resourceGroupName: resourceGroup.name,
  accountName: openAiName,
  kind: "OpenAI",
  sku: { name: "S0" },
  properties: {
    customSubDomainName: openAiName,
    publicNetworkAccess: "Enabled",
  },
  tags,
});

// Embedding deployment: turns report chunks and questions into vectors
const embeddingDeployment = new cs.Deployment("embedding", {
  resourceGroupName: resourceGroup.name,
  accountName: openAiAccount.name, // output of the account, so Pulumi creates the account first
  deploymentName: "text-embedding-3-small",
  sku: { name: "GlobalStandard", capacity: 30 },
  properties: {
    model: { format: "OpenAI", name: "text-embedding-3-small", version: "1" },
  },
});

// Chat deployment: KPI extraction and RAG answers
const chatDeployment = new cs.Deployment(
  "chat",
  {
    resourceGroupName: resourceGroup.name,
    accountName: openAiAccount.name,
    deploymentName: "gpt-5-mini",
    sku: { name: "GlobalStandard", capacity: 10 }, // thousands of tokens/min; gpt-5-mini quota here is 500
    properties: {
      model: { format: "OpenAI", name: "gpt-5-mini", version: "2025-08-07" },
    },
  },
  { dependsOn: [embeddingDeployment] }, // Azure rejects parallel deployments on one account
);

// Document Intelligence: parses annual-report PDFs (FAI-008)
const docIntelName = pulumi.interpolate`fai-docintel-${suffix.result}`;

const docIntelAccount = new cs.Account("docIntel", {
  resourceGroupName: resourceGroup.name,
  accountName: docIntelName,
  kind: "FormRecognizer",
  sku: { name: "F0" }, // free: 500 pages/month, one per subscription
  properties: {
    customSubDomainName: docIntelName,
    publicNetworkAccess: "Enabled",
  },
  tags,
});

// AI Search: vector + keyword index for report chunks
const searchName = pulumi.interpolate`fai-search-${suffix.result}`;

const searchService = new search.Service("search", {
  resourceGroupName: resourceGroup.name,
  searchServiceName: searchName,
  location: sqlLocation, // eastus2 had no Search capacity (InsufficientResourcesAvailable)
  sku: { name: "free" },
  replicaCount: 1,
  partitionCount: 1,
  tags,
});

// Storage: raw PDFs (blob) + ingestion jobs (queue)
const storageAccount = new storage.StorageAccount("storage", {
  resourceGroupName: resourceGroup.name,
  accountName: pulumi.interpolate`faist${suffix.result}`, // 3-24 lowercase letters/digits, no hyphens
  kind: "StorageV2",
  sku: { name: "Standard_LRS" },
  allowBlobPublicAccess: false,
  minimumTlsVersion: "TLS1_2",
  enableHttpsTrafficOnly: true,
  tags,
});

const rawPdfsContainer = new storage.BlobContainer("rawPdfs", {
  resourceGroupName: resourceGroup.name,
  accountName: storageAccount.name, // output, so the container waits for the account
  containerName: "raw-pdfs",
  publicAccess: "None",
});

const ingestionQueue = new storage.Queue("ingestionQueue", {
  resourceGroupName: resourceGroup.name,
  accountName: storageAccount.name,
  queueName: "ingestion-jobs",
});



// Azure SQL logical server (decision 0001)
const sqlServer = new sql.Server(
  "sqlServer",
  {
    resourceGroupName: resourceGroup.name,
    serverName: pulumi.interpolate`fai-sql-${suffix.result}`,
    location: sqlLocation,
    administratorLogin: sqlAdminLogin,
    administratorLoginPassword: sqlAdminPassword,
    version: "12.0",
    minimalTlsVersion: "1.2",
    publicNetworkAccess: "Enabled", // dev only; production uses a private endpoint
    tags,
  },
  { aliases: [{ name: "server" }] }, // keeps the already-created server if you ran `up` with the old name
);

// Serverless database on the free offer: pauses when idle or when the monthly free limit is used
const sqlDatabase = new sql.Database(
  "sqlDatabase",
  {
    resourceGroupName: resourceGroup.name,
    serverName: sqlServer.name,
    databaseName: "financeai",
    location: sqlLocation,
    sku: { name: "GP_S_Gen5", tier: "GeneralPurpose", family: "Gen5", capacity: 2 },
    maxSizeBytes: 34359738368, // 32 GB, the free offer's storage limit
    autoPauseDelay: 60, // minutes
    minCapacity: 0.5,
    useFreeLimit: true, // one or few free databases per subscription
    freeLimitExhaustionBehavior: "AutoPause", // never bills; pauses until next month
    tags,
  },
    { aliases: [{ name: "app-db" }], deleteBeforeReplace: true },
);

// Allows any Azure-hosted resource (any tenant) through the firewall, needed by the deployed
// containers in Phase 2. Acceptable for dev; production replaces this with a private endpoint.
new sql.FirewallRule("allowAzureServices", {
  resourceGroupName: resourceGroup.name,
  serverName: sqlServer.name,
  firewallRuleName: "AllowAzureServices",
  startIpAddress: "0.0.0.0",
  endIpAddress: "0.0.0.0",
  
});

// Export the server's fully qualified domain name
export const sqlServerName = sqlServer.fullyQualifiedDomainName;
export const databaseName = sqlDatabase.name;
// Outputs used to build .env
export const openAiEndpoint = openAiAccount.properties.endpoint;
export const embeddingDeploymentName = embeddingDeployment.name;
export const chatDeploymentName = chatDeployment.name;
export const documentIntelligenceEndpoint = docIntelAccount.properties.endpoint;
export const searchEndpoint = pulumi.interpolate`https://${searchService.name}.search.windows.net`;
export const storageAccountName = storageAccount.name;
export const storageBlobEndpoint = storageAccount.primaryEndpoints.blob;
export const storageQueueEndpoint = storageAccount.primaryEndpoints.queue;
export const blobContainerName = rawPdfsContainer.name;
export const queueName = ingestionQueue.name;
