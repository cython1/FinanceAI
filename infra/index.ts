import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as random from "@pulumi/random";
import * as cs from "@pulumi/azure-native/cognitiveservices";
import * as storage from "@pulumi/azure-native/storage";
import * as search from "@pulumi/azure-native/search";
import * as sql from "@pulumi/azure-native/sql";

const tags = { project: "FinanceAI", environment: "dev" };

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
  location: "centralus", // eastus2 had no Search capacity (InsufficientResourcesAvailable)
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

const config = new pulumi.Config();
const sqlAdminLogin = config.get("sqlAdminLogin") ?? "faiadmin";
const sqlAdminPassword = config.requireSecret("sqlAdminPassword");
const clientIp = config.get("clientIp");

const sqlServer = new sql.Server("server", {
  administratorLogin: sqlAdminLogin,
  administratorLoginPassword: sqlAdminPassword,
  serverName: pulumi.interpolate`fai-sql-${suffix.result}`,
  resourceGroupName: resourceGroup.name,
  location: "centralus",
});
const database = new sql.Database("app-db", {
  resourceGroupName: resourceGroup.name,
  serverName: sqlServer.name,
  location: "centralus",
  sku: {
    name: "GP_S_Gen5",
    tier: "GeneralPurpose",
    family: "Gen5",
    capacity: 2,
  },
  autoPauseDelay: 60,
  minCapacity: 0.5,
  useFreeLimit: true,
  freeLimitExhaustionBehavior: "AutoPause",
});

// 4. Optional: Allow Azure services to access the server
new sql.FirewallRule("allowAzureServices", {
  resourceGroupName: resourceGroup.name,
  serverName: sqlServer.name,
  firewallRuleName: "AllowAzureServices",
  startIpAddress: "0.0.0.0",
  endIpAddress: "0.0.0.0",
});

if (clientIp) {
  new sql.FirewallRule("allowDeveloperIp", {
    resourceGroupName: resourceGroup.name,
    serverName: sqlServer.name,
    firewallRuleName: "AllowDeveloperIp",
    startIpAddress: clientIp,
    endIpAddress: clientIp,
  });
}

// Export the server's fully qualified domain name
export const sqlServerName = sqlServer.fullyQualifiedDomainName;
export const databaseName = database.name;
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
