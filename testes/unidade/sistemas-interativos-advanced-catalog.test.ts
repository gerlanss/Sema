// SEMA-GOVERNED: sema.produto.sistemas_interativos.catalogo_avancado
// Descricao: prova que todas as capacidades P0/P1/P2 estao no catalogo, descoberta e planner.

import assert from "node:assert/strict";
import test from "node:test";
import { montarCatalogoCapacidades } from "../../pacotes/cli/src/discovery/catalog.js";
import { recomendarCapacidadePorIntencao } from "../../pacotes/cli/src/discovery/ranker.js";
import {
  CATALOGO_ADAPTADORES_INTERATIVOS,
  CATALOGO_PIPELINES_INTERATIVOS,
  listarAdaptadoresInterativosAvancados,
  listarPipelinesInterativosAvancados,
  planejarSistemaInterativo,
  validarAdaptadorSistemaInterativo,
  validarDefinicaoSistemaInterativo,
  type DefinicaoSistemaInterativo,
} from "../../pacotes/cli/src/sistemasInterativos/index.js";

const PIPELINES_AVANCADOS = [
  "interactive.experience_ir",
  "interactive.observe",
  "interactive.asset_provenance",
  "interactive.editor_state",
  "interactive.evidence_capture",
  "interactive.job_recovery",
  "interactive.acceptance_lock",
  "interactive.temporal_validate",
  "interactive.shot_validate",
  "interactive.physics_validate",
  "interactive.temporal_qa",
  "interactive.clean_install_smoke",
  "interactive.hardware_budget",
  "interactive.autonomous_repair",
  "interactive.bot_playtest",
  "interactive.state_fuzz",
  "interactive.multiplayer_authority",
  "interactive.engine_migration",
  "interactive.portability",
  "interactive.distributed_jobs",
] as const;

test("funcoes canonicas listam os catalogos avancados governados", () => {
  assert.deepEqual(listarPipelinesInterativosAvancados().map((item) => item.pipelineId), PIPELINES_AVANCADOS);
  assert.equal(listarAdaptadoresInterativosAvancados().every((item) => CATALOGO_ADAPTADORES_INTERATIVOS.includes(item)), true);
});

function definicao(pipelineId: string, adapterTargets: readonly string[]): DefinicaoSistemaInterativo {
  const base: DefinicaoSistemaInterativo = {
    schemaVersion: "1.0",
    systemId: `advanced-${pipelineId.replaceAll(".", "-")}`,
    version: "1.0.0",
    kind: pipelineId === "interactive.multiplayer_authority" ? "GAME" : "HYBRID",
    spatialModel: "THREE_D",
    renderMode: "HEADLESS",
    visualProfile: "NONE",
    fidelity: "SYSTEMIC",
    controlModes: ["SCRIPTED"],
    timeModel: "FIXED_STEP",
    determinism: "NONE",
    capabilities: [],
    pipelines: [pipelineId],
    adapterTargets,
    world: {
      identity: "world-main",
      state: { tick: 0 },
      time: { stepMs: 16 },
      events: ["tick", "input"],
      initialConditions: ["tick=0"],
      units: "meters",
      scale: 1,
      coordinateSystem: "right-handed Z-up",
      model: "bounded state machine",
      assumptions: ["fixed clock"],
      boundaryConditions: ["bounded world"],
      outputs: ["state digest"],
      validation: ["invariants evaluated"],
      loop: "observe, decide, advance",
      objective: "reach a terminal state",
      successConditions: ["terminal success"],
      failureConditions: ["terminal failure"],
      rules: ["one step per tick"],
    },
    acceptance: { criteria: ["pipeline plan is structurally complete"] },
  };
  return { ...base, capabilities: validarDefinicaoSistemaInterativo(base).capabilitiesRequeridas };
}

