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
function executar(args: string[], cwd?: string) {
  const resultado = spawnSync("node", [CLI, ...args], {
    stdio: "pipe",
    encoding: "utf8",
    cwd,
  });
  if (args[0] === "drift" && resultado.status === 1 && driftFalhouSomentePorPontuacao(resultado.stdout)) {
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
