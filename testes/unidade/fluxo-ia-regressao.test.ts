// SEMA-GOVERNED: sema.produto.governanca_ia.documentacao.finalizacao, sema.produto.governanca_ia.drift
// Descrição: reproduz as falhas de escopo, leitura, sintaxe e símbolos da sessão Ornith sem depender do modelo.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { compilarCodigo } from "@sema/nucleo";
import { simbolosJavaScriptLocais } from "../../pacotes/cli/src/javascriptBindings.js";
import { carregarProjeto } from "../../pacotes/cli/src/projetoCarregar.js";
import { analisarDriftLegado } from "../../pacotes/cli/src/drift.part11.js";
import { criarDriftPack } from "../../pacotes/cli/src/driftPack.js";

const cli = path.resolve("pacotes/cli/dist/bin.js");
const texto = "Documento do projeto: escopo, regras, procedimento, validação e recuperação descritos para orientar a implementação local. ".repeat(2);
const contrato = `module app.lista {
  task adicionar {
    input { nome: Texto required }
    output { item: Texto }
    impl { js: src.app.lista.adicionarItem }
    vinculos {
      arquivo: "src/app/lista.js"
      simbolo: src.app.lista.adicionarItem
    }
    guarantees { item existe }
  }
}`;
const codigo = `// SEMA-GOVERNED: app.lista
(function () {
  function adicionarItem(nome) { return nome.trim(); }
  const api = { adicionarItem };
  window.ListaCompras = api;
  if (typeof module !== 'undefined') module.exports = api;
})();`;
function run(base: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [cli, ...args, "--json"], { cwd: base, encoding: "utf8", timeout: 30000 });
  assert.ok(r.stdout, r.stderr);
  return { ...JSON.parse(r.stdout), processExit: r.status };
}
async function fixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-ornith-"));
  await mkdir(path.join(base, "contratos")); await mkdir(path.join(base, "src/app"), { recursive: true });
  await writeFile(path.join(base, "README.md"), texto); await writeFile(path.join(base, "AGENTS.md"), texto);
  await writeFile(path.join(base, "contratos/lista.sema"), contrato);
  await writeFile(path.join(base, "src/app/lista.js"), codigo);
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({ origens: ["contratos"], diretoriosCodigo: ["src"] }));
  return base;
}

test("vínculo sem aspas falha cedo com reparo; aspas preservam inclusive espaços", () => {
  const ruim = compilarCodigo(contrato.replace('"src/app/lista.js"', 'src/app/lista.js'));
  assert.ok(ruim.diagnosticos.some((d) => d.codigo === "PAR004"));
  for (const arquivo of ['src/app/lista.js', 'src/minha pasta/lista.js']) {
    assert.ok(!compilarCodigo(contrato.replace('src/app/lista.js', arquivo)).diagnosticos.some((d) => d.codigo === "PAR004"));
  }
});

