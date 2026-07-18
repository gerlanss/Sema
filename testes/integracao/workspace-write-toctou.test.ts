// SEMA-GOVERNED: sema.produto.escrita_segura_workspace
// Descrição: prova que a escrita por handle detecta uma troca ABA no instante do rename baseado em caminho.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { escreverArquivoWorkspaceSeguro } from "../../pacotes/cli/src/workspaceWrite.ts";

test("escrita segura detecta troca ABA durante rename e não confirma sucesso", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-workspace-toctou-"));
  const repo = path.join(base, "repo");
  const diretorio = path.join(repo, "saida");
  const outside = path.join(base, "outside");
  const destino = path.join(diretorio, "resultado.txt");
  const backup = path.join(diretorio, "resultado.original.txt");
  const destinoExterno = path.join(outside, "resultado.txt");
  const renameOriginal = fs.promises.rename;
  let trocaInjetada = false;

  try {
    await Promise.all([
      mkdir(diretorio, { recursive: true }),
      mkdir(outside, { recursive: true }),
    ]);
    await writeFile(destino, "conteúdo original", "utf8");

    fs.promises.rename = async (origem, alvo) => {
      if (!trocaInjetada && path.resolve(alvo) === path.resolve(destino)) {
        trocaInjetada = true;
        await renameOriginal(destino, backup);
        await renameOriginal(origem, destino);
        await renameOriginal(destino, destinoExterno);
        await renameOriginal(backup, destino);
        return;
      }
      await renameOriginal(origem, alvo);
    };
    syncBuiltinESMExports();

    await assert.rejects(
      escreverArquivoWorkspaceSeguro(repo, "saida/resultado.txt", "conteúdo novo", {
        sobrescrever: true,
      }),
      (erro: unknown) => {
        assert.equal((erro as NodeJS.ErrnoException).code, "SEMA_WORKSPACE_TOCTOU");
        assert.match((erro as Error).message, /TOCTOU|integridade/i);
        return true;
      },
    );

    assert.equal(trocaInjetada, true);
    assert.equal(await readFile(destino, "utf8"), "conteúdo original");
    assert.equal(await readFile(destinoExterno, "utf8"), "conteúdo novo");
  } finally {
    fs.promises.rename = renameOriginal;
    syncBuiltinESMExports();
    await rm(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
});
