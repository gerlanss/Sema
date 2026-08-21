// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.resultados
// Descrição: modela o envelope único de resultados JSON da CLI pública 3.0.

export const SCHEMA_RESULTADO_CLI_V1 = "sema.cli.result/v1" as const;
export const CODIGO_SAIDA_FATAL_RUNTIME_CLI = 70 as const;

export type TipoResultadoCliV1 = "SUCCESS" | "DOMAIN_ERROR";

export interface EnvelopeResultadoCliV1 {
  readonly schemaVersion: typeof SCHEMA_RESULTADO_CLI_V1;
  readonly ok: boolean;
  readonly kind: TipoResultadoCliV1;
  readonly command: string;
  readonly code: "CLI_SUCCESS" | "CLI_DOMAIN_ERROR";
  readonly message: string | null;
  readonly exitCode: number;
  readonly payload: unknown;
}

export interface EntradaEnvelopeResultadoCliV1 {
  readonly comando: string;
  readonly codigoSaida: number;
  readonly stdout: string;
}

const COMANDO_CANONICO_VALIDO = /^[a-z][a-z0-9-]{0,63}$/u;
const MENSAGEM_PUBLICA_ERRO_DOMINIO = "O comando Sema não foi concluído.";
const SCHEMAS_ENVELOPE_CLI = new Set([
  SCHEMA_RESULTADO_CLI_V1,
  "sema.cli.control/v1",
]);

function validarComandoCanonico(comando: string): string {
  if (!COMANDO_CANONICO_VALIDO.test(comando)) {
    throw new TypeError("Comando canônico inválido.");
  }
  return comando;
}

function validarCodigoSaida(codigoSaida: number): number {
  if (!Number.isSafeInteger(codigoSaida) || codigoSaida < 0 || codigoSaida > 255) {
    throw new TypeError("Código de saída inválido.");
  }
  return codigoSaida;
}

export function interpretarPayloadRuntimeCli(stdout: string): unknown {
  if (stdout.trim().length === 0) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(stdout) as unknown;
  } catch {
    return stdout;
  }
  if (
    payload !== null
    && typeof payload === "object"
    && !Array.isArray(payload)
    && Object.prototype.hasOwnProperty.call(payload, "schemaVersion")
    && SCHEMAS_ENVELOPE_CLI.has((payload as Record<string, unknown>).schemaVersion as string)
  ) {
    throw new TypeError("Payload não pode conter outro envelope público da CLI.");
  }
  return payload;
}

export function criarEnvelopeResultadoCliV1(
  entrada: EntradaEnvelopeResultadoCliV1,
): EnvelopeResultadoCliV1 {
  const command = validarComandoCanonico(entrada.comando);
  const exitCode = validarCodigoSaida(entrada.codigoSaida);
  const sucesso = exitCode === 0;
  return {
    schemaVersion: SCHEMA_RESULTADO_CLI_V1,
    ok: sucesso,
    kind: sucesso ? "SUCCESS" : "DOMAIN_ERROR",
    command,
    code: sucesso ? "CLI_SUCCESS" : "CLI_DOMAIN_ERROR",
    message: sucesso ? null : MENSAGEM_PUBLICA_ERRO_DOMINIO,
    exitCode,
    payload: interpretarPayloadRuntimeCli(entrada.stdout),
  };
}
