// SEMA-GOVERNED: sema.produto.cli_dev_mode, sema.produto.cli_invocacao_publica.handlers
// Descrição: prova que o modo dev encontra o bin distribuído pelo URL do módulo, sem depender do cwd.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { resolverCaminhoBinCliDev } from "../../pacotes/cli/src/dev/index.ts";

test("modo dev resolve bin.js absoluto a partir do layout distribuído", () => {
  const raiz = path.join(path.parse(path.resolve(".")).root, "sema-layout-distribuido-teste");
  const urlDevDistribuido = pathToFileURL(
    path.join(raiz, "pacotes", "cli", "dist", "dev", "index.js"),
  ).href;

  const caminhoBin = resolverCaminhoBinCliDev(urlDevDistribuido);

  assert.equal(path.isAbsolute(caminhoBin), true);
  assert.equal(caminhoBin, path.join(raiz, "pacotes", "cli", "dist", "bin.js"));
  assert.notEqual(caminhoBin, path.resolve("pacotes", "cli", "dist", "bin.js"));
});
