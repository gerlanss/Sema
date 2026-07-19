// SEMA-GOVERNED: sema.produto.pipeline_conteudo.ledger
// Descricao: ledger hash-chained verificavel, com payloads contextuais estritos e replay historico.

import { hashCanonicoConteudo } from "./canonical.js";
import {
  escopoAutorizacaoAlvo,
  escopoAutorizacaoGlobal,
  validarMetadataPublicaConteudo,
  validarReferenciaAccountScopeConteudo,
} from "./adapters.js";
import {
  validarConfiguracaoConfiancaConteudo,
  verificarEnvelopeAssinadoConteudo,
  verificarEnvelopeAssinadoConteudoHistoricoInterno,
} from "./trust.js";
import type {
  AlegacaoEvidenciaConteudo,
  AlvoConteudo,
  ArtefatoConteudo,
  AtestadoEvidenciaConteudo,
  ConfiguracaoConfiancaConteudo,
  ContextoAssinadoEventoConteudo,
  EnvelopeAssinadoConteudo,
  EventoLedgerConteudo,
  EventoPayloadConteudo,
  InicioExecucaoConteudo,
  ParecerIAConteudo,
  PoliticaConfiancaConteudo,
  PrincipalConteudo,
} from "./types.js";

export const HEAD_GENESIS_LEDGER_CONTEUDO = `sha256:${"0".repeat(64)}`;

export interface ContextoEsperadoLedgerConteudo {
  readonly trustDomainId: string;
  readonly trustRootDigest: string;
  readonly ledgerId: string;
  readonly policyDigest: string;
  readonly definitionDigest: string;
  readonly runId: string;
}

export interface EntradaValidacaoLedgerConteudo {
  readonly eventos: readonly EventoLedgerConteudo<EventoPayloadConteudo>[];
  readonly envelopePolitica: EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo>;
  readonly ledgerId: string;
  readonly expectedHead: string;
  readonly principals: readonly PrincipalConteudo[];
  readonly trustRootDigestEsperado: string;
  readonly revocationDigestEsperado: string;
  readonly configuracaoConfianca?: Omit<ConfiguracaoConfiancaConteudo, "principals">;
  /** Quando presente, ancora o contexto do RUN_STARTED na policy/definition verificadas pelo chamador. */
  readonly contextoEsperado: ContextoEsperadoLedgerConteudo;
}

export interface ResultadoValidacaoLedgerConteudo {
  readonly valido: boolean;
  readonly head: string;
  readonly eventosValidos: number;
  readonly bloqueios: readonly string[];
}

export interface EntradaAnexarEventoLedgerConteudo<TPayload extends EventoPayloadConteudo> {
  readonly ledgerId: string;
  /** Checkpoint conservado fora da mutacao que solicita o append. */
  readonly expectedHead: string;
  readonly schemaVersion: string;
  readonly eventId: string;
  readonly recordedAt: string;
  readonly envelope: EnvelopeAssinadoConteudo<TPayload>;
  /** Policy assinada usada para ancorar run, definition e target set. */
  readonly envelopePolitica: EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo>;
  readonly configuracaoConfianca: ConfiguracaoConfiancaConteudo;
  /** Pin fornecido pela fronteira chamadora; nunca derivado implicitamente do arquivo local. */
  readonly trustRootDigestEsperado: string;
  readonly revocationDigestEsperado: string;
}

export interface ResultadoAnexarEventoLedgerConteudo<TPayload extends EventoPayloadConteudo> {
  readonly eventos: readonly EventoLedgerConteudo<EventoPayloadConteudo>[];
  readonly evento: EventoLedgerConteudo<TPayload>;
  readonly head: string;
}

export interface EntradaValidarPayloadEventoConteudo {
  readonly principalId?: string;
  readonly contextoEsperado?: ContextoEsperadoLedgerConteudo;
  readonly inicio?: InicioExecucaoConteudo;
  readonly artefatosAnteriores?: readonly ArtefatoConteudo[];
  readonly alegacoesAnteriores?: readonly AlegacaoEvidenciaConteudo[];
}

export interface ResultadoValidarPayloadEventoConteudo {
  readonly valido: boolean;
  readonly kind?: EventoPayloadConteudo["kind"];
  readonly bloqueios: readonly string[];
}

const KINDS_EVENTO = new Set<EventoPayloadConteudo["kind"]>([
  "RUN_STARTED",
  "OPERATIONAL_CONDITION",
  "ARTIFACT_REGISTERED",
  "EVIDENCE_CLAIMED",
  "EVIDENCE_ATTESTED",
  "AI_ASSESSMENT",
]);