test("IIFE/browser/CommonJS resolve impl e vínculo sem converter a aplicação", async () => {
  const base = await fixture();
  try {
    const projeto = await carregarProjeto("contratos/lista.sema", base, { escopo: "modulo" });
    const resultado = await analisarDriftLegado(projeto, { escopo: "modulo", modoCache: "fresh" });
    assert.equal(resultado.impls_quebrados.length, 0);
    assert.equal(resultado.impls_validos.length, 1);
    assert.equal(resultado.vinculos_quebrados.length, 0);
    const pack = criarDriftPack(resultado);
    assert.equal(pack.status.behaviorEvidence, "pending");
    assert.equal(pack.status.tasksPendingEvidence, 1);
    assert.equal(pack.status.completeBehaviorProof, false);
    assert.equal(await readFile(path.join(base, "src/app/lista.js"), "utf8"), codigo);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("não publica funções escondidas em funções não invocadas ou propriedades de dados", () => {
  const fonte = ts.createSourceFile("app.js", `function guardada(){function secreta(){} }
    const api={ dado: 42, acao(){ return 1; } }; module.exports = api;
    exports.salvar = () => true;
    (() => { const abrir = () => true; globalThis.UI = { abrir }; })();`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const nomes = simbolosJavaScriptLocais(fonte);
  assert.ok(nomes.includes("acao") && nomes.includes("salvar") && nomes.includes("UI.abrir"));
  assert.ok(!nomes.includes("secreta") && !nomes.includes("dado"));
});

test("mudança retoma o mesmo escopo; leituras sobrevivem a processo novo e invalidam com edição", async () => {
  const base = await fixture();
  try {
    const abrir = run(base, "docs-impacto", "--intencao", "Editar lista", "--arquivo", "contratos/lista.sema");
    assert.equal(abrir.processExit, 0); const id = abrir.payload.mudancaId;
    assert.match(id, /^[a-f0-9]{20}$/);
    const semLeituras = run(base, "finalizar-mudanca", "--mudanca-id", id);
    assert.equal(semLeituras.processExit, 1);
    assert.ok(semLeituras.payload.docsNaoLidas?.some((d: any) => d.relativo === "contratos/lista.sema"), JSON.stringify(semLeituras));
    const fechar = run(base, ...abrir.payload.proximasChamadas.finalizar.filter((x: string) => x !== "--json"));
    assert.equal(fechar.processExit, 0, JSON.stringify(fechar));
    assert.equal(fechar.payload.status, "documentacao_conferida");
    assert.equal(run(base, "finalizar-mudanca", "--mudanca-id", id).processExit, 0);
    await writeFile(path.join(base, "README.md"), texto + "Regra nova.");
    const mudou = run(base, "finalizar-mudanca", "--mudanca-id", id);
    assert.equal(mudou.processExit, 1);
    assert.deepEqual(mudou.payload.leiturasDesatualizadas, ["README.md"]);
    assert.equal(run(base, "finalizar-mudanca", "--mudanca-id", id, "--doc-lida", "README.md").processExit, 0);
    const retomar = run(base, "sessao", "--mudanca-id", id, "--arquivo", "./contratos/lista.sema", "--janela-contexto", "32768");
    assert.deepEqual(retomar.payload.arquivosAlvo, ["contratos/lista.sema"]);
    assert.equal(retomar.payload.intencao, "Editar lista");
    assert.ok(JSON.stringify(retomar).length < 9000);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("fechamento não passa por retirar arquivo, trocar intenção ou declarar CSS inexistente", async () => {
  const base = await fixture();
  try {
    const a = run(base, "docs-impacto", "--intencao", "Editar lista", "--arquivo", "contratos/lista.sema");
    const b = run(base, "docs-impacto", "--intencao", "Outra mudança", "--arquivo", "README.md");
    assert.notEqual(a.payload.mudancaId, b.payload.mudancaId);
    for (const args of [["contratos/lista.sema"], ["--intencao", "implementar lista", "--doc-lida", "AGENTS.md", "--doc-lida", "README.md"]]) {
      assert.equal(run(base, "finalizar-mudanca", ...args).payload.status, "escopo_necessario");
    }
    assert.equal(run(base, "finalizar-mudanca", "--mudanca-id", a.payload.mudancaId, "--arquivo", "README.md").payload.status, "escopo_divergente");
    assert.equal(run(base, "finalizar-mudanca", "--mudanca-id", a.payload.mudancaId, "--doc-lida", "src/app/style.css").processExit, 1);
    assert.equal(run(base, "finalizar-mudanca", "--mudanca-id", "../../x").processExit, 1);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("ajuda e erro públicos orientam a correção sem dump geral nem níveis contraditórios", async () => {
  const ajuda = run(process.cwd(), "finalizar-mudanca", "--help");
  assert.match(ajuda.message, /--mudanca-id/);
  assert.ok(JSON.stringify(ajuda).length < 1800);
  const erro = run(process.cwd(), "finalizar-mudanca", "--docs", "README.md");
  assert.equal(erro.kind, "ARGUMENT_ERROR"); assert.match(erro.message, /--docs não existe/);
  const ia = run(process.cwd(), "ajuda-ia");
  assert.ok(!/fraca:|forte:|pacote completo|HTML solto/.test(ia.payload));
  assert.match(ia.payload, /--mudanca-id/); assert.match(ia.payload, /janela realmente configurada/);
  const segredo = "C:/privado/credencial-oculta.txt";
  const protegido = run(process.cwd(), "finalizar-mudanca", "--docs", segredo);
  assert.ok(!JSON.stringify(protegido).includes(segredo));
});
