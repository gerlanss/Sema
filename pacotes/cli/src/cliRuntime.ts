// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.handlers
// Descrição: executa o dispatcher operacional no processo interno capturado pela CLI pública.

import path from "node:path";
import { pathToFileURL } from "node:url";
import { CODIGO_SAIDA_FATAL_RUNTIME_CLI } from "./resultadoCli.js";

export type PrincipalCliRuntime = () => Promise<number>;

export async function executarCliRuntimeInterno(
  principalInjetado?: PrincipalCliRuntime,
): Promise<number> {
  try {
    const principal = principalInjetado
      ?? (await import("./index.part08.js")).principal;
    const codigoSaida = await principal();
    return Number.isSafeInteger(codigoSaida) && codigoSaida >= 0 && codigoSaida <= 255
      ? codigoSaida
      : CODIGO_SAIDA_FATAL_RUNTIME_CLI;
  } catch (erro) {
    if (typeof (erro as { categoria?: string })?.categoria === "string" && (erro as { categoria?: string }).categoria) {
      const cli = erro as { categoria: string; codigoPublico: string; mensagemPublica: string; codigoSaida: number; detalhes?: Record<string, unknown> };
      const envelope = {
        schemaVersion: "sema.cli.control/v1",
        ok: false,
        kind: cli.categoria,
        code: cli.codigoPublico,
        message: cli.mensagemPublica,
        exitCode: cli.codigoSaida,
        ...(cli.detalhes ? { details: cli.detalhes } : {}),
      };
      console.log(JSON.stringify(envelope, null, 2));
      return cli.codigoSaida;
    }
    return CODIGO_SAIDA_FATAL_RUNTIME_CLI;
  }
}

function executadoDiretamente(): boolean {
  const entrada = process.argv[1];
  return typeof entrada === "string"
    && pathToFileURL(path.resolve(entrada)).href === import.meta.url;
}

if (executadoDiretamente()) {
  void executarCliRuntimeInterno().then(
    (codigoSaida) => {
      process.exitCode = codigoSaida;
    },
    () => {
      process.exitCode = CODIGO_SAIDA_FATAL_RUNTIME_CLI;
    },
  );
}
