// SEMA-GOVERNED
// Módulo: sema.produto.geradores_nativos
// Contrato: contratos/sema/geradores_nativos.sema
// Descrição: detecta e executa toolchains C++ locais sem baixar dependências.

import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export type TipoToolchainCpp = "gcc" | "clang" | "msvc" | "msvc-devcmd";

export interface ToolchainCpp {
  tipo: TipoToolchainCpp;
  comando: string;
  rotulo: string;
  scriptAmbiente?: string;
}

export interface ResultadoComandoNativo {
  codigoSaida: number;
  saidaPadrao: string;
  saidaErro: string;
}

const TIMEOUT_DETECCAO_MS = 5_000;
const TIMEOUT_COMPILACAO_MS = 120_000;

function textoSaida(valor: string | Buffer | null | undefined): string {
  return typeof valor === "string" ? valor : valor?.toString("utf8") ?? "";
}

function resultadoComando(
  resultado: ReturnType<typeof spawnSync>,
  erroPadrao: string,
): ResultadoComandoNativo {
  return {
    codigoSaida: resultado.status ?? 1,
    saidaPadrao: textoSaida(resultado.stdout),
    saidaErro: textoSaida(resultado.stderr) || resultado.error?.message || erroPadrao,
  };
}

function comandoResponde(comando: string, argumentos: string[]): boolean {
  const resultado = spawnSync(comando, argumentos, {
    stdio: "ignore",
    timeout: TIMEOUT_DETECCAO_MS,
    windowsHide: true,
  });
  return !resultado.error && resultado.signal === null && (resultado.status ?? 1) === 0;
}

function localizarVsDevCmd(): string | undefined {
  if (process.platform !== "win32") {
    return undefined;
  }

  const programFilesX86 = process.env["ProgramFiles(x86)"];
  if (!programFilesX86) {
    return undefined;
  }
  const vswhere = path.join(programFilesX86, "Microsoft Visual Studio", "Installer", "vswhere.exe");
  if (!existsSync(vswhere)) {
    return undefined;
  }

  const resultado = spawnSync(vswhere, [
    "-latest",
    "-products",
    "*",
    "-requires",
    "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
    "-property",
    "installationPath",
  ], {
    encoding: "utf8",
    timeout: TIMEOUT_DETECCAO_MS,
    windowsHide: true,
  });
  const instalacao = textoSaida(resultado.stdout).trim().split(/\r?\n/).at(-1);
  if (!instalacao) {
    return undefined;
  }
  const script = path.join(instalacao, "Common7", "Tools", "VsDevCmd.bat");
  return existsSync(script) ? script : undefined;
}

export function resolverToolchainCpp(): ToolchainCpp | undefined {
  const candidatos: Array<{ comando: string; tipo: TipoToolchainCpp; rotulo: string }> = [
    { comando: "c++", tipo: "gcc", rotulo: "c++" },
    { comando: "g++", tipo: "gcc", rotulo: "g++" },
    { comando: "clang++", tipo: "clang", rotulo: "clang++" },
  ];
  for (const candidato of candidatos) {
    if (comandoResponde(candidato.comando, ["--version"])) {
      return candidato;
    }
  }

  if (process.platform === "win32" && comandoResponde("cl", ["/nologo", "/?"])) {
    return { tipo: "msvc", comando: "cl", rotulo: "MSVC cl" };
  }

  const scriptAmbiente = localizarVsDevCmd();
  if (scriptAmbiente) {
    return {
      tipo: "msvc-devcmd",
      comando: process.env.ComSpec ?? "cmd.exe",
      rotulo: "MSVC via VsDevCmd",
      scriptAmbiente,
    };
  }
  return undefined;
}

function citarCmd(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

export function compilarCpp(
  toolchain: ToolchainCpp,
  fontes: string[],
  diretorioIncludes: string,
  executavel: string,
  silencioso = false,
): ResultadoComandoNativo {
  const cwd = path.dirname(executavel);
  const stdio = silencioso ? "pipe" : "inherit";

  if (toolchain.tipo === "msvc-devcmd") {
    const comando = [
      `call ${citarCmd(toolchain.scriptAmbiente!)}`,
      "-no_logo -arch=x64 -host_arch=x64 >nul",
      "&& cl /nologo /std:c++20 /EHsc",
      fontes.map(citarCmd).join(" "),
      `/I${citarCmd(diretorioIncludes)}`,
      `/Fe:${citarCmd(executavel)}`,
    ].join(" ");
    const resultado = spawnSync(toolchain.comando, ["/d", "/s", "/c", comando], {
      cwd,
      stdio,
      encoding: silencioso ? "utf8" : undefined,
      timeout: TIMEOUT_COMPILACAO_MS,
      windowsHide: true,
      windowsVerbatimArguments: true,
    });
    return resultadoComando(resultado, "Falha ao executar o MSVC via VsDevCmd.");
  }

  const argumentos = toolchain.tipo === "msvc"
    ? ["/nologo", "/std:c++20", "/EHsc", ...fontes, `/I${diretorioIncludes}`, `/Fe:${executavel}`]
    : ["-std=c++20", "-Wall", "-Wextra", ...fontes, `-I${diretorioIncludes}`, "-o", executavel];
  const resultado = spawnSync(toolchain.comando, argumentos, {
    cwd,
    stdio,
    encoding: silencioso ? "utf8" : undefined,
    timeout: TIMEOUT_COMPILACAO_MS,
    windowsHide: true,
  });
  return resultadoComando(resultado, `Falha ao executar ${toolchain.rotulo}.`);
}

export function executarBinarioNativo(
  executavel: string,
  silencioso = false,
): ResultadoComandoNativo {
  const resultado = spawnSync(executavel, [], {
    cwd: path.dirname(executavel),
    stdio: silencioso ? "pipe" : "inherit",
    encoding: silencioso ? "utf8" : undefined,
    timeout: TIMEOUT_COMPILACAO_MS,
    windowsHide: true,
  });
  return resultadoComando(resultado, "Falha ao executar os testes C++ compilados.");
}