const CAMPOS_BASE = ["kind", "runId", "trustDomainId", "trustRootDigest", "ledgerId", "policyDigest", "definitionDigest"] as const;
const CAMPOS_AUTORIZADOS = [...CAMPOS_BASE, "authorizationScope"] as const;
const CAMPOS_POR_KIND: Readonly<Record<EventoPayloadConteudo["kind"], readonly string[]>> = {
  RUN_STARTED: [...CAMPOS_BASE, "targets", "startedAt"],
  OPERATIONAL_CONDITION: [...CAMPOS_AUTORIZADOS, "gateId", "targetId", "condition", "reason", "reportedAt"],
  ARTIFACT_REGISTERED: [
    ...CAMPOS_AUTORIZADOS,
    "artifactId", "stageId", "targetId", "producerId", "producerLineageIds", "version",
    "artifactType", "mediaType", "digest", "lineageDigests",
  ],
  EVIDENCE_CLAIMED: [
    ...CAMPOS_AUTORIZADOS,
    "claimId", "stageId", "targetId", "artifactDigest", "evidenceType", "producerId", "claimedAt", "data",
  ],
  EVIDENCE_ATTESTED: [
    ...CAMPOS_AUTORIZADOS,
    "evidenceId", "claimId", "gateId", "stageId", "targetId", "artifactDigest", "evidenceType",
    "producerId", "attesterId", "result", "observedAt", "data",
  ],
  AI_ASSESSMENT: [
    ...CAMPOS_AUTORIZADOS,
    "assessmentId", "gateId", "targetId", "artifactDigest", "rubricDigest", "evaluatorId",
    "capability", "result", "assessedAt", "rationaleDigest", "data",
  ],
};

const CONDICOES_OPERACIONAIS = new Set([
  "PENDENTE", "PRONTA", "EXECUTANDO", "AGUARDANDO_EVIDENCIA", "AGUARDANDO_EVENTO_EXTERNO",
  "FERRAMENTA_INDISPONIVEL", "CAPACIDADE_AUSENTE", "AUTORIZACAO_AUSENTE", "FALHA_TRANSITORIA",
  "FALHA_TERMINAL", "EXECUCAO_ENCERRADA",
]);
const RESULTADOS = new Set(["APROVADO", "REPROVADO", "INCONCLUSIVO"]);
const CAMPOS_EVENTO_LEDGER = [
  "schemaVersion", "ledgerId", "sequence", "eventId", "recordedAt", "previousHash", "envelope", "hash",
] as const;
const IDADE_MAXIMA_APPEND_PADRAO_MS = 5 * 60 * 1000;
const DESVIO_FUTURO_APPEND_PADRAO_MS = 30 * 1000;

function objeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor === valor.trim() && !/[\u0000-\u001f\u007f]/u.test(valor);
}

function instante(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0 && Number.isFinite(Date.parse(valor));
}

function digest(valor: unknown): valor is string {
  return typeof valor === "string" && /^sha256:[a-f0-9]{64}$/u.test(valor);
}

function listaTexto(valor: unknown, permitirVazia = false): valor is readonly string[] {
  return Array.isArray(valor)
    && (permitirVazia || valor.length > 0)
    && valor.every(texto)
    && new Set(valor).size === valor.length;
}

function adicionar(bloqueios: string[], codigo: string): void {
  if (!bloqueios.includes(codigo)) bloqueios.push(codigo);
}

function validarCamposExatos(
  valor: Record<string, unknown>,
  permitidos: readonly string[],
  bloqueios: string[],
): void {
  const conjunto = new Set(permitidos);
  for (const campo of Object.keys(valor)) {
    if (!conjunto.has(campo)) adicionar(bloqueios, "campo_nao_permitido");
  }
}

function validarContextoBase(
  payload: Record<string, unknown>,
  esperado: ContextoEsperadoLedgerConteudo | undefined,
  bloqueios: string[],
): void {
  for (const campo of ["runId", "trustDomainId", "ledgerId"] as const) {
    if (!texto(payload[campo])) adicionar(bloqueios, `${campo}_invalido`);
  }
  for (const campo of ["trustRootDigest", "policyDigest", "definitionDigest"] as const) {
    if (!digest(payload[campo])) adicionar(bloqueios, `${campo}_invalido`);
  }
  if (esperado === undefined) return;
  for (const campo of ["trustDomainId", "trustRootDigest", "ledgerId", "policyDigest", "definitionDigest"] as const) {
    if (payload[campo] !== esperado[campo]) adicionar(bloqueios, `${campo}_divergente`);
  }
  if (esperado.runId !== undefined && payload.runId !== esperado.runId) {
    adicionar(bloqueios, "runId_divergente");
  }
}

function validarAlvo(valor: unknown, bloqueios: string[], indice: number): valor is AlvoConteudo {
  if (!objeto(valor)) {
    adicionar(bloqueios, `target_${indice}:estrutura_invalida`);
    return false;
  }
  validarCamposExatos(
    valor,
    ["targetId", "adapterId", "accountScope", "formatProfileId", "locale", "metadata"],
    bloqueios,
  );
  for (const campo of ["targetId", "adapterId", "accountScope", "formatProfileId", "locale"] as const) {
    if (!texto(valor[campo])) adicionar(bloqueios, `target_${indice}:${campo}_invalido`);
  }
  for (const item of validarReferenciaAccountScopeConteudo(valor.accountScope)) {
    adicionar(bloqueios, `target_${indice}:${item}`);
  }
  if (!objeto(valor.metadata)) adicionar(bloqueios, `target_${indice}:metadata_invalido`);
  else {
    for (const item of Object.values(valor.metadata)) {
      if (item !== null && !["string", "number", "boolean"].includes(typeof item)) {
        adicionar(bloqueios, `target_${indice}:metadata_valor_nao_escalar`);
      } else if (typeof item === "number" && !Number.isFinite(item)) {
        adicionar(bloqueios, `target_${indice}:metadata_numero_nao_finito`);
      }
    }
    for (const item of validarMetadataPublicaConteudo(valor.metadata)) {
      adicionar(bloqueios, `target_${indice}:${item}`);
    }
  }
  return true;
}

