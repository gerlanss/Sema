// SEMA-GOVERNED: sema.produto.cli_invocacao_publica, sema.produto.distribuicao_global.instaladores, sema.produto.fronteira_repositorios.empacotamento.smoke
// Descrição: valida envelopes JSON públicos da CLI e entrega somente o payload aos consumidores do pacote.

export const SCHEMA_RESULTADO_CLI_V1 = "sema.cli.result/v1";
export const SCHEMA_CONTROLE_CLI_V1 = "sema.cli.control/v1";

const CHAVES_RESULTADO_CLI_V1 = [
  "code",
  "command",
  "exitCode",
  "kind",
  "message",
  "ok",
  "payload",
  "schemaVersion",
];
const CHAVES_CONTROLE_CLI_V1 = [
  "code",
  "exitCode",
  "kind",
  "message",
  "ok",
  "schemaVersion",
];
const TIPOS_CONTROLE = new Set(["HELP", "UNKNOWN_COMMAND", "ARGUMENT_ERROR", "FATAL_ERROR"]);
const PADRAO_CODIGO_PUBLICO = /^[A-Z][A-Z0-9_]{2,63}$/u;
const PADRAO_COMANDO_CANONICO = /^[a-z][a-z0-9-]{0,63}$/u;
const PADRAO_SEMVER_EXATA = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*))(?:\.(?:(?:0|[1-9]\d*)|(?:\d*[A-Za-z-][0-9A-Za-z-]*)))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const PREFIXO_ERRO_INTERNO = /\b(?:Aggregate|Eval|Internal|Range|Reference|Syntax|Type|URI)?Error\s*:/iu;
const TRECHO_STACK = /(?:^|[\s;|=(:,])at\s+(?:async\s+)?(?:new\s+)?[^\n]{0,240}?(?:\([^()\n]*:\d+:\d+\)|[^\s()\n]+:\d+:\d+)/iu;
const PADROES_SEGREDO_PUBLICO = [
  /\bBearer\s+\S+/iu,
  /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/iu,
  /\b(?:sk|ghp|gho|ghu|ghs|github_pat|xoxb|xoxp|xoxa|xoxr|AIza)[_-][A-Za-z0-9_-]{8,}\b/u,
  /\b(?:api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|token|secret|segredo|password|senha|credential)\b\s*[:=]\s*\S+/iu,
  /(?:^|\s)--(?:api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|password|senha|credential)(?:=|\s+)(?![<[])[^\s]+/iu,
  /[?&](?:api[_-]?key|token|access[_-]?token|password|senha|secret)=[^\s&#]+/iu,
];
const PADROES_ECO_ARGV = [
  /\b(?:process\.)?argv\b/iu,
  /(?:^|\s)--[a-z0-9][a-z0-9-]*(?:=(?:"[^"]*"|'[^']*'|\S+))?/iu,
  /\b(?:comando\s+desconhecido|unknown\s+command)\s*[:=]\s*\S+/iu,
];

function ehRegistro(valor) {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function possuiChavesExatas(valor, esperadas) {
  return ehRegistro(valor)
    && Object.keys(valor).sort().join("\n") === esperadas.join("\n");
}

function ehValorJson(valor, visitados = new Set()) {
  if (valor === null || typeof valor === "string" || typeof valor === "boolean") return true;
  if (typeof valor === "number") return Number.isFinite(valor);
  if (typeof valor !== "object" || visitados.has(valor)) return false;

  visitados.add(valor);
  const valido = Array.isArray(valor)
    ? Object.keys(valor).length === valor.length
      && valor.every((item) => ehValorJson(item, visitados))
    : Reflect.ownKeys(valor).length === Object.keys(valor).length
      && Object.values(valor).every((item) => ehValorJson(item, visitados));
  visitados.delete(valor);
  return valido;
}

function decodificarPercentAscii(valor) {
  return valor.replace(/%([0-9a-f]{2})/giu, (_trecho, hexadecimal) =>
    String.fromCharCode(Number.parseInt(hexadecimal, 16)));
}

function variantesTextoPublico(valor) {
  const variantes = new Set([valor.normalize("NFC")]);
  let atual = valor;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const decodificado = decodificarPercentAscii(atual);
    if (decodificado === atual) break;
    variantes.add(decodificado.normalize("NFC"));
    atual = decodificado;
  }
  return [...variantes];
}

function contemCaminhoAbsoluto(valor) {
  return variantesTextoPublico(valor).some((variante) => {
    const normalizada = variante.replaceAll("\\", "/");
    const semUrlsPublicas = normalizada.replace(/\b(?:https?|wss?):\/\/[^\s"'<>]+/giu, "");
    return /(?:^|[^A-Za-z0-9])file:\/{1,3}/iu.test(semUrlsPublicas)
      || /(?:^|[^A-Za-z0-9])[A-Za-z]:\/(?:[^/\s"'<>]+(?:\/[^/\s"'<>]*)*)?/u.test(semUrlsPublicas)
      || /(?:^|[^A-Za-z0-9_./])\/\/[^/\s"'<>]+\/[^/\s"'<>]+/u.test(semUrlsPublicas)
      || /(?:^|[^A-Za-z0-9_./])\/(?!\/)[^/\s"'<>]+(?:\/[^/\s"'<>]*)*/u.test(semUrlsPublicas);
  });
}

function correspondePadraoEmVariantes(valor, padroes) {
  return variantesTextoPublico(valor).some((variante) =>
    padroes.some((padrao) => padrao.test(variante)));
}

function mensagemPublicaSegura(valor, opcoes = {}) {
  return typeof valor === "string"
    && valor.trim().length > 0
    && !contemCaminhoAbsoluto(valor)
    && !correspondePadraoEmVariantes(valor, PADROES_SEGREDO_PUBLICO)
    && (opcoes.permitirSintaxeAjuda === true
      || !correspondePadraoEmVariantes(valor, PADROES_ECO_ARGV))
    && !TRECHO_STACK.test(valor)
    && !PREFIXO_ERRO_INTERNO.test(valor);
}

function falhar(contexto, detalhe) {
  throw new Error(`Saída JSON inválida da CLI durante ${contexto}: ${detalhe}.`);
}

export function parsearDocumentoJsonCli(saida, contexto = "execução da CLI") {
  if (typeof saida !== "string") {
    if (!ehValorJson(saida)) falhar(contexto, "o documento não é JSON");
    return saida;
  }
  try {
    return JSON.parse(saida);
  } catch {
    falhar(contexto, "era esperado exatamente um documento JSON");
  }
}

export function validarEnvelopeResultadoCliV1(entrada, opcoes = {}) {
  const contexto = opcoes.contexto ?? "resultado da CLI";
  const envelope = parsearDocumentoJsonCli(entrada, contexto);
  if (!possuiChavesExatas(envelope, CHAVES_RESULTADO_CLI_V1)) {
    falhar(contexto, "o envelope de resultado deve conter exatamente oito campos públicos");
  }
  if (envelope.schemaVersion !== SCHEMA_RESULTADO_CLI_V1) {
    falhar(contexto, `schemaVersion deve ser ${SCHEMA_RESULTADO_CLI_V1}`);
  }
  if (typeof envelope.ok !== "boolean") falhar(contexto, "ok deve ser booleano");
  if (!Number.isSafeInteger(envelope.exitCode) || envelope.exitCode < 0 || envelope.exitCode > 255) {
    falhar(contexto, "exitCode deve ser inteiro seguro entre 0 e 255");
  }
  if (typeof envelope.command !== "string" || !PADRAO_COMANDO_CANONICO.test(envelope.command)) {
    falhar(contexto, "command deve usar a forma canônica da gramática");
  }
  if (!ehValorJson(envelope.payload)) falhar(contexto, "payload deve ser um valor JSON");
  if (
    ehRegistro(envelope.payload)
    && (envelope.payload.schemaVersion === SCHEMA_RESULTADO_CLI_V1
      || envelope.payload.schemaVersion === SCHEMA_CONTROLE_CLI_V1)
  ) {
    falhar(contexto, "payload não pode conter outro envelope público da CLI");
  }

  if (envelope.kind === "SUCCESS") {
    if (envelope.ok !== true || envelope.code !== "CLI_SUCCESS" || envelope.exitCode !== 0 || envelope.message !== null) {
      falhar(contexto, "SUCCESS deve usar ok=true, CLI_SUCCESS, exitCode=0 e message=null");
    }
  } else if (envelope.kind === "DOMAIN_ERROR") {
    if (
      envelope.ok !== false
      || envelope.code !== "CLI_DOMAIN_ERROR"
      || envelope.exitCode <= 0
      || !mensagemPublicaSegura(envelope.message)
    ) {
      falhar(contexto, "DOMAIN_ERROR deve usar falha coerente e mensagem pública segura");
    }
  } else {
    falhar(contexto, "kind deve ser SUCCESS ou DOMAIN_ERROR");
  }

  if (opcoes.exitCode !== undefined && envelope.exitCode !== opcoes.exitCode) {
    falhar(contexto, "exitCode diverge do status do processo");
  }
  if (opcoes.kind !== undefined && envelope.kind !== opcoes.kind) {
    falhar(contexto, `kind diverge de ${opcoes.kind}`);
  }
  if (opcoes.command !== undefined && envelope.command !== opcoes.command) {
    falhar(contexto, `command diverge de ${opcoes.command}`);
  }
  return envelope;
}

export function extrairPayloadResultadoCliV1(entrada, opcoes = {}) {
  return validarEnvelopeResultadoCliV1(entrada, opcoes).payload;
}

export function validarEnvelopeControleCliV1(entrada, opcoes = {}) {
  const contexto = opcoes.contexto ?? "controle da CLI";
  const envelope = parsearDocumentoJsonCli(entrada, contexto);
  if (!possuiChavesExatas(envelope, CHAVES_CONTROLE_CLI_V1)) {
    falhar(contexto, "o envelope de controle deve conter exatamente seis campos públicos");
  }
  if (
    envelope.schemaVersion !== SCHEMA_CONTROLE_CLI_V1
    || typeof envelope.ok !== "boolean"
    || !TIPOS_CONTROLE.has(envelope.kind)
    || typeof envelope.code !== "string"
    || !PADRAO_CODIGO_PUBLICO.test(envelope.code)
    || !mensagemPublicaSegura(envelope.message, {
      permitirSintaxeAjuda: envelope.kind === "HELP",
    })
    || !Number.isInteger(envelope.exitCode)
    || envelope.exitCode < 0
  ) {
    falhar(contexto, "o envelope de controle não respeita sema.cli.control/v1");
  }
  const help = envelope.kind === "HELP";
  if (envelope.ok !== help || (help ? envelope.exitCode !== 0 : envelope.exitCode <= 0)) {
    falhar(contexto, "ok e exitCode divergem do tipo de controle");
  }
  if (opcoes.exitCode !== undefined && envelope.exitCode !== opcoes.exitCode) {
    falhar(contexto, "exitCode diverge do status do processo");
  }
  if (opcoes.kind !== undefined && envelope.kind !== opcoes.kind) {
    falhar(contexto, `kind diverge de ${opcoes.kind}`);
  }
  if (opcoes.code !== undefined && envelope.code !== opcoes.code) {
    falhar(contexto, `code diverge de ${opcoes.code}`);
  }
  return envelope;
}

export function extrairPayloadCliCompativelComVersao(entrada, opcoes = {}) {
  const contexto = opcoes.contexto ?? "resultado compatível da CLI";
  const versaoCli = opcoes.versaoCli;
  if (typeof versaoCli !== "string" || !PADRAO_SEMVER_EXATA.test(versaoCli)) {
    falhar(contexto, "versaoCli deve ser SemVer exata");
  }
  const documento = parsearDocumentoJsonCli(entrada, contexto);
  const major = Number.parseInt(versaoCli.split(".", 1)[0], 10);
  if (major === 3) {
    return extrairPayloadResultadoCliV1(documento, opcoes);
  }
  if (major === 2) {
    if (
      ehRegistro(documento)
      && (documento.schemaVersion === SCHEMA_RESULTADO_CLI_V1 || documento.schemaVersion === SCHEMA_CONTROLE_CLI_V1)
    ) {
      falhar(contexto, "a saída 2.x esperada é o payload legado, não um envelope de 3.x ou de controle");
    }
    if (!ehValorJson(documento)) falhar(contexto, "o payload legado 2.x não é JSON");
    return documento;
  }
  falhar(contexto, "somente 2.x legado ou 3.x com envelope result/v1 são suportados");
}
