// SEMA-GOVERNED: sema.produto.cli_invocacao_publica
// Descrição: prova ajuda pura, controle v1 e resultado v1 sem alterar os payloads dos handlers.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { detectarHelpAntesDispatch } from "../../pacotes/cli/src/cliHelp.js";
import { ajuda } from "../../pacotes/cli/src/index.part01.js";
import { REGISTRO_COMANDOS } from "../../pacotes/cli/src/comandos.js";
import {
  criarEnvelopeControleJsonV1,
  executarInvocacaoPublica,
} from "../../pacotes/cli/src/saidaCli.js";
import { extrairPayloadResultadoCliV1 } from "../helpers/resultado-cli-v1.ts";

export const cli_invocacao_publica = "sema.cli.public-invocation/v1";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = path.join(RAIZ, "pacotes", "cli", "dist", "bin.js");
const CLI_LAUNCHER_INSTALADO = path.join(
  RAIZ,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "sema.cmd" : "sema",
);
const CONTRATO_EXEMPLO = path.join(RAIZ, "exemplos", "calculadora.sema");
const CHAVES_ENVELOPE_CONTROLE = [
  "code",
  "exitCode",
  "kind",
  "message",
  "ok",
  "schemaVersion",
] as const;
const COMANDOS_NAO_EXTRAIDOS_DA_AJUDA = [
  "ast",
  "dev",
  "gerar",
  "guard",
  "init",
  "ir",
  "sync",
] as const;

interface AmbienteIsolado {
  base: string;
  workspace: string;
  home: string;
  cache: string;
  temporarios: string;
  pathVazio: string;
  contrato: string;
  sentinelaPureza: string;
  env: NodeJS.ProcessEnv;
}

interface ResultadoCli {
  codigo: number | null;
  sinal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  erro?: NodeJS.ErrnoException;
}

type JsonObjeto = Record<string, unknown>;

function comandosPublicos(): string[] {
  const documentados = [...ajuda().matchAll(/\bsema ([a-z][a-z0-9-]*)/gu)]
    .map((ocorrencia) => ocorrencia[1]);
  return [...new Set([...documentados, ...COMANDOS_NAO_EXTRAIDOS_DA_AJUDA])].sort();
}

function normalizarRelativo(base: string, alvo: string): string {
  const relativo = path.relative(base, alvo).replaceAll(path.sep, "/");
  return relativo || ".";
}

async function fingerprintDiretorio(base: string): Promise<string[]> {
  const entradas: string[] = [];

  async function visitar(atual: string): Promise<void> {
    const estado = await lstat(atual, { bigint: true });
    const relativo = normalizarRelativo(base, atual);
    const metadados = `${estado.mode}:${estado.size}:${estado.mtimeNs}:${estado.ctimeNs}`;
    if (estado.isSymbolicLink()) {
      entradas.push(`L ${relativo} ${metadados} -> ${await readlink(atual)}`);
      return;
    }
    if (estado.isDirectory()) {
      entradas.push(`D ${relativo} ${metadados}`);
      const filhos = (await readdir(atual)).sort((a, b) => a.localeCompare(b));
      for (const filho of filhos) {
        await visitar(path.join(atual, filho));
      }
      return;
    }
    const conteudo = await readFile(atual);
    const digest = createHash("sha256").update(conteudo).digest("hex");
    entradas.push(`F ${relativo} ${metadados} sha256:${digest}`);
  }

  await visitar(base);
  return entradas;
}

async function existe(caminho: string): Promise<boolean> {
  try {
    await stat(caminho);
    return true;
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw erro;
  }
}

async function exigirAmbienteImutavel(
  ambiente: AmbienteIsolado,
  fingerprintAntes: readonly string[],
  contexto: string,
): Promise<void> {
  assert.equal(await existe(ambiente.sentinelaPureza), false, `efeito proibido durante ${contexto}`);
  assert.deepEqual(
    await fingerprintDiretorio(ambiente.base),
    fingerprintAntes,
    `ambiente alterado durante ${contexto}`,
  );
}

