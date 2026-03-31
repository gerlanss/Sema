import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  DIRETORIOS_CODIGO_FUTEBOT_FIXTURE,
  criarProjetoBridgeDart,
  criarProjetoCppBridge,
  criarProjetoDotnetAspNet,
  criarProjetoFirebaseWorker,
  criarProjetoFlaskEstiloGestech,
  criarProjetoGoHttp,
  criarProjetoNextJsAppRouter,
  criarProjetoPythonEstiloFuteBot,
  criarProjetoRustAxum,
  criarProjetoSpringBoot,
} from "./futebot-fixture.ts";

const CLI = path.resolve("pacotes/cli/dist/index.js");

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
  assert.equal(json.modulos[0].alvos.length, 3);
  assert.deepEqual(json.modulos[0].alvos.map((alvo: { alvo: string }) => alvo.alvo), ["typescript", "python", "dart"]);
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
  assert.match(starter.stdout, /Sema, um Protocolo de Governanca de Intencao para IA e backend vivo/);
  assert.match(starter.stdout, /nao invente sintaxe/);
  assert.match(starter.stdout, /sema compilar <arquivo-ou-pasta> --alvo <typescript\|python\|dart> --saida <diretorio>/);

  const prompt = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "prompt-ia"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(prompt.status, 0, prompt.stderr || prompt.stdout);
  assert.match(prompt.stdout, /Prompt-base de IA da Sema/);
  assert.match(prompt.stdout, /Origem da instalacao:/);
  assert.match(prompt.stdout, /prompt-base-ia-sema\.md/);
  assert.match(prompt.stdout, /Trate a Sema como camada semantica e linguagem de especificacao executavel/);
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
  assert.match(ajuda.stdout, /sema compilar <arquivo-ou-pasta> --alvo <typescript\|python\|dart> --saida <diretorio>/);
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
    const drift = JSON.parse(await readFile(path.join(baseTemporaria, "drift.json"), "utf8"));
    const readme = await readFile(path.join(baseTemporaria, "README.md"), "utf8");

    assert.equal(validar.comando, "validar");
    assert.equal(validar.resultados[0].sucesso, true);
    assert.equal(ir.comando, "ir");
    assert.equal(ir.modulo, "exemplos.pagamento");
    assert.equal(drift.comando, "drift");
    assert.equal(drift.modulo, "exemplos.pagamento");
    assert.match(readme, /Contexto de IA para exemplos.pagamento/);
    assert.match(readme, /drift\.json/);
    assert.match(readme, /sema starter-ia/);
    assert.match(readme, /sema prompt-ia/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inspeciona projeto Python sem config com mesma base a partir de raiz, sema e arquivo", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-python-"));

  try {
    await criarProjetoPythonEstiloFuteBot(baseTemporaria);

    const entradas = [
      baseTemporaria,
      path.join(baseTemporaria, "sema"),
      path.join(baseTemporaria, "sema", "ciclo_previsao.sema"),
    ];

    const resultados = entradas.map((entrada) => {
      const execucao = spawnSync(
        "node",
        [CLI, "inspecionar", entrada, "--json"],
        { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
      );

      assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
      return JSON.parse(execucao.stdout);
    });

    for (const resultado of resultados) {
      assert.equal(resultado.configuracao.baseProjeto, baseTemporaria);
      assert.deepEqual(resultado.configuracao.origens, [path.join(baseTemporaria, "sema")]);
    }

    assert.deepEqual(resultados[0].configuracao.diretoriosCodigo, resultados[1].configuracao.diretoriosCodigo);
    assert.deepEqual(resultados[0].configuracao.diretoriosCodigo, resultados[2].configuracao.diretoriosCodigo);

    for (const diretorio of DIRETORIOS_CODIGO_FUTEBOT_FIXTURE) {
      assert.equal(resultados[0].configuracao.diretoriosCodigo.includes(path.join(baseTemporaria, diretorio)), true);
    }

    for (const ignorado of ["docs", "sema", "tests"]) {
      assert.equal(resultados[0].configuracao.diretoriosCodigo.includes(path.join(baseTemporaria, ignorado)), false);
    }
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inspeciona projeto Flask e detecta fonte legado correta", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-flask-"));

  try {
    await criarProjetoFlaskEstiloGestech(baseTemporaria);

    const execucao = spawnSync(
      "node",
      [CLI, "inspecionar", baseTemporaria, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.configuracao.baseProjeto, baseTemporaria);
    assert.deepEqual(json.configuracao.origens, [path.join(baseTemporaria, "contratos")]);
    assert.deepEqual(json.configuracao.diretoriosCodigo, [path.join(baseTemporaria, "Gestech")]);
    assert.equal(json.configuracao.fontesLegado.includes("flask"), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inspeciona projeto Next.js App Router e detecta fonte legado correta", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-nextjs-"));

  try {
    await criarProjetoNextJsAppRouter(baseTemporaria);

    const execucao = spawnSync(
      "node",
      [CLI, "inspecionar", baseTemporaria, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.configuracao.baseProjeto, baseTemporaria);
    assert.equal(json.configuracao.fontesLegado.includes("nextjs"), true);
    assert.equal(json.projeto.modulos[0].implementacao.rotasDivergentes.length, 0);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli resolve base de projeto sem config a partir de contratos e arquivo isolado", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-contratos-"));

  try {
    await criarProjetoNextJsAppRouter(baseTemporaria);
    await rm(path.join(baseTemporaria, "sema.config.json"), { force: true });

    const entradas = [
      baseTemporaria,
      path.join(baseTemporaria, "contratos"),
      path.join(baseTemporaria, "contratos", "next_http.sema"),
    ];

    const resultados = entradas.map((entrada) => {
      const execucao = spawnSync(
        "node",
        [CLI, "inspecionar", entrada, "--json"],
        { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
      );

      assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
      return JSON.parse(execucao.stdout);
    });

    for (const resultado of resultados) {
      assert.equal(resultado.configuracao.baseProjeto, baseTemporaria);
      assert.deepEqual(resultado.configuracao.origens, [path.join(baseTemporaria, "contratos")]);
      assert.equal(resultado.configuracao.fontesLegado.includes("nextjs"), true);
      assert.equal(resultado.configuracao.diretoriosCodigo.includes(path.join(baseTemporaria, "src")), true);
    }
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inspeciona projeto Firebase worker e detecta recurso vivo correto", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-firebase-"));

  try {
    await criarProjetoFirebaseWorker(baseTemporaria);

    const execucao = spawnSync(
      "node",
      [CLI, "inspecionar", baseTemporaria, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.configuracao.baseProjeto, baseTemporaria);
    assert.equal(json.configuracao.fontesLegado.includes("firebase"), true);
    assert.equal(json.projeto.modulos.some((modulo: { implementacao: { recursosValidos: number } }) => modulo.implementacao.recursosValidos >= 1), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli gera contexto de ia com drift python resolvido para arquivo dentro de sema", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-python-"));
  const pastaSaida = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-python-out-"));

  try {
    await criarProjetoPythonEstiloFuteBot(baseTemporaria);
    const arquivo = path.join(baseTemporaria, "sema", "ciclo_previsao.sema");

    const execucao = spawnSync(
      "node",
      [CLI, "contexto-ia", arquivo, "--saida", pastaSaida, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.sucesso, true);
    assert.equal(json.modulo, "futebot.previsao");

    const drift = JSON.parse(await readFile(path.join(pastaSaida, "drift.json"), "utf8"));
    const readme = await readFile(path.join(pastaSaida, "README.md"), "utf8");

    assert.equal(drift.comando, "drift");
    assert.equal(drift.modulo, "futebot.previsao");
    assert.equal(drift.resumo.implsValidos, 5);
    assert.equal(drift.resumo.implsQuebrados, 0);
    assert.equal(drift.drift.tasks.every((task: { implsQuebrados: number }) => task.implsQuebrados === 0), true);
    assert.match(readme, /drift\.json/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
    await rm(pastaSaida, { recursive: true, force: true });
  }
});

test("cli gera contexto de ia acionavel para bridge Dart consumidor", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-dart-"));
  const pastaSaida = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-dart-out-"));

  try {
    await criarProjetoBridgeDart(baseTemporaria);
    const arquivo = path.join(baseTemporaria, "contratos", "consumer_bridge.sema");

    const execucao = spawnSync(
      "node",
      [CLI, "contexto-ia", arquivo, "--saida", pastaSaida, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const drift = JSON.parse(await readFile(path.join(pastaSaida, "drift.json"), "utf8"));
    assert.equal(drift.resumo.implsQuebrados, 0);
    assert.equal(drift.resumo.implsValidos, 2);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
    await rm(pastaSaida, { recursive: true, force: true });
  }
});

test("cli inspeciona projeto backend-first com configuracao carregada", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-"));

  try {
    await writeFile(
      path.join(baseTemporaria, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./src"],
        fontesLegado: ["nestjs"],
        modoAdocao: "incremental",
        saida: "./generated/nestjs",
        alvos: ["typescript"],
        alvoPadrao: "typescript",
        estruturaSaida: "backend",
        framework: "nestjs",
      }, null, 2),
      "utf8",
    );
    await mkdir(path.join(baseTemporaria, "contratos"), { recursive: true });
    await writeFile(
      path.join(baseTemporaria, "contratos", "pedidos.sema"),
      `module app.pedidos {
  task criar_pedido {
    input {
      total: Decimal required
    }
    output {
      pedido_id: Id
    }
    guarantees {
      pedido_id existe
    }
    tests {
      caso "ok" {
        given {
          total: 10
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`,
      "utf8",
    );

    const execucao = spawnSync(
      "node",
      [CLI, "inspecionar", "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.comando, "inspecionar");
    assert.equal(json.configuracao.framework, "nestjs");
    assert.equal(json.configuracao.estruturaSaida, "backend");
    assert.deepEqual(json.configuracao.fontesLegado, ["nestjs"]);
    assert.equal(json.configuracao.modoAdocao, "incremental");
    assert.equal(json.configuracao.diretoriosCodigo[0], path.join(baseTemporaria, "src"));
    assert.equal(json.projeto.modulos[0].modulo, "app.pedidos");
    assert.equal(json.projeto.modulos[0].implementacao.implsValidos, 0);
    assert.equal(json.projeto.modulos[0].implementacao.tasksSemImplementacao, 1);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli compila usando sema.config para scaffold NestJS sem precisar de flags completas", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-backend-nest-"));

  try {
    const init = spawnSync(
      "node",
      [CLI, "iniciar", "--template", "nestjs"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const compilar = spawnSync(
      "node",
      [CLI, "compilar"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );

    assert.equal(compilar.status, 0, compilar.stderr || compilar.stdout);
    assert.match(compilar.stdout, /framework nestjs/);
    const contract = await readFile(path.join(baseTemporaria, "generated", "nestjs", "src", "app", "pedidos.contract.ts"), "utf8");
    const controller = await readFile(path.join(baseTemporaria, "generated", "nestjs", "src", "app", "pedidos.controller.ts"), "utf8");
    assert.match(contract, /Arquivo gerado automaticamente pela Sema/);
    assert.match(controller, /@Controller\(\)/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli compila usando sema.config para scaffold FastAPI sem precisar de flags completas", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-backend-fastapi-"));

  try {
    const init = spawnSync(
      "node",
      [CLI, "iniciar", "--template", "fastapi"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const compilar = spawnSync(
      "node",
      [CLI, "compilar"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );

    assert.equal(compilar.status, 0, compilar.stderr || compilar.stdout);
    assert.match(compilar.stdout, /framework fastapi/);
    const router = await readFile(path.join(baseTemporaria, "generated", "fastapi", "app", "app", "pedidos_router.py"), "utf8");
    const schemas = await readFile(path.join(baseTemporaria, "generated", "fastapi", "app", "app", "pedidos_schemas.py"), "utf8");
    assert.match(router, /APIRouter/);
    assert.match(schemas, /BaseModel/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inicia template Next.js API com trilha oficial de criacao", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-starter-nextjs-"));

  try {
    const init = spawnSync(
      "node",
      [CLI, "iniciar", "--template", "nextjs-api"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const contrato = await readFile(path.join(baseTemporaria, "contratos", "health.sema"), "utf8");
    const route = await readFile(path.join(baseTemporaria, "src", "app", "api", "health", "route.ts"), "utf8");
    assert.match(contrato, /ts: src\.app\.api\.health\.route\.GET/);
    assert.match(route, /export async function GET/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inicia template Node Firebase worker com bridge e recurso vivo", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-starter-firebase-"));

  try {
    const init = spawnSync(
      "node",
      [CLI, "iniciar", "--template", "node-firebase-worker"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const contrato = await readFile(path.join(baseTemporaria, "contratos", "worker_runtime.sema"), "utf8");
    const bridge = await readFile(path.join(baseTemporaria, "src", "sema_contract_bridge.ts"), "utf8");
    const collections = await readFile(path.join(baseTemporaria, "src", "config", "collections.ts"), "utf8");
    assert.match(contrato, /ts: src\.sema_contract_bridge\.semaWorkerHealthPayload/);
    assert.match(bridge, /semaCollectionNames/);
    assert.match(collections, /worker_status/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inicia templates backend genericos oficiais", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-starters-backend-"));

  try {
    for (const template of ["aspnet-api", "springboot-api", "go-http-api", "rust-axum-api", "cpp-service-bridge"]) {
      const destino = path.join(baseTemporaria, template);
      await mkdir(destino, { recursive: true });
      const init = spawnSync(
        "node",
        [CLI, "iniciar", "--template", template],
        { stdio: "pipe", encoding: "utf8", cwd: destino },
      );
      assert.equal(init.status, 0, `${template}\n${init.stderr || init.stdout}`);
      assert.equal((await readFile(path.join(destino, "sema.config.json"), "utf8")).length > 0, true);
      assert.equal((await readFile(path.join(destino, "README.md"), "utf8")).length > 0, true);
    }
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli doctor checa toolchain sem explodir", () => {
  const execucao = spawnSync(
    "node",
    [CLI, "doctor"],
    { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
  );

  assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
  assert.match(execucao.stdout, /Sema doctor/);
  assert.match(execucao.stdout, /node: ok/);
  assert.match(execucao.stdout, /npm: ok/);
});

test("cli inspeciona familias backend novas e detecta fontes corretas", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-backends-"));

  try {
    const cenarios = [
      { nome: "dotnet", criar: criarProjetoDotnetAspNet },
      { nome: "java", criar: criarProjetoSpringBoot },
      { nome: "go", criar: criarProjetoGoHttp },
      { nome: "rust", criar: criarProjetoRustAxum },
      { nome: "cpp", criar: criarProjetoCppBridge },
    ] as const;

    for (const cenario of cenarios) {
      const base = path.join(baseTemporaria, cenario.nome);
      await mkdir(base, { recursive: true });
      await cenario.criar(base);

      const execucao = spawnSync(
        "node",
        [CLI, "inspecionar", base, "--json"],
        { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
      );

      assert.equal(execucao.status, 0, `${cenario.nome}\n${execucao.stderr || execucao.stdout}`);
      const json = JSON.parse(execucao.stdout);
      assert.equal(json.configuracao.fontesLegado.includes(cenario.nome), true);
    }
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli resolve use em multiplas origens declaradas no sema.config", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-multiorigem-"));

  try {
    await mkdir(path.join(baseTemporaria, "contratos", "shared"), { recursive: true });
    await mkdir(path.join(baseTemporaria, "contratos", "app"), { recursive: true });
    await writeFile(
      path.join(baseTemporaria, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos/shared", "./contratos/app"],
        saida: "./generated",
        alvos: ["typescript"],
        framework: "base",
        estruturaSaida: "modulos",
      }, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(baseTemporaria, "contratos", "shared", "tipos.sema"),
      `module shared.tipos {
  entity Usuario {
    fields {
      id: Id
      nome: Texto
    }
  }
}
`,
      "utf8",
    );
    await writeFile(
      path.join(baseTemporaria, "contratos", "app", "cadastro.sema"),
      `module app.cadastro {
  use shared.tipos

  task registrar {
    input {
      usuario: Usuario required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          usuario: "u-1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`,
      "utf8",
    );

    const execucao = spawnSync(
      "node",
      [CLI, "compilar"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const contrato = await readFile(path.join(baseTemporaria, "generated", "app", "cadastro.ts"), "utf8");
    assert.match(contrato, /export type Usuario = any/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});
