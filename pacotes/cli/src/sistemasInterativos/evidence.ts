// SEMA-GOVERNED: sema.produto.sistemas_interativos.evidencias
// Descricao: valida bundles locais e deriva estado regeneravel, sempre non-authoritative.

import { digestJsonSistemaInterativo, digestSha256Valido } from "./canonical.js";
import { obterAdaptadorSistemaInterativo } from "./catalog.js";
import { planejarSistemaInterativo } from "./planner.js";
import type {
  BundleEvidenciasSistemaInterativo,
  DefinicaoSistemaInterativo,
  EstadoEtapaSistemaInterativo,
  EstadoSistemaInterativo,
  JsonObjetoSistemaInterativo,
  ObservacaoSistemaInterativo,
  PlanoSistemaInterativo,
  ResultadoValidacaoBundleEvidenciasSistemaInterativo,
} from "./types.js";

const MARCADOR_CHAVE_SENSIVEL = /password|passwd|senha|secret|token|privatekey|apikey|credential|credencial|chaveprivada|chavesecreta/;
const VALOR_SENSIVEL = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/=-]+|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}/i;
const FONTES_CLAIM = new Set(["PRODUCER_CLAIM", "RUNNER_CLAIM", "SELF_DECLARED", "CLAIM"]);

interface ExigenciaEvidencia {
  readonly stageId?: string;
  readonly evidenceType: string;
}

function adicionar(lista: string[], valor: string): void {
  if (!lista.includes(valor)) lista.push(valor);
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(valor);
}

function identificadorSeguro(valor: unknown): valor is string {
  return texto(valor)
    && valor.length <= 128
    && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(valor)
    && !VALOR_SENSIVEL.test(valor);
}

function registroObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function chaveSensivel(chave: string): boolean {
  const normalizada = chave
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]/giu, "")
    .toLowerCase();
  return MARCADOR_CHAVE_SENSIVEL.test(normalizada);
}

function contemDadoSensivel(valor: unknown, visitados = new Set<object>()): boolean {
  if (typeof valor === "string") return VALOR_SENSIVEL.test(valor);
  if (valor === null || typeof valor !== "object") return false;
  if (visitados.has(valor)) return true;
  visitados.add(valor);
  try {
    if (Array.isArray(valor)) return valor.some((item) => contemDadoSensivel(item, visitados));
    return Object.entries(valor).some(([chave, item]) => chaveSensivel(chave) || contemDadoSensivel(item, visitados));
  } finally {
    visitados.delete(valor);
  }
}

interface PlanoCanonicoResolvido {
  readonly plano?: PlanoSistemaInterativo;
  readonly bloqueios: readonly string[];
}

function bloqueioOperacionalPlanejamento(codigo: string): boolean {
  return codigo === "capability_controle_ausente"
    || codigo === "capabilities_obrigatorias_ausentes"
    || codigo === "adapter_compativel_ausente"
    || codigo === "adapter_selecao_explicita_ausente"
    || codigo === "adapter_provedor_candidato_ausente"
    || codigo === "adapter_capability_coverage_incompleta"
    || codigo.startsWith("adapter_target_incompativel_indice:");
}

function resolverPlanoCanonico(definicao: DefinicaoSistemaInterativo): PlanoCanonicoResolvido {
  try {
    const planejamento = planejarSistemaInterativo(definicao);
    return {
      plano: planejamento.plano,
      bloqueios: planejamento.bloqueios.map((item) => (
        `${bloqueioOperacionalPlanejamento(item) ? "planejamento_canonico_bloqueado" : "planejamento_canonico_invalido"}:${item}`
      )),
    };
  } catch {
    return { bloqueios: ["definicao_ou_planejamento_canonico_invalido"] };
  }
}

function digestConteudoPlano(plano: PlanoSistemaInterativo): string | undefined {
  try {
    if (plano === null || typeof plano !== "object" || Array.isArray(plano)) return undefined;
    const { planDigest: _planDigest, ...conteudo } = plano;
    return digestJsonSistemaInterativo(conteudo);
  } catch {
    return undefined;
  }
}

