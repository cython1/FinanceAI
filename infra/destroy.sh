#!/usr/bin/env bash
# Delete the FinanceAI dev environment so it stops costing money.
#
# Usage:  ./infra/destroy.sh            (asks for confirmation)
#         ./infra/destroy.sh --yes
#
# Also purges the soft-deleted Azure OpenAI, Document Intelligence and Key Vault
# resources. Azure keeps those for days after deletion, and their names would
# block the next ./infra/deploy.sh into the same resource group.
#
# Your .env is left in place; its endpoints will stop working.
set -euo pipefail

RG="${FAI_RESOURCE_GROUP:-rg-financeai-dev}"

command -v az >/dev/null || { echo "Azure CLI not found."; exit 1; }
az account show >/dev/null 2>&1 || { echo "Not logged in. Run: az login"; exit 1; }

if [[ "$(az group exists --name "$RG")" != "true" ]]; then
  echo "Resource group '$RG' does not exist. Nothing to delete."
  exit 0
fi

echo "This deletes EVERYTHING in resource group '$RG':"
az resource list --resource-group "$RG" --query "[].{name:name, type:type}" --output table
if [[ "${1:-}" != "--yes" ]]; then
  read -r -p "Type the resource group name to confirm: " answer
  [[ "$answer" == "$RG" ]] || { echo "Cancelled."; exit 1; }
fi

LOCATION="$(az group show --name "$RG" --query location -o tsv)"
COGNITIVE="$(az cognitiveservices account list --resource-group "$RG" --query "[].name" -o tsv)"
VAULTS="$(az keyvault list --resource-group "$RG" --query "[].name" -o tsv)"

echo "Deleting resource group (takes a few minutes)..."
az group delete --name "$RG" --yes

for name in $COGNITIVE; do
  echo "Purging soft-deleted Cognitive Services account $name"
  az cognitiveservices account purge --name "$name" --resource-group "$RG" --location "$LOCATION" || true
done
for name in $VAULTS; do
  echo "Purging soft-deleted Key Vault $name"
  az keyvault purge --name "$name" --location "$LOCATION" || true
done

echo "Done. '$RG' is gone and no longer billed."
