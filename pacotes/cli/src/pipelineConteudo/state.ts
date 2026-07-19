// SEMA-GOVERNED: sema.produto.pipeline_conteudo.estado
// Descricao: replay deterministico do ledger canonico, com veredito e condicao operacional independentes.

import { hashCanonicoConteudo } from "./canonical.js";
import {
  avaliarConstraintsDeterministicasConteudo,
  escopoAutorizacaoAlvo,
  escopoAutorizacaoGlobal,
  type ObservacoesDeterministicasArtefatoConteudo,
} from "./adapters.js";
import { validarLedgerConteudo } from "./ledger.js";
import {
  planejarPipelineConteudo,
  validarDefinicaoPipelineConteudo,
} from "./planner.js";
import {
  avaliarGateConteudoInterno,
  validarConfiguracaoConfiancaConteudo,
  verificarEnvelopeAssinadoConteudo,
} from "./trust.js";
import type {
  AdaptadorConteudo,
  AlegacaoEvidenciaConteudo,
  AlvoConteudo,
  ArtefatoConteudo,
  AtestadoEvidenciaConteudo,
  ConfiguracaoConfiancaConteudo,
  CondicaoOperacionalConteudo,
  DefinicaoPipelineConteudo,
  EnvelopeAssinadoConteudo,
  EnvelopeVerificadoConteudo,
  EstadoGateConteudo,
  EtapaPipelineConteudo,
  EventoLedgerConteudo,
  EventoPayloadConteudo,
  InicioExecucaoConteudo,
  ParecerIAConteudo,
  PoliticaConfiancaConteudo,
  PoliticaGateConteudo,
  PrincipalConteudo,
  ResultadoAvaliacaoConteudo,
} from "./types.js";

export interface EntradaDerivarEstadoPipelineConteudo {
  readonly eventos: readonly EventoLedgerConteudo<EventoPayloadConteudo>[];
  readonly envelopePolitica: EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo>;
  readonly definicao: DefinicaoPipelineConteudo;
  readonly configuracaoConfianca: ConfiguracaoConfiancaConteudo;
  readonly trustRootDigestEsperado: string;
  readonly revocationDigestEsperado: string;
  readonly expectedHead: string;
}

export interface ResultadoEstadoPipelineConteudo {
  readonly valido: boolean;
  readonly runId: string;
  readonly estadosGate: readonly EstadoGateConteudo[];
  readonly concluido: boolean;
  readonly nextActions: readonly string[];
  readonly artifactsAceitos: readonly ArtefatoConteudo[];
}

interface EventoComPayload<TPayload extends EventoPayloadConteudo> {
  readonly evento: EventoLedgerConteudo<EventoPayloadConteudo>;
  readonly payload: TPayload;
}

interface ResultadoConstraintsGate {
  readonly evidencias: readonly EnvelopeVerificadoConteudo<AtestadoEvidenciaConteudo>[];
  readonly bloqueios: readonly string[];
  readonly reprovar: boolean;
}

const ALVO_GLOBAL = "\u0000global";
const EVIDENCIA_CONSTRAINTS_ADAPTER = "adapter.constraints.passed";
const IDADE_MAXIMA_POLICY_PADRAO_MS = 5 * 60 * 1000;
const DESVIO_FUTURO_POLICY_PADRAO_MS = 30 * 1000;

function chaveAlvo(targetId: string | undefined): string {
  return targetId ?? ALVO_GLOBAL;
}

function chaveGate(gateId: string, targetId: string | undefined): string {
  return `${gateId}\u0000${chaveAlvo(targetId)}`;
}

function chaveEtapa(stageId: string, targetId: string | undefined): string {
  return `${stageId}\u0000${chaveAlvo(targetId)}`;
}

function alvoExato(recebido: string | undefined, esperado: string | undefined): boolean {
  return recebido === esperado;
}

function gatePorAlvo(gate: PoliticaGateConteudo): boolean {
  return gate.scope === "POR_ALVO";
}

function unico<T>(valores: readonly T[]): T[] {
  return [...new Set(valores)];
}

function mesmosConjuntos(a: readonly string[], b: ReadonlySet<string>): boolean {
  return a.length === b.size && a.every((item) => b.has(item));
}

function falhaEstado(runId: string, acoes: readonly string[]): ResultadoEstadoPipelineConteudo {
  return { valido: false, runId, estadosGate: [], concluido: false, nextActions: unico(acoes), artifactsAceitos: [] };
}

function configuracaoConfianca(
  entrada: EntradaDerivarEstadoPipelineConteudo,
): ConfiguracaoConfiancaConteudo {
  return entrada.configuracaoConfianca;
}