function validarEscopoAutorizacao(
  payload: Record<string, unknown>,
  inicio: InicioExecucaoConteudo | undefined,
  bloqueios: string[],
): void {
  if (!texto(payload.authorizationScope)) {
    adicionar(bloqueios, "authorizationScope_invalido");
    return;
  }
  if (inicio === undefined) return;
  const targetId = payload.targetId;
  if (targetId === undefined) {
    if (payload.authorizationScope !== escopoAutorizacaoGlobal(inicio.runId)) {
      adicionar(bloqueios, "authorizationScope_divergente");
    }
    return;
  }
  if (!texto(targetId)) {
    adicionar(bloqueios, "targetId_invalido");
    return;
  }
  const alvo = inicio.targets.find((item) => item.targetId === targetId);
  if (alvo === undefined) {
    adicionar(bloqueios, "target_nao_pertence_a_execucao");
    return;
  }
  if (payload.authorizationScope !== escopoAutorizacaoAlvo(inicio.runId, alvo)) {
    adicionar(bloqueios, "authorizationScope_divergente");
  }
}

function validarIdentidadePayload(
  kind: EventoPayloadConteudo["kind"],
  payload: Record<string, unknown>,
  principalId: string | undefined,
  bloqueios: string[],
): void {
  if (principalId === undefined) return;
  const campo = kind === "ARTIFACT_REGISTERED" || kind === "EVIDENCE_CLAIMED"
    ? "producerId"
    : kind === "EVIDENCE_ATTESTED"
      ? "attesterId"
      : kind === "AI_ASSESSMENT"
        ? "evaluatorId"
        : undefined;
  if (campo !== undefined && payload[campo] !== principalId) adicionar(bloqueios, `${campo}_divergente_do_signatario`);
}

function artefatoExato(
  payload: Record<string, unknown>,
  artefatos: readonly ArtefatoConteudo[],
): ArtefatoConteudo | undefined {
  return [...artefatos].reverse().find((item) =>
    item.runId === payload.runId
    && item.stageId === payload.stageId
    && item.targetId === payload.targetId
    && item.digest === payload.artifactDigest
    && item.producerId === payload.producerId,
  );
}

/**
 * Validador estrutural/contextual publico usado tambem pela CLI antes do append.
 * Ele nao valida assinatura; essa responsabilidade continua na raiz de confianca.
 */
