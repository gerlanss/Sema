// SEMA-GOVERNED: sema.produto.descoberta_capacidades, sema.produto.sistemas_interativos.cli
// Descrição: smoke da CLI compilada para descoberta e planejamento declarativo de jogos e simulações.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const CLI = path.resolve("pacotes/cli/dist/index.js");

interface ExecucaoCli {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function executarCli(args: readonly string[]): ExecucaoCli {
  const resultado = spawnSync(process.execPath, [CLI, ...args], {
    cwd: path.resolve("."),
    encoding: "utf8",
    stdio: "pipe",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(resultado.error, undefined, resultado.error?.message);
  return resultado;
}

function diagnostico(execucao: ExecucaoCli): string {
  return `status=${execucao.status}\nstdout:\n${execucao.stdout}\nstderr:\n${execucao.stderr}`;
}

function executarJson(args: readonly string[], statusEsperado = 0): Record<string, any> {
  const execucao = executarCli([...args, "--json"]);
  assert.equal(execucao.status, statusEsperado, diagnostico(execucao));
  assert.notEqual(execucao.stdout.trim(), "", diagnostico(execucao));
  return JSON.parse(execucao.stdout) as Record<string, any>;
}

function provarFronteiraDescoberta(payload: Record<string, any>): void {
  assert.equal(payload.executed, false);
  assert.equal(payload.workspaceMutated, false);
  assert.equal(payload.externalCalls, false);
  assert.equal(payload.requiresExplicitRun, true);
}

function provarFronteiraInterativa(payload: Record<string, any>): void {
  assert.equal(payload.readOnly, true);
  assert.equal(payload.executed, false);
  assert.equal(payload.workspaceMutated, false);
  assert.equal(payload.authoritative, false);
  assert.equal(payload.externalExecutionRequired, true);
}

function definicaoSimulador3d(): Record<string, unknown> {
  return JSON.parse(readFileSync(
    path.resolve("exemplos/sistemas-interativos/simulation-3d-calibrated-autonomous.json"),
    "utf8",
  )) as Record<string, unknown>;
}

function protocoloReadOnlyValido(): Record<string, unknown> {
  const semanticTargetId = "simulador-climatico-3d/runtime";
  const fases = ["DETECT", "PROBE", "SNAPSHOT", "PLAN", "VALIDATE", "EVIDENCE"];
  return {
    runId: "run-read-only-001",
    adapterId: "validator.replay.local",
    adapterVersion: "1.0.0",
    semanticTargetId,
    phases: fases.map((phase, indice) => ({
      phaseId: `phase-${indice + 1}`,
      phase,
      semanticTargetId,
      inputDigest: `sha256:${String(indice + 1).repeat(64)}`,
      outputDigest: `sha256:${String(indice + 2).repeat(64)}`,
      success: true,
    })),
    mutated: false,
    success: true,
  };
}

test("help expõe descoberta, aliases e sistemas interativos", () => {
  const execucao = executarCli(["--help"]);
  assert.equal(execucao.status, 0, diagnostico(execucao));
  assert.match(execucao.stdout, /sema descobrir/u);
  assert.match(execucao.stdout, /sema pipeline/u);
  assert.match(execucao.stdout, /sema capabilities/u);
  assert.match(execucao.stdout, /sema interativo/u);
  assert.match(execucao.stdout, /sema interativo validar-ir/u);
  assert.match(execucao.stdout, /sema interativo analisar-portabilidade/u);
  assert.doesNotMatch(execucao.stdout, /--representation/u);
});

test("descoberta cataloga, recomenda em PT-BR e preserva aliases read-only", () => {
  const catalogo = executarJson(["descobrir", "catalogo"]);
  assert.equal(catalogo.success, true);
  assert.equal(catalogo.mode, "catalog");
  assert.ok(catalogo.entries.length > 0);
  assert.ok(catalogo.entries.some((item: { id: string }) => item.id === "simulation.calibrate"));
  provarFronteiraDescoberta(catalogo);

  const intencao = "simulador 3D autônomo calibrado";
  const recomendacao = executarJson(["descobrir", "recomendar", "--intencao", intencao]);
  assert.equal(recomendacao.success, true);
  assert.equal(recomendacao.mode, "ranking");
  assert.equal(recomendacao.intent, intencao);
  assert.equal(recomendacao.noMatch, false);
  assert.equal(recomendacao.recommendations[0]?.id, "simulation.calibrate");
  assert.ok(recomendacao.recommendations[0]?.score >= 60);
  provarFronteiraDescoberta(recomendacao);

  const pipelines = executarJson(["pipeline", "listar"]);
  assert.equal(pipelines.success, true);
  assert.ok(pipelines.entries.length > 0);
  assert.ok(pipelines.entries.every((item: { kind: string }) => item.kind === "ORCHESTRATION_PIPELINE"));
  assert.ok(pipelines.entries.some((item: { id: string }) => item.id === "simulation.calibrate"));
  provarFronteiraDescoberta(pipelines);

  const capabilities = executarJson(["capabilities"]);
  assert.equal(capabilities.success, true);
  assert.equal(capabilities.mode, "catalog");
  assert.deepEqual(
    capabilities.entries.map((item: { id: string }) => item.id),
    catalogo.entries.map((item: { id: string }) => item.id),
  );
  provarFronteiraDescoberta(capabilities);
});

test("interativo expõe catálogos e filtra adapters sem executar runtimes", () => {
  const capabilities = executarJson(["interativo", "capabilities"]);
  assert.equal(capabilities.sucesso, true);
  assert.equal(capabilities.runner, "external");
  assert.ok(capabilities.capabilities.length > 0);
  assert.ok(capabilities.pipelineIds.includes("simulation.calibrate"));
  provarFronteiraInterativa(capabilities);

  const pipelines = executarJson(["interativo", "pipelines"]);
  assert.equal(pipelines.sucesso, true);
  assert.ok(pipelines.pipelines.some((item: { pipelineId: string }) => item.pipelineId === "simulation.safety"));
  provarFronteiraInterativa(pipelines);

  const adapters = executarJson([
    "interativo",
    "adapters",
    "--spatial-model",
    "THREE_D",
    "--render-mode",
    "VISUAL",
    "--role",
    "ENGINE",
  ]);
  assert.equal(adapters.sucesso, true);
  assert.deepEqual(adapters.filtrosAplicados, { spatialModel: "THREE_D", renderMode: "VISUAL", role: "ENGINE" });
  assert.ok(adapters.adapters.length > 0);
  assert.ok(adapters.adapters.every((item: { role: string; spatialModels: string[]; renderModes: string[] }) => (
    item.role === "ENGINE"
      && item.spatialModels.includes("THREE_D")
      && item.renderModes.includes("VISUAL")
  )));
  provarFronteiraInterativa(adapters);
});

test("interativo valida e planeja definição e protocolo read-only por arquivos explícitos", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-interactive-cli-"));
  try {
    const definicaoArquivo = path.join(base, "definition.json");
    const protocoloArquivo = path.join(base, "adapter-run.json");
    await Promise.all([
      writeFile(definicaoArquivo, JSON.stringify(definicaoSimulador3d()), "utf8"),
      writeFile(protocoloArquivo, JSON.stringify(protocoloReadOnlyValido()), "utf8"),
    ]);

    const validacao = executarJson(["interativo", "validar", definicaoArquivo]);
    assert.equal(validacao.sucesso, true);
    assert.equal(validacao.valida, true);
    assert.deepEqual(validacao.bloqueios, []);
    provarFronteiraInterativa(validacao);

    const planejamento = executarJson(["interativo", "planejar", definicaoArquivo]);
    assert.equal(planejamento.sucesso, true);
    assert.deepEqual(planejamento.bloqueios, []);
    assert.deepEqual(planejamento.plano.capabilitiesAusentes, []);
    assert.equal(planejamento.plano.executed, false);
    assert.deepEqual(planejamento.plano.adaptersSelecionados, [
      "engine.godot",
      "telemetry.trace.local",
      "validator.replay.local",
    ]);
    assert.equal(planejamento.plano.adapterCoverageComplete, true);
    provarFronteiraInterativa(planejamento);

    const protocolo = executarJson(["interativo", "validar-protocolo", protocoloArquivo]);
    assert.equal(protocolo.sucesso, true);
    assert.equal(protocolo.valido, true);
    assert.equal(protocolo.faseAtual, "EVIDENCE");
    assert.equal(protocolo.exigeRollback, false);
    assert.deepEqual(protocolo.bloqueios, []);
    provarFronteiraInterativa(protocolo);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("erros desconhecidos e JSON inválido não ecoam caminho nem segredo controlado", async () => {
  const segredo = `ghp_${"X".repeat(40)}`;

  const desconhecido = executarJson(["interativo", segredo], 1);
  assert.equal(desconhecido.sucesso, false);
  assert.equal(desconhecido.errorCode, "INTERATIVO_SUBCOMANDO_DESCONHECIDO");
  assert.equal(JSON.stringify(desconhecido).includes(segredo), false);
  provarFronteiraInterativa(desconhecido);

  const descobertaDesconhecida = executarJson(["descobrir", segredo], 2);
  assert.equal(descobertaDesconhecida.success, false);
  assert.equal(JSON.stringify(descobertaDesconhecida).includes(segredo), false);
  provarFronteiraDescoberta(descobertaDesconhecida);

  const base = await mkdtemp(path.join(os.tmpdir(), "sema-interactive-cli-no-echo-"));
  try {
    const arquivoControlado = path.join(base, `definition-${segredo}.json`);
    await writeFile(arquivoControlado, `{"secret":"${segredo}"`, "utf8");

    const execucao = executarCli(["interativo", "validar", arquivoControlado, "--json"]);
    assert.equal(execucao.status, 1, diagnostico(execucao));
    const payload = JSON.parse(execucao.stdout) as Record<string, any>;
    const saidaCompleta = `${execucao.stdout}\n${execucao.stderr}`;
    assert.equal(payload.sucesso, false);
    assert.equal(payload.errorCode, "INTERATIVO_ENTRADA_INVALIDA");
    assert.equal(saidaCompleta.includes(segredo), false);
    assert.equal(saidaCompleta.includes(arquivoControlado), false);
    provarFronteiraInterativa(payload);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("descoberta redige caminho e segredo também em resposta de sucesso", () => {
  const segredo = `sk_${"Y".repeat(32)}`;
  const caminho = "C:\\Users\\alice\\private.json";
  const execucao = executarCli([
    "descobrir",
    "recomendar",
    "--intencao",
    `simulador calibrado Bearer ${segredo} ${caminho}`,
    "--json",
  ]);
  assert.equal(execucao.status, 0, diagnostico(execucao));
  assert.doesNotMatch(`${execucao.stdout}\n${execucao.stderr}`, /alice|Bearer|sk_/u);
  const payload = JSON.parse(execucao.stdout) as Record<string, any>;
  assert.equal(payload.intent, "[REDACTED]");
  assert.equal(payload.recommendations[0]?.id, "simulation.calibrate");
  provarFronteiraDescoberta(payload);
});
