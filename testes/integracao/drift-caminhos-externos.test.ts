// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: prova a fronteira de workspace no fluxo E2E drift, impacto e renomeacao semantica.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analisarDriftLegado } from "../../pacotes/cli/src/drift.part11.js";
import { assistirRenomeacaoSemantica, gerarMapaImpactoSemantico } from "../../pacotes/cli/src/drift.part12.js";
import type { EventoOperacaoDrift } from "../../pacotes/cli/src/driftCatalogo.js";
import { carregarProjeto } from "../../pacotes/cli/src/projetoCarregar.js";

const SEGREDO_EXTERNO = "CONTEUDO_SECRETO_FORA_DO_WORKSPACE";

async function prepararBase(nome: string): Promise<string> {
  const base = await mkdtemp(path.join(os.tmpdir(), nome));
  await mkdir(path.join(base, "contratos"), { recursive: true });
  await mkdir(path.join(base, "app"), { recursive: true });
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
    diretoriosCodigo: ["./app"],
    fontesLegado: ["typescript"],
    pontuacaoSemanticaMinimaOperacional: 0,
    pontuacaoSemanticaAlvo: 0,
    pontuacaoSemanticaAlvoFinal: 0,
  }), "utf8");
  return base;
}

function assertNaoExpoeExterior(valor: unknown, diretorioExterno: string): void {
  const serializado = JSON.stringify(valor);
  const caminhoJson = JSON.stringify(diretorioExterno).slice(1, -1);
  assert.equal(serializado.includes(diretorioExterno), false);
  assert.equal(serializado.includes(diretorioExterno.replace(/\\/g, "/")), false);
  assert.equal(serializado.includes(caminhoJson), false);
  assert.equal(serializado.includes(SEGREDO_EXTERNO), false);
}

test("drift, impacto e renomeacao rejeitam arquivo absoluto externo sem expor caminho ou conteudo", async () => {
  const base = await prepararBase("sema-drift-cadeia-externa-");
  const externo = await mkdtemp(path.join(os.tmpdir(), "sema-drift-segredo-cadeia-"));
  try {
    const segredo = path.join(externo, "segredo.ts");
    await writeFile(segredo, `export const executar = "${SEGREDO_EXTERNO}";\n`, "utf8");
    await writeFile(path.join(base, "contratos", "externo.sema"), [
      "module app.externo {",
      `  vinculos { arquivo: "${segredo.replace(/\\/g, "/")}" }`,
      "  task executar {",
      "    output { ok: Booleano }",
      "    guarantees { ok existe }",
      "  }",
      "}",
      "",
    ].join("\n"), "utf8");

    const contexto = await carregarProjeto("contratos/externo.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });
    const eventos: EventoOperacaoDrift[] = [];
    const opcoes = { escopo: "modulo" as const, observador: (evento: EventoOperacaoDrift) => eventos.push(evento) };
    const drift = await analisarDriftLegado(contexto, opcoes);
    const impacto = await gerarMapaImpactoSemantico(contexto, "executar", "alterar executar", opcoes);
    const renomeacao = await assistirRenomeacaoSemantica(contexto, "executar", "executarSeguro", opcoes);

    assert.equal(drift.sucesso, false);
    assert.equal(drift.vinculos_validos.length, 0);
    assert.equal(drift.vinculos_quebrados[0]?.valor, "[fora_do_workspace]/segredo.ts");
    assert.equal(impacto.sucesso, false);
    assert.equal(impacto.arquivos.every((arquivo) => arquivo.arquivo.startsWith(base)), true);
    assert.equal(renomeacao.sucesso, false);
    assert.deepEqual(renomeacao.sugestoes, []);
    assert.deepEqual(eventos, []);
    assertNaoExpoeExterior(drift, externo);
    assertNaoExpoeExterior(impacto, externo);
    assertNaoExpoeExterior(renomeacao, externo);
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externo, { recursive: true, force: true });
  }
});

