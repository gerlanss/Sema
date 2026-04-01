import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const CLI = path.resolve("pacotes/cli/dist/index.js");
const SHOWCASE = path.resolve("showcases", "ranking-showroom");
const SHOWCASE_CONSUMER = path.resolve("showcases", "ranking-showroom-consumer");
const SHOWCASE_REACT_VITE_CONSUMER = path.resolve("showcases", "ranking-showroom-react-vite-consumer");
const SHOWCASE_ANGULAR_CONSUMER = path.resolve("showcases", "ranking-showroom-angular-consumer");
const SHOWCASE_FLUTTER_CONSUMER = path.resolve("showcases", "ranking-showroom-flutter-consumer");
const SHOWCASE_STACK_NEXTJS = path.resolve("showcases", "ranking-showroom-stack-nextjs");
const SHOWCASE_STACK_REACT_VITE = path.resolve("showcases", "ranking-showroom-stack-react-vite");
const SHOWCASE_STACK_ANGULAR = path.resolve("showcases", "ranking-showroom-stack-angular");
const SHOWCASE_STACK_FLUTTER = path.resolve("showcases", "ranking-showroom-stack-flutter");

function executar(args: string[], cwd = SHOWCASE) {
  return spawnSync("node", [CLI, ...args], {
    stdio: "pipe",
    encoding: "utf8",
    cwd,
  });
}

test("showcase oficial ranking-showroom valida, inspeciona, mede drift e gera contexto de IA", async () => {
  const pastaContexto = await mkdtemp(path.join(os.tmpdir(), "sema-showcase-contexto-"));

  try {
    const validacao = executar(["validar", "contratos/ranking_showroom.sema", "--json"]);
    assert.equal(validacao.status, 0, validacao.stderr || validacao.stdout);

    const inspecao = executar(["inspecionar", ".", "--json"]);
    assert.equal(inspecao.status, 0, inspecao.stderr || inspecao.stdout);
    const jsonInspecao = JSON.parse(inspecao.stdout);
    assert.equal(path.resolve(jsonInspecao.configuracao.baseProjeto), SHOWCASE);
    assert.equal(jsonInspecao.configuracao.fontesLegado.includes("flask"), true);
    assert.equal(jsonInspecao.configuracao.diretoriosCodigo.some((item: string) => item.endsWith(path.join("ranking-showroom", "backend-flask"))), true);
    assert.equal(typeof jsonInspecao.configuracao.scoreDrift, "number");

    const drift = executar(["drift", "contratos/ranking_showroom.sema", "--json"]);
    assert.equal(drift.status, 0, drift.stderr || drift.stdout);
    const jsonDrift = JSON.parse(drift.stdout);
    assert.equal(jsonDrift.impls_quebrados.length, 0);
    assert.equal(jsonDrift.vinculos_quebrados.length, 0);
    assert.equal(jsonDrift.rotas_divergentes.length, 0);
    assert.equal(jsonDrift.impls_validos.length, 3);

    const impls = new Set(jsonDrift.impls_validos.map((impl: { caminho: string }) => impl.caminho));
    for (const caminhoEsperado of [
      "showcase_app.routes.api_ranking.ranking_showroom",
      "showcase_app.routes.api_ranking.ranking_item",
      "showcase_app.routes.api_ranking.sync_ranking",
    ]) {
      assert.equal(impls.has(caminhoEsperado), true, `impl do showcase nao resolvido: ${caminhoEsperado}`);
    }

    const contexto = executar([
      "contexto-ia",
      "contratos/ranking_showroom.sema",
      "--saida",
      pastaContexto,
      "--json",
    ]);
    assert.equal(contexto.status, 0, contexto.stderr || contexto.stdout);

    assert.equal(existsSync(path.join(pastaContexto, "ast.json")), true);
    assert.equal(existsSync(path.join(pastaContexto, "ir.json")), true);
    assert.equal(existsSync(path.join(pastaContexto, "drift.json")), true);
    assert.equal(existsSync(path.join(pastaContexto, "briefing.json")), true);

    const driftContexto = JSON.parse(await readFile(path.join(pastaContexto, "drift.json"), "utf8"));
    assert.equal(driftContexto.drift.impls_quebrados.length, 0);
    assert.equal(driftContexto.drift.rotas_divergentes.length, 0);

    const briefing = JSON.parse(await readFile(path.join(pastaContexto, "briefing.json"), "utf8"));
    assert.equal(Array.isArray(briefing.oQueTocar), true);
    assert.equal(Array.isArray(briefing.oQueValidar), true);
  } finally {
    await rm(pastaContexto, { recursive: true, force: true });
  }
});

