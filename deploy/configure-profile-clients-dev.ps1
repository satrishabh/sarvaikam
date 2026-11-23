param(
    [string]$ExpectedContext = 'gke_project-d28840cd-be2f-4901-85e_asia-south1_cluster-1',
    [string]$Namespace = 'dev',
    [string]$ProfileUrl = 'https://profile.sarvaikam.com',
    [string]$Realm = 'sarvaikam',
    [string]$TargetSecret = 'sarvaikam-profile-runtime',
    # Sites the Learn web app runs on. Each gets the exact callback https://<site>/api/session/callback/profile.
    [string[]]$WebSites = @('https://learn.sarvaikam.com')
)
$ErrorActionPreference = 'Stop'

# Never print credentials or persist them to disk. Existing clients/secrets are reused.
$context = kubectl config current-context
if ($LASTEXITCODE -ne 0 -or $context -ne $ExpectedContext -or $Namespace -ne 'dev' -or $Realm -ne 'sarvaikam') {
    throw 'The expected development cluster and sarvaikam realm are required.'
}
$raw = kubectl get secret profile-manager-runtime -n $Namespace -o json --request-timeout=20s
if ($LASTEXITCODE -ne 0) { throw 'Unable to read the existing Profile Manager runtime Secret.' }
$runtime = $raw | ConvertFrom-Json
function Decode([string]$value) {
    if (!$value) { throw 'Required Profile Manager administrator configuration is missing.' }
    return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($value))
}
$username = Decode $runtime.data.KC_BOOTSTRAP_ADMIN_USERNAME
$password = Decode $runtime.data.KC_BOOTSTRAP_ADMIN_PASSWORD
try {
    $token = Invoke-RestMethod -Method Post -Uri "$ProfileUrl/realms/master/protocol/openid-connect/token" -ContentType 'application/x-www-form-urlencoded' -Body @{
        client_id = 'admin-cli'; grant_type = 'password'; username = $username; password = $password
    } -TimeoutSec 20
} catch { throw 'Profile Manager admin sign-in failed. No credentials were printed. Check the current operator account.' }
$password = $null; $runtime = $null; $raw = $null
$headers = @{ Authorization = "Bearer $($token.access_token)" }
$base = "$ProfileUrl/admin/realms/$Realm"
function Api([string]$method, [string]$path, $body = $null) {
    $options = @{ Method = $method; Uri = "$base$path"; Headers = $headers; TimeoutSec = 20 }
    if ($null -ne $body) { $options.ContentType = 'application/json'; $options.Body = ConvertTo-Json -InputObject $body -Depth 15 -Compress }
    try {
        $response = Invoke-RestMethod @options
        foreach ($item in $response) { Write-Output $item }
    }
    catch {
        $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'connection failure' }
        throw "Profile Manager request failed: $method $path (status $code). Response body omitted."
    }
}
$definitions = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'profile-manager-clients.example.json') -Raw | ConvertFrom-Json).clients
$clients = @{}
foreach ($definition in $definitions) {
    $id = $definition.clientId
    if ($id -eq 'sarvaikam-learn-web') {
        $definition.redirectUris = @($WebSites | ForEach-Object { "$($_.TrimEnd('/'))/api/session/callback/profile" })
    }
    $found = @(Api 'Get' "/clients?clientId=$id")
    if ($found.Count -eq 0) {
        $null = Api 'Post' '/clients' $definition
        $found = @(Api 'Get' "/clients?clientId=$id")
        Write-Output "Created client: $id"
    } else { Write-Output "Reusing client: $id" }
    if ($found.Count -ne 1) { throw "Expected one client for $id." }
    $client = $found[0]
    if ($client.publicClient -or !$client.enabled -or
        ($id -eq 'sarvaikam-learn-api' -and (!$client.directAccessGrantsEnabled -or $client.serviceAccountsEnabled)) -or
        ($id -eq 'sarvaikam-learn-registration' -and (!$client.serviceAccountsEnabled -or $client.directAccessGrantsEnabled)) -or
        ($id -eq 'sarvaikam-learn-web' -and (!$client.standardFlowEnabled -or $client.implicitFlowEnabled -or $client.directAccessGrantsEnabled))) {
        throw "Existing client $id has incompatible settings. It was not overwritten."
    }
    $clients[$id] = $client
}
# Explicitly ensure the existing standard profile/email/roles scopes are present.
$scopes = @(Api 'Get' '/client-scopes')
foreach ($scopeName in @('profile', 'email', 'roles')) {
    $scope = $scopes | Where-Object name -eq $scopeName | Select-Object -First 1
    if (!$scope) { throw "Required existing client scope is absent: $scopeName" }
    foreach ($client in @('sarvaikam-learn-api', 'sarvaikam-learn-web')) {
        $null = Api 'Put' "/clients/$($clients[$client].id)/default-client-scopes/$($scope.id)"
    }
}
$management = @(Api 'Get' '/clients?clientId=realm-management')[0]
if (!$management) { throw 'Realm management client is missing.' }
$serviceUser = Api 'Get' "/clients/$($clients['sarvaikam-learn-registration'].id)/service-account-user"
$roles = @()
foreach ($roleName in @('manage-users', 'query-users')) { $roles += Api 'Get' "/clients/$($management.id)/roles/$roleName" }
$null = Api 'Post' "/users/$($serviceUser.id)/role-mappings/clients/$($management.id)" $roles
$null = Api 'Post' "/clients/$($clients['sarvaikam-learn-registration'].id)/scope-mappings/clients/$($management.id)" $roles
$roleScope = $scopes | Where-Object name -eq 'roles' | Select-Object -First 1
$null = Api 'Put' "/clients/$($clients['sarvaikam-learn-registration'].id)/default-client-scopes/$($roleScope.id)"
Write-Output 'Registration service-account roles configured in the sarvaikam realm.'

