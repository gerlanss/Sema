// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.entrypoints
// Descrição: prova geração única, migração preservada e orçamento combinado da entrada e entrega.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, symlink, link } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { selecionarContextoAtivo, tokensEntradaLocal, arquivarResumosLegados, RESUMOS_LEGADOS, ARQUIVOS_CONTEXTO_PROJETO, ARQUIVOS_CONTEXTO_MODULO, nivelParaJanela } from "../../pacotes/cli/src/contextDelivery.js";
import { criarPerfilContexto, salvarPerfilContexto } from "../../pacotes/cli/src/contextBudget.js";

const cli = path.resolve("pacotes/cli/dist/bin.js");
const executar = (base: string, args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: base, encoding: "utf8", timeout: 60_000 });

test("novos projetos materializam somente o nível selecionado em 32K, 65K e 1M", async () => {
  for (const janela of [32768, 65536, 1000000]) {
    const base = await mkdtemp(path.join(os.tmpdir(), "sema-entrega-"));
    try {
      const init = executar(base, ["iniciar", "--template", "base", "--janela-contexto", String(janela), "--json"]);
      assert.equal(init.status, 0, init.stdout + init.stderr);
      const nomes = await readdir(base);
      const indice = janela === 32768 ? 0 : janela === 65536 ? 1 : 2;
      const escolhido = ARQUIVOS_CONTEXTO_PROJETO[indice]!;
      assert.deepEqual(nomes.filter(n => (ARQUIVOS_CONTEXTO_PROJETO as readonly string[]).includes(n)), [escolhido]);
      assert.ok(!nomes.includes("SEMA_SMALL_MODEL.md"));
      const resumo = await readFile(path.join(base, escolhido), "utf8");
      assert.match(resumo, /Consulta opcional/);
      assert.ok(await tokensEntradaLocal(base) + Math.ceil(resumo.length / 4) <= criarPerfilContexto(janela).orcamentoTokens);
      assert.deepEqual((await readdir(path.join(base, "contratos"))).filter(n => n.endsWith(".sema")), []);
      await writeFile(path.join(base, "contratos/compras.sema"), 'module app.compras { docs { resumo: "Lista de compras solicitada pelo usuário." } }');
      const sync = executar(base, ["sync-codex", "--json"]);
      assert.equal(sync.status, 0, sync.stdout + sync.stderr);
      const contratos = (await readdir(path.join(base, "contratos"))).filter(n => n.endsWith(".sema"));
      const contrato = `contratos/${contratos[0]}`;
      const sessao = executar(base, ["sessao", "Revisar contrato", "--arquivo", contrato, "--json"]);
      assert.equal(sessao.status, 0, sessao.stdout + sessao.stderr);
      const payload = JSON.parse(sessao.stdout).payload;
      assert.ok(payload.orcamento.tokensEstimadosTotal <= payload.orcamento.limiteTokens);
      assert.ok(Math.ceil(sessao.stdout.length / 4) + await tokensEntradaLocal(base) <= payload.orcamento.limiteTokens);
      assert.doesNotMatch(payload.proximosPassos.join(" "), /SEMA_CONTEXT|SEMA_BRIEF|SEMA_SMALL/);
      const contexto = executar(base, ["contexto-ia", contrato, "--saida", ".tmp/contexto", "--json"]);
      assert.equal(contexto.status, 0, contexto.stdout + contexto.stderr);
      const gerados = await readdir(path.join(base, ".tmp/contexto"));
      assert.deepEqual(gerados.filter(n => (ARQUIVOS_CONTEXTO_MODULO as readonly string[]).includes(n)), [ARQUIVOS_CONTEXTO_MODULO[indice]]);
      assert.ok(Math.ceil(contexto.stdout.length / 4) + await tokensEntradaLocal(base) <= criarPerfilContexto(janela).orcamentoTokens);
    } finally { await rm(base, { recursive: true, force: true }); }
  }
});

