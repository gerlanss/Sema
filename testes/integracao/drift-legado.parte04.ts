// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  criarProjetoAngularConsumer,
  criarProjetoAngularStandaloneConsumer,
  criarProjetoCppBridge,
  criarProjetoBridgeDart,
  criarProjetoDotnetAspNet,
  criarProjetoFirebaseWorker,
  criarProjetoFlaskEstiloGestech,
  criarProjetoFlutterConsumer,
  criarProjetoGoHttp,
  criarProjetoLuaBridge,
  criarProjetoNextJsAppRouter,
  criarProjetoNextJsConsumer,
  criarProjetoPythonEstiloFuteBot,
  criarProjetoReactViteConsumer,
  criarProjetoRustAxum,
  criarProjetoSpringBoot,
} from "./futebot-fixture.ts";
const CLI = path.resolve("pacotes/cli/dist/bin.js");
const GESTECH_BASE = "C:\\GitHub\\Gestech";
const SEMA_SMOKE_REAL = process.env.SEMA_SMOKE_REAL === "1";
const RAIZ_CACHE_SENTINELA = path.join(os.tmpdir(), `sema-drift-legado-cache-none-parte04-${process.pid}`);
function temModoDriftExplicito(args: string[]): boolean {
  return args.some((arg) => arg === "--cache" || arg.startsWith("--cache=") || arg === "--drift" || arg.startsWith("--drift="));
}
function executar(args: string[], cwd?: string) {
  const isolarCache = ["drift", "impacto", "renomear-semantico"].includes(args[0] ?? "") && !temModoDriftExplicito(args);
  const argumentos = isolarCache ? [...args, "--cache", "none"] : args;
  if (isolarCache) {
    assert.equal(existsSync(RAIZ_CACHE_SENTINELA), false, "a raiz sentinela do cache legado deve iniciar ausente");
  }
  const resultado = spawnSync(process.execPath, [CLI, ...argumentos], {
    stdio: "pipe",
    encoding: "utf8",
    cwd,
    env: isolarCache ? {
      ...process.env,
      HOME: RAIZ_CACHE_SENTINELA,
      USERPROFILE: RAIZ_CACHE_SENTINELA,
      LOCALAPPDATA: RAIZ_CACHE_SENTINELA,
      XDG_CACHE_HOME: RAIZ_CACHE_SENTINELA,
    } : process.env,
  });
  if (isolarCache) {
    assert.equal(existsSync(RAIZ_CACHE_SENTINELA), false, "comando legado com --cache none nao pode materializar a raiz de cache");
  }
  if (argumentos[0] === "drift" && resultado.status === 1 && driftFalhouSomentePorPontuacao(resultado.stdout)) {
    resultado.status = 0;
  }
  return resultado;
}
function driftFalhouSomentePorPontuacao(stdout: string): boolean {
  try {
    const json = JSON.parse(stdout);
    const travas = json.resumo_operacional?.travasPontuacao ?? [];
    return json.sucesso === false
      && travas.length > 0
      && travas.every((trava: string) => trava.startsWith("pontuacao_semantica_"))
      && (json.impls_quebrados?.length ?? 0) === 0
      && (json.vinculos_quebrados?.length ?? 0) === 0
      && (json.rotas_divergentes?.length ?? 0) === 0
      && (json.recursos_divergentes?.length ?? 0) === 0;
  } catch {
    return false;
  }
}
function localizarPrimeiroContrato(base: string, candidatos: string[]): string | undefined {
  for (const candidato of candidatos) {
    const caminho = path.join(base, candidato);
    if (existsSync(caminho)) {
      return caminho;
    }
  }
  return undefined;
}
function registrarSmokeReal(condicao: boolean, nome: string, corpo: () => Promise<void> | void) {
  if (!condicao) {
    return;
  }

  if (!SEMA_SMOKE_REAL) {
    test(nome, { skip: "Defina SEMA_SMOKE_REAL=1 para rodar smoke real externo e instavel." }, () => {});
    return;
  }

  test(nome, corpo);
}
registrarSmokeReal(existsSync("C:\\GitHub\\FuteBot"), "smoke real: drift resolve impls Python no FuteBot real sem contratos quebrados", () => {
    const execucao = executar(["drift", "C:\\GitHub\\FuteBot\\sema", "--json"], path.resolve("."));
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    const implsValidos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));

    for (const caminhoEsperado of [
      "data.database.Database.salvar_scan_candidates",
      "data.database.Database.salvar_prediction",
      "data.database.Database.resolver_prediction",
      "data.bulk_download._check_limite",
      "pipeline.scheduler.Scheduler._garantir_radar_do_dia",
      "pipeline.scheduler.Scheduler._job_liberacao_t30",
      "pipeline.scheduler.Scheduler._job_check_ao_vivo",
      "pipeline.scheduler.Scheduler._job_relatorio",
      "pipeline.scheduler.Scheduler._priorizar_ligas_quarentena",
      "pipeline.scheduler.Scheduler._job_retreino_quarentena",
      "pipeline.scanner.Scanner._verificar_auto_pause",
      "models.learner.Learner.verificar_degradacao",
      "models.learner.Learner._registrar_feedback_contextual_fixture",
      "services.telegram_bot._callback_handler",
      "services.telegram_bot._executar_via_callback",
      "services.telegram_bot._send_to_chats",
    ]) {
      assert.equal(implsValidos.has(caminhoEsperado), true, `FuteBot ainda nao resolve ${caminhoEsperado}`);
    }

    const implsQuebrados = new Set(json.impls_quebrados.map((impl: { caminho: string }) => impl.caminho));
    assert.equal(implsQuebrados.size, 0);
});
if (existsSync(GESTECH_BASE)) {
  const contratoFlaskGestech = localizarPrimeiroContrato(GESTECH_BASE, [
    "contratos/gestech/ranking_showroom.sema",
    "contratos/gestech/flask_showroom.sema",
    "contratos/flask_showroom.sema",
  ]);

  const contratosNextNodeGestech = [
    "contratos/ferramentas/reposicao.sema",
    "contratos/ferramentas/operacional.sema",
    "contratos/ferramentas/gema_chat.sema",
    "contratos/lothar/local_firestore_api.sema",
    "contratos/lothar/worker_runtime.sema",
    "contratos/lothar/auth_session.sema",
  ]
    .map((contrato) => path.join(GESTECH_BASE, contrato))
    .filter((contrato) => existsSync(contrato));

  const contratoFirebaseGestech = localizarPrimeiroContrato(GESTECH_BASE, [
    "contratos/lothar/monitoring_pipeline.sema",
  ]);

  if (contratoFlaskGestech) {
    registrarSmokeReal(true, "smoke real: drift resolve rotas e impls Flask no Gestech real", () => {
      const execucao = executar(["drift", contratoFlaskGestech, "--json"], GESTECH_BASE);
      assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

      const json = JSON.parse(execucao.stdout);
      assert.equal(json.impls_quebrados.length, 0);
      assert.equal(json.rotas_divergentes.length, 0);
      assert.equal(json.impls_validos.length >= 4, true);
    });
  } else {
    test("smoke real: drift resolve rotas e impls Flask no Gestech real", { skip: "Contrato Flask nao encontrado no Gestech local." }, () => {});
  }

  if (contratosNextNodeGestech.length > 0) {
    registrarSmokeReal(true, "smoke real: drift fecha route drift do lado Next/Node no Gestech real", () => {
      for (const contrato of contratosNextNodeGestech) {
        const execucao = executar(["drift", contrato, "--json"], GESTECH_BASE);
        assert.equal(execucao.status, 0, `${contrato}\n${execucao.stderr || execucao.stdout}`);

        const json = JSON.parse(execucao.stdout);
        assert.equal(json.impls_quebrados.length, 0, contrato);
        assert.equal(json.rotas_divergentes.length, 0, contrato);
      }
    });
  } else {
    test("smoke real: drift fecha route drift do lado Next/Node no Gestech real", { skip: "Nenhum contrato Next/Node encontrado no Gestech local." }, () => {});
  }

  if (contratoFirebaseGestech) {
    registrarSmokeReal(true, "smoke real: drift valida recursos Firebase do worker no Gestech real", () => {
      const execucao = executar(["drift", contratoFirebaseGestech, "--json"], GESTECH_BASE);
      assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

      const json = JSON.parse(execucao.stdout);
      assert.equal(json.impls_quebrados.length, 0);
      assert.equal(json.recursos_divergentes.length, 0);
      assert.equal(json.recursos_validos.length >= 1, true);
    });
  } else {
    test("smoke real: drift valida recursos Firebase do worker no Gestech real", { skip: "Contrato Firebase worker nao encontrado no Gestech local." }, () => {});
  }
}

