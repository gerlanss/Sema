// SEMA-GOVERNED: sema.produto.pipeline_conteudo
// Descricao: validacao do DAG e planejamento declarativo, sem executar runner ou ferramentas.

import { digestJsonCanonico } from "./canonical.js";
import {
  planejarAlvosConteudo,
  validarAdaptadorConteudo,
} from "./adapters.js";
import type {
  AlvoConteudo,
  DefinicaoPipelineConteudo,
  EtapaPipelineConteudo,
  InstanciaEtapaConteudo,
  InstanciaGateConteudo,
  PlanoPipelineConteudo,
  PoliticaGateConteudo,
  SlotArtefatoConteudo,
} from "./types.js";

export interface ResultadoValidacaoDefinicaoPipelineConteudo {
  readonly valida: boolean;
  readonly definitionDigest: string;
  readonly bloqueios: readonly string[];
}

export interface ResultadoPlanejamentoPipelineConteudo {
  readonly plano: PlanoPipelineConteudo;
  readonly bloqueios: readonly string[];
}

const VERSOES_FLUTUANTES = new Set(["*", "current", "latest", "stable"]);
const ESCOPOS_ETAPA = new Set(["GLOBAL", "POR_ALVO"]);
const MODOS_AVALIACAO = new Set(["DETERMINISTICA", "IA_ESPECIALIZADA", "HIBRIDA"]);
const POLITICAS_ADAPTER = new Set(["NONE", "CONSTRAINTS", "CONFIRMATION"]);

function textoOpaco(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor === valor.trim() && !/[\s\u0000-\u001f\u007f]/u.test(valor);
}

function listaTextoUnica(valores: readonly string[], permitirVazia: boolean): boolean {
  return (permitirVazia || valores.length > 0)
    && valores.every(textoOpaco)
    && new Set(valores).size === valores.length;
}

function adicionarUnico(bloqueios: string[], codigo: string): void {
  if (!bloqueios.includes(codigo)) bloqueios.push(codigo);
}

function validarGate(gate: PoliticaGateConteudo, bloqueios: string[]): void {
  if (!textoOpaco(gate.gateId)) adicionarUnico(bloqueios, "gate_id_invalido");
  if (!textoOpaco(gate.stageId)) adicionarUnico(bloqueios, `gate_stage_id_invalido:${gate.gateId || "<sem-id>"}`);
  if (!ESCOPOS_ETAPA.has(gate.scope)) {
    adicionarUnico(bloqueios, `gate_scope_invalido:${gate.gateId}`);
  }
  if (!MODOS_AVALIACAO.has(gate.evaluationMode)) {
    adicionarUnico(bloqueios, `gate_evaluation_mode_invalido:${gate.gateId}`);
  }
  if (!listaTextoUnica(gate.requiredEvidence, true)) {
    adicionarUnico(bloqueios, `gate_required_evidence_invalido:${gate.gateId}`);
  }
  if (
    (gate.evaluationMode === "DETERMINISTICA" || gate.evaluationMode === "HIBRIDA") &&
    gate.requiredEvidence.length === 0
  ) {
    adicionarUnico(bloqueios, `gate_required_evidence_ausente:${gate.gateId}`);
  }
  if (!listaTextoUnica(gate.evaluatorCapabilities, true)) {
    adicionarUnico(bloqueios, `gate_evaluator_capabilities_invalidas:${gate.gateId}`);
  }
  if (!Number.isInteger(gate.minAttestationsPerEvidence) || gate.minAttestationsPerEvidence < 1) {
    adicionarUnico(bloqueios, `gate_min_attestations_invalido:${gate.gateId}`);
  }
  if (
    !Number.isInteger(gate.minDistinctAttesterControlDomains) ||
    gate.minDistinctAttesterControlDomains < 1
  ) {
    adicionarUnico(bloqueios, `gate_min_attester_control_domains_invalido:${gate.gateId}`);
  }
  if (gate.minDistinctAttesterControlDomains > gate.minAttestationsPerEvidence) {
    adicionarUnico(bloqueios, `gate_quorum_atestadores_impossivel:${gate.gateId}`);
  }
  if (
    (gate.evaluationMode === "IA_ESPECIALIZADA" || gate.evaluationMode === "HIBRIDA") &&
    gate.evaluatorCapabilities.length === 0
  ) {
    adicionarUnico(bloqueios, `gate_evaluator_capabilities_ausentes:${gate.gateId}`);
  }
  if (!Number.isInteger(gate.minApprovals) || gate.minApprovals < 1) {
    adicionarUnico(bloqueios, `gate_min_approvals_invalido:${gate.gateId}`);
  }
  if (!Number.isInteger(gate.minDistinctControlDomains) || gate.minDistinctControlDomains < 1) {
    adicionarUnico(bloqueios, `gate_min_control_domains_invalido:${gate.gateId}`);
  }
  if (gate.minDistinctControlDomains > gate.minApprovals) {
    adicionarUnico(bloqueios, `gate_quorum_impossivel:${gate.gateId}`);
  }
  if (!textoOpaco(gate.rubricDigest)) {
    adicionarUnico(bloqueios, `gate_rubric_digest_invalido:${gate.gateId}`);
  }
  if (typeof gate.producerDisjoint !== "boolean") {
    adicionarUnico(bloqueios, `gate_producer_disjoint_invalido:${gate.gateId}`);
  }
  if (typeof gate.rejectionIsBinding !== "boolean") {
    adicionarUnico(bloqueios, `gate_rejection_binding_invalido:${gate.gateId}`);
  }
}

