// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: invariantes do registro derivado e do resumo para Agent Context.

import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITY_MATRIX_GOVERNANCA } from "../../pacotes/cli/src/profileCatalogo.js";
import { CAPABILITIES_CONTEUDO_PADRAO } from "../../pacotes/cli/src/pipelineConteudo/adapters.js";
import {
  CATALOGO_ADAPTADORES_INTERATIVOS,
  CATALOGO_PIPELINES_INTERATIVOS,
} from "../../pacotes/cli/src/sistemasInterativos/catalog.js";
import { CATALOGO_PIPELINES_INTERATIVOS_AVANCADOS } from "../../pacotes/cli/src/sistemasInterativos/advancedCatalog.js";
import {
  criarResumoDescobertaAgentContext,
  montarCatalogoCapacidades,
  obterEntradaDescoberta,
} from "../../pacotes/cli/src/discovery/catalog.js";

test("catálogo tem ids únicos, fronteira sem execução e templates com efeitos explícitos", () => {
  const payload = montarCatalogoCapacidades();
  assert.equal(payload.schemaVersion, "sema.discovery/v1");
  assert.equal(payload.executed, false);
  assert.equal(payload.workspaceMutated, false);
  assert.equal(payload.externalCalls, false);
  assert.equal(payload.requiresExplicitRun, true);

  const ids = payload.entries.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length > 30);
  for (const entry of payload.entries) {
    assert.ok(entry.id.length > 0);
    assert.ok(entry.label.length > 0);
    assert.ok(entry.summary.length > 0);
    assert.ok(entry.useWhen.length > 0);
    assert.ok(entry.avoidWhen.length > 0);
    assert.ok(entry.commandTemplates.length > 0);
    for (const command of entry.commandTemplates) {
      assert.ok(command.command.startsWith("sema "));
      assert.equal(typeof command.mutatesWorkspace, "boolean");
      assert.equal(typeof command.executesExternalRuntime, "boolean");
      assert.ok(command.effectClass.length > 0);
    }
  }
});

test("profiles vêm da matriz e Author é workflow especializado, nunca profile gate", () => {
  const catalogo = montarCatalogoCapacidades().entries;
  const profiles = Object.values(CAPABILITY_MATRIX_GOVERNANCA)
    .map((capability) => capability.profile)
    .filter((profile) => profile !== "author");

  for (const profile of profiles) {
    const entry = catalogo.find((item) => item.id === `profile.${profile}`);
    assert.equal(entry?.kind, "PROFILE_GATE");
    assert.ok(entry?.commandTemplates.some((item) => item.command.includes(`profile validar ${profile}`)));
  }

  const author = obterEntradaDescoberta("workflow.author");
  assert.equal(author?.kind, "SPECIALIZED_WORKFLOW");
  assert.ok(author?.commandTemplates.every((item) => item.command.startsWith("sema author ")));
  assert.equal(catalogo.some((entry) => entry.commandTemplates.some((item) => item.command.includes("profile validar author"))), false);
});

test("conteúdo e sistemas interativos são projeções completas das fontes canônicas", () => {
  const ids = new Set(montarCatalogoCapacidades().entries.map((entry) => entry.id));
  for (const capability of CAPABILITIES_CONTEUDO_PADRAO) assert.ok(ids.has(capability));
  for (const pipeline of CATALOGO_PIPELINES_INTERATIVOS) assert.ok(ids.has(pipeline.pipelineId));
  for (const adapter of CATALOGO_ADAPTADORES_INTERATIVOS) assert.ok(ids.has(adapter.adapterId));

  assert.equal(obterEntradaDescoberta("simulation.calibrate")?.kind, "ORCHESTRATION_PIPELINE");
  assert.equal(
    montarCatalogoCapacidades({ kind: "adapter" }).entries.length,
    CATALOGO_ADAPTADORES_INTERATIVOS.length,
  );
  const idsAvancados = new Set(CATALOGO_PIPELINES_INTERATIVOS_AVANCADOS.map((pipeline) => pipeline.pipelineId));
  for (const pipeline of CATALOGO_PIPELINES_INTERATIVOS) {
    const entry = obterEntradaDescoberta(pipeline.pipelineId);
    if (idsAvancados.has(pipeline.pipelineId)) {
      assert.notEqual(entry?.commandTemplates[0]?.command, "sema interativo planejar <definition.json> --json");
      assert.ok(entry?.commandTemplates[0]?.command.startsWith("sema interativo "));
      assert.ok(entry?.requiredInputs.every((item) => item.startsWith("<")));
    } else {
      assert.deepEqual(entry?.requiredInputs, [`<definition.json> with pipelines including ${pipeline.pipelineId}`]);
      assert.equal(entry?.commandTemplates[0]?.command, "sema interativo planejar <definition.json> --json");
      assert.equal(entry?.commandTemplates[0]?.effectClass, "DECLARATIVE_PLANNING");
    }
  }
});

test("resumo do Agent Context deriva kinds e pipelines do mesmo registro", () => {
  const entries = montarCatalogoCapacidades().entries;
  const resumo = criarResumoDescobertaAgentContext();
  const pipelines = entries.filter((entry) => entry.kind === "ORCHESTRATION_PIPELINE");

  assert.equal(resumo.schemaVersion, "sema.discovery/v1");
  assert.equal(resumo.command, "sema descobrir catalogo --json");
  assert.deepEqual(resumo.pipelinesPrincipais.map((item) => item.id), pipelines.map((item) => item.id));
  assert.ok(resumo.pipelinesPrincipais.every((item) => (
    item.command === entries.find((entry) => entry.id === item.id)?.commandTemplates[0]?.command
  )));
  assert.ok(resumo.kinds.includes("PROFILE_GATE"));
  assert.ok(resumo.kinds.includes("ADAPTER"));
  assert.equal(resumo.commands.recomendar, "sema descobrir recomendar --intencao <texto> --json");
});

test("filtros por kind, id e domínio são determinísticos", () => {
  const profile = montarCatalogoCapacidades({ kind: "profile-gate", id: "profile.game" });
  assert.deepEqual(profile.entries.map((entry) => entry.id), ["profile.game"]);

  const generators = montarCatalogoCapacidades({ kind: "GENERATOR", domain: "geração" });
  assert.equal(generators.entries.length, 10);
  assert.ok(generators.entries.every((entry) => entry.kind === "GENERATOR"));
});
