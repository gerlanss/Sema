// SEMA-GOVERNED: sema.produto.sistemas_interativos
// Descricao: regressao do catalogo, eixos ortogonais, fixtures e composicao de provedores.

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  CATALOGO_ADAPTADORES_INTERATIVOS,
  CATALOGO_CAPABILITIES_INTERATIVAS,
  CATALOGO_PIPELINES_INTERATIVOS,
  MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS,
  listarAdaptadoresSistemasInterativos,
  obterPipelineSistemaInterativo,
  planejarSistemaInterativo,
  validarDefinicaoSistemaInterativo,
  type DefinicaoSistemaInterativo,
  type KindSistemaInterativo,
  type JsonObjetoSistemaInterativo,
  type ModeloEspacialSistemaInterativo,
  type ModoControleSistemaInterativo,
  type PerfilVisualSistemaInterativo,
} from "../../pacotes/cli/src/sistemasInterativos/index.js";

const DIRETORIO_FIXTURES = path.resolve("exemplos/sistemas-interativos");

async function carregarDefinicao(nome: string): Promise<DefinicaoSistemaInterativo> {
  return JSON.parse(await readFile(path.join(DIRETORIO_FIXTURES, nome), "utf8")) as DefinicaoSistemaInterativo;
}

function simulacaoMinima(
  pipelines: readonly string[] = ["interactive.prototype"],
  adapterTargets: readonly string[] = ["runtime.headless.generic"],
): DefinicaoSistemaInterativo {
  const base: DefinicaoSistemaInterativo = {
    schemaVersion: "1.0",
    systemId: "simulation.minimal",
    version: "1.0.0",
    kind: "SIMULATION",
    spatialModel: "NON_SPATIAL",
    renderMode: "HEADLESS",
    visualProfile: "NONE",
    fidelity: "SYSTEMIC",
    controlModes: ["SCRIPTED"],
    timeModel: "EVENT_DRIVEN",
    determinism: "NONE",
    capabilities: ["interactive.control.scripted"],
    pipelines,
    adapterTargets,
    world: {
      identity: "bounded-queue",
      state: { length: 0 },
      time: { model: "event-driven" },
      events: ["enqueue", "dequeue"],
      initialConditions: ["empty queue"],
      model: "bounded queue",
      assumptions: ["single producer"],
      boundaryConditions: ["capacity 10"],
      outputs: ["queue length"],
      validation: { method: "invariant check", invariants: ["length from zero to ten"] },
    },
    acceptance: { criteria: ["queue length remains bounded"] },
  };
  return { ...base, capabilities: validarDefinicaoSistemaInterativo(base).capabilitiesRequeridas };
}

test("catalogo cobre os eixos ortogonais e pipelines canonicos", () => {
  assert.deepEqual(MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.kinds, ["GAME", "SIMULATION", "HYBRID"]);
  assert.deepEqual(MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.spatialModels, [
    "NON_SPATIAL", "TWO_D", "TWO_POINT_FIVE_D", "THREE_D",
  ]);
  assert.deepEqual(MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.renderModes, ["HEADLESS", "TEXT", "VISUAL", "XR"]);
  assert.ok(MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.timeModels.includes("ACCELERATED"));
  assert.ok(MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.determinisms.includes("STOCHASTIC"));

  const ids = new Set(CATALOGO_PIPELINES_INTERATIVOS.map((item) => item.pipelineId));
  for (const id of [
    "interactive.prototype", "interactive.playtest", "interactive.package", "interactive.release",
    "interactive.replay", "interactive.calibrate", "interactive.safety", "game.balance",
    "game.progression", "game.multiplayer", "simulation.scenario", "simulation.batch_run",
    "simulation.calibrate", "simulation.validate", "simulation.safety",
  ]) assert.ok(ids.has(id), id);
});

