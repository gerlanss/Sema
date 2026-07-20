// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: subcomandos e aliases puros da descoberta, sem efeitos colaterais.

import assert from "node:assert/strict";
import test from "node:test";
import {
  comandoDescobertaCapacidades,
  REGISTRO_HANDLERS_DESCOBERTA,
} from "../../pacotes/cli/src/discovery/command.js";

test("catálogo JSON aplica filtros e não executa", () => {
  const resultado = comandoDescobertaCapacidades("catalogo", ["--tipo", "profile_gate", "--json"]);
  assert.equal(resultado.exitCode, 0);
  assert.equal(resultado.outputFormat, "json");
  assert.equal(resultado.executed, false);
  assert.equal(resultado.payload.success, true);
  assert.equal(resultado.payload.executed, false);
  assert.equal(resultado.payload.workspaceMutated, false);
  assert.equal(resultado.payload.externalCalls, false);
  assert.equal(resultado.payload.mode, "catalog");
  if (resultado.payload.mode === "catalog") {
    assert.ok(resultado.payload.entries.every((entry) => entry.kind === "PROFILE_GATE"));
  }
});

test("recomendar preserva placeholders e saída humana declara fronteira", () => {
  const resultado = comandoDescobertaCapacidades("recomendar", [
    "--intencao", "validar loop de jogo", "--limite", "3",
  ]);
  assert.equal(resultado.exitCode, 0);
  assert.match(resultado.text, /Nenhuma ação foi executada/u);
  assert.equal(resultado.payload.mode, "ranking");
  if (resultado.payload.mode === "ranking") {
    assert.match(resultado.payload.recommendations[0]?.suggestedCommandTemplate ?? "", /<contrato\.sema>/u);
  }
});

test("explicar e aliases pipeline listar/descrever compartilham o mesmo catálogo", () => {
  const explicar = comandoDescobertaCapacidades("explicar", ["workflow.author"]);
  assert.equal(explicar.exitCode, 0);
  assert.equal(explicar.payload.mode, "explain");

  const listar = comandoDescobertaCapacidades("pipeline", ["listar", "--json"]);
  assert.equal(listar.exitCode, 0);
  assert.equal(listar.payload.mode, "catalog");
  if (listar.payload.mode === "catalog") {
    assert.equal(listar.payload.command, "descobrir pipeline listar");
    assert.ok(listar.payload.entries.every((entry) => entry.kind === "ORCHESTRATION_PIPELINE"));
  }

  const descrever = comandoDescobertaCapacidades("PIPELINE_DESCREVER", ["simulation.calibrate"]);
  assert.equal(descrever.exitCode, 0);
  assert.equal(descrever.payload.mode, "explain");
  if (descrever.payload.mode === "explain") assert.equal(descrever.payload.entry.id, "simulation.calibrate");

  const author = comandoDescobertaCapacidades("explicar", ["author"]);
  assert.equal(author.exitCode, 0);
  if (author.payload.mode === "explain") assert.equal(author.payload.entry.id, "workflow.author");

  const unreal = comandoDescobertaCapacidades("explicar", ["unreal"]);
  assert.equal(unreal.exitCode, 0);
  if (unreal.payload.mode === "explain") assert.equal(unreal.payload.entry.id, "engine.unreal");

  const customAmbíguo = comandoDescobertaCapacidades("explicar", ["custom"]);
  assert.equal(customAmbíguo.exitCode, 2);
});

test("capabilities é alias de catálogo e handlers têm as três chaves públicas", () => {
  const alias = comandoDescobertaCapacidades("capabilities", ["--id", "profile.game"]);
  assert.equal(alias.exitCode, 0);
  assert.equal(alias.payload.mode, "catalog");
  if (alias.payload.mode === "catalog") assert.deepEqual(alias.payload.entries.map((entry) => entry.id), ["profile.game"]);
  assert.deepEqual(Object.keys(REGISTRO_HANDLERS_DESCOBERTA), ["descobrir", "pipeline", "capabilities"]);
});

test("subcomando implícito e argumentos inválidos falham com erro estático", () => {
  const ausente = comandoDescobertaCapacidades(undefined, ["segredo-que-nao-deve-ser-ecoado"]);
  assert.equal(ausente.exitCode, 2);
  assert.equal(ausente.payload.mode, "error");
  assert.doesNotMatch(JSON.stringify(ausente.payload), /segredo-que-nao-deve-ser-ecoado/u);

  const limite = comandoDescobertaCapacidades("recomendar", ["--intencao", "jogo", "--limite", "99"]);
  assert.equal(limite.exitCode, 2);
  assert.equal(limite.payload.mode, "error");

  const pipeline = comandoDescobertaCapacidades("pipeline", ["executar", "simulation.calibrate"]);
  assert.equal(pipeline.exitCode, 2);
  assert.equal(pipeline.payload.mode, "error");

  for (const args of [
    ["--tipoo", "PROFILE_GATE"],
    ["--tipo", "PROFILE_GATE", "--tipo", "ADAPTER"],
    ["--tipo"],
  ]) {
    const inválido = comandoDescobertaCapacidades("catalogo", args);
    assert.equal(inválido.exitCode, 2);
    assert.equal(inválido.payload.mode, "error");
    if (inválido.payload.mode === "error") {
      assert.equal(inválido.payload.error.code, "DISCOVERY_ARGUMENTOS_INVALIDOS");
    }
  }
});

test("sucesso redige caminhos e credenciais controlados sem alterar a recomendação", () => {
  const segredo = `sk_${"X".repeat(32)}`;
  const caminho = "C:\\Users\\alice\\segredo.json";
  const recomendação = comandoDescobertaCapacidades("recomendar", [
    "--intencao", `simulador calibrado Bearer ${segredo} ${caminho}`,
    "--json",
  ]);
  assert.equal(recomendação.exitCode, 0);
  assert.equal(recomendação.payload.mode, "ranking");
  assert.doesNotMatch(JSON.stringify(recomendação.payload), /alice|Bearer|sk_/u);
  if (recomendação.payload.mode === "ranking") {
    assert.equal(recomendação.payload.intent, "[REDACTED]");
    assert.equal(recomendação.payload.recommendations[0]?.id, "simulation.calibrate");
  }

  const catálogo = comandoDescobertaCapacidades("catalogo", [
    "--id", caminho,
    "--dominio", `client_secret=${segredo}`,
    "--json",
  ]);
  assert.equal(catálogo.exitCode, 0);
  assert.doesNotMatch(JSON.stringify(catálogo.payload), /alice|client_secret|sk_/u);
  if (catálogo.payload.mode === "catalog") {
    assert.equal(catálogo.payload.filters.id, "[REDACTED]");
    assert.equal(catálogo.payload.filters.domain, "[REDACTED]");
  }
});