async function criarAmbienteIsolado(prefixo: string): Promise<AmbienteIsolado> {
  const base = await mkdtemp(path.join(os.tmpdir(), prefixo));
  const workspace = path.join(base, "workspace");
  const home = path.join(base, "home");
  const cache = path.join(base, "cache");
  const temporarios = path.join(base, "tmp");
  const pathVazio = path.join(base, "path-vazio");
  const appData = path.join(home, "AppData", "Roaming");
  const localAppData = path.join(home, "AppData", "Local");
  const codexHome = path.join(home, ".codex");
  const claudeHome = path.join(home, ".claude-test");
  await Promise.all([
    mkdir(workspace, { recursive: true }),
    mkdir(home, { recursive: true }),
    mkdir(cache, { recursive: true }),
    mkdir(temporarios, { recursive: true }),
    mkdir(pathVazio, { recursive: true }),
    mkdir(appData, { recursive: true }),
    mkdir(localAppData, { recursive: true }),
    mkdir(codexHome, { recursive: true }),
    mkdir(claudeHome, { recursive: true }),
  ]);

  const contrato = path.join(workspace, "contrato.sema");
  await writeFile(contrato, await readFile(CONTRATO_EXEMPLO), { flag: "wx" });
  await Promise.all([
    writeFile(path.join(workspace, ".workspace-marker"), "workspace-imutavel\n", { flag: "wx" }),
    writeFile(path.join(home, ".home-marker"), "home-imutavel\n", { flag: "wx" }),
    writeFile(path.join(cache, ".cache-marker"), "cache-imutavel\n", { flag: "wx" }),
    writeFile(path.join(temporarios, ".tmp-marker"), "tmp-imutavel\n", { flag: "wx" }),
  ]);

  const sentinelaPureza = path.join(base, "PUREZA_HELP_VIOLADA.txt");
  const preload = path.join(base, "cli-help-purity-preload.cjs");
  await writeFile(preload, [
    '"use strict";',
    'const childProcess = require("node:child_process");',
    'const fs = require("node:fs");',
    'const fsPromises = require("node:fs/promises");',
    'const dns = require("node:dns");',
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
    'const ajuda = process.env.SEMA_TEST_FORCE_HELP === "1"',
    '  || process.argv.slice(2).some((item) => item === "--help" || item === "-h");',
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
    'if (ajuda) {',
    '  for (const nome of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {',
    '    childProcess[nome] = bloquearSempre("child_process", nome);',
    '  }',
    '  for (const nome of ["access", "accessSync", "createReadStream", "existsSync", "lstat", "lstatSync", "open", "openSync", "readFile", "readFileSync", "readdir", "readdirSync", "readlink", "readlinkSync", "realpath", "realpathSync", "stat", "statSync", "watch", "watchFile"]) {',
    '    protegerLeitura(fs, nome);',
    '  }',
    '  for (const nome of ["access", "lstat", "open", "readFile", "readdir", "readlink", "realpath", "stat", "watch"]) {',
    '    protegerLeitura(fsPromises, nome);',
    '  }',
    '  for (const [objeto, nomes] of [[net, ["connect", "createConnection"]], [tls, ["connect"]], [http, ["get", "request"]], [https, ["get", "request"]], [dns, ["lookup", "resolve", "resolve4", "resolve6", "resolveAny", "reverse"]]]) {',
    '    for (const nome of nomes) objeto[nome] = bloquearSempre("network", nome);',
    '  }',
    '  if (net.Socket?.prototype) net.Socket.prototype.connect = bloquearSempre("network", "Socket.connect");',
    '  if (dns.Resolver?.prototype) {',
    '    for (const nome of ["resolve", "resolve4", "resolve6", "resolveAny", "reverse"]) {',
    '      if (typeof dns.Resolver.prototype[nome] === "function") dns.Resolver.prototype[nome] = bloquearSempre("network", `Resolver.${nome}`);',
    '    }',
    '  }',
    '  if (dns.promises) {',
    '    for (const nome of ["lookup", "resolve", "resolve4", "resolve6", "resolveAny", "reverse"]) {',
    '      if (typeof dns.promises[nome] === "function") dns.promises[nome] = bloquearSempre("network", `promises.${nome}`);',
    '    }',
    '  }',
    '  if (typeof globalThis.fetch === "function") globalThis.fetch = bloquearSempre("network", "fetch");',
    '  syncBuiltinESMExports();',
    '}',
    '',
  ].join("\n"), { flag: "wx" });

  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const chave of Object.keys(env)) {
    if (chave.toLowerCase() === "path") {
      delete env[chave];
    }
  }
  const raizHome = path.parse(home).root;
  Object.assign(env, {
    HOME: home,
    USERPROFILE: home,
    HOMEDRIVE: raizHome.replace(/[\\/]$/u, ""),
    HOMEPATH: home.slice(raizHome.length - 1),
    APPDATA: appData,
    LOCALAPPDATA: localAppData,
    XDG_CACHE_HOME: cache,
    npm_config_cache: path.join(cache, "npm"),
    NPM_CONFIG_CACHE: path.join(cache, "npm"),
    CODEX_HOME: codexHome,
    CLAUDE_CONFIG_DIR: claudeHome,
    TEMP: temporarios,
    TMP: temporarios,
    TMPDIR: temporarios,
    PATH: pathVazio,
    NO_COLOR: "1",
    NODE_NO_WARNINGS: "1",
    NODE_OPTIONS: `--require="${preload.replaceAll(path.sep, "/").replaceAll('"', '\\"')}"`,
    SEMA_TEST_PURITY_SENTINEL: sentinelaPureza,
    SEMA_TEST_PURITY_ROOTS: JSON.stringify([workspace, home, cache]),
  });

  return {
    base,
    workspace,
    home,
    cache,
    temporarios,
    pathVazio,
    contrato,
    sentinelaPureza,
    env,
  };
}

