# SEMA-GOVERNED: sema.produto.distribuicao_global.instaladores
param(
  [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

function Test-ExactSemVer {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }
  return $Value -cmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*)))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$'
}

function ConvertTo-CanonicalPath {
  param([string]$Value)

  $full = [System.IO.Path]::GetFullPath($Value)
  $root = [System.IO.Path]::GetPathRoot($full)
  if ([string]::Equals($full, $root, [StringComparison]::OrdinalIgnoreCase)) {
    return $root
  }
  return $full.TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
}

function Resolve-CanonicalUserHome {
  $environmentCandidates = @($env:USERPROFILE, $env:HOME) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  foreach ($candidate in $environmentCandidates) {
    if (-not [System.IO.Path]::IsPathRooted($candidate)) {
      throw "HOME and USERPROFILE must be absolute paths."
    }
  }

  if ($environmentCandidates.Count -gt 1) {
    $first = ConvertTo-CanonicalPath $environmentCandidates[0]
    $second = ConvertTo-CanonicalPath $environmentCandidates[1]
    if (-not [string]::Equals($first, $second, [StringComparison]::OrdinalIgnoreCase)) {
      throw "HOME and USERPROFILE must identify the same user directory."
    }
  }

  $candidate = if ($environmentCandidates.Count -gt 0) {
    $environmentCandidates[0]
  } else {
    [Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)
  }
  if ([string]::IsNullOrWhiteSpace($candidate) -or
      -not [System.IO.Path]::IsPathRooted($candidate)) {
    throw "The user profile directory could not be resolved safely."
  }

  $canonical = ConvertTo-CanonicalPath $candidate
  if (-not (Test-Path -LiteralPath $canonical -PathType Container)) {
    throw "The user profile directory does not exist."
  }
  return $canonical
}

