// SEMA-GOVERNED: sema.produto.governanca_ia.documentacao, sema.produto.escrita_segura_workspace
// Descricao: prova que a criacao automatica de docs valida o lote inteiro antes da primeira escrita.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolverDocumentacaoObrigatoria } from "../../pacotes/cli/src/docs.part02.ts";

test("docs-impacto --criar-ausentes recusa junction antes de escrever qualquer item do lote", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-docs-impacto-junction-"));
  const repo = path.join(base, "repo");
  const docs = path.join(repo, "docs");
  const outside = path.join(base, "outside");

  try {
    await Promise.all([
      mkdir(docs, { recursive: true }),
      mkdir(outside, { recursive: true }),
    ]);
    await symlink(outside, path.join(docs, "env.md"), process.platform === "win32" ? "junction" : "dir");

    await assert.rejects(
      resolverDocumentacaoObrigatoria({
        baseProjeto: repo,
        intencao: "fazer deploy",
        criarAusentes: true,
      }),
      /symlink|junction/i,
    );

    assert.equal(existsSync(path.join(docs, "deploy.md")), false);
    assert.equal(existsSync(path.join(docs, "rollback.md")), false);
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
});
