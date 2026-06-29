// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: preflight local-only da CLI publica.

import { obterOpcao, obterPosicionais, possuiFlag } from "../cliArgs.js";

export interface PreflightCliOutput {
  comando: "preflight";
  surface: "local_cli";
  autorizado: boolean;
  decisao: "use_cli_local" | "blocked";
  filesystem: "local_available";
  origemCobranca: "local_only";
  operationCode: string;
  toolName: string;
  erro?: string;
}

const OPERATION_CODE_BY_CLI_COMMAND: Record<string, string> = {
  resumo: "tool.sema_resumo",
  validar: "tool.sema_validar",
  ir: "tool.sema_ir",
  inspecionar: "tool.sema_inspecionar",
  drift: "drift.module",
  impacto: "default.operation",
  verificar: "verify.full",
};

function normalizarComandoCli(comandoCli: string): string {
  return comandoCli.trim().replace(/^sema\s+/i, "").split(/\s+/)[0]?.toLowerCase() || "default";
}

function resolverOperationCodeCli(comandoCli: string, args: string[]): string {
  const explicito = obterOpcao(args, "--operation-code");
  if (explicito) return explicito;

  const comando = normalizarComandoCli(comandoCli);
  if (comando === "drift" && obterOpcao(args, "--escopo") === "projeto") {
    return "drift.project";
  }
  return OPERATION_CODE_BY_CLI_COMMAND[comando] ?? "default.operation";
}

function resolverToolNameCli(comandoCli: string): string {
  return `sema_cli_${normalizarComandoCli(comandoCli).replace(/[^a-z0-9_]+/g, "_")}`;
}

export async function executarPreflightCli(params: {
  comandoCli: string;
  args?: string[];
  projectId?: string | null;
}): Promise<PreflightCliOutput> {
  const args = params.args ?? [];
  const comandoCli = params.comandoCli || "default";
  const operationCode = resolverOperationCodeCli(comandoCli, args);
  const toolName = resolverToolNameCli(comandoCli);
  void params.projectId;

  return {
    comando: "preflight",
    surface: "local_cli",
    autorizado: true,
    decisao: "use_cli_local",
    filesystem: "local_available",
    origemCobranca: "local_only",
    operationCode,
    toolName,
  };
}

export async function comandoPreflightCli(args: string[], json: boolean): Promise<number> {
  if (possuiFlag(args, "--help") || possuiFlag(args, "-h")) {
    console.log([
      "Usage: sema preflight [command] [--operation-code <code>] [--json]",
      "",
      "Checks the local CLI surface. Public Sema is local-only and does not call external services.",
      "If this command returns decisao=use_cli_local, continue with local CLI commands.",
    ].join("\n"));
    return 0;
  }

  const posicionais = obterPosicionais(args);
  const comandoCli = obterOpcao(args, "--comando") ?? posicionais[0] ?? "resumo";
  const resultado = await executarPreflightCli({
    comandoCli,
    args,
    projectId: obterOpcao(args, "--project-id") ?? null,
  });

  if (json) {
    console.log(JSON.stringify(resultado, null, 2));
  } else if (resultado.autorizado) {
    console.log(`Sema CLI authorized: ${resultado.operationCode}. Decision: ${resultado.decisao}.`);
  } else {
    console.error(`Sema CLI blocked: ${resultado.erro}`);
  }
  return resultado.autorizado ? 0 : 1;
}