function eventosDoTipo<TPayload extends EventoPayloadConteudo["kind"]>(
  eventos: readonly EventoLedgerConteudo<EventoPayloadConteudo>[],
  kind: TPayload,
): Array<EventoComPayload<Extract<EventoPayloadConteudo, { kind: TPayload }>>> {
  const encontrados: Array<EventoComPayload<Extract<EventoPayloadConteudo, { kind: TPayload }>>> = [];
  for (const evento of eventos) {
    if (evento.envelope.payload.kind === kind) {
      encontrados.push({
        evento,
        payload: evento.envelope.payload as Extract<EventoPayloadConteudo, { kind: TPayload }>,
      });
    }
  }
  return encontrados;
}

function principalPorId(principals: readonly PrincipalConteudo[], principalId: string): PrincipalConteudo | undefined {
  const encontrados = principals.filter((principal) => principal.principalId === principalId);
  return encontrados.length === 1 ? encontrados[0] : undefined;
}

function verificarAtestado(
  item: EventoComPayload<AtestadoEvidenciaConteudo>,
  confianca: ConfiguracaoConfiancaConteudo,
  trustRootDigestEsperado: string,
  revocationDigestEsperado: string,
): EnvelopeVerificadoConteudo<AtestadoEvidenciaConteudo> | undefined {
  const envelope = item.evento.envelope as EnvelopeAssinadoConteudo<AtestadoEvidenciaConteudo>;
  const verificacao = verificarEnvelopeAssinadoConteudo(envelope, confianca, {
    trustRootDigestEsperado,
    revocationDigestEsperado,
    payloadTypeEsperado: "EVIDENCE_ATTESTED",
    papeisPermitidos: ["EVIDENCE_ATTESTER", "ADAPTER"],
    scopeRequerido: item.payload.authorizationScope,
    agora: item.payload.observedAt,
  });
  if (!verificacao.valido || verificacao.principal?.principalId !== item.payload.attesterId) return undefined;
  return verificacao.envelopeVerificado;
}

function verificarParecer(
  item: EventoComPayload<ParecerIAConteudo>,
  confianca: ConfiguracaoConfiancaConteudo,
  trustRootDigestEsperado: string,
  revocationDigestEsperado: string,
): EnvelopeVerificadoConteudo<ParecerIAConteudo> | undefined {
  const envelope = item.evento.envelope as EnvelopeAssinadoConteudo<ParecerIAConteudo>;
  const verificacao = verificarEnvelopeAssinadoConteudo(envelope, confianca, {
    trustRootDigestEsperado,
    revocationDigestEsperado,
    payloadTypeEsperado: "AI_ASSESSMENT",
    papeisPermitidos: ["EVALUATOR"],
    scopeRequerido: item.payload.authorizationScope,
    agora: item.payload.assessedAt,
  });
  if (!verificacao.valido || verificacao.principal?.principalId !== item.payload.evaluatorId) return undefined;
  return verificacao.envelopeVerificado;
}

function instanciaGateIds(
  definicao: DefinicaoPipelineConteudo,
  inicio: InicioExecucaoConteudo,
): Array<{ gate: PoliticaGateConteudo; targetId?: string }> {
  const instancias: Array<{ gate: PoliticaGateConteudo; targetId?: string }> = [];
  for (const gate of definicao.gates) {
    if (gatePorAlvo(gate)) {
      for (const alvo of inicio.targets) instancias.push({ gate, targetId: alvo.targetId });
    } else {
      instancias.push({ gate });
    }
  }
  return instancias;
}

function proximaAcao(estado: EstadoGateConteudo): string | undefined {
  const id = chaveGate(estado.gateId, estado.targetId).replace("\u0000", ":");
  if (estado.veredito === "APROVADO") return undefined;
  if (estado.artifactDigest.length === 0) return `produzir_artefato:${id}`;
  if (
    estado.veredito === "REPROVADO" ||
    estado.blockers.some((item) => item === "artefato_desatualizado" || item.startsWith("constraint_nao_satisfeita:"))
  ) {
    return `corrigir_artefato:${id}`;
  }
  if (
    estado.condition === "FERRAMENTA_INDISPONIVEL" ||
    estado.condition === "CAPACIDADE_AUSENTE" ||
    estado.condition === "AUTORIZACAO_AUSENTE" ||
    estado.condition === "FALHA_TRANSITORIA" ||
    estado.condition === "FALHA_TERMINAL"
  ) {
    return `resolver_condicao:${id}:${estado.condition}`;
  }
  return `coletar_evidencia:${id}`;
}

function escopoEsperadoArtefato(
  stage: EtapaPipelineConteudo,
  inicio: InicioExecucaoConteudo,
  targetId: string | undefined,
): string | undefined {
  if (stage.scope === "GLOBAL") return targetId === undefined ? escopoAutorizacaoGlobal(inicio.runId) : undefined;
  if (targetId === undefined) return undefined;
  const alvo = inicio.targets.find((item) => item.targetId === targetId);
  return alvo === undefined ? undefined : escopoAutorizacaoAlvo(inicio.runId, alvo);
}

