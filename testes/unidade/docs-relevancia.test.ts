// SEMA-GOVERNED: sema.produto.governanca_ia.documentacao
// Descricao: prova que category-keyword docs are recommended, not blocking, while root docs still gate closure.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolverDocumentacaoObrigatoria, verificarDocumentacaoMudanca } from "../../pacotes/cli/src/docs.part02.js";

const TEXTO_SUBSTANCIAL = "Documento operacional com procedimento, validacao e rollback reais descritos de forma completa para passar o gate de substancia. ";

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

    const api = resultado.leituraObrigatoria.find((doc) => doc.relativo === "docs/api.md");
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
      docsLidas: ["AGENTS.md", "SEMA_INDEX.json", "README.md", "docs/README.md"],
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
    const api = resultado.leituraObrigatoria.find((doc) => doc.relativo === "docs/api.md");
    assert.equal(api!.existe, false);
    assert.equal(api!.obrigatoriedade, "recomendada");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