function Invoke-ManagedSema {
  param(
    [string]$PowerShellPath,
    [string]$LauncherPath,
    [string[]]$Arguments
  )

  $output = & $PowerShellPath -NoLogo -NoProfile -NonInteractive `
    -ExecutionPolicy Bypass -File $LauncherPath @Arguments 2>&1
  return [pscustomobject]@{
    ExitCode = $LASTEXITCODE
    Text = (($output | Out-String).Trim())
  }
}

function Test-DistributionReady {
  param([string]$Json)

  try {
    $payload = $Json | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return $false
  }
  return $payload.sucesso -eq $true -and
    $payload.operacao -eq "status" -and
    $payload.resultado.estado -eq "READY" -and
    $payload.resultado.launcher.estado -eq "READY" -and
    $payload.resultado.skill.estado -eq "READY" -and
    $payload.resultado.alterado -eq $false
}

if ($Version -ne "latest" -and -not (Test-ExactSemVer $Version)) {
  throw "Version must be 'latest' or an exact SemVer value."
}

$packageName = if ([string]::IsNullOrWhiteSpace($env:SEMA_NPM_PACKAGE)) {
  "@semacode/cli"
} else {
  $env:SEMA_NPM_PACKAGE.Trim()
}
$packageSpec = "${packageName}@${Version}"
$userHomeDir = Resolve-CanonicalUserHome
$env:USERPROFILE = $userHomeDir
$env:HOME = $userHomeDir

$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  throw "npm was not found. Install Node.js LTS before continuing: https://nodejs.org/"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "node was not found. Install Node.js LTS before continuing: https://nodejs.org/"
}
if ([string]::IsNullOrWhiteSpace($env:SystemRoot) -or
    -not [System.IO.Path]::IsPathRooted($env:SystemRoot)) {
  throw "The Windows system directory could not be resolved."
}
$windowsPowerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$windowsPowerShellInfo = [System.IO.FileInfo]::new($windowsPowerShell)
if (-not $windowsPowerShellInfo.Exists -or
    (($windowsPowerShellInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
  throw "Windows PowerShell was not found at the expected absolute path."
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sema-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
  $npmCacheDir = Join-Path $tempDir "npm-cache"
  $requestedOutput = & $npmCommand.Source view $packageSpec version --json --cache $npmCacheDir 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "npm could not resolve the requested Sema CLI version."
  }
  try {
    $requestedVersion = (($requestedOutput | Out-String).Trim() | ConvertFrom-Json -ErrorAction Stop)
  } catch {
    throw "npm returned an invalid requested Sema CLI version."
  }
  if ($requestedVersion -is [System.Array]) {
    $requestedVersion = $requestedVersion[-1]
  }
  $requestedVersion = [string]$requestedVersion
  if (-not (Test-ExactSemVer $requestedVersion)) {
    throw "npm returned an invalid requested Sema CLI version."
  }
  if ($Version -ne "latest" -and $requestedVersion -cne $Version) {
    throw "npm resolved a different Sema CLI version than requested."
  }
  $resolvedPackageSpec = "${packageName}@${requestedVersion}"

  Write-Host "Installing the Sema CLI via npm..."
  & $npmCommand.Source install -g $resolvedPackageSpec --cache $npmCacheDir --no-audit --no-fund | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "npm failed to install the Sema CLI globally."
  }

  $installedOutput = & $npmCommand.Source list --global --depth=0 --json $packageName 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "npm could not verify the installed Sema CLI version."
  }
  try {
    $installedPayload = (($installedOutput | Out-String).Trim() | ConvertFrom-Json -ErrorAction Stop)
    $installedProperty = $installedPayload.dependencies.PSObject.Properties[$packageName]
    $installedVersion = [string]$installedProperty.Value.version
  } catch {
    throw "npm returned an invalid installed Sema CLI version."
  }
  if (-not (Test-ExactSemVer $installedVersion) -or $installedVersion -cne $requestedVersion) {
    throw "The installed Sema CLI version differs from the requested version."
  }

  $launcherDir = Join-Path $userHomeDir ".sema\bin"
  $launcher = Join-Path $launcherDir "sema.cmd"
  $launcherPowerShell = Join-Path $launcherDir "sema-managed.ps1"
  $skillEntrypoint = Join-Path $userHomeDir ".agents\skills\sema\SKILL.md"
  if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
    throw "The managed Sema launcher was not created by the global installation."
  }
  $launcherPowerShellInfo = [System.IO.FileInfo]::new($launcherPowerShell)
  if (-not $launcherPowerShellInfo.Exists -or
      $launcherPowerShellInfo.Length -le 3 -or
      $launcherPowerShellInfo.Length -gt 65536 -or
      (($launcherPowerShellInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw "The managed Sema PowerShell launcher is missing or invalid."
  }
  $launcherPowerShellBytes = [System.IO.File]::ReadAllBytes($launcherPowerShell)
  $launcherPowerShellInfo.Refresh()
  if (-not $launcherPowerShellInfo.Exists -or
      $launcherPowerShellInfo.Length -ne $launcherPowerShellBytes.Length -or
      (($launcherPowerShellInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) -or
      $launcherPowerShellBytes[0] -ne 0xef -or
      $launcherPowerShellBytes[1] -ne 0xbb -or
      $launcherPowerShellBytes[2] -ne 0xbf) {
    throw "The managed Sema PowerShell launcher changed during validation."
  }
  $strictUtf8 = [System.Text.UTF8Encoding]::new($false, $true)
  $launcherPowerShellText = $strictUtf8.GetString(
    $launcherPowerShellBytes,
    3,
    $launcherPowerShellBytes.Length - 3
  )
  if (-not $launcherPowerShellText.StartsWith(
    "# SEMA-MANAGED-LAUNCHER-WRAPPER v1`r`n",
    [System.StringComparison]::Ordinal
  )) {
    throw "The managed Sema PowerShell launcher has an invalid ownership marker."
  }
  if (-not (Test-Path -LiteralPath $skillEntrypoint -PathType Leaf)) {
    throw "The bundled Sema skill was not synchronized by the global installation."
  }

  $versionResult = Invoke-ManagedSema $windowsPowerShell $launcherPowerShell @("--version")
  $launcherVersion = $versionResult.Text.Trim()
  if ($versionResult.ExitCode -ne 0 -or
      -not (Test-ExactSemVer $launcherVersion) -or
      $launcherVersion -cne $installedVersion) {
    throw "The managed Sema launcher returned a different version than npm installed."
  }

  $statusResult = Invoke-ManagedSema $windowsPowerShell $launcherPowerShell @("skill", "status", "--json")
  if ($statusResult.ExitCode -ne 0 -or -not (Test-DistributionReady $statusResult.Text)) {
    $syncResult = Invoke-ManagedSema $windowsPowerShell $launcherPowerShell @("skill", "sync", "--json")
    if ($syncResult.ExitCode -ne 0) {
      throw "The bundled Sema skill could not be synchronized."
    }
    $statusResult = Invoke-ManagedSema $windowsPowerShell $launcherPowerShell @("skill", "status", "--json")
  }
  if ($statusResult.ExitCode -ne 0 -or -not (Test-DistributionReady $statusResult.Text)) {
    throw "The managed launcher and bundled skill did not reach READY state."
  }

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $pathEntries = @($userPath -split ";" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $launcherAlreadyPresent = $pathEntries | Where-Object {
    [string]::Equals($_.TrimEnd("\"), $launcherDir.TrimEnd("\"), [StringComparison]::OrdinalIgnoreCase)
  }
  if (-not $launcherAlreadyPresent) {
    $updatedPath = if ($pathEntries.Count -gt 0) {
      ($pathEntries + $launcherDir) -join ";"
    } else {
      $launcherDir
    }
    [Environment]::SetEnvironmentVariable("Path", $updatedPath, "User")
  }
  if (-not (($env:Path -split ";") | Where-Object {
    [string]::Equals($_.TrimEnd("\"), $launcherDir.TrimEnd("\"), [StringComparison]::OrdinalIgnoreCase)
  })) {
    $env:Path = "$launcherDir;$env:Path"
  }

  Write-Host "Sema $installedVersion was installed successfully."
  Write-Host "Managed launcher: $launcher"
  Write-Host "The user PATH contains: $launcherDir"
  Write-Host "Quick check:"
  Write-Host "  sema --version"
  Write-Host "  sema skill status --json"
  Write-Host "  sema docs-impacto --intencao `"change project`" --json"
  Write-Host "  sema starter-ia"
  Write-Host "  sema resumo . --curto --drift none"
}
finally {
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