function chavesDependencias(
  stage: EtapaPipelineConteudo,
  targetId: string | undefined,
  definicao: DefinicaoPipelineConteudo,
  inicio: InicioExecucaoConteudo,
): string[] {
  const stages = new Map(definicao.stages.map((item) => [item.stageId, item]));
  const chaves: string[] = [];
  for (const dependenciaId of stage.dependsOn) {
    const dependencia = stages.get(dependenciaId);
    if (dependencia === undefined) continue;
    if (dependencia.scope === "GLOBAL") {
      chaves.push(chaveEtapa(dependenciaId, undefined));
    } else if (stage.scope === "POR_ALVO") {
      chaves.push(chaveEtapa(dependenciaId, targetId));
    } else {
      for (const alvo of inicio.targets) chaves.push(chaveEtapa(dependenciaId, alvo.targetId));
    }
  }
  return chaves;
}

function bloqueiosDependenciasAtuais(
  artifact: ArtefatoConteudo,
  stage: EtapaPipelineConteudo,
  definicao: DefinicaoPipelineConteudo,
  inicio: InicioExecucaoConteudo,
  artefatosPorEtapa: ReadonlyMap<string, ArtefatoConteudo>,
): string[] {
  const bloqueios: string[] = [];
  for (const chave of chavesDependencias(stage, artifact.targetId, definicao, inicio)) {
    const dependencia = artefatosPorEtapa.get(chave);
    if (dependencia === undefined) bloqueios.push(`dependencia_ausente:${chave.replace("\u0000", ":")}`);
    else if (!artifact.lineageDigests.includes(dependencia.digest)) bloqueios.push(`dependencia_desatualizada:${dependencia.digest}`);
  }
  return bloqueios;
}

function extrairObservacoes(data: AtestadoEvidenciaConteudo["data"]): ObservacoesDeterministicasArtefatoConteudo {
  if (data === undefined || data === null || typeof data !== "object" || Array.isArray(data)) return {};
  const raiz = data as unknown as Record<string, unknown>;
  const aninhada = raiz.observations;
  const fonte = aninhada !== null && typeof aninhada === "object" && !Array.isArray(aninhada)
    ? aninhada as Record<string, unknown>
    : raiz;
  const numero = (valor: unknown): number | undefined =>
    typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? valor : undefined;
  return {
    observedMediaType: typeof fonte.observedMediaType === "string" && fonte.observedMediaType.trim().length > 0
      ? fonte.observedMediaType
      : undefined,
    artifactBytes: numero(fonte.artifactBytes),
    mediaDuration: numero(fonte.mediaDuration),
    textLength: numero(fonte.textLength),
  };
}

function filtrarConstraintsDoAdapter(
  gate: PoliticaGateConteudo,
  artifact: ArtefatoConteudo,
  alvo: AlvoConteudo | undefined,
  adapter: AdaptadorConteudo | undefined,
  evidencias: readonly EnvelopeVerificadoConteudo<AtestadoEvidenciaConteudo>[],
): ResultadoConstraintsGate {
  if (!gate.requiredEvidence.includes(EVIDENCIA_CONSTRAINTS_ADAPTER)) {
    return { evidencias, bloqueios: [], reprovar: false };
  }
  if (alvo === undefined || adapter === undefined) {
    return { evidencias: [], bloqueios: ["adapter_do_target_ausente"], reprovar: false };
  }
  if (!adapter.acceptedMediaTypes.includes(artifact.mediaType)) {
    return { evidencias: [], bloqueios: [`media_type_nao_aceito:${artifact.mediaType}`], reprovar: true };
  }

  const aceitas: EnvelopeVerificadoConteudo<AtestadoEvidenciaConteudo>[] = [];
  const bloqueios: string[] = [];
  let reprovar = false;
  for (const evidencia of evidencias) {
    const atestado = evidencia.payload;
    if (atestado.evidenceType !== EVIDENCIA_CONSTRAINTS_ADAPTER) {
      aceitas.push(evidencia);
      continue;
    }
    const data = atestado.data as unknown as Record<string, unknown> | undefined;
    if (data?.adapterId !== adapter.adapterId || data?.adapterVersion !== adapter.version) {
      bloqueios.push(`constraint_adapter_binding_divergente:${atestado.evidenceId}`);
      continue;
    }
    const observacoes = extrairObservacoes(atestado.data);
    const resultado = avaliarConstraintsDeterministicasConteudo(
      artifact,
      adapter.deterministicConstraints,
      observacoes,
    );
    if (data?.constraintsDigest !== resultado.constraintsDigest) {
      bloqueios.push(`constraint_digest_divergente:${atestado.evidenceId}`);
      continue;
    }
    if (data?.resultsDigest !== resultado.resultsDigest) {
      bloqueios.push(`constraint_result_digest_divergente:${atestado.evidenceId}`);
      continue;
    }
    const haFalhaDeterministica = resultado.bloqueios.some(
      (item) => item.startsWith("constraint_nao_satisfeita:"),
    );
    const mediaTypeAusente = observacoes.observedMediaType === undefined;
    const mediaTypeReprovado = !mediaTypeAusente && (
      observacoes.observedMediaType !== artifact.mediaType ||
      !adapter.acceptedMediaTypes.includes(observacoes.observedMediaType!)
    );
    if (mediaTypeAusente) bloqueios.push(`constraint_observed_media_type_ausente:${atestado.evidenceId}`);
    if (mediaTypeReprovado) bloqueios.push(`constraint_observed_media_type_divergente:${atestado.evidenceId}`);
    const resultadoEsperado = resultado.valido && !mediaTypeAusente && !mediaTypeReprovado
      ? "APROVADO"
      : haFalhaDeterministica || mediaTypeReprovado
        ? "REPROVADO"
        : "INCONCLUSIVO";
    if (atestado.result !== resultadoEsperado) {
      bloqueios.push(`constraint_resultado_declarado_divergente:${atestado.evidenceId}`);
      continue;
    }
    if (!resultado.valido) bloqueios.push(...resultado.bloqueios.map((item) => `${item}:${atestado.evidenceId}`));
    reprovar ||= resultadoEsperado === "REPROVADO";
    aceitas.push(evidencia);
  }
  return { evidencias: aceitas, bloqueios: unico(bloqueios), reprovar };
}