function exigenciasDoPlano(
  definicao: DefinicaoSistemaInterativo,
  plano: PlanoSistemaInterativo | undefined,
): ExigenciaEvidencia[] {
  const exigencias: ExigenciaEvidencia[] = [];
  for (const stage of plano?.stages ?? []) {
    for (const evidenceType of stage.requiredEvidence) {
      exigencias.push({ stageId: stage.stageInstanceId, evidenceType });
    }
  }
  const exigirGlobalSeAusente = (evidenceType: string): void => {
    if (!exigencias.some((item) => item.evidenceType === evidenceType)) exigencias.push({ evidenceType });
  };
  if (definicao.determinism === "SEEDED" || definicao.determinism === "STRICT") {
    for (const evidenceType of ["determinism.seed", "state.snapshot", "event.log", "result.digest"]) {
      exigirGlobalSeAusente(evidenceType);
    }
  }
  if (definicao.fidelity === "REALISTIC" || definicao.fidelity === "CALIBRATED") {
    for (const evidenceType of [
      "simulation.reference.dataset",
      "simulation.calibration",
      "simulation.tolerance",
      "simulation.uncertainty",
      "simulation.telemetry",
    ]) {
      exigirGlobalSeAusente(evidenceType);
    }
  }
  if (Array.isArray(definicao.controlModes)
    && definicao.controlModes.some((modo) => modo === "AUTONOMOUS" || modo === "UNCONTROLLED")) {
    for (const evidenceType of ["simulation.hazards", "simulation.stop.criteria", "simulation.recovery.plan"]) {
      exigirGlobalSeAusente(evidenceType);
    }
  }
  const chaves = new Set<string>();
  return exigencias.filter((item) => {
    const chave = `${item.stageId ?? "global"}\u0000${item.evidenceType}`;
    if (chaves.has(chave)) return false;
    chaves.add(chave);
    return true;
  });
}

function observacaoSatisfaz(
  observacao: ObservacaoSistemaInterativo,
  exigencia: ExigenciaEvidencia,
): boolean {
  return observacao.evidenceType === exigencia.evidenceType
    && (exigencia.stageId === undefined || observacao.stageId === exigencia.stageId);
}

function rotuloExigencia(exigencia: ExigenciaEvidencia): string {
  return `${exigencia.stageId ?? "global"}:${exigencia.evidenceType}`;
}

