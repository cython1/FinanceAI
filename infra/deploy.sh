#!/usr/bin/env bash
# Provision the FinanceAI dev environment in Azure and write the repo-root .env.
#
# Usage (from anywhere in the repo, after `az login`):
#   ./infra/deploy.sh                 # create or update everything
#   ./infra/deploy.sh --what-if       # preview changes, create nothing
#
# Settings (environment variables, all optional):
#   FAI_RESOURCE_GROUP  resource group name          (default: rg-financeai-dev)
#   FAI_LOCATION        Azure region                 (default: eastus2)
#   FAI_USE_KEYS=1      also write API keys to .env  (default: keyless, uses az login)
#
# Safe to re-run: Bicep only changes what differs, and .env keeps your own values.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RG="${FAI_RESOURCE_GROUP:-rg-financeai-dev}"
LOCATION="${FAI_LOCATION:-eastus2}"
USE_KEYS="${FAI_USE_KEYS:-0}"
DEPLOYMENT="financeai-dev"
WHAT_IF=0
[[ "${1:-}" == "--what-if" ]] && WHAT_IF=1

command -v az >/dev/null || { echo "Azure CLI not found. Install it: https://learn.microsoft.com/cli/azure/install-azure-cli"; exit 1; }
command -v python3 >/dev/null || { echo "python3 not found."; exit 1; }
az account show >/dev/null 2>&1 || { echo "Not logged in. Run: az login"; exit 1; }

SUBSCRIPTION="$(az account show --query name -o tsv)"
PRINCIPAL_ID="$(az ad signed-in-user show --query id -o tsv)"
PRINCIPAL_LOGIN="$(az ad signed-in-user show --query userPrincipalName -o tsv)"
CLIENT_IP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true)"

echo "Subscription : $SUBSCRIPTION"
echo "Resource grp : $RG ($LOCATION)"
echo "Your login   : $PRINCIPAL_LOGIN"
echo "Your IP      : ${CLIENT_IP:-<not detected; SQL firewall rule skipped>}"
echo

PARAMS=(
  --resource-group "$RG"
  --name "$DEPLOYMENT"
  --parameters "$HERE/main.bicepparam"
  --parameters location="$LOCATION" principalId="$PRINCIPAL_ID" principalLogin="$PRINCIPAL_LOGIN" clientIpAddress="$CLIENT_IP"
)

az group create --name "$RG" --location "$LOCATION" --tags project=FinanceAI environment=dev --output none

if [[ "$WHAT_IF" == 1 ]]; then
  az deployment group what-if "${PARAMS[@]}"
  exit 0
fi

echo "Deploying (first run takes about 5-10 minutes)..."
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
az deployment group create "${PARAMS[@]}" --query properties.outputs --output json > "$TMP/outputs.json"

KEYS_ARG=()
if [[ "$USE_KEYS" == 1 ]]; then
  echo "Fetching keys (FAI_USE_KEYS=1)..."
  out() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]]["value"])' "$TMP/outputs.json" "$1"; }
  AZURE_OPENAI_API_KEY="$(az cognitiveservices account keys list -g "$RG" -n "$(out openAiName)" --query key1 -o tsv)" \
  AZURE_DOCUMENT_INTELLIGENCE_API_KEY="$(az cognitiveservices account keys list -g "$RG" -n "$(out documentIntelligenceName)" --query key1 -o tsv)" \
  AZURE_SEARCH_API_KEY="$(az search admin-key show -g "$RG" --service-name "$(out searchName)" --query primaryKey -o tsv)" \
  AZURE_STORAGE_CONNECTION_STRING="$(az storage account show-connection-string -g "$RG" -n "$(out storageAccountName)" --query connectionString -o tsv)" \
  python3 -c 'import json,os,sys; json.dump({k: os.environ[k] for k in ("AZURE_OPENAI_API_KEY","AZURE_DOCUMENT_INTELLIGENCE_API_KEY","AZURE_SEARCH_API_KEY","AZURE_STORAGE_CONNECTION_STRING")}, open(sys.argv[1], "w"))' "$TMP/keys.json"
  KEYS_ARG=(--keys "$TMP/keys.json")
fi

python3 "$HERE/scripts/write_env.py" --outputs "$TMP/outputs.json" ${KEYS_ARG[@]+"${KEYS_ARG[@]}"}

echo
echo "Done. Resources are in resource group '$RG'."
echo "Next: check .env at the repo root (never commit it). Tear down with ./infra/destroy.sh"
