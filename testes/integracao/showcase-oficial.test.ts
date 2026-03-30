import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const CLI = path.resolve("pacotes/cli/dist/index.js");
const SHOWCASE = path.resolve("showcases", "ranking-showroom");

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

    const drift = executar(["drift", "contratos/ranking_showroom.sema", "--json"]);
    assert.equal(drift.status, 0, drift.stderr || drift.stdout);
    const jsonDrift = JSON.parse(drift.stdout);
    assert.equal(jsonDrift.impls_quebrados.length, 0);
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

    const driftContexto = JSON.parse(await readFile(path.join(pastaContexto, "drift.json"), "utf8"));
    assert.equal(driftContexto.drift.impls_quebrados.length, 0);
    assert.equal(driftContexto.drift.rotas_divergentes.length, 0);
  } finally {
    await rm(pastaContexto, { recursive: true, force: true });
  }
});