function detectarCiclo(stages: readonly EtapaPipelineConteudo[]): readonly string[] {
  const porId = new Map(stages.map((stage) => [stage.stageId, stage]));
  const estado = new Map<string, "visitando" | "visitado">();
  const pilha: string[] = [];

  const visitar = (stageId: string): readonly string[] => {
    if (estado.get(stageId) === "visitado") return [];
    const inicioCiclo = pilha.indexOf(stageId);
    if (estado.get(stageId) === "visitando") {
      return inicioCiclo >= 0 ? [...pilha.slice(inicioCiclo), stageId] : [stageId, stageId];
    }

    estado.set(stageId, "visitando");
    pilha.push(stageId);
    for (const dependencia of porId.get(stageId)?.dependsOn ?? []) {
      if (!porId.has(dependencia)) continue;
      const ciclo = visitar(dependencia);
      if (ciclo.length > 0) return ciclo;
    }
    pilha.pop();
    estado.set(stageId, "visitado");
    return [];
  };

  for (const stage of stages) {
    const ciclo = visitar(stage.stageId);
    if (ciclo.length > 0) return ciclo;
  }
  return [];
}

function ordenarStages(stages: readonly EtapaPipelineConteudo[]): readonly EtapaPipelineConteudo[] {
  const indiceDeclarado = new Map(stages.map((stage, indice) => [stage.stageId, indice]));
  const porId = new Map(stages.map((stage) => [stage.stageId, stage]));
  const grauEntrada = new Map(stages.map((stage) => [stage.stageId, stage.dependsOn.length]));
  const dependentes = new Map<string, string[]>();

  for (const stage of stages) {
    for (const dependencia of stage.dependsOn) {
      const itens = dependentes.get(dependencia) ?? [];
      itens.push(stage.stageId);
      dependentes.set(dependencia, itens);
    }
  }

  const prontos = stages
    .filter((stage) => (grauEntrada.get(stage.stageId) ?? 0) === 0)
    .map((stage) => stage.stageId);
  const ordenados: EtapaPipelineConteudo[] = [];

  while (prontos.length > 0) {
    prontos.sort((a, b) => (indiceDeclarado.get(a) ?? 0) - (indiceDeclarado.get(b) ?? 0));
    const stageId = prontos.shift()!;
    const stage = porId.get(stageId);
    if (stage) ordenados.push(stage);

    for (const dependente of dependentes.get(stageId) ?? []) {
      const restante = (grauEntrada.get(dependente) ?? 0) - 1;
      grauEntrada.set(dependente, restante);
      if (restante === 0) prontos.push(dependente);
    }
  }

  return ordenados;
}