export function validarBundleEvidenciasSistemaInterativo(
  definicao: DefinicaoSistemaInterativo,
  plano: PlanoSistemaInterativo,
  bundle: BundleEvidenciasSistemaInterativo,
): ResultadoValidacaoBundleEvidenciasSistemaInterativo {
  const bloqueios: string[] = [];
  const evidenciasAceitas: string[] = [];
  const planoResolvido = resolverPlanoCanonico(definicao);
  const planoCanonico = planoResolvido.plano;
  const planoFornecido = registroObjeto(plano) ? plano : undefined;
  const bundleFornecido = registroObjeto(bundle) ? bundle : undefined;
  if (!planoFornecido) adicionar(bloqueios, "plano_fornecido_invalido");
  if (!bundleFornecido) adicionar(bloqueios, "bundle_invalido");
  for (const bloqueio of planoResolvido.bloqueios) adicionar(bloqueios, bloqueio);

  if (!planoCanonico) {
    adicionar(bloqueios, "plano_canonico_indisponivel");
  } else if (planoFornecido) {
    if (planoFornecido.definitionDigest !== planoCanonico.definitionDigest) {
      adicionar(bloqueios, "plano_definition_digest_divergente");
    }
    if (planoFornecido.planDigest !== planoCanonico.planDigest) {
      adicionar(bloqueios, "plano_plan_digest_divergente");
    }
  }
  const digestFornecido = planoFornecido ? digestConteudoPlano(planoFornecido as unknown as PlanoSistemaInterativo) : undefined;
  if (digestFornecido === undefined || digestFornecido !== planoFornecido?.planDigest) {
    adicionar(bloqueios, "plano_conteudo_digest_divergente");
  }

  const observationsBrutas = Array.isArray(bundleFornecido?.observations) ? bundleFornecido.observations : [];
  const observations: readonly ObservacaoSistemaInterativo[] = observationsBrutas
    .filter((item): item is ObservacaoSistemaInterativo => registroObjeto(item));
  if (observations.length !== observationsBrutas.length) adicionar(bloqueios, "bundle_observation_malformada");
  if (bundleFornecido?.schemaVersion !== "1.0") adicionar(bloqueios, "bundle_schema_version_nao_suportada");
  if (!identificadorSeguro(bundleFornecido?.runId)) adicionar(bloqueios, "bundle_run_id_invalido");
  if (bundleFornecido?.systemId !== definicao.systemId || bundleFornecido?.systemId !== planoCanonico?.systemId) adicionar(bloqueios, "bundle_system_id_divergente");
  if (bundleFornecido?.definitionDigest !== planoCanonico?.definitionDigest) adicionar(bloqueios, "bundle_definition_digest_divergente");
  if (bundleFornecido?.planDigest !== planoCanonico?.planDigest) adicionar(bloqueios, "bundle_plan_digest_divergente");
  if (!Array.isArray(bundleFornecido?.observations)) adicionar(bloqueios, "bundle_observations_invalidas");

  const stages = new Map((planoCanonico?.stages ?? []).map((stage) => [stage.stageInstanceId, stage]));
  const providers = new Map((planoCanonico?.stageProviderMap ?? []).map((item) => [item.stageInstanceId, item]));
  const ids = new Set<string>();
  let semanticTargetId: string | undefined;
  for (const [indice, observacao] of observations.entries()) {
    const problemasAntes = bloqueios.length;
    if (!identificadorSeguro(observacao.evidenceId)) adicionar(bloqueios, "evidence_id_invalido");
    else if (ids.has(observacao.evidenceId)) adicionar(bloqueios, `evidence_id_duplicado_indice:${indice}`);
    else ids.add(observacao.evidenceId);
    if (!texto(observacao.evidenceType)) adicionar(bloqueios, `evidence_type_invalido_indice:${indice}`);
    const stage = stages.get(observacao.stageId);
    if (!stage) adicionar(bloqueios, `evidence_stage_desconhecido_indice:${indice}`);
    else if (!stage.requiredEvidence.includes(observacao.evidenceType)
      && !exigenciasDoPlano(definicao, planoCanonico).some((item) => item.stageId === undefined && item.evidenceType === observacao.evidenceType)) {
      adicionar(bloqueios, `evidence_type_nao_exigido_no_stage_indice:${indice}`);
    }
    if (!identificadorSeguro(observacao.semanticTargetId)) adicionar(bloqueios, `semantic_target_id_invalido_indice:${indice}`);
    else if (semanticTargetId === undefined) semanticTargetId = observacao.semanticTargetId;
    else if (semanticTargetId !== observacao.semanticTargetId) adicionar(bloqueios, `semantic_target_id_divergente_indice:${indice}`);
    const provider = providers.get(observacao.stageId);
    if (!identificadorSeguro(observacao.producerAdapterId)) adicionar(bloqueios, `producer_adapter_id_invalido_indice:${indice}`);
    else if (!provider?.selectedAdapterIds.includes(observacao.producerAdapterId)) {
      adicionar(bloqueios, `producer_adapter_nao_selecionado_para_stage_indice:${indice}`);
    }
    const producer = identificadorSeguro(observacao.producerAdapterId)
      ? obterAdaptadorSistemaInterativo(observacao.producerAdapterId)
      : undefined;
    if (!producer || observacao.producerAdapterVersion !== producer.version) {
      adicionar(bloqueios, `producer_adapter_version_divergente_indice:${indice}`);
    }
    if (!digestSha256Valido(observacao.artifactDigest)) adicionar(bloqueios, `artifact_digest_invalido_indice:${indice}`);
    if (!texto(observacao.observedAt) || !Number.isFinite(Date.parse(observacao.observedAt))) adicionar(bloqueios, `observed_at_invalido_indice:${indice}`);
    if (!texto(observacao.source) || FONTES_CLAIM.has(observacao.source.toUpperCase())) adicionar(bloqueios, `evidence_source_nao_observacional_indice:${indice}`);
    if (!registroObjeto(observacao.data) || Object.keys(observacao.data).length === 0) {
      adicionar(bloqueios, `evidence_data_invalida_ou_vazia_indice:${indice}`);
    }
    if (contemDadoSensivel(observacao)) adicionar(bloqueios, `evidence_contem_dado_sensivel_indice:${indice}`);
    if (bloqueios.length === problemasAntes) evidenciasAceitas.push(observacao.evidenceId);
  }

  const aceitas = observations.filter((item) => evidenciasAceitas.includes(item.evidenceId));
  const evidenciasAusentes = exigenciasDoPlano(definicao, planoCanonico)
    .filter((exigencia) => !aceitas.some((observacao) => observacaoSatisfaz(observacao, exigencia)))
    .map(rotuloExigencia)
    .sort();

  return {
    valido: bloqueios.length === 0 && evidenciasAusentes.length === 0,
    evidenciasAceitas: evidenciasAceitas.sort(),
    evidenciasAusentes,
    bloqueios: bloqueios.sort(),
  };
}

