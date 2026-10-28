// SEMA-GOVERNED: sema.produto.governanca_ia.documentacao
// Descricao: prova que category-keyword docs are recommended, not blocking, while root docs still gate closure.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolverDocumentacaoObrigatoria, verificarDocumentacaoMudanca } from "../../pacotes/cli/src/docs.part02.js";

const TEXTO_SUBSTANCIAL = "Documento operacional com procedimento, validacao e rollback reais descritos de forma completa para passar o gate de substancia. ";

test("WhatsApp: contrato exato e código vinculado não puxam 85 contratos sem relação", async () => {
  const base = await criarWorkspace();
  try {
    await mkdir(path.join(base, "contratos"));
    await writeFile(path.join(base, "contratos/ordera.whatsapp.sema"), `module ordera.whatsapp {
      use ordera.telefone
      docs {
        resumo: "Conectar WhatsApp e identificar telefone a partir da conexão por QR."
        arquivo: "contratos/ordera.caixa_0.sema"
      }
      task conectar {
        vinculos { arquivo: "apps/api/src/modules/whatsapp.ts" }
      }
    }`);
    await writeFile(path.join(base, "contratos/ordera.telefone.sema"), `module ordera.telefone {
      docs { resumo: "Normalização do telefone conectado e validação do formato completo." }
      use ordera.whatsapp
    }`);
    for (let i = 0; i < 85; i++) await writeFile(path.join(base, `contratos/ordera.caixa_${i}.sema`), `module ordera.caixa_${i} { docs { resumo: "Operações de caixa sem relação com a conexão por QR." } }`);
    for (const alvo of ["contratos/ordera.whatsapp.sema", "apps/api/src/modules/whatsapp.ts"]) {
      const r = await resolverDocumentacaoObrigatoria({ baseProjeto: base, intencao: "Corrigir conexão do WhatsApp", arquivosAlvo: [alvo] });
      const contratos = r.leituraObrigatoria.filter((d) => d.tipo === "contrato");
      assert.deepEqual(contratos.map((d) => d.relativo).sort(), ["contratos/ordera.telefone.sema", "contratos/ordera.whatsapp.sema"]);
      assert.match(contratos.find((d) => d.relativo.endsWith("telefone.sema"))!.motivo, /Dependência use ordera.telefone/);
      assert.ok(!r.leituraObrigatoria.some((d) => d.relativo === "SEMA_INDEX.json"));
      assert.ok(r.leituraObrigatoria.length <= 5);
      assert.ok(r.leituraRecomendada.some((d) => d.relativo === "contratos/ordera.caixa_0.sema"));
      assert.ok(r.leituraRecomendada.every((d) => d.obrigatorio === false));
      assert.ok(r.leituraObrigatoria.every((d) => d.obrigatorio === true));
      const fechamento = await verificarDocumentacaoMudanca({ baseProjeto: base, intencao: "Corrigir conexão do WhatsApp", arquivosAlvo: ["contratos/ordera.whatsapp.sema"], docsLidas: r.leituraObrigatoria.map((d) => d.relativo) });
      assert.equal(fechamento.sucesso, true, JSON.stringify(fechamento.diagnosticos));
    }
    const semAlvo = await resolverDocumentacaoObrigatoria({ baseProjeto: base, intencao: "Corrigir conexão WhatsApp" });
    assert.equal(semAlvo.leituraObrigatoria.filter((d) => d.tipo === "contrato").length, 0);
    assert.ok(semAlvo.leituraRecomendada.some((d) => d.relativo.endsWith("whatsapp.sema")));
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("contrato explícito ausente continua bloqueando e não some da lista", async () => {
  const base = await criarWorkspace();
  try {
    const r = await resolverDocumentacaoObrigatoria({ baseProjeto: base, intencao: "Corrigir QR", arquivosAlvo: ["contratos/ordera.whatsapp.sema"] });
    assert.equal(r.sucesso, false);
    assert.equal(r.docsAusentes[0]?.relativo, "contratos/ordera.whatsapp.sema");
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("dependência declarada ausente bloqueia sem inventar caminho", async () => {
  const base = await criarWorkspace();
  try {
    await mkdir(path.join(base, "contratos"));
    await writeFile(path.join(base, "contratos/whatsapp.sema"), "module app.whatsapp { use app.telefone }");
    await assert.rejects(resolverDocumentacaoObrigatoria({ baseProjeto: base, intencao: "QR", arquivosAlvo: ["contratos/whatsapp.sema"] }), /Dependência use app.telefone.*ausente ou ambígua/);
  } finally { await rm(base, { recursive: true, force: true }); }
});

async function criarWorkspace(): Promise<string> {
  const base = await mkdtemp(path.join(tmpdir(), "sema-docs-relevancia-"));
  await mkdir(path.join(base, "docs"), { recursive: true });
  await writeFile(path.join(base, "AGENTS.md"), TEXTO_SUBSTANCIAL, "utf8");
  await writeFile(path.join(base, "SEMA_INDEX.json"), `{ "indice": "${"x".repeat(200)}" }\n`, "utf8");
  await writeFile(path.join(base, "README.md"), TEXTO_SUBSTANCIAL, "utf8");
  await writeFile(path.join(base, "docs", "README.md"), TEXTO_SUBSTANCIAL, "utf8");
  await writeFile(path.join(base, "docs", "api.md"), TEXTO_SUBSTANCIAL, "utf8");
  return base;
}

test("doc de categoria por palavra-chave vira recomendada, nao bloqueante", async () => {
  const base = await criarWorkspace();
  try {
    const resultado = await resolverDocumentacaoObrigatoria({
      baseProjeto: base,
      intencao: "corrigir matching de rotas http",
      arquivosAlvo: [],
      criarAusentes: false,
    });

    const api = resultado.leituraRecomendada.find((doc) => doc.relativo === "docs/api.md");
    assert.ok(api, "esperava docs/api.md na leitura");
    assert.equal(api!.obrigatoriedade, "recomendada");
    assert.ok(resultado.leituraRecomendada.some((doc) => doc.relativo === "docs/api.md"));

    const agents = resultado.leituraObrigatoria.find((doc) => doc.relativo === "AGENTS.md");
    assert.equal(agents!.obrigatoriedade, "bloqueante");
    assert.equal(resultado.sucesso, true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("finalizar-mudanca fecha sem declarar leituras recomendadas", async () => {
  const base = await criarWorkspace();
  try {
    const verificacao = await verificarDocumentacaoMudanca({
      baseProjeto: base,
      intencao: "corrigir matching de rotas http",
      docsLidas: ["AGENTS.md", "README.md", "docs/README.md"],
    });

    assert.equal(verificacao.sucesso, true, JSON.stringify(verificacao.diagnosticos));
    assert.ok(verificacao.leituraRecomendada.some((doc) => doc.relativo === "docs/api.md"));
    assert.ok(!verificacao.docsNaoLidas.some((doc) => doc.relativo === "docs/api.md"));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("docs de raiz continuam bloqueando o fechamento", async () => {
  const base = await criarWorkspace();
  try {
    const verificacao = await verificarDocumentacaoMudanca({
      baseProjeto: base,
      intencao: "corrigir matching de rotas http",
      docsLidas: ["AGENTS.md"],
    });

    assert.equal(verificacao.sucesso, false);
    assert.ok(verificacao.docsNaoLidas.some((doc) => doc.relativo === "README.md"));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("doc recomendada ausente nao derruba o docs-impacto", async () => {
  const base = await criarWorkspace();
  try {
    await rm(path.join(base, "docs", "api.md"), { force: true });
    const resultado = await resolverDocumentacaoObrigatoria({
      baseProjeto: base,
      intencao: "corrigir matching de rotas http",
      arquivosAlvo: [],
      criarAusentes: false,
    });

    assert.equal(resultado.sucesso, true);
    assert.equal(resultado.bloqueios.length, 0);
    const api = resultado.leituraRecomendada.find((doc) => doc.relativo === "docs/api.md");
    assert.equal(api!.existe, false);
    assert.equal(api!.obrigatoriedade, "recomendada");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
