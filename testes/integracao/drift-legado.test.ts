import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  criarProjetoCppBridge,
  criarProjetoBridgeDart,
  criarProjetoDotnetAspNet,
  criarProjetoFirebaseWorker,
  criarProjetoFlaskEstiloGestech,
  criarProjetoGoHttp,
  criarProjetoNextJsAppRouter,
  criarProjetoPythonEstiloFuteBot,
  criarProjetoRustAxum,
  criarProjetoSpringBoot,
} from "./futebot-fixture.ts";

const CLI = path.resolve("pacotes/cli/dist/index.js");
const GESTECH_BASE = "C:\\GitHub\\Gestech";

function executar(args: string[], cwd?: string) {
  return spawnSync("node", [CLI, ...args], {
    stdio: "pipe",
    encoding: "utf8",
    cwd,
  });
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

test("cli drift detecta impl valido, impl quebrado, task sem impl e rota divergente", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-"));

  try {
    await mkdir(path.join(base, "src", "pedidos"), { recursive: true });
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
      path.join(base, "src", "pedidos", "pedidos.controller.ts"),
      `import { Body, Controller, Post } from "@nestjs/common";
import { PedidosService } from "./pedidos.service";

@Controller("pedidos")
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  async criar(@Body() body: { total: number; comprador_id: string }) {
    return this.pedidosService.criar(body);
  }
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "pedidos", "pedidos.service.ts"),
      `export class PedidosService {
  async criar(entrada: { total: number; comprador_id: string }) {
    return { pedido_id: "ped_1" };
  }
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "sema", "pedidos.sema"),
      `module app.pedidos {
  task criar_pedido {
    input {
      total: Decimal required
      comprador_id: Id required
    }
    output {
      pedido_id: Id
    }
    impl {
      ts: src.pedidos.pedidos_service.criar
    }
    guarantees {
      pedido_id existe
    }
    tests {
      caso "ok" {
        given {
          total: 10
          comprador_id: "cmp_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task cancelar_pedido {
    input {
      pedido_id: Id required
    }
    output {
      cancelado: Booleano
    }
    impl {
      ts: src.pedidos.pedidos_service.cancelar
    }
    tests {
      caso "ok" {
        given {
          pedido_id: "ped_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task revisar_manual {
    input {
      pedido_id: Id required
    }
    output {
      fila: Texto
    }
    tests {
      caso "ok" {
        given {
          pedido_id: "ped_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route criar_pedido_publico {
    metodo: POST
    caminho: /pedidos
    task: criar_pedido
  }

  route cancelar_pedido_publico {
    metodo: DELETE
    caminho: /pedidos
    task: cancelar_pedido
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 1, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.comando, "drift");
    assert.equal(json.modulos.length, 1);
    assert.equal(json.impls_validos.length, 1);
    assert.equal(json.impls_quebrados.length, 1);
    assert.equal(typeof json.resumo_operacional.scoreMedio, "number");
    assert.equal(["alta", "media", "baixa"].includes(json.resumo_operacional.confiancaGeral), true);
    assert.equal(json.rotas_divergentes.length, 1);
    assert.equal(json.tasks.some((task: { task: string; semImplementacao: boolean }) => task.task === "revisar_manual" && task.semImplementacao), true);
    assert.equal(json.impls_validos[0].arquivo.endsWith(path.join("src", "pedidos", "pedidos.service.ts")), true);
    assert.equal(json.impls_validos[0].simbolo, "criar");
    assert.equal(json.impls_validos[0].caminhoResolvido, "src.pedidos.pedidos_service.criar");
    assert.equal(json.impls_quebrados[0].candidatos.some((candidato: { caminho: string }) => candidato.caminho === "src.pedidos.pedidos_service.criar"), true);
    assert.equal(json.tasks.some((task: { task: string; arquivosReferenciados: string[] }) => task.task === "criar_pedido" && task.arquivosReferenciados.length === 1), true);
    assert.equal(json.tasks.some((task: { task: string; lacunas: string[] }) => task.task === "cancelar_pedido" && task.lacunas.includes("impl_quebrado")), true);
    assert.equal(json.diagnosticos.some((diag: { tipo: string }) => diag.tipo === "task_sem_impl"), true);
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
  assert.equal(jsonValidar.comando, "validar");
  assert.equal(jsonValidar.sucesso, true);
  assert.equal(jsonValidar.resultados.length >= 3, true);
  assert.equal(jsonValidar.resultados.every((resultado: { sucesso: boolean }) => resultado.sucesso), true);

  const drift = executar(["drift", "contratos/sema", "--json"], path.resolve("."));
  assert.equal(drift.status, 0, drift.stderr || drift.stdout);

  const jsonDrift = JSON.parse(drift.stdout);
  assert.equal(jsonDrift.comando, "drift");
  assert.equal(jsonDrift.impls_quebrados.length, 0);
  assert.equal(jsonDrift.vinculos_quebrados.length, 0);

  const caminhosValidos = new Set(jsonDrift.impls_validos.map((impl: { caminho: string }) => impl.caminho));
  for (const caminhoEsperado of [
    "nucleo.src.parser.parser.parsear",
    "nucleo.src.ir.conversor.converterParaIr",
    "nucleo.src.formatador.index.formatarCodigo",
    "nucleo.src.semantico.analisador.analisarSemantica",
    "gerador_python.src.index.gerarPython",
    "gerador_typescript.src.index.gerarTypeScript",
    "cli.src.projeto.carregarProjeto",
    "cli.src.projeto.normalizarEstruturaSaida",
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

test("cli drift resolve impls, rota worker e recursos Firebase em fixture sintetico", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-firebase-"));

  try {
    await criarProjetoFirebaseWorker(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.rotas_divergentes.length, 0);
    assert.equal(json.recursos_divergentes.length, 0);
    assert.equal(json.recursos_validos.some((recurso: { alvo: string }) => recurso.alvo === "telegram_sessions"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve bridge Dart consumidor sem gambiarra ad hoc", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-dart-"));

  try {
    await criarProjetoBridgeDart(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    const caminhosValidos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    assert.equal(caminhosValidos.has("lib.api.sema_contract_bridge.semaFetchShowroomRanking"), true);
    assert.equal(caminhosValidos.has("lib.api.sema_contract_bridge.semaCheckForUpdate"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve impls e rotas ASP.NET Core em fixture sintetico", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-dotnet-"));

  try {
    await criarProjetoDotnetAspNet(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.rotas_divergentes.length, 0);
    const caminhos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    assert.equal(caminhos.has("src.controllers.health_controller.HealthController.Get"), true);
    assert.equal(caminhos.has("src.minimal.program.Ping"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve impls e rotas Spring Boot em fixture sintetico", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-java-"));

  try {
    await criarProjetoSpringBoot(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.rotas_divergentes.length, 0);
    const caminhos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    assert.equal(caminhos.has("src.main.java.com.acme.health.health_controller.HealthController.show"), true);
    assert.equal(caminhos.has("src.main.java.com.acme.health.health_controller.HealthController.refresh"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve impls e rotas Go em fixture sintetico", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-go-"));

  try {
    await criarProjetoGoHttp(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.rotas_divergentes.length, 0);
    const caminhos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    assert.equal(caminhos.has("internal.routes.getHealth"), true);
    assert.equal(caminhos.has("internal.routes.refreshHealth"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve impls e rotas Rust Axum em fixture sintetico", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-rust-"));

  try {
    await criarProjetoRustAxum(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.rotas_divergentes.length, 0);
    const caminhos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    assert.equal(caminhos.has("src.handlers.health"), true);
    assert.equal(caminhos.has("src.handlers.refresh"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve impls C++ bridge sem prometer rota HTTP", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-cpp-"));

  try {
    await criarProjetoCppBridge(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.rotas_divergentes.length, 0);
    const caminhos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    assert.equal(caminhos.has("src.runtime.RuntimeBridge.processSnapshot"), true);
    assert.equal(caminhos.has("src.runtime.emitSignal"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

if (existsSync("C:\\GitHub\\FuteBot")) {
  test("smoke real: drift resolve impls Python no FuteBot real sem contratos quebrados", () => {
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
}

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
    test("smoke real: drift resolve rotas e impls Flask no Gestech real", () => {
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
    test("smoke real: drift fecha route drift do lado Next/Node no Gestech real", () => {
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
    test("smoke real: drift valida recursos Firebase do worker no Gestech real", () => {
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
