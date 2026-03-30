import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

test("cli validar suporta saida json estavel", () => {
  const execucao = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "validar", "exemplos/calculadora.sema", "--json"],
    { stdio: "pipe", encoding: "utf8" },
  );

  assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
  const json = JSON.parse(execucao.stdout);
  assert.equal(json.comando, "validar");
  assert.equal(json.sucesso, true);
  assert.equal(json.resultados[0].modulo, "exemplos.calculadora");
});

test("cli verificar suporta resumo json estavel", () => {
  const execucao = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "verificar", "exemplos/calculadora.sema", "--json", "--saida", "./.tmp/verificacao-json-cli"],
    { stdio: "pipe", encoding: "utf8" },
  );

  assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
  const json = JSON.parse(execucao.stdout);
  assert.equal(json.comando, "verificar");
  assert.equal(json.sucesso, true);
  assert.equal(json.totais.modulos, 1);
  assert.equal(json.modulos[0].alvos.length, 2);
});

test("cli formatar em modo check falha quando arquivo esta fora do formato", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-format-"));
  const arquivo = path.join(baseTemporaria, "exemplo.sema");
  await writeFile(
    arquivo,
    `module exemplo.formatacao {\n  task eco {\n    guarantees {\n      mensagem existe\n    }\n    output {\n      mensagem: Texto\n    }\n    input {\n      mensagem: Texto required\n    }\n    tests {\n      caso "ok" {\n        expect {\n          sucesso: verdadeiro\n        }\n        given {\n          mensagem: "oi"\n        }\n      }\n    }\n  }\n}\n`,
    "utf8",
  );

  try {
    const check = spawnSync(
      "node",
      ["pacotes/cli/dist/index.js", "formatar", arquivo, "--check", "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );
    assert.equal(check.status, 1, check.stderr || check.stdout);
    const jsonCheck = JSON.parse(check.stdout);
    assert.equal(jsonCheck.comando, "formatar");
    assert.equal(jsonCheck.sucesso, false);
    assert.equal(jsonCheck.arquivos[0].alterado, true);

    const aplicar = spawnSync(
      "node",
      ["pacotes/cli/dist/index.js", "formatar", arquivo],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );
    assert.equal(aplicar.status, 0, aplicar.stderr || aplicar.stdout);

    const formatado = await readFile(arquivo, "utf8");
    assert.match(formatado, /input \{/);
    assert.match(formatado, /output \{/);

    const checkFinal = spawnSync(
      "node",
      ["pacotes/cli/dist/index.js", "formatar", arquivo, "--check"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );
    assert.equal(checkFinal.status, 0, checkFinal.stderr || checkFinal.stdout);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("extensao basica do VS Code declara linguagem, snippets e comando de formatacao", async () => {
  const pacote = JSON.parse(await readFile(path.resolve("pacotes/editor-vscode/package.json"), "utf8"));
  const gramatica = JSON.parse(await readFile(path.resolve("pacotes/editor-vscode/syntaxes/sema.tmLanguage.json"), "utf8"));
  const snippets = JSON.parse(await readFile(path.resolve("pacotes/editor-vscode/snippets/sema.code-snippets"), "utf8"));

  assert.equal(pacote.contributes.languages[0].id, "sema");
  assert.deepEqual(pacote.contributes.languages[0].extensions, [".sema"]);
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.formatarDocumento"));
  assert.match(JSON.stringify(gramatica), /module|task|flow|route|state/);
  assert.ok(snippets.module);
  assert.ok(snippets.task);
  assert.ok(snippets.flow);
  assert.ok(snippets.route);
  assert.ok(snippets.state);
});
