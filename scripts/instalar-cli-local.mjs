#!/usr/bin/env node
// SEMA-GOVERNED: sema.produto.fronteira_repositorios.empacotamento, sema.produto.distribuicao_global, sema.produto.distribuicao_global.instaladores
// Descrição: instala o tarball público local pelo npm absoluto e valida o launcher gerenciado sem depender de PATH.

import { readFileSync } from "node:fs";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolverDiretorioUsuario } from "../pacotes/cli/scripts/postinstall.mjs";

const raiz = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(raiz, "package.json"), "utf8"));
const manifestCli = JSON.parse(readFileSync(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));
const tarball = path.join(
  raiz,
  ".tmp",
  "pacotes-instalador-npm",
  `semacode-cli-${manifest.version}.tgz`,
);

function executar(comando, args, opcoes = {}) {
  const resultado = spawnSync(comando, args, {
    cwd: opcoes.cwd ?? raiz,
    env: opcoes.env ?? process.env,
    encoding: "utf8",
    input: opcoes.input,
    stdio: opcoes.stdio ?? "inherit",
    windowsHide: opcoes.windowsHide,
    windowsVerbatimArguments: opcoes.windowsVerbatimArguments,
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`Comando de instalação local falhou com exit code ${resultado.status}.`);
  }
  return resultado.stdout ?? "";
}

const PADRAO_SEMVER_EXATA = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*)))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function validarVersaoExata(valor, referencia = "versão") {
  if (typeof valor !== "string" || !PADRAO_SEMVER_EXATA.test(valor)) {
    throw new Error(`${referencia} deve ser SemVer exata.`);
  }
  return valor;
}

export function validarStatusDistribuicaoPronta(payload) {
  return payload?.sucesso === true
    && payload.operacao === "status"
    && payload.resultado?.estado === "READY"
    && payload.resultado?.launcher?.estado === "READY"
    && payload.resultado?.skill?.estado === "READY"
    && payload.resultado?.alterado === false;
}

export function validarAmbienteDiretorioUsuario(ambiente) {
  for (const nome of ["HOME", "USERPROFILE"]) {
    const valor = ambiente[nome]?.trim();
    if (valor && !path.isAbsolute(valor)) {
      throw new Error(`${nome} deve ser um caminho absoluto.`);
    }
  }
}

function exigirVersaoInstalada(saida, esperada, referencia) {
  const instalada = String(saida ?? "").trim();
  validarVersaoExata(instalada, referencia);
  if (instalada !== esperada) {
    throw new Error(`${referencia} retornou ${instalada}; esperado ${esperada}.`);
  }
}

function versaoPacoteGlobalInstalado(saida, nomePacote) {
  let payload;
  try {
    payload = JSON.parse(saida);
  } catch {
    throw new Error("npm retornou estado inválido para a instalação global.");
  }
  const instalada = payload?.dependencies?.[nomePacote]?.version;
  return validarVersaoExata(instalada, "versão global instalada");
}

function resolverComSpec(ambiente) {
  const systemRoot = ambiente.SystemRoot?.trim();
  return path.join(systemRoot && path.isAbsolute(systemRoot) ? systemRoot : "C:\\Windows", "System32", "cmd.exe");
}

