param(
  [string]$Version = "latest",
  [switch]$WithVSCode,
  [switch]$WithMcp
)

$ErrorActionPreference = "Stop"

$repo = if ($env:SEMA_REPO) { $env:SEMA_REPO } else { "gerlanss/Sema" }
$packageName = if ($env:SEMA_NPM_PACKAGE) { $env:SEMA_NPM_PACKAGE } else { "@semacode/cli" }
$mcpPackageName = if ($env:SEMA_MCP_NPM_PACKAGE) { $env:SEMA_MCP_NPM_PACKAGE } else { "@semacode/mcp" }

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm nao encontrado. Instale Node.js LTS antes de continuar. O npm vem junto no instalador oficial: https://nodejs.org/"
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

  Write-Host "Instalando CLI da Sema via npm..."
  npm install -g $packageSpec | Out-Host

  if ($WithMcp) {
    $mcpSpec = if ($Version -eq "latest") {
      $mcpPackageName
    } else {
      $tagVersion = $Version.TrimStart("v")
      "${mcpPackageName}@${tagVersion}"
    }

    Write-Host "Instalando MCP da Sema via npm..."
    npm install -g $mcpSpec | Out-Host
  }

  if ($Version -eq "latest") {
    $vsixUrl = "https://github.com/$repo/releases/latest/download/sema-language-tools-latest.vsix"
    $vsixFile = Join-Path $tempDir "sema-language-tools-latest.vsix"
  } else {
    $tagVersion = $Version.TrimStart("v")
    $vsixUrl = "https://github.com/$repo/releases/download/v$tagVersion/sema-language-tools-$tagVersion.vsix"
    $vsixFile = Join-Path $tempDir "sema-language-tools-$tagVersion.vsix"
  }

  if ($WithVSCode) {
    if (-not (Get-Command code -ErrorAction SilentlyContinue)) {
      Write-Warning "CLI do VS Code nao encontrada. Pulei a extensao."
    } else {
      Write-Host "Baixando extensao VS Code..."
      Invoke-WebRequest -Uri $vsixUrl -OutFile $vsixFile
      Write-Host "Instalando extensao VS Code..."
      code --install-extension $vsixFile --force | Out-Host
    }
  }

  Write-Host "Sema instalada com sucesso."
  Write-Host "Teste rapido:"
  Write-Host "  sema --version"
  Write-Host "  sema --help"
  Write-Host "  sema doctor"
  Write-Host "  sema starter-ia"
  Write-Host "  sema resumo . --curto"
  if ($WithMcp) {
    Write-Host "  sema-mcp"
  }
}
finally {
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