function filtrarConfirmacoesDoAdapter(
  stage: EtapaPipelineConteudo,
  adapter: AdaptadorConteudo | undefined,
  evidencias: readonly EnvelopeVerificadoConteudo<AtestadoEvidenciaConteudo>[],
): ResultadoConstraintsGate {
  if (stage.adapterPolicy !== "CONFIRMATION") {
    return { evidencias, bloqueios: [], reprovar: false };
  }
  if (adapter === undefined) return { evidencias: [], bloqueios: ["adapter_do_target_ausente"], reprovar: false };
  const predicates = new Set(adapter.confirmationPredicates);
  const aceitas: EnvelopeVerificadoConteudo<AtestadoEvidenciaConteudo>[] = [];
  const bloqueios: string[] = [];
  for (const evidencia of evidencias) {
    const atestado = evidencia.payload;
    if (!predicates.has(atestado.evidenceType)) {
      aceitas.push(evidencia);
      continue;
    }
    const data = atestado.data as unknown as Record<string, unknown> | undefined;
    if (data?.adapterId !== adapter.adapterId || data?.adapterVersion !== adapter.version) {
      bloqueios.push(`confirmacao_adapter_binding_divergente:${atestado.evidenceId}`);
      continue;
    }
    if (typeof data?.observationDigest !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(data.observationDigest)) {
      bloqueios.push(`confirmacao_observation_digest_invalido:${atestado.evidenceId}`);
      continue;
    }
    aceitas.push(evidencia);
  }
  return { evidencias: aceitas, bloqueios: unico(bloqueios), reprovar: false };
}

function capabilityAtestadorAdapter(adapter: AdaptadorConteudo, evidenceType: string): string {
  return `content.adapter.attest:${encodeURIComponent(adapter.adapterId)}@${encodeURIComponent(adapter.version)}:${evidenceType}`;
}

function capabilitiesAtestadorDoAdapter(
  stage: EtapaPipelineConteudo,
  adapter: AdaptadorConteudo | undefined,
): Readonly<Record<string, string>> {
  if (adapter === undefined || stage.adapterPolicy === "NONE") return {};
  const tipos = stage.adapterPolicy === "CONSTRAINTS"
    ? [EVIDENCIA_CONSTRAINTS_ADAPTER]
    : adapter.confirmationPredicates;
  return Object.fromEntries(tipos.map((tipo) => [tipo, capabilityAtestadorAdapter(adapter, tipo)]));
}

function gateEfetivoDoAdapter(
  gate: PoliticaGateConteudo,
  stage: EtapaPipelineConteudo,
  adapter: AdaptadorConteudo | undefined,
): PoliticaGateConteudo {
  if (stage.adapterPolicy === "NONE" || adapter === undefined) return gate;
  const adicionais = stage.adapterPolicy === "CONSTRAINTS"
    ? [EVIDENCIA_CONSTRAINTS_ADAPTER]
    : adapter.confirmationPredicates;
  return { ...gate, requiredEvidence: unico([...gate.requiredEvidence, ...adicionais]) };
}

