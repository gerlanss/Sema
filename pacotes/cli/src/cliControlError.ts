// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.argumentos
// Descrição: representa falhas públicas de controle sem carregar argv, stack ou caminhos na mensagem.

export type CategoriaFalhaControleCli =
  | "UNKNOWN_COMMAND"
  | "ARGUMENT_ERROR"
  | "FATAL_ERROR";

interface DefinicaoFalhaControleCli {
  readonly codigoPublico: string;
  readonly mensagemPublica: string;
  readonly codigoSaida: number;
}

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

  constructor(categoria: CategoriaFalhaControleCli) {
    const definicao = DEFINICOES_FALHA_CONTROLE[categoria];
    super(definicao.mensagemPublica);
    this.name = "CliControlError";
    this.categoria = categoria;
    this.codigoPublico = definicao.codigoPublico;
    this.mensagemPublica = definicao.mensagemPublica;
    this.codigoSaida = definicao.codigoSaida;
  }
}

export function erroComandoDesconhecido(): CliControlError {
  return new CliControlError("UNKNOWN_COMMAND");
}

export function erroArgumentoInvalido(): CliControlError {
  return new CliControlError("ARGUMENT_ERROR");
}

export function erroFatalCli(): CliControlError {
  return new CliControlError("FATAL_ERROR");
}

export function ehCliControlError(valor: unknown): valor is CliControlError {
  return valor instanceof CliControlError;
}