$values = @{
    PROFILE_ISSUER = "$ProfileUrl/realms/$Realm"
    PROFILE_API_CLIENT_ID = 'sarvaikam-learn-api'
    PROFILE_REGISTRATION_CLIENT_ID = 'sarvaikam-learn-registration'
    PROFILE_WEB_CLIENT_ID = 'sarvaikam-learn-web'
}
foreach ($entry in @(
    @{ client = 'sarvaikam-learn-api'; key = 'PROFILE_API_CLIENT_SECRET' },
    @{ client = 'sarvaikam-learn-web'; key = 'PROFILE_WEB_CLIENT_SECRET' },
    @{ client = 'sarvaikam-learn-registration'; key = 'PROFILE_REGISTRATION_CLIENT_SECRET' }
)) {
    $credential = Api 'Get' "/clients/$($clients[$entry.client].id)/client-secret"
    if (!$credential.value) { throw 'A client secret was not returned; no application Secret was written.' }
    $values[$entry.key] = $credential.value
}
$encoded = @{}
foreach ($key in $values.Keys) { $encoded[$key] = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($values[$key])) }
# Patch only our own keys, preserving any other keys if this script is rerun.
$secret = @{ apiVersion = 'v1'; kind = 'Secret'; metadata = @{ name = $TargetSecret; namespace = $Namespace }; type = 'Opaque'; data = $encoded }
$payload = ConvertTo-Json -InputObject $secret -Depth 10 -Compress
$payload | kubectl apply --server-side --field-manager=sarvaikam-profile-setup -f - --request-timeout=20s
if ($LASTEXITCODE -ne 0) { throw 'Failed to store the client configuration in the development Secret.' }
$storedRaw = kubectl get secret $TargetSecret -n $Namespace -o json --request-timeout=20s
if ($LASTEXITCODE -ne 0) { throw 'Unable to verify the development Secret.' }
$stored = $storedRaw | ConvertFrom-Json
foreach ($key in $encoded.Keys) {
    if ($stored.data.$key -cne $encoded[$key]) { throw 'Stored Secret verification failed.' }
}
Write-Output "Verified dev/$TargetSecret with $($encoded.Count) configuration keys. Secret values were not printed."
Write-Output 'With PROFILE_WEB_CLIENT_SECRET present, the AIO image starts the Core and learners sign in on the Keycloak page.'
Write-Output 'Application deployment was not changed or restarted. Attach the Secret with envFrom during your AIO deployment.'
$values = $null; $encoded = $null; $payload = $null; $storedRaw = $null; $stored = $null; $credential = $null; $token = $null; $headers = $null