function resolverPowerShellSpec(ambiente) {
  const systemRoot = ambiente.SystemRoot?.trim();
  return path.join(
    systemRoot && path.isAbsolute(systemRoot) ? systemRoot : "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
}

function prepararInvocacaoCmd(launcher, args, ambiente) {
  const valores = [launcher, ...args];
  if (valores.some((valor) => /[\0\r\n"]/u.test(valor))) {
    throw new Error("Launcher ou argumento contém caractere incompatível com cmd.exe.");
  }
  const env = {
    ...ambiente,
    SEMA_CHCP: path.join(
      ambiente.SystemRoot?.trim() && path.isAbsolute(ambiente.SystemRoot.trim())
        ? ambiente.SystemRoot.trim()
        : "C:\\Windows",
      "System32",
      "chcp.com",
    ),
    SEMA_LAUNCHER: launcher,
  };
  const referencias = ['"%SEMA_LAUNCHER%"'];
  args.forEach((arg, indice) => {
    const nome = `SEMA_ARG_${indice}`;
    env[nome] = arg;
    referencias.push(`"%${nome}%"`);
  });
  return {
    argumentos: [
      "/d",
      "/s",
      "/v:off",
      "/c",
      `""%SEMA_CHCP%" 65001>nul & ${referencias.join(" ")}"`,
    ],
    env,
  };
}

export function executarLauncherAbsoluto(launcher, args, opcoes = {}) {
  const ambiente = opcoes.env ?? process.env;
  if (process.platform !== "win32") {
    return executar(launcher, args, { ...opcoes, env: ambiente });
  }

  const invocacao = prepararInvocacaoCmd(launcher, args, ambiente);
  return executar(resolverComSpec(ambiente), invocacao.argumentos, {
    ...opcoes,
    env: invocacao.env,
    windowsHide: true,
    windowsVerbatimArguments: true,
  });
}

export function executarFallbackPowerShellAbsoluto(fallback, args, opcoes = {}) {
  const ambiente = opcoes.env ?? process.env;
  if (process.platform !== "win32") {
    return executar(fallback, args, { ...opcoes, env: ambiente });
  }
  return executar(resolverPowerShellSpec(ambiente), [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    fallback,
    ...args,
  ], {
    ...opcoes,
    env: ambiente,
    windowsHide: true,
  });
}

async function main() {
  const versaoEsperada = validarVersaoExata(manifest.version, "versão raiz");
  const versaoCli = validarVersaoExata(manifestCli.version, "versão da CLI");
  if (versaoCli !== versaoEsperada) {
    throw new Error(`Versões raiz e CLI divergentes: ${versaoEsperada} != ${versaoCli}.`);
  }
  validarAmbienteDiretorioUsuario(process.env);
  const home = resolverDiretorioUsuario(process.env, process.platform);
  const ambienteInstalacao = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
  };
  await access(tarball);
  const npmCli = process.env.npm_execpath;
  if (!npmCli || !path.isAbsolute(npmCli)) {
    throw new Error("npm_execpath absoluto é obrigatório para instalar sem depender de PATH.");
  }
  const cacheNpmIsolado = await mkdtemp(path.join(os.tmpdir(), "sema-cli-install-cache-"));
  try {
    executar(process.execPath, [
      npmCli,
      "install",
      "--global",
      "--foreground-scripts",
      "--no-audit",
      "--no-fund",
      "--cache",
      cacheNpmIsolado,
      tarball,
    ], { env: ambienteInstalacao });
  } finally {
    await rm(cacheNpmIsolado, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  const versaoInstalada = versaoPacoteGlobalInstalado(executar(process.execPath, [
    npmCli,
    "list",
    "--global",
    "--depth=0",
    "--json",
    manifestCli.name,
  ], { env: ambienteInstalacao, stdio: "pipe" }), manifestCli.name);
  if (versaoInstalada !== versaoEsperada) {
    throw new Error(`Versão global instalada ${versaoInstalada}; esperado ${versaoEsperada}.`);
  }

  const launcher = path.join(
    home,
    ".sema",
    "bin",
    process.platform === "win32" ? "sema.cmd" : "sema",
  );
  await access(launcher);
  const versaoLauncher = executarLauncherAbsoluto(launcher, ["--version"], {
    env: ambienteInstalacao,
    stdio: "pipe",
  });
  exigirVersaoInstalada(versaoLauncher, versaoInstalada, "launcher gerenciado");
  const fallback = process.platform === "win32"
    ? path.join(home, ".sema", "bin", "sema-managed.ps1")
    : launcher;
  await access(fallback);
  const versaoFallback = executarFallbackPowerShellAbsoluto(fallback, ["--version"], {
    env: ambienteInstalacao,
    stdio: "pipe",
  });
  exigirVersaoInstalada(versaoFallback, versaoInstalada, "fallback gerenciado");

  let status;
  try {
    status = JSON.parse(executarFallbackPowerShellAbsoluto(
      fallback,
      ["skill", "status", "--json"],
      { env: ambienteInstalacao, stdio: "pipe" },
    ));
  } catch {
    status = undefined;
  }
  if (!validarStatusDistribuicaoPronta(status)) {
    executarFallbackPowerShellAbsoluto(fallback, ["skill", "sync", "--json"], {
      env: ambienteInstalacao,
      stdio: "pipe",
    });
    status = JSON.parse(executarFallbackPowerShellAbsoluto(
      fallback,
      ["skill", "status", "--json"],
      { env: ambienteInstalacao, stdio: "pipe" },
    ));
  }
  if (!validarStatusDistribuicaoPronta(status)) {
    throw new Error("Launcher ou skill global não ficou READY após a instalação local.");
  }
  console.log(`Sema ${versaoEsperada} instalada pelo launcher gerenciado.`);
}

function executadoDiretamente() {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (executadoDiretamente()) {
  main().catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  });
}
