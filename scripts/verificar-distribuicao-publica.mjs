// SEMA-GOVERNED: sema.produto.governanca_ia.release_profiles
// Consulte contratos/sema/governanca_ia_release_profiles.sema antes de editar.
// Descricao: verifica alinhamento publico de distribuicao npm da CLI Sema.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
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

function executarGh(args) {
  try {
    return execFileSync("gh", args, {
      cwd: raiz,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function executarGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: raiz,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function executarCodexIsolado(args, codexHome) {
  const resultado = spawnSync("codex", args, {
    cwd: raiz,
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
    },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    shell: true,
  });
  return {
    ok: !resultado.error && resultado.status === 0,
    saida: `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`,
  };
}

function normalizarQuebrasLinha(texto) {
  return texto.replaceAll("\r\n", "\n");
}

async function verificarPluginCodexRemoto(repositorio, versao) {
  const temporario = await mkdtemp(path.join(os.tmpdir(), "sema-plugin-codex-remoto-"));
  const codexHome = path.join(temporario, "codex-home");
  await mkdir(codexHome, { recursive: true });

  try {
    const marketplace = executarCodexIsolado(["plugin", "marketplace", "add", repositorio], codexHome);
    if (!marketplace.ok) {
      return { consultaRealizada: false, instalado: false, skillAlinhada: false, logoAlinhada: false, mcpAusente: false };
    }
    const instalacao = executarCodexIsolado(["plugin", "add", "sema@sema"], codexHome);
    const listagem = executarCodexIsolado(["plugin", "list"], codexHome);
    const mcp = executarCodexIsolado(["mcp", "list"], codexHome);
    const instalado = path.join(codexHome, "plugins", "cache", "sema", "sema", versao);
    const manifesto = JSON.parse(await readFile(path.join(instalado, ".codex-plugin", "plugin.json"), "utf8"));
    const skillFonte = await readFile(path.join(raiz, "plugins", "sema", "skills", "sema", "SKILL.md"), "utf8");
    const skillInstalada = await readFile(path.join(instalado, "skills", "sema", "SKILL.md"), "utf8");
    const logoFonte = await readFile(path.join(raiz, "logo.png"));
    const logoInstalada = await readFile(path.join(instalado, "assets", "sema.png"));
    const pluginEsperado =
      instalacao.ok &&
      listagem.ok &&
      new RegExp(`sema@sema\\s+installed, enabled\\s+${versao.replaceAll(".", "\\.")}`, "u").test(listagem.saida) &&
      manifesto.name === "sema" &&
      manifesto.version === versao &&
      !manifesto.apps &&
      !manifesto.mcpServers;
    return {
      consultaRealizada: true,
      instalado: pluginEsperado,
      skillAlinhada: normalizarQuebrasLinha(skillFonte) === normalizarQuebrasLinha(skillInstalada),
      logoAlinhada:
        manifesto.interface?.composerIcon === "./assets/sema.png" &&
        manifesto.interface?.logo === "./assets/sema.png" &&
        logoFonte.equals(logoInstalada),
      mcpAusente: mcp.ok && !/^sema\s+/imu.test(mcp.saida),
    };
  } catch {
    return { consultaRealizada: true, instalado: false, skillAlinhada: false, logoAlinhada: false, mcpAusente: false };
  } finally {
    await rm(temporario, { recursive: true, force: true });
  }
}

function consultarEstadoGitHub(repositorio) {
  const repoRaw = executarGh(["repo", "view", repositorio, "--json", "visibility"]);
  const releasesRaw = executarGh(["api", `repos/${repositorio}/releases`, "--paginate", "--slurp"]);
  if (!repoRaw || !releasesRaw) {
    return {
      consultaRealizada: false,
      repositorioPublico: false,
      releases: [],
    };
  }

  try {
    const repo = JSON.parse(repoRaw);
    const paginas = JSON.parse(releasesRaw);
    const releases = Array.isArray(paginas) ? paginas.flat() : [];
    return {
      consultaRealizada: true,
      repositorioPublico: repo.visibility === "PUBLIC",
      releases,
    };
  } catch {
    return {
      consultaRealizada: false,
      repositorioPublico: false,
      releases: [],
    };
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
  const github = consultarEstadoGitHub(repositorio);
  const assetsEncontrados = github.releases.flatMap((release) => Array.isArray(release.assets) ? release.assets : []);
  const githubReleaseAusente = github.consultaRealizada && github.releases.length === 0;
  const assetsReleaseAusentes = github.consultaRealizada && assetsEncontrados.length === 0;
  const repositorioPublicoConfirmado = github.consultaRealizada && github.repositorioPublico && repositorio === repoGitHub;
  const headLocal = executarGit(["rev-parse", "HEAD"]);
  const headRemoto = executarGh(["api", `repos/${repositorio}/commits/main`, "--jq", ".sha"]);
  const githubHeadAlinhado = Boolean(headLocal && headRemoto && headLocal === headRemoto);
  const pluginCodex = await verificarPluginCodexRemoto(repositorio, versao);
  const sinaisDistribuicaoEmitidos = npmAlinhado && github.consultaRealizada;
  const sucesso =
    manifestosAlinhados &&
    npmAlinhado &&
    ferramentasLocaisAlinhadas &&
    githubReleaseAusente &&
    assetsReleaseAusentes &&
    repositorioPublicoConfirmado &&
    githubHeadAlinhado &&
    pluginCodex.consultaRealizada &&
    pluginCodex.instalado &&
    pluginCodex.skillAlinhada &&
    pluginCodex.logoAlinhada &&
    pluginCodex.mcpAusente &&
    sinaisDistribuicaoEmitidos;
  const resultado = {
    comando: "verificar-distribuicao-publica",
    sucesso,
    versao_esperada: versao,
    repositorio,
    manifestos_alinhados: manifestosAlinhados,
    npm_alinhado: npmAlinhado,
    npm_version: npmVersion || null,
    github_consulta_realizada: github.consultaRealizada,
    github_releases_encontradas: github.releases.length,
    github_release_ausente: githubReleaseAusente,
    assets_release_encontrados: assetsEncontrados.length,
    assets_release_ausentes: assetsReleaseAusentes,
    ferramentas_locais_alinhadas: ferramentasLocaisAlinhadas,
    sinais_distribuicao_emitidos: sinaisDistribuicaoEmitidos,
    repositorio_publico_confirmado: repositorioPublicoConfirmado,
    github_head_alinhado: githubHeadAlinhado,
    plugin_codex_remoto_consultado: pluginCodex.consultaRealizada,
    plugin_codex_remoto_instalado: pluginCodex.instalado,
    skill_codex_remota_alinhada: pluginCodex.skillAlinhada,
    plugin_codex_logo_oficial_alinhada: pluginCodex.logoAlinhada,
    plugin_codex_remoto_sem_mcp: pluginCodex.mcpAusente,
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