function executarCli(
  ambiente: AmbienteIsolado,
  args: readonly string[],
  timeout = 5_000,
): ResultadoCli {
  const resultado = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ambiente.workspace,
    env: ambiente.env,
    encoding: "utf8",
    timeout,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    codigo: resultado.status,
    sinal: resultado.signal,
    stdout: resultado.stdout ?? "",
    stderr: resultado.stderr ?? "",
    erro: resultado.error as NodeJS.ErrnoException | undefined,
  };
}

function executarLauncherInstalado(
  ambiente: AmbienteIsolado,
  args: readonly string[],
  timeout = 5_000,
): ResultadoCli {
  const env = { ...ambiente.env };
  for (const chave of Object.keys(env)) {
    if (chave.toLowerCase() === "path") delete env[chave];
  }
  env.PATH = process.env.PATH ?? process.env.Path ?? path.dirname(process.execPath);

  const resultado = process.platform === "win32"
    ? (() => {
        const systemRoot = env.SystemRoot?.trim();
        const cmd = path.join(
          systemRoot && path.isAbsolute(systemRoot) ? systemRoot : "C:\\Windows",
          "System32",
          "cmd.exe",
        );
        if ([CLI_LAUNCHER_INSTALADO, ...args].some((valor) => /[\0\r\n"]/u.test(valor))) {
          throw new Error("Launcher ou argumento incompatível com cmd.exe.");
        }
        const envLauncher = {
          ...env,
          SEMA_TEST_CHCP: path.join(path.dirname(cmd), "chcp.com"),
          SEMA_TEST_LAUNCHER: CLI_LAUNCHER_INSTALADO,
        };
        const referencias = ['"%SEMA_TEST_LAUNCHER%"'];
        args.forEach((argumento, indice) => {
          const nome = `SEMA_TEST_ARG_${indice}`;
          envLauncher[nome] = argumento;
          referencias.push(`"%${nome}%"`);
        });
        return spawnSync(cmd, [
          "/d",
          "/s",
          "/v:off",
          "/c",
          `""%SEMA_TEST_CHCP%" 65001>nul & ${referencias.join(" ")}`,
        ], {
          cwd: ambiente.workspace,
          env: envLauncher,
          encoding: "utf8",
          timeout,
          maxBuffer: 16 * 1024 * 1024,
          windowsHide: true,
          windowsVerbatimArguments: true,
        });
      })()
    : spawnSync(CLI_LAUNCHER_INSTALADO, [...args], {
        cwd: ambiente.workspace,
        env,
        encoding: "utf8",
        timeout,
        maxBuffer: 16 * 1024 * 1024,
      });
  return {
    codigo: resultado.status,
    sinal: resultado.signal,
    stdout: resultado.stdout ?? "",
    stderr: resultado.stderr ?? "",
    erro: resultado.error as NodeJS.ErrnoException | undefined,
  };
}

function descreverFalha(args: readonly string[], resultado: ResultadoCli): string {
  return [
    `args=${JSON.stringify(args)}`,
    `codigo=${String(resultado.codigo)}`,
    `sinal=${String(resultado.sinal)}`,
    `erro=${resultado.erro?.code ?? resultado.erro?.message ?? "nenhum"}`,
    `stdout=${JSON.stringify(resultado.stdout.slice(0, 500))}`,
    `stderr=${JSON.stringify(resultado.stderr.slice(0, 500))}`,
  ].join(" ");
}

function exigirExecucao(
  args: readonly string[],
  resultado: ResultadoCli,
  codigoEsperado: number,
): void {
  assert.equal(resultado.erro, undefined, descreverFalha(args, resultado));
  assert.equal(resultado.codigo, codigoEsperado, descreverFalha(args, resultado));
  assert.equal(resultado.sinal, null, descreverFalha(args, resultado));
}

function extrairPayloadExecucao(args: readonly string[], resultado: ResultadoCli): unknown {
  return extrairPayloadResultadoCliV1(resultado.stdout, {
    command: args[0] ?? "",
    exitCode: resultado.codigo,
  });
}

function parseJsonUnico(stdout: string): unknown {
  const texto = stdout.trim();
  assert.notEqual(texto, "", "stdout JSON não pode ficar vazio");
  return JSON.parse(texto) as unknown;
}

function exigirObjeto(valor: unknown): JsonObjeto {
  assert.ok(valor && typeof valor === "object" && !Array.isArray(valor));
  return valor as JsonObjeto;
}

function exigirEnvelopeControle(
  stdout: string,
  esperado: {
    kind: "HELP" | "UNKNOWN_COMMAND" | "ARGUMENT_ERROR" | "FATAL_ERROR";
    code: "CLI_HELP" | "CLI_UNKNOWN_COMMAND" | "CLI_ARGUMENT_ERROR" | "CLI_FATAL_ERROR";
    exitCode: number;
    ok: boolean;
  },
): JsonObjeto {
  const envelope = exigirObjeto(parseJsonUnico(stdout));
  assert.deepEqual(Object.keys(envelope).sort(), [...CHAVES_ENVELOPE_CONTROLE].sort());
  assert.equal(envelope.schemaVersion, "sema.cli.control/v1");
  assert.equal(envelope.ok, esperado.ok);
  assert.equal(envelope.kind, esperado.kind);
  assert.equal(envelope.code, esperado.code);
  assert.equal(envelope.exitCode, esperado.exitCode);
  assert.equal(typeof envelope.message, "string");
  assert.notEqual((envelope.message as string).trim(), "");
  return envelope;
}

function exigirSemEnvelopeControle(payload: unknown): void {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return;
  }
  const objeto = payload as JsonObjeto;
  assert.notEqual(objeto.schemaVersion, "sema.cli.control/v1");
  assert.equal("kind" in objeto && "code" in objeto && "exitCode" in objeto, false);
}

async function capturarConsole<T>(acao: () => T | Promise<T>): Promise<{
  resultado: T;
  stdout: string[];
  stderr: string[];
}> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logOriginal = console.log;
  const errorOriginal = console.error;
  console.log = (...itens: unknown[]) => stdout.push(itens.map(String).join(" "));
  console.error = (...itens: unknown[]) => stderr.push(itens.map(String).join(" "));
  try {
    return { resultado: await acao(), stdout, stderr };
  } finally {
    console.log = logOriginal;
    console.error = errorOriginal;
  }
}

