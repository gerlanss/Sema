// SEMA-GOVERNED: sema.produto.fronteira_repositorios, sema.produto.fronteira_repositorios.empacotamento, sema.produto.fronteira_repositorios.empacotamento.smoke, sema.produto.cli_invocacao_publica
// Consulte contratos/sema/fronteira_repositorios_empacotamento_smoke.sema antes de editar.
// Descricao: orquestra uma unica instalacao isolada do pacote publico e delega as validacoes por responsabilidade.
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { validarBootstrapCodexInstalado } from "./cli-publico/bootstrap-codex.mjs";
import {
  validarArtefatosDistribuicaoContraFonte,
  validarManifestSemDependenciasFile,
  validarReadmePublico,
  validarRuntimeLocalDireto,
} from "./cli-publico/fronteira-publica.mjs";
import { validarPipelineConteudoInstalado } from "./cli-publico/pipeline-conteudo.mjs";
import {
  EXEMPLOS_INTERATIVOS_PUBLICOS,
  validarSistemasInterativosInstalados,
} from "./cli-publico/sistemas-interativos.mjs";
import { validarGeradoresInstalados } from "./cli-publico/toolchains-geradas.mjs";
import {
  ambienteInstalacaoIsolada,
  caminhosCachePluginIsolado,
  caminhosEstadoSemaReal,
  executarFallbackPowerShellAbsoluto,
  executarLauncherAbsoluto,
  fingerprintCaminhos,
  payloadContemCaminhoSensivel,
  validarInstalacaoGlobalIsolada,
} from "./cli-publico/distribuicao-global.mjs";

export {
  executarFallbackPowerShellAbsoluto,
  executarLauncherAbsoluto,
  payloadContemCaminhoSensivel,
};

const raiz = process.cwd();
const pastaPacotes = path.join(raiz, ".tmp", "pacotes-instalador-npm");
const cacheNpm = path.join(raiz, ".tmp", "npm-cache");

