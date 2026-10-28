// SEMA-GOVERNED: sema.produto.cli_sessao, sema.produto.governanca_ia.contexto.entrypoints
// Descrição: prova orçamento real de saída da CLI, configuração explícita e navegação sem índice bruto.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { criarPerfilContexto, salvarPerfilContexto, resolverPerfilContexto } from "../../pacotes/cli/src/contextBudget.js";
import { verificarFrescorArtefatos } from "../../pacotes/cli/src/index.part04.js";
import { criarAgentContextPack, criarGuiaCapacidadeIa } from "../../pacotes/cli/src/agentContextPack.js";
import { renderizarInstrucaoCodexSema, renderizarSemaBoot, renderizarSemaSmallModel } from "../../pacotes/cli/src/agentBootstrap.js";
const CLI = path.resolve("pacotes/cli/dist/bin.js");

test("perfil 32K reserva espaço e rejeita valores inviáveis", () => {
  assert.deepEqual(criarPerfilContexto(32768), { schema: "sema.agent-context-profile/v1", janelaTokens: 32768, orcamentoTokens: 4096, reservaSaidaTokens: 4096 });
  for (const n of [0, -1, NaN, Infinity, 2048, 32768.5]) assert.throws(() => criarPerfilContexto(n));
  assert.throws(() => criarPerfilContexto(32768, 30000, 4096));
});

test("perfil só é persistido explicitamente e pode ser trocado", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sema-contexto-"));
  try {
    assert.equal(await resolverPerfilContexto(base, []), undefined);
    const perfil = await resolverPerfilContexto(base, ["--janela-contexto", "32768"]);
    assert.equal(await resolverPerfilContexto(base, []), undefined);
    await salvarPerfilContexto(base, perfil!);
    assert.equal((await resolverPerfilContexto(base, []))?.janelaTokens, 32768);
    assert.equal((await resolverPerfilContexto(base, ["--janela-contexto=8192"]))?.orcamentoTokens, 1024);
    assert.equal((await resolverPerfilContexto(base, []))?.janelaTokens, 32768);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("entrada inteira fica abaixo de 2000 tokens estimados e nenhum perfil exige o índice", () => {
  const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
  const texto = renderizarInstrucaoCodexSema(pack) + renderizarSemaBoot(pack) + renderizarSemaSmallModel(pack);
  assert.ok(texto.length / 4 < 2000, `${texto.length} caracteres`);
  for (const ordem of Object.values(pack.guiaPorCapacidade)) {
    assert.deepEqual(ordem, ["AGENTS.md", "SEMA_BOOT.md"]);
  }
  for (const caminho of ["SEMA_INDEX.json", "AGENT_CONTEXT_PACK.json", "docs/commands.md"]) {
    assert.equal(pack.fontes.find((fonte) => fonte.caminho === caminho)?.obrigatorio, false, caminho);
  }
});

test("iniciar pergunta contexto antes de criar qualquer arquivo", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sema-contexto-init-"));
  try {
    const r = spawnSync(process.execPath, [CLI, "iniciar", "--template", "base", "--json"], { cwd: base, encoding: "utf8" });
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /janela de contexto/);
    assert.deepEqual(await readdir(base), []);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("sessao consulta índice grande internamente e cabe no orçamento da saída efetiva", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sema-contexto-cli-"));
  try {
    await mkdir(path.join(base, "contratos"));
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({ origens: ["./contratos"] }));
    await writeFile(path.join(base, "contratos/whatsapp.sema"), 'module app.whatsapp { docs { resumo: "Conexão WhatsApp e identificação do telefone conectado." } }');
    const pack = criarAgentContextPack(criarGuiaCapacidadeIa());
    await writeFile(path.join(base, "AGENTS.md"), `<!-- sema:agent-entrypoint:start -->\n${renderizarInstrucaoCodexSema(pack)}<!-- sema:agent-entrypoint:end -->\n`);
    await writeFile(path.join(base, "SEMA_BOOT.md"), renderizarSemaBoot(pack));
    await writeFile(path.join(base, "SEMA_SMALL_MODEL.md"), renderizarSemaSmallModel(pack));
    const hash = (await verificarFrescorArtefatos(base)).hashAtual;
    const modulo = { arquivo: "contratos/whatsapp.sema", modulo: "app.whatsapp", faz: "Conexão WhatsApp", tarefasPrincipais: ["conectar_whatsapp"], arquivosProvaveis: ["src/whatsapp.ts"] };
    await writeFile(path.join(base, "SEMA_INDEX.json"), JSON.stringify({ hashContratos: hash, modulos: [modulo], catalogoInterno: "X".repeat(626189) }));
    const r = spawnSync(process.execPath, [CLI, "sessao", "Corrigir WhatsApp", "--janela-contexto", "32768", "--arquivo", "contratos/whatsapp.sema", "--json"], { cwd: base, encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const payload = JSON.parse(r.stdout).payload;
    assert.equal(payload.status, "contrato_localizado");
    assert.deepEqual(payload.contexto.candidatos[0].arquivos, ["src/whatsapp.ts"]);
    assert.ok(r.stdout.length <= 4096 * 4, `${r.stdout.length} caracteres`);
    assert.ok(Math.ceil(r.stdout.length / 4) <= payload.orcamento.tokensEstimadosResposta);
    assert.equal(payload.execucaoAutorizada, false);
    assert.ok(!payload.intencoes.docsBloqueantes.includes("SEMA_INDEX.json"));
    assert.doesNotMatch(r.stdout, /XXXX/);
    const pequeno = spawnSync(process.execPath, [CLI, "sessao", "Corrigir WhatsApp", "--janela-contexto", "32768", "--orcamento-contexto", "512", "--arquivo", "contratos/whatsapp.sema", "--json"], { cwd: base, encoding: "utf8" });
    assert.ok(pequeno.stdout.length <= 512 * 4);
    assert.equal(JSON.parse(pequeno.stdout).payload.execucaoAutorizada, false);
    assert.ok(["refinar_escopo", "orcamento_insuficiente"].includes(JSON.parse(pequeno.stdout).payload.status));
    const ambiguos = Array.from({ length: 20 }, (_, i) => ({ ...modulo, modulo: `app.whatsapp${i}`, arquivo: `contratos/whatsapp${i}.sema`, faz: "WhatsApp " + "detalhes ".repeat(100) }));
    await writeFile(path.join(base, "SEMA_INDEX.json"), JSON.stringify({ hashContratos: hash, modulos: ambiguos }));
    const ambiguo = spawnSync(process.execPath, [CLI, "sessao", "WhatsApp", "--janela-contexto", "32768", "--json"], { cwd: base, encoding: "utf8" });
    const pa = JSON.parse(ambiguo.stdout).payload;
    assert.equal(pa.status, "refinar_escopo");
    assert.equal(pa.contexto.candidatos.length + pa.contexto.candidatosOmitidos, 20);
    assert.ok(ambiguo.stdout.length <= 4096 * 4);
    await writeFile(path.join(base, "contratos/whatsapp.sema"), 'module app.whatsapp { docs { resumo: "Contrato alterado sem sincronizar o índice." } }');
    const stale = spawnSync(process.execPath, [CLI, "sessao", "WhatsApp", "--janela-contexto", "32768", "--json"], { cwd: base, encoding: "utf8" });
    const p = JSON.parse(stale.stdout).payload;
    assert.equal(p.status, "indice_desatualizado");
    assert.equal(p.contexto, undefined);
  } finally { await rm(base, { recursive: true, force: true }); }
});