test("resolver puro detecta help antes de validar comando, opções ou terminador", () => {
  assert.deepEqual(
    detectarHelpAntesDispatch(["comando-inexistente", "--opcao", "valor", "--help"]),
    {
      ajudaSolicitada: true,
      modoJson: false,
      encerrarAntesDispatch: true,
      dispatchPermitido: false,
      handlerResolvido: false,
      codigoSaida: 0,
      helpEmQualquerPosicaoRespeitado: true,
    },
  );
  assert.deepEqual(
    detectarHelpAntesDispatch(["validar", "arquivo.sema", "--json", "-h"]),
    {
      ajudaSolicitada: true,
      modoJson: true,
      encerrarAntesDispatch: true,
      dispatchPermitido: false,
      handlerResolvido: false,
      codigoSaida: 0,
      helpEmQualquerPosicaoRespeitado: true,
    },
  );
  assert.equal(detectarHelpAntesDispatch(["compilar", "--saida", "--help"]).ajudaSolicitada, true);
  assert.equal(detectarHelpAntesDispatch(["validar", "--", "--help"]).ajudaSolicitada, true);
  assert.deepEqual(
    detectarHelpAntesDispatch(["validar", "arquivo.sema", "--json"]),
    {
      ajudaSolicitada: false,
      modoJson: true,
      encerrarAntesDispatch: false,
      dispatchPermitido: true,
      handlerResolvido: false,
      codigoSaida: 0,
      helpEmQualquerPosicaoRespeitado: true,
    },
  );
  assert.equal(detectarHelpAntesDispatch(["--help=nao"]).ajudaSolicitada, false);
  assert.equal(detectarHelpAntesDispatch(["--HELP"]).ajudaSolicitada, false);
});

test("saída de controle fecha caminhos, percent-encoding e stacks inline", async () => {
  const mensagensHostis = [
    "segredo=/tmp/credencial",
    "segredo=file:/tmp/credencial",
    "segredo=file:///tmp/credencial",
    "segredo=C:\\Users\\pessoa\\credencial.txt",
    "segredo=\\\\servidor\\share\\credencial.txt",
    "segredo, /var/lib/sema/credencial",
    "segredo=%2Ftmp%2Fcredencial",
    "segredo=%252Ftmp%252Fcredencial",
    "segredo=%25252Ftmp%25252Fcredencial",
    "segredo=file%3A%2Ftmp%2Fcredencial",
    "segredo=C%253A%252FUsers%252Fpessoa%252Fcredencial.txt",
    "segredo=%25252F%25252Fservidor%25252Fshare%25252Fcredencial.txt",
    "segredo;(/opt/sema/credencial)",
    "falhou at executar (modulo-interno.js:12:34)",
    "TypeError: falha interna sem caminho",
  ];

  for (const mensagemPublica of mensagensHostis) {
    const envelopeHelp = criarEnvelopeControleJsonV1({
      categoria: "HELP",
      codigoPublico: "CLI_HELP",
      mensagemPublica,
      codigoSaida: 0,
    });
    assert.equal(envelopeHelp.message, "Ajuda da CLI Sema.", mensagemPublica);
  }

  const ajudaSegura = "Ajuda pública segura: https://sema.example/docs e sem estado local.";
  assert.equal(criarEnvelopeControleJsonV1({
    categoria: "HELP",
    codigoPublico: "CLI_HELP",
    mensagemPublica: ajudaSegura,
    codigoSaida: 0,
  }).message, ajudaSegura);

  for (const categoria of ["UNKNOWN_COMMAND", "ARGUMENT_ERROR", "FATAL_ERROR"] as const) {
    const envelope = criarEnvelopeControleJsonV1({
      categoria,
      codigoPublico: `CLI_${categoria}`,
      mensagemPublica: "argv-secreto=/tmp/credencial at executar (interno.js:1:2)",
      codigoSaida: 1,
    });
    assert.equal(envelope.message.includes("argv-secreto"), false);
    assert.equal(envelope.message.includes("/tmp"), false);

    const emissao = await capturarConsole(() => executarInvocacaoPublica({
      resultado: categoria,
      modoJson: true,
      envelopeControle: {
        ...envelope,
        message: "Error: argv-secreto at executar (interno.js:1:2)",
      },
    }));
    assert.equal(emissao.resultado.codigoSaida, 1);
    assert.deepEqual(emissao.stderr, []);
    assert.equal(emissao.stdout.length, 1);
    const emitido = exigirEnvelopeControle(emissao.stdout[0], {
      kind: categoria,
      code: `CLI_${categoria}`,
      exitCode: 1,
      ok: false,
    });
    assert.equal((emitido.message as string).includes("argv-secreto"), false);
  }
});

