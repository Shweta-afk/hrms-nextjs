<#
.SYNOPSIS
  Logs into the HRMS as hr_admin and pulls biometric swipe data for a date
  range (default: yesterday through today) via /api/attendance/biometric-pull.

.EXAMPLE
  .\pull-attendance.ps1 -BaseUrl "https://your-hrms-domain.com" -AdminEmail "hr@yourorg.com"
  (prompts for password, uses yesterday->today, and the API URL/key already saved in Settings)

.EXAMPLE
  .\pull-attendance.ps1 -BaseUrl "https://your-hrms-domain.com" -AdminEmail "hr@yourorg.com" `
    -FromDate "2026-07-14" -ToDate "2026-07-15" `
    -ApiUrl "https://sohcm.com/SmartApp_ess/api/SwipeDetails/GetDeviceLogs" -ApiKey "200111012629"
#>
param(
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [Parameter(Mandatory = $true)][string]$AdminEmail,
  [SecureString]$AdminPassword,
  [string]$FromDate = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd'),
  [string]$ToDate   = (Get-Date).ToString('yyyy-MM-dd'),
  # Leave these blank to use whatever's already saved in Settings → Biometric API
  [string]$ApiUrl = "",
  [string]$ApiKey = "",
  [string]$AccountName = ""
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

if (-not $AdminPassword) {
  $AdminPassword = Read-Host "Admin password for $AdminEmail" -AsSecureString
}
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword)
)

# ── 1. Get a CSRF token (also seeds the cookie jar) ─────────────────────────
$csrf = Invoke-RestMethod -Uri "$BaseUrl/api/auth/csrf" -Method Get -SessionVariable session

# ── 2. Log in — sets the session cookie inside $session ─────────────────────
$loginBody = @{
  csrfToken = $csrf.csrfToken
  email     = $AdminEmail
  password  = $PlainPassword
  json      = "true"
}
Invoke-WebRequest -Uri "$BaseUrl/api/auth/callback/credentials?json=true" `
  -Method Post -WebSession $session -Body $loginBody `
  -ContentType 'application/x-www-form-urlencoded' | Out-Null

# ── 3. Confirm login actually succeeded before doing anything else ──────────
$me = Invoke-RestMethod -Uri "$BaseUrl/api/auth/session" -WebSession $session
if (-not $me.user) {
  throw "Login failed — check BaseUrl/AdminEmail/password. (Got no session back.)"
}
if ($me.user.role -ne 'hr_admin') {
  throw "Logged in as $($me.user.email) but role is '$($me.user.role)', not hr_admin — the pull endpoint will 403."
}
Write-Host "Logged in as $($me.user.email) (hr_admin). Pulling $FromDate -> $ToDate ..." -ForegroundColor Cyan

# ── 4. Trigger the pull ──────────────────────────────────────────────────────
$pullBody = @{ from_date = $FromDate; to_date = $ToDate }
if ($ApiUrl)      { $pullBody.api_url      = $ApiUrl }
if ($ApiKey)      { $pullBody.api_key      = $ApiKey }
if ($AccountName) { $pullBody.account_name = $AccountName }

$result = Invoke-RestMethod -Uri "$BaseUrl/api/attendance/biometric-pull" `
  -Method Post -WebSession $session `
  -Body ($pullBody | ConvertTo-Json) -ContentType 'application/json'

$result | ConvertTo-Json -Depth 6