test("game e simulation aceitam 2D ou 3D, pixel 8/16-bit e todos os modos de controle", () => {
  const kinds: readonly KindSistemaInterativo[] = ["GAME", "SIMULATION"];
  const spatialModels: readonly ModeloEspacialSistemaInterativo[] = ["TWO_D", "THREE_D"];
  const visualProfiles: readonly PerfilVisualSistemaInterativo[] = ["PIXEL_8_BIT", "PIXEL_16_BIT"];
  const controlModes: readonly ModoControleSistemaInterativo[] = [
    "HUMAN", "SCRIPTED", "AI", "HYBRID", "AUTONOMOUS", "UNCONTROLLED",
  ];
  let combinacoes = 0;

  for (const kind of kinds) for (const spatialModel of spatialModels) {
    for (const visualProfile of visualProfiles) for (const controlMode of controlModes) {
      const exigeSafety = controlMode === "AUTONOMOUS" || controlMode === "UNCONTROLLED";
      const pipelines = ["interactive.prototype", ...(exigeSafety ? ["interactive.safety"] : [])];
      const base: DefinicaoSistemaInterativo = {
        schemaVersion: "1.0",
        systemId: `matrix.${kind.toLowerCase()}.${spatialModel.toLowerCase()}.${visualProfile.toLowerCase()}.${controlMode.toLowerCase()}`,
        version: "1.0.0",
        kind,
        spatialModel,
        renderMode: "VISUAL",
        visualProfile,
        fidelity: "SYSTEMIC",
        controlModes: [controlMode],
        timeModel: "EVENT_DRIVEN",
        determinism: "NONE",
        capabilities: [],
        pipelines,
        adapterTargets: ["engine.godot", "validator.replay.local"],
        world: {
          identity: "bounded interactive matrix fixture",
          state: { phase: "ready" },
          time: { model: "event-driven" },
          events: ["start", "stop"],
          initialConditions: ["ready"],
          loop: "observe, decide, act, validate",
          rules: ["actions remain within declared bounds"],
          objective: "reach the externally verified ready state",
          successConditions: ["ready state is observed"],
          failureConditions: ["state invariant fails"],
          grid: "16x16 logical cells",
          units: "metres",
          scale: "1 unit = 1 metre",
          coordinateSystem: "right-handed Y-up",
          model: "bounded deterministic state machine",
          assumptions: ["inputs remain inside declared bounds"],
          boundaryConditions: ["world remains inside the fixture grid"],
          outputs: ["phase"],
          validation: { method: "state invariant", invariants: ["phase is declared"] },
          stopCriteria: ["stop event"],
          safetyConstraints: ["no mutation outside the declared world"],
        },
        budgets: {
          paletteColors: 256,
          baseResolution: "320x180",
          tileSize: "16x16",
          spriteSize: "16x16",
          memoryBudgetBytes: 262144,
          audioProfile: "eight bounded sampled voices",
        },
        acceptance: { criteria: ["runtime evidence is collected externally"] },
      };
      const definicao = {
        ...base,
        capabilities: validarDefinicaoSistemaInterativo(base).capabilitiesRequeridas,
      };
      const validacao = validarDefinicaoSistemaInterativo(definicao);
      assert.equal(validacao.valida, true, `${definicao.systemId}: ${validacao.bloqueios.join(",")}`);
      const planejamento = planejarSistemaInterativo(definicao);
      assert.deepEqual(planejamento.bloqueios, [], definicao.systemId);
      assert.equal(planejamento.plano.adapterCoverageComplete, true, definicao.systemId);
      assert.ok(planejamento.plano.stageProviderMap.every((item) => item.coveredBySelection), definicao.systemId);
      combinacoes += 1;
    }
  }
  assert.equal(combinacoes, 48);
});