test("perfil decide o arquivo; orçamento pode reduzir o nível, sem gerar as alternativas", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-limite-"));
  const resumos = { micro: "CONTRATO: app.tarefas", curto: "REGRAS: cadastrar, concluir, excluir", medio: "DETALHES: persistência e filtros" };
  try {
    assert.equal(await selecionarContextoAtivo(base, resumos), undefined);
    for (const [janela, nivel] of [[32768, "micro"], [65536, "curto"], [1000000, "medio"]] as const) {
      await salvarPerfilContexto(base, criarPerfilContexto(janela));
      const selecionado = await selecionarContextoAtivo(base, resumos);
      assert.equal(selecionado?.nivel, nivel);
      assert.ok(selecionado?.conteudo.includes(resumos[nivel]));
    }
    const reduzido = await selecionarContextoAtivo(base, { ...resumos, medio: "REGRA_INTEIRA".repeat(10000) });
    assert.equal(reduzido?.nivel, "curto");
    assert.doesNotMatch(reduzido!.conteudo, /REGRA_INTEIRA/);
    await salvarPerfilContexto(base, criarPerfilContexto(8192));
    assert.equal(await selecionarContextoAtivo(base, resumos), undefined);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("migração tira resumos antigos da entrada, preserva bytes e não move arquivos manuais", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-legado-"));
  try {
    const bytes = "# SEMA_BRIEF\r\nResumo antigo com acentos e nota manual.\r\n";
    await writeFile(path.join(base, "SEMA_BRIEF.md"), bytes);
    await writeFile(path.join(base, "resumo.md"), "Documento manual independente");
    assert.deepEqual(await arquivarResumosLegados(base), ["SEMA_BRIEF.md"]);
    assert.ok(!(await readdir(base)).includes("SEMA_BRIEF.md"));
    assert.equal(await readFile(path.join(base, "resumo.md"), "utf8"), "Documento manual independente");
    const pasta = path.join(base, ".sema/contexto-legado");
    assert.equal(await readFile(path.join(pasta, (await readdir(pasta))[0]!), "utf8"), bytes);
    assert.deepEqual(await arquivarResumosLegados(base), []);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("migração rejeita um destino de backup redirecionado para fora do workspace", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-legado-link-"));
  const externo = await mkdtemp(path.join(os.tmpdir(), "sema-legado-externo-"));
  try {
    await mkdir(path.join(base, ".sema"));
    await symlink(externo, path.join(base, ".sema/contexto-legado"), process.platform === "win32" ? "junction" : "dir");
    await writeFile(path.join(base, "SEMA_BRIEF.md"), "# SEMA_BRIEF\nOriginal");
    await assert.rejects(arquivarResumosLegados(base));
    assert.equal(await readFile(path.join(base, "SEMA_BRIEF.md"), "utf8"), "# SEMA_BRIEF\nOriginal");
    assert.deepEqual(await readdir(externo), []);
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externo, { recursive: true, force: true });
  }
});

test("backup de resumo não mantém hardlink e um backup editado nunca é sobrescrito", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-backup-link-"));
  try {
    const original = "# SEMA_BRIEF\nDados antigos";
    const externo = path.join(base, "documento-original.txt");
    await writeFile(externo, original);
    await link(externo, path.join(base, "SEMA_BRIEF.md"));
    await arquivarResumosLegados(base);
    const pasta = path.join(base, ".sema/contexto-legado");
    const backup = path.join(pasta, (await readdir(pasta))[0]!);
    await writeFile(externo, "Alteração posterior");
    assert.equal(await readFile(backup, "utf8"), original);
    await writeFile(backup, "Nota manual no backup");
    await writeFile(path.join(base, "SEMA_BRIEF.md"), original);
    await assert.rejects(arquivarResumosLegados(base), /Backup modificado/);
    assert.equal(await readFile(backup, "utf8"), "Nota manual no backup");
    assert.equal(await readFile(path.join(base, "SEMA_BRIEF.md"), "utf8"), original);
  } finally { await rm(base, { recursive: true, force: true }); }
});

 test("trocar a janela invalida o contexto antigo e sincronizar substitui o conjunto de arquivos", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-troca-perfil-"));
  try {
    assert.equal(executar(base, ["iniciar", "--template", "base", "--janela-contexto", "32768", "--json"]).status, 0);
    assert.ok((await readdir(base)).includes("SEMA_BRIEF.micro.txt"));
    const troca = executar(base, ["sessao", "Revisar", "--janela-contexto", "1000000", "--salvar-perfil", "--json"]);
    assert.equal(JSON.parse(troca.stdout).payload.status, "indice_desatualizado");
    const sync = executar(base, ["sync-codex", "--json"]);
    assert.equal(sync.status, 0, sync.stdout + sync.stderr);
    const nomes = await readdir(base);
    assert.deepEqual(nomes.filter(n => (ARQUIVOS_CONTEXTO_PROJETO as readonly string[]).includes(n)), ["SEMA_BRIEF.md"]);
    assert.equal(JSON.parse(sync.stdout).payload.contextoSelecionado.arquivo, "SEMA_BRIEF.md");
    assert.equal(executar(base, ["sessao", "Revisar", "--json"]).status, 0);
  } finally { await rm(base, { recursive: true, force: true }); }
});
