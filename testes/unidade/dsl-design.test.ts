// SEMA-GOVERNED: sema.produto.dsl_design
// Descricao: prova o bloco design — presets, overrides livres, CSS tematizado e pacote de tokens.

import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo } from "../../pacotes/nucleo/dist/index.js";
import { resolverDesignTokens, listarNomesDesign } from "../../pacotes/padroes/dist/index.js";
import { gerarCss } from "../../pacotes/gerador-css/dist/index.js";
import { gerarDesignTokensArquivos } from "../../pacotes/cli/src/geracaoCore.js";

const CONTRATO = (tokens: string) => `module demo.painel {
  design {
    dominio: agro
    identidade: rustico_moderno
    tokens {
      ${tokens}
    }
  }
  entity Safra {
    fields {
      id: Id
    }
  }
}
`;

test("bloco design chega ao IR com presets e overrides", () => {
  const r = compilarCodigo(
    CONTRATO('paleta: terra\n      tipografia: display\n      forma: arredondada\n      cor_primaria: "#7c2d12"'),
    "painel.sema",
  );
  assert.equal(r.diagnosticos.filter((d) => d.severidade === "erro").length, 0);
  assert.deepEqual(r.ir!.design!.dominio, "agro");
  assert.equal(r.ir!.design!.tokens.paleta, "terra");
  assert.equal(r.ir!.design!.tokens.overrides["cor_primaria"], "#7c2d12");
});

test("preset invalido e rejeitado ensinando o catalogo", () => {
  const r = compilarCodigo(CONTRATO("paleta: rosa_shock"), "painel.sema");
  const sem112 = r.diagnosticos.find((d) => d.codigo === "SEM112");
  assert.ok(sem112, "esperava SEM112");
  assert.ok(sem112!.dica?.includes("terra"), "dica deve listar presets validos");
});

test("campo invalido em design e rejeitado com SEM110", () => {
  const r = compilarCodigo("module demo.painel {\n  design {\n    vibe: legal\n  }\n}\n", "painel.sema");
  assert.ok(r.diagnosticos.some((d) => d.codigo === "SEM110"));
});

test("resolver combina preset e override livre", () => {
  const tokens = resolverDesignTokens({
    tokens: { paleta: "terra", tipografia: "display", overrides: { cor_primaria: "#7c2d12" } },
  });
  assert.equal(tokens.cores.primaria, "#7c2d12");
  assert.equal(tokens.cores.primariaHover, "#92400e");
  assert.equal(tokens.tipografia.fonteTitulo.includes("Fraunces"), true);

  const padrao = resolverDesignTokens(undefined);
  assert.equal(padrao.cores.primaria, "#6366f1");
});

test("dark mode do css gerado acompanha a paleta e aceita override escuro", () => {
  const r = compilarCodigo(
    CONTRATO(["paleta: terra", "cor_primaria: \"#7c2d12\"", "cor_fundo_escuro: \"#100c08\""].join(" ")),
    "painel.sema",
  );
  const css = gerarCss(r.ir!).map((arquivo) => arquivo.conteudo).join(String.fromCharCode(10));
  const escuro = css.slice(css.indexOf("prefers-color-scheme: dark"));
  assert.ok(escuro.includes("--sema-cor-primaria: #d97706"), "primaria escura deve vir da paleta terra");
  assert.ok(escuro.includes("--sema-cor-fundo: #100c08"), "override de fundo escuro deve ser respeitado");
  assert.ok(!escuro.includes("--sema-cor-fundo: #09090b"), "fundo escuro padrao nao deve vazar na paleta terra");

  const padrao = compilarCodigo(CONTRATO(""), "painel.sema");
  const cssPadrao = gerarCss(padrao.ir!).map((a) => a.conteudo).join(String.fromCharCode(10));
  const escuroPadrao = cssPadrao.slice(cssPadrao.indexOf("prefers-color-scheme: dark"));
  assert.ok(escuroPadrao.includes("--sema-cor-primaria: #818cf8"), "sem design mantém o escuro atual");
});

test("tokens.ts e design-tokens.css carregam as cores escuras da paleta", () => {
  const r = compilarCodigo(CONTRATO("paleta: oceano"), "painel.sema");
  const arquivos = gerarDesignTokensArquivos(r.ir!, "typescript");
  const ts = arquivos.find((a) => a.caminhoRelativo === "design/tokens.ts")!.conteudo;
  assert.ok(ts.includes('"darkColors"'), "tokens.ts deve expor darkColors");
  const css = arquivos.find((a) => a.caminhoRelativo === "design/design-tokens.css")!.conteudo;
  assert.ok(css.includes("prefers-color-scheme: dark"), "design-tokens.css deve ter bloco escuro");
  assert.ok(css.includes("#38bdf8"), "paleta oceano deve aparecer");
});

test("css gerado fica tematizado pelo design do contrato", () => {
  const r = compilarCodigo(CONTRATO('paleta: terra\n      cor_primaria: "#7c2d12"\n      forma: arredondada'), "painel.sema");
  const css = gerarCss(r.ir!).map((arquivo) => arquivo.conteudo).join("\n");
  assert.ok(css.includes("--sema-cor-primaria: #7c2d12"), "primaria deve vir do design");
  assert.ok(css.includes("--sema-cor-fundo: #faf7f2"), "fundo deve vir da paleta terra");
  assert.ok(css.includes("--sema-raio: 0.75rem"), "forma arredondada deve mudar o raio");

  const semDesign = compilarCodigo("module demo.painel {\n}\n", "painel.sema");
  const cssPadrao = gerarCss(semDesign.ir!).map((a) => a.conteudo).join("\n");
  assert.ok(cssPadrao.includes("--sema-cor-primaria: #6366f1"), "sem design mantem o padrao atual");
});

test("pacote de tokens e emitido em cinco materializacoes quando ha design", () => {
  const r = compilarCodigo(CONTRATO("paleta: noturno"), "painel.sema");
  const arquivos = gerarDesignTokensArquivos(r.ir!, "typescript");
  const nomes = arquivos.map((a) => a.caminhoRelativo).sort();
  assert.deepEqual(nomes, [
    "design/_tokens.scss",
    "design/design-tokens.css",
    "design/tailwind.theme.js",
    "design/theme-tui.json",
    "design/tokens.js",
    "design/tokens.ts",
  ]);
  const tailwind = arquivos.find((a) => a.caminhoRelativo === "design/tailwind.theme.js")!.conteudo;
  assert.ok(tailwind.includes("#22d3ee"), "tailwind deve carregar a paleta noturna");

  const semDesign = compilarCodigo("module demo.painel {\n}\n", "painel.sema");
  assert.deepEqual(gerarDesignTokensArquivos(semDesign.ir!, "typescript"), []);
});

test("catalogo de presets e estavel e listavel", () => {
  const nomes = listarNomesDesign();
  assert.deepEqual(nomes.paletas, ["padrao", "terra", "floresta", "oceano", "noturno", "grafite", "neon", "pixel"]);
  assert.deepEqual(nomes.formas, ["reta", "padrao", "arredondada", "pill"]);
});
