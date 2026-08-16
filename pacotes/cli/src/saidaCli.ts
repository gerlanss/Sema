// SEMA-GOVERNED: sema.produto.cli_invocacao_publica
// Descrição: cria o envelope JSON público e redigido para resultados de controle da CLI.

export const SCHEMA_CONTROLE_CLI_V1 = "sema.cli.control/v1" as const;

export type TipoControleCli =
  | "HELP"
  | "UNKNOWN_COMMAND"
  | "ARGUMENT_ERROR"
  | "FATAL_ERROR";

export interface EnvelopeControleJsonV1 {
  readonly schemaVersion: typeof SCHEMA_CONTROLE_CLI_V1;
  readonly ok: boolean;
  readonly kind: TipoControleCli;
  readonly code: string;
  readonly message: string;
  readonly exitCode: number;
}

export interface EntradaEnvelopeControleJsonV1 {
  readonly categoria: TipoControleCli;
  readonly codigoPublico: string;
  readonly mensagemPublica: string;
  readonly codigoSaida: number;
}

export type TipoResultadoInvocacaoCli = "SUCCESS" | TipoControleCli;

export interface OpcoesInvocacaoPublica {
  readonly resultado: TipoResultadoInvocacaoCli;
  readonly modoJson: boolean;
  readonly payloadSucesso?: unknown;
  readonly envelopeControle?: EnvelopeControleJsonV1;
  readonly mensagemTexto?: string;
}

export interface RelatorioInvocacaoPublica {
  readonly codigoSaida: number;
  readonly payloadSucessoPreservado: boolean;
  readonly envelopeControleEmitido: boolean;
  readonly stderrVazio: boolean;
  readonly handlerExecutado: boolean;
  readonly politicaSucesso24Respeitada: boolean;
  readonly politicaControleJsonV1Respeitada: boolean;
  readonly politicaHelpPuroRespeitada: boolean;
}

const CODIGO_PADRAO: Readonly<Record<TipoControleCli, string>> = {
  HELP: "CLI_HELP",
  UNKNOWN_COMMAND: "CLI_UNKNOWN_COMMAND",
  ARGUMENT_ERROR: "CLI_ARGUMENT_ERROR",
  FATAL_ERROR: "CLI_FATAL_ERROR",
};

const MENSAGEM_PADRAO: Readonly<Record<TipoControleCli, string>> = {
  HELP: "Ajuda da CLI Sema.",
  UNKNOWN_COMMAND: "Comando Sema desconhecido.",
  ARGUMENT_ERROR: "Argumentos inválidos. Consulte a ajuda do comando.",
  FATAL_ERROR: "Falha ao executar a CLI da Sema.",
};

const CODIGO_PUBLICO_VALIDO = /^[A-Z][A-Z0-9_]{2,63}$/u;
const PREFIXO_ERRO_INTERNO = /\b(?:Aggregate|Eval|Internal|Range|Reference|Syntax|Type|URI)?Error\s*:/iu;
const TRECHO_STACK = /(?:^|[\s;|=(:,])at\s+(?:async\s+)?(?:new\s+)?[^\n]{0,240}?(?:\([^()\n]*:\d+:\d+\)|[^\s()\n]+:\d+:\d+)/iu;

function decodificarPercentAscii(valor: string): string {
  return valor.replace(/%([0-9a-f]{2})/giu, (_trecho, hexadecimal: string) =>
    String.fromCharCode(Number.parseInt(hexadecimal, 16)));
}

function variantesTextoPublico(valor: string): readonly string[] {
  const variantes = new Set([valor.normalize("NFC")]);
  let atual = valor;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const decodificado = decodificarPercentAscii(atual);
    if (decodificado === atual) {
      break;
    }
    variantes.add(decodificado.normalize("NFC"));
    atual = decodificado;
  }
  return [...variantes];
}

