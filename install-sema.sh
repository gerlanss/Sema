#!/usr/bin/env bash
# SEMA-GOVERNED: sema.produto.distribuicao_global.instaladores
# Descrição: instala uma versão npm explícita e só persiste PATH após provar launcher e skill globais.
# `.gitattributes` keeps this executable LF-only on every checkout.
set -euo pipefail

VERSION="${SEMA_VERSION:-latest}"
PACKAGE_NAME="${SEMA_NPM_PACKAGE:-@semacode/cli}"
SEMVER_EXATA='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-((0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(\.(0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(\+([0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*))?$'

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

if [[ "$VERSION" != "latest" && ! "$VERSION" =~ $SEMVER_EXATA ]]; then
  echo "Version must be an exact SemVer or latest." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  echo "Node.js and npm were not found. Install Node.js LTS before continuing: https://nodejs.org/" >&2
  exit 1
fi

USER_HOME_RAW="${HOME:-}"
if [[ -z "$USER_HOME_RAW" || "$USER_HOME_RAW" =~ ^[[:space:]]*$ || "$USER_HOME_RAW" != /* || ! -d "$USER_HOME_RAW" ]]; then
  echo "The user home directory must be an existing absolute path." >&2
  exit 1
fi
USER_HOME_DIR="$(cd -- "$USER_HOME_RAW" && pwd -P)"

if [[ -n "${USERPROFILE:-}" && ! "${USERPROFILE}" =~ ^[[:space:]]*$ && "${USERPROFILE}" != /* ]]; then
  echo "USERPROFILE must be an absolute path when provided." >&2
  exit 1
fi
if [[ -n "${ZDOTDIR:-}" && ! "${ZDOTDIR}" =~ ^[[:space:]]*$ && "${ZDOTDIR}" != /* ]]; then
  echo "ZDOTDIR must be an absolute path when provided." >&2
  exit 1
fi

case "${SHELL:-}" in
  */zsh)
    ZDOTDIR_VALUE="${ZDOTDIR:-$USER_HOME_DIR}"
    if [[ "$ZDOTDIR_VALUE" != /* ]]; then
      echo "ZDOTDIR must be an absolute path." >&2
      exit 1
    fi
    SHELL_PROFILE="$ZDOTDIR_VALUE/.zshrc"
    ;;
  */bash)
    SHELL_PROFILE="$USER_HOME_DIR/.bashrc"
    ;;
  *)
    SHELL_PROFILE="$USER_HOME_DIR/.profile"
    ;;
esac

validar_bloco_profile() {
  SEMA_PROFILE_PATH="$SHELL_PROFILE" node --input-type=module --eval '
    import { existsSync, readFileSync } from "node:fs";
    const arquivo = process.env.SEMA_PROFILE_PATH;
    if (!existsSync(arquivo)) process.exit(0);
    const texto = readFileSync(arquivo, "utf8").replaceAll("\r\n", "\n");
    const inicio = "# >>> sema managed launcher >>>";
    const fim = "# <<< sema managed launcher <<<";
    const bloco = [
      inicio,
      "case \":$PATH:\" in",
      "  *\":$HOME/.sema/bin:\"*) ;;",
      "  *) export PATH=\"$HOME/.sema/bin:$PATH\" ;;",
      "esac",
      fim,
    ].join("\n");
    const contar = (valor) => texto.split(valor).length - 1;
    const inicios = contar(inicio);
    const fins = contar(fim);
    if (inicios === 0 && fins === 0) process.exit(0);
    if (inicios === 1 && fins === 1 && texto.includes(bloco)) process.exit(0);
    console.error("The managed Sema PATH block is incomplete or modified; review the shell profile before retrying.");
    process.exit(1);
  '
}

status_pronto() {
  node --input-type=module --eval '
    import { readFileSync } from "node:fs";
    try {
      const payload = JSON.parse(readFileSync(0, "utf8"));
      const pronto = payload?.sucesso === true
        && payload.operacao === "status"
        && payload.resultado?.estado === "READY"
        && payload.resultado?.launcher?.estado === "READY"
        && payload.resultado?.skill?.estado === "READY"
        && payload.resultado?.alterado === false;
      process.exit(pronto ? 0 : 1);
    } catch {
      process.exit(1);
    }
  '
}

extrair_versao_json() {
  node --input-type=module --eval '
    import { readFileSync } from "node:fs";
    try {
      const payload = JSON.parse(readFileSync(0, "utf8"));
      const valor = Array.isArray(payload) ? payload.at(-1) : payload;
      if (typeof valor !== "string") process.exit(1);
      process.stdout.write(valor);
    } catch {
      process.exit(1);
    }
  '
}

extrair_versao_instalada() {
  SEMA_PACKAGE_NAME="$PACKAGE_NAME" node --input-type=module --eval '
    import { readFileSync } from "node:fs";
    try {
      const payload = JSON.parse(readFileSync(0, "utf8"));
      const valor = payload?.dependencies?.[process.env.SEMA_PACKAGE_NAME]?.version;
      if (typeof valor !== "string") process.exit(1);
      process.stdout.write(valor);
    } catch {
      process.exit(1);
    }
  '
}

validar_bloco_profile

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

export HOME="$USER_HOME_DIR"
export USERPROFILE="$USER_HOME_DIR"
PACKAGE_SPEC="${PACKAGE_NAME}@${VERSION}"

if ! REQUESTED_VERSION="$(npm view "$PACKAGE_SPEC" version --json --cache "$TMP_DIR/npm-cache" | extrair_versao_json)"; then
  echo "npm could not resolve the requested Sema CLI version." >&2
  exit 1
fi
if [[ ! "$REQUESTED_VERSION" =~ $SEMVER_EXATA ]]; then
  echo "npm returned an invalid requested Sema CLI version." >&2
  exit 1
fi
if [[ "$VERSION" != "latest" && "$REQUESTED_VERSION" != "$VERSION" ]]; then
  echo "npm resolved a different Sema CLI version than requested." >&2
  exit 1
fi
RESOLVED_PACKAGE_SPEC="${PACKAGE_NAME}@${REQUESTED_VERSION}"

echo "Installing the Sema CLI via npm..."
npm install -g "$RESOLVED_PACKAGE_SPEC" --cache "$TMP_DIR/npm-cache" --no-audit --no-fund

if ! INSTALLED_PACKAGE_VERSION="$(npm list -g --depth=0 --json "$PACKAGE_NAME" | extrair_versao_instalada)"; then
  echo "npm could not verify the installed Sema CLI version." >&2
  exit 1
fi
if [[ ! "$INSTALLED_PACKAGE_VERSION" =~ $SEMVER_EXATA || "$INSTALLED_PACKAGE_VERSION" != "$REQUESTED_VERSION" ]]; then
  echo "The installed Sema CLI version differs from the requested version." >&2
  exit 1
fi

LAUNCHER_DIR="$USER_HOME_DIR/.sema/bin"
LAUNCHER="$LAUNCHER_DIR/sema"
SKILL_ENTRYPOINT="$USER_HOME_DIR/.agents/skills/sema/SKILL.md"
if [[ ! -x "$LAUNCHER" ]]; then
  echo "The managed Sema launcher was not created by the global installation." >&2
  exit 1
fi
if [[ ! -f "$SKILL_ENTRYPOINT" ]]; then
  echo "The bundled Sema skill was not synchronized by the global installation." >&2
  exit 1
fi

INSTALLED_VERSION="$("$LAUNCHER" --version)"
INSTALLED_VERSION="${INSTALLED_VERSION//$'\r'/}"
if [[ ! "$INSTALLED_VERSION" =~ $SEMVER_EXATA ]]; then
  echo "The managed Sema launcher returned an invalid version." >&2
  exit 1
fi
if [[ "$INSTALLED_VERSION" != "$INSTALLED_PACKAGE_VERSION" ]]; then
  echo "The managed Sema launcher version does not match the installed package." >&2
  exit 1
fi

set +e
STATUS_JSON="$("$LAUNCHER" skill status --json 2>/dev/null)"
STATUS_EXIT=$?
set -e
if [[ $STATUS_EXIT -ne 0 ]] || ! printf '%s' "$STATUS_JSON" | status_pronto; then
  if ! "$LAUNCHER" skill sync --json >/dev/null; then
    echo "The managed Sema distribution could not be synchronized." >&2
    exit 1
  fi
  set +e
  STATUS_JSON="$("$LAUNCHER" skill status --json 2>/dev/null)"
  STATUS_EXIT=$?
  set -e
fi
if [[ $STATUS_EXIT -ne 0 ]] || ! printf '%s' "$STATUS_JSON" | status_pronto; then
  echo "The managed Sema launcher and skill did not reach READY state." >&2
  exit 1
fi

mkdir -p "$(dirname "$SHELL_PROFILE")"
touch "$SHELL_PROFILE"
if ! grep -Fq '# >>> sema managed launcher >>>' "$SHELL_PROFILE"; then
  printf '%s\n' \
    '' \
    '# >>> sema managed launcher >>>' \
    'case ":$PATH:" in' \
    '  *":$HOME/.sema/bin:"*) ;;' \
    '  *) export PATH="$HOME/.sema/bin:$PATH" ;;' \
    'esac' \
    '# <<< sema managed launcher <<<' >> "$SHELL_PROFILE"
fi
validar_bloco_profile

case ":${PATH:-}:" in
  *":$LAUNCHER_DIR:"*) ;;
  *) export PATH="$LAUNCHER_DIR:${PATH:-}" ;;
esac

echo "Sema $INSTALLED_VERSION was installed successfully."
echo "Managed launcher: $LAUNCHER"
echo "The launcher directory was added to: $SHELL_PROFILE"
echo "Quick check:"
echo "  sema --version"
echo "  sema --help"
echo "  sema docs-impacto --intencao \"change project\" --json"
echo "  sema starter-ia"
echo "  sema resumo . --curto --drift none"