export function validarPayloadEventoConteudo(
  valor: unknown,
  entrada: EntradaValidarPayloadEventoConteudo = {},
): ResultadoValidarPayloadEventoConteudo {
  const bloqueios: string[] = [];
  if (!objeto(valor) || !texto(valor.kind) || !KINDS_EVENTO.has(valor.kind as EventoPayloadConteudo["kind"])) {
    return { valido: false, bloqueios: ["payload_kind_invalido"] };
  }
  const kind = valor.kind as EventoPayloadConteudo["kind"];
  validarCamposExatos(valor, CAMPOS_POR_KIND[kind], bloqueios);
  validarContextoBase(valor, entrada.contextoEsperado, bloqueios);
  validarIdentidadePayload(kind, valor, entrada.principalId, bloqueios);

  if (kind === "RUN_STARTED") {
    if (!instante(valor.startedAt)) adicionar(bloqueios, "startedAt_invalido");
    if (!Array.isArray(valor.targets) || valor.targets.length === 0) {
      adicionar(bloqueios, "targets_invalidos");
    } else {
      const ids = new Set<string>();
      valor.targets.forEach((alvo, indice) => {
        if (validarAlvo(alvo, bloqueios, indice) && objeto(alvo)) {
          const id = alvo.targetId as string;
          if (ids.has(id)) adicionar(bloqueios, `target_${indice}:targetId_duplicado`);
          ids.add(id);
        }
      });
    }
  } else {
    validarEscopoAutorizacao(valor, entrada.inicio, bloqueios);
    if (valor.targetId !== undefined && !texto(valor.targetId)) adicionar(bloqueios, "targetId_invalido");
  }

  if (kind === "OPERATIONAL_CONDITION") {
    if (!texto(valor.gateId)) adicionar(bloqueios, "gateId_invalido");
    if (!CONDICOES_OPERACIONAIS.has(String(valor.condition))) adicionar(bloqueios, "condition_invalida");
    if (!texto(valor.reason)) adicionar(bloqueios, "reason_invalido");
    else if (validarMetadataPublicaConteudo({ reason: valor.reason }).length > 0) {
      adicionar(bloqueios, "reason_contem_possivel_credencial");
    }
    if (!instante(valor.reportedAt)) adicionar(bloqueios, "reportedAt_invalido");
  }

  if (kind === "ARTIFACT_REGISTERED") {
    for (const campo of ["artifactId", "stageId", "producerId", "version", "artifactType", "mediaType"] as const) {
      if (!texto(valor[campo])) adicionar(bloqueios, `${campo}_invalido`);
    }
    if (!digest(valor.digest)) adicionar(bloqueios, "digest_invalido");
    const lineageDigestsValidos = listaTexto(valor.lineageDigests, true)
      && (valor.lineageDigests as unknown[]).every(digest);
    if (!lineageDigestsValidos) {
      adicionar(bloqueios, "lineageDigests_invalidos");
    }
    if (!listaTexto(valor.producerLineageIds, false) || !(valor.producerLineageIds as string[]).includes(String(valor.producerId))) {
      adicionar(bloqueios, "producerLineageIds_invalidos");
    }
    if (Object.prototype.hasOwnProperty.call(valor, "metadata")) adicionar(bloqueios, "artifact_metadata_nao_permitida");
    const anteriores = entrada.artefatosAnteriores ?? [];
    if (lineageDigestsValidos) {
      for (const anteriorDigest of valor.lineageDigests as string[]) {
        if (!anteriores.some((item) => item.digest === anteriorDigest)) {
          adicionar(bloqueios, "lineage_digest_nao_encontrado");
        }
      }
    }
  }

  if (kind === "EVIDENCE_CLAIMED") {
    for (const campo of ["claimId", "stageId", "artifactDigest", "evidenceType", "producerId"] as const) {
      if (!texto(valor[campo])) adicionar(bloqueios, `${campo}_invalido`);
    }
    if (!digest(valor.artifactDigest)) adicionar(bloqueios, "artifactDigest_invalido");
    if (!instante(valor.claimedAt)) adicionar(bloqueios, "claimedAt_invalido");
    if (valor.data !== undefined && !objeto(valor.data)) adicionar(bloqueios, "data_invalido");
    else if (valor.data !== undefined) {
      for (const item of validarMetadataPublicaConteudo(valor.data)) adicionar(bloqueios, item.replace("metadata", "data"));
    }
    if (artefatoExato(valor, entrada.artefatosAnteriores ?? []) === undefined) {
      adicionar(bloqueios, "artefato_da_alegacao_nao_encontrado");
    }
  }

  if (kind === "EVIDENCE_ATTESTED") {
    for (const campo of ["evidenceId", "gateId", "stageId", "artifactDigest", "evidenceType", "producerId", "attesterId"] as const) {
      if (!texto(valor[campo])) adicionar(bloqueios, `${campo}_invalido`);
    }
    if (valor.claimId !== undefined && !texto(valor.claimId)) adicionar(bloqueios, "claimId_invalido");
    if (!digest(valor.artifactDigest)) adicionar(bloqueios, "artifactDigest_invalido");
    if (!RESULTADOS.has(String(valor.result))) adicionar(bloqueios, "result_invalido");
    if (!instante(valor.observedAt)) adicionar(bloqueios, "observedAt_invalido");
    if (valor.data !== undefined && !objeto(valor.data)) adicionar(bloqueios, "data_invalido");
    else if (valor.data !== undefined) {
      for (const item of validarMetadataPublicaConteudo(valor.data)) adicionar(bloqueios, item.replace("metadata", "data"));
    }
    if (valor.claimId !== undefined) {
      const claim = (entrada.alegacoesAnteriores ?? []).find((item) => item.claimId === valor.claimId);
      if (
        claim === undefined
        || claim.runId !== valor.runId
        || claim.stageId !== valor.stageId
        || claim.targetId !== valor.targetId
        || claim.artifactDigest !== valor.artifactDigest
        || claim.evidenceType !== valor.evidenceType
        || claim.producerId !== valor.producerId
      ) {
        adicionar(bloqueios, "alegacao_do_atestado_divergente");
      }
    }
  }

  if (kind === "AI_ASSESSMENT") {
    for (const campo of ["assessmentId", "gateId", "artifactDigest", "rubricDigest", "evaluatorId", "capability"] as const) {
      if (!texto(valor[campo])) adicionar(bloqueios, `${campo}_invalido`);
    }
    if (!digest(valor.artifactDigest)) adicionar(bloqueios, "artifactDigest_invalido");
    if (!digest(valor.rubricDigest)) adicionar(bloqueios, "rubricDigest_invalido");
    if (valor.rationaleDigest !== undefined && !digest(valor.rationaleDigest)) adicionar(bloqueios, "rationaleDigest_invalido");
    if (!RESULTADOS.has(String(valor.result))) adicionar(bloqueios, "result_invalido");
    if (!instante(valor.assessedAt)) adicionar(bloqueios, "assessedAt_invalido");
    if (valor.data !== undefined && !objeto(valor.data)) adicionar(bloqueios, "data_invalido");
    else if (valor.data !== undefined) {
      for (const item of validarMetadataPublicaConteudo(valor.data)) adicionar(bloqueios, item.replace("metadata", "data"));
    }
    const artefato = [...(entrada.artefatosAnteriores ?? [])].reverse().find((item) =>
      item.runId === valor.runId && item.targetId === valor.targetId && item.digest === valor.artifactDigest,
    );
    if (artefato === undefined) adicionar(bloqueios, "artefato_do_parecer_nao_encontrado");
  }

  return { valido: bloqueios.length === 0, kind, bloqueios };
}

function semHash<TPayload>(evento: EventoLedgerConteudo<TPayload>): Omit<EventoLedgerConteudo<TPayload>, "hash"> {
  return {
    schemaVersion: evento.schemaVersion,
    ledgerId: evento.ledgerId,
    sequence: evento.sequence,
    eventId: evento.eventId,
    recordedAt: evento.recordedAt,
    previousHash: evento.previousHash,
    envelope: evento.envelope,
  };
}

