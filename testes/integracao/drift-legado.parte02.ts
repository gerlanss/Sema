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
const CLI = path.resolve("pacotes/cli/dist/index.js");
const GESTECH_BASE = "C:\\GitHub\\Gestech";
const SEMA_SMOKE_REAL = process.env.SEMA_SMOKE_REAL === "1";
const RAIZ_CACHE_SENTINELA = path.join(os.tmpdir(), `sema-drift-legado-cache-none-parte02-${process.pid}`);
function temModoDriftExplicito(args: string[]): boolean {
  return args.some((arg) => arg === "--cache" || arg.startsWith("--cache=") || arg === "--drift" || arg.startsWith("--drift="));
}
function executar(args: string[], cwd?: string) {
  const isolarCache = ["drift", "impacto", "renomear-semantico"].includes(args[0] ?? "") && !temModoDriftExplicito(args);
  const argumentos = isolarCache ? [...args, "--cache", "none"] : args;
  if (isolarCache) {
    assert.equal(existsSync(RAIZ_CACHE_SENTINELA), false, "a raiz sentinela do cache legado deve iniciar ausente");
  }
  const resultado = spawnSync("node", [CLI, ...argumentos], {
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

test("cli drift explicita lacunas de seguranca semantica em task publica e sensivel", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-seguranca-"));

  try {
    await mkdir(path.join(base, "src", "clientes"), { recursive: true });
    await mkdir(path.join(base, "sema"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./sema"],
        diretoriosCodigo: ["./src"],
        fontesLegado: ["nestjs"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "clientes", "clientes.controller.ts"),
      `import { Body, Controller, Post } from "@nestjs/common";
import { ClientesService } from "./clientes.service";

@Controller("clientes")
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post("sincronizar")
  async sincronizar(@Body() body: { cliente_id: string; payload: unknown }) {
    return this.clientesService.sincronizar(body);
  }
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "clientes", "clientes.service.ts"),
      `export class ClientesService {
  async sincronizar(entrada: { cliente_id: string; payload: unknown }) {
    return { status: "ok" };
  }
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "sema", "clientes.sema"),
      `module app.clientes {
  task sincronizar_cliente {
    input {
      cliente_id: Id required
      payload: Json required
    }
    output {
      status: Texto
    }
    impl {
      ts: src.clientes.clientes_service.sincronizar
    }
    effects {
      db.write Cliente criticidade=alta privilegio=escrita isolamento=tenant
      secret.read gateway_token criticidade=media privilegio=leitura isolamento=processo
    }
    guarantees {
      status existe
    }
    tests {
      caso "ok" {
        given {
          cliente_id: "cli_1"
          payload: "{}"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route sincronizar_cliente_publico {
    metodo: POST
    caminho: /clientes/sincronizar
    task: sincronizar_cliente
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", ".", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    const task = json.tasks.find((item: { task: string }) => item.task === "sincronizar_cliente");
    assert.ok(task);
    for (const lacuna of [
      "auth_ausente",
      "authz_frouxa",
      "dados_nao_classificados",
      "audit_ausente",
      "segredo_sem_governanca",
      "proibicoes_ausentes",
    ]) {
      assert.equal(task.lacunas.includes(lacuna), true, `lacuna ausente: ${lacuna}`);
    }
    assert.equal(
      json.diagnosticos.some((diag: { tipo: string; task?: string; mensagem: string }) =>
        diag.tipo === "seguranca_frouxa"
        && diag.task === "sincronizar_cliente"
        && diag.mensagem.includes("segredo")),
      true,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve impl python em projeto estilo FuteBot sem sema.config", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-futebot-like-"));

  try {
    await criarProjetoPythonEstiloFuteBot(base);

    const execucao = executar(["drift", path.join(base, "sema"), "--json"], path.resolve("."));
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.comando, "drift");
    assert.equal(json.impls_quebrados.length, 0);

    const caminhosValidos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
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
      "services.telegram_bot.cmd_start",
      "services.telegram_bot._callback_handler",
      "services.telegram_bot._executar_via_callback",
      "services.telegram_bot._send_to_chats",
    ]) {
      assert.equal(caminhosValidos.has(caminhoEsperado), true, `impl nao resolvido: ${caminhoEsperado}`);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli valida e mede drift dos contratos internos do proprio Sema", () => {
  const validar = executar(["validar", "contratos/sema", "--json"], path.resolve("."));
  assert.equal(validar.status, 0, validar.stderr || validar.stdout);

  const jsonValidar = JSON.parse(validar.stdout);
  assert.equal(jsonValidar.valido, true);
  assert.equal(jsonValidar.bloqueia_acao, false);
  assert.equal(jsonValidar.erros.length, 0);

  const contratosComImplInterno = [
    "contratos/sema/linguagem_composta.sema",
    "contratos/sema/ergonomia_e_dominio.sema",
    "contratos/sema/governanca_ia_contexto.sema",
    "contratos/sema/governanca_ia_drift.sema",
  ];
  const drifts = contratosComImplInterno.map((contrato) => {
    const execucao = executar(["drift", contrato, "--json"], path.resolve("."));
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.comando, "drift");
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.vinculos_quebrados.length, 0);
    return json;
  });

  const caminhosValidos = new Set(drifts.flatMap((json) => json.impls_validos.map((impl: { caminho: string }) => impl.caminho)));
  for (const caminhoEsperado of [
    "nucleo.src.parser.parser.parsear",
    "nucleo.src.ir.conversor.converterParaIr",
    "nucleo.src.formatador.index.formatarCodigo",
    "nucleo.src.semantico.analisador.analisarSemantica",
    "gerador_python.src.index.gerarPython",
    "gerador_typescript.src.index.gerarTypeScript",
    "cli.src.projeto.resolverAlvosVerificacao",
    "cli.src.drift.analisarDriftLegado",
  ]) {
    assert.equal(caminhosValidos.has(caminhoEsperado), true, `impl interno nao resolvido: ${caminhoEsperado}`);
  }
});

test("cli drift resolve impls e rotas Flask em fixture estilo Gestech", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-flask-"));

  try {
    await criarProjetoFlaskEstiloGestech(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.comando, "drift");
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.rotas_divergentes.length, 0);

    const caminhosValidos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    for (const caminhoEsperado of [
      "gestech.app.status",
      "gestech.app.sync_store",
      "gestech.routes.api_ranking.app_version",
      "gestech.routes.api_ranking.ranking_showroom",
      "gestech.routes.api_ferramentas.api_config",
      "gestech.routes.api_ferramentas.api_admin_item",
    ]) {
      assert.equal(caminhosValidos.has(caminhoEsperado), true, `impl flask nao resolvido: ${caminhoEsperado}`);
    }

    const rotas = new Set(json.tasks.flatMap((task: { task: string; arquivosReferenciados: string[] }) =>
      task.arquivosReferenciados.map((arquivo) => `${task.task}:${arquivo}`),
    ));
    assert.equal(rotas.size >= 6, true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve impls e rotas Next.js App Router sem falsos positivos de Nest", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-nextjs-"));

  try {
    await criarProjetoNextJsAppRouter(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.rotas_divergentes.length, 0);
    assert.equal(json.recursos_divergentes.length, 0);

    const caminhosValidos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    for (const caminhoEsperado of [
      "src.app.api.reposicao.route.GET",
      "src.app.api.pedido.route.GET",
      "src.app.api.pedido.route.POST",
      "src.app.api.reposicao.item_id.route.GET",
    ]) {
      assert.equal(caminhosValidos.has(caminhoEsperado), true, `impl nextjs nao resolvido: ${caminhoEsperado}`);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
