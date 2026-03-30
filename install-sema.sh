#!/usr/bin/env bash
set -euo pipefail

REPO="${SEMA_REPO:-gerlanss/Sema}"
VERSION="${SEMA_VERSION:-latest}"
WITH_VSCODE=0

for arg in "$@"; do
  case "$arg" in
    --with-vscode)
      WITH_VSCODE=1
      ;;
    --version=*)
      VERSION="${arg#*=}"
      ;;
    *)
      echo "Argumento desconhecido: $arg" >&2
      exit 1
      ;;
  esac
done

if ! command -v npm >/dev/null 2>&1; then
  echo "npm nao encontrado. Instale Node.js antes de continuar." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ "$VERSION" == "latest" ]]; then
  CLI_URL="https://github.com/${REPO}/releases/latest/download/sema-cli-latest.tgz"
  VSIX_URL="https://github.com/${REPO}/releases/latest/download/sema-language-tools-latest.vsix"
  CLI_FILE="$TMP_DIR/sema-cli-latest.tgz"
  VSIX_FILE="$TMP_DIR/sema-language-tools-latest.vsix"
else
  TAG_VERSION="${VERSION#v}"
  CLI_URL="https://github.com/${REPO}/releases/download/v${TAG_VERSION}/sema-cli-${TAG_VERSION}.tgz"
  VSIX_URL="https://github.com/${REPO}/releases/download/v${TAG_VERSION}/sema-language-tools-${TAG_VERSION}.vsix"
  CLI_FILE="$TMP_DIR/sema-cli-${TAG_VERSION}.tgz"
  VSIX_FILE="$TMP_DIR/sema-language-tools-${TAG_VERSION}.vsix"
fi

download() {
  local url="$1"
  local file="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$file"
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -qO "$file" "$url"
    return
  fi
  echo "Nem curl nem wget estao disponiveis para baixar artefatos." >&2
  exit 1
}

echo "Baixando CLI da Sema..."
download "$CLI_URL" "$CLI_FILE"

echo "Instalando CLI da Sema..."
npm install -g "$CLI_FILE"

if [[ "$WITH_VSCODE" -eq 1 ]]; then
  if ! command -v code >/dev/null 2>&1; then
    echo "CLI do VS Code nao encontrada. Pulei a extensao." >&2
  else
    echo "Baixando extensao VS Code..."
    download "$VSIX_URL" "$VSIX_FILE"
    echo "Instalando extensao VS Code..."
    code --install-extension "$VSIX_FILE" --force
  fi
fi

echo "Sema instalada com sucesso."
echo "Teste rapido:"
echo "  sema --help"
echo "  sema doctor"