test("sentinela de pureza bloqueia leitura, subprocesso e rede de verdade", async () => {
  const ambiente = await criarAmbienteIsolado("sema-cli-help-sentinela-");
  try {
    const alvoLeitura = path.join(ambiente.workspace, ".workspace-marker");
    const probe = [
      'const fs = require("node:fs");',
      'const childProcess = require("node:child_process");',
      'const net = require("node:net");',
      'for (const acao of [',
      '  () => fs.readFileSync(process.env.SEMA_TEST_READ_TARGET, "utf8"),',
      '  () => childProcess.spawnSync(process.execPath, ["--version"]),',
      '  () => net.connect({ host: "localhost", port: 9 }),',
      ']) {',
      '  try { acao(); } catch (erro) {',
      '    if (erro?.code !== "SEMA_TEST_HELP_PURITY_BLOCKED") throw erro;',
      '  }',
      '}',
    ].join("\n");
    const resultado = spawnSync(process.execPath, ["--eval", probe], {
      cwd: ambiente.base,
      env: {
        ...ambiente.env,
        SEMA_TEST_FORCE_HELP: "1",
        SEMA_TEST_READ_TARGET: alvoLeitura,
      },
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    });
    assert.equal(resultado.error, undefined);
    assert.equal(resultado.status, 0, resultado.stderr);
    const eventos = await readFile(ambiente.sentinelaPureza, "utf8");
    assert.match(eventos, /^read:readFileSync:/mu);
    assert.match(eventos, /^child_process:spawnSync:/mu);
    assert.match(eventos, /^network:connect:/mu);
  } finally {
    await rm(ambiente.base, { recursive: true, force: true });
  }
});

test("todos os 43 comandos públicos encerram --help e -h sem dispatch, PATH ou mutação", async () => {
  const ambiente = await criarAmbienteIsolado("sema-cli-help-matriz-");
  try {
    const comandos = comandosPublicos();
    assert.equal(comandos.length, 43, JSON.stringify(comandos));
    assert.equal(new Set(comandos).size, comandos.length);
    for (const registrado of Object.keys(REGISTRO_COMANDOS)) {
      assert.ok(comandos.includes(registrado), `handler público ausente da matriz: ${registrado}`);
    }

    const antes = await fingerprintDiretorio(ambiente.base);
    const falhas: string[] = [];
    let totalFalhas = 0;
    for (const comando of comandos) {
      for (const flag of ["--help", "-h"] as const) {
        const args = [comando, flag];
        const resultado = executarCli(ambiente, args, comando === "dev" ? 2_500 : 5_000);
        if (
          resultado.erro
          || resultado.codigo !== 0
          || resultado.sinal !== null
          || resultado.stderr.trim() !== ""
          || resultado.stdout.trim() === ""
          || resultado.stdout.includes("SUBPROCESS_BLOCKED")
        ) {
          totalFalhas += 1;
          if (falhas.length < 12) {
            falhas.push(descreverFalha(args, resultado));
          }
        }
        await exigirAmbienteImutavel(ambiente, antes, args.join(" "));
      }
    }
    if (totalFalhas > falhas.length) {
      falhas.push(`... e mais ${totalFalhas - falhas.length} falha(s)`);
    }
    assert.deepEqual(falhas, []);
    await exigirAmbienteImutavel(ambiente, antes, "matriz completa de help");
  } finally {
    await rm(ambiente.base, { recursive: true, force: true });
  }
});