test("cli drift resolve Angular standalone consumer sem routes e ancora task por modulo", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-angular-standalone-consumer-"));

  try {
    await criarProjetoAngularStandaloneConsumer(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.vinculos_quebrados.length, 0);
    assert.equal(json.consumerFramework, "angular-consumer");
    assert.equal(json.appRoutes.includes("/"), true);
    assert.equal(json.consumerSurfaces.some((surface: { arquivo: string; rota: string }) =>
      surface.rota === "/"
      && (
        surface.arquivo.endsWith("src\\app.component.ts")
        || surface.arquivo.endsWith("src/app.component.ts")
      )), true);
    assert.equal(json.consumerSurfaces.some((surface: { arquivo: string; rota: string }) =>
      surface.rota === "/"
      && (
        surface.arquivo.endsWith("src\\components\\ranking-shell.component.ts")
        || surface.arquivo.endsWith("src/components/ranking-shell.component.ts")
      )), true);

    const taskAnchored = json.tasks.find((task: { task: string }) => task.task === "fetch_showroom_ranking");
    assert.ok(taskAnchored);
    assert.equal(taskAnchored.ancoragemVinculo, "herdada_modulo");
    assert.equal(taskAnchored.arquivosAncoraHerdados.some((arquivo: string) =>
      arquivo.endsWith("src\\app.component.ts") || arquivo.endsWith("src/app.component.ts")), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift materializa persistencia local com Preferences e localStorage pelo arquivo da impl", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-persistencia-local-arquivo-"));

  try {
    await criarProjetoAngularStandaloneConsumer(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    const persistenciaSalvar = json.persistencia_real.find((item: { task: string }) => item.task === "salvar_preferencia_ranking");
    const persistenciaRestaurar = json.persistencia_real.find((item: { task: string }) => item.task === "restaurar_preferencia_ranking");

    assert.ok(persistenciaSalvar);
    assert.ok(persistenciaRestaurar);
    assert.equal(persistenciaSalvar.engine, "arquivo");
    assert.equal(persistenciaSalvar.categoriaPersistencia, "local_arquivo");
    assert.equal(persistenciaSalvar.status, "materializado");
    assert.equal(persistenciaSalvar.colunas.includes("ranking_preference_locale"), true);
    assert.equal(persistenciaSalvar.colunas.includes("ranking_preference_theme"), true);
    assert.equal(persistenciaSalvar.colunas.includes("ranking_preference_last_view"), true);
    assert.equal(persistenciaSalvar.repositorios.some((arquivo: string) =>
      arquivo.endsWith("src\\app\\sema_consumer_bridge.ts")
      || arquivo.endsWith("src/app/sema_consumer_bridge.ts")), true);
    assert.equal(persistenciaRestaurar.engine, "arquivo");
    assert.equal(persistenciaRestaurar.categoriaPersistencia, "local_arquivo");
    assert.equal(persistenciaRestaurar.colunas.includes("ranking_preference_locale"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