function segmentoId(valor: string): string {
  return encodeURIComponent(valor);
}

function idInstanciaStage(stage: EtapaPipelineConteudo, targetId?: string): string {
  if (stage.scope === "GLOBAL") return `stage/${segmentoId(stage.stageId)}/global`;
  return `stage/${segmentoId(stage.stageId)}/target/${segmentoId(targetId ?? "")}`;
}

function idInstanciaGate(gateId: string, stageInstanceId: string): string {
  return `gate/${segmentoId(gateId)}/${stageInstanceId}`;
}

function idSlotArtefato(artifactType: string, stageInstanceId: string): string {
  return `artifact/${segmentoId(artifactType)}/${stageInstanceId}`;
}

function dependenciasDaInstancia(
  stage: EtapaPipelineConteudo,
  targetId: string | undefined,
  stagesPorId: ReadonlyMap<string, EtapaPipelineConteudo>,
  targetIds: readonly string[],
): readonly string[] {
  const dependencias: string[] = [];
  for (const dependenciaId of stage.dependsOn) {
    const dependencia = stagesPorId.get(dependenciaId)!;
    if (dependencia.scope === "GLOBAL") {
      dependencias.push(idInstanciaStage(dependencia));
    } else if (stage.scope === "POR_ALVO") {
      dependencias.push(idInstanciaStage(dependencia, targetId));
    } else {
      for (const target of targetIds) dependencias.push(idInstanciaStage(dependencia, target));
    }
  }
  return dependencias;
}

function planoVazio(pipelineId: string, definitionDigest: string, targetIds: readonly string[]): PlanoPipelineConteudo {
  return {
    pipelineId,
    definitionDigest,
    targetIds,
    stageInstances: [],
    artifactSlots: [],
    gateInstances: [],
    nextActions: [],
  };
}

