param(
  [string]$Version = "latest",
  [switch]$WithVSCode
)

$ErrorActionPreference = "Stop"

$repo = if ($env:SEMA_REPO) { $env:SEMA_REPO } else { "gerlanss/Sema" }

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm nao encontrado. Instale Node.js antes de continuar."
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("sema-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
  if ($Version -eq "latest") {
    $cliUrl = "https://github.com/$repo/releases/latest/download/sema-cli-latest.tgz"
    $vsixUrl = "https://github.com/$repo/releases/latest/download/sema-language-tools-latest.vsix"
    $cliFile = Join-Path $tempDir "sema-cli-latest.tgz"
    $vsixFile = Join-Path $tempDir "sema-language-tools-latest.vsix"
  } else {
    $tagVersion = $Version.TrimStart("v")
    $cliUrl = "https://github.com/$repo/releases/download/v$tagVersion/sema-cli-$tagVersion.tgz"
    $vsixUrl = "https://github.com/$repo/releases/download/v$tagVersion/sema-language-tools-$tagVersion.vsix"
    $cliFile = Join-Path $tempDir "sema-cli-$tagVersion.tgz"
    $vsixFile = Join-Path $tempDir "sema-language-tools-$tagVersion.vsix"
  }

  Write-Host "Baixando CLI da Sema..."
  Invoke-WebRequest -Uri $cliUrl -OutFile $cliFile

  Write-Host "Instalando CLI da Sema..."
  npm install -g $cliFile | Out-Host

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
  Write-Host "  sema --help"
  Write-Host "  sema doctor"
}
finally {
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
