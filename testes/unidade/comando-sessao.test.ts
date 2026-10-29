// SEMA-GOVERNED: sema.produto.cli_sessao
// Descricao: prova o comando sessao — envelope compacto, freshness por hash e gates.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { verificarFrescorArtefatos } from "../../pacotes/cli/src/index.part04.js";
import { criarAgentContextPack, criarGuiaCapacidadeIa } from "../../pacotes/cli/src/agentContextPack.js";
import { renderizarInstrucaoCodexSema, renderizarSemaBoot, renderizarSemaSmallModel } from "../../pacotes/cli/src/agentBootstrap.js";
import { registrarMudanca } from "../../pacotes/cli/src/changeScope.js";

async function criarWorkspace(): Promise<string> {
  const base = await mkdtemp(path.join(tmpdir(), "sema-sessao-"));
  await mkdir(path.join(base, "contratos"), { recursive: true });
  await writeFile(path.join(base, "contratos", "app.sema"), "module teste.app {\n}\n", "utf8");
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
  }, null, 2), "utf8");
  const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
  await writeFile(path.join(base, "AGENTS.md"), `<!-- sema:agent-entrypoint:start -->\n${renderizarInstrucaoCodexSema(pack)}<!-- sema:agent-entrypoint:end -->\n`);
  await writeFile(path.join(base, "SEMA_BOOT.md"), renderizarSemaBoot(pack));
  await writeFile(path.join(base, "SEMA_SMALL_MODEL.md"), renderizarSemaSmallModel(pack));
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