export function validarDefinicaoPipelineConteudo(
  definicao: DefinicaoPipelineConteudo,
): ResultadoValidacaoDefinicaoPipelineConteudo {
  const bloqueios: string[] = [];
  let definitionDigest: string;
  try {
    definitionDigest = digestJsonCanonico(definicao);
  } catch (erro) {
    definitionDigest = digestJsonCanonico({ definicaoInvalida: true });
    adicionarUnico(
      bloqueios,
      `definicao_nao_canonica:${erro instanceof Error ? erro.message : "erro_desconhecido"}`,
    );
  }

  if (!textoOpaco(definicao.schemaVersion)) adicionarUnico(bloqueios, "schema_version_invalida");
  if (!textoOpaco(definicao.pipelineId)) adicionarUnico(bloqueios, "pipeline_id_invalido");
  if (!textoOpaco(definicao.version) || VERSOES_FLUTUANTES.has(definicao.version.toLowerCase())) {
    adicionarUnico(bloqueios, "pipeline_version_nao_fixada");
  }
  if (definicao.stages.length === 0) adicionarUnico(bloqueios, "stages_ausentes");
  if (definicao.adapters.length === 0) adicionarUnico(bloqueios, "adapters_ausentes");

  const stageIds = new Set<string>();
  for (const stage of definicao.stages) {
    if (!textoOpaco(stage.stageId)) adicionarUnico(bloqueios, "stage_id_invalido");
    if (stageIds.has(stage.stageId)) adicionarUnico(bloqueios, `stage_id_duplicado:${stage.stageId}`);
    stageIds.add(stage.stageId);
    if (!textoOpaco(stage.capability)) adicionarUnico(bloqueios, `stage_capability_invalida:${stage.stageId}`);
    if (!ESCOPOS_ETAPA.has(stage.scope)) adicionarUnico(bloqueios, `stage_scope_invalido:${stage.stageId}`);
    if (!POLITICAS_ADAPTER.has(stage.adapterPolicy)) adicionarUnico(bloqueios, `stage_adapter_policy_invalida:${stage.stageId}`);
    if (stage.scope === "GLOBAL" && stage.adapterPolicy !== "NONE") {
      adicionarUnico(bloqueios, `stage_global_nao_pode_usar_adapter_policy:${stage.stageId}`);
    }
    if (stage.adapterPolicy !== "NONE" && stage.gateIds.length === 0) {
      adicionarUnico(bloqueios, `stage_adapter_policy_sem_gate:${stage.stageId}`);
    }
    if (stage.capability === "content.target.adapt" && stage.adapterPolicy !== "CONSTRAINTS") {
      adicionarUnico(bloqueios, `stage_target_adapt_exige_constraints:${stage.stageId}`);
    }
    if (stage.capability === "content.target.deliver" && stage.adapterPolicy !== "CONFIRMATION") {
      adicionarUnico(bloqueios, `stage_target_deliver_exige_confirmation:${stage.stageId}`);
    }
    if (!listaTextoUnica(stage.dependsOn, true)) adicionarUnico(bloqueios, `stage_dependencies_invalidas:${stage.stageId}`);
    if (!listaTextoUnica(stage.produces, false)) adicionarUnico(bloqueios, `stage_produces_invalido:${stage.stageId}`);
    if (stage.produces.length !== 1) adicionarUnico(bloqueios, `stage_output_ambiguo:${stage.stageId}`);
    if (!listaTextoUnica(stage.gateIds, true)) adicionarUnico(bloqueios, `stage_gate_ids_invalidos:${stage.stageId}`);
  }

  const gateIds = new Set<string>();
  const gatesPorId = new Map<string, PoliticaGateConteudo>();
  for (const gate of definicao.gates) {
    validarGate(gate, bloqueios);
    if (gateIds.has(gate.gateId)) adicionarUnico(bloqueios, `gate_id_duplicado:${gate.gateId}`);
    gateIds.add(gate.gateId);
    gatesPorId.set(gate.gateId, gate);
    if (!stageIds.has(gate.stageId)) adicionarUnico(bloqueios, `gate_stage_nao_encontrado:${gate.gateId}:${gate.stageId}`);
  }

  const stagesPorId = new Map(definicao.stages.map((stage) => [stage.stageId, stage]));
  for (const stage of definicao.stages) {
    for (const dependencia of stage.dependsOn) {
      if (!stageIds.has(dependencia)) {
        adicionarUnico(bloqueios, `stage_dependency_nao_encontrada:${stage.stageId}:${dependencia}`);
      }
    }
    for (const gateId of stage.gateIds) {
      const gate = gatesPorId.get(gateId);
      if (!gate) {
        adicionarUnico(bloqueios, `stage_gate_nao_encontrado:${stage.stageId}:${gateId}`);
      } else {
        if (gate.stageId !== stage.stageId) adicionarUnico(bloqueios, `stage_gate_ligacao_divergente:${stage.stageId}:${gateId}`);
        if (gate.scope !== stage.scope) {
          adicionarUnico(bloqueios, `stage_gate_scope_divergente:${stage.stageId}:${gateId}`);
        }
      }
    }
  }
  for (const gate of definicao.gates) {
    const stage = stagesPorId.get(gate.stageId);
    if (stage && !stage.gateIds.includes(gate.gateId)) {
      adicionarUnico(bloqueios, `gate_nao_ligado_pela_etapa:${gate.gateId}:${gate.stageId}`);
    }
  }

  if (!listaTextoUnica(definicao.requiredCompletionGates, false)) {
    adicionarUnico(bloqueios, "required_completion_gates_invalidos");
  }
  for (const gateId of definicao.requiredCompletionGates) {
    if (!gateIds.has(gateId)) adicionarUnico(bloqueios, `completion_gate_nao_encontrado:${gateId}`);
    else if (gatesPorId.get(gateId)?.producerDisjoint !== true) {
      adicionarUnico(bloqueios, `completion_gate_exige_produtor_disjunto:${gateId}`);
    }
  }

  const adaptersVersionados = new Set<string>();
  for (const adapter of definicao.adapters) {
    const resultado = validarAdaptadorConteudo(adapter);
    for (const bloqueio of resultado.bloqueios) {
      adicionarUnico(bloqueios, `adapter_invalido:${adapter.adapterId || "<sem-id>"}:${bloqueio}`);
    }
    const chave = `${adapter.adapterId}\u0000${adapter.version}`;
    if (adaptersVersionados.has(chave)) {
      adicionarUnico(bloqueios, `adapter_id_version_duplicado:${adapter.adapterId}:${adapter.version}`);
    }
    adaptersVersionados.add(chave);
  }

  const ciclo = detectarCiclo(definicao.stages);
  if (ciclo.length > 0) adicionarUnico(bloqueios, `stage_graph_ciclico:${ciclo.join("->")}`);

  return { valida: bloqueios.length === 0, definitionDigest, bloqueios };
}

