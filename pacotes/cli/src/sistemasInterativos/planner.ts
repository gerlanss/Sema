// SEMA-GOVERNED: sema.produto.sistemas_interativos
// Descricao: expande pipelines e adapters em plano deterministico sem executar ou escrever no workspace.

import { digestJsonSistemaInterativo } from "./canonical.js";
import {
  CATALOGO_ADAPTADORES_INTERATIVOS,
  obterPipelineSistemaInterativo,
} from "./catalog.js";
import type {
  AdaptadorSistemaInterativo,
  DefinicaoSistemaInterativo,
  InstanciaEtapaSistemaInterativo,
  InstanciaPipelineSistemaInterativo,
  PlanoSistemaInterativo,
  ProvedorEtapaSistemaInterativo,
  ResultadoPlanejamentoSistemaInterativo,
} from "./types.js";
import { validarDefinicaoSistemaInterativo } from "./validator.js";

function adapterCompativel(
  adapter: AdaptadorSistemaInterativo,
  definicao: DefinicaoSistemaInterativo,
): boolean {
  return adapter.kinds.includes(definicao.kind)
    && adapter.spatialModels.includes(definicao.spatialModel)
    && adapter.renderModes.includes(definicao.renderMode)
    && adapter.visualProfiles.includes(definicao.visualProfile)
    && Array.isArray(definicao.controlModes)
    && definicao.controlModes.every((modo) => adapter.controlModes.includes(modo))
    && adapter.timeModels.includes(definicao.timeModel)
    && adapter.fidelities.includes(definicao.fidelity);
}

function expandirPipelines(
  definicao: DefinicaoSistemaInterativo,
): { pipelines: InstanciaPipelineSistemaInterativo[]; stages: InstanciaEtapaSistemaInterativo[] } {
  const pipelines: InstanciaPipelineSistemaInterativo[] = [];
  const stages: InstanciaEtapaSistemaInterativo[] = [];
  for (const pipelineId of definicao.pipelines) {
    const descriptor = obterPipelineSistemaInterativo(pipelineId);
    if (!descriptor) continue;
    const stageInstanceIds = descriptor.stages.map((stage) => `${pipelineId}/${stage.stageId}`);
    pipelines.push({
      pipelineId,
      version: descriptor.version,
      stageInstanceIds,
      requiredEvidence: [...descriptor.requiredEvidence],
    });
    for (const stage of descriptor.stages) {
      stages.push({
        ...stage,
        pipelineId,
        stageInstanceId: `${pipelineId}/${stage.stageId}`,
        dependsOn: stage.dependsOn.map((dependencia) => `${pipelineId}/${dependencia}`),
      });
    }
  }
  return { pipelines, stages };
}

function planoComDigest(
  plano: Omit<PlanoSistemaInterativo, "planDigest">,
): PlanoSistemaInterativo {
  return { ...plano, planDigest: digestJsonSistemaInterativo(plano) };
}

function mapearProvedores(
  stages: readonly InstanciaEtapaSistemaInterativo[],
  candidatos: readonly AdaptadorSistemaInterativo[],
  selecionados: readonly AdaptadorSistemaInterativo[],
): ProvedorEtapaSistemaInterativo[] {
  return stages.map((stage) => {
    const candidateAdapterIds = candidatos
      .filter((adapter) => adapter.capabilities.includes(stage.capability))
      .map((adapter) => adapter.adapterId)
      .sort();
    const selectedAdapterIds = selecionados
      .filter((adapter) => adapter.capabilities.includes(stage.capability))
      .map((adapter) => adapter.adapterId)
      .sort();
    return {
      stageInstanceId: stage.stageInstanceId,
      capability: stage.capability,
      candidateAdapterIds,
      selectedAdapterIds,
      coveredBySelection: selectedAdapterIds.length > 0,
    };
  });
}

function recomendarComposicao(
  mapa: readonly ProvedorEtapaSistemaInterativo[],
  idsJaSelecionados: ReadonlySet<string>,
): string[] {
  let pendentes = mapa.filter((item) => !item.coveredBySelection);
  const recomendados: string[] = [];
  for (let iteracao = 0; pendentes.length > 0 && iteracao < mapa.length; iteracao += 1) {
    const candidatos = [...new Set(pendentes.flatMap((item) => item.candidateAdapterIds))]
      .filter((adapterId) => !idsJaSelecionados.has(adapterId) && !recomendados.includes(adapterId))
      .sort();
    const melhor = candidatos.map((adapterId) => ({
      adapterId,
      cobertura: pendentes.filter((item) => item.candidateAdapterIds.includes(adapterId)).length,
    })).sort((a, b) => b.cobertura - a.cobertura || a.adapterId.localeCompare(b.adapterId))[0];
    if (!melhor || melhor.cobertura === 0) break;
    recomendados.push(melhor.adapterId);
    const restantes = pendentes.filter((item) => !item.candidateAdapterIds.includes(melhor.adapterId));
    if (restantes.length >= pendentes.length) break;
    pendentes = restantes;
  }
  return recomendados;
}

