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
const RAIZ_CACHE_SENTINELA = path.join(os.tmpdir(), `sema-drift-legado-cache-none-parte07-${process.pid}`);
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
  vinculos {
    arquivo: "src/workers/preview_worker.ts"
    arquivo: "src/repositories/campanhas.repository.ts"
    arquivo: "src/pages/preview.tsx"
    arquivo: "src/__tests__/preview.spec.ts"
  }

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