test("catalogo canonico expoe os 20 pipelines P0 P1 P2 sem IDs duplicados", () => {
  const ids = CATALOGO_PIPELINES_INTERATIVOS.map((item) => item.pipelineId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(CATALOGO_PIPELINES_INTERATIVOS.length, 35);
  for (const id of PIPELINES_AVANCADOS) assert.ok(ids.includes(id), id);
  for (const pipeline of CATALOGO_PIPELINES_INTERATIVOS) {
    assert.ok(pipeline.stages.length > 0, pipeline.pipelineId);
    assert.ok(pipeline.capabilities.length > 0, pipeline.pipelineId);
    assert.ok(pipeline.requiredEvidence.length > 0, pipeline.pipelineId);
    assert.ok(pipeline.spatialModels.includes("THREE_D"), pipeline.pipelineId);
    assert.ok(pipeline.renderModes.includes("HEADLESS"), pipeline.pipelineId);
    assert.ok(pipeline.visualProfiles.includes("PIXEL_8_BIT"), pipeline.pipelineId);
    assert.ok(pipeline.visualProfiles.includes("PIXEL_16_BIT"), pipeline.pipelineId);
  }
});

test("todo pipeline avancado tem composicao de adapter que cobre cada stage", () => {
  for (const pipelineId of PIPELINES_AVANCADOS) {
    const draft = definicao(pipelineId, []);
    const required = new Set(draft.capabilities);
    const adapters = CATALOGO_ADAPTADORES_INTERATIVOS.filter((adapter) => (
      adapter.capabilities.some((capability) => required.has(capability))
      && adapter.kinds.includes(draft.kind)
      && adapter.spatialModels.includes("THREE_D")
      && adapter.renderModes.includes("HEADLESS")
      && adapter.visualProfiles.includes("NONE")
      && draft.controlModes.every((mode) => adapter.controlModes.includes(mode))
      && adapter.timeModels.includes(draft.timeModel)
      && adapter.fidelities.includes(draft.fidelity)
    ));
    const targets = adapters.map((adapter) => adapter.adapterId);
    const resultado = planejarSistemaInterativo(definicao(pipelineId, targets));
    assert.deepEqual(resultado.bloqueios, [], `${pipelineId}: ${resultado.bloqueios.join(",")}`);
    assert.equal(resultado.plano.adapterCoverageComplete, true, pipelineId);
    assert.deepEqual(resultado.plano.capabilitiesSemAdapter, [], pipelineId);
    assert.ok(resultado.plano.stageProviderMap.every((item) => item.coveredBySelection), pipelineId);
    assert.equal(resultado.plano.executed, false);
  }
});

test("todo capability avancado tem provider declarativo mas nenhum descriptor prova instalacao", () => {
  const capabilitiesAdapters = new Set(CATALOGO_ADAPTADORES_INTERATIVOS.flatMap((item) => item.capabilities));
  for (const pipelineId of PIPELINES_AVANCADOS) {
    const pipeline = CATALOGO_PIPELINES_INTERATIVOS.find((item) => item.pipelineId === pipelineId)!;
    for (const capability of pipeline.capabilities) assert.ok(capabilitiesAdapters.has(capability), `${pipelineId}:${capability}`);
  }
  for (const adapter of CATALOGO_ADAPTADORES_INTERATIVOS) {
    const validacao = validarAdaptadorSistemaInterativo(adapter);
    assert.equal(validacao.valido, true, `${adapter.adapterId}: ${validacao.bloqueios.join(",")}`);
    assert.equal(adapter.executionBoundary, "EXTERNAL");
    assert.equal(adapter.readOnlyProbe, true);
  }
});

test("roles avancados nao fingem capabilities alheias", () => {
  const multimodal = CATALOGO_ADAPTADORES_INTERATIVOS.find((item) => item.adapterId === "validator.multimodal.external")!;
  const packageRunner = CATALOGO_ADAPTADORES_INTERATIVOS.find((item) => item.adapterId === "runner.package-test.external")!;
  const portability = CATALOGO_ADAPTADORES_INTERATIVOS.find((item) => item.adapterId === "adapter.portability.external")!;
  assert.equal(multimodal.capabilities.some((item) => item.includes("migration") || item.includes("workers.execute")), false);
  assert.equal(packageRunner.capabilities.some((item) => item.includes("evidence.verify") || item.includes("portability")), false);
  assert.equal(portability.capabilities.some((item) => item.includes("qa.") || item.includes("bot.")), false);
});

test("descoberta expoe cada pipeline avancado pela CLI local mais estreita", () => {
  const catalogo = montarCatalogoCapacidades({ kind: "ORCHESTRATION_PIPELINE", domain: "sistemas-interativos" });
  const porId = new Map(catalogo.entries.map((item) => [item.id, item] as const));
  for (const id of PIPELINES_AVANCADOS) {
    const entry = porId.get(id);
    assert.ok(entry, id);
    assert.ok(entry.requiredInputs.length > 0, id);
    assert.ok(entry.requiredInputs.every((item) => item.startsWith("<")), id);
    assert.match(entry.commandTemplates[0]?.command ?? "", /^sema interativo (?!planejar\s)/u, id);
    assert.equal(entry.commandTemplates[0]?.mutatesWorkspace, false, id);
    assert.equal(entry.commandTemplates[0]?.executesExternalRuntime, false, id);
  }
  assert.equal(catalogo.executed, false);
  assert.equal(catalogo.workspaceMutated, false);
  assert.equal(catalogo.externalCalls, false);
});

test("recomendador encontra portabilidade por objetivo sem executar", () => {
  const resultado = recomendarCapacidadePorIntencao("portar jogo 16-bit de Godot para Unity declarando perdas", 5);
  assert.equal(resultado.noMatch, false);
  assert.equal(resultado.recommendations[0]?.id, "interactive.portability");
  assert.equal(resultado.executed, false);
  assert.equal(resultado.workspaceMutated, false);
  assert.equal(resultado.externalCalls, false);
});
