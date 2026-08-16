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

function Invoke-NpmCaptured {
  param(
    [string]$NpmPath,
    [string[]]$ArgumentList
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Windows PowerShell promotes native stderr to ErrorRecord under Stop.
    # Capture stdout and discard stderr before restoring fail-closed behavior.
    $ErrorActionPreference = "Continue"
    $output = @(& $NpmPath @ArgumentList 2>$null)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  return [pscustomobject]@{
    ExitCode = $exitCode
    Output = $output
  }
}

function Test-ObjectShapeExact {
  param(
    [object]$Value,
    [string[]]$Keys
  )

  if ($null -eq $Value -or
      $Value -isnot [System.Management.Automation.PSCustomObject]) {
    return $false
  }
  $actualKeys = @($Value.PSObject.Properties.Name)
  if ($actualKeys.Count -ne $Keys.Count) {
    return $false
  }
  foreach ($key in $Keys) {
    if ($null -eq $Value.PSObject.Properties[$key]) {
      return $false
    }
  }
  return $true
}

function Test-LegacyDistributionReady {
  param([object]$Payload)

  if ($null -eq $Payload -or
      $Payload -isnot [System.Management.Automation.PSCustomObject] -or
      $null -ne $Payload.PSObject.Properties["schemaVersion"]) {
    return $false
  }
  if ($null -ne $Payload.PSObject.Properties["comando"] -and
      $Payload.comando -cne "skill") {
    return $false
  }
  if ($null -ne $Payload.PSObject.Properties["schema"] -and
      $Payload.schema -cne "sema.skill-distribution/v1") {
    return $false
  }
  return $Payload.sucesso -eq $true -and
    $Payload.operacao -ceq "status" -and
    $Payload.resultado.estado -ceq "READY" -and
    $Payload.resultado.launcher.estado -ceq "READY" -and
    $Payload.resultado.skill.estado -ceq "READY" -and
    $Payload.resultado.alterado -eq $false
}

function Test-DistributionReady {
  param(
    [string]$Json,
    [string]$InstalledVersion
  )

  try {
    $document = $Json | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return $false
  }
  if (-not (Test-ExactSemVer $InstalledVersion) -or
      $InstalledVersion -cnotmatch '^([0-9]+)\.') {
    return $false
  }

  $major = [int]$Matches[1]
  if ($major -eq 2) {
    return Test-LegacyDistributionReady $document
  }
  if ($major -ne 3) {
    return $false
  }

  $expectedKeys = @(
    "schemaVersion",
    "ok",
    "kind",
    "command",
    "code",
    "message",
    "exitCode",
    "payload"
  )
  if (-not (Test-ObjectShapeExact $document $expectedKeys) -or
      $document.schemaVersion -cne "sema.cli.result/v1" -or
      $document.ok -ne $true -or
      $document.kind -cne "SUCCESS" -or
      $document.command -cne "skill" -or
      $document.code -cne "CLI_SUCCESS" -or
      $null -ne $document.message -or
      $document.exitCode -ne 0 -or
      $null -eq $document.payload -or
      $null -ne $document.payload.PSObject.Properties["schemaVersion"]) {
    return $false
  }
  return Test-LegacyDistributionReady $document.payload
}

# Dot-sourcing defines the pure validators without starting a global installation.
if ($MyInvocation.InvocationName -ne ".") {
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
  $requestedResult = Invoke-NpmCaptured -NpmPath $npmCommand.Source -ArgumentList @(
    "view", $packageSpec, "version", "--json", "--cache", $npmCacheDir
  )
  if ($requestedResult.ExitCode -ne 0) {
    throw "npm could not resolve the requested Sema CLI version."
  }
  $requestedOutput = $requestedResult.Output
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
  $installResult = Invoke-NpmCaptured -NpmPath $npmCommand.Source -ArgumentList @(
    "install", "-g", $resolvedPackageSpec, "--cache", $npmCacheDir, "--no-audit", "--no-fund"
  )
  if ($installResult.ExitCode -ne 0) {
    throw "npm failed to install the Sema CLI globally."
  }

  $installedResult = Invoke-NpmCaptured -NpmPath $npmCommand.Source -ArgumentList @(
    "list", "--global", "--depth=0", "--json", $packageName
  )
  if ($installedResult.ExitCode -ne 0) {
    throw "npm could not verify the installed Sema CLI version."
  }
  $installedOutput = $installedResult.Output
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
  if ($statusResult.ExitCode -ne 0 -or
      -not (Test-DistributionReady $statusResult.Text $installedVersion)) {
    $syncResult = Invoke-ManagedSema $windowsPowerShell $launcherPowerShell @("skill", "sync", "--json")
    if ($syncResult.ExitCode -ne 0) {
      throw "The bundled Sema skill could not be synchronized."
    }
    $statusResult = Invoke-ManagedSema $windowsPowerShell $launcherPowerShell @("skill", "status", "--json")
  }
  if ($statusResult.ExitCode -ne 0 -or
      -not (Test-DistributionReady $statusResult.Text $installedVersion)) {
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
  Write-Host "Managed launcher and user PATH are ready."
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
}