export function calcularHashEventoLedgerConteudo<TPayload>(
  evento: Omit<EventoLedgerConteudo<TPayload>, "hash">,
): string {
  return hashCanonicoConteudo(evento);
}

function payloadTypeEsperado(payload: EventoPayloadConteudo): string {
  return payload.kind === "EVIDENCE_CLAIMED" ? "CLAIM_SUBMITTED" : payload.kind;
}

function papeisPermitidos(payload: EventoPayloadConteudo): readonly string[] {
  switch (payload.kind) {
    case "RUN_STARTED": return ["PIPELINE_CONTROLLER"];
    case "ARTIFACT_REGISTERED": return ["PRODUCER"];
    case "EVIDENCE_CLAIMED": return ["PRODUCER", "RUNNER", "ADAPTER"];
    case "EVIDENCE_ATTESTED": return ["EVIDENCE_ATTESTER", "ADAPTER"];
    case "AI_ASSESSMENT": return ["EVALUATOR"];
    case "OPERATIONAL_CONDITION": return ["RUNNER", "ADAPTER"];
  }
}

function configuracaoConfiancaAtual(entrada: EntradaValidacaoLedgerConteudo): ConfiguracaoConfiancaConteudo {
  return {
    trustDomainId: entrada.configuracaoConfianca?.trustDomainId ?? `ledger:${entrada.ledgerId}`,
    principals: entrada.principals,
    revokedKeyIds: entrada.configuracaoConfianca?.revokedKeyIds ?? [],
    maxEnvelopeAgeMs: entrada.configuracaoConfianca?.maxEnvelopeAgeMs,
    maxFutureSkewMs: entrada.configuracaoConfianca?.maxFutureSkewMs,
    schemaVersionsAceitas: entrada.configuracaoConfianca?.schemaVersionsAceitas,
  };
}

function contextoDoInicio(inicio: InicioExecucaoConteudo): ContextoEsperadoLedgerConteudo {
  return {
    runId: inicio.runId,
    trustDomainId: inicio.trustDomainId,
    trustRootDigest: inicio.trustRootDigest,
    ledgerId: inicio.ledgerId,
    policyDigest: inicio.policyDigest,
    definitionDigest: inicio.definitionDigest,
  };
}