export function planejarPipelineConteudo(
  definicao: DefinicaoPipelineConteudo,
  alvos: readonly AlvoConteudo[],
): ResultadoPlanejamentoPipelineConteudo {
  const validacao = validarDefinicaoPipelineConteudo(definicao);
  const targetIds = [...alvos.map((alvo) => alvo.targetId)].sort((a, b) => a.localeCompare(b));
  const bloqueios = [...validacao.bloqueios];
  const planejamentoAlvos = planejarAlvosConteudo(alvos, definicao.adapters, []);
  for (const bloqueio of planejamentoAlvos.bloqueiosPorAlvo) {
    adicionarUnico(bloqueios, `target_invalido:${bloqueio.targetId}:${bloqueio.codigo}`);
  }

  if (bloqueios.length > 0) {
    return {
      plano: planoVazio(definicao.pipelineId, validacao.definitionDigest, targetIds),
      bloqueios,
    };
  }

  const stagesOrdenados = ordenarStages(definicao.stages);
  const stagesPorId = new Map(definicao.stages.map((stage) => [stage.stageId, stage]));
  const stageInstances: InstanciaEtapaConteudo[] = [];

  for (const stage of stagesOrdenados) {
    const targetsDaEtapa: readonly (string | undefined)[] = stage.scope === "GLOBAL" ? [undefined] : targetIds;
    for (const targetId of targetsDaEtapa) {
      stageInstances.push({
        stageInstanceId: idInstanciaStage(stage, targetId),
        stageId: stage.stageId,
        ...(targetId === undefined ? {} : { targetId }),
        capability: stage.capability,
        dependsOn: dependenciasDaInstancia(stage, targetId, stagesPorId, targetIds),
        produces: [...stage.produces],
        gateIds: [...stage.gateIds],
      });
    }
  }

  const artifactSlots: SlotArtefatoConteudo[] = [];
  const gateInstances: InstanciaGateConteudo[] = [];
  for (const stageInstance of stageInstances) {
    for (const artifactType of stageInstance.produces) {
      artifactSlots.push({
        slotId: idSlotArtefato(artifactType, stageInstance.stageInstanceId),
        stageInstanceId: stageInstance.stageInstanceId,
        artifactType,
        ...(stageInstance.targetId === undefined ? {} : { targetId: stageInstance.targetId }),
      });
    }
    for (const gateId of stageInstance.gateIds) {
      gateInstances.push({
        gateInstanceId: idInstanciaGate(gateId, stageInstance.stageInstanceId),
        gateId,
        stageInstanceId: stageInstance.stageInstanceId,
        ...(stageInstance.targetId === undefined ? {} : { targetId: stageInstance.targetId }),
      });
    }
  }

  const nextActions = stageInstances
    .filter((stage) => stage.dependsOn.length === 0)
    .map((stage) => `runner_externo.executar_etapa:${stage.stageInstanceId}`);

  return {
    plano: {
      pipelineId: definicao.pipelineId,
      definitionDigest: validacao.definitionDigest,
      targetIds,
      stageInstances,
      artifactSlots,
      gateInstances,
      nextActions,
    },
    bloqueios,
  };
}
