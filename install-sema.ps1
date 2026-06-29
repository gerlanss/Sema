param(
  [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

$packageName = if ($env:SEMA_NPM_PACKAGE) { $env:SEMA_NPM_PACKAGE } else { "@semacode/cli" }

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Install Node.js LTS before continuing: https://nodejs.org/"
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sema-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
  $packageSpec = if ($Version -eq "latest") {
    $packageName
  } else {
    $tagVersion = $Version.TrimStart("v")
    "${packageName}@${tagVersion}"
  }

  Write-Host "Installing the Sema CLI via npm..."
  npm install -g $packageSpec | Out-Host

  Write-Host "Sema was installed successfully."
  Write-Host "Quick check:"
  Write-Host "  sema --version"
  Write-Host "  sema --help"
  Write-Host "  sema doctor"
  Write-Host "  sema docs-impacto --intencao `"change project`" --json"
  Write-Host "  sema starter-ia"
  Write-Host "  sema resumo . --curto"
}
finally {
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