export function validarLedgerConteudo(entrada: EntradaValidacaoLedgerConteudo): ResultadoValidacaoLedgerConteudo {
  const bloqueios: string[] = [];
  const eventIds = new Set<string>();
  const nonces = new Set<string>();
  const artefatos: ArtefatoConteudo[] = [];
  const alegacoes: AlegacaoEvidenciaConteudo[] = [];
  const confiancaAtual = configuracaoConfiancaAtual(entrada);
  const raizConfianca = validarConfiguracaoConfiancaConteudo(
    confiancaAtual,
    entrada.trustRootDigestEsperado,
    entrada.revocationDigestEsperado,
  );
  for (const bloqueio of raizConfianca.bloqueios) bloqueios.push(`raiz_confianca_invalida:${bloqueio}`);
  let politica: PoliticaConfiancaConteudo | undefined;
  let policyIssuedAt = Number.NaN;
  let policyExpiresAt = Number.NaN;
  if (entrada.envelopePolitica === undefined || entrada.envelopePolitica === null) {
    adicionar(bloqueios, "envelope_politica_ausente");
  } else if (!objeto(entrada.envelopePolitica) || !objeto(entrada.envelopePolitica.payload)) {
    adicionar(bloqueios, "envelope_politica_invalido");
  } else {
    politica = entrada.envelopePolitica.payload as unknown as PoliticaConfiancaConteudo;
    const verificacaoPolitica = verificarEnvelopeAssinadoConteudo(
      entrada.envelopePolitica,
      confiancaAtual,
      {
        trustRootDigestEsperado: entrada.trustRootDigestEsperado,
        revocationDigestEsperado: entrada.revocationDigestEsperado,
        payloadTypeEsperado: "TRUST_POLICY",
        papelRequerido: "POLICY_AUTHORITY",
        agora: politica.issuedAt,
      },
    );
    for (const bloqueio of verificacaoPolitica.bloqueios) {
      adicionar(bloqueios, `politica_nao_confiavel:${bloqueio}`);
    }
    policyIssuedAt = Date.parse(politica.issuedAt);
    policyExpiresAt = Date.parse(politica.expiresAt);
    if (!Number.isFinite(policyIssuedAt) || !Number.isFinite(policyExpiresAt) || policyExpiresAt <= policyIssuedAt) {
      adicionar(bloqueios, "politica_janela_temporal_invalida");
    }
    let policyDigest = "";
    try {
      policyDigest = hashCanonicoConteudo(politica);
    } catch {
      adicionar(bloqueios, "politica_payload_nao_canonico");
    }
    if (
      politica.runId !== entrada.contextoEsperado.runId
      || politica.trustDomainId !== entrada.contextoEsperado.trustDomainId
      || politica.trustDomainId !== confiancaAtual.trustDomainId
      || politica.trustRootDigest !== entrada.contextoEsperado.trustRootDigest
      || politica.trustRootDigest !== entrada.trustRootDigestEsperado
      || politica.ledgerId !== entrada.contextoEsperado.ledgerId
      || politica.ledgerId !== entrada.ledgerId
      || politica.definitionDigest !== entrada.contextoEsperado.definitionDigest
      || policyDigest !== entrada.contextoEsperado.policyDigest
      || entrada.envelopePolitica.issuedAt !== politica.issuedAt
    ) {
      adicionar(bloqueios, "politica_contexto_divergente");
    }
    if (!digest(politica.targetSetDigest)) adicionar(bloqueios, "politica_target_set_digest_invalido");
  }
  let inicio: InicioExecucaoConteudo | undefined;
  let head = HEAD_GENESIS_LEDGER_CONTEUDO;
  let eventosValidos = 0;

  entrada.eventos.forEach((evento, indice) => {
    const antes = bloqueios.length;
    const prefixo = `evento_${indice}:`;
    const bloquear = (codigo: string): void => {
      bloqueios.push(`${prefixo}${codigo}`);
    };

    const bloqueiosEstrutura: string[] = [];
    validarCamposExatos(evento as unknown as Record<string, unknown>, CAMPOS_EVENTO_LEDGER, bloqueiosEstrutura);
    for (const item of bloqueiosEstrutura) bloquear(item);

    if (!texto(evento.schemaVersion)) bloquear("schema_version_invalida");
    if (evento.schemaVersion !== evento.envelope?.schemaVersion) bloquear("schema_version_divergente_do_envelope");
    if (evento.ledgerId !== entrada.ledgerId) bloquear("ledger_id_divergente");
    if (!Number.isSafeInteger(evento.sequence) || evento.sequence !== indice) bloquear("sequence_invalida");
    if (!texto(evento.eventId)) bloquear("event_id_ausente");
    else if (eventIds.has(evento.eventId)) bloquear("event_id_repetido");
    eventIds.add(evento.eventId);
    if (!instante(evento.recordedAt)) bloquear("recorded_at_invalido");
    else if (
      Number.isFinite(policyIssuedAt)
      && Number.isFinite(policyExpiresAt)
      && (Date.parse(evento.recordedAt) < policyIssuedAt || Date.parse(evento.recordedAt) > policyExpiresAt)
    ) {
      bloquear("recorded_at_fora_da_janela_da_politica");
    }
    if (evento.previousHash !== head) bloquear("previous_hash_invalido");
    try {
      if (evento.hash !== calcularHashEventoLedgerConteudo(semHash(evento))) bloquear("hash_invalido");
    } catch {
      bloquear("evento_nao_canonico");
    }

    const payload = evento.envelope?.payload as unknown;
    const contexto = inicio === undefined ? entrada.contextoEsperado : contextoDoInicio(inicio);
    const validacaoPayload = validarPayloadEventoConteudo(payload, {
      principalId: evento.envelope?.principalId,
      contextoEsperado: contexto,
      inicio,
      artefatosAnteriores: artefatos,
      alegacoesAnteriores: alegacoes,
    });
    for (const item of validacaoPayload.bloqueios) bloquear(item);

    if (validacaoPayload.valido) {
      const tipado = payload as EventoPayloadConteudo;
      if (tipado.kind === "RUN_STARTED") {
        if (indice !== 0) bloquear("run_started_fora_da_genesis");
        if (inicio !== undefined) bloquear("run_started_duplicado");
        if (politica !== undefined) {
          try {
            if (hashCanonicoConteudo(tipado.targets) !== politica.targetSetDigest) {
              bloquear("target_set_digest_divergente_da_politica");
            }
          } catch {
            bloquear("target_set_nao_canonico");
          }
        }
        inicio = tipado;
      } else if (inicio === undefined) {
        bloquear("run_nao_iniciado");
      }
      if (tipado.kind === "ARTIFACT_REGISTERED") {
        if (artefatos.some((item) => item.digest === tipado.digest)) bloquear("artifact_digest_repetido");
        else artefatos.push(tipado);
      }
      if (tipado.kind === "EVIDENCE_CLAIMED") {
        if (alegacoes.some((item) => item.claimId === tipado.claimId)) bloquear("claim_id_repetido");
        else alegacoes.push(tipado);
      }

      const esperado = payloadTypeEsperado(tipado);
      if (evento.envelope.payloadType !== esperado) bloquear("payload_type_invalido");
      const verificacao = verificarEnvelopeAssinadoConteudoHistoricoInterno(evento.envelope, confiancaAtual, {
        trustRootDigestEsperado: entrada.trustRootDigestEsperado,
        revocationDigestEsperado: entrada.revocationDigestEsperado,
        payloadTypeEsperado: esperado,
        papeisPermitidos: papeisPermitidos(tipado),
        scopeRequerido: tipado.kind === "RUN_STARTED" ? undefined : tipado.authorizationScope,
        agora: instante(evento.recordedAt) ? evento.recordedAt : undefined,
        noncesUsados: nonces,
      });
      for (const item of verificacao.bloqueios) bloquear(item);
    }

    if (nonces.has(evento.envelope?.nonce)) bloquear("nonce_repetido");
    if (texto(evento.envelope?.nonce)) nonces.add(evento.envelope.nonce);
    if (bloqueios.length === antes) eventosValidos += 1;
    head = evento.hash;
  });

  if (!digest(entrada.expectedHead)) bloqueios.push("expected_head_invalido");
  else if (entrada.expectedHead !== head) bloqueios.push("expected_head_divergente");
  return { valido: bloqueios.length === 0, head, eventosValidos, bloqueios: [...new Set(bloqueios)] };
}