test("vocabulario de capabilities e derivado sem lista paralela obsoleta", () => {
  const esperadas = [...new Set([
    ...CATALOGO_PIPELINES_INTERATIVOS.flatMap((item) => item.capabilities),
    ...CATALOGO_ADAPTADORES_INTERATIVOS.flatMap((item) => item.capabilities),
  ])].sort();
  assert.deepEqual(CATALOGO_CAPABILITIES_INTERATIVAS.map((item) => item.capability), esperadas);
});

test("registros canonicos sao imutaveis e consultas devolvem copias profundas", () => {
  assert.equal(Object.isFrozen(CATALOGO_PIPELINES_INTERATIVOS), true);
  assert.equal(Object.isFrozen(CATALOGO_PIPELINES_INTERATIVOS[0]?.stages), true);
  assert.equal(Object.isFrozen(CATALOGO_ADAPTADORES_INTERATIVOS[0]?.capabilities), true);
  assert.throws(() => {
    (CATALOGO_PIPELINES_INTERATIVOS[0]!.stages[0]!.requiredEvidence as string[]).push("poison");
  }, TypeError);

  const copia = obterPipelineSistemaInterativo("interactive.prototype")!;
  (copia.stages[0]!.requiredEvidence as string[]).push("poison");
  assert.equal(
    obterPipelineSistemaInterativo("interactive.prototype")!.stages[0]!.requiredEvidence.includes("poison"),
    false,
  );

  const listagem = listarAdaptadoresSistemasInterativos({ renderMode: "HEADLESS" });
  (listagem.adapters[0]!.capabilities as string[]).push("poison");
  assert.equal(CATALOGO_ADAPTADORES_INTERATIVOS.some((item) => item.capabilities.includes("poison")), false);
});

test("as onze definicoes JSON validam e possuem cobertura completa de provedor", async () => {
  const arquivos = (await readdir(DIRETORIO_FIXTURES))
    .filter((nome) => nome.endsWith(".json") && !nome.startsWith("protocol-") && !nome.startsWith("experience-"))
    .sort();
  assert.equal(arquivos.length, 11);
  for (const arquivo of arquivos) {
    const definicao = await carregarDefinicao(arquivo);
    const validacao = validarDefinicaoSistemaInterativo(definicao);
    assert.equal(validacao.valida, true, `${arquivo}: ${validacao.bloqueios.join(",")}`);
    const planejamento = planejarSistemaInterativo(definicao);
    assert.deepEqual(planejamento.bloqueios, [], `${arquivo}: ${planejamento.bloqueios.join(",")}`);
    assert.deepEqual(planejamento.plano.capabilitiesAusentes, [], arquivo);
    assert.deepEqual(planejamento.plano.capabilitiesSemAdapter, [], arquivo);
    assert.equal(planejamento.plano.adapterSelectionExplicit, true, arquivo);
    assert.equal(planejamento.plano.adapterCoverageComplete, true, arquivo);
    assert.ok(planejamento.plano.stageProviderMap.every((item) => item.coveredBySelection), arquivo);
  }
});

test("THREE_D com HEADLESS e valido, mas XR exige THREE_D", async () => {
  const headless = await carregarDefinicao("simulation-headless-autonomous-batch.json");
  const threeDHeadless: DefinicaoSistemaInterativo = {
    ...headless,
    systemId: "simulation.three-d.headless",
    spatialModel: "THREE_D",
    capabilities: headless.capabilities.map((item) => (
      item === "interactive.spatial.non_spatial" ? "interactive.spatial.three_d" : item
    )),
    world: {
      ...headless.world,
      units: "metres",
      scale: "1 unit = 1 metre",
      coordinateSystem: "right-handed Y-up",
    },
  };
  assert.equal(validarDefinicaoSistemaInterativo(threeDHeadless).valida, true);
  assert.deepEqual(planejarSistemaInterativo(threeDHeadless).bloqueios, []);

  const xr = await carregarDefinicao("game-xr-human.json");
  const xrTwoD = { ...xr, spatialModel: "TWO_D" as const };
  assert.ok(validarDefinicaoSistemaInterativo(xrTwoD).bloqueios.includes("render_xr_exige_spatial_model_three_d"));
});