test("launcher npm instalado preserva help e emite result/v1 para handler válido", async () => {
  const ambiente = await criarAmbienteIsolado("sema-cli-help-launcher-");
  try {
    assert.equal(await existe(CLI_LAUNCHER_INSTALADO), true);
    const antes = await fingerprintDiretorio(ambiente.base);
    for (const args of [
      ["--help"],
      ["iniciar", "--help", "--json"],
    ] as const) {
      const resultado = executarLauncherInstalado(ambiente, args);
      exigirExecucao(args, resultado, 0);
      assert.equal(resultado.stderr, "", descreverFalha(args, resultado));
      assert.notEqual(resultado.stdout.trim(), "", descreverFalha(args, resultado));
      if (args.includes("--json")) {
        exigirEnvelopeControle(resultado.stdout, {
          kind: "HELP",
          code: "CLI_HELP",
          exitCode: 0,
          ok: true,
        });
      }
      await exigirAmbienteImutavel(ambiente, antes, `launcher instalado ${args.join(" ")}`);
    }

    const validarArgs = ["validar", ambiente.contrato, "--json"] as const;
    const validar = executarLauncherInstalado(ambiente, validarArgs, 10_000);
    exigirExecucao(validarArgs, validar, 0);
    assert.equal(validar.stderr, "", descreverFalha(validarArgs, validar));
    const payloadValidar = exigirObjeto(extrairPayloadExecucao(validarArgs, validar));
    assert.equal(payloadValidar.valido, true);
    await exigirAmbienteImutavel(ambiente, antes, "launcher instalado validar --json");
  } finally {
    await rm(ambiente.base, { recursive: true, force: true });
  }
});

test("help profundo neutraliza casos armados que escreveriam, observariam ou iniciariam processos", async () => {
  const ambiente = await criarAmbienteIsolado("sema-cli-help-armado-");
  try {
    const saida = (nome: string) => path.join(ambiente.workspace, nome);
    const casos: ReadonlyArray<readonly string[]> = [
      ["iniciar", "--template", "base", "--help"],
      ["init", "--template", "api-rest", "--saida", saida("init.sema"), "--modulo", "app.init", "-h"],
      ["dev", "--pasta", ambiente.workspace, "--modo", "rigoroso", "--help"],
      ["sync", "prisma", "--gerar", ambiente.workspace, saida("sync"), "-h"],
      ["guard", "on", "--help"],
      ["formatar", ambiente.contrato, "-h"],
      ["compilar", ambiente.contrato, "--alvo", "typescript", "--saida", saida("compilado"), "--help"],
      ["gerar", "typescript", ambiente.contrato, "--saida", saida("gerado"), "-h"],
      ["testar", ambiente.contrato, "--alvo", "javascript", "--saida", saida("testado"), "--help"],
      ["verificar", ambiente.contrato, "--saida", saida("verificado"), "-h"],
      ["importar", "typescript", ambiente.workspace, "--saida", saida("importado"), "--help"],
      ["author", "iniciar", "--saida", saida("author.sema"), "-h"],
      ["docs-impacto", "--intencao", "criar documentação", "--arquivo", "docs/ausente.md", "--criar-ausentes", "--help"],
      ["contexto-ia", ambiente.contrato, "--saida", saida("contexto"), "-h"],
      ["resumo", ambiente.contrato, "--raiz", "--saida", saida("resumo"), "--help"],
      ["sync-codex", "-h"],
      ["instalar-exemplos", "--help"],
      ["skill", "sync", "-h"],
    ];
    const antes = await fingerprintDiretorio(ambiente.base);
    for (const args of casos) {
      const resultado = executarCli(ambiente, args, args[0] === "dev" ? 2_500 : 6_000);
      exigirExecucao(args, resultado, 0);
      assert.equal(resultado.stderr.trim(), "", descreverFalha(args, resultado));
      assert.notEqual(resultado.stdout.trim(), "", descreverFalha(args, resultado));
      await exigirAmbienteImutavel(ambiente, antes, args.join(" "));
    }
    await exigirAmbienteImutavel(ambiente, antes, "casos armados de help");
  } finally {
    await rm(ambiente.base, { recursive: true, force: true });
  }
});

