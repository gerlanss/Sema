// SEMA-GOVERNED: sema.produto.cli_init_templates
// Descrição: prova adoção sem negócio inventado, isolamento dos exemplos e criação posterior do contrato solicitado.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { arquivosTemplateIniciar, type TemplateIniciar } from "../../pacotes/cli/src/initTemplatesBase.js";

import { listarArquivosRecursivosLimitado } from "../../pacotes/cli/src/projetoBusca.js";

const cli = path.resolve("pacotes/cli/dist/bin.js");
const templates: TemplateIniciar[] = ["base", "nestjs", "fastapi", "nextjs-api", "nextjs-consumer", "react-vite-consumer", "angular-consumer", "flutter-consumer", "node-firebase-worker", "aspnet-api", "springboot-api", "go-http-api", "rust-axum-api", "cpp-service-bridge"];
const executar = (base: string, args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: base, encoding: "utf8", timeout: 60_000 });

test("os 14 templates mantêm demonstrações em exemplos e não geram código ou contratos de negócio ativos", () => {
  for (const template of templates) {
    const arquivos = arquivosTemplateIniciar(template);
    assert.equal(new Set(arquivos.map(a => a.caminhoRelativo)).size, arquivos.length, template);
    assert.deepEqual(arquivos.filter(a => a.caminhoRelativo.endsWith(".sema") && !a.caminhoRelativo.startsWith("exemplos/")), [], template);
    assert.deepEqual(arquivos.filter(a => /\.(?:tsx?|dart|cs|java|go|rs|cpp)$/.test(a.caminhoRelativo) && !a.caminhoRelativo.startsWith("exemplos/")), [], template);
    assert.ok(arquivos.some(a => a.caminhoRelativo === "contratos/.gitkeep"), template);
    const config = JSON.parse(arquivos.find(a => a.caminhoRelativo === "sema.config.json")!.conteudo);
    assert.deepEqual(config.origens, ["./contratos"]);
    const readme = arquivos.find(a => a.caminhoRelativo === "README.md")!.conteudo;
    assert.doesNotMatch(readme, /contratos\/pedidos\.sema/);
    assert.match(readme, /pedido do usuário/);
  }
});

test("projeto novo inicia com zero contratos e exemplos não entram em validação ou navegação", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-sem-negocio-"));
  try {
    const init = executar(base, ["iniciar", "--template", "base", "--janela-contexto", "32768", "--json"]);
    assert.equal(init.status, 0, init.stdout + init.stderr);
    assert.deepEqual(await readdir(path.join(base, "contratos")), [".gitkeep"]);
    assert.ok((await readdir(path.join(base, "exemplos"))).includes("pedido.sema"));
    const indice = JSON.parse(await readFile(path.join(base, "SEMA_INDEX.json"), "utf8"));
    assert.equal(indice.totalModulos, 0);
    assert.equal(indice.analiseDrift.executada, false);
    assert.equal(indice.analiseDrift.sucesso, null);
    const sessao = executar(base, ["sessao", "Criar lista de compras", "--json"]);
    assert.equal(sessao.status, 0, sessao.stdout + sessao.stderr);
    const p = JSON.parse(sessao.stdout).payload;
    assert.equal(p.status, "contrato_necessario");
    assert.equal(p.execucaoAutorizada, false);
    assert.deepEqual(p.contexto.candidatos, []);
    assert.match(p.proximosPassos.join(" "), /Modele em contratos/);
    const validar = executar(base, ["validar", ".", "--json"]);
    assert.notEqual(validar.status, 0);
    assert.match(validar.stdout, /SEM_CLI_SEM_CONTRATOS/);
    await writeFile(path.join(base, "contratos/compras.sema"), 'module app.compras { docs { resumo: "Lista de compras: adicionar itens, quantidades e conclusão." } }');
    const sync = executar(base, ["sync-codex", "--json"]);
    assert.equal(sync.status, 0, sync.stdout + sync.stderr);
    const localizada = executar(base, ["sessao", "Lista de compras", "--arquivo", "contratos/compras.sema", "--json"]);
    const selecionado = JSON.parse(localizada.stdout).payload;
    assert.equal(selecionado.status, "contrato_localizado");
    assert.deepEqual(selecionado.contexto.candidatos.map((c: { contrato: string }) => c.contrato), ["contratos/compras.sema"]);
    assert.equal((await readdir(path.join(base, "contratos"))).includes("pedidos.sema"), false);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("demonstração React fica isolada mesmo com arquivos do exemplo completos", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-template-isolado-"));
  try {
    const init = executar(base, ["iniciar", "--template", "react-vite-consumer", "--janela-contexto", "32768", "--json"]);
    assert.equal(init.status, 0, init.stdout + init.stderr);
    const indice = JSON.parse(await readFile(path.join(base, "SEMA_INDEX.json"), "utf8"));
    assert.deepEqual(indice.modulos, []);
    assert.deepEqual(await readdir(path.join(base, "src")), [".gitkeep"]);
    assert.deepEqual(await listarArquivosRecursivosLimitado(base, [".ts", ".tsx"]), [], "busca automática não incorpora o código demonstrativo");
    assert.match(await readFile(path.join(base, "exemplos/templates/react-vite-consumer/contratos/showroom_consumer.sema"), "utf8"), /module showroom/);
    assert.ok((await readFile(path.join(base, "exemplos/templates/react-vite-consumer/src/pages/ranking.tsx"), "utf8")).length > 0);
    const validar = executar(base, ["validar", "exemplos/templates/react-vite-consumer/contratos/showroom_consumer.sema", "--json"]);
    assert.equal(validar.status, 0, validar.stdout + validar.stderr);
  } finally { await rm(base, { recursive: true, force: true }); }
});
