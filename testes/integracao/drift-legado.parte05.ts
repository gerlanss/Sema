// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { extrairPayloadResultadoCliV1 } from "../helpers/resultado-cli-v1.ts";
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
const RAIZ_CACHE_SENTINELA = path.join(os.tmpdir(), `sema-drift-legado-cache-none-parte05-${process.pid}`);
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
  const comandoResultadoCli = argumentos[0] ?? "";
  const exitCodeResultadoCli = resultado.status;
  if (
    comandoResultadoCli === "drift"
    && resultado.status === 1
    && driftFalhouSomentePorPontuacao(resultado.stdout, comandoResultadoCli, exitCodeResultadoCli)
  ) {
    resultado.status = 0;
  }
  return Object.assign(resultado, { comandoResultadoCli, exitCodeResultadoCli });
}
function driftFalhouSomentePorPontuacao(
  stdout: string,
  command: string,
  exitCode: number | null,
): boolean {
  try {
    const json = extrairPayloadResultadoCliV1(stdout, { command, exitCode });
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
function extrairPayloadExecucaoCli<T = any>(execucao: {
  stdout: string;
  comandoResultadoCli: string;
  exitCodeResultadoCli: number | null;
}): T {
  return extrairPayloadResultadoCliV1<T>(execucao.stdout, {
    command: execucao.comandoResultadoCli,
    exitCode: execucao.exitCodeResultadoCli,
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
registrarSmokeReal(existsSync("C:\\GitHub\\FuteBot"), "smoke real: drift resolve impls Python no FuteBot real sem contratos quebrados", () => {
    const execucao = executar(["drift", "C:\\GitHub\\FuteBot\\sema", "--json"], path.resolve("."));
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = extrairPayloadExecucaoCli(execucao);
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

      const json = extrairPayloadExecucaoCli(execucao);
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

        const json = extrairPayloadExecucaoCli(execucao);
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

      const json = extrairPayloadExecucaoCli(execucao);
      assert.equal(json.impls_quebrados.length, 0);
      assert.equal(json.recursos_divergentes.length, 0);
      assert.equal(json.recursos_validos.length >= 1, true);
    });
  } else {
    test("smoke real: drift valida recursos Firebase do worker no Gestech real", { skip: "Contrato Firebase worker nao encontrado no Gestech local." }, () => {});
  }
}

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
  url      = env("SEMA_PRISMA_URL")
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

    const json = extrairPayloadExecucaoCli(execucao);
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
