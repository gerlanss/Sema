// SEMA-GOVERNED: sema.produto.orcamento_semantico
// Descricao: valida orcamento semantico e cabecalho governado na CLI local.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  avaliarOrcamentoArquivo,
  conteudoTemDescricaoHumanaGovernada,
  emitirDiagnosticosArquivosOrcamento,
  exemploCabecalhoCodigoGovernado,
  tipoArquivoOrcamento,
  validarCabecalhoCodigoGovernado,
  validarArquivoTocado,
  workspaceExigeCabecalhoCodigoGovernado,
} from "../../pacotes/cli/src/driftOrcamento.ts";
import {
  escreverArquivos,
  formatarAvisoArtefatosGeradosAcimaDoLimite,
} from "../../pacotes/cli/src/fsGovernado.ts";
import {
  emitirDiagnosticosContratoMonolitico,
} from "../../pacotes/nucleo/src/semantico/orcamentoSemantico.ts";

const cabecalhoHtml = [
  "<!--",
  "SEMA-GOVERNED: sema.web.local",
  "Descricao: pagina HTML governada; consulte contratos/web_local.sema antes de editar.",
  "-->",
  "<!doctype html>",
  "<html></html>",
].join("\n");

test("modo estrito exige cabecalho somente quando AGENTS.md e arquivo fisico da raiz", async () => {
  const pasta = await mkdtemp(path.join(os.tmpdir(), "sema-agents-cabecalho-"));
  try {
    assert.equal(await workspaceExigeCabecalhoCodigoGovernado(pasta, false), false);
    assert.equal(await workspaceExigeCabecalhoCodigoGovernado(pasta, true), false);

    await mkdir(path.join(pasta, "AGENTS.md"));
    assert.equal(await workspaceExigeCabecalhoCodigoGovernado(pasta, true), false);
    await rm(path.join(pasta, "AGENTS.md"), { recursive: true });

    await writeFile(path.join(pasta, "AGENTS.md"), "# Protocolo\n", "utf8");
    assert.equal(await workspaceExigeCabecalhoCodigoGovernado(pasta, true), true);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});

test("cabecalho SEMA-GOVERNED em HTML usa comentario HTML com descricao", () => {
  const resultado = validarCabecalhoCodigoGovernado({
    arquivo_codigo: "web/index.html",
    conteudo: cabecalhoHtml,
  });

  assert.equal(resultado.permitido, true);
  assert.match(resultado.exemplo_cabecalho, /<!--/);
  assert.match(resultado.exemplo_cabecalho, /Descri|Description|Descricao/);
});

test("Description em ingles tambem conta como descricao humana", () => {
  assert.equal(conteudoTemDescricaoHumanaGovernada("// Description: governed code"), true);
});

test("codigo acima de 2000 linhas continua bloqueado mesmo com cabecalho", () => {
  const grande = [
    cabecalhoHtml,
    ...Array.from({ length: 2001 }, (_, indice) => `<div>${indice}</div>`),
  ].join("\n");
  const diagnosticos = avaliarOrcamentoArquivo({
    arquivo: "web/index.html",
    conteudo: grande,
    exigirCabecalhoCodigoGovernado: true,
  });

  assert.equal(diagnosticos.some((diagnostico) => diagnostico.bloqueia), true);
  assert.match(diagnosticos[0]?.mensagem ?? "", /reorganize em arquivos com responsabilidade unica/);
});

test("erro de orcamento ensina modularizacao em vez de fatiamento artificial", () => {
  const validacao = validarArquivoTocado({ arquivo: "web/index.html", linhas: 2100, tipo: "codigo" });

  assert.equal(validacao.permitido, false);
  assert.match(validacao.mensagem, /reorganize em arquivos com responsabilidade unica/);
  assert.match(validacao.mensagem, /Nao fatie em _p1\/_p2/);
});

test("contrato sema tem limite proprio de 300/500 linhas", () => {
  const aviso = validarArquivoTocado({
    arquivo: "contratos/despesas_totais.sema",
    linhas: 350,
    tipo: "contrato",
  });
  const bloqueio = validarArquivoTocado({
    arquivo: "contratos/despesas_totais.sema",
    linhas: 501,
    tipo: "contrato",
  });

  assert.equal(aviso.permitido, true);
  assert.equal(aviso.severidade, "aviso");
  assert.equal(aviso.limite_aviso_linhas, 300);
  assert.equal(aviso.limite_bloqueio_linhas, 500);
  assert.equal(bloqueio.permitido, false);
  assert.equal(bloqueio.severidade, "erro");
  assert.equal(bloqueio.limite_bloqueio_linhas, 500);
  assert.match(bloqueio.mensagem, /varios \.sema podem governar o mesmo arquivo de codigo/);
});

test("contrato sema nao pode usar parte numerada em criacao ou edicao", () => {
  const validacao = validarArquivoTocado({
    arquivo: "contratos/despesas_parte_1.sema",
    linhas: 80,
    tipo: "contrato",
  });

  assert.equal(validacao.permitido, false);
  assert.equal(validacao.severidade, "erro");
  assert.match(validacao.mensagem, /parte numerada/);
  assert.match(validacao.mensagem, /via vinculos/);
});

test("nucleo diagnostica contrato sema grande e parte numerada", () => {
  const diagnosticoGrande = emitirDiagnosticosContratoMonolitico({
    contrato_alvo: "contratos/despesas_totais.sema",
    linhas: 501,
    tasks: 4,
    entities: 2,
    blocos_operacionais: 8,
  });
  const diagnosticoParte = emitirDiagnosticosContratoMonolitico({
    contrato_alvo: "contratos/despesas_parte_1.sema",
    linhas: 100,
    tasks: 2,
    entities: 1,
    blocos_operacionais: 4,
  });

  assert.equal(diagnosticoGrande.severidade, "erro");
  assert.equal(diagnosticoGrande.limite_aviso_linhas, 300);
  assert.equal(diagnosticoGrande.limite_bloqueio_linhas, 500);
  assert.match(diagnosticoGrande.mensagem, /nunca use parte_1\/parte_2/);
  assert.equal(diagnosticoParte.severidade, "erro");
});

test("migration historica generica nao vira monolito editavel", () => {
  const arquivo = "database/migrations/20260520223000_admin_console.sql";
  const tipo = tipoArquivoOrcamento(arquivo);
  const validacao = validarArquivoTocado({ arquivo, linhas: 953, tipo });

  assert.equal(tipo, "migracao_historica");
  assert.equal(validacao.permitido, true);
  assert.equal(validacao.severidade, "ok");
});

test("artefato gerado acima de 2000 linhas nao aciona bloqueio de orcamento", () => {
  const conteudoGerado = Array.from({ length: 2100 }, (_, indice) => `export const valor${indice} = ${indice};`).join("\n");
  const diagnosticos = avaliarOrcamentoArquivo({
    arquivo: "generated/app/grande.ts",
    conteudo: conteudoGerado,
    exigirCabecalhoCodigoGovernado: true,
  });

  assert.equal(tipoArquivoOrcamento("generated/app/grande.ts"), "gerado");
  assert.deepEqual(diagnosticos, []);
});

test("escrita governada permite gerado grande e avisa que a excecao foi aplicada", async () => {
  const pasta = await mkdtemp(path.join(os.tmpdir(), "sema-gerado-grande-"));
  const conteudoGerado = Array.from({ length: 2100 }, (_, indice) => `export const valor${indice} = ${indice};`).join("\n");

  try {
    const escrita = await escreverArquivos(pasta, [{
      caminhoRelativo: "app/grande.ts",
      conteudo: conteudoGerado,
    }], { artefatoGerado: true });
    const aviso = formatarAvisoArtefatosGeradosAcimaDoLimite(escrita.artefatosGeradosAcimaDoLimite);

    assert.equal(escrita.arquivosEscritos, 1);
    assert.equal(escrita.artefatosGeradosAcimaDoLimite.length, 1);
    assert.match(aviso ?? "", /acima de 2000 linhas/);
    assert.equal(await readFile(path.join(pasta, "app", "grande.ts"), "utf8"), conteudoGerado);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});

test("documentacao markdown grande nao entra no limite de codigo", () => {
  const conteudo = Array.from({ length: 5000 }, (_, indice) => `Documentation line ${indice}`).join("\n");

  const validacao = validarArquivoTocado({ arquivo: "README.md", linhas: 5000, tipo: "documentacao" });
  const diagnosticos = avaliarOrcamentoArquivo({ arquivo: "README.md", conteudo });

  assert.equal(validacao.permitido, true);
  assert.equal(validacao.severidade, "ok");
  assert.deepEqual(diagnosticos, []);
});

test("escrita governada bloqueia codigo normal acima de 2000 linhas", async () => {
  const pasta = await mkdtemp(path.join(os.tmpdir(), "sema-codigo-grande-"));
  const conteudoCodigo = [
    "// SEMA-GOVERNED: sema.teste",
    "// Descricao: codigo normal governado para teste de orcamento.",
    ...Array.from({ length: 2101 }, (_, indice) => `export const valor${indice} = ${indice};`),
  ].join("\n");

  try {
    await assert.rejects(
      () => escreverArquivos(pasta, [{
        caminhoRelativo: "src/grande.ts",
        conteudo: conteudoCodigo,
      }]),
      /tem 2103 linhas; reorganize em arquivos com responsabilidade unica/,
    );
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});

test("exemplo de TypeScript usa comentario de linha", () => {
  assert.match(exemploCabecalhoCodigoGovernado("src/app.ts"), /^\/\/ SEMA-GOVERNED:/);
});

test("orcamento reutiliza leitor planejado uma vez e nao abre arquivo lateral", async () => {
  const baseProjeto = path.resolve(os.tmpdir(), "sema-orcamento-leitor-planejado");
  const arquivoPlanejado = path.join(baseProjeto, "src", "planejado.ts");
  const arquivoLateral = path.join(baseProjeto, "dumps", "lateral.sql");
  const leituras: string[] = [];
  const consultas: string[] = [];
  const conteudoPlanejado = Array.from(
    { length: 2101 },
    (_, indice) => `export const valor${indice} = ${indice};`,
  ).join("\n");

  const diagnosticos = await emitirDiagnosticosArquivosOrcamento({
    baseProjeto,
    arquivos: [arquivoPlanejado, arquivoPlanejado, arquivoLateral],
    leitorArquivos: {
      contem: (arquivo) => {
        consultas.push(arquivo);
        return path.resolve(arquivo) === arquivoPlanejado;
      },
      lerTexto: async (arquivo) => {
        leituras.push(arquivo);
        assert.equal(arquivo, arquivoPlanejado, "arquivo lateral nao pode chegar ao leitor");
        return conteudoPlanejado;
      },
    },
  });

  assert.deepEqual(leituras, [arquivoPlanejado]);
  assert.deepEqual(consultas, [arquivoPlanejado, arquivoLateral]);
  assert.equal(diagnosticos.length, 1);
  assert.equal(diagnosticos[0]?.arquivo, "src/planejado.ts");
  assert.equal(diagnosticos[0]?.tipo, "codigo_monolitico");
});
