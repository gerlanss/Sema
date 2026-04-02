import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("contrato interno da extensao VS Code para operacao da CLI valida sem erro", () => {
  const caminhoContrato = path.resolve("contratos/sema/editor_vscode_operacao.sema");
  const execucao = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "validar", caminhoContrato, "--json"],
    { stdio: "pipe", encoding: "utf8" },
  );

  assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
  const json = JSON.parse(execucao.stdout);
  assert.equal(json.comando, "validar");
  assert.equal(json.resultados[0].sucesso, true);
  assert.equal(json.resultados[0].modulo, "sema.produto.editor_vscode_operacao");
});
