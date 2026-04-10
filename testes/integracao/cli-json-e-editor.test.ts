import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  DIRETORIOS_CODIGO_FUTEBOT_FIXTURE,
  criarProjetoAngularConsumer,
  criarProjetoBridgeDart,
  criarProjetoCppBridge,
  criarProjetoDotnetAspNet,
  criarProjetoFirebaseWorker,
  criarProjetoFlaskEstiloGestech,
  criarProjetoGoHttp,
  criarProjetoNextJsAppRouter,
  criarProjetoNextJsConsumer,
  criarProjetoPythonEstiloFuteBot,
  criarProjetoReactViteConsumer,
  criarProjetoFlutterConsumer,
  criarProjetoRustAxum,
  criarProjetoSpringBoot,
} from "./futebot-fixture.ts";

const CLI = path.resolve("pacotes/cli/dist/index.js");
const require = createRequire(import.meta.url);
const { carregarProjetoParaDocumento } = require(path.resolve("pacotes/editor-vscode/project-loader.js"));

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
  const cliHelpers = await readFile(path.resolve("pacotes/editor-vscode/cli-helpers.js"), "utf8");
  const servidor = await readFile(path.resolve("pacotes/editor-vscode/server.js"), "utf8");
  const loaderProjeto = await readFile(path.resolve("pacotes/editor-vscode/project-loader.js"), "utf8");

  assert.equal(pacote.contributes.languages[0].id, "sema");
  assert.deepEqual(pacote.contributes.languages[0].extensions, [".sema"]);
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.formatarDocumento"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.reiniciarServidor"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.abrirStarterIa"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.abrirPromptIa"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.copiarPromptIa"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.abrirPromptCurtoAlvoAtual"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.abrirResumoAlvoAtual"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.abrirDriftAlvoAtual"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.prepararContextoIaProjeto"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.gerarContextoIaAlvoAtual"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.sincronizarEntrypointsIaProjeto"));
  assert.ok(pacote.contributes.commands.some((comando: { command: string }) => comando.command === "sema.diagnosticarCli"));
  assert.equal(pacote.contributes.viewsContainers.activitybar[0].id, "sema");
  assert.equal(pacote.contributes.views.sema[0].id, "semaSidebar");
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
  assert.match(extension, /cli-helpers/);
  assert.match(extension, /registerWebviewViewProvider/);
  assert.match(extension, /sema\.abrirStarterIa/);
  assert.match(extension, /sema\.copiarPromptIa/);
  assert.match(extension, /sema\.prepararContextoIaProjeto/);
  assert.match(extension, /sema\.gerarContextoIaAlvoAtual/);
  assert.match(extension, /sema\.sincronizarEntrypointsIaProjeto/);
  assert.match(extension, /semaSidebar/);
  assert.match(extension, /contexto-ia/);
  assert.match(extension, /sync-ai-entrypoints/);
  assert.match(extension, /SEMA_BRIEF\.md/);
  assert.match(extension, /SEMA_CONTEXT\.md/);
  assert.match(extension, /starter-ia/);
  assert.match(extension, /prompt-ia/);
  assert.match(extension, /prepararContextoPromptIaProjeto/);
  assert.match(extension, /Contexto IA do projeto copiado/);
  assert.match(cliHelpers, /configuracao sema\.cliPath/);
  assert.match(cliHelpers, /AppData do usuario no Windows/);
  assert.match(servidor, /createConnection/);
  assert.match(servidor, /documentFormattingProvider/);
  assert.match(servidor, /carregarProjetoParaDocumento/);
  assert.match(loaderProjeto, /resolverOrigensProjeto/);
});