test("simulacao exige estrategia de validacao e realismo exige calibracao", async () => {
  const simulacao = await carregarDefinicao("simulation-2d-controlled.json");
  const { validation: _validation, ...worldSemValidacao } = simulacao.world as JsonObjetoSistemaInterativo;
  assert.ok(validarDefinicaoSistemaInterativo({ ...simulacao, world: worldSemValidacao }).bloqueios.includes(
    "simulation_world_ausente:validation",
  ));

  const jogo = await carregarDefinicao("game-3d-human.json");
  const realista: DefinicaoSistemaInterativo = {
    ...jogo,
    fidelity: "REALISTIC",
    capabilities: jogo.capabilities.map((item) => (
      item === "interactive.fidelity.systemic" ? "interactive.fidelity.realistic" : item
    )),
  };
  const bloqueios = validarDefinicaoSistemaInterativo(realista).bloqueios;
  assert.ok(bloqueios.includes("fidelity_exige_pipeline_calibrate_compativel"));
  for (const campo of ["reference", "calibration", "tolerances", "uncertainty", "telemetry"]) {
    assert.ok(bloqueios.includes(`realistic_acceptance_ausente:${campo}`));
  }
});

test("planner bloqueia selecao vazia e recomenda composicao", () => {
  const vazia = planejarSistemaInterativo(simulacaoMinima(undefined, []));
  assert.ok(vazia.bloqueios.includes("adapter_selecao_explicita_ausente"));
  assert.equal(vazia.plano.adapterCoverageComplete, false);
  assert.ok(vazia.plano.capabilitiesSemAdapter.length > 0);
  assert.ok(vazia.plano.nextActions.some((item) => item.startsWith("selecionar_adapter_externo:")));

});

test("planner bloqueia selecao parcial e recomenda completar provedores", () => {
  const parcial = planejarSistemaInterativo(simulacaoMinima(undefined, ["telemetry.trace.local"]));
  assert.ok(parcial.bloqueios.includes("adapter_capability_coverage_incompleta"));
  assert.equal(parcial.plano.adapterCoverageComplete, false);
  assert.ok(parcial.plano.nextActions.some((item) => item.startsWith("adicionar_adapter_externo:")));
});

test("runtime headless sozinho nao ganha capacidade de empacotar por osmose", () => {
  const somenteRuntime = planejarSistemaInterativo(simulacaoMinima(
    ["interactive.prototype", "interactive.package"],
    ["runtime.headless.generic"],
  ));
  assert.ok(somenteRuntime.bloqueios.includes("adapter_capability_coverage_incompleta"));
  assert.ok(somenteRuntime.plano.capabilitiesSemAdapter.includes("interactive.build.plan"));
  assert.ok(somenteRuntime.plano.capabilitiesSemAdapter.includes("interactive.package.plan"));
  assert.ok(somenteRuntime.plano.nextActions.includes("adicionar_adapter_externo:build.generic.external"));

  const composta = planejarSistemaInterativo(simulacaoMinima(
    ["interactive.prototype", "interactive.package"],
    ["runtime.headless.generic", "build.generic.external"],
  ));
  assert.deepEqual(composta.bloqueios, []);
  assert.equal(composta.plano.adapterCoverageComplete, true);
});

test("catalogo explicita Blender e nunca afirma instalacao local", () => {
  const blender = CATALOGO_ADAPTADORES_INTERATIVOS.find((item) => item.adapterId === "editor.blender");
  assert.ok(blender);
  assert.equal(blender.role, "EDITOR");
  assert.equal(blender.executionBoundary, "EXTERNAL");
  assert.ok(blender.capabilities.includes("interactive.scene.author"));
  assert.ok(CATALOGO_ADAPTADORES_INTERATIVOS.every((item) => item.executionBoundary === "EXTERNAL"));
});
