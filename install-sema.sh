#!/usr/bin/env bash
set -euo pipefail

REPO="${SEMA_REPO:-gerlanss/Sema}"
VERSION="${SEMA_VERSION:-latest}"
PACKAGE_NAME="${SEMA_NPM_PACKAGE:-@semacode/cli}"
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
  echo "npm nao encontrado. Instale Node.js LTS antes de continuar. O npm vem junto no instalador oficial: https://nodejs.org/" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ "$VERSION" == "latest" ]]; then
  PACKAGE_SPEC="$PACKAGE_NAME"
  VSIX_URL="https://github.com/${REPO}/releases/latest/download/sema-language-tools-latest.vsix"
  VSIX_FILE="$TMP_DIR/sema-language-tools-latest.vsix"
else
  TAG_VERSION="${VERSION#v}"
  PACKAGE_SPEC="${PACKAGE_NAME}@${TAG_VERSION}"
  VSIX_URL="https://github.com/${REPO}/releases/download/v${TAG_VERSION}/sema-language-tools-${TAG_VERSION}.vsix"
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

echo "Instalando CLI da Sema via npm..."
npm install -g "$PACKAGE_SPEC"

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
echo "  sema starter-ia"
echo "  sema resumo . --curto"
echo "  sema compilar contratos/pedidos.sema --alvo lua --saida ./gerado-lua"
