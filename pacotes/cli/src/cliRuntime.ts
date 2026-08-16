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
  } catch {
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