/**
 * O estado nasce exclusivamente do replay. Campos como `concluido` presentes
 * em JSON externo ou manifestos nao participam desta funcao.
 */
export function derivarEstadoPipelineConteudo(
  entrada: EntradaDerivarEstadoPipelineConteudo,
): ResultadoEstadoPipelineConteudo {
  const confianca = configuracaoConfianca(entrada);
  const problemasConfiguracao: string[] = [];
  const raizConfianca = validarConfiguracaoConfiancaConteudo(
    confianca,
    entrada.trustRootDigestEsperado,
    entrada.revocationDigestEsperado,
  );
  if (!raizConfianca.valida) {
    problemasConfiguracao.push(...raizConfianca.bloqueios.map((item) => `raiz_confianca_invalida:${item}`));
  }
  const verificacaoPolitica = verificarEnvelopeAssinadoConteudo(
    entrada.envelopePolitica,
    confianca,
    {
      trustRootDigestEsperado: entrada.trustRootDigestEsperado,
      revocationDigestEsperado: entrada.revocationDigestEsperado,
      payloadTypeEsperado: "TRUST_POLICY",
      papeisPermitidos: ["POLICY_AUTHORITY"],
      agora: entrada.envelopePolitica.payload.issuedAt,
    },
  );
  if (!verificacaoPolitica.valido) {
    problemasConfiguracao.push(...verificacaoPolitica.bloqueios.map((item) => `politica_nao_confiavel:${item}`));
  }
  const politica = entrada.envelopePolitica.payload;
  const validacaoDefinicao = validarDefinicaoPipelineConteudo(entrada.definicao);
  const policyDigest = hashCanonicoConteudo(politica);
  if (!validacaoDefinicao.valida) {
    problemasConfiguracao.push(...validacaoDefinicao.bloqueios.map((item) => `definicao_invalida:${item}`));
  }
  if (validacaoDefinicao.definitionDigest !== politica.definitionDigest) {
    problemasConfiguracao.push("definition_digest_divergente");
  }
  if (hashCanonicoConteudo(entrada.definicao.gates) !== hashCanonicoConteudo(politica.gates)) {
    problemasConfiguracao.push("politica_gates_divergentes_da_definicao");
  }
  if (confianca.trustDomainId !== politica.trustDomainId) {
    problemasConfiguracao.push("trust_domain_divergente");
  }
  if (politica.trustRootDigest !== entrada.trustRootDigestEsperado) {
    problemasConfiguracao.push("policy_trust_root_digest_divergente");
  }
  if (entrada.envelopePolitica.issuedAt !== politica.issuedAt) {
    problemasConfiguracao.push("policy_issued_at_divergente");
  }
  const policyIssuedAt = Date.parse(politica.issuedAt);
  const policyExpiresAt = Date.parse(politica.expiresAt);
  if (!Number.isFinite(policyIssuedAt) || !Number.isFinite(policyExpiresAt) || policyExpiresAt <= policyIssuedAt) {
    problemasConfiguracao.push("policy_janela_temporal_invalida");
  }
  if (typeof politica.runId !== "string" || politica.runId.trim().length === 0) {
    problemasConfiguracao.push("policy_run_id_invalido");
  }
  if (problemasConfiguracao.length > 0) {
    return falhaEstado("", problemasConfiguracao.map((item) => `corrigir_configuracao:${item}`));
  }

  const validacaoLedger = validarLedgerConteudo({
    eventos: entrada.eventos,
    envelopePolitica: entrada.envelopePolitica,
    ledgerId: politica.ledgerId,
    expectedHead: entrada.expectedHead,
    principals: confianca.principals,
    trustRootDigestEsperado: entrada.trustRootDigestEsperado,
    revocationDigestEsperado: entrada.revocationDigestEsperado,
    configuracaoConfianca: entrada.configuracaoConfianca,
    contextoEsperado: {
      runId: politica.runId,
      trustDomainId: politica.trustDomainId,
      trustRootDigest: entrada.trustRootDigestEsperado,
      ledgerId: politica.ledgerId,
      policyDigest,
      definitionDigest: politica.definitionDigest,
    },
  });
  if (!validacaoLedger.valido) {
    return falhaEstado("", validacaoLedger.bloqueios.map((item) => `corrigir_ledger:${item}`));
  }

  const inicios = eventosDoTipo(entrada.eventos, "RUN_STARTED");
  if (inicios.length !== 1) {
    return falhaEstado(
      inicios[0]?.payload.runId ?? "",
      [inicios.length === 0 ? "iniciar_execucao" : "corrigir_ledger:multiplos_run_started"],
    );
  }
  const inicio = inicios[0].payload;
  const ativacaoPolicy = Date.parse(inicios[0].evento.recordedAt);
  const idadeMaximaPolicy = confianca.maxEnvelopeAgeMs ?? IDADE_MAXIMA_POLICY_PADRAO_MS;
  const desvioFuturoPolicy = confianca.maxFutureSkewMs ?? DESVIO_FUTURO_POLICY_PADRAO_MS;
  if (
    !Number.isFinite(ativacaoPolicy) ||
    policyIssuedAt > ativacaoPolicy + desvioFuturoPolicy ||
    ativacaoPolicy - policyIssuedAt > idadeMaximaPolicy ||
    ativacaoPolicy > policyExpiresAt
  ) {
    return falhaEstado(inicio.runId, ["corrigir_execucao:policy_fora_da_janela_de_ativacao"]);
  }
  const eventoForaDaJanela = entrada.eventos.find((evento) => {
    const registradoEm = Date.parse(evento.recordedAt);
    return !Number.isFinite(registradoEm) || registradoEm < policyIssuedAt || registradoEm > policyExpiresAt;
  });
  if (eventoForaDaJanela !== undefined) {
    return falhaEstado(inicio.runId, [
      `corrigir_ledger:evento_fora_da_janela_da_politica:${eventoForaDaJanela.eventId}`,
    ]);
  }
  if (
    inicio.definitionDigest !== validacaoDefinicao.definitionDigest ||
    inicio.runId !== politica.runId ||
    inicio.policyDigest !== policyDigest ||
    politica.targetSetDigest !== hashCanonicoConteudo(inicio.targets) ||
    inicio.trustDomainId !== politica.trustDomainId ||
    inicio.trustRootDigest !== entrada.trustRootDigestEsperado ||
    inicio.ledgerId !== politica.ledgerId
  ) {
    return falhaEstado(inicio.runId, ["corrigir_execucao:contexto_ou_target_set_divergente"]);
  }
  const planejamento = planejarPipelineConteudo(entrada.definicao, inicio.targets);
  if (planejamento.bloqueios.length > 0) {
    return falhaEstado(
      inicio.runId,
      planejamento.bloqueios.map((item) => `corrigir_configuracao_alvos:${item}`),
    );
  }

  const revogadas = new Set(confianca.revokedKeyIds);
  const stagesPorId = new Map(entrada.definicao.stages.map((stage) => [stage.stageId, stage]));
  const adaptersPorId = new Map(entrada.definicao.adapters.map((adapter) => [adapter.adapterId, adapter]));
  const artefatosPorEtapa = new Map<string, ArtefatoConteudo>();
  const artefatosPorDigest = new Map<string, ArtefatoConteudo>();
  const linhagemPorDigest = new Map<string, ReadonlySet<string>>();
  const artifactIds = new Set<string>();
  const problemasReplay: string[] = [];

  for (const item of eventosDoTipo(entrada.eventos, "ARTIFACT_REGISTERED")) {
    const artifact = item.payload;
    const bloqueios: string[] = [];
    const stage = stagesPorId.get(artifact.stageId);
    const principal = principalPorId(confianca.principals, artifact.producerId);
    if (stage === undefined) bloqueios.push("stage_nao_declarada");
    if (artifactIds.has(artifact.artifactId)) bloqueios.push("artifact_id_repetido");
    if (artifact.runId !== inicio.runId) bloqueios.push("run_divergente");
    if (principal === undefined || artifact.producerId !== item.evento.envelope.principalId) {
      bloqueios.push("produtor_nao_confiavel");
    } else {
      if (!principal.papeis.includes("PRODUCER")) bloqueios.push("papel_produtor_ausente");
      if (revogadas.has(principal.keyId)) bloqueios.push("chave_produtor_revogada");
      if (stage !== undefined && !principal.capabilities.includes(stage.capability)) {
        bloqueios.push(`capability_produtor_ausente:${stage.capability}`);
      }
    }
    if (stage !== undefined) {
      const escopo = escopoEsperadoArtefato(stage, inicio, artifact.targetId);
      if (escopo === undefined) bloqueios.push("target_incompativel_com_escopo_da_stage");
      else {
        if (artifact.authorizationScope !== escopo) bloqueios.push("authorization_scope_divergente");
        if (principal !== undefined && !principal.scopes.includes(escopo)) bloqueios.push("scope_produtor_ausente");
      }
      if (!stage.produces.includes(artifact.artifactType)) bloqueios.push("artifact_type_nao_declarado");
    }

    const linhagemDerivada = new Set<string>([artifact.producerId]);
    for (const digestAncestral of artifact.lineageDigests) {
      const ancestral = artefatosPorDigest.get(digestAncestral);
      const linhagemAncestral = linhagemPorDigest.get(digestAncestral);
      if (ancestral === undefined || linhagemAncestral === undefined) {
        bloqueios.push(`ancestral_nao_confiavel:${digestAncestral}`);
        continue;
      }
      for (const principalId of linhagemAncestral) linhagemDerivada.add(principalId);
    }
    if (!mesmosConjuntos(artifact.producerLineageIds, linhagemDerivada)) {
      bloqueios.push("producer_lineage_divergente_da_linhagem_derivada");
    }
    if (stage !== undefined) {
      bloqueios.push(...bloqueiosDependenciasAtuais(
        artifact,
        stage,
        entrada.definicao,
        inicio,
        artefatosPorEtapa,
      ));
    }

    artifactIds.add(artifact.artifactId);
    if (bloqueios.length > 0) {
      problemasReplay.push(...bloqueios.map((item) => `ignorar_artefato:${artifact.artifactId}:${item}`));
      continue;
    }
    artefatosPorEtapa.set(chaveEtapa(artifact.stageId, artifact.targetId), artifact);
    artefatosPorDigest.set(artifact.digest, artifact);
    linhagemPorDigest.set(artifact.digest, linhagemDerivada);
  }

  const alegacoesPorId = new Map<string, EventoComPayload<AlegacaoEvidenciaConteudo>>();
  for (const item of eventosDoTipo(entrada.eventos, "EVIDENCE_CLAIMED")) {
    const artifact = artefatosPorDigest.get(item.payload.artifactDigest);
    if (
      item.payload.runId !== inicio.runId ||
      item.payload.producerId !== item.evento.envelope.principalId ||
      artifact === undefined ||
      artifact.producerId !== item.payload.producerId
    ) {
      problemasReplay.push(`ignorar_alegacao_nao_ligada_a_artefato_valido:${item.payload.claimId}`);
      continue;
    }
    alegacoesPorId.set(item.payload.claimId, item);
  }

  const condicoes = new Map<string, CondicaoOperacionalConteudo>();
  const gatesPorId = new Map(entrada.definicao.gates.map((gate) => [gate.gateId, gate]));
  for (const item of eventosDoTipo(entrada.eventos, "OPERATIONAL_CONDITION")) {
    const gate = gatesPorId.get(item.payload.gateId);
    const principal = principalPorId(confianca.principals, item.evento.envelope.principalId);
    if (gate === undefined || principal === undefined || revogadas.has(principal.keyId)) {
      problemasReplay.push(`ignorar_condicao_nao_autorizada:${item.evento.eventId}`);
      continue;
    }
    const targetCorreto = gatePorAlvo(gate)
      ? inicio.targets.some((alvo) => alvo.targetId === item.payload.targetId)
      : item.payload.targetId === undefined;
    if (!targetCorreto) {
      problemasReplay.push(`ignorar_condicao_target_divergente:${item.evento.eventId}`);
      continue;
    }
    condicoes.set(chaveGate(item.payload.gateId, item.payload.targetId), item.payload.condition);
  }

  const atestados = eventosDoTipo(entrada.eventos, "EVIDENCE_ATTESTED");
  const pareceres = eventosDoTipo(entrada.eventos, "AI_ASSESSMENT");
  const estadosGate: EstadoGateConteudo[] = [];
  for (const { gate, targetId } of instanciaGateIds(entrada.definicao, inicio)) {
    const stage = stagesPorId.get(gate.stageId)!;
    const artifact = artefatosPorEtapa.get(chaveEtapa(gate.stageId, targetId));
    const condicaoExplicita = condicoes.get(chaveGate(gate.gateId, targetId));
    if (artifact === undefined) {
      estadosGate.push({
        gateId: gate.gateId,
        targetId,
        artifactDigest: "",
        veredito: "NAO_AVALIADO",
        condition: condicaoExplicita ?? "PENDENTE",
        evidenceIds: [],
        assessmentIds: [],
        blockers: ["artefato_ausente"],
      });
      continue;
    }
    const dependenciasDesatualizadas = bloqueiosDependenciasAtuais(
      artifact,
      stage,
      entrada.definicao,
      inicio,
      artefatosPorEtapa,
    );
    if (dependenciasDesatualizadas.length > 0) {
      estadosGate.push({
        gateId: gate.gateId,
        targetId,
        artifactDigest: artifact.digest,
        veredito: "INCONCLUSIVO",
        condition: condicaoExplicita ?? "AGUARDANDO_EVIDENCIA",
        evidenceIds: [],
        assessmentIds: [],
        blockers: ["artefato_desatualizado", ...dependenciasDesatualizadas],
      });
      continue;
    }

    const evidenciasAceitas: EnvelopeVerificadoConteudo<AtestadoEvidenciaConteudo>[] = [];
    for (const item of atestados) {
      const atestado = item.payload;
      if (
        atestado.runId !== inicio.runId ||
        atestado.gateId !== gate.gateId ||
        atestado.stageId !== gate.stageId ||
        !alvoExato(atestado.targetId, targetId) ||
        atestado.artifactDigest !== artifact.digest ||
        atestado.producerId !== artifact.producerId
      ) continue;
      if (atestado.claimId !== undefined) {
        const alegacao = alegacoesPorId.get(atestado.claimId)?.payload;
        if (
          alegacao === undefined ||
          alegacao.runId !== atestado.runId ||
          alegacao.stageId !== atestado.stageId ||
          !alvoExato(alegacao.targetId, atestado.targetId) ||
          alegacao.artifactDigest !== atestado.artifactDigest ||
          alegacao.evidenceType !== atestado.evidenceType ||
          alegacao.producerId !== atestado.producerId
        ) continue;
      }
      const verificado = verificarAtestado(
        item,
        confianca,
        entrada.trustRootDigestEsperado,
        entrada.revocationDigestEsperado,
      );
      if (verificado !== undefined) evidenciasAceitas.push(verificado);
    }

    const pareceresIa: EnvelopeVerificadoConteudo<ParecerIAConteudo>[] = [];
    for (const item of pareceres) {
      const parecer = item.payload;
      if (
        parecer.runId !== inicio.runId ||
        parecer.gateId !== gate.gateId ||
        !alvoExato(parecer.targetId, targetId) ||
        parecer.artifactDigest !== artifact.digest ||
        parecer.rubricDigest !== gate.rubricDigest
      ) continue;
      const verificado = verificarParecer(
        item,
        confianca,
        entrada.trustRootDigestEsperado,
        entrada.revocationDigestEsperado,
      );
      if (verificado !== undefined) pareceresIa.push(verificado);
    }

    const alvo = targetId === undefined ? undefined : inicio.targets.find((item) => item.targetId === targetId);
    const adapter = alvo === undefined ? undefined : adaptersPorId.get(alvo.adapterId);
    const gateEfetivo = gateEfetivoDoAdapter(gate, stage, adapter);
    const constraints = filtrarConstraintsDoAdapter(gateEfetivo, artifact, alvo, adapter, evidenciasAceitas);
    const confirmacoes = filtrarConfirmacoesDoAdapter(stage, adapter, constraints.evidencias);
    const avaliacao = avaliarGateConteudoInterno({
      envelopePolitica: entrada.envelopePolitica,
      gate,
      requiredEvidenceAdicional: gateEfetivo.requiredEvidence.filter(
        (tipo) => !gate.requiredEvidence.includes(tipo),
      ),
      attesterCapabilitiesAdicionais: capabilitiesAtestadorDoAdapter(stage, adapter),
      artifactDigest: artifact.digest,
      targetId,
      runId: inicio.runId,
      trustDomainId: inicio.trustDomainId,
      trustRootDigest: inicio.trustRootDigest,
      revocationDigestEsperado: entrada.revocationDigestEsperado,
      ledgerId: inicio.ledgerId,
      policyDigest: inicio.policyDigest,
      definitionDigest: inicio.definitionDigest,
      authorizationScope: artifact.authorizationScope,
      producerId: artifact.producerId,
      producerLineageIds: [...(linhagemPorDigest.get(artifact.digest) ?? [])],
      evidenciasAceitas: confirmacoes.evidencias,
      pareceresIa,
      configuracaoConfianca: confianca,
    });
    const veredito: ResultadoAvaliacaoConteudo | "NAO_AVALIADO" = constraints.reprovar
      ? "REPROVADO"
      : avaliacao.veredito;
    estadosGate.push({
      gateId: gate.gateId,
      targetId,
      artifactDigest: artifact.digest,
      veredito,
      condition: condicaoExplicita ?? (
        veredito === "APROVADO" || veredito === "REPROVADO" ? "PRONTA" : "AGUARDANDO_EVIDENCIA"
      ),
      evidenceIds: avaliacao.evidenceIds,
      assessmentIds: avaliacao.assessmentIds,
      blockers: unico([...avaliacao.bloqueios, ...constraints.bloqueios, ...confirmacoes.bloqueios]),
    });
  }

  const nextActions = estadosGate.map(proximaAcao).filter((acao): acao is string => acao !== undefined);
  nextActions.push(...problemasReplay);
  const gatesDeConclusao = new Set(entrada.definicao.requiredCompletionGates);
  const estadosObrigatorios = estadosGate.filter((estado) => gatesDeConclusao.has(estado.gateId));
  const concluido =
    problemasReplay.length === 0 &&
    estadosObrigatorios.length > 0 &&
    estadosObrigatorios.every((estado) => estado.veredito === "APROVADO");
  return {
    valido: true,
    runId: inicio.runId,
    estadosGate,
    concluido,
    nextActions: unico(nextActions),
    artifactsAceitos: [...artefatosPorEtapa.values()],
  };
}