test("help JSON é documento único, redigido e continua rico para o pipeline de conteúdo", async () => {
  const ambiente = await criarAmbienteIsolado("sema-cli-help-json-");
  try {
    const antes = await fingerprintDiretorio(ambiente.base);
    const raiz = executarCli(ambiente, ["--help", "--json"]);
    exigirExecucao(["--help", "--json"], raiz, 0);
    assert.equal(raiz.stderr, "");
    exigirEnvelopeControle(raiz.stdout, {
      kind: "HELP",
      code: "CLI_HELP",
      exitCode: 0,
      ok: true,
    });
    await exigirAmbienteImutavel(ambiente, antes, "--help --json");

    const segredo = "comando-super-secreto-nao-deve-ser-ecoado";
    const desconhecidoComHelp = executarCli(ambiente, [segredo, "--opcao", "valor", "--json", "-h"]);
    exigirExecucao([segredo, "--opcao", "valor", "--json", "-h"], desconhecidoComHelp, 0);
    assert.equal(desconhecidoComHelp.stderr, "");
    exigirEnvelopeControle(desconhecidoComHelp.stdout, {
      kind: "HELP",
      code: "CLI_HELP",
      exitCode: 0,
      ok: true,
    });
    assert.equal(desconhecidoComHelp.stdout.includes(segredo), false);
    await exigirAmbienteImutavel(ambiente, antes, `${segredo} --json -h`);

    const conteudoTexto = executarCli(ambiente, ["conteudo", "--help"]);
    exigirExecucao(["conteudo", "--help"], conteudoTexto, 0);
    assert.match(conteudoTexto.stdout, /sema conteudo validar-envelope/u);
    assert.match(conteudoTexto.stdout, /nextActions/u);
    assert.match(conteudoTexto.stdout, /Não existe revisão humana nativa/u);
    await exigirAmbienteImutavel(ambiente, antes, "conteudo --help");

    const conteudoJson = executarCli(ambiente, ["conteudo", "--help", "--json"]);
    exigirExecucao(["conteudo", "--help", "--json"], conteudoJson, 0);
    assert.equal(conteudoJson.stderr, "");
    const envelopeConteudo = exigirEnvelopeControle(conteudoJson.stdout, {
      kind: "HELP",
      code: "CLI_HELP",
      exitCode: 0,
      ok: true,
    });
    assert.match(envelopeConteudo.message as string, /sema conteudo validar-envelope/u);
    assert.match(envelopeConteudo.message as string, /nextActions/u);
    assert.match(envelopeConteudo.message as string, /Não existe revisão humana nativa/u);
    await exigirAmbienteImutavel(ambiente, antes, "conteudo --help --json");
  } finally {
    await rm(ambiente.base, { recursive: true, force: true });
  }
});

test("comando desconhecido, argumento inválido e falha fatal JSON usam controle estável sem vazamento", async () => {
  const ambiente = await criarAmbienteIsolado("sema-cli-controle-json-");
  try {
    const antes = await fingerprintDiretorio(ambiente.base);
    const tokenSecreto = "comando-inexistente-segredo-7f3a";
    const desconhecido = executarCli(ambiente, [tokenSecreto, "--json"]);
    exigirExecucao([tokenSecreto, "--json"], desconhecido, 1);
    assert.equal(desconhecido.stderr, "");
    exigirEnvelopeControle(desconhecido.stdout, {
      kind: "UNKNOWN_COMMAND",
      code: "CLI_UNKNOWN_COMMAND",
      exitCode: 1,
      ok: false,
    });
    assert.equal(desconhecido.stdout.includes(tokenSecreto), false);
    await exigirAmbienteImutavel(ambiente, antes, `${tokenSecreto} --json`);

    const argumento = executarCli(ambiente, ["importar", "--json"]);
    exigirExecucao(["importar", "--json"], argumento, 1);
    assert.equal(argumento.stderr, "");
    exigirEnvelopeControle(argumento.stdout, {
      kind: "ARGUMENT_ERROR",
      code: "CLI_ARGUMENT_ERROR",
      exitCode: 1,
      ok: false,
    });
    await exigirAmbienteImutavel(ambiente, antes, "importar --json inválido");

    const arquivoSecreto = path.join(ambiente.workspace, "credencial-super-secreta-nao-existe.sema");
    const fatal = executarCli(ambiente, ["ast", arquivoSecreto, "--json"]);
    exigirExecucao(["ast", "<redigido>", "--json"], fatal, 1);
    assert.equal(fatal.stderr, "");
    exigirEnvelopeControle(fatal.stdout, {
      kind: "FATAL_ERROR",
      code: "CLI_FATAL_ERROR",
      exitCode: 1,
      ok: false,
    });
    assert.equal(fatal.stdout.includes(arquivoSecreto), false);
    assert.equal(fatal.stdout.includes(path.basename(arquivoSecreto)), false);
    assert.doesNotMatch(fatal.stdout, /\n\s*at\s/u);
    assert.doesNotMatch(fatal.stdout, /Error:/u);
    await exigirAmbienteImutavel(ambiente, antes, "falha fatal JSON");
  } finally {
    await rm(ambiente.base, { recursive: true, force: true });
  }
});

test("bin real rejeita dev watch JSON antes do watcher e conclui promoção JSON finita", async () => {
  const ambiente = await criarAmbienteIsolado("sema-cli-dev-json-");
  try {
    const antes = await fingerprintDiretorio(ambiente.base);
    ambiente.env.SEMA_TEST_FORCE_HELP = "1";

    const watchArgs = ["dev", "--json"] as const;
    const watch = executarCli(ambiente, watchArgs, 2_500);
    exigirExecucao(watchArgs, watch, 1);
    assert.equal(watch.stderr, "", descreverFalha(watchArgs, watch));
    exigirEnvelopeControle(watch.stdout, {
      kind: "ARGUMENT_ERROR",
      code: "CLI_ARGUMENT_ERROR",
      exitCode: 1,
      ok: false,
    });
    await exigirAmbienteImutavel(ambiente, antes, "dev --json sem watcher");

    delete ambiente.env.SEMA_TEST_FORCE_HELP;
    const promoverArgs = ["dev", "--promover", ambiente.contrato, "--json"] as const;
    const promover = executarCli(ambiente, promoverArgs, 10_000);
    exigirExecucao(promoverArgs, promover, 0);
    assert.equal(promover.stderr, "", descreverFalha(promoverArgs, promover));
    const payloadPromocao = extrairPayloadExecucao(promoverArgs, promover);
    assert.equal(typeof payloadPromocao, "string");
    assert.match(payloadPromocao as string, /Promovido com sucesso/u);
    await exigirAmbienteImutavel(ambiente, antes, "dev --promover --json finito");
  } finally {
    await rm(ambiente.base, { recursive: true, force: true });
  }
});

