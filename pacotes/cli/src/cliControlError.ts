// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.argumentos
// Descrição: representa falhas públicas de controle sem carregar argv, stack ou caminhos na mensagem.

export type CategoriaFalhaControleCli =
  | "UNKNOWN_COMMAND"
  | "ARGUMENT_ERROR"
  | "CONTRACT_NOT_FOUND"
  | "FATAL_ERROR";

interface DefinicaoFalhaControleCli {
  readonly codigoPublico: string;
  readonly mensagemPublica: string;
  readonly codigoSaida: number;
}

const MENSAGEM_CONTRATO_NAO_ENCONTRADO = "Contrato Sema nao encontrado. Consulte os contratos sugeridos no envelope.";

const DEFINICOES_FALHA_CONTROLE: Readonly<Record<CategoriaFalhaControleCli, DefinicaoFalhaControleCli>> = Object.freeze({
  UNKNOWN_COMMAND: Object.freeze({
    codigoPublico: "CLI_UNKNOWN_COMMAND",
    mensagemPublica: "Comando Sema desconhecido.",
    codigoSaida: 1,
  }),
  ARGUMENT_ERROR: Object.freeze({
    codigoPublico: "CLI_ARGUMENT_ERROR",
    mensagemPublica: "Argumentos inválidos. Consulte a ajuda do comando.",
    codigoSaida: 1,
  }),
  CONTRACT_NOT_FOUND: Object.freeze({
    codigoPublico: "CLI_CONTRACT_NOT_FOUND",
    mensagemPublica: MENSAGEM_CONTRATO_NAO_ENCONTRADO,
    codigoSaida: 2,
  }),
  FATAL_ERROR: Object.freeze({
    codigoPublico: "CLI_FATAL_ERROR",
    mensagemPublica: "Falha ao executar a CLI da Sema.",
    codigoSaida: 1,
  }),
});

export class CliControlError extends Error {
  readonly categoria: CategoriaFalhaControleCli;
  readonly codigoPublico: string;
  readonly mensagemPublica: string;
  readonly codigoSaida: number;
  readonly detalhes?: Record<string, unknown>;

  constructor(categoria: CategoriaFalhaControleCli, detalhes?: Record<string, unknown>) {
    const definicao = DEFINICOES_FALHA_CONTROLE[categoria];
    super(definicao.mensagemPublica);
    this.name = "CliControlError";
    this.categoria = categoria;
    this.codigoPublico = definicao.codigoPublico;
    this.mensagemPublica = definicao.mensagemPublica;
    this.codigoSaida = definicao.codigoSaida;
    this.detalhes = detalhes;
  }
}

export function erroComandoDesconhecido(): CliControlError {
  return new CliControlError("UNKNOWN_COMMAND");
}

export function erroArgumentoInvalido(): CliControlError {
  return new CliControlError("ARGUMENT_ERROR");
}

export function erroContratoNaoEncontrado(detalhes: { caminhoTentado: string; sugeridos: string[] }): CliControlError {
  return new CliControlError("CONTRACT_NOT_FOUND", detalhes);
}

export function erroFatalCli(): CliControlError {
  return new CliControlError("FATAL_ERROR");
}

export function ehCliControlError(valor: unknown): valor is CliControlError {
  return valor instanceof CliControlError;
}
