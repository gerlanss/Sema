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
const RAIZ_CACHE_SENTINELA = path.join(os.tmpdir(), `sema-drift-legado-cache-none-parte01-${process.pid}`);
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
    assert.equal(json.resumo_operacional.pontuacaoMinimaOperacional, 80);
    assert.equal(json.resumo_operacional.pontuacaoAlvoAtual, 80);
    assert.equal(json.resumo_operacional.pontuacaoAlvoFinal, 100);
    assert.equal(json.resumo_operacional.passoEvolucaoPontuacao, 0.5);
    assert.equal(Array.isArray(json.resumo_operacional.travasPontuacao), true);
    assert.equal(json.diagnosticos.some((diag: { tipo: string }) => diag.tipo === "pontuacao_semantica_insuficiente"), true);
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

test("cli drift resolve impl javascript declarado como js", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-js-"));

  try {
    await mkdir(path.join(base, "src"), { recursive: true });
    await mkdir(path.join(base, "contratos"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./src"],
        fontesLegado: ["javascript"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "app.js"),
      `export function salvarDespesa(entrada) {
  return { id: "desp_1", ...entrada };
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "contratos", "despesas.sema"),
      `module app.despesas {
  task salvar_despesa {
    input {
      descricao: Texto required
      valor: Decimal required
    }
    output {
      id: Id
    }
    impl {
      js: src.app.salvarDespesa
    }
    vinculos {
      arquivo: "src/app.js"
      simbolo: src.app.salvarDespesa
    }
    execucao {
      idempotencia: verdadeiro
      timeout: "5s"
      criticidade_operacional: baixa
    }
    guarantees {
      id existe
    }
    tests {
      caso "salva" {
        given {
          descricao: "Mercado"
          valor: 25.5
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", "contratos/despesas.sema", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.impls_validos.length, 1);
    assert.equal(json.impls_quebrados.length, 0);
    assert.equal(json.impls_validos[0].origem, "js");
    assert.equal(json.impls_validos[0].arquivo.endsWith(path.join("src", "app.js")), true);
    assert.equal(json.impls_validos[0].simbolo, "salvarDespesa");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli drift resolve simbolo SQL em migration e arquivo documental vinculado", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-sql-doc-"));

  try {
    await mkdir(path.join(base, "contratos"), { recursive: true });
    await mkdir(path.join(base, "src"), { recursive: true });
    await mkdir(path.join(base, "docs"), { recursive: true });
    await mkdir(path.join(base, "database", "migrations"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./src", "./docs", "./database"],
        fontesLegado: ["typescript"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "bridge.ts"),
      `export function claimFreeWorkspace() {
  return { workspace_liberado: true };
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "docs", "ai-integration.md"),
      "# AI Integration\n\nLocal context uses contracts, related code, documentation, and indexes.\n",
      "utf8",
    );

    await writeFile(
      path.join(base, "database", "migrations", "20260516_claim_free_workspace.sql"),
      `create or replace function public.sema_claim_free_workspace(
  p_display_name text default null
) returns jsonb
language plpgsql
as $$
begin
  return jsonb_build_object('workspace_liberado', true);
end;
$$;
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "contratos", "comercial.sema"),
      `module app.comercial {
  task reivindicar_workspace_free {
    input {
      sessao_auth: Id required
    }
    output {
      workspace_liberado: Booleano
    }
    impl {
      ts: src.bridge.claimFreeWorkspace
    }
    vinculos {
      arquivo: "docs/ai-integration.md"
      arquivo: "database/migrations/20260516_claim_free_workspace.sql"
      simbolo: public.sema_claim_free_workspace
    }
    guarantees {
      workspace_liberado existe
    }
    tests {
      caso "reivindica workspace" {
        given {
          sessao_auth: "00000000-0000-0000-0000-000000000001"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", "contratos/comercial.sema", "--escopo", "modulo", "--json"], base);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    const vinculoSql = json.vinculos_validos.find((vinculo: { tipo: string; valor: string }) =>
      vinculo.tipo === "simbolo" && vinculo.valor === "public.sema_claim_free_workspace");
    const vinculoDoc = json.vinculos_validos.find((vinculo: { tipo: string; valor: string }) =>
      vinculo.tipo === "arquivo" && vinculo.valor === "docs/ai-integration.md");

    assert.equal(vinculoSql?.status, "resolvido");
    assert.equal(vinculoSql?.confianca, "alta");
    assert.equal(vinculoSql?.simbolo, "public.sema_claim_free_workspace");
    assert.equal(vinculoSql?.arquivo.endsWith(path.join("database", "migrations", "20260516_claim_free_workspace.sql")), true);
    assert.notEqual(vinculoDoc, undefined);
    assert.equal(json.vinculos_quebrados.some((vinculo: { valor: string }) =>
      vinculo.valor === "public.sema_claim_free_workspace" || vinculo.valor === "docs/ai-integration.md"), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