export function planejarSistemaInterativo(
  definicao: DefinicaoSistemaInterativo,
): ResultadoPlanejamentoSistemaInterativo {
  const validacao = validarDefinicaoSistemaInterativo(definicao);
  const bloqueios = [...validacao.bloqueios];
  const declaradas = new Set(Array.isArray(definicao.capabilities) ? definicao.capabilities : []);
  const capabilitiesAusentes = validacao.capabilitiesRequeridas.filter((item) => !declaradas.has(item));
  const expandidos = validacao.valida ? expandirPipelines(definicao) : { pipelines: [], stages: [] };

  const alvos = Array.isArray(definicao.adapterTargets) ? definicao.adapterTargets : [];
  const adapterSelectionExplicit = alvos.length > 0;
  const candidatos = validacao.valida
    ? CATALOGO_ADAPTADORES_INTERATIVOS.filter((adapter) => adapterCompativel(adapter, definicao))
    : [];
  const selecionados = candidatos.filter((adapter) => alvos.includes(adapter.adapterId));
  const adaptersCompativeis = candidatos.map((adapter) => adapter.adapterId).sort();
  const adaptersSelecionados = selecionados.map((adapter) => adapter.adapterId).sort();
  const selecionadosSet = new Set(adaptersSelecionados);

  if (capabilitiesAusentes.length > 0) bloqueios.push("capabilities_obrigatorias_ausentes");
  if (validacao.valida && adaptersCompativeis.length === 0) bloqueios.push("adapter_compativel_ausente");
  if (validacao.valida && !adapterSelectionExplicit) bloqueios.push("adapter_selecao_explicita_ausente");
  if (validacao.valida) {
    for (const [indice, adapterId] of alvos.entries()) {
      const conhecido = CATALOGO_ADAPTADORES_INTERATIVOS.some((adapter) => adapter.adapterId === adapterId);
      if (conhecido && !selecionadosSet.has(adapterId)) bloqueios.push(`adapter_target_incompativel_indice:${indice}`);
    }
  }

  const stageProviderMap = mapearProvedores(expandidos.stages, candidatos, selecionados);
  const capabilitiesSemAdapter = [...new Set(stageProviderMap
    .filter((item) => !item.coveredBySelection)
    .map((item) => item.capability))].sort();
  const semCandidato = stageProviderMap.some((item) => item.candidateAdapterIds.length === 0);
  const adapterCoverageComplete = adapterSelectionExplicit
    && stageProviderMap.length > 0
    && stageProviderMap.every((item) => item.coveredBySelection);
  if (validacao.valida && semCandidato) bloqueios.push("adapter_provedor_candidato_ausente");
  if (validacao.valida && adapterSelectionExplicit && !adapterCoverageComplete) {
    bloqueios.push("adapter_capability_coverage_incompleta");
  }

  const nextActions: string[] = [];
  for (const bloqueio of [...new Set(bloqueios)].sort()) nextActions.push(`corrigir:${bloqueio}`);
  for (const capability of capabilitiesAusentes) nextActions.push(`declarar_capability:${capability}`);
  for (const adapterId of recomendarComposicao(stageProviderMap, selecionadosSet)) {
    nextActions.push(`${adapterSelectionExplicit ? "adicionar" : "selecionar"}_adapter_externo:${adapterId}`);
  }
  for (const evidenceType of [...new Set(expandidos.stages.flatMap((stage) => stage.requiredEvidence))].sort()) {
    nextActions.push(`coletar_evidencia_externa:${evidenceType}`);
  }
  if (validacao.valida && bloqueios.length === 0) nextActions.push("entregar_plano_ao_runner_externo");

  const plano = planoComDigest({
    systemId: validacao.bloqueios.includes("system_id_invalido") ? "INVALID" : definicao.systemId,
    definitionDigest: validacao.definitionDigest,
    capabilitiesRequeridas: validacao.capabilitiesRequeridas,
    capabilitiesAusentes,
    pipelines: expandidos.pipelines,
    adaptersCompativeis,
    adaptersSelecionados,
    adapterSelectionExplicit,
    adapterCoverageComplete,
    capabilitiesSemAdapter,
    stageProviderMap,
    stages: expandidos.stages,
    nextActions,
    executed: false,
  });

  return {
    plano,
    bloqueios: [...new Set(bloqueios)].sort(),
  };
}
