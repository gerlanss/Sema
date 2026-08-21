// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.handlers
// Descrição: executa o dispatcher operacional no processo interno capturado pela CLI pública.

import path from "node:path";
import { pathToFileURL } from "node:url";
import { CODIGO_SAIDA_FATAL_RUNTIME_CLI } from "./resultadoCli.js";
import { criarEnvelopeControleJsonV1 } from "./saidaCli.js";

export const CODIGO_SAIDA_CONTRATO_AUSENTE_RUNTIME = 2;

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
    const detalhesErro = erro as { name?: string; message?: string; caminhoTentado?: string; sugeridos?: string[] };
    const ehContratoAusente = detalhesErro?.name === "ErroContratoNaoEncontrado"
      || String(detalhesErro?.message ?? "").startsWith("Contrato nao encontrado:");
    if (ehContratoAusente) {
      const envelope = criarEnvelopeControleJsonV1({
        categoria: "CONTRACT_NOT_FOUND",
        codigoPublico: "CLI_CONTRACT_NOT_FOUND",
        mensagemPublica: "Contrato Sema nao encontrado. Consulte os detalhes no envelope.",
        codigoSaida: CODIGO_SAIDA_CONTRATO_AUSENTE_RUNTIME,
        detalhes: {
          caminhoTentado: detalhesErro.caminhoTentado
            ? path.relative(process.cwd(), detalhesErro.caminhoTentado) || detalhesErro.caminhoTentado
            : "",
          sugeridos: detalhesErro.sugeridos ?? [],
        },
      });
      console.log(JSON.stringify(envelope, null, 2));
      return CODIGO_SAIDA_CONTRATO_AUSENTE_RUNTIME;
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
