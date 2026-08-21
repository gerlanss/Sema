// SEMA-GOVERNED: sema.produto.cli_sessao
// Descricao: prova o comando sessao — envelope compacto, freshness por hash e gates.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verificarFrescorArtefatos } from "../../pacotes/cli/src/index.part04.js";

async function criarWorkspace(): Promise<string> {
  const base = await mkdtemp(path.join(tmpdir(), "sema-sessao-"));
  await mkdir(path.join(base, "contratos"), { recursive: true });
  await writeFile(path.join(base, "contratos", "app.sema"), "module teste.app {\n}\n", "utf8");
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
  }, null, 2), "utf8");
  await writeFile(path.join(base, "AGENTS.md"), "Documento de agente suficientemente longo para passar o gate de substancia.\n", "utf8");
  await writeFile(path.join(base, "README.md"), "Readme suficientemente longo para passar o gate de substancia.\n", "utf8");
  await mkdir(path.join(base, "docs"), { recursive: true });
  await writeFile(path.join(base, "docs", "README.md"), "Indice de docs suficientemente longo.\n", "utf8");
  return base;
}

test("freshness: fresco quando INDEX tem hash atual, stale apos mudanca", async () => {
  const base = await criarWorkspace();
  try {
    // sem INDEX: hashArtefato null, stale
    const antes = await verificarFrescorArtefatos(base);
    assert.equal(antes.fresco, false);
    assert.equal(antes.hashArtefato, null);
    assert.ok(antes.sugestao.includes("sync-codex"));

    // cria INDEX com hash atual
    await writeFile(path.join(base, "SEMA_INDEX.json"), JSON.stringify({
      comando: "resumo-projeto",
      hashContratos: antes.hashAtual,
    }, null, 2), "utf8");
    const fresco = await verificarFrescorArtefatos(base);
    assert.equal(fresco.fresco, true);
    assert.equal(fresco.hashArtefato, antes.hashAtual);

    // muda contrato: stale
    await writeFile(path.join(base, "contratos", "app.sema"), "module teste.app {\n  entity Nova {\n  }\n}\n", "utf8");
    const stale = await verificarFrescorArtefatos(base);
    assert.equal(stale.fresco, false);
    assert.notEqual(stale.hashAtual, stale.hashArtefato);
    assert.ok(stale.sugestao.includes("sync-codex"));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("freshness: hash muda quando contrato muda", async () => {
  const base = await criarWorkspace();
  try {
    const frescor1 = await verificarFrescorArtefatos(base);
    await writeFile(path.join(base, "contratos", "app.sema"), "module teste.app2 {\n}\n", "utf8");
    const frescor2 = await verificarFrescorArtefatos(base);
    assert.notEqual(frescor1.hashAtual, frescor2.hashAtual);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("freshness: hash deterministico para mesmos contratos", async () => {
  const base1 = await criarWorkspace();
  const base2 = await criarWorkspace();
  try {
    const f1 = await verificarFrescorArtefatos(base1);
    const f2 = await verificarFrescorArtefatos(base2);
    assert.equal(f1.hashAtual, f2.hashAtual);
  } finally {
    await rm(base1, { recursive: true, force: true });
    await rm(base2, { recursive: true, force: true });
  }
});
