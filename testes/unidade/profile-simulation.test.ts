// SEMA-GOVERNED: sema.produto.simulation
// Descricao: valida catalogo, presets e artefatos opostos do Profile Simulation.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  CAPABILITY_MATRIX_GOVERNANCA,
  PRESETS_PROFILE,
  normalizarProfileSemantico,
} from "../../pacotes/cli/src/profileCatalogo.js";
import { validarProfileSemantico } from "../../pacotes/cli/src/profileCommand.js";
import { normalizarPresetProfile, selecionarRulePacksProfile } from "../../pacotes/cli/src/profileRegras.js";
import type { PresetProfile } from "../../pacotes/cli/src/profileAuthorTipos.js";

const EXEMPLO_SIMULATION = path.resolve("exemplos/profile_simulation.sema");

function artefatoSimulation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    objective: "comparar estabilidade do sistema",
    model: "agent model testavel",
    assumptions: ["massa constante", "passo discreto"],
    initial_conditions: ["100 agentes", "estado inicial versionado"],
    boundary_conditions: ["bordas fechadas"],
    outputs: ["tempo medio", "state digest"],
    units: ["seconds", "meters", "agents"],
    spatial_model: "TWO_D",
    render_mode: "VISUAL",
    visual_profile: "PIXEL_16_BIT",
    validation: "compare outputs against baseline and tolerances",
    control: "HUMAN",
    time_model: "FIXED_STEP",
    fidelity: "SYSTEMIC",
    uncertainty: "confidence interval declarado",
    telemetry: "metrics per tick",
    determinism: "NONE",
    ...overrides,
  };
}

function artefatoCompletoHeadless(): Record<string, unknown> {
  return artefatoSimulation({
    model: "THREE_D orbital model em execucao headless",
    spatial_model: "THREE_D",
    render_mode: "HEADLESS",
    visual_profile: "NONE",
    control: "AUTONOMOUS",
    fidelity: "CALIBRATED",
    reference: "versioned dataset baseline",
    calibration: "calibration method reproducible",
    tolerances: "error <= 2 percent",
    uncertainty: "uncertainty confidence interval",
    telemetry: "telemetry metrics per tick",
    determinism: "SEEDED",
    seed: 42,
    snapshot: "state_digest sha256",
    replay: "event_log and result_digest",
    scenario_id: "orbital-stability-v1",
    acceptance: "expected_output error below tolerance",
    batch: "batch ensemble",
    replications: 50,
    seed_strategy: "seed_strategy increment by run",
    aggregation: "aggregation median and percentile",
    resource_budget: "resource_budget CPU 60 seconds",
    stop_condition: "stop_condition max 10000 ticks",
    authority_boundary: "authority_boundary without external writes",
    fail_safe: "fail_safe kill switch",
    human_takeover: "human_takeover by operator",
    isolation: "sandbox isolation",
  });
}

async function validar(preset: PresetProfile | null, artefato: Record<string, unknown>) {
  return validarProfileSemantico(EXEMPLO_SIMULATION, "simulation", {
    maturidade: "prototype",
    preset,
    artefatoTexto: JSON.stringify(artefato, null, 2),
  });
}

test("profile simulation expoe aliases, presets, capability e rule packs", () => {
  assert.equal(normalizarProfileSemantico("simulation"), "simulation");
  assert.equal(normalizarProfileSemantico("simulação"), "simulation");
  assert.equal(normalizarProfileSemantico("simulador"), "simulation");
  assert.deepEqual(PRESETS_PROFILE.simulation, ["model", "scenario", "calibration", "deterministic", "batch", "safety"]);
  assert.equal(normalizarPresetProfile("simulation", "modelo"), "model");
  assert.equal(normalizarPresetProfile("simulation", "cenário"), "scenario");
  assert.equal(normalizarPresetProfile("simulation", "calibração"), "calibration");
  assert.equal(normalizarPresetProfile("simulation", "determinística"), "deterministic");
  assert.equal(normalizarPresetProfile("simulation", "lote"), "batch");
  assert.equal(normalizarPresetProfile("simulation", "segurança"), "safety");
  assert.equal(CAPABILITY_MATRIX_GOVERNANCA.simulation.validaArtefatoReal, "parcial");
  assert.deepEqual(
    selecionarRulePacksProfile("simulation").map((pack) => pack.id),
    ["simulation-model", "simulation-calibration", "simulation-determinism", "simulation-batch", "simulation-safety"],
  );
});

test("fixture 2D retro controlada usa pixel como visual profile", async () => {
  const resultado = await validar("model", artefatoSimulation());

  assert.equal(resultado.aprovado, true);
  assert.equal(resultado.bloqueado, false);
  assert.equal(resultado.profile, "simulation");
  assert.equal(resultado.achadosArtefato.some((achado) => achado.id === "simulation_pixel_como_eixo"), false);
});

test("fixture THREE_D headless autonoma valida safety sem exigir renderer", async () => {
  const resultado = await validar("safety", artefatoCompletoHeadless());

  assert.equal(resultado.aprovado, true);
  assert.equal(resultado.bloqueado, false);
  assert.equal(resultado.achadosArtefato.some((achado) => achado.id === "simulation_headless_visual_none" && achado.atendido), true);
  assert.equal(resultado.achadosArtefato.some((achado) => achado.id.startsWith("simulation_safety_") && !achado.atendido), false);
});

test("todos os presets simulation possuem caminho validavel", async () => {
  for (const preset of PRESETS_PROFILE.simulation) {
    const resultado = await validar(preset, artefatoCompletoHeadless());
    assert.equal(resultado.aprovado, true, `${preset}: ${resultado.requisitosPendentes.join(", ")}`);
  }
});

test("pixel 8/16-bit como eixo espacial bloqueia o profile", async () => {
  const resultado = await validar("model", artefatoSimulation({
    spatial_model: "PIXEL_8_BIT",
    visual_profile: "PIXEL_8_BIT",
  }));

  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.bloqueado, true);
  assert.equal(resultado.achadosArtefato.some((achado) =>
    achado.id === "simulation_pixel_como_eixo" && !achado.atendido && achado.severidade === "critical"
  ), true);
});

test("campo legado representation bloqueia para nao perder THREE_D headless", async () => {
  const resultado = await validar("model", artefatoSimulation({ representation: "HEADLESS" }));

  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.achadosArtefato.some((achado) =>
    achado.id === "simulation_representacao_legada" && achado.severidade === "critical"
  ), true);
});

test("calibrated sem tolerancia numerica observavel bloqueia", async () => {
  const artefato = artefatoCompletoHeadless();
  delete artefato.tolerances;
  const resultado = await validar("calibration", artefato);

  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.achadosArtefato.some((achado) =>
    achado.id === "simulation_calibration_tolerancia_artefato" && !achado.atendido
  ), true);
});

test("assumptions mencionadas como ausentes nao satisfazem o requisito", async () => {
  const resultado = await validar("model", artefatoSimulation({ assumptions: "assumptions ausentes" }));

  assert.equal(resultado.aprovado, false);
  assert.equal(resultado.achadosArtefato.some((achado) =>
    achado.id === "simulation_assumptions_artefato" && !achado.atendido && achado.motivo?.includes("negacao")
  ), true);
});
