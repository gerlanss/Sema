// SEMA-GOVERNED: sema.produto.sistemas_interativos.control_run
// Descricao: regressao adversarial do vinculo definicao-plano-pipeline-schema-evidencia-resultado.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  validarControlRunInterativo,
  type ManifestoControlRunInterativo,
} from "../../pacotes/cli/src/sistemasInterativos/controlRun.js";
import { executarComandoSistemasInterativos } from "../../pacotes/cli/src/sistemasInterativos/command.js";
import { executarExtensaoCliInterativa } from "../../pacotes/cli/src/sistemasInterativos/extensionCommand.js";
import { planejarSistemaInterativo } from "../../pacotes/cli/src/sistemasInterativos/planner.js";
import type { DefinicaoSistemaInterativo } from "../../pacotes/cli/src/sistemasInterativos/types.js";

const BASE = "exemplos/sistemas-interativos/advanced";

async function json<T>(arquivo: string): Promise<T> {
  return JSON.parse(await readFile(arquivo, "utf8")) as T;
}

async function contextoValido() {
  const [manifesto, definicao, contrato, evidencia] = await Promise.all([
    json<ManifestoControlRunInterativo>(`${BASE}/control-run-valid.json`),
    json<DefinicaoSistemaInterativo>(`${BASE}/control-run-definition-valid.json`),
    json<unknown>(`${BASE}/temporal-valid.json`),
    json<unknown>(`${BASE}/temporal-evidence-valid.json`),
  ]);
  const planejamento = planejarSistemaInterativo(definicao);
  assert.deepEqual(planejamento.bloqueios, []);
  const execucao = await executarExtensaoCliInterativa([
    "validar-evidencia-temporal",
    `${BASE}/temporal-valid.json`,
    "--bundle-arquivo",
    `${BASE}/temporal-evidence-valid.json`,
    "--json",
  ]);
  assert.ok(execucao);
  assert.equal(execucao.exitCode, 0);
  return {
    manifesto,
    artefatos: {
      definicao,
      plano: planejamento.plano,
      contrato,
      entradas: [contrato, evidencia],
      evidencia,
      resultado: execucao.payload,
    },
  };
}

test("control run liga toda a cadeia e permanece local nao autoritativo", async () => {
  const contexto = await contextoValido();
  const resultado = validarControlRunInterativo(contexto.manifesto, contexto.artefatos);
  assert.equal(resultado.valid, true, resultado.issues.join(","));
  assert.equal(resultado.bindings.length, 8);
  assert.equal(resultado.bindings.every((binding) => binding.matched), true);
  assert.match(resultado.controlRunDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.equal(resultado.completed, false);
  assert.equal(resultado.localCoverageComplete, true);
  assert.equal(resultado.awaitingExternalAttestation, true);
  assert.equal(resultado.executed, false);
  assert.equal(resultado.workspaceMutated, false);
  assert.equal(resultado.authoritative, false);
});

test("nao aceita evidencia correta de outro run ou outro sistema", async () => {
  const contexto = await contextoValido();
  const evidencia = {
    ...(contexto.artefatos.evidencia as Record<string, unknown>),
    runId: "run.temporal.outro",
    systemId: "outro.sistema",
  };
  const resultado = validarControlRunInterativo(contexto.manifesto, {
    ...contexto.artefatos,
    entradas: [contexto.artefatos.entradas[0], evidencia],
    evidencia,
  });
  assert.equal(resultado.valid, false);
  assert.ok(resultado.issues.includes("evidencia_run_id_divergente"));
  assert.ok(resultado.issues.includes("evidencia_system_id_divergente"));
  assert.equal(resultado.localCoverageComplete, false);
});

test("pipeline, plano, schema e resultado nao podem ser trocados isoladamente", async () => {
  const contexto = await contextoValido();
  const manifesto = { ...contexto.manifesto, pipelineId: "interactive.shot_validate" };
  const resultado = validarControlRunInterativo(manifesto, {
    ...contexto.artefatos,
    resultado: { ...(contexto.artefatos.resultado as Record<string, unknown>), executed: true },
  });
  assert.equal(resultado.valid, false);
  assert.ok(resultado.issues.includes("definicao_pipeline_ausente"));
  assert.ok(resultado.issues.includes("manifesto_validator_command_divergente"));
  assert.ok(resultado.issues.includes("resultado_executed_divergente"));
  assert.ok(resultado.issues.includes("manifesto_result_digest_divergente"));
});

test("manifesto estrito e no-echo rejeitam typo e segredo em valor", async () => {
  const contexto = await contextoValido();
  const segredo = "sk-proj-control-run-secret123";
  const manifesto = { ...contexto.manifesto, typoField: true };
  const evidencia = {
    ...(contexto.artefatos.evidencia as Record<string, unknown>),
    notes: [segredo],
  };
  const resultado = validarControlRunInterativo(manifesto, {
    ...contexto.artefatos,
    entradas: [contexto.artefatos.entradas[0], evidencia],
    evidencia,
  });
  assert.equal(resultado.valid, false);
  assert.ok(resultado.issues.includes("manifesto_campo_desconhecido"));
  assert.ok(resultado.issues.includes("control_run_contem_material_sensivel"));
  assert.doesNotMatch(JSON.stringify(resultado), new RegExp(segredo, "u"));
});

test("CLI validar-control-run exige e liga os seis artefatos declarados", async () => {
  const contexto = await contextoValido();
  const temporario = await mkdtemp(join(tmpdir(), "sema-control-run-"));
  const planFile = join(temporario, "plan.json");
  const resultFile = join(temporario, "result.json");
  try {
    await Promise.all([
      writeFile(planFile, JSON.stringify(contexto.artefatos.plano), "utf8"),
      writeFile(resultFile, JSON.stringify(contexto.artefatos.resultado), "utf8"),
    ]);
    const execucao = await executarComandoSistemasInterativos([
      "validar-control-run",
      `${BASE}/control-run-valid.json`,
      "--definition-arquivo", `${BASE}/control-run-definition-valid.json`,
      "--plano-arquivo", planFile,
      "--contrato-arquivo", `${BASE}/temporal-valid.json`,
      "--entrada-arquivo", `${BASE}/temporal-valid.json`,
      "--entrada-auxiliar-arquivo", `${BASE}/temporal-evidence-valid.json`,
      "--evidencia-arquivo", `${BASE}/temporal-evidence-valid.json`,
      "--resultado-arquivo", resultFile,
      "--json",
    ]);
    assert.equal(execucao.exitCode, 0);
    assert.equal(execucao.payload.sucesso, true);
    assert.equal((execucao.payload.resultado as { valid?: boolean }).valid, true);
    assert.equal(execucao.payload.executed, false);
    assert.equal(execucao.payload.workspaceMutated, false);
  } finally {
    await rm(temporario, { recursive: true, force: true });
  }
});
