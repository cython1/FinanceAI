import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as random from "@pulumi/random";
import * as cs from "@pulumi/azure-native/cognitiveservices";

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

// Outputs used to build .env
export const openAiEndpoint = openAiAccount.properties.endpoint;
export const embeddingDeploymentName = embeddingDeployment.name;
export const chatDeploymentName = chatDeployment.name;
export const documentIntelligenceEndpoint = docIntelAccount.properties.endpoint;
