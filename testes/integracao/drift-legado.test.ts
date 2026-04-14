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
    assert.equal(json.tasks.some((task: { task: string; lacunas: string[] }) => task.task === "criar_pedido" && task.lacunas.includes("superficie_publica_sem_execucao")), true);
    assert.equal(json.diagnosticos.some((diag: { tipo: string }) => diag.tipo === "task_sem_impl"), true);
    assert.equal(json.diagnosticos.some((diag: { tipo: string; task?: string }) => diag.tipo === "seguranca_frouxa" && diag.task === "criar_pedido"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

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

test("cli drift resolve impls em JS browser-side definidos via Object.assign no prototype", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-object-assign-prototype-"));

  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "Gestech", "static"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./Gestech"],
        fontesLegado: ["typescript"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "Gestech", "static", "collaborators.js"),
      `Object.assign(VDW0018Dashboard.prototype, {
  async loadCollaboratorsList() {
    return true;
  },

  applyCollaboratorFilter() {
    return [];
  }
});
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "contratos", "colaboradores_dashboard.sema"),
      `module gestech.dashboard.colaboradores {
  task inicializar_aba_colaboradores {
    input {
      tab_id: Texto
    }
    output {
      carregado: Booleano
    }
    guarantees {
      carregado existe
    }
    impl {
      ts: static.collaborators.loadCollaboratorsList
    }
    tests {
      caso "ok" {
        given { tab_id: "#collaborators" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task filtrar_colaboradores_cliente {
    input {
      ids_selecionados: Lista
    }
    output {
      colaboradores_filtrados: Lista
    }
    guarantees {
      colaboradores_filtrados existe
    }
    impl {
      ts: static.collaborators.applyCollaboratorFilter
    }
    tests {
      caso "ok" {
        given { ids_selecionados: [58] }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);

    const caminhosValidos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    assert.equal(caminhosValidos.has("static.collaborators.loadCollaboratorsList"), true);
    assert.equal(caminhosValidos.has("static.collaborators.applyCollaboratorFilter"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift nao ignora a propria worktree ativa quando ela e a raiz do projeto", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-drift-worktree-ativa-"));
  const base = path.join(baseTemporaria, ".claude", "worktrees", "ativa");

  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "Gestech", "static"), { recursive: true });
    await mkdir(path.join(base, "Gestech", "routes"), { recursive: true });

    await writeFile(
      path.join(base, "contratos", "colaboradores_dashboard.sema"),
      `module gestech.dashboard.colaboradores {
  task carregar_colaboradores {
    input {
      empresa: Texto
    }
    output {
      colaboradores: Lista
    }
    guarantees {
      colaboradores existe
    }
    impl {
      py: routes.api_collaborators.colaboradores
    }
    tests {
      caso "ok" {
        given { empresa: "todas" }
        expect { sucesso: verdadeiro }
      }
    }
  }

  task inicializar_aba_colaboradores {
    input {
      tab_id: Texto
    }
    output {
      carregado: Booleano
    }
    guarantees {
      carregado existe
    }
    impl {
      ts: static.collaborators.loadCollaboratorsList
    }
    tests {
      caso "ok" {
        given { tab_id: "#collaborators" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "Gestech", "routes", "api_collaborators.py"),
      `def colaboradores():
    return {"colaboradores": []}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "Gestech", "static", "collaborators.js"),
      `Object.assign(VDW0018Dashboard.prototype, {
  async loadCollaboratorsList() {
    return true;
  }
});
`,
      "utf8",
    );

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);

    const caminhosValidos = new Set(json.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    assert.equal(caminhosValidos.has("routes.api_collaborators.colaboradores"), true);
    assert.equal(caminhosValidos.has("static.collaborators.loadCollaboratorsList"), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli drift resolve Next.js consumer com bridge e superficies App Router", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-nextjs-consumer-"));

  try {
    await criarProjetoNextJsConsumer(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.vinculos_quebrados.length, 0);
    assert.equal(json.consumerFramework, "nextjs-consumer");
    assert.equal(json.appRoutes.includes("/ranking"), true);
    assert.equal(json.consumerSurfaces.some((surface: { arquivo: string }) =>
      surface.arquivo.endsWith("src\\app\\ranking\\page.tsx")
      || surface.arquivo.endsWith("src/app/ranking/page.tsx")), true);
    assert.equal(json.consumerBridges.some((bridge: { caminho: string }) =>
      bridge.caminho === "src.lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve React Vite consumer com bridge e page surfaces", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-react-vite-consumer-"));

  try {
    await criarProjetoReactViteConsumer(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.vinculos_quebrados.length, 0);
    assert.equal(json.consumerFramework, "react-vite-consumer");
    assert.equal(json.appRoutes.includes("/ranking"), true);
    assert.equal(json.consumerBridges.some((bridge: { caminho: string }) =>
      bridge.caminho === "src.lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve Angular consumer com bridge, route config e component", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-angular-consumer-"));

  try {
    await criarProjetoAngularConsumer(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.vinculos_quebrados.length, 0);
    assert.equal(json.consumerFramework, "angular-consumer");
    assert.equal(json.appRoutes.includes("/ranking"), true);
    assert.equal(json.consumerSurfaces.some((surface: { arquivo: string }) =>
      surface.arquivo.endsWith("src\\app\\app.routes.ts")
      || surface.arquivo.endsWith("src/app/app.routes.ts")), true);
    assert.equal(json.consumerBridges.some((bridge: { caminho: string }) =>
      bridge.caminho === "src.app.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve Flutter consumer com bridge, router e screen", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-flutter-consumer-"));

  try {
    await criarProjetoFlutterConsumer(base);

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.vinculos_quebrados.length, 0);
    assert.equal(json.consumerFramework, "flutter-consumer");
    assert.equal(json.appRoutes.includes("/ranking"), true);
    assert.equal(json.consumerSurfaces.some((surface: { arquivo: string }) =>
      surface.arquivo.endsWith("lib\\router.dart")
      || surface.arquivo.endsWith("lib/router.dart")), true);
    assert.equal(json.consumerBridges.some((bridge: { caminho: string }) =>
      bridge.caminho === "lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
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

test("cli drift rastreia recursos reais de postgres, mysql, sqlite, mongodb e redis", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-db-engines-"));

  try {
    await mkdir(path.join(base, "src"), { recursive: true });
    await mkdir(path.join(base, "contratos"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./src"],
        fontesLegado: ["nestjs"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "postgres.ts"),
      `import { Pool } from "pg";

const postgresPool = new Pool();
const postgresSql = 'select id from pedidos where status = $1 returning id';

export function sincronizarPostgres() {
  return postgresPool.query(postgresSql);
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "mysql.ts"),
      `import mysql from "mysql2/promise";

const mysqlClient = mysql.createPool({ uri: "mysql://local" });
const mysqlSql = 'insert into faturamento (id, status) values (?, ?)';

export function sincronizarMysql() {
  return mysqlClient.query(mysqlSql);
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "sqlite.ts"),
      `import Database from "better-sqlite3";

const sqlite = new Database("local.db");
const sqliteSql = 'create table cache_local (id text primary key)';

export function sincronizarSqlite() {
  return sqlite.prepare(sqliteSql);
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "mongodb.ts"),
      `import { MongoClient } from "mongodb";

const mongo = new MongoClient("mongodb://localhost:27017");

export function sincronizarMongo() {
  return mongo.db("app").collection("pedidos").findOne({});
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "redis-cache.ts"),
      `import { createClient } from "redis";

const redis = createClient();

export function aquecerCacheRedis() {
  return redis.set(\`cache:pedidos:\${Date.now()}\`, "ok");
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "redis-stream.ts"),
      `import { createClient } from "redis";

const redis = createClient();

export function publicarEventoRedis() {
  return redis.xadd("eventos_pedido", "*", "evento", "pedido_criado");
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "schema.prisma"),
      `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Pedido {
  id String @id

  @@map("pedidos")
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "contratos", "persistencia_multi_engine.sema"),
      `module legado.persistencia.multi_engine {
  database principal_postgres {
    engine: postgres
    table pedidos {
      table: pedidos
      entity: Pedido
    }
  }

  database principal_mysql {
    engine: mysql
    table faturamento {
      table: faturamento
    }
  }

  database principal_sqlite {
    engine: sqlite
    table cache_local {
      table: cache_local
    }
  }

  database principal_mongodb {
    engine: mongodb
    collection pedidos_documentos {
      collection: pedidos
    }
  }

  database principal_redis {
    engine: redis
    keyspace cache_pedidos {
      path: "cache:pedidos"
    }
    stream eventos_pedido {
      surface: fila
    }
  }

  task sincronizar_postgres {
    output {
      ok: Booleano
    }
    effects {
      persiste pedidos criticidade = alta
    }
    impl {
      ts: src.postgres.sincronizarPostgres
    }
    guarantees {
      ok existe
    }
  }

  task sincronizar_mysql {
    output {
      ok: Booleano
    }
    effects {
      persiste faturamento criticidade = alta
    }
    impl {
      ts: src.mysql.sincronizarMysql
    }
    guarantees {
      ok existe
    }
  }

  task sincronizar_sqlite {
    output {
      ok: Booleano
    }
    effects {
      persiste cache_local criticidade = media
    }
    impl {
      ts: src.sqlite.sincronizarSqlite
    }
    guarantees {
      ok existe
    }
  }

  task sincronizar_mongodb {
    output {
      ok: Booleano
    }
    effects {
      persiste pedidos_documentos criticidade = alta
    }
    impl {
      ts: src.mongodb.sincronizarMongo
    }
    guarantees {
      ok existe
    }
  }

  task aquecer_cache_redis {
    output {
      ok: Booleano
    }
    effects {
      persiste cache_pedidos criticidade = media
    }
    impl {
      ts: src.redis_cache.aquecerCacheRedis
    }
    guarantees {
      ok existe
    }
  }

  task publicar_evento_redis {
    output {
      ok: Booleano
    }
    effects {
      persiste eventos_pedido criticidade = alta
    }
    impl {
      ts: src.redis_stream.publicarEventoRedis
    }
    guarantees {
      ok existe
    }
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.recursos_divergentes.length, 0);
    assert.equal(json.recursos_validos.some((recurso: { task: string; alvo: string; origem: string; tipo: string }) =>
      recurso.task === "sincronizar_postgres" && recurso.alvo === "pedidos" && recurso.origem === "postgres" && recurso.tipo === "table"), true);
    assert.equal(json.recursos_validos.some((recurso: { task: string; alvo: string; origem: string; tipo: string }) =>
      recurso.task === "sincronizar_mysql" && recurso.alvo === "faturamento" && recurso.origem === "mysql" && recurso.tipo === "table"), true);
    assert.equal(json.recursos_validos.some((recurso: { task: string; alvo: string; origem: string; tipo: string }) =>
      recurso.task === "sincronizar_sqlite" && recurso.alvo === "cache_local" && recurso.origem === "sqlite" && recurso.tipo === "table"), true);
    assert.equal(json.recursos_validos.some((recurso: { task: string; alvo: string; origem: string; tipo: string }) =>
      recurso.task === "sincronizar_mongodb" && recurso.alvo === "pedidos_documentos" && recurso.origem === "mongodb" && recurso.tipo === "collection"), true);
    assert.equal(json.recursos_validos.some((recurso: { task: string; alvo: string; origem: string; tipo: string }) =>
      recurso.task === "aquecer_cache_redis" && recurso.alvo === "cache_pedidos" && recurso.origem === "redis" && recurso.tipo === "keyspace"), true);
    assert.equal(json.recursos_validos.some((recurso: { task: string; alvo: string; origem: string; tipo: string }) =>
      recurso.task === "publicar_evento_redis" && recurso.alvo === "eventos_pedido" && recurso.origem === "redis" && recurso.tipo === "stream"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift ignora worktrees e consumidores laterais por padrao e inclui quando o escopo pede", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-worktrees-"));

  try {
    await mkdir(path.join(base, "src", "app", "pedidos"), { recursive: true });
    await mkdir(path.join(base, "src", "app", "ranking"), { recursive: true });
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, ".claude", "worktrees", "friendly", "src", "app", "externo"), { recursive: true });
    await mkdir(path.join(base, "showcases", "ranking", "src", "app", "externo"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["."],
        fontesLegado: ["nextjs-consumer", "typescript"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "pedidos_service.ts"),
      `export async function abrirPreview() {
  return { ok: true };
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "app", "pedidos", "page.tsx"),
      `export default function PedidosPage() {
  return <main>Pedidos</main>;
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "app", "ranking", "page.tsx"),
      `export default function RankingPage() {
  return <main>Ranking</main>;
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, ".claude", "worktrees", "friendly", "src", "app", "externo", "page.tsx"),
      `export default function ExternoPage() {
  return <main>Externo</main>;
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "showcases", "ranking", "src", "app", "externo", "page.tsx"),
      `export default function ShowcasePage() {
  return <main>Showcase</main>;
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "contratos", "pedidos.sema"),
      `module app.pedidos {
  task abrir_preview {
    output {
      ok: Booleano
    }
    impl {
      ts: src.pedidos_service.abrirPreview
    }
    guarantees {
      ok existe
    }
  }
}
`,
      "utf8",
    );

    const padrao = executar(["drift", "--json"], base);
    assert.equal(padrao.status, 0, padrao.stderr || padrao.stdout);
    const jsonPadrao = JSON.parse(padrao.stdout);
    assert.equal(jsonPadrao.consumerSurfaces.some((surface: { arquivo: string }) => /[\\/]src[\\/]app[\\/]pedidos[\\/]page\.tsx$/i.test(surface.arquivo)), true);
    assert.equal(jsonPadrao.consumerSurfaces.some((surface: { arquivo: string }) => /[\\/]src[\\/]app[\\/]ranking[\\/]page\.tsx$/i.test(surface.arquivo)), false);
    assert.equal(jsonPadrao.consumerSurfaces.some((surface: { arquivo: string }) => /(^|[\\/])\.claude[\\/]worktrees[\\/]/i.test(surface.arquivo)), false);
    assert.equal(jsonPadrao.consumerSurfaces.some((surface: { arquivo: string }) => /(^|[\\/])showcases[\\/]/i.test(surface.arquivo)), false);

    const amplo = executar(["drift", "--escopo", "projeto", "--incluir-worktrees", "--incluir-consumidores-laterais", "--json"], base);
    assert.equal(amplo.status, 0, amplo.stderr || amplo.stdout);
    const jsonAmplo = JSON.parse(amplo.stdout);
    assert.equal(jsonAmplo.consumerSurfaces.some((surface: { arquivo: string }) => /(^|[\\/])\.claude[\\/]worktrees[\\/]/i.test(surface.arquivo)), true);
    assert.equal(jsonAmplo.consumerSurfaces.some((surface: { arquivo: string }) => /(^|[\\/])showcases[\\/]/i.test(surface.arquivo)), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift em escopo de modulo nao deixa o prefixo do projeto poluir consumer surfaces", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "gestech-drift-escopo-"));
  const base = path.join(baseTemporaria, "gestech-fixture");

  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "Gestech", "routes"), { recursive: true });
    await mkdir(path.join(base, "Ferramentas", "src", "app", "whatsapp"), { recursive: true });
    await mkdir(path.join(base, "Ferramentas", "src", "app", "ranking"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./Gestech", "./Ferramentas"],
        fontesLegado: ["python", "nextjs-consumer"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "Gestech", "routes", "api_collaborators_whatsapp.py"),
      `from flask import Blueprint, jsonify

bp = Blueprint("whatsapp", __name__)

@bp.get("/whatsapp")
def list_whatsapp_contacts():
    return jsonify({"ok": True})
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "Ferramentas", "src", "app", "whatsapp", "page.tsx"),
      `export default function WhatsAppPage() {
  return <main>WhatsApp</main>;
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "Ferramentas", "src", "app", "ranking", "page.tsx"),
      `export default function RankingPage() {
  return <main>Ranking</main>;
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "contratos", "colaboradores_whatsapp.sema"),
      `module gestech.colaboradores.whatsapp {
  task listar_contatos_whatsapp {
    output {
      ok: Booleano
    }
    impl {
      py: routes.api_collaborators_whatsapp.list_whatsapp_contacts
    }
    guarantees {
      ok existe
    }
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", "--escopo", "modulo", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.consumerSurfaces.some((surface: { arquivo: string }) => /[\\/]src[\\/]app[\\/]whatsapp[\\/]page\.tsx$/i.test(surface.arquivo)), true);
    assert.equal(json.consumerSurfaces.some((surface: { arquivo: string }) => /[\\/]src[\\/]app[\\/]ranking[\\/]page\.tsx$/i.test(surface.arquivo)), false);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli impacto e renomeacao semantica apontam contrato, repositorio, UI e testes", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-impacto-"));

  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "src", "repositories"), { recursive: true });
    await mkdir(path.join(base, "src", "workers"), { recursive: true });
    await mkdir(path.join(base, "src", "pages"), { recursive: true });
    await mkdir(path.join(base, "src", "__tests__"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./src"],
        fontesLegado: ["react-vite-consumer", "typescript"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "contratos", "campanhas.sema"),
      `module app.campanhas {
  task gerar_preview {
    input {
      classificacao_atual: Texto required
    }
    output {
      classificacao_atual: Texto
    }
    impl {
      ts: src.workers.preview_worker.gerarPreview
    }
    guarantees {
      classificacao_atual existe
    }
  }
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "workers", "preview_worker.ts"),
      `export async function gerarPreview() {
  return { classificacao_atual: "A" };
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "repositories", "campanhas.repository.ts"),
      `export async function salvarCampanha() {
  return { classificacao_atual: "A" };
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "pages", "preview.tsx"),
      `export function PreviewPage() {
  return <div>{'classificacao_atual'}</div>;
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "__tests__", "preview.spec.ts"),
      `test("preview", () => {
  expect("classificacao_atual").toBe("classificacao_atual");
});
`,
      "utf8",
    );

    const impacto = executar(["impacto", "--alvo", "classificacao_atual", "--mudanca", "trocar classificacao_atual por ranking_geral e ranking_loja", "--json"], base);
    assert.equal(impacto.status, 0, impacto.stderr || impacto.stdout);
    const jsonImpacto = JSON.parse(impacto.stdout);
    assert.equal(jsonImpacto.arquivos.some((arquivo: { tipo: string }) => arquivo.tipo === "contrato"), true);
    assert.equal(jsonImpacto.arquivos.some((arquivo: { tipo: string }) => arquivo.tipo === "repositorio"), true);
    assert.equal(jsonImpacto.arquivos.some((arquivo: { tipo: string }) => arquivo.tipo === "ui"), true);
    assert.equal(jsonImpacto.arquivos.some((arquivo: { tipo: string }) => arquivo.tipo === "teste"), true);

    const renomeacao = executar(["renomear-semantico", "--de", "classificacao_atual", "--para", "ranking_geral", "--json"], base);
    assert.equal(renomeacao.status, 0, renomeacao.stderr || renomeacao.stdout);
    const jsonRenomeacao = JSON.parse(renomeacao.stdout);
    assert.equal(jsonRenomeacao.sugestoes.some((item: { atual: string; sugerido: string }) => item.atual === "classificacao_atual" && item.sugerido === "ranking_geral"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift materializa persistencia real com colunas, repositorio e compatibilidade por engine", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-persistencia-real-"));

  try {
    await mkdir(path.join(base, "src", "repositories"), { recursive: true });
    await mkdir(path.join(base, "db"), { recursive: true });
    await mkdir(path.join(base, "contratos"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./src", "./db"],
        fontesLegado: ["typescript"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "db", "schema.sql"),
      `create table pedidos (
  id uuid primary key,
  status text not null,
  ranking_geral integer
);
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "repositories", "pedidos.repository.ts"),
      `export async function salvarPedido() {
  const sql = "insert into pedidos (id, status, ranking_geral) values ($1, $2, $3)";
  return sql;
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "pedidos_service.ts"),
      `import { salvarPedido } from "./repositories/pedidos.repository";

export async function sincronizarPedidos() {
  return salvarPedido();
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "contratos", "pedidos.sema"),
      `module app.pedidos {
  database principal_postgres {
    engine: postgres
    table pedidos {
      table: pedidos
    }
  }

  task sincronizar_pedidos {
    output {
      ok: Booleano
    }
    effects {
      persistencia pedidos criticidade = alta
    }
    impl {
      ts: src.pedidos_service.sincronizarPedidos
    }
    guarantees {
      ok existe
    }
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    const persistencia = json.persistencia_real.find((item: { task: string; alvo: string }) => item.task === "sincronizar_pedidos" && item.alvo === "pedidos");
    assert.ok(persistencia);
    assert.equal(persistencia.status, "materializado");
    assert.equal(persistencia.compatibilidade, "nativo");
    assert.equal(persistencia.colunas.includes("ranking_geral"), true);
    assert.equal(persistencia.repositorios.some((arquivo: string) => /pedidos\.repository\.ts$/i.test(arquivo)), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift explicita persistencia local em arquivo sem fingir banco relacional", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-persistencia-arquivo-"));

  try {
    await mkdir(path.join(base, "Gestech", "repositories"), { recursive: true });
    await mkdir(path.join(base, "contratos"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./Gestech"],
        fontesLegado: ["python"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "Gestech", "repositories", "collaborator_whatsapp_store.py"),
      `import json
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "collaborators_whatsapp.json"

def _empty_store():
    return {
        "version": 1,
        "contacts": {},
        "campaigns": [],
        "deliveries": [],
        "worker_status": {},
    }

def upsert_contact_config():
    payload = _empty_store()
    _DATA_FILE.write_text(json.dumps(payload), encoding="utf-8")
    return payload
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "contratos", "colaboradores_whatsapp.sema"),
      `module gestech.colaboradores.whatsapp {
  entity ContatoWhatsAppColaborador {
    fields {
      id: Id
    }
  }

  task salvar_contato_whatsapp {
    output {
      ok: Booleano
    }
    impl {
      py: repositories.collaborator_whatsapp_store.upsert_contact_config
    }
    vinculos {
      arquivo: "Gestech/repositories/collaborator_whatsapp_store.py"
      simbolo: repositories.collaborator_whatsapp_store.upsert_contact_config
    }
    effects {
      persistencia ContatoWhatsAppColaborador criticidade = alta
    }
    guarantees {
      ok existe
    }
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    const persistencia = json.persistencia_real.find((item: { task: string; alvo: string }) =>
      item.task === "salvar_contato_whatsapp" && item.alvo === "ContatoWhatsAppColaborador");
    assert.ok(persistencia);
    assert.equal(persistencia.engine, "arquivo");
    assert.equal(persistencia.categoriaPersistencia, "local_arquivo");
    assert.equal(["materializado", "parcial"].includes(persistencia.status), true);
    assert.equal(persistencia.arquivos.some((arquivo: string) => /collaborator_whatsapp_store\.py$/i.test(arquivo)), true);
    assert.equal(persistencia.repositorios.some((arquivo: string) => /collaborator_whatsapp_store\.py$/i.test(arquivo)), true);
    assert.equal(persistencia.colunas.includes("contacts"), true);
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
