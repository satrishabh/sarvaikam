param()
$ErrorActionPreference = 'Stop'
$project = 'project-d28840cd-be2f-4901-85e'
$expectedContext = "gke_${project}_asia-south1_cluster-1"
$account = "sarvaikam-content@${project}.iam.gserviceaccount.com"
$env:CLOUDSDK_PYTHON = 'D:\gcloud\google-cloud-sdk\platform\bundledpython\python.exe'
$env:CLOUDSDK_CORE_DISABLE_PROMPTS = '1'
$gcloud = 'D:\gcloud\google-cloud-sdk\bin\gcloud.cmd'
function Cloud([string[]]$arguments) {
    & $gcloud @arguments --project=$project --quiet
    if ($LASTEXITCODE -ne 0) { throw "Cloud command failed: $($arguments[0..1] -join ' ')" }
}
$context = kubectl config current-context
if ($LASTEXITCODE -ne 0 -or $context -ne $expectedContext) { throw 'Expected development cluster required.' }
$bucket = Cloud @('storage', 'buckets', 'describe', 'gs://cotent_bucket', '--format=json') | ConvertFrom-Json
if ($bucket.name -ne 'cotent_bucket' -or !$bucket.uniform_bucket_level_access -or $bucket.public_access_prevention -ne 'enforced') {
    throw 'Expected private bucket with uniform access and public access prevention.'
}
$pool = Cloud @('container', 'clusters', 'describe', 'cluster-1', '--region=asia-south1', '--format=value(workloadIdentityConfig.workloadPool)')
if ($pool -ne "${project}.svc.id.goog") { throw 'Expected Workload Identity pool required.' }
$accounts = @(Cloud @('iam', 'service-accounts', 'list', '--format=value(email)'))
if ($accounts -notcontains $account) {
    Cloud @('iam', 'service-accounts', 'create', 'sarvaikam-content', '--display-name=Sarvaikam private lesson resources')
}
Cloud @('services', 'enable', 'iamcredentials.googleapis.com', 'storage.googleapis.com')
Cloud @('storage', 'buckets', 'add-iam-policy-binding', 'gs://cotent_bucket', "--member=serviceAccount:$account", '--role=roles/storage.objectUser', '--format=none')
Cloud @('iam', 'service-accounts', 'add-iam-policy-binding', $account, "--member=serviceAccount:$account", '--role=roles/iam.serviceAccountTokenCreator', '--format=none')
Cloud @('iam', 'service-accounts', 'add-iam-policy-binding', $account, "--member=serviceAccount:${project}.svc.id.goog[dev/sarvaikam-content]", '--role=roles/iam.workloadIdentityUser', '--format=none')
Cloud @('storage', 'buckets', 'update', 'gs://cotent_bucket', "--cors-file=$(Join-Path $PSScriptRoot 'content-storage-cors.json')")
$serviceAccount = @{
    apiVersion = 'v1'; kind = 'ServiceAccount'
    metadata = @{ name = 'sarvaikam-content'; namespace = 'dev'; annotations = @{ 'iam.gke.io/gcp-service-account' = $account } }
} | ConvertTo-Json -Depth 6
$serviceAccount | kubectl apply -f - --request-timeout=20s
if ($LASTEXITCODE -ne 0) { throw 'Unable to apply Kubernetes storage identity.' }

# Set Helm overrides on the existing Argo CD Application so self-healing preserves
# the storage connection. Preserve every unrelated parameter and all secret refs.
$application = kubectl get application sarvaikam-dev -n argocd -o json --request-timeout=20s | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $application.spec.source.repoURL -ne 'https://github.com/satrishabh/aio-gitops.git') {
    throw 'Unexpected Argo CD application.'
}
$desired = [ordered]@{
    'serviceAccountName' = 'sarvaikam-content'
    'env[0].name' = 'GCP_CONTENT_BUCKET'
    'env[0].value' = 'cotent_bucket'
    'env[1].name' = 'GCP_SIGNING_SERVICE_ACCOUNT'
    'env[1].value' = $account
}
# Current env must be empty or already contain these exact storage entries.
$deployment = kubectl get deployment sarvaikam -n dev -o json --request-timeout=20s | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect current deployment.' }
$app = @($deployment.spec.template.spec.containers | Where-Object name -eq 'app')
if ($app.Count -ne 1) { throw 'Expected one app container.' }
foreach ($entry in @($app[0].env)) {
    if ($null -ne $entry -and $entry.name -notin @('GCP_CONTENT_BUCKET', 'GCP_SIGNING_SERVICE_ACCOUNT')) {
        throw 'Existing non-storage env requires a merge review before indexed Helm overrides.'
    }
}
$parameters = @($application.spec.source.helm.parameters | Where-Object { $null -ne $_ -and !$desired.Contains($_.name) })
foreach ($name in $desired.Keys) { $parameters += @{ name = $name; value = $desired[$name]; forceString = $true } }
$patch = @{ spec = @{ source = @{ helm = @{ parameters = $parameters } } } } | ConvertTo-Json -Depth 10
$patchPath = Join-Path $PSScriptRoot 'content-storage-argocd-dev.patch.json'
[IO.File]::WriteAllText($patchPath, $patch, [Text.UTF8Encoding]::new($false))
kubectl patch application sarvaikam-dev -n argocd --type=merge --patch-file=$patchPath --request-timeout=20s
if ($LASTEXITCODE -ne 0) { throw 'Unable to update Argo CD storage settings.' }
Write-Output 'Storage configured. Argo CD will reconcile the app; verify rollout and a signed upload next.'