test("drift, impacto e renomeacao rejeitam junction externo sem ler o alvo", async (t) => {
  const base = await prepararBase("sema-drift-cadeia-junction-");
  const externo = await mkdtemp(path.join(os.tmpdir(), "sema-drift-segredo-junction-"));
  try {
    await writeFile(
      path.join(externo, "segredo.ts"),
      `export const executar = "${SEGREDO_EXTERNO}";\n`,
      "utf8",
    );
    try {
      await symlink(externo, path.join(base, "app", "escape"), process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES", "UNKNOWN", "ENOTSUP"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente nao permite criar junction/symlink para a regressao E2E");
        return;
      }
      throw erro;
    }
    await writeFile(path.join(base, "contratos", "junction.sema"), [
      "module app.junction {",
      "  vinculos { arquivo: \"app/escape/segredo.ts\" }",
      "  task executar {",
      "    output { ok: Booleano }",
      "    guarantees { ok existe }",
      "  }",
      "}",
      "",
    ].join("\n"), "utf8");

    const contexto = await carregarProjeto("contratos/junction.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });
    const eventos: EventoOperacaoDrift[] = [];
    const opcoes = { escopo: "modulo" as const, observador: (evento: EventoOperacaoDrift) => eventos.push(evento) };
    const drift = await analisarDriftLegado(contexto, opcoes);
    const impacto = await gerarMapaImpactoSemantico(contexto, "executar", "alterar executar", opcoes);
    const renomeacao = await assistirRenomeacaoSemantica(contexto, "executar", "executarSeguro", opcoes);

    assert.equal(drift.sucesso, false);
    assert.equal(drift.vinculos_validos.length, 0);
    assert.equal(drift.vinculos_quebrados[0]?.valor, "app/escape/segredo.ts");
    assert.equal(impacto.sucesso, false);
    assert.equal(impacto.arquivos.some((arquivo) => arquivo.arquivo.includes("escape")), false);
    assert.equal(renomeacao.sucesso, false);
    assert.deepEqual(renomeacao.sugestoes, []);
    assert.deepEqual(eventos, []);
    assertNaoExpoeExterior(drift, externo);
    assertNaoExpoeExterior(impacto, externo);
    assertNaoExpoeExterior(renomeacao, externo);
  } finally {
    await rm(base, { recursive: true, force: true });
    await rm(externo, { recursive: true, force: true });
  }
});

test("impacto de modulo usa somente contratos selecionados e arquivos planejados", async () => {
  const base = await prepararBase("sema-impacto-escopo-planejado-");
  try {
    await mkdir(path.join(base, "lateral"), { recursive: true });
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./app", "./lateral"],
      fontesLegado: ["typescript"],
      pontuacaoSemanticaMinimaOperacional: 0,
      pontuacaoSemanticaAlvo: 0,
      pontuacaoSemanticaAlvoFinal: 0,
    }), "utf8");
    await writeFile(path.join(base, "app", "alvo.ts"), [
      "// SEMA-GOVERNED: app.alvo",
      "export function executar() { return { ok: true }; }",
      "",
    ].join("\n"), "utf8");
    await writeFile(
      path.join(base, "lateral", "nao_tocar.ts"),
      "export function executar() { throw new Error('lateral'); }\n",
      "utf8",
    );
    await writeFile(path.join(base, "contratos", "alvo.sema"), `module app.alvo {
  vinculos { arquivo: "app/alvo.ts" }
  task executar {
    output { ok: Booleano }
    impl { ts: alvo.executar }
    guarantees { ok existe }
  }
}
`, "utf8");

    const contexto = await carregarProjeto("contratos/alvo.sema", base, {
      escopo: "modulo",
      adiarDescobertaCodigo: true,
    });
    const eventos: EventoOperacaoDrift[] = [];
    const impacto = await gerarMapaImpactoSemantico(contexto, "executar", "alterar executar", {
      escopo: "modulo",
      observador: (evento) => eventos.push(evento),
    });
    const serializado = JSON.stringify(impacto);

    assert.equal(impacto.sucesso, true);
    assert.equal(serializado.includes("nao_tocar.ts"), false);
    assert.equal(eventos.some((evento) => evento.caminho?.includes("lateral")), false);
    assert.deepEqual(
      impacto.arquivos.map((arquivo) => path.relative(base, arquivo.arquivo).replace(/\\/g, "/")).sort(),
      ["app/alvo.ts", "contratos/alvo.sema"],
    );

    const contextoProjeto = await carregarProjeto("contratos/alvo.sema", base, { escopo: "projeto" });
    const impactoProjeto = await gerarMapaImpactoSemantico(
      contextoProjeto,
      "executar",
      "alterar executar",
      { escopo: "projeto" },
    );
    assert.equal(
      impactoProjeto.arquivos.some((arquivo) => arquivo.arquivo.endsWith(path.join("lateral", "nao_tocar.ts"))),
      true,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