test("protocolo antigo bloqueia mesmo com hash igual; sync preserva regras manuais", async () => {
  const base = await criarWorkspace();
  const cli = path.resolve("pacotes/cli/dist/bin.js");
  try {
    const antes = await verificarFrescorArtefatos(base);
    await writeFile(path.join(base, "SEMA_INDEX.json"), JSON.stringify({ hashContratos: antes.hashAtual }));
    const manual = "## Regras próprias\nPreserve os dados locais dos usuários.\n";
    await writeFile(path.join(base, "AGENTS.md"), `<!-- sema:agent-entrypoint:start -->\nLeia o SEMA_INDEX.json inteiro.\n<!-- sema:agent-entrypoint:end -->\n${manual}`);
    const stale = await verificarFrescorArtefatos(base);
    assert.equal(stale.contratosMudaram, false);
    assert.equal(stale.fresco, false);
    assert.deepEqual(stale.arquivosProtocoloDesatualizados, ["AGENTS.md"]);
    const session = spawnSync(process.execPath, [cli, "sessao", "Editar aplicação", "--janela-contexto", "32768", "--json"], { cwd: base, encoding: "utf8", timeout: 30_000 });
    const payload = JSON.parse(session.stdout).payload;
    assert.equal(payload.contexto, undefined);
    assert.equal(payload.execucaoAutorizada, false);
    assert.match(payload.proximosPassos.join(" "), /sync-codex/);
    const sync = spawnSync(process.execPath, [cli, "sync-codex", "--json"], { cwd: base, encoding: "utf8", timeout: 30_000 });
    assert.equal(sync.status, 0, sync.stdout + sync.stderr);
    const agents = await readFile(path.join(base, "AGENTS.md"), "utf8");
    assert.ok(agents.includes(manual.trim()));
    assert.ok(!agents.includes("Leia o SEMA_INDEX.json inteiro."));
    assert.equal((await verificarFrescorArtefatos(base)).fresco, true);
    await writeFile(path.join(base, "SEMA_BOOT.md"), "Protocolo antigo");
    assert.deepEqual((await verificarFrescorArtefatos(base)).arquivosProtocoloDesatualizados, ["SEMA_BOOT.md"]);
    assert.deepEqual((await verificarFrescorArtefatos(base)).arquivosProtocoloDesatualizados, ["SEMA_BOOT.md"]);
  } finally { await rm(base, { recursive: true, force: true }); }
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

test("retomada recompila o contrato atual, bloqueia protocolo antigo e não herda veredictos", async () => {
  const base = await criarWorkspace();
  const cli = path.resolve("pacotes/cli/dist/bin.js");
  const arquivo = "contratos/app.sema";
  const contrato = `module teste.app {
    use teste.dep
    task primeira { input {} output { ok: Booleano } guarantees { ok existe } }
    task segunda { input {} output { ok: Booleano } guarantees { ok existe } }
  }`;
  const rodar = (id: string) => {
    const processo = spawnSync(process.execPath, [cli, "sessao", "--mudanca-id", id, "--janela-contexto", "32768", "--json"], { cwd: base, encoding: "utf8", timeout: 30000 });
    return { status: processo.status, payload: JSON.parse(processo.stdout).payload };
  };
  const atualizarIndice = async () => {
    const frescor = await verificarFrescorArtefatos(base);
    await writeFile(path.join(base, "SEMA_INDEX.json"), JSON.stringify({ hashContratos: frescor.hashAtual }));
  };
  try {
    await writeFile(path.join(base, arquivo), contrato);
    await writeFile(path.join(base, "contratos/dep.sema"), "module teste.dep { entity Item { fields { id: Id } } }");
    await writeFile(path.join(base, "contratos/lateral.sema"), "conteúdo inválido fora do escopo");
    await atualizarIndice();
    const mudanca = await registrarMudanca(base, "Editar aplicação", [arquivo]);
    const primeiro = rodar(mudanca.id);
    assert.equal(primeiro.status, 0, JSON.stringify(primeiro.payload));
    assert.equal(primeiro.payload.estadoAtual.valido, true);
    assert.equal(primeiro.payload.estadoAtual.contratos.length, 2);
    assert.ok(!JSON.stringify(primeiro.payload.estadoAtual).includes("lateral.sema"));
    assert.equal(primeiro.payload.estadoAtual.contratos[0].tarefasReconhecidas, 2);
    assert.equal(primeiro.payload.estadoAtual.drift, "nao_avaliado");
    assert.equal(primeiro.payload.estadoAtual.comportamento, "nao_avaliado");
    assert.deepEqual(primeiro.payload.gates[0].validar, ["validar", arquivo, "--json"]);
    const hashAntes = primeiro.payload.estadoAtual.contratos[0].hash;
    await writeFile(path.join(base, "SEMA_BOOT.md"), "Protocolo antigo da sessão.");
    const antigo = rodar(mudanca.id);
    assert.equal(antigo.status, 1);
    assert.equal(antigo.payload.sucesso, false);
    assert.equal(antigo.payload.status, "indice_desatualizado");
    assert.ok(antigo.payload.frescor.arquivosProtocoloDesatualizados.includes("SEMA_BOOT.md"));
    assert.match(antigo.payload.proximosPassos.join(" "), /releia SEMA_BOOT/);
    const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
    await writeFile(path.join(base, "SEMA_BOOT.md"), renderizarSemaBoot(pack));
    await writeFile(path.join(base, arquivo), contrato.replace("module teste.app {", "module teste.app { enum Filtro { valores { a b } }"));
    await atualizarIndice();
    const invalido = rodar(mudanca.id);
    assert.equal(invalido.status, 1);
    assert.equal(invalido.payload.status, "contrato_invalido", JSON.stringify(invalido.payload));
    assert.equal(invalido.payload.estadoAtual.valido, false);
    assert.equal(invalido.payload.estadoAtual.contratos[0].tarefasReconhecidas, 2);
    assert.notEqual(invalido.payload.estadoAtual.contratos[0].hash, hashAntes);
    assert.ok(invalido.payload.estadoAtual.contratos[0].erros > 0);
    assert.equal(invalido.payload.mudancaId, mudanca.id);
    assert.ok(JSON.stringify(invalido.payload).length < 9000);
  } finally { await rm(base, { recursive: true, force: true }); }
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