function contemCaminhoAbsoluto(valor: string): boolean {
  return variantesTextoPublico(valor).some((variante) => {
    const normalizada = variante.replaceAll("\\", "/");
    const semUrlsPublicas = normalizada.replace(/\b(?:https?|wss?):\/\/[^\s"'<>]+/giu, "");
    return /(?:^|[^A-Za-z0-9])file:\/{1,3}/iu.test(semUrlsPublicas)
      || /(?:^|[^A-Za-z0-9])[A-Za-z]:\/(?:[^/\s"'<>]+(?:\/[^/\s"'<>]*)*)?/u.test(semUrlsPublicas)
      || /(?:^|[^A-Za-z0-9_./])\/\/[^/\s"'<>]+\/[^/\s"'<>]+/u.test(semUrlsPublicas)
      || /(?:^|[^A-Za-z0-9_./])\/(?!\/)[^/\s"'<>]+(?:\/[^/\s"'<>]*)*/u.test(semUrlsPublicas);
  });
}

function normalizarCodigoPublico(categoria: TipoControleCli, codigo: string): string {
  const candidato = codigo.trim();
  return CODIGO_PUBLICO_VALIDO.test(candidato) ? candidato : CODIGO_PADRAO[categoria];
}

function normalizarMensagemPublica(categoria: TipoControleCli, mensagem: string): string {
  if (categoria !== "HELP") {
    return MENSAGEM_PADRAO[categoria];
  }
  const candidata = mensagem.trim();
  if (
    !candidata
    || contemCaminhoAbsoluto(candidata)
    || TRECHO_STACK.test(candidata)
    || PREFIXO_ERRO_INTERNO.test(candidata)
  ) {
    return MENSAGEM_PADRAO[categoria];
  }
  return candidata;
}

export function criarEnvelopeControleJsonV1(
  entrada: EntradaEnvelopeControleJsonV1,
): EnvelopeControleJsonV1 {
  const help = entrada.categoria === "HELP";
  const exitCode = help
    ? 0
    : entrada.codigoSaida === 0
      ? 1
      : entrada.codigoSaida;
  return {
    schemaVersion: SCHEMA_CONTROLE_CLI_V1,
    ok: help,
    kind: entrada.categoria,
    code: normalizarCodigoPublico(entrada.categoria, entrada.codigoPublico),
    message: normalizarMensagemPublica(entrada.categoria, entrada.mensagemPublica),
    exitCode,
  };
}

function envelopeSeguroParaInvocacao(
  resultado: TipoControleCli,
  envelope: EnvelopeControleJsonV1 | undefined,
  mensagemTexto: string | undefined,
): EnvelopeControleJsonV1 {
  const coerente = envelope?.kind === resultado ? envelope : undefined;
  return criarEnvelopeControleJsonV1({
    categoria: resultado,
    codigoPublico: coerente?.code ?? CODIGO_PADRAO[resultado],
    mensagemPublica: resultado === "HELP"
      ? coerente?.message ?? mensagemTexto ?? MENSAGEM_PADRAO.HELP
      : MENSAGEM_PADRAO[resultado],
    codigoSaida: coerente?.exitCode ?? (resultado === "HELP" ? 0 : 1),
  });
}

export function executarInvocacaoPublica(
  opcoes: OpcoesInvocacaoPublica,
): RelatorioInvocacaoPublica {
  if (opcoes.resultado === "SUCCESS") {
    if (opcoes.payloadSucesso === undefined) {
      throw new Error("Payload de sucesso ausente.");
    }
    const saida = typeof opcoes.payloadSucesso === "string"
      ? opcoes.payloadSucesso
      : opcoes.modoJson
        ? JSON.stringify(opcoes.payloadSucesso, null, 2)
        : String(opcoes.payloadSucesso);
    console.log(saida);
    return {
      codigoSaida: 0,
      payloadSucessoPreservado: true,
      envelopeControleEmitido: false,
      stderrVazio: true,
      handlerExecutado: true,
      politicaSucesso24Respeitada: true,
      politicaControleJsonV1Respeitada: true,
      politicaHelpPuroRespeitada: true,
    };
  }

  const envelope = envelopeSeguroParaInvocacao(
    opcoes.resultado,
    opcoes.envelopeControle,
    opcoes.mensagemTexto,
  );
  if (opcoes.modoJson) {
    // Uma única escrita lógica mantém JSON de controle em um único documento no stdout.
    console.log(JSON.stringify(envelope, null, 2));
  } else if (opcoes.resultado === "HELP") {
    console.log(envelope.message);
  } else {
    console.error(envelope.message);
  }

  return {
    codigoSaida: envelope.exitCode,
    payloadSucessoPreservado: true,
    envelopeControleEmitido: opcoes.modoJson,
    stderrVazio: opcoes.modoJson || opcoes.resultado === "HELP",
    handlerExecutado: false,
    politicaSucesso24Respeitada: true,
    politicaControleJsonV1Respeitada: true,
    politicaHelpPuroRespeitada: true,
  };
}