test("extensao resolve use cross-module com contexto de projeto completo", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-editor-contexto-"));

  try {
    await writeFile(
      path.join(baseTemporaria, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
      }, null, 2),
      "utf8",
    );
    await mkdir(path.join(baseTemporaria, "contratos"), { recursive: true });

    await writeFile(
      path.join(baseTemporaria, "contratos", "user_stories.sema"),
      `module barbearia.user_stories {
  task agendar_via_whatsapp {
    input {
      cliente_id: Id required
    }
    output {
      agendamento_id: Id
    }
    guarantees {
      agendamento_id existe
    }
    error {
      horario_indisponivel: "Horario nao disponivel."
      servico_inexistente: "Servico nao encontrado."
      barbeiro_indisponivel: "Barbeiro nao esta disponivel."
    }
  }
}
`,
      "utf8",
    );

    const caminhoRotas = path.join(baseTemporaria, "contratos", "rotas.sema");
    const codigoRotas = `module barbearia.rotas {
  use barbearia.user_stories

  route agendar_whatsapp {
    metodo: POST
    caminho: /whatsapp/agendar
    task: agendar_via_whatsapp
    input {
      cliente_id: Id required
    }
    output {
      agendamento_id: Id required
    }
    error {
      horario_indisponivel: "Horario nao disponivel."
      servico_inexistente: "Servico nao encontrado."
      barbeiro_indisponivel: "Barbeiro nao esta disponivel."
    }
  }
}
`;
    await writeFile(caminhoRotas, codigoRotas, "utf8");

    const nucleo = await import(pathToFileURL(path.resolve("pacotes/nucleo/dist/index.js")).href);
    const carregado = await carregarProjetoParaDocumento({
      caminhoDocumento: caminhoRotas,
      textoAtual: codigoRotas,
      workspaceFolders: [baseTemporaria],
      documentosAbertos: new Map([[caminhoRotas, codigoRotas]]),
      nucleo,
    });

    assert.equal(carregado.baseProjeto, baseTemporaria);
    assert.deepEqual(carregado.origensProjeto, [path.join(baseTemporaria, "contratos")]);
    assert.equal(carregado.resultadoModulo?.modulo.nome, "barbearia.rotas");
    assert.deepEqual(
      carregado.resultadoModulo?.diagnosticos.filter((item: { codigo: string }) => item.codigo === "SEM018" || item.codigo === "SEM051"),
      [],
    );
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli expoe starter e prompt de ia", () => {
  const starter = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "starter-ia"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(starter.status, 0, starter.stderr || starter.stdout);
  assert.match(starter.stdout, /Starter de IA da Sema/);
  assert.match(starter.stdout, /Modo IA-first da instalacao atual/);
  assert.doesNotMatch(starter.stdout, /Origem da instalacao:/);
  assert.match(starter.stdout, /AGENT_STARTER\.md/);
  assert.match(starter.stdout, /Sema, um Protocolo de Governanca de Intencao para IA sobre software vivo em backend e front consumer/);
  assert.match(starter.stdout, /sema resumo/);
  assert.match(starter.stdout, /nao invente sintaxe/);
  assert.match(starter.stdout, /sema compilar <arquivo-ou-pasta> --alvo <typescript\|python\|dart\|lua> --saida <diretorio>/);

  const prompt = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "prompt-ia"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(prompt.status, 0, prompt.stderr || prompt.stdout);
  assert.match(prompt.stdout, /Prompt-base de IA da Sema/);
  assert.match(prompt.stdout, /Modo IA-first da instalacao atual/);
  assert.match(prompt.stdout, /prompt-base-ia-sema\.md/);
  assert.match(prompt.stdout, /Trate a Sema como camada semantica e linguagem de especificacao executavel/);
  assert.match(prompt.stdout, /1\. se o projeto expuser `SEMA_CONTEXT\.md`, comece por ele/);
  assert.match(prompt.stdout, /2\. `SEMA_BRIEF\.md`/);
  assert.match(prompt.stdout, /3\. `SEMA_INDEX\.json`/);
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
  assert.match(ajuda.stdout, /sema sync-ai-entrypoints/);
  assert.match(ajuda.stdout, /sema resumo <arquivo> --micro --para onboarding/);
  assert.match(ajuda.stdout, /sema prompt-curto <arquivo> --curto --para mudanca/);
  assert.match(ajuda.stdout, /sema prompt-ia-react/);
  assert.match(ajuda.stdout, /sema compilar <arquivo-ou-pasta> --alvo <typescript\|python\|dart\|lua> --saida <diretorio>/);
  assert.match(ajuda.stdout, /Tres jeitos de usar a Sema/);
  assert.match(ajuda.stdout, /Capacidade de IA/);
  assert.match(ajuda.stdout, /Projeto sem Sema ainda: importe, revise o rascunho/);
  assert.match(ajuda.stdout, /nao peca so HTML solto/);
});

