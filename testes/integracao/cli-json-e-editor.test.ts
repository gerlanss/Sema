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
  const extension = await readFile(path.resolve("pacotes/editor-vscode/extension.js"), "utf8");
  const servidor = await readFile(path.resolve("pacotes/editor-vscode/server.js"), "utf8");

  assert.equal(pacote.contributes.languages[0].id, "sema");
  assert.deepEqual(pacote.contributes.languages[0].extensions, [".sema"]);
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.formatarDocumento"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.reiniciarServidor"));
  assert.equal(pacote.contributes.configuration.properties["sema.cliPath"].type, "string");
  assert.equal(pacote.contributes.configuration.properties["sema.diagnosticosAoDigitar"].type, "boolean");
  assert.match(JSON.stringify(gramatica), /module|task|flow|route|state/);
  assert.ok(snippets.module);
  assert.ok(snippets.task);
  assert.ok(snippets.flow);
  assert.ok(snippets.route);
  assert.ok(snippets.state);
  assert.equal(typeof pacote.dependencies["vscode-languageclient"], "string");
  assert.equal(typeof pacote.dependencies["vscode-languageserver"], "string");
  assert.equal(typeof pacote.dependencies["@sema/nucleo"], "string");
  assert.match(extension, /LanguageClient/);
  assert.match(extension, /sema\.cliPath/);
  assert.match(servidor, /createConnection/);
  assert.match(servidor, /documentFormattingProvider/);
});

test("cli expoe starter e prompt de ia", () => {
  const starter = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "starter-ia"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(starter.status, 0, starter.stderr || starter.stdout);
  assert.match(starter.stdout, /Starter de IA da Sema/);
  assert.match(starter.stdout, /Origem da instalacao:/);
  assert.match(starter.stdout, /Documentos locais encontrados:/);
  assert.match(starter.stdout, /AGENT_STARTER\.md/);
  assert.match(starter.stdout, /Sema, uma DSL semantica orientada a contrato/);
  assert.match(starter.stdout, /nao invente sintaxe/);

  const prompt = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "prompt-ia"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(prompt.status, 0, prompt.stderr || prompt.stdout);
  assert.match(prompt.stdout, /Prompt-base de IA da Sema/);
  assert.match(prompt.stdout, /Origem da instalacao:/);
  assert.match(prompt.stdout, /prompt-base-ia-sema\.md/);
  assert.match(prompt.stdout, /Trate a Sema como linguagem de especificacao executavel/);
  assert.match(prompt.stdout, /use o formatador oficial da Sema como fonte unica de estilo/);
});

test("cli expoe ajuda de ia com mapa de comandos", () => {
  const ajuda = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "ajuda-ia"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(ajuda.status, 0, ajuda.stderr || ajuda.stdout);
  assert.match(ajuda.stdout, /Ajuda de IA da Sema/);
  assert.match(ajuda.stdout, /sema starter-ia/);
  assert.match(ajuda.stdout, /sema prompt-ia-react/);
  assert.match(ajuda.stdout, /nao peca so HTML solto/);
});

test("cli expoe prompts especializados para ui e sema primeiro", () => {
  const promptUi = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "prompt-ia-ui"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(promptUi.status, 0, promptUi.stderr || promptUi.stdout);
  assert.match(promptUi.stdout, /Prompt de IA da Sema para UI/);
  assert.match(promptUi.stdout, /React \+ TypeScript/);
  assert.match(promptUi.stdout, /nao entregue apenas HTML solto em arquivo unico/);

  const promptSemaPrimeiro = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "prompt-ia-sema-primeiro"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(promptSemaPrimeiro.status, 0, promptSemaPrimeiro.stderr || promptSemaPrimeiro.stdout);
  assert.match(promptSemaPrimeiro.stdout, /Prompt de IA da Sema no modo Sema primeiro/);
  assert.match(promptSemaPrimeiro.stdout, /Sema primeiro/);
  assert.match(promptSemaPrimeiro.stdout, /modele primeiro o dominio em arquivos `.sema`|modele primeiro o dominio em arquivos \`.sema\`/);

  const promptReact = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "prompt-ia-react"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(promptReact.status, 0, promptReact.stderr || promptReact.stdout);
  assert.match(promptReact.stdout, /Prompt de IA da Sema para React/);
  assert.match(promptReact.stdout, /Sema \+ React \+ TypeScript/);
  assert.match(promptReact.stdout, /arquitetura de pastas do frontend/);
});

test("cli expoe exemplos de prompt prontos", () => {
  const exemplos = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "exemplos-prompt-ia"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(exemplos.status, 0, exemplos.stderr || exemplos.stdout);
  assert.match(exemplos.stdout, /Exemplos de prompt de IA da Sema/);
  assert.match(exemplos.stdout, /Sema \+ React \+ TypeScript/);
  assert.match(exemplos.stdout, /Revisar ou corrigir um modulo Sema/);
  assert.match(exemplos.stdout, /Nao transforme isso em um `index\.html` solto/);
});

test("cli gera pacote de contexto de ia para modulo com use", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-ia-"));

  try {
    const execucao = spawnSync(
      "node",
      ["pacotes/cli/dist/index.js", "contexto-ia", "exemplos/pagamento.sema", "--saida", baseTemporaria, "--json"],
      { stdio: "pipe", encoding: "utf8" },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.sucesso, true);
    assert.equal(json.modulo, "exemplos.pagamento");

    const validar = JSON.parse(await readFile(path.join(baseTemporaria, "validar.json"), "utf8"));
    const ir = JSON.parse(await readFile(path.join(baseTemporaria, "ir.json"), "utf8"));
    const readme = await readFile(path.join(baseTemporaria, "README.md"), "utf8");

    assert.equal(validar.comando, "validar");
    assert.equal(validar.resultados[0].sucesso, true);
    assert.equal(ir.comando, "ir");
    assert.equal(ir.modulo, "exemplos.pagamento");
    assert.match(readme, /Contexto de IA para exemplos.pagamento/);
    assert.match(readme, /sema starter-ia/);
    assert.match(readme, /sema prompt-ia/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});
