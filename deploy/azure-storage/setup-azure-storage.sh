#!/usr/bin/env bash
# Azure Blob storage for Sarvaikam content (lesson bodies, practice, reels, attachments).
#
# Run in Azure Cloud Shell (Bash) as an account with Owner or Contributor + User Access Administrator on the
# resource group. Review every line first. Each step is idempotent where Azure allows it.
#
#   bash setup-azure-storage.sh
#
# Nothing here reads or prints secret values. The container uses no account key: the Learn pod authenticates
# with its workload identity and downloads/uploads use short-lived user-delegation SAS URLs.
set -euo pipefail

# ----- settings: change these before running -----
RG=creative
LOC=southindia
CLUSTER=creative
ACCT=${ACCT:-sarvaikamcontent$(printf '%04d' "$RANDOM")}  # must be globally unique, 3-24 lowercase letters/digits
CONTAINER=content
IDENTITY=sarvaikam-learn-storage         # user-assigned managed identity used by the Learn pod
K8S_NAMESPACE=dev
# Dedicated service account for the Learn pod. The Learn deployment currently runs as "default" (checked
# 14 Nov 2026), which must not be federated. Create it before step 5:
#   kubectl -n dev create serviceaccount sarvaikam-learn
# and point the Learn deployment at it (serviceAccountName: sarvaikam-learn).
K8S_SERVICE_ACCOUNT=${K8S_SERVICE_ACCOUNT:-sarvaikam-learn}
CORS_ORIGINS=("https://learn.sarvaikam.com")

echo "Storage account: $ACCT (resource group $RG, $LOC)"
echo "Press Enter to continue or Ctrl+C to stop."; read -r _

# 1. Storage account: private, TLS 1.2, no account keys, no public blob access.
az storage account create -g "$RG" -n "$ACCT" -l "$LOC" \
  --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 \
  --allow-blob-public-access false --allow-shared-key-access false \
  --https-only true

# Keep deleted blobs for 14 days, so an accidental delete is recoverable.
az storage account blob-service-properties update -g "$RG" -n "$ACCT" \
  --enable-delete-retention true --delete-retention-days 14

# 2. Private container. --auth-mode login uses your Azure login, not a key.
az storage container create --account-name "$ACCT" --name "$CONTAINER" --auth-mode login

# 3. Browser access: uploads (PUT) and downloads (GET) from the Learn site only.
az storage cors add --services b --account-name "$ACCT" \
  --methods GET PUT --origins "${CORS_ORIGINS[@]}" \
  --allowed-headers '*' --exposed-headers '*' --max-age 3600

# 4. Identity for the Learn pod, with the two roles it needs.
az identity create -g "$RG" -n "$IDENTITY" -l "$LOC" >/dev/null
PRINCIPAL=$(az identity show -g "$RG" -n "$IDENTITY" --query principalId -o tsv)
SCOPE=$(az storage account show -g "$RG" -n "$ACCT" --query id -o tsv)
# Read and write blobs.
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" --scope "$SCOPE"
# Needed to sign user-delegation SAS URLs for browser uploads and downloads.
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Delegator" --scope "$SCOPE"

# 5. Link the Kubernetes service account to the identity (workload identity).
#    Check first that the cluster has the OIDC issuer and workload identity enabled.
OIDC=$(az aks show -g "$RG" -n "$CLUSTER" --query oidcIssuerProfile.issuerUrl -o tsv)
WI=$(az aks show -g "$RG" -n "$CLUSTER" --query securityProfile.workloadIdentity.enabled -o tsv)
if [ "$WI" != "true" ] || [ -z "$OIDC" ]; then
  echo "Workload identity is not enabled on $CLUSTER. Enable it (az aks update --enable-oidc-issuer --enable-workload-identity) and re-run step 5." >&2
  exit 1
fi
az identity federated-credential create -g "$RG" --identity-name "$IDENTITY" \
  --name learn-sarvaikam --issuer "$OIDC" \
  --subject "system:serviceaccount:${K8S_NAMESPACE}:${K8S_SERVICE_ACCOUNT}" \
  --audience api://AzureADTokenExchange

CLIENT_ID=$(az identity show -g "$RG" -n "$IDENTITY" --query clientId -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

cat <<EOF

Done. Record these values (they are not secrets) and set them in the Learn Helm values:

  STORAGE_BACKEND: azure-blob
  AZURE_STORAGE_ACCOUNT: $ACCT
  AZURE_STORAGE_CONTAINER: $CONTAINER

The Learn service account needs this annotation, and the pod needs this label:
  serviceAccount annotation  azure.workload.identity/client-id: $CLIENT_ID
  pod label                  azure.workload.identity/use: "true"
  (tenant: $TENANT_ID)

Verify the chain before switching traffic: upload one test blob with the new identity, read it back, then delete it.
EOF
