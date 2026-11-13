<#
  One-time Google Drive authorization for STORAGE_BACKEND=drive.

  Signs in as the Drive owner (personal Gmail) in the browser, requests only the drive.file scope
  (the app can see just the files it creates), and stores client id/secret + refresh token in a
  Kubernetes secret. Tokens are never printed.

  Prerequisites (Google Cloud console, project that owns the OAuth client):
    1. APIs & Services > Library: enable "Google Drive API".
    2. OAuth consent screen: External, add your Gmail as a test user, then PUBLISH the app
       ("In production"). In "Testing" mode Google expires refresh tokens after 7 days.
       drive.file is a non-sensitive scope, so publishing needs no Google verification.
    3. Credentials > Create OAuth client ID > "Desktop app". Note the client ID and secret.

  Usage:
    ./authorize-drive.ps1 -ClientId <id>.apps.googleusercontent.com -Namespace dev
    (the client secret is prompted for, hidden)
#>
param(
    [Parameter(Mandatory)] [string] $ClientId,
    [string] $Namespace = 'dev',
    [string] $SecretName = 'sarvaikam-drive'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web

$secure = Read-Host -AsSecureString 'OAuth client secret'
$clientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

function New-Base64Url([byte[]] $bytes) { [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$buf = New-Object byte[] 32; $rng.GetBytes($buf); $verifier = New-Base64Url $buf
$challenge = New-Base64Url ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::ASCII.GetBytes($verifier)))
$buf = New-Object byte[] 16; $rng.GetBytes($buf); $state = New-Base64Url $buf

# Loopback redirect on a free local port (Google allows any port for Desktop clients).
$tcp = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0); $tcp.Start(); $port = $tcp.LocalEndpoint.Port; $tcp.Stop()
$redirect = "http://127.0.0.1:$port/"
$listener = [Net.HttpListener]::new(); $listener.Prefixes.Add($redirect); $listener.Start()

$query = @{
    client_id = $ClientId; redirect_uri = $redirect; response_type = 'code'
    scope = 'https://www.googleapis.com/auth/drive.file'; access_type = 'offline'; prompt = 'consent'
    code_challenge = $challenge; code_challenge_method = 'S256'; state = $state
}
$authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + (($query.GetEnumerator() | ForEach-Object { "$($_.Key)=$([Uri]::EscapeDataString($_.Value))" }) -join '&')
Write-Host 'Opening the browser. Sign in with the Google account whose Drive should hold the content.'
Start-Process $authUrl

try {
    $ctx = $listener.GetContext()
    $params = [Web.HttpUtility]::ParseQueryString($ctx.Request.Url.Query)
    $html = [Text.Encoding]::UTF8.GetBytes('<html><body style="font-family:sans-serif">Sarvaikam Drive authorization finished. You can close this tab.</body></html>')
    $ctx.Response.ContentType = 'text/html'; $ctx.Response.OutputStream.Write($html, 0, $html.Length); $ctx.Response.Close()
} finally { $listener.Stop() }

if ($params['error']) { throw "Authorization was declined: $($params['error'])" }
if ($params['state'] -ne $state) { throw 'Authorization response did not match this request (state mismatch).' }

$token = Invoke-RestMethod -Method Post -Uri 'https://oauth2.googleapis.com/token' -ContentType 'application/x-www-form-urlencoded' -Body @{
    grant_type = 'authorization_code'; code = $params['code']; redirect_uri = $redirect
    client_id = $ClientId; client_secret = $clientSecret; code_verifier = $verifier
}
if (-not $token.refresh_token) { throw 'Google returned no refresh token. Remove the app at https://myaccount.google.com/permissions and run again.' }
if ($token.scope -notmatch 'drive.file') { throw "Granted scope was '$($token.scope)', expected drive.file." }

function B64([string] $s) { [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($s)) }
# Built on stdin so the tokens never appear in process arguments.
$yaml = @"
apiVersion: v1
kind: Secret
metadata: {name: $SecretName, namespace: $Namespace}
type: Opaque
data:
  DRIVE_CLIENT_ID: $(B64 $ClientId)
  DRIVE_CLIENT_SECRET: $(B64 $clientSecret)
  DRIVE_REFRESH_TOKEN: $(B64 $token.refresh_token)
"@
$yaml | kubectl apply -f - | Out-Null
if ($LASTEXITCODE -ne 0) { throw "kubectl could not write secret $Namespace/$SecretName" }
$clientSecret = $null; $token = $null; $yaml = $null
Write-Host "Stored Drive credentials in secret $Namespace/$SecretName. Set STORAGE_BACKEND=drive and add the secret to envFrom."
