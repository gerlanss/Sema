// SEMA-GOVERNED: sema.produto.cli_toolchain_local
// Contrato: contratos/sema/cli_toolchain_local.sema
// Descrição: detecção de comandos externos usados por doctor, testes gerados e runners opcionais.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const requireRuntimeCli = createRequire(import.meta.url);

function resolverImportadorNodeOpcional(especificador: string): string | undefined {
  try {
    return requireRuntimeCli.resolve(especificador);
  } catch {
    return undefined;
  }
}

export const TSX_IMPORTADOR_CLI = resolverImportadorNodeOpcional("tsx");
export const TSX_EXECUTOR_CLI = resolverImportadorNodeOpcional("tsx/cli");

export interface ExecucaoComandoExterno {
  comando: string;
  argumentosBase: string[];
  rotulo: string;
}
const TIMEOUT_CHECAGEM_COMANDO_MS = 5_000;
const disponibilidadeComandosNoProcesso = new Map<string, boolean>();

export function comandoDisponivel(comando: string, argumentos: string[] = ["--version"]): boolean {
  const chaveSondagem = JSON.stringify({
    comando,
    argumentos,
    cwd: process.cwd(),
    path: process.env.PATH ?? "",
    pathExt: process.env.PATHEXT ?? "",
    comSpec: process.env.COMSPEC ?? "",
  });
  const resultadoMemorizado = disponibilidadeComandosNoProcesso.get(chaveSondagem);
  if (resultadoMemorizado !== undefined) {
    return resultadoMemorizado;
  }

  const execucao = spawnSync(comando, argumentos, {
    stdio: "ignore",
    shell: process.platform === "win32",
    timeout: TIMEOUT_CHECAGEM_COMANDO_MS,
    windowsHide: true,
  });
  const disponivel = !execucao.error && execucao.signal === null && (execucao.status ?? 1) === 0;
  disponibilidadeComandosNoProcesso.set(chaveSondagem, disponivel);
  return disponivel;
}

export function resolverExecucaoPython(): ExecucaoComandoExterno | undefined {
  if (comandoDisponivel("python")) {
    return { comando: "python", argumentosBase: [], rotulo: "python" };
  }
  if (comandoDisponivel("py")) {
    return { comando: "py", argumentosBase: [], rotulo: "py" };
  }
  return undefined;
}

export function resolverExecucaoPytest(): ExecucaoComandoExterno | undefined {
  if (comandoDisponivel("pytest")) {
    return { comando: "pytest", argumentosBase: [], rotulo: "pytest" };
  }

  const python = resolverExecucaoPython();
  if (python && comandoDisponivel(python.comando, [...python.argumentosBase, "-m", "pytest", "--version"])) {
    return {
      comando: python.comando,
      argumentosBase: [...python.argumentosBase, "-m", "pytest"],
      rotulo: `${python.rotulo} -m pytest`,
    };
  }

  return undefined;
}