test("showcase oficial ranking-showroom-consumer valida, inspeciona, mede drift e gera contexto de IA", async () => {
  const pastaContexto = await mkdtemp(path.join(os.tmpdir(), "sema-showcase-consumer-contexto-"));

  try {
    const validacao = executar(["validar", "contratos/showroom_consumer.sema", "--json"], SHOWCASE_CONSUMER);
    assert.equal(validacao.status, 0, validacao.stderr || validacao.stdout);

    const inspecao = executar(["inspecionar", ".", "--json"], SHOWCASE_CONSUMER);
    assert.equal(inspecao.status, 0, inspecao.stderr || inspecao.stdout);
    const jsonInspecao = JSON.parse(inspecao.stdout);
    assert.equal(path.resolve(jsonInspecao.configuracao.baseProjeto), SHOWCASE_CONSUMER);
    assert.equal(jsonInspecao.configuracao.fontesLegado.includes("nextjs-consumer"), true);
    assert.equal(jsonInspecao.configuracao.consumerFramework, "nextjs-consumer");
    assert.equal(jsonInspecao.configuracao.appRoutes.includes("/ranking"), true);

    const drift = executar(["drift", "contratos/showroom_consumer.sema", "--json"], SHOWCASE_CONSUMER);
    assert.equal(drift.status, 0, drift.stderr || drift.stdout);
    const jsonDrift = JSON.parse(drift.stdout);
    assert.equal(jsonDrift.impls_quebrados.length, 0);
    assert.equal(jsonDrift.vinculos_quebrados.length, 0);
    assert.equal(jsonDrift.consumerFramework, "nextjs-consumer");
    assert.equal(jsonDrift.appRoutes.includes("/ranking"), true);

    const contexto = executar([
      "contexto-ia",
      "contratos/showroom_consumer.sema",
      "--saida",
      pastaContexto,
      "--json",
    ], SHOWCASE_CONSUMER);
    assert.equal(contexto.status, 0, contexto.stderr || contexto.stdout);

    assert.equal(existsSync(path.join(pastaContexto, "drift.json")), true);
    assert.equal(existsSync(path.join(pastaContexto, "briefing.json")), true);

    const driftContexto = JSON.parse(await readFile(path.join(pastaContexto, "drift.json"), "utf8"));
    assert.equal(driftContexto.drift.consumerFramework, "nextjs-consumer");
    assert.equal(driftContexto.drift.appRoutes.includes("/ranking"), true);

    const briefing = JSON.parse(await readFile(path.join(pastaContexto, "briefing.json"), "utf8"));
    assert.equal(briefing.consumerFramework, "nextjs-consumer");
    assert.equal(briefing.appRoutes.includes("/ranking"), true);
    assert.equal(briefing.consumerBridges.some((item: string) => item === "src.lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(pastaContexto, { recursive: true, force: true });
  }
});

test("showcase oficial ranking-showroom-react-vite-consumer valida, inspeciona, mede drift e gera contexto de IA", async () => {
  const pastaContexto = await mkdtemp(path.join(os.tmpdir(), "sema-showcase-react-vite-consumer-contexto-"));

  try {
    const validacao = executar(["validar", "contratos/showroom_consumer.sema", "--json"], SHOWCASE_REACT_VITE_CONSUMER);
    assert.equal(validacao.status, 0, validacao.stderr || validacao.stdout);

    const inspecao = executar(["inspecionar", ".", "--json"], SHOWCASE_REACT_VITE_CONSUMER);
    assert.equal(inspecao.status, 0, inspecao.stderr || inspecao.stdout);
    const jsonInspecao = JSON.parse(inspecao.stdout);
    assert.equal(jsonInspecao.configuracao.consumerFramework, "react-vite-consumer");
    assert.equal(jsonInspecao.configuracao.appRoutes.includes("/ranking"), true);

    const drift = executar(["drift", "contratos/showroom_consumer.sema", "--json"], SHOWCASE_REACT_VITE_CONSUMER);
    assert.equal(drift.status, 0, drift.stderr || drift.stdout);
    const jsonDrift = JSON.parse(drift.stdout);
    assert.equal(jsonDrift.consumerFramework, "react-vite-consumer");
    assert.equal(jsonDrift.appRoutes.includes("/ranking"), true);

    const contexto = executar([
      "contexto-ia",
      "contratos/showroom_consumer.sema",
      "--saida",
      pastaContexto,
      "--json",
    ], SHOWCASE_REACT_VITE_CONSUMER);
    assert.equal(contexto.status, 0, contexto.stderr || contexto.stdout);

    const briefing = JSON.parse(await readFile(path.join(pastaContexto, "briefing.json"), "utf8"));
    assert.equal(briefing.consumerFramework, "react-vite-consumer");
  } finally {
    await rm(pastaContexto, { recursive: true, force: true });
  }
});

test("showcase oficial ranking-showroom-angular-consumer valida, inspeciona, mede drift e gera contexto de IA", async () => {
  const pastaContexto = await mkdtemp(path.join(os.tmpdir(), "sema-showcase-angular-consumer-contexto-"));

  try {
    const validacao = executar(["validar", "contratos/showroom_consumer.sema", "--json"], SHOWCASE_ANGULAR_CONSUMER);
    assert.equal(validacao.status, 0, validacao.stderr || validacao.stdout);

    const inspecao = executar(["inspecionar", ".", "--json"], SHOWCASE_ANGULAR_CONSUMER);
    assert.equal(inspecao.status, 0, inspecao.stderr || inspecao.stdout);
    const jsonInspecao = JSON.parse(inspecao.stdout);
    assert.equal(jsonInspecao.configuracao.consumerFramework, "angular-consumer");
    assert.equal(jsonInspecao.configuracao.appRoutes.includes("/ranking"), true);

    const drift = executar(["drift", "contratos/showroom_consumer.sema", "--json"], SHOWCASE_ANGULAR_CONSUMER);
    assert.equal(drift.status, 0, drift.stderr || drift.stdout);
    const jsonDrift = JSON.parse(drift.stdout);
    assert.equal(jsonDrift.consumerFramework, "angular-consumer");
    assert.equal(jsonDrift.appRoutes.includes("/ranking"), true);

    const contexto = executar([
      "contexto-ia",
      "contratos/showroom_consumer.sema",
      "--saida",
      pastaContexto,
      "--json",
    ], SHOWCASE_ANGULAR_CONSUMER);
    assert.equal(contexto.status, 0, contexto.stderr || contexto.stdout);

    const briefing = JSON.parse(await readFile(path.join(pastaContexto, "briefing.json"), "utf8"));
    assert.equal(briefing.consumerFramework, "angular-consumer");
  } finally {
    await rm(pastaContexto, { recursive: true, force: true });
  }
});

test("showcase oficial ranking-showroom-flutter-consumer valida, inspeciona, mede drift e gera contexto de IA", async () => {
  const pastaContexto = await mkdtemp(path.join(os.tmpdir(), "sema-showcase-flutter-consumer-contexto-"));

  try {
    const validacao = executar(["validar", "contratos/showroom_consumer.sema", "--json"], SHOWCASE_FLUTTER_CONSUMER);
    assert.equal(validacao.status, 0, validacao.stderr || validacao.stdout);

    const inspecao = executar(["inspecionar", ".", "--json"], SHOWCASE_FLUTTER_CONSUMER);
    assert.equal(inspecao.status, 0, inspecao.stderr || inspecao.stdout);
    const jsonInspecao = JSON.parse(inspecao.stdout);
    assert.equal(jsonInspecao.configuracao.consumerFramework, "flutter-consumer");
    assert.equal(jsonInspecao.configuracao.appRoutes.includes("/ranking"), true);

    const drift = executar(["drift", "contratos/showroom_consumer.sema", "--json"], SHOWCASE_FLUTTER_CONSUMER);
    assert.equal(drift.status, 0, drift.stderr || drift.stdout);
    const jsonDrift = JSON.parse(drift.stdout);
    assert.equal(jsonDrift.consumerFramework, "flutter-consumer");
    assert.equal(jsonDrift.appRoutes.includes("/ranking"), true);
    assert.equal(jsonDrift.consumerBridges.some((item: { caminho: string }) => item.caminho === "lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);

    const contexto = executar([
      "contexto-ia",
      "contratos/showroom_consumer.sema",
      "--saida",
      pastaContexto,
      "--json",
    ], SHOWCASE_FLUTTER_CONSUMER);
    assert.equal(contexto.status, 0, contexto.stderr || contexto.stdout);

    const briefing = JSON.parse(await readFile(path.join(pastaContexto, "briefing.json"), "utf8"));
    assert.equal(briefing.consumerFramework, "flutter-consumer");
    assert.equal(briefing.consumerBridges.some((item: string) => item === "lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(pastaContexto, { recursive: true, force: true });
  }
});

test("showcases stack combinados ligam backend Flask + consumers oficiais na mesma raiz", () => {
  const stacks = [
    { root: SHOWCASE_STACK_NEXTJS, consumer: "nextjs-consumer" },
    { root: SHOWCASE_STACK_REACT_VITE, consumer: "react-vite-consumer" },
    { root: SHOWCASE_STACK_ANGULAR, consumer: "angular-consumer" },
    { root: SHOWCASE_STACK_FLUTTER, consumer: "flutter-consumer" },
  ];

  for (const stack of stacks) {
    const inspecao = executar(["inspecionar", ".", "--json"], stack.root);
    assert.equal(inspecao.status, 0, inspecao.stderr || inspecao.stdout);

    const jsonInspecao = JSON.parse(inspecao.stdout);
    assert.equal(jsonInspecao.configuracao.fontesLegado.includes("flask"), true);
    assert.equal(jsonInspecao.configuracao.fontesLegado.includes(stack.consumer), true);
    assert.equal(jsonInspecao.projeto.modulos.length >= 2, true);

    const drift = executar(["drift", "--json"], stack.root);
    assert.equal(drift.status, 0, drift.stderr || drift.stdout);

    const jsonDrift = JSON.parse(drift.stdout);
    assert.equal(jsonDrift.impls_quebrados.length, 0);
    assert.equal(jsonDrift.vinculos_quebrados.length, 0);
    assert.equal(jsonDrift.rotas_divergentes.length, 0);
  }
});