test("invocações válidas usam result/v1 e preservam os payloads dos handlers", async () => {
  const ambiente = await criarAmbienteIsolado("sema-cli-json-legado-");
  try {
    const antes = await fingerprintDiretorio(ambiente.base);

    const validarArgs = ["validar", ambiente.contrato, "--json"] as const;
    const validar = executarCli(ambiente, validarArgs, 10_000);
    exigirExecucao(validarArgs, validar, 0);
    assert.equal(validar.stderr, "");
    const payloadValidar = exigirObjeto(extrairPayloadExecucao(validarArgs, validar));
    assert.deepEqual(Object.keys(payloadValidar).sort(), [
      "advertencias",
      "bloqueia_acao",
      "erros",
      "proximo_passo_obrigatorio",
      "valido",
    ]);
    assert.equal(payloadValidar.valido, true);
    exigirSemEnvelopeControle(payloadValidar);

    const diagnosticosArgs = ["diagnosticos", ambiente.contrato, "--json"] as const;
    const diagnosticos = executarCli(ambiente, diagnosticosArgs, 10_000);
    exigirExecucao(diagnosticosArgs, diagnosticos, 0);
    assert.equal(diagnosticos.stderr, "");
    const payloadDiagnosticos = extrairPayloadExecucao(diagnosticosArgs, diagnosticos);
    assert.ok(Array.isArray(payloadDiagnosticos));
    exigirSemEnvelopeControle(payloadDiagnosticos);

    const descobertaArgs = ["descobrir", "catalogo", "--json"] as const;
    const descoberta = executarCli(ambiente, descobertaArgs, 15_000);
    exigirExecucao(descobertaArgs, descoberta, 0);
    assert.equal(descoberta.stderr, "");
    const payloadDescoberta = exigirObjeto(extrairPayloadExecucao(descobertaArgs, descoberta));
    assert.equal(payloadDescoberta.schemaVersion, "sema.discovery/v1");
    assert.equal(payloadDescoberta.command, "descobrir catalogo");
    assert.equal(payloadDescoberta.success, true);
    assert.ok(Array.isArray(payloadDescoberta.entries));
    exigirSemEnvelopeControle(payloadDescoberta);

    const resumoArgs = ["resumo", ambiente.contrato, "--micro", "--drift", "none", "--json"] as const;
    const resumo = executarCli(ambiente, resumoArgs, 15_000);
    exigirExecucao(resumoArgs, resumo, 0);
    assert.equal(resumo.stderr, "");
    const payloadResumo = exigirObjeto(extrairPayloadExecucao(resumoArgs, resumo));
    assert.equal(payloadResumo.comando, "resumo");
    assert.equal(payloadResumo.tamanho, "micro");
    assert.equal(exigirObjeto(payloadResumo.analiseDrift).modo, "none");
    assert.equal(exigirObjeto(payloadResumo.analiseDrift).executada, false);
    exigirSemEnvelopeControle(payloadResumo);

    const conteudoArgs = ["conteudo", "capabilities", "--json"] as const;
    const conteudo = executarCli(ambiente, conteudoArgs, 10_000);
    exigirExecucao(conteudoArgs, conteudo, 0);
    assert.equal(conteudo.stderr, "");
    const payloadConteudo = exigirObjeto(extrairPayloadExecucao(conteudoArgs, conteudo));
    assert.equal(payloadConteudo.sucesso, true);
    assert.equal(payloadConteudo.comando, "capabilities");
    assert.equal(payloadConteudo.runner, "external");
    exigirSemEnvelopeControle(payloadConteudo);

    const skillArgs = ["skill", "status", "--json"] as const;
    const skill = executarCli(ambiente, skillArgs, 10_000);
    exigirExecucao(skillArgs, skill, 1);
    assert.equal(skill.stderr, "");
    const payloadSkill = exigirObjeto(extrairPayloadExecucao(skillArgs, skill));
    assert.equal(payloadSkill.schema, "sema.skill-distribution/v1");
    assert.equal(payloadSkill.comando, "skill");
    assert.equal(payloadSkill.operacao, "status");
    assert.equal(exigirObjeto(payloadSkill.resultado).alterado, false);
    exigirSemEnvelopeControle(payloadSkill);

    assert.equal(await existe(ambiente.sentinelaPureza), false);
    assert.deepEqual(await fingerprintDiretorio(ambiente.base), antes);
  } finally {
    await rm(ambiente.base, { recursive: true, force: true });
  }
});