function validarEstruturaAntesDoAppend(
  eventos: readonly EventoLedgerConteudo<EventoPayloadConteudo>[],
  ledgerId: string,
): string {
  let head = HEAD_GENESIS_LEDGER_CONTEUDO;
  const ids = new Set<string>();
  const nonces = new Set<string>();
  eventos.forEach((evento, indice) => {
    const bloqueiosEstrutura: string[] = [];
    validarCamposExatos(evento as unknown as Record<string, unknown>, CAMPOS_EVENTO_LEDGER, bloqueiosEstrutura);
    if (bloqueiosEstrutura.length > 0) throw new Error(`${bloqueiosEstrutura[0]}:${indice}`);
    if (evento.ledgerId !== ledgerId) throw new Error(`ledger_id_divergente:${indice}`);
    if (evento.sequence !== indice) throw new Error(`sequence_invalida:${indice}`);
    if (evento.previousHash !== head) throw new Error(`previous_hash_invalido:${indice}`);
    if (calcularHashEventoLedgerConteudo(semHash(evento)) !== evento.hash) throw new Error(`hash_invalido:${indice}`);
    if (ids.has(evento.eventId)) throw new Error(`event_id_repetido:${indice}`);
    if (nonces.has(evento.envelope.nonce)) throw new Error(`nonce_repetido:${indice}`);
    ids.add(evento.eventId);
    nonces.add(evento.envelope.nonce);
    head = evento.hash;
  });
  return head;
}

