// SEMA-GOVERNED: sema.produto.governanca_ia.release_profiles
// Consulte contratos/sema/governanca_ia_release_profiles.sema antes de editar.
// Descricao: verifica alinhamento publico de distribuicao npm da CLI Sema.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = process.cwd();
const repoGitHub = "gerlanss/Sema";

async function lerJson(caminho) {
  return JSON.parse(await readFile(path.join(raiz, caminho), "utf8"));
}

function executarNpm(args) {
  try {
    const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    const comando = existsSync(npmCli) ? process.execPath : "npm";
    const argumentos = existsSync(npmCli) ? [npmCli, ...args] : args;
    return execFileSync(comando, argumentos, {
      cwd: raiz,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

async function versoesManifestos() {
  const root = await lerJson("package.json");
  const cli = await lerJson("pacotes/cli/package.json");
  const lock = await lerJson("package-lock.json");
  return {
    root: root.version,
    cli: cli.version,
    lockRoot: lock.version,
    lockCli: lock.packages?.["pacotes/cli"]?.version,
  };
}

function todosIguais(valores, esperado) {
  return valores.every((valor) => valor === esperado);
}

async function verificarDistribuicaoPublica({ versaoEsperada, repositorio = repoGitHub, json = false } = {}) {
  const versoes = await versoesManifestos();
  const versao = versaoEsperada ?? versoes.cli;
  const manifestosAlinhados = todosIguais(Object.values(versoes), versao);
  const npmVersion = executarNpm(["view", "@semacode/cli", "version"]);
  const npmAlinhado = npmVersion === versao;
  const ferramentasLocaisAlinhadas = executarNpm(["run", "--silent", "release:verificar-versao"]).includes(versao);
  const githubReleaseBloqueado = true;
  const assetsReleaseBloqueados = true;
  const repositorioPublicoAusente = repositorio !== repoGitHub;
  const sucesso = manifestosAlinhados && npmAlinhado && ferramentasLocaisAlinhadas;
  const resultado = {
    comando: "verificar-distribuicao-publica",
    sucesso,
    versao_esperada: versao,
    repositorio,
    manifestos_alinhados: manifestosAlinhados,
    npm_alinhado: npmAlinhado,
    npm_version: npmVersion || null,
    github_release_bloqueado: githubReleaseBloqueado,
    assets_release_bloqueados: assetsReleaseBloqueados,
    ferramentas_locais_alinhadas: ferramentasLocaisAlinhadas,
    sinais_distribuicao_emitidos: npmAlinhado,
    repositorio_publico_ausente: repositorioPublicoAusente,
  };

  if (json) {
    console.log(JSON.stringify(resultado, null, 2));
  } else if (sucesso) {
    console.log(`Distribuicao publica @semacode/cli ${versao} alinhada ao npm.`);
  } else {
    console.error(`Distribuicao publica @semacode/cli ${versao} ainda nao esta alinhada ao npm.`);
  }

  return resultado;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const versaoArg = process.argv.find((arg) => arg.startsWith("--versao="));
  const repoArg = process.argv.find((arg) => arg.startsWith("--repositorio="));
  const result = await verificarDistribuicaoPublica({
    versaoEsperada: versaoArg?.slice("--versao=".length),
    repositorio: repoArg?.slice("--repositorio=".length) ?? repoGitHub,
    json: process.argv.includes("--json"),
  });
  process.exit(result.sucesso ? 0 : 1);
}

export { verificarDistribuicaoPublica };
