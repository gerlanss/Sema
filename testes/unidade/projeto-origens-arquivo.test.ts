// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.projeto
// Descricao: prova que origens aceita contrato .sema individual e que falhas de config ensinam a correcao.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { listarArquivosDeOrigens, resolverOrigensProjeto } from "../../pacotes/cli/src/projetoOrigens.js";
import { carregarConfiguracaoProjeto } from "../../pacotes/cli/src/projeto.js";

async function criarProjeto(): Promise<string> {
  const base = await mkdtemp(path.join(tmpdir(), "sema-origens-arquivo-"));
  await mkdir(path.join(base, "contratos"), { recursive: true });
  await writeFile(path.join(base, "contratos", "pedido.sema"), "module teste.pedido {\n}\n", "utf8");
  await writeFile(path.join(base, "solto.sema"), "module teste.solto {\n}\n", "utf8");
  await writeFile(path.join(base, "nao-sema.txt"), "texto\n", "utf8");
  return base;
}

test("origens aceita arquivo .sema individual do config antigo", async () => {
  const base = await criarProjeto();
  try {
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./solto.sema"],
      diretoriosCodigo: ["./src"],
    }), "utf8");
    const config = await carregarConfiguracaoProjeto(base);
    const origens = await resolverOrigensProjeto(base, base, config);
    assert.equal(origens.length, 1);
    assert.ok(origens[0]!.endsWith("solto.sema"));

    const arquivos = await listarArquivosDeOrigens(origens);
    assert.equal(arquivos.length, 1);
    assert.ok(arquivos[0]!.endsWith("solto.sema"));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("origens com arquivo nao .sema falha ensinando a correcao", async () => {
  const base = await criarProjeto();
  try {
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./nao-sema.txt"],
    }), "utf8");
    const config = await carregarConfiguracaoProjeto(base);
    await assert.rejects(
      () => resolverOrigensProjeto(base, base, config),
      /nao e um diretorio de contratos .*arquivo \.sema individual\. Corrija "origens"/u,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("diretoriosCodigo continua exigindo diretorio com mensagem clara", async () => {
  const base = await criarProjeto();
  try {
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./solto.sema"],
    }), "utf8");
    const { resolverDiretoriosCodigoConfigurados } = await import("../../pacotes/cli/src/projetoOrigens.js");
    const config = await carregarConfiguracaoProjeto(base);
    await assert.rejects(
      () => resolverDiretoriosCodigoConfigurados(base, config),
      /nao e um diretorio de codigo vivo/u,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("origens com diretorio segue funcionando", async () => {
  const base = await criarProjeto();
  try {
    await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
      origens: ["./contratos"],
    }), "utf8");
    const config = await carregarConfiguracaoProjeto(base);
    const origens = await resolverOrigensProjeto(base, base, config);
    const arquivos = await listarArquivosDeOrigens(origens);
    assert.equal(arquivos.length, 1);
    assert.ok(arquivos[0]!.endsWith(path.join("contratos", "pedido.sema")));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
