#!/usr/bin/env bash
set -euo pipefail

VERSION="${SEMA_VERSION:-latest}"
PACKAGE_NAME="${SEMA_NPM_PACKAGE:-@semacode/cli}"

for arg in "$@"; do
  case "$arg" in
    --version=*)
      VERSION="${arg#*=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node.js LTS before continuing: https://nodejs.org/" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [[ "$VERSION" == "latest" ]]; then
  PACKAGE_SPEC="$PACKAGE_NAME"
else
  TAG_VERSION="${VERSION#v}"
  PACKAGE_SPEC="${PACKAGE_NAME}@${TAG_VERSION}"
fi

echo "Installing the Sema CLI via npm..."
npm install -g "$PACKAGE_SPEC"

echo "Sema was installed successfully."
echo "Quick check:"
echo "  sema --version"
echo "  sema --help"
echo "  sema doctor"
echo "  sema docs-impacto --intencao \"change project\" --json"
echo "  sema starter-ia"
echo "  sema resumo . --curto"