test("cli organiza help publico por fluxo e capacidade", () => {
  const ajuda = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "--help"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(ajuda.status, 0, ajuda.stderr || ajuda.stdout);
  assert.match(ajuda.stdout, /Sema CLI v/);
  assert.match(ajuda.stdout, /Fluxos rapidos/);
  assert.match(ajuda.stdout, /Projeto novo \/ producao inicial/);
  assert.match(ajuda.stdout, /Editar projeto que ja usa Sema/);
  assert.match(ajuda.stdout, /Adotar Sema em projeto que ainda nao usa/);
  assert.match(ajuda.stdout, /IA por capacidade/);
  assert.match(ajuda.stdout, /pequena: sema resumo --micro/);
  assert.match(ajuda.stdout, /grande: sema contexto-ia \+ briefing\.json \+ ir\.json \+ ast\.json/);
});

test("cli gera resumo compacto e prompt curto para modulo", () => {
  const resumo = spawnSync(
    "node",
    [CLI, "resumo", "exemplos/pagamento.sema", "--micro", "--para", "mudanca", "--json"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(resumo.status, 0, resumo.stderr || resumo.stdout);
  const jsonResumo = JSON.parse(resumo.stdout);
  assert.equal(jsonResumo.comando, "resumo");
  assert.equal(jsonResumo.tamanho, "micro");
  assert.equal(jsonResumo.modulo, "exemplos.pagamento");
  assert.equal(jsonResumo.guiaPorCapacidade.pequena.artefatos.includes("briefing.min.json"), true);
  assert.match(jsonResumo.texto, /MODULO: exemplos.pagamento/);

  const promptCurto = spawnSync(
    "node",
    [CLI, "prompt-curto", "exemplos/pagamento.sema", "--curto", "--para", "mudanca"],
    { stdio: "pipe", encoding: "utf8" },
  );
  assert.equal(promptCurto.status, 0, promptCurto.stderr || promptCurto.stdout);
  assert.match(promptCurto.stdout, /Capacidade alvo: media/);
  assert.match(promptCurto.stdout, /Contexto compacto:/);
  assert.match(promptCurto.stdout, /MODULO: exemplos.pagamento/);
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
    assert.equal(json.artefatosCompactos.includes("briefing.min.json"), true);
    assert.equal(json.guiaPorCapacidade.pequena.artefatos.includes("resumo.micro.txt"), true);

    const validar = JSON.parse(await readFile(path.join(baseTemporaria, "validar.json"), "utf8"));
    const ir = JSON.parse(await readFile(path.join(baseTemporaria, "ir.json"), "utf8"));
    const drift = JSON.parse(await readFile(path.join(baseTemporaria, "drift.json"), "utf8"));
    const briefingMinimo = JSON.parse(await readFile(path.join(baseTemporaria, "briefing.min.json"), "utf8"));
    const resumoMicro = await readFile(path.join(baseTemporaria, "resumo.micro.txt"), "utf8");
    const readme = await readFile(path.join(baseTemporaria, "README.md"), "utf8");

    assert.equal(validar.comando, "validar");
    assert.equal(validar.resultados[0].sucesso, true);
    assert.equal(ir.comando, "ir");
    assert.equal(ir.modulo, "exemplos.pagamento");
    assert.equal(drift.comando, "drift");
    assert.equal(drift.modulo, "exemplos.pagamento");
    assert.equal(briefingMinimo.comando, "briefing-minimo");
    assert.match(resumoMicro, /MODULO: exemplos.pagamento/);
    assert.match(readme, /Contexto de IA para exemplos.pagamento/);
    assert.match(readme, /resumo\.micro\.txt/);
    assert.match(readme, /briefing\.min\.json/);
    assert.match(readme, /drift\.json/);
    assert.match(readme, /sema starter-ia/);
    assert.match(readme, /sema prompt-curto/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli gera resumo de projeto na raiz com arquivos SEMA_BRIEF", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-resumo-projeto-"));

  try {
    await writeFile(
      path.join(baseTemporaria, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./src"],
        fontesLegado: ["typescript"],
      }, null, 2),
      "utf8",
    );
    await mkdir(path.join(baseTemporaria, "contratos"), { recursive: true });
    await mkdir(path.join(baseTemporaria, "src"), { recursive: true });
    await writeFile(
      path.join(baseTemporaria, "contratos", "pedidos.sema"),
      `module app.pedidos {
  task criar_pedido {
    input {
      cliente_id: Id required
    }
    output {
      pedido_id: Id
    }
    impl {
      ts: app.pedidos.criarPedido
    }
    guarantees {
      pedido_id existe
    }
  }
}
`,
      "utf8",
    );
    await writeFile(
      path.join(baseTemporaria, "src", "pedidos.ts"),
      `export function criarPedido(cliente_id: string) {
  return { pedido_id: cliente_id };
}
`,
      "utf8",
    );

    const execucao = spawnSync(
      "node",
      [CLI, "resumo", baseTemporaria, "--curto", "--raiz", "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.comando, "resumo");
    assert.equal(json.artefatos.includes("SEMA_BRIEF.md"), true);
    assert.equal(await readFile(path.join(baseTemporaria, "SEMA_BRIEF.md"), "utf8").then((conteudo) => /Sema e IA-first/.test(conteudo)), true);
    const index = JSON.parse(await readFile(path.join(baseTemporaria, "SEMA_INDEX.json"), "utf8"));
    assert.equal(index.comando, "resumo-projeto");
    assert.deepEqual(index.entradaCanonica.porCapacidade.pequena, ["llms.txt", "SEMA_BRIEF.micro.txt", "SEMA_INDEX.json", "AGENTS.md"]);
    assert.equal(await readFile(path.join(baseTemporaria, "SEMA_BRIEF.micro.txt"), "utf8").then((conteudo) => /ENTRADA_IA: llms\.txt -> SEMA_BRIEF\.micro\.txt -> SEMA_INDEX\.json -> AGENTS\.md/.test(conteudo)), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli sincroniza entrypoints IA-first na raiz do projeto", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-sync-ia-"));

  try {
    await writeFile(
      path.join(baseTemporaria, "sema.config.json"),
      JSON.stringify({
        origens: ["./contratos"],
        diretoriosCodigo: ["./src"],
      }, null, 2),
      "utf8",
    );
    await mkdir(path.join(baseTemporaria, "contratos"), { recursive: true });
    await mkdir(path.join(baseTemporaria, "src"), { recursive: true });
    await writeFile(
      path.join(baseTemporaria, "contratos", "health.sema"),
      `module app.health {
  task ping {
    output {
      ok: Booleano
    }
    guarantees {
      ok existe
    }
  }
}
`,
      "utf8",
    );

    const execucao = spawnSync(
      "node",
      [CLI, "sync-ai-entrypoints", "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.comando, "sync-ai-entrypoints");
    assert.equal(json.sucesso, true);
    assert.deepEqual(json.entradaCanonica.porCapacidade.media, ["llms.txt", "SEMA_BRIEF.curto.txt", "SEMA_INDEX.json", "AGENTS.md", "README.md"]);
    assert.equal(await readFile(path.join(baseTemporaria, "SEMA_BRIEF.md"), "utf8").then((conteudo) => /Entrada canonica para IA/.test(conteudo)), true);
    assert.equal(await readFile(path.join(baseTemporaria, "SEMA_INDEX.json"), "utf8").then((conteudo) => /"entradaCanonica"/.test(conteudo)), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("repo expoe entrada canonica para IA na raiz", async () => {
  const agents = await readFile(path.resolve("AGENTS.md"), "utf8");
  const llms = await readFile(path.resolve("llms.txt"), "utf8");
  const llmsFull = await readFile(path.resolve("llms-full.txt"), "utf8");
  const semaBrief = await readFile(path.resolve("SEMA_BRIEF.md"), "utf8");
  const semaIndex = JSON.parse(await readFile(path.resolve("SEMA_INDEX.json"), "utf8"));
  const readme = await readFile(path.resolve("README.md"), "utf8");

  assert.match(agents, /sema_resumo/);
  assert.match(agents, /sema_drift/);
  assert.match(agents, /sema_validar/);
  assert.match(llms, /not human-first|not optimized for human-first/i);
  assert.match(llmsFull, /Canonical entrypoints in the repository root/);
  assert.match(semaBrief, /Entrada canonica para IA/);
  assert.deepEqual(semaIndex.entradaCanonica.ordemLeitura, ["llms.txt", "SEMA_BRIEF.md", "SEMA_INDEX.json", "AGENTS.md", "README.md", "llms-full.txt"]);
  assert.match(readme, /## Documentacao canonica/);
  assert.match(readme, /persistencia vendor-first/i);
});

test("repo expoe scorecard e guia de persistencia vendor-first atualizados", async () => {
  const scorecard = await readFile(path.resolve("docs/scorecard-compatibilidade.md"), "utf8");
  const persistencia = await readFile(path.resolve("docs/persistencia-vendor-first.md"), "utf8");

  assert.match(scorecard, /Estados de compatibilidade/);
  assert.match(scorecard, /`nativo`/);
  assert.match(scorecard, /`adaptado`/);
  assert.match(scorecard, /`parcial`/);
  assert.match(scorecard, /`invalido`/);
  assert.match(scorecard, /\| `postgres` \|/);
  assert.match(scorecard, /\| `redis` \|/);
  assert.match(persistencia, /Persistencia Vendor-First/);
  assert.match(persistencia, /database principal_postgres/);
  assert.match(persistencia, /database principal_mongodb/);
  assert.match(persistencia, /database principal_redis/);
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

test("cli inspeciona projeto Next.js consumer e expõe sinais consumer no JSON", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-nextjs-consumer-"));

  try {
    await criarProjetoNextJsConsumer(baseTemporaria);

    const execucao = spawnSync(
      "node",
      [CLI, "inspecionar", baseTemporaria, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.configuracao.baseProjeto, baseTemporaria);
    assert.equal(json.configuracao.fontesLegado.includes("nextjs-consumer"), true);
    assert.equal(json.configuracao.consumerFramework, "nextjs-consumer");
    assert.equal(json.configuracao.appRoutes.includes("/ranking"), true);
    assert.equal(json.configuracao.consumerBridges.some((bridge: { caminho: string }) => bridge.caminho === "src.lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inspeciona projeto React Vite consumer e expõe sinais consumer no JSON", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-react-vite-consumer-"));

  try {
    await criarProjetoReactViteConsumer(baseTemporaria);

    const execucao = spawnSync(
      "node",
      [CLI, "inspecionar", baseTemporaria, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.configuracao.fontesLegado.includes("react-vite-consumer"), true);
    assert.equal(json.configuracao.consumerFramework, "react-vite-consumer");
    assert.equal(json.configuracao.appRoutes.includes("/ranking"), true);
    assert.equal(json.configuracao.consumerBridges.some((bridge: { caminho: string }) => bridge.caminho === "src.lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inspeciona projeto Angular consumer e expõe sinais consumer no JSON", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-angular-consumer-"));

  try {
    await criarProjetoAngularConsumer(baseTemporaria);

    const execucao = spawnSync(
      "node",
      [CLI, "inspecionar", baseTemporaria, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.configuracao.fontesLegado.includes("angular-consumer"), true);
    assert.equal(json.configuracao.consumerFramework, "angular-consumer");
    assert.equal(json.configuracao.appRoutes.includes("/ranking"), true);
    assert.equal(json.configuracao.consumerBridges.some((bridge: { caminho: string }) => bridge.caminho === "src.app.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inspeciona projeto Flutter consumer e expõe sinais consumer no JSON", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-inspecionar-flutter-consumer-"));

  try {
    await criarProjetoFlutterConsumer(baseTemporaria);

    const execucao = spawnSync(
      "node",
      [CLI, "inspecionar", ".", "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    const json = JSON.parse(execucao.stdout);
    assert.equal(json.configuracao.fontesLegado.includes("flutter-consumer"), true);
    assert.equal(json.configuracao.consumerFramework, "flutter-consumer");
    assert.equal(json.configuracao.appRoutes.includes("/ranking"), true);
    assert.equal(json.configuracao.consumerBridges.some((bridge: { caminho: string }) => bridge.caminho === "lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
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

test("cli gera contexto de ia acionavel para Next.js consumer com bridge e superficies", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-nextjs-consumer-"));
  const pastaSaida = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-nextjs-consumer-out-"));

  try {
    await criarProjetoNextJsConsumer(baseTemporaria);
    const arquivo = path.join(baseTemporaria, "contratos", "showroom_consumer.sema");

    const execucao = spawnSync(
      "node",
      [CLI, "contexto-ia", arquivo, "--saida", pastaSaida, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const drift = JSON.parse(await readFile(path.join(pastaSaida, "drift.json"), "utf8"));
    const briefing = JSON.parse(await readFile(path.join(pastaSaida, "briefing.json"), "utf8"));
    const briefingMin = JSON.parse(await readFile(path.join(pastaSaida, "briefing.min.json"), "utf8"));

    assert.equal(drift.drift.consumerFramework, "nextjs-consumer");
    assert.equal(drift.drift.appRoutes.includes("/ranking"), true);
    assert.equal(drift.resumo.consumerFramework, "nextjs-consumer");
    assert.equal(drift.resumo.consumerBridges.some((item: string) => item === "src.lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
    assert.equal(briefing.consumerFramework, "nextjs-consumer");
    assert.equal(briefing.appRoutes.includes("/ranking"), true);
    assert.equal(briefing.consumerSurfaces.some((item: string) => item.includes("page:/ranking")), true);
    assert.equal(briefingMin.consumerFramework, "nextjs-consumer");
    assert.equal(briefingMin.appRoutes.includes("/ranking"), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
    await rm(pastaSaida, { recursive: true, force: true });
  }
});

test("cli gera contexto de ia acionavel para React Vite consumer com bridge e superfícies", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-react-vite-consumer-"));
  const pastaSaida = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-react-vite-consumer-out-"));

  try {
    await criarProjetoReactViteConsumer(baseTemporaria);
    const arquivo = path.join(baseTemporaria, "contratos", "showroom_consumer.sema");

    const execucao = spawnSync(
      "node",
      [CLI, "contexto-ia", arquivo, "--saida", pastaSaida, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const drift = JSON.parse(await readFile(path.join(pastaSaida, "drift.json"), "utf8"));
    const briefing = JSON.parse(await readFile(path.join(pastaSaida, "briefing.json"), "utf8"));

    assert.equal(drift.drift.consumerFramework, "react-vite-consumer");
    assert.equal(drift.drift.appRoutes.includes("/ranking"), true);
    assert.equal(briefing.consumerFramework, "react-vite-consumer");
    assert.equal(briefing.consumerBridges.some((item: string) => item === "src.lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
    await rm(pastaSaida, { recursive: true, force: true });
  }
});

test("cli gera contexto de ia acionavel para Angular consumer com bridge e superfícies", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-angular-consumer-"));
  const pastaSaida = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-angular-consumer-out-"));

  try {
    await criarProjetoAngularConsumer(baseTemporaria);
    const arquivo = path.join(baseTemporaria, "contratos", "showroom_consumer.sema");

    const execucao = spawnSync(
      "node",
      [CLI, "contexto-ia", arquivo, "--saida", pastaSaida, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const drift = JSON.parse(await readFile(path.join(pastaSaida, "drift.json"), "utf8"));
    const briefing = JSON.parse(await readFile(path.join(pastaSaida, "briefing.json"), "utf8"));

    assert.equal(drift.drift.consumerFramework, "angular-consumer");
    assert.equal(drift.drift.appRoutes.includes("/ranking"), true);
    assert.equal(briefing.consumerFramework, "angular-consumer");
    assert.equal(briefing.consumerBridges.some((item: string) => item === "src.app.sema_consumer_bridge.semaFetchShowroomRanking"), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
    await rm(pastaSaida, { recursive: true, force: true });
  }
});

test("cli gera contexto de ia acionavel para Flutter consumer com bridge e superfícies", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-flutter-consumer-"));
  const pastaSaida = await mkdtemp(path.join(os.tmpdir(), "sema-contexto-flutter-consumer-out-"));

  try {
    await criarProjetoFlutterConsumer(baseTemporaria);
    const arquivo = path.join(baseTemporaria, "contratos", "showroom_consumer.sema");

    const execucao = spawnSync(
      "node",
      [CLI, "contexto-ia", arquivo, "--saida", pastaSaida, "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );

    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const drift = JSON.parse(await readFile(path.join(pastaSaida, "drift.json"), "utf8"));
    const briefing = JSON.parse(await readFile(path.join(pastaSaida, "briefing.json"), "utf8"));

    assert.equal(drift.drift.consumerFramework, "flutter-consumer");
    assert.equal(drift.drift.appRoutes.includes("/ranking"), true);
    assert.equal(briefing.consumerFramework, "flutter-consumer");
    assert.equal(briefing.consumerBridges.some((item: string) => item === "lib.sema_consumer_bridge.semaFetchShowroomRanking"), true);
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

test("cli verificar usa framework e estruturaSaida do sema.config para scaffold NestJS", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-verificar-nest-"));

  try {
    const init = spawnSync(
      "node",
      [CLI, "iniciar", "--template", "nestjs"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const verificar = spawnSync(
      "node",
      [CLI, "verificar", "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );

    assert.equal(verificar.status, 0, verificar.stderr || verificar.stdout);
    const json = JSON.parse(verificar.stdout);
    assert.equal(json.comando, "verificar");
    assert.equal(json.sucesso, true);
    assert.equal(json.modulos[0].alvos[0].framework, "nestjs");
    assert.equal(json.modulos[0].alvos[0].estrutura, "backend");
    assert.equal(json.modulos[0].alvos[0].testesExecutados, false);
    assert.equal(json.totais.testes, 0);

    const contract = await readFile(path.join(baseTemporaria, ".tmp", "sema-verificar", "typescript", "pedidos", "src", "app", "pedidos.contract.ts"), "utf8");
    const controller = await readFile(path.join(baseTemporaria, ".tmp", "sema-verificar", "typescript", "pedidos", "src", "app", "pedidos.controller.ts"), "utf8");
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

test("cli inicia template Next.js consumer com bridge canonico e superfícies App Router", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-starter-nextjs-consumer-"));

  try {
    const init = spawnSync(
      "node",
      [CLI, "iniciar", "--template", "nextjs-consumer"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const contrato = await readFile(path.join(baseTemporaria, "contratos", "showroom_consumer.sema"), "utf8");
    const bridge = await readFile(path.join(baseTemporaria, "src", "lib", "sema_consumer_bridge.ts"), "utf8");
    const page = await readFile(path.join(baseTemporaria, "src", "app", "ranking", "page.tsx"), "utf8");
    assert.match(contrato, /ts: src\.lib\.sema_consumer_bridge\.semaFetchShowroomRanking/);
    assert.match(contrato, /superficie: "\/ranking"/);
    assert.match(bridge, /export async function semaFetchShowroomRanking/);
    assert.match(page, /RankingPage/);

    const inspecao = spawnSync(
      "node",
      [CLI, "inspecionar", ".", "--json"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(inspecao.status, 0, inspecao.stderr || inspecao.stdout);
    const json = JSON.parse(inspecao.stdout);
    assert.equal(json.configuracao.fontesLegado.includes("nextjs-consumer"), true);
    assert.equal(json.configuracao.consumerFramework, "nextjs-consumer");
    assert.equal(json.configuracao.appRoutes.includes("/ranking"), true);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inicia template React Vite consumer com bridge canonico e páginas consumer", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-starter-react-vite-consumer-"));

  try {
    const init = spawnSync(
      "node",
      [CLI, "iniciar", "--template", "react-vite-consumer"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const contrato = await readFile(path.join(baseTemporaria, "contratos", "showroom_consumer.sema"), "utf8");
    const bridge = await readFile(path.join(baseTemporaria, "src", "lib", "sema_consumer_bridge.ts"), "utf8");
    const page = await readFile(path.join(baseTemporaria, "src", "pages", "ranking.tsx"), "utf8");
    assert.match(contrato, /ts: src\.lib\.sema_consumer_bridge\.semaFetchShowroomRanking/);
    assert.match(contrato, /superficie: "\/ranking"/);
    assert.match(bridge, /export async function semaFetchShowroomRanking/);
    assert.match(page, /RankingPage/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inicia template Angular consumer com bridge canonico e route config", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-starter-angular-consumer-"));

  try {
    const init = spawnSync(
      "node",
      [CLI, "iniciar", "--template", "angular-consumer"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const contrato = await readFile(path.join(baseTemporaria, "contratos", "showroom_consumer.sema"), "utf8");
    const bridge = await readFile(path.join(baseTemporaria, "src", "app", "sema_consumer_bridge.ts"), "utf8");
    const routes = await readFile(path.join(baseTemporaria, "src", "app", "app.routes.ts"), "utf8");
    assert.match(contrato, /ts: src\.app\.sema_consumer_bridge\.semaFetchShowroomRanking/);
    assert.match(contrato, /superficie: "\/ranking"/);
    assert.match(bridge, /export async function semaFetchShowroomRanking/);
    assert.match(routes, /loadChildren: \(\) => import\("\.\/features\/ranking\/ranking\.routes"\)/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli inicia template Flutter consumer com bridge canonico e router", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-starter-flutter-consumer-"));

  try {
    const init = spawnSync(
      "node",
      [CLI, "iniciar", "--template", "flutter-consumer"],
      { stdio: "pipe", encoding: "utf8", cwd: baseTemporaria },
    );
    assert.equal(init.status, 0, init.stderr || init.stdout);

    const contrato = await readFile(path.join(baseTemporaria, "contratos", "showroom_consumer.sema"), "utf8");
    const bridge = await readFile(path.join(baseTemporaria, "lib", "sema_consumer_bridge.dart"), "utf8");
    const router = await readFile(path.join(baseTemporaria, "lib", "router.dart"), "utf8");
    assert.match(contrato, /dart: lib\.sema_consumer_bridge\.semaFetchShowroomRanking/);
    assert.match(contrato, /superficie: "\/ranking"/);
    assert.match(bridge, /Future<Map<String, dynamic>> semaFetchShowroomRanking/);
    assert.match(router, /GoRoute\(/);
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
