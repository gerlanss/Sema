// SEMA-GOVERNED: sema.produto.cli_toolchain_local
// Descrição: prova que sondagens idênticas de toolchain são executadas uma única vez por processo.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { comandoDisponivel } from "../../pacotes/cli/src/execucoesExternas.js";

test("comandoDisponivel reutiliza resultados positivos e negativos por argumentos", { concurrency: false }, async () => {
  const pastaTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-toolchain-cache-"));
  const arquivoSondagem = path.join(pastaTemporaria, "sondagem.mjs");
  const contadorSucesso = path.join(pastaTemporaria, "contador-sucesso.txt");
  const contadorFalha = path.join(pastaTemporaria, "contador-falha.txt");

  try {
    await writeFile(
      arquivoSondagem,
      [
        'import { appendFileSync } from "node:fs";',
        'appendFileSync(process.argv[2], "1", "utf8");',
        'process.exit(Number(process.argv[3] ?? "0"));',
        "",
      ].join("\n"),
      "utf8",
    );
    const argumentosSucesso = [arquivoSondagem, contadorSucesso, "0"];
    const argumentosFalha = [arquivoSondagem, contadorFalha, "1"];

    assert.equal(comandoDisponivel("node", argumentosSucesso), true);
    assert.equal(comandoDisponivel("node", argumentosSucesso), true);
    assert.equal(comandoDisponivel("node", argumentosFalha), false);
    assert.equal(comandoDisponivel("node", argumentosFalha), false);
    assert.equal(await readFile(contadorSucesso, "utf8"), "1");
    assert.equal(await readFile(contadorFalha, "utf8"), "1");
  } finally {
    await rm(pastaTemporaria, { recursive: true, force: true });
  }
});

test("comandoDisponivel refaz a sondagem quando o PATH muda", { concurrency: false }, () => {
  const pathOriginal = process.env.PATH;

  try {
    assert.equal(comandoDisponivel("node", ["--version"]), true);
    process.env.PATH = "";
    assert.equal(comandoDisponivel("node", ["--version"]), false);
  } finally {
    if (pathOriginal === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = pathOriginal;
    }
  }

  assert.equal(comandoDisponivel("node", ["--version"]), true);
});
