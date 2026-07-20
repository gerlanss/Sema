// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: ranking determinístico, ambiguidade, limiar e normalização de intenção.

import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizarIntencaoDescoberta,
  recomendarCapacidadePorIntencao,
} from "../../pacotes/cli/src/discovery/ranker.js";

test("roteia gates, workflows e pipelines pelo objetivo real", () => {
  const casos = [
    ["validar loop e balanceamento de um jogo", "profile.game"],
    ["criar trailer, post e thumbnail do jogo para vários canais", "pipeline.content"],
    ["automatizar webhook n8n", "profile.workflow"],
    ["escrever romance com continuidade de capítulos", "workflow.author"],
    ["validar simulador 3D autônomo realista calibrado", "simulation.calibrate"],
  ] as const;

  for (const [intent, expected] of casos) {
    const payload = recomendarCapacidadePorIntencao(intent);
    assert.equal(payload.noMatch, false, intent);
    assert.equal(payload.recommendations[0]?.id, expected, intent);
    assert.ok((payload.recommendations[0]?.score ?? 0) >= 60, intent);
    assert.equal(payload.executed, false);
    assert.equal(payload.workspaceMutated, false);
    assert.equal(payload.externalCalls, false);
  }
});

test("pipeline interativo recomendado entrega planejamento declarativo acionável", () => {
  const payload = recomendarCapacidadePorIntencao("calibrar simulador autônomo realista");
  assert.equal(payload.noMatch, false);
  assert.equal(payload.recommendations[0]?.id, "simulation.calibrate");
  assert.equal(
    payload.recommendations[0]?.suggestedCommandTemplate,
    "sema interativo planejar <definition.json> --json",
  );
  assert.ok(payload.recommendations[0]?.missingInputs.some((item) => item.includes("definition.json")));
});

test("intenções avançadas vencem profiles e adapters e sugerem a CLI específica", () => {
  const casos = [
    [
      "portar projeto Unreal para Godot declarando perdas",
      "interactive.portability",
      "sema interativo analisar-portabilidade <portability-plan.json> --json",
    ],
    [
      "executar bots de playtest fuzz de inputs save e load",
      "interactive.state_fuzz",
      "sema interativo validar-playtest-fuzz <playtest-fuzz.json> --json",
    ],
    [
      "validar timeline câmera física e QA temporal de simulador 3D",
      "interactive.temporal_validate",
      "sema interativo validar-temporal <temporal-contract.json> --json",
    ],
  ] as const;

  for (const [intencao, id, comando] of casos) {
    const payload = recomendarCapacidadePorIntencao(intencao, 10);
    assert.equal(payload.noMatch, false, intencao);
    assert.equal(payload.ambiguity.detected, false, intencao);
    assert.equal(payload.recommendations[0]?.id, id, intencao);
    assert.equal(payload.recommendations[0]?.suggestedCommandTemplate, comando, intencao);
    assert.ok(payload.recommendations[0]?.missingInputs.every((item) => item.startsWith("<")), intencao);
  }
});

test("normaliza acentos e equivalências sem ranking probabilístico", () => {
  assert.equal(
    normalizarIntencaoDescoberta("SIMULAÇÃO autônoma calibrada"),
    "simulation autonomous calibrate",
  );
  const comAcentos = recomendarCapacidadePorIntencao("validar simulação autônoma calibrada");
  const semAcentos = recomendarCapacidadePorIntencao("validar simulacao autonoma calibrada");
  assert.deepEqual(
    comAcentos.recommendations.map((item) => [item.id, item.score]),
    semAcentos.recommendations.map((item) => [item.id, item.score]),
  );
});

test("estilo visual isolado não vira objetivo de pipeline", () => {
  const payload = recomendarCapacidadePorIntencao("quero algo 3D 16-bit");
  assert.equal(payload.noMatch, true);
  assert.equal(payload.recommendations.every((item) => item.suggestedCommandTemplate === null), true);
});

test("delta de até sete pontos sinaliza ambiguidade e remove comando único", () => {
  const payload = recomendarCapacidadePorIntencao("publicar via webhook");
  assert.equal(payload.noMatch, false);
  assert.equal(payload.ambiguity.detected, true);
  assert.ok((payload.ambiguity.delta ?? 99) <= 7);
  assert.deepEqual(payload.ambiguity.candidates, ["pipeline.content", "profile.workflow"]);
  assert.equal(payload.recommendations.every((item) => item.suggestedCommandTemplate === null), true);
});

test("score abaixo de 60 produz no-match e ordenação estável", () => {
  const primeira = recomendarCapacidadePorIntencao("xyzzy sem contexto", 10);
  const segunda = recomendarCapacidadePorIntencao("xyzzy sem contexto", 10);
  assert.equal(primeira.noMatch, true);
  assert.deepEqual(primeira, segunda);
  assert.equal(primeira.recommendations.every((item) => item.suggestedCommandTemplate === null), true);
});

test("id exato vence com 100 e limite inválido falha fechado", () => {
  const payload = recomendarCapacidadePorIntencao("simulation.calibrate");
  assert.equal(payload.recommendations.length, 1);
  assert.equal(payload.recommendations[0]?.id, "simulation.calibrate");
  assert.equal(payload.recommendations[0]?.score, 100);
  assert.throws(() => recomendarCapacidadePorIntencao("jogo", 0), /discovery_limite_invalido/u);
  assert.throws(() => recomendarCapacidadePorIntencao("", 5), /discovery_intencao_obrigatoria/u);
});

test("alias exato compartilhado é ambíguo e nunca desempata silenciosamente", () => {
  const payload = recomendarCapacidadePorIntencao("custom", 10);
  assert.equal(payload.noMatch, false);
  assert.equal(payload.ambiguity.detected, true);
  assert.equal(payload.ambiguity.delta, 0);
  assert.ok(payload.ambiguity.candidates.length >= 2);
  assert.ok(payload.recommendations.filter((item) => item.score === 100).length >= 2);
  assert.equal(payload.recommendations.every((item) => item.suggestedCommandTemplate === null), true);

  const limiteUm = recomendarCapacidadePorIntencao("custom", 1);
  assert.equal(limiteUm.recommendations.length, 1);
  assert.equal(limiteUm.ambiguity.detected, true);
  assert.equal(limiteUm.ambiguity.candidates.length, 2);
  assert.equal(limiteUm.recommendations[0]?.suggestedCommandTemplate, null);
});
