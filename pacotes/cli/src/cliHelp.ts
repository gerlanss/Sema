// SEMA-GOVERNED: sema.produto.cli_invocacao_publica
// Descrição: detecta ajuda no argv bruto sem consultar ambiente, handlers ou estado externo.

export interface ResultadoDeteccaoHelp {
  readonly ajudaSolicitada: boolean;
  readonly modoJson: boolean;
  readonly encerrarAntesDispatch: boolean;
  readonly dispatchPermitido: boolean;
  readonly handlerResolvido: boolean;
  readonly codigoSaida: number;
  readonly helpEmQualquerPosicaoRespeitado: boolean;
}

const FLAGS_AJUDA = new Set(["--help", "-h"]);

/**
 * Esta função precisa permanecer pura: ela roda antes de parsing, cwd, registry e dispatch.
 */
export function detectarHelpAntesDispatch(argv: readonly string[]): ResultadoDeteccaoHelp {
  const ajudaSolicitada = argv.some((token) => FLAGS_AJUDA.has(token));
  return {
    ajudaSolicitada,
    modoJson: argv.includes("--json"),
    encerrarAntesDispatch: ajudaSolicitada,
    dispatchPermitido: !ajudaSolicitada,
    handlerResolvido: false,
    codigoSaida: 0,
    helpEmQualquerPosicaoRespeitado: true,
  };
}