function executar(comando, argumentos, cwd, opcoes = {}) {
  const cacheExecucao = opcoes.cacheNpm ?? cacheNpm;
  const ambiente = opcoes.env ?? process.env;
  if (comando === "npm") {
    const npmExecpath = ambiente.npm_execpath?.trim();
    if (!npmExecpath || !path.isAbsolute(npmExecpath)) {
      throw new Error("npm_execpath absoluto é obrigatório para o smoke público isolado.");
    }
    const argumentosIsolados = [...argumentos, "--cache", cacheExecucao];
    execFileSync(process.execPath, [npmExecpath, ...argumentosIsolados], {
      cwd,
      env: ambiente,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(comando, argumentos, {
    cwd,
    env: ambiente,
    stdio: "inherit",
  });
}

function executarComSaida(comando, argumentos, cwd, opcoes = {}) {
  const resultado = spawnSync(comando, argumentos, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...opcoes,
  });
  if (resultado.error) {
    throw resultado.error;
  }
  if (resultado.status !== 0) {
    throw new Error(
      `Command failed (${[comando, ...argumentos].join(" ")}): ${resultado.stderr || resultado.stdout}`,
    );
  }
  return resultado.stdout;
}

function executarCliCapturada(semaBin, argumentos, cwd, ambiente) {
  const resultado = spawnSync(process.execPath, [semaBin, ...argumentos], {
    cwd,
    env: ambiente,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 10_000,
    windowsHide: true,
  });
  if (resultado.error) {
    throw resultado.error;
  }
  return resultado;
}

function executarLauncherCapturado(launcher, argumentos, cwd, ambiente) {
  if (process.platform !== "win32") {
    const resultado = spawnSync(launcher, argumentos, {
      cwd,
      env: ambiente,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 10_000,
    });
    if (resultado.error) throw resultado.error;
    return resultado;
  }

  const systemRoot = ambiente.SystemRoot?.trim();
  const cmd = path.join(
    systemRoot && path.isAbsolute(systemRoot) ? systemRoot : "C:\\Windows",
    "System32",
    "cmd.exe",
  );
  const env = { ...ambiente, SEMA_SMOKE_LAUNCHER: launcher };
  const referencias = ['"%SEMA_SMOKE_LAUNCHER%"'];
  argumentos.forEach((argumento, indice) => {
    const nome = `SEMA_SMOKE_ARG_${indice}`;
    env[nome] = argumento;
    referencias.push(`"%${nome}%"`);
  });
  const resultado = spawnSync(cmd, [
    "/d",
    "/s",
    "/v:off",
    "/c",
    `"${referencias.join(" ")}"`,
  ], {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 10_000,
    windowsHide: true,
    windowsVerbatimArguments: true,
  });
  if (resultado.error) throw resultado.error;
  return resultado;
}

function ambienteComPath(ambiente, valorPath) {
  const isolado = {};
  for (const [chave, valor] of Object.entries(ambiente)) {
    if (chave.toLowerCase() !== "path") isolado[chave] = valor;
  }
  isolado.PATH = valorPath;
  return isolado;
}

function contemStackOuErroInterno(texto) {
  return /\b(?:Aggregate|Eval|Internal|Range|Reference|Syntax|Type|URI)?Error\s*:/iu.test(texto)
    || /(?:^|[\s;|=(:,])at\s+(?:async\s+)?(?:new\s+)?[^\n]{0,240}?(?:\([^()\n]*:\d+:\d+\)|[^\s()\n]+:\d+:\d+)/iu.test(texto);
}

function validarEnvelopeControleJson(resultado, contexto, esperado, caminhosSensiveis) {
  if (resultado.stderr !== "") {
    throw new Error(`The installed public CLI wrote JSON control output to stderr during ${contexto}.`);
  }

  let payload;
  try {
    payload = JSON.parse(resultado.stdout);
  } catch {
    throw new Error(`The installed public CLI did not emit exactly one JSON document during ${contexto}.`);
  }

  const chavesEsperadas = ["code", "exitCode", "kind", "message", "ok", "schemaVersion"];
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.keys(payload).sort().join("\n") !== chavesEsperadas.join("\n") ||
    payload.schemaVersion !== "sema.cli.control/v1" ||
    payload.ok !== esperado.ok ||
    payload.kind !== esperado.kind ||
    payload.exitCode !== resultado.status ||
    typeof payload.code !== "string" ||
    payload.code.length === 0 ||
    typeof payload.message !== "string" ||
    payload.message.length === 0
  ) {
    throw new Error(`The installed public CLI emitted an invalid JSON control envelope during ${contexto}.`);
  }
  if (esperado.code && payload.code !== esperado.code) {
    throw new Error(`The installed public CLI emitted ${payload.code} instead of ${esperado.code} during ${contexto}.`);
  }
  if (payloadContemCaminhoSensivel(payload, caminhosSensiveis)) {
    throw new Error(`The installed public CLI exposed a sensitive path during ${contexto}.`);
  }
  if (contemStackOuErroInterno(resultado.stdout)) {
    throw new Error(`The installed public CLI exposed an internal error or stack during ${contexto}.`);
  }
  return payload;
}

function executarJsonCliInstalada(semaBin, argumentos, cwd, opcoes = {}) {
  return JSON.parse(executarComSaida(
    process.execPath,
    [semaBin, ...argumentos, "--json"],
    cwd,
    opcoes,
  ));
}

function ambienteCacheIsolado(raizCache) {
  return {
    ...process.env,
    HOME: raizCache,
    USERPROFILE: raizCache,
    LOCALAPPDATA: raizCache,
    XDG_CACHE_HOME: raizCache,
  };
}

async function prepararSentinelaPurezaHelp({ sandbox, workspace, home, cache, ambiente }) {
  const sentinela = path.join(sandbox, "PUREZA_HELP_INSTALADO_VIOLADA.txt");
  const preload = path.join(sandbox, "cli-help-purity-installed.cjs");
  await writeFile(preload, [
    '"use strict";',
    'const childProcess = require("node:child_process");',
    'const dns = require("node:dns");',
    'const fs = require("node:fs");',
    'const fsPromises = require("node:fs/promises");',
    'const http = require("node:http");',
    'const https = require("node:https");',
    'const net = require("node:net");',
    'const path = require("node:path");',
    'const tls = require("node:tls");',
    'const { fileURLToPath } = require("node:url");',
    'const { syncBuiltinESMExports } = require("node:module");',
    'const appendFileSyncOriginal = fs.appendFileSync.bind(fs);',
    'const sentinela = process.env.SEMA_TEST_PURITY_SENTINEL;',
    'const raizes = JSON.parse(process.env.SEMA_TEST_PURITY_ROOTS || "[]")',
    '  .map((item) => path.resolve(item).toLowerCase());',
    'function caminhoMonitorado(valor) {',
    '  if (typeof valor === "number" || valor === undefined || valor === null) return false;',
    '  let candidato = valor;',
    '  if (candidato instanceof URL) candidato = fileURLToPath(candidato);',
    '  if (Buffer.isBuffer(candidato)) candidato = candidato.toString("utf8");',
    '  if (typeof candidato !== "string") return false;',
    '  const absoluto = path.resolve(candidato).toLowerCase();',
    '  return raizes.some((raiz) => absoluto === raiz || absoluto.startsWith(`${raiz}${path.sep}`));',
    '}',
    'function bloquear(tipo, nome, alvo) {',
    '  appendFileSyncOriginal(sentinela, `${tipo}:${nome}:${String(alvo ?? "")}\\n`, "utf8");',
    '  const erro = new Error(`Pureza de --help violada: ${tipo}:${nome}`);',
    '  erro.code = "SEMA_TEST_HELP_PURITY_BLOCKED";',
    '  throw erro;',
    '}',
    'function bloquearSempre(tipo, nome) {',
    '  return (...args) => bloquear(tipo, nome, args[0]);',
    '}',
    'function protegerLeitura(objeto, nome) {',
    '  const original = objeto[nome];',
    '  if (typeof original !== "function") return;',
    '  objeto[nome] = function(alvo, ...args) {',
    '    if (caminhoMonitorado(alvo)) bloquear("read", nome, alvo);',
    '    return original.call(this, alvo, ...args);',
    '  };',
    '}',
    'for (const nome of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) childProcess[nome] = bloquearSempre("child_process", nome);',
    'for (const nome of ["access", "accessSync", "createReadStream", "existsSync", "lstat", "lstatSync", "open", "openSync", "readFile", "readFileSync", "readdir", "readdirSync", "readlink", "readlinkSync", "realpath", "realpathSync", "stat", "statSync", "watch", "watchFile"]) protegerLeitura(fs, nome);',
    'for (const nome of ["access", "lstat", "open", "readFile", "readdir", "readlink", "realpath", "stat", "watch"]) protegerLeitura(fsPromises, nome);',
    'for (const [objeto, nomes] of [[net, ["connect", "createConnection"]], [tls, ["connect"]], [http, ["get", "request"]], [https, ["get", "request"]], [dns, ["lookup", "resolve", "resolve4", "resolve6", "resolveAny", "reverse"]]]) {',
    '  for (const nome of nomes) objeto[nome] = bloquearSempre("network", nome);',
    '}',
    'if (net.Socket?.prototype) net.Socket.prototype.connect = bloquearSempre("network", "Socket.connect");',
    'if (dns.promises) {',
    '  for (const nome of ["lookup", "resolve", "resolve4", "resolve6", "resolveAny", "reverse"]) {',
    '    if (typeof dns.promises[nome] === "function") dns.promises[nome] = bloquearSempre("network", `promises.${nome}`);',
    '  }',
    '}',
    'if (typeof globalThis.fetch === "function") globalThis.fetch = bloquearSempre("network", "fetch");',
    'syncBuiltinESMExports();',
    '',
  ].join("\n"), "utf8");

  return {
    sentinela,
    ambiente: {
      ...ambiente,
      NODE_OPTIONS: `--require="${preload.replaceAll(path.sep, "/").replaceAll('"', '\\"')}"`,
      SEMA_TEST_PURITY_SENTINEL: sentinela,
      SEMA_TEST_PURITY_ROOTS: JSON.stringify([workspace, home, cache]),
    },
  };
}

async function validarHelpPuroEControleJsonInstalado({
  semaBin,
  launcherNpm,
  basePacote,
  sandbox,
  versaoEsperada,
}) {
  const workspaceHelp = path.join(sandbox, "workspace-help-isolado");
  const homeHelp = path.join(sandbox, "home-help-isolado");
  const cacheHelp = path.join(sandbox, "cache-help-isolado");
  const pathVazio = path.join(sandbox, "path-help-vazio");
  await Promise.all([
    mkdir(workspaceHelp, { recursive: true }),
    mkdir(homeHelp, { recursive: true }),
    mkdir(pathVazio, { recursive: true }),
  ]);
  const pureza = await prepararSentinelaPurezaHelp({
    sandbox,
    workspace: workspaceHelp,
    home: homeHelp,
    cache: cacheHelp,
    ambiente: ambienteInstalacaoIsolada(homeHelp, cacheHelp),
  });
  const ambienteHelp = ambienteComPath(pureza.ambiente, pathVazio);
  const ambienteLauncher = ambienteComPath(
    pureza.ambiente,
    process.env.PATH ?? process.env.Path ?? path.dirname(process.execPath),
  );
  const caminhosSensiveis = [
    sandbox,
    basePacote,
    semaBin,
    launcherNpm,
    workspaceHelp,
    homeHelp,
    cacheHelp,
    raiz,
    process.execPath,
  ];
  const caminhosImutaveis = [
    workspaceHelp,
    homeHelp,
    cacheHelp,
    pathVazio,
    ...caminhosEstadoSemaReal(raiz),
  ];
  const fingerprintAntes = await fingerprintCaminhos(caminhosImutaveis);
  async function exigirPureza(contexto) {
    if (await existe(pureza.sentinela)) {
      throw new Error(`The installed public CLI performed a forbidden read, subprocess, or network call during ${contexto}.`);
    }
    if (await fingerprintCaminhos(caminhosImutaveis) !== fingerprintAntes) {
      throw new Error(`The installed public CLI mutated HOME, workspace, PATH, or cache during ${contexto}.`);
    }
  }

  const argvVazio = executarCliCapturada(semaBin, [], workspaceHelp, ambienteHelp);
  await exigirPureza("argv vazio");
  if (argvVazio.status !== 0 || argvVazio.stderr !== "" || argvVazio.stdout.trim().length === 0) {
    throw new Error("The installed public CLI did not render pure help for an empty argv.");
  }

  const versao = executarCliCapturada(semaBin, ["--version"], workspaceHelp, ambienteHelp);
  await exigirPureza("--version");
  if (versao.status !== 0 || versao.stderr !== "" || versao.stdout.trim() !== versaoEsperada) {
    throw new Error("The installed public CLI did not render a pure exact version response.");
  }

  const argumentoInvalido = executarCliCapturada(
    semaBin,
    ["iniciar", "--template", "template-invalido-segredo-82c1", "--json"],
    workspaceHelp,
    ambienteHelp,
  );
  await exigirPureza("invalid argument --json");
  if (!Number.isInteger(argumentoInvalido.status) || argumentoInvalido.status <= 0) {
    throw new Error("The installed public CLI did not fail an invalid-argument control response.");
  }
  validarEnvelopeControleJson(argumentoInvalido, "invalid argument --json", {
    ok: false,
    kind: "ARGUMENT_ERROR",
    code: "CLI_ARGUMENT_ERROR",
  }, caminhosSensiveis);
  const casosHelp = [
    { nome: "root --help", argumentos: ["--help"] },
    { nome: "root -h", argumentos: ["-h"] },
    { nome: "iniciar --help", argumentos: ["iniciar", "--help"] },
    { nome: "dev --help", argumentos: ["dev", "--help"] },
    { nome: "formatar --help", argumentos: ["formatar", "--help"] },
    { nome: "sync-codex --help", argumentos: ["sync-codex", "--help"] },
    { nome: "skill sync --help", argumentos: ["skill", "sync", "--help"] },
    {
      nome: "help after unknown arguments",
      argumentos: ["comando-inexistente", "--opcao", "valor", "--help"],
    },
  ];
  let ajudaRaiz = "";

  for (const [indice, caso] of casosHelp.entries()) {
    const texto = executarCliCapturada(semaBin, caso.argumentos, workspaceHelp, ambienteHelp);
    await exigirPureza(caso.nome);
    if (texto.status !== 0 || texto.stderr !== "" || texto.stdout.trim().length === 0) {
      throw new Error(`The installed public CLI did not render pure text help for ${caso.nome}.`);
    }
    if (indice === 0) ajudaRaiz = texto.stdout;

    const json = executarCliCapturada(
      semaBin,
      [...caso.argumentos, "--json"],
      workspaceHelp,
      ambienteHelp,
    );
    await exigirPureza(`${caso.nome} --json`);
    if (json.status !== 0) {
      throw new Error(`The installed public CLI returned a non-zero JSON help status for ${caso.nome}.`);
    }
    validarEnvelopeControleJson(json, `${caso.nome} --json`, {
      ok: true,
      kind: "HELP",
      code: "CLI_HELP",
    }, caminhosSensiveis);
  }

  const tokenDesconhecido = "comando-inexistente-segredo-7f3a";
  const desconhecido = executarCliCapturada(
    semaBin,
    [tokenDesconhecido, "--json"],
    workspaceHelp,
    ambienteHelp,
  );
  await exigirPureza("unknown command --json");
  if (!Number.isInteger(desconhecido.status) || desconhecido.status <= 0) {
    throw new Error("The installed public CLI did not fail a JSON unknown-command control response.");
  }
  const envelopeDesconhecido = validarEnvelopeControleJson(desconhecido, "unknown command --json", {
    ok: false,
    kind: "UNKNOWN_COMMAND",
    code: "CLI_UNKNOWN_COMMAND",
  }, caminhosSensiveis);
  if (desconhecido.stdout.includes(tokenDesconhecido)
    || JSON.stringify(envelopeDesconhecido).includes(tokenDesconhecido)) {
    throw new Error("The installed public CLI exposed the raw unknown-command argv token.");
  }

  for (const caso of [
    { nome: "installed npm launcher --help", argumentos: ["--help"], json: false },
    { nome: "installed npm launcher iniciar --help --json", argumentos: ["iniciar", "--help", "--json"], json: true },
  ]) {
    const resultado = executarLauncherCapturado(
      launcherNpm,
      caso.argumentos,
      workspaceHelp,
      ambienteLauncher,
    );
    await exigirPureza(caso.nome);
    if (resultado.status !== 0 || resultado.stderr !== "" || resultado.stdout.trim().length === 0) {
      throw new Error(`The installed npm launcher did not preserve pure help during ${caso.nome}.`);
    }
    if (caso.json) {
      validarEnvelopeControleJson(resultado, caso.nome, {
        ok: true,
        kind: "HELP",
        code: "CLI_HELP",
      }, caminhosSensiveis);
    }
  }

  return ajudaRaiz;
}

function validarConsultaSemDrift(payload, comando) {
  const configuracao = comando === "resumo" ? payload : payload.configuracao;
  if (
    configuracao.analiseDrift?.modo !== "none" ||
    configuracao.analiseDrift.executada !== false ||
    configuracao.analiseDrift.sucesso !== null ||
    configuracao.analiseDrift.cache !== null
  ) {
    throw new Error(`The installed public CLI executed drift implicitly during ${comando}.`);
  }

  if (comando === "resumo") {
    if (
      payload.resumo?.modoVerificacaoCodigo !== "contratos_apenas" ||
      payload.resumo.scoreSemantico !== null ||
      payload.resumo.confiancaGeral !== null ||
      payload.resumo.consumerFramework !== null ||
      payload.resumo.appRoutes !== null ||
      payload.resumo.consumerSurfaces !== null ||
      payload.resumo.consumerBridges !== null ||
      payload.resumo.ancoragensVinculo !== null
    ) {
      throw new Error("The installed public CLI fabricated code evidence in the default resumo response.");
    }
    return;
  }

  if (
    configuracao.scoreDrift !== null ||
    configuracao.confiancaGeral !== null ||
    configuracao.consumerFramework !== null ||
    configuracao.appRoutes !== null ||
    configuracao.consumerSurfaces !== null ||
    configuracao.consumerBridges !== null ||
    !payload.projeto?.modulos?.every((modulo) => modulo.implementacao === null)
  ) {
    throw new Error("The installed public CLI fabricated code evidence in the default inspecionar response.");
  }
}

function validarDriftComCache(payload, modo, origem) {
  const cache = payload.escopo_aplicado?.cache;
  if (
    payload.sucesso !== true ||
    cache?.modo !== modo ||
    cache.origem !== origem ||
    cache.schema !== "sema.drift-cache/v3"
  ) {
    throw new Error(`The installed public CLI did not execute drift --cache ${modo} with ${origem} extraction data.`);
  }
  const metricaEsperada = origem === "cache" ? cache.metricas?.hits : cache.metricas?.gravacoes;
  if (typeof metricaEsperada !== "number" || metricaEsperada < 1) {
    throw new Error(`The installed public CLI did not report the expected ${origem} cache metric.`);
  }
}

async function prepararFixtureDriftPublico(projetoCodex) {
  const configPath = path.join(projetoCodex, "sema.config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  await mkdir(path.join(projetoCodex, "src"), { recursive: true });
  await writeFile(path.join(projetoCodex, "contratos", "cache-smoke.sema"), `module app.cache_smoke {
  vinculos { arquivo: "src/service.ts" }
  task executar {
    input { valor: Texto required }
    output { ok: Booleano }
    impl { ts: service.executar }
    guarantees { ok existe }
  }
}
`, "utf8");
  await writeFile(path.join(projetoCodex, "src", "service.ts"), [
    "// SEMA-GOVERNED: app.cache_smoke",
    "// Descrição: implementação mínima para o smoke do cache público instalado.",
    "export function executar(valor: string) { return { ok: valor.length > 0 }; }",
    "",
  ].join("\n"), "utf8");
  await writeFile(configPath, `${JSON.stringify({
    ...config,
    diretoriosCodigo: ["./src"],
    fontesLegado: ["typescript"],
    pontuacaoSemanticaMinimaOperacional: 0,
    pontuacaoSemanticaAlvo: 0,
    pontuacaoSemanticaAlvoFinal: 0,
  }, null, 2)}\n`, "utf8");
  return "contratos/cache-smoke.sema";
}

function validarFronteiraDescoberta(payload, comando) {
  if (
    payload.schemaVersion !== "sema.discovery/v1" ||
    payload.success !== true ||
    payload.executed !== false ||
    payload.workspaceMutated !== false ||
    payload.externalCalls !== false ||
    payload.requiresExplicitRun !== true
  ) {
    throw new Error(`The installed public CLI broke the read-only discovery boundary for ${comando}.`);
  }
}

async function existe(caminho) {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

async function localizarTarball(versaoEsperada) {
  const nomeEsperado = `semacode-cli-${versaoEsperada}.tgz`;
  return await existe(path.join(pastaPacotes, nomeEsperado)) ? nomeEsperado : undefined;
}

async function main() {
  const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));
  const versaoEsperada = manifestCli.version;
  const tarball = await localizarTarball(versaoEsperada);
  if (!tarball) {
    throw new Error(`The exact npm package semacode-cli-${versaoEsperada}.tgz is missing. Run \`npm run cli:empacotar-publica\` first.`);
  }

  const caminhoTarball = path.join(pastaPacotes, tarball);
  await validarManifestSemDependenciasFile(caminhoTarball, versaoEsperada, raiz);
  await validarArtefatosDistribuicaoContraFonte(caminhoTarball, raiz);
  validarRuntimeLocalDireto(caminhoTarball, raiz);

  const sandbox = await mkdtemp(path.join(os.tmpdir(), "sema-cli-npm-"));

  try {
    const diretorioUsuarioLocalIsolado = path.join(sandbox, "home-local-isolada");
    const cacheNpmLocalIsolado = path.join(sandbox, "npm-cache-local-isolado");
    await mkdir(diretorioUsuarioLocalIsolado, { recursive: true });
    const ambienteLocal = {
      ...ambienteInstalacaoIsolada(diretorioUsuarioLocalIsolado, cacheNpmLocalIsolado),
      npm_config_global: "false",
      NPM_CONFIG_GLOBAL: "false",
    };
    await writeFile(
      path.join(sandbox, "package.json"),
      `${JSON.stringify({
        name: "sema-cli-npm-smoke",
        private: true,
        version: "0.0.0-smoke",
      }, null, 2)}\n`,
      "utf8",
    );

    const caminhosReaisAntesInstallLocal = caminhosEstadoSemaReal();
    const estadoRealAntesInstallLocal = await fingerprintCaminhos(caminhosReaisAntesInstallLocal);
    const caminhosPluginsLocal = caminhosCachePluginIsolado(
      diretorioUsuarioLocalIsolado,
      ambienteLocal,
    );
    const estadoPluginsAntesInstallLocal = await fingerprintCaminhos(caminhosPluginsLocal);
    executar("npm", ["install", caminhoTarball, "--no-audit", "--no-fund"], sandbox, {
      env: ambienteLocal,
      cacheNpm: cacheNpmLocalIsolado,
    });
    if (await existe(path.join(diretorioUsuarioLocalIsolado, ".agents"))
      || await existe(path.join(diretorioUsuarioLocalIsolado, ".sema"))) {
      throw new Error("A workspace-local npm install executed the global Sema distribution lifecycle.");
    }
    if (await fingerprintCaminhos(caminhosReaisAntesInstallLocal) !== estadoRealAntesInstallLocal) {
      throw new Error("The workspace-local npm install mutated a real HOME, workspace, or Sema cache target.");
    }
    if (await fingerprintCaminhos(caminhosPluginsLocal) !== estadoPluginsAntesInstallLocal ||
        (await Promise.all(caminhosPluginsLocal.map(existe))).some(Boolean)) {
      throw new Error("The workspace-local npm install created or mutated an AI plugin cache.");
    }
    const basePacote = path.join(sandbox, "node_modules", "@semacode", "cli");
    const semaBin = path.join(basePacote, "dist", "bin.js");
    const launcherNpm = path.join(
      sandbox,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "sema.cmd" : "sema",
    );
    const deepImport = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", "await import('@semacode/cli/dist/pipelineConteudo/trust.js')"],
      { cwd: sandbox, encoding: "utf8" },
    );
    if (deepImport.status === 0 || !/ERR_PACKAGE_PATH_NOT_EXPORTED/u.test(deepImport.stderr)) {
      throw new Error(`The installed public CLI did not block the internal pipeline deep import: ${deepImport.stderr}`);
    }
    const ajuda = await validarHelpPuroEControleJsonInstalado({
      semaBin,
      launcherNpm,
      basePacote,
      sandbox,
      versaoEsperada,
    });
    if (/\bpreflight\b/i.test(ajuda)) {
      throw new Error("The installed public CLI help still exposes the removed preflight command.");
    }
    for (const comando of ["sema descobrir", "sema pipeline", "sema capabilities", "sema interativo"]) {
      if (!ajuda.includes(comando)) {
        throw new Error(`The installed public CLI help is missing ${comando}.`);
      }
    }
    if (!ajuda.includes("sema conteudo capabilities --json") || !ajuda.includes("sema conteudo status")) {
      throw new Error("The installed public CLI help does not expose the AI-native content pipeline.");
    }

    validarPipelineConteudoInstalado({ semaBin, sandbox, executarComSaida });

    const importRaiz = spawnSync(process.execPath, [
      "--input-type=module",
      "--eval",
      "const api = await import('@semacode/cli'); process.stdout.write(JSON.stringify({ exemplos: typeof api.materializarExemplosOficiais, descoberta: typeof api.montarCatalogoCapacidades, interativo: typeof api.validarDefinicaoSistemaInterativo, ir: typeof api.validarExperienceIr, operacao: typeof api.validarSnapshotEngine, temporal: typeof api.validarContratoTemporalInterativo, autonomia: typeof api.validarCicloReparoAutonomo, portabilidade: typeof api.analisarPlanoPortabilidadeInterativa, extensaoCli: typeof api.executarExtensaoCliInterativa, controlRun: typeof api.validarControlRunInterativo }));",
    ], {
      cwd: sandbox,
      encoding: "utf8",
    });
    if (importRaiz.status !== 0) {
      throw new Error(`The installed public CLI root import failed: ${importRaiz.stderr}`);
    }
    const apiPublica = JSON.parse(importRaiz.stdout);
    if (
      importRaiz.stderr !== "" ||
      apiPublica.exemplos !== "function" ||
      apiPublica.descoberta !== "function" ||
      apiPublica.interativo !== "function" ||
      apiPublica.ir !== "function" ||
      apiPublica.operacao !== "function" ||
      apiPublica.temporal !== "function" ||
      apiPublica.autonomia !== "function" ||
      apiPublica.portabilidade !== "function" ||
      apiPublica.extensaoCli !== "function" ||
      apiPublica.controlRun !== "function"
    ) {
      throw new Error("The installed public CLI root import executed the bin or omitted a public API.");
    }

    const catalogoDescoberta = executarJsonCliInstalada(semaBin, ["descobrir", "catalogo"], sandbox);
    validarFronteiraDescoberta(catalogoDescoberta, "descobrir catalogo");
    if (
      catalogoDescoberta.mode !== "catalog" ||
      !catalogoDescoberta.entries?.some((item) => item.id === "simulation.calibrate")
    ) {
      throw new Error("The installed public CLI discovery catalog omitted simulation.calibrate.");
    }

    const recomendacaoDescoberta = executarJsonCliInstalada(
      semaBin,
      ["descobrir", "recomendar", "--intencao", "simulador 3D autônomo calibrado"],
      sandbox,
    );
    validarFronteiraDescoberta(recomendacaoDescoberta, "descobrir recomendar");
    if (
      recomendacaoDescoberta.mode !== "ranking" ||
      recomendacaoDescoberta.noMatch !== false ||
      recomendacaoDescoberta.recommendations?.[0]?.id !== "simulation.calibrate"
    ) {
      throw new Error("The installed public CLI did not recommend the calibrated simulation pipeline.");
    }

    const pipelinesDescoberta = executarJsonCliInstalada(semaBin, ["pipeline", "listar"], sandbox);
    validarFronteiraDescoberta(pipelinesDescoberta, "pipeline listar");
    if (
      !pipelinesDescoberta.entries?.some((item) => item.id === "simulation.calibrate") ||
      !pipelinesDescoberta.entries?.every((item) => item.kind === "ORCHESTRATION_PIPELINE")
    ) {
      throw new Error("The installed public CLI pipeline alias returned an invalid catalog.");
    }

    const capabilitiesDescoberta = executarJsonCliInstalada(semaBin, ["capabilities"], sandbox);
    validarFronteiraDescoberta(capabilitiesDescoberta, "capabilities");
    if (
      capabilitiesDescoberta.mode !== "catalog" ||
      capabilitiesDescoberta.entries?.map((item) => item.id).join("\n") !==
        catalogoDescoberta.entries?.map((item) => item.id).join("\n")
    ) {
      throw new Error("The installed public CLI capabilities alias diverged from the discovery catalog.");
    }

    const versao = executarComSaida(process.execPath, [semaBin, "--version"], sandbox).trim();
    if (versao !== versaoEsperada) {
      throw new Error(`The installed public CLI returned ${versao}; expected ${versaoEsperada}.`);
    }
    await validarInstalacaoGlobalIsolada({
      caminhoTarball,
      sandbox,
      versaoEsperada,
      executar,
      existe,
      raizWorkspace: raiz,
    });

    const preflightRemovido = spawnSync(process.execPath, [semaBin, "preflight", "resumo", "--json"], {
      cwd: sandbox,
      encoding: "utf8",
    });
    if (preflightRemovido.status === 0) {
      throw new Error("The installed public CLI still executes the removed preflight command.");
    }

    const raizCacheBootstrap = path.join(sandbox, "cache-bootstrap-isolado");
    const projetoCodex = await validarBootstrapCodexInstalado({
      semaBin,
      sandbox,
      executarComSaida,
      existe,
      exemplosInterativosPublicos: EXEMPLOS_INTERATIVOS_PUBLICOS,
      opcoesExecucao: { env: ambienteCacheIsolado(raizCacheBootstrap) },
    });
    const cacheBootstrapEsperado = process.platform === "win32"
      ? path.join(raizCacheBootstrap, "Sema", "Cache")
      : process.platform === "darwin"
        ? path.join(raizCacheBootstrap, "Library", "Caches", "Sema")
        : path.join(raizCacheBootstrap, "sema");
    if (!(await existe(cacheBootstrapEsperado))) {
      throw new Error("Installed sync-codex did not publish fresh drift into the isolated bootstrap cache.");
    }

    const contratoCache = await prepararFixtureDriftPublico(projetoCodex);
    const raizCacheDrift = path.join(sandbox, "cache-drift-isolado");
    const opcoesCache = { env: ambienteCacheIsolado(raizCacheDrift) };
    const resumoSemDrift = executarJsonCliInstalada(
      semaBin,
      ["resumo", contratoCache, "--micro"],
      projetoCodex,
      opcoesCache,
    );
    validarConsultaSemDrift(resumoSemDrift, "resumo");
    const inspecaoSemDrift = executarJsonCliInstalada(
      semaBin,
      ["inspecionar", contratoCache],
      projetoCodex,
      opcoesCache,
    );
    validarConsultaSemDrift(inspecaoSemDrift, "inspecionar");
    if (await existe(raizCacheDrift)) {
      throw new Error("Default resumo/inspecionar created persistent cache despite --drift none semantics.");
    }

    const driftFresh = executarJsonCliInstalada(
      semaBin,
      ["drift", contratoCache, "--escopo", "modulo", "--cache", "fresh"],
      projetoCodex,
      opcoesCache,
    );
    validarDriftComCache(driftFresh, "fresh", "calculado");
    const driftCache = executarJsonCliInstalada(
      semaBin,
      ["drift", contratoCache, "--escopo", "modulo", "--cache", "cache"],
      projetoCodex,
      opcoesCache,
    );
    validarDriftComCache(driftCache, "cache", "cache");

    const resumoSaida = executarComSaida(
      process.execPath,
      [semaBin, "resumo", path.join(raiz, "exemplos", "calculadora.sema"), "--micro", "--json"],
      sandbox,
    );
    const resumo = JSON.parse(resumoSaida);
    if (
      resumo.comando !== "resumo" ||
      resumo.modulo !== "exemplos.calculadora" ||
      resumo.analiseDrift?.modo !== "none" ||
      resumo.analiseDrift.executada !== false
    ) {
      throw new Error("The installed public CLI did not execute resumo directly against a local contract.");
    }

    executar(process.execPath, [semaBin, "validar", path.join(raiz, "exemplos", "calculadora.sema"), "--json"], sandbox);
    validarReadmePublico(await readFile(path.join(basePacote, "README.md"), "utf8"));
    await validarGeradoresInstalados({ semaBin, basePacote, sandbox, executarComSaida });

    for (const arquivoDoc of [
      "docs/cli.md",
      "docs/commands.md",
      "docs/descoberta-capacidades.md",
      "docs/documentation.md",
      "docs/drift-cache.md",
      "docs/pipeline-conteudo.md",
      "docs/security.md",
      "docs/sistemas-interativos.md",
      "docs/support.md",
    ]) {
      if (!(await existe(path.join(basePacote, arquivoDoc)))) {
        throw new Error(`The public package did not include ${arquivoDoc}.`);
      }
    }

    for (const arquivoExemplo of [
      "exemplos/profile_simulation.sema",
      ...EXEMPLOS_INTERATIVOS_PUBLICOS,
    ]) {
      if (!(await existe(path.join(basePacote, arquivoExemplo)))) {
        throw new Error(`The public package did not include ${arquivoExemplo}.`);
      }
    }

    await validarSistemasInterativosInstalados({
      semaBin,
      sandbox,
      projetoCodex,
      executarJsonCliInstalada,
    });

    for (const arquivoPrivado of [
      "AGENTS.md",
      "llms.txt",
      "llms-full.txt",
      "AGENT_CONTEXT_PACK.json",
      "SEMA_BRIEF.md",
      "SEMA_BRIEF.micro.txt",
      "SEMA_BRIEF.curto.txt",
      "SEMA_INDEX.json",
    ]) {
      if (await existe(path.join(basePacote, arquivoPrivado))) {
        throw new Error(`The public package still includes private workspace artifact ${arquivoPrivado}.`);
      }
    }

    for (const [profile, arquivo] of [
      ["software", "profile_software.sema"],
      ["workflow", "profile_workflow_n8n.sema"],
      ["ops", "profile_ops.sema"],
      ["game", "profile_game.sema"],
      ["simulation", "profile_simulation.sema"],
      ["legal", "profile_legal.sema"],
      ["research", "profile_research.sema"],
    ]) {
      const resultadoProfile = spawnSync(
        process.execPath,
        [semaBin, "profile", "validar", profile, path.join(basePacote, "exemplos", arquivo), "--json"],
        {
          cwd: sandbox,
          encoding: "utf8",
        },
      );
      if (resultadoProfile.status !== 0) {
        throw new Error(`The npm package failed profile ${profile}: ${resultadoProfile.stderr || resultadoProfile.stdout}`);
      }
      const jsonProfile = JSON.parse(resultadoProfile.stdout);
      if (!jsonProfile.aprovado || jsonProfile.bloqueado) {
        throw new Error(`The npm package did not approve the ${profile} example.`);
      }
    }

    const pacotesInternosAninhados = path.join(sandbox, "node_modules", "@semacode", "cli", "node_modules", "@sema");
    const pacotesInternosHoistados = path.join(sandbox, "node_modules", "@sema");
    if (!(await existe(pacotesInternosAninhados)) && !(await existe(pacotesInternosHoistados))) {
      throw new Error("The npm install did not load the expected bundled @sema packages.");
    }

    const geradorLuaAninhado = path.join(pacotesInternosAninhados, "gerador-lua", "package.json");
    const geradorLuaHoistado = path.join(pacotesInternosHoistados, "gerador-lua", "package.json");
    if (!(await existe(geradorLuaAninhado)) && !(await existe(geradorLuaHoistado))) {
      throw new Error("The npm install did not include @sema/gerador-lua.");
    }

    const manifestInstalado = JSON.parse(await readFile(path.join(basePacote, "package.json"), "utf8"));
    if (
      manifestInstalado.scripts?.postinstall !== "node scripts/postinstall.mjs" ||
      !(await existe(path.join(basePacote, "scripts", "postinstall.mjs"))) ||
      !(await existe(path.join(basePacote, "skills", "sema", "SKILL.md"))) ||
      !(await existe(path.join(basePacote, "skills", "sema", "agents", "openai.yaml")))
    ) {
      throw new Error("The installed public package omitted the global distribution lifecycle or bundled Sema skill.");
    }
    for (const [nome, versaoDeclarada] of Object.entries(manifestInstalado.dependencies ?? {}).filter(([nome]) => nome.startsWith("@sema/"))) {
      const relativo = nome.slice("@sema/".length);
      const aninhado = path.join(pacotesInternosAninhados, relativo, "package.json");
      const hoistado = path.join(pacotesInternosHoistados, relativo, "package.json");
      const caminhoManifesto = await existe(aninhado) ? aninhado : hoistado;
      const bundled = JSON.parse(await readFile(caminhoManifesto, "utf8"));
      if (bundled.version !== versaoDeclarada) {
        throw new Error(`Installed bundled dependency ${nome} is ${bundled.version}; manifest declares ${versaoDeclarada}.`);
      }
    }
  } finally {
    await rm(sandbox, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 });
  }
}

function executadoDiretamente() {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (executadoDiretamente()) {
  main().catch((erro) => {
    console.error("Failed to validate the public local-only Sema CLI package.");
    console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
    process.exit(1);
  });
}