function estadoStages(
  plano: PlanoSistemaInterativo | undefined,
  observations: readonly ObservacaoSistemaInterativo[],
  aceitas: ReadonlySet<string>,
): EstadoEtapaSistemaInterativo[] {
  return (plano?.stages ?? []).map((stage) => {
    const observacoes = observations.filter((item) => item.stageId === stage.stageInstanceId && aceitas.has(item.evidenceId));
    const evidenciasAusentes = stage.requiredEvidence
      .filter((tipo) => !observacoes.some((item) => item.evidenceType === tipo))
      .sort();
    return {
      stageId: stage.stageInstanceId,
      status: evidenciasAusentes.length === 0 ? "STRUCTURALLY_COMPLETE" : "WAITING_EVIDENCE",
      evidenciasAusentes,
    };
  });
}

export function derivarEstadoSistemaInterativo(
  definicao: DefinicaoSistemaInterativo,
  plano: PlanoSistemaInterativo,
  bundle: BundleEvidenciasSistemaInterativo,
): EstadoSistemaInterativo {
  const validacao = validarBundleEvidenciasSistemaInterativo(definicao, plano, bundle);
  const aceitas = new Set(validacao.evidenciasAceitas);
  const observations: readonly ObservacaoSistemaInterativo[] = registroObjeto(bundle) && Array.isArray(bundle.observations)
    ? bundle.observations.filter((item): item is ObservacaoSistemaInterativo => registroObjeto(item))
    : [];
  const planoCanonico = resolverPlanoCanonico(definicao).plano;
  const stages = estadoStages(planoCanonico, observations, aceitas);
  const temGapPlanejamento = validacao.bloqueios.some((item) => item.startsWith("planejamento_canonico_bloqueado:"));
  const temBloqueioInvalido = validacao.bloqueios.some((item) => !item.startsWith("planejamento_canonico_bloqueado:"));
  const planoPronto = planoCanonico?.adapterSelectionExplicit === true
    && planoCanonico.adapterCoverageComplete === true
    && planoCanonico.capabilitiesAusentes.length === 0
    && planoCanonico.capabilitiesSemAdapter.length === 0;
  const localCoverageComplete = planoPronto && validacao.valido && validacao.evidenciasAusentes.length === 0;
  const status = temBloqueioInvalido
    ? "INVALID"
    : temGapPlanejamento || !planoPronto
      ? "BLOCKED"
    : localCoverageComplete
      ? "STRUCTURALLY_COMPLETE"
      : observations.length === 0
        ? "PLANNED"
        : "WAITING_EVIDENCE";
  const nextActions = [
    ...validacao.bloqueios.map((item) => `corrigir:${item}`),
    ...validacao.evidenciasAusentes.map((item) => `coletar_evidencia_externa:${item}`),
  ];
  return {
    status,
    stages,
    evidenciasAceitas: validacao.evidenciasAceitas,
    evidenciasAusentes: validacao.evidenciasAusentes,
    bloqueios: validacao.bloqueios,
    nextActions,
    completed: false,
    localCoverageComplete,
    awaitingExternalAttestation: true,
    completionScope: "STRUCTURAL_LOCAL",
    authoritative: false,
  };
}

export function bundleVazioSistemaInterativo(
  definicao: DefinicaoSistemaInterativo,
  plano: PlanoSistemaInterativo,
  runId: string,
): BundleEvidenciasSistemaInterativo {
  return {
    schemaVersion: "1.0",
    runId,
    systemId: definicao.systemId,
    definitionDigest: plano.definitionDigest,
    planDigest: plano.planDigest,
    observations: [],
  };
}

export type DadosEvidenciaSistemaInterativo = JsonObjetoSistemaInterativo;