export function anexarEventoLedgerConteudo<TPayload extends EventoPayloadConteudo>(
  eventosAtuais: readonly EventoLedgerConteudo<EventoPayloadConteudo>[],
  entrada: EntradaAnexarEventoLedgerConteudo<TPayload>,
): ResultadoAnexarEventoLedgerConteudo<TPayload> {
  const raizConfianca = validarConfiguracaoConfiancaConteudo(
    entrada.configuracaoConfianca,
    entrada.trustRootDigestEsperado,
    entrada.revocationDigestEsperado,
  );
  if (!raizConfianca.valida) throw new Error(`raiz_confianca_invalida:${raizConfianca.bloqueios.join(",")}`);
  if (entrada.envelopePolitica === undefined || entrada.envelopePolitica === null) {
    throw new Error("envelope_politica_ausente");
  }
  const politica = entrada.envelopePolitica.payload;
  const agora = Date.now();
  const verificacaoPolitica = verificarEnvelopeAssinadoConteudo(
    entrada.envelopePolitica,
    entrada.configuracaoConfianca,
    {
      trustRootDigestEsperado: entrada.trustRootDigestEsperado,
      revocationDigestEsperado: entrada.revocationDigestEsperado,
      payloadTypeEsperado: "TRUST_POLICY",
      papelRequerido: "POLICY_AUTHORITY",
      agora: politica.issuedAt,
    },
  );
  if (!verificacaoPolitica.valido) {
    throw new Error(`politica_nao_confiavel:${verificacaoPolitica.bloqueios.join(",")}`);
  }
  const policyIssuedAt = Date.parse(politica.issuedAt);
  const policyExpiresAt = Date.parse(politica.expiresAt);
  if (
    !Number.isFinite(policyIssuedAt) ||
    !Number.isFinite(policyExpiresAt) ||
    policyExpiresAt <= policyIssuedAt
  ) {
    throw new Error("politica_janela_temporal_invalida");
  }
  if (agora > policyExpiresAt) throw new Error("politica_expirada");
  const policyDigest = hashCanonicoConteudo(politica);
  const contextoPolitica: ContextoEsperadoLedgerConteudo = {
    runId: politica.runId,
    trustDomainId: politica.trustDomainId,
    trustRootDigest: politica.trustRootDigest,
    ledgerId: politica.ledgerId,
    policyDigest,
    definitionDigest: politica.definitionDigest,
  };
  if (
    !texto(politica.runId) ||
    politica.trustDomainId !== entrada.configuracaoConfianca.trustDomainId ||
    politica.trustRootDigest !== entrada.trustRootDigestEsperado ||
    politica.ledgerId !== entrada.ledgerId ||
    entrada.envelopePolitica.issuedAt !== politica.issuedAt ||
    entrada.envelope.payload.runId !== politica.runId ||
    entrada.envelope.payload.policyDigest !== policyDigest ||
    entrada.envelope.payload.definitionDigest !== politica.definitionDigest
  ) {
    throw new Error("politica_contexto_divergente");
  }
  const headAtual = validarEstruturaAntesDoAppend(eventosAtuais, entrada.ledgerId);
  if (entrada.expectedHead !== headAtual) throw new Error("expected_head_divergente");
  const ledgerAtual = validarLedgerConteudo({
    eventos: eventosAtuais,
    envelopePolitica: entrada.envelopePolitica,
    ledgerId: entrada.ledgerId,
    expectedHead: entrada.expectedHead,
    principals: entrada.configuracaoConfianca.principals,
    trustRootDigestEsperado: entrada.trustRootDigestEsperado,
    revocationDigestEsperado: entrada.revocationDigestEsperado,
    configuracaoConfianca: entrada.configuracaoConfianca,
    contextoEsperado: contextoPolitica,
  });
  if (!ledgerAtual.valido) throw new Error(`ledger_invalido:${ledgerAtual.bloqueios.join(",")}`);
  if (!instante(entrada.recordedAt)) throw new Error("recorded_at_invalido");
  const registradoEm = Date.parse(entrada.recordedAt);
  const idadeMaxima = entrada.configuracaoConfianca.maxEnvelopeAgeMs ?? IDADE_MAXIMA_APPEND_PADRAO_MS;
  const desvioFuturo = entrada.configuracaoConfianca.maxFutureSkewMs ?? DESVIO_FUTURO_APPEND_PADRAO_MS;
  if (registradoEm < agora - idadeMaxima) throw new Error("recorded_at_expirado");
  if (registradoEm > agora + desvioFuturo) throw new Error("recorded_at_no_futuro");
  if (registradoEm < policyIssuedAt || registradoEm > policyExpiresAt) {
    throw new Error("evento_fora_da_janela_da_politica");
  }
  if (eventosAtuais.length === 0) {
    if (entrada.envelope.payload.kind !== "RUN_STARTED") throw new Error("genesis_exige_run_started");
    if (
      policyIssuedAt > registradoEm + desvioFuturo ||
      registradoEm - policyIssuedAt > idadeMaxima ||
      registradoEm > policyExpiresAt
    ) {
      throw new Error("politica_fora_da_janela_de_ativacao");
    }
    if (hashCanonicoConteudo(entrada.envelope.payload.targets) !== politica.targetSetDigest) {
      throw new Error("politica_target_set_digest_divergente");
    }
  }
  if (eventosAtuais.some((evento) => evento.eventId === entrada.eventId)) throw new Error("event_id_repetido");
  if (eventosAtuais.some((evento) => evento.envelope.nonce === entrada.envelope.nonce)) throw new Error("nonce_repetido");

  const inicio = eventosAtuais.find((evento) => evento.envelope.payload.kind === "RUN_STARTED")
    ?.envelope.payload as InicioExecucaoConteudo | undefined;
  const artefatos = eventosAtuais
    .filter((evento) => evento.envelope.payload.kind === "ARTIFACT_REGISTERED")
    .map((evento) => evento.envelope.payload as ArtefatoConteudo);
  const alegacoes = eventosAtuais
    .filter((evento) => evento.envelope.payload.kind === "EVIDENCE_CLAIMED")
    .map((evento) => evento.envelope.payload as AlegacaoEvidenciaConteudo);
  const validacaoPayload = validarPayloadEventoConteudo(entrada.envelope.payload, {
    principalId: entrada.envelope.principalId,
    contextoEsperado: inicio ? contextoDoInicio(inicio) : contextoPolitica,
    inicio,
    artefatosAnteriores: artefatos,
    alegacoesAnteriores: alegacoes,
  });
  if (!validacaoPayload.valido) throw new Error(`payload_invalido:${validacaoPayload.bloqueios.join(",")}`);
  const payload = entrada.envelope.payload;
  const verificacaoEnvelope = verificarEnvelopeAssinadoConteudo(
    entrada.envelope,
    entrada.configuracaoConfianca,
    {
      trustRootDigestEsperado: entrada.trustRootDigestEsperado,
      revocationDigestEsperado: entrada.revocationDigestEsperado,
      payloadTypeEsperado: payloadTypeEsperado(payload),
      papeisPermitidos: papeisPermitidos(payload),
      scopeRequerido: payload.kind === "RUN_STARTED" ? undefined : payload.authorizationScope,
      agora,
      noncesUsados: new Set(eventosAtuais.map((evento) => evento.envelope.nonce)),
    },
  );
  if (!verificacaoEnvelope.valido) {
    throw new Error(`envelope_nao_confiavel:${verificacaoEnvelope.bloqueios.join(",")}`);
  }

  const eventoSemHash: Omit<EventoLedgerConteudo<TPayload>, "hash"> = {
    schemaVersion: entrada.schemaVersion,
    ledgerId: entrada.ledgerId,
    sequence: eventosAtuais.length,
    eventId: entrada.eventId,
    recordedAt: entrada.recordedAt,
    previousHash: headAtual,
    envelope: entrada.envelope,
  };
  const evento: EventoLedgerConteudo<TPayload> = {
    ...eventoSemHash,
    hash: calcularHashEventoLedgerConteudo(eventoSemHash),
  };
  const candidato = [...eventosAtuais, evento] as readonly EventoLedgerConteudo<EventoPayloadConteudo>[];
  const validacaoCandidato = validarLedgerConteudo({
    eventos: candidato,
    envelopePolitica: entrada.envelopePolitica,
    ledgerId: entrada.ledgerId,
    expectedHead: evento.hash,
    principals: entrada.configuracaoConfianca.principals,
    trustRootDigestEsperado: entrada.trustRootDigestEsperado,
    revocationDigestEsperado: entrada.revocationDigestEsperado,
    configuracaoConfianca: entrada.configuracaoConfianca,
    contextoEsperado: contextoPolitica,
  });
  if (!validacaoCandidato.valido) {
    throw new Error(`evento_nao_registravel:${validacaoCandidato.bloqueios.join(",")}`);
  }
  return {
    eventos: candidato,
    evento,
    head: evento.hash,
  };
}
