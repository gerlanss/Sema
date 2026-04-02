const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");
const { execFile } = require("node:child_process");
const { basename } = require("node:path");
const { promisify } = require("node:util");
const {
  executarCandidato,
  obterCandidatosCli,
} = require("./cli-helpers");

const executarArquivo = promisify(execFile);
const TAMANHO_BUFFER_PADRAO = 8 * 1024 * 1024;
const TTL_CACHE_CLI_MS = 5000;

let clienteLinguagem = undefined;
let canalSaida = undefined;
let provedorSidebar = undefined;
let cacheEstadoCli = undefined;

function obterRaizWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function obterNomeWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.name ?? "Nenhuma pasta aberta";
}

function obterDocumentoAtivo() {
  return vscode.window.activeTextEditor?.document;
}

function obterAlvoAtual() {
  const documento = obterDocumentoAtivo();
  if (!documento || documento.isUntitled || documento.uri.scheme !== "file") {
    return undefined;
  }
  return documento.uri.fsPath;
}

function obterAlvoSemaAtual() {
  const documento = obterDocumentoAtivo();
  if (!documento || documento.isUntitled || documento.uri.scheme !== "file") {
    return undefined;
  }
  if (documento.languageId === "sema" || documento.uri.fsPath.toLowerCase().endsWith(".sema")) {
    return documento.uri.fsPath;
  }
  return undefined;
}

function obterAlvoPreferencial() {
  return obterAlvoSemaAtual() ?? obterRaizWorkspace() ?? obterAlvoAtual();
}

function invalidarCacheCli() {
  cacheEstadoCli = undefined;
}

function escreverNoCanalSaida(titulo, texto) {
  if (!canalSaida) {
    return;
  }
  canalSaida.appendLine(`=== ${titulo} ===`);
  canalSaida.appendLine(texto);
  canalSaida.appendLine("");
}

async function descobrirShellResolvedPath() {
  try {
    if (process.platform === "win32") {
      const resultado = await executarArquivo("where.exe", ["sema"], {
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
      return String(resultado.stdout ?? "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .find(Boolean);
    }

    const resultado = await executarArquivo("which", ["sema"], {
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    return String(resultado.stdout ?? "").trim() || undefined;
  } catch {
    return undefined;
  }
}

async function descobrirPrefixoGlobalNpm() {
  try {
    const resultado = await executarArquivo("npm", ["prefix", "-g"], {
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    return String(resultado.stdout ?? "").trim() || undefined;
  } catch {
    return undefined;
  }
}

async function obterCandidatosCliResolvidos() {
  const configuracao = vscode.workspace.getConfiguration("sema");
  const cliConfigurada = configuracao.get("cliPath");
  const raizWorkspace = obterRaizWorkspace();
  const [shellResolvedPath, globalPrefix] = await Promise.all([
    descobrirShellResolvedPath(),
    descobrirPrefixoGlobalNpm(),
  ]);

  return obterCandidatosCli({
    cliConfigurada,
    workspaceRoot: raizWorkspace,
    shellResolvedPath,
    globalPrefix,
  });
}

async function resolverEstadoCli(forcar = false) {
  if (!forcar && cacheEstadoCli && Date.now() - cacheEstadoCli.geradoEm < TTL_CACHE_CLI_MS) {
    return cacheEstadoCli;
  }

  const candidatos = await obterCandidatosCliResolvidos();
  const erros = [];

  for (const candidato of candidatos) {
    try {
      const resultado = await executarCandidato(candidato, ["--version"], {
        cwd: obterRaizWorkspace(),
        windowsHide: true,
        timeout: 15000,
        encoding: "utf8",
        maxBuffer: TAMANHO_BUFFER_PADRAO,
      });

      cacheEstadoCli = {
        geradoEm: Date.now(),
        pronto: true,
        versao: String(resultado.stdout ?? "").trim() || "desconhecida",
        origem: candidato.origem,
        candidato,
        candidatos,
        erros,
      };
      return cacheEstadoCli;
    } catch (erro) {
      erros.push({ candidato, erro });
    }
  }

  cacheEstadoCli = {
    geradoEm: Date.now(),
    pronto: false,
    versao: null,
    origem: null,
    candidato: null,
    candidatos,
    erros,
  };
  return cacheEstadoCli;
}

async function executarCliSema(argumentos, opcoes = {}) {
  const raizWorkspace = obterRaizWorkspace();
  const erros = [];

  for (const candidato of await obterCandidatosCliResolvidos()) {
    try {
      return await executarCandidato(candidato, argumentos, {
        cwd: raizWorkspace,
        windowsHide: true,
        maxBuffer: TAMANHO_BUFFER_PADRAO,
        encoding: "utf8",
        ...opcoes,
      });
    } catch (erro) {
      erros.push({ candidato, erro });
    }
  }

  const detalhes = erros
    .map(({ candidato, erro }) => {
      const mensagem = erro && typeof erro === "object" && "message" in erro ? erro.message : String(erro);
      return `- ${candidato.origem}: ${mensagem}`;
    })
    .join("\n");

  throw new Error(`Nao foi possivel executar a CLI da Sema.\n${detalhes}`);
}

async function abrirConteudoTemporario(conteudo, linguagem = "plaintext") {
  const documento = await vscode.workspace.openTextDocument({ content: conteudo, language: linguagem });
  await vscode.window.showTextDocument(documento, { preview: false });
}

async function executarEExibir(argumentos, opcoes = {}) {
  const { linguagem = "plaintext", copiar = false, tituloErro = "Falha ao executar a CLI da Sema." } = opcoes;
  try {
    const resultado = await executarCliSema(argumentos);
    const stdout = String(resultado.stdout ?? "");
    if (copiar) {
      await vscode.env.clipboard.writeText(stdout);
      vscode.window.showInformationMessage("Conteudo copiado para a area de transferencia.");
      return;
    }
    await abrirConteudoTemporario(stdout, linguagem);
    return;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : tituloErro;
    escreverNoCanalSaida(tituloErro, mensagem);
    vscode.window.showErrorMessage(mensagem);
  }
}

async function formatarDocumentoAtivo() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Nenhum documento ativo para formatar.");
    return;
  }

  if (editor.document.languageId !== "sema") {
    vscode.window.showWarningMessage("O documento ativo nao e um arquivo Sema.");
    return;
  }

  await editor.document.save();

  try {
    await executarCliSema(["formatar", editor.document.uri.fsPath]);
    await vscode.commands.executeCommand("workbench.action.files.revert");
    vscode.window.showInformationMessage("Documento Sema formatado com sucesso.");
  } catch (erro) {
    try {
      await vscode.commands.executeCommand("editor.action.formatDocument");
      vscode.window.showWarningMessage("CLI da Sema nao encontrada. Foi usado o formatador do servidor de linguagem.");
    } catch {
      const mensagem = erro instanceof Error ? erro.message : "Falha ao formatar o documento com a Sema.";
      escreverNoCanalSaida("Falha ao formatar documento", mensagem);
      vscode.window.showErrorMessage(mensagem);
    }
  }
}

function exigirAlvoAtual() {
  const alvo = obterAlvoPreferencial();
  if (!alvo) {
    vscode.window.showWarningMessage("Abra um arquivo .sema ou uma pasta de projeto para a Sema conseguir montar contexto.");
    return undefined;
  }
  return alvo;
}

async function comandoAbrirStarterIa() {
  await executarEExibir(["starter-ia"]);
}

async function comandoAbrirPromptIa() {
  await executarEExibir(["prompt-ia"]);
}

async function comandoCopiarPromptIa() {
  await executarEExibir(["prompt-ia"], { copiar: true });
}

async function comandoAbrirPromptCurtoAlvoAtual() {
  const alvo = exigirAlvoAtual();
  if (!alvo) {
    return;
  }
  await executarEExibir(["prompt-curto", alvo, "--curto", "--para", "mudanca"]);
}

async function comandoAbrirResumoAlvoAtual() {
  const alvo = exigirAlvoAtual();
  if (!alvo) {
    return;
  }
  await executarEExibir(["resumo", alvo, "--micro", "--para", "mudanca"]);
}

async function comandoAbrirDriftAlvoAtual() {
  const alvo = exigirAlvoAtual();
  if (!alvo) {
    return;
  }
  await executarEExibir(["drift", alvo, "--json"], { linguagem: "json" });
}

async function criarTextoDiagnosticoCli() {
  const configuracao = vscode.workspace.getConfiguration("sema");
  const cliConfigurada = configuracao.get("cliPath");
  const estadoCli = await resolverEstadoCli(true);
  const alvoAtual = obterAlvoPreferencial();
  const linhas = [
    "# Diagnostico da CLI da Sema",
    "",
    `workspace: ${obterRaizWorkspace() ?? "nenhum"}`,
    `workspace_nome: ${obterNomeWorkspace()}`,
    `alvo_preferencial: ${alvoAtual ?? "nenhum"}`,
    `sema.cliPath: ${typeof cliConfigurada === "string" && cliConfigurada.trim() ? cliConfigurada.trim() : "(vazio)"}`,
    `cli_pronta: ${estadoCli.pronto ? "sim" : "nao"}`,
    `cli_origem: ${estadoCli.origem ?? "nenhuma"}`,
    estadoCli.versao ? `cli_versao: ${estadoCli.versao}` : "cli_versao: indisponivel",
    "",
    "## Candidatos testados",
  ];

  for (const candidato of estadoCli.candidatos) {
    const falha = estadoCli.erros.find((item) => item.candidato.origem === candidato.origem && item.candidato.comando === candidato.comando);
    if (!falha) {
      linhas.push(`- ${candidato.origem}: ok (${candidato.comando})`);
      continue;
    }
    const mensagem = falha.erro && typeof falha.erro === "object" && "message" in falha.erro
      ? falha.erro.message
      : String(falha.erro);
    linhas.push(`- ${candidato.origem}: falhou (${candidato.comando}) -> ${mensagem}`);
  }

  if (estadoCli.candidatos.length === 0) {
    linhas.push("- nenhum candidato encontrado");
  }

  return linhas.join("\n");
}

async function comandoDiagnosticarCli() {
  const conteudo = await criarTextoDiagnosticoCli();
  await abrirConteudoTemporario(conteudo, "markdown");
}

class ItemSidebarSema extends vscode.TreeItem {
  constructor(label, options = {}) {
    super(label, options.collapsibleState ?? vscode.TreeItemCollapsibleState.None);
    this.description = options.description;
    this.tooltip = options.tooltip;
    this.command = options.command;
    this.contextValue = options.contextValue;
    this.iconPath = options.iconPath;
  }
}

class ProvedorSidebarSema {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!element) {
      return [
        new ItemSidebarSema("Projeto", {
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          contextValue: "sema.grupo.projeto",
          iconPath: new vscode.ThemeIcon("root-folder"),
        }),
        new ItemSidebarSema("Acoes Rapidas", {
          collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
          contextValue: "sema.grupo.acoes",
          iconPath: new vscode.ThemeIcon("rocket"),
        }),
      ];
    }

    if (element.contextValue === "sema.grupo.projeto") {
      const estadoCli = await resolverEstadoCli();
      const alvoAtual = obterAlvoPreferencial();
      return [
        new ItemSidebarSema(`Workspace: ${obterNomeWorkspace()}`, {
          description: obterRaizWorkspace() ? "aberto" : "nenhum",
          tooltip: obterRaizWorkspace() ?? "Nenhuma pasta aberta no VS Code.",
          iconPath: new vscode.ThemeIcon("folder-library"),
        }),
        new ItemSidebarSema(estadoCli.pronto ? "CLI: pronta" : "CLI: indisponivel", {
          description: estadoCli.pronto ? estadoCli.origem ?? "detectada" : "rode Diagnosticar CLI",
          tooltip: estadoCli.pronto
            ? `CLI da Sema pronta via ${estadoCli.origem}${estadoCli.versao ? ` (${estadoCli.versao})` : ""}.`
            : "A extensao nao conseguiu executar a CLI da Sema.",
          iconPath: new vscode.ThemeIcon(estadoCli.pronto ? "check" : "warning"),
        }),
        new ItemSidebarSema(`Alvo: ${alvoAtual ? basename(alvoAtual) : "nenhum"}`, {
          description: alvoAtual ? "ativo" : "abra um .sema ou workspace",
          tooltip: alvoAtual ?? "Nenhum alvo ativo ou workspace aberto.",
          iconPath: new vscode.ThemeIcon("file"),
        }),
      ];
    }

    if (element.contextValue === "sema.grupo.acoes") {
      return [
        new ItemSidebarSema("Abrir Starter IA", {
          description: "prompt de onboarding",
          command: { command: "sema.abrirStarterIa", title: "Abrir Starter IA" },
          iconPath: new vscode.ThemeIcon("book"),
        }),
        new ItemSidebarSema("Abrir Prompt IA", {
          description: "prompt base da Sema",
          command: { command: "sema.abrirPromptIa", title: "Abrir Prompt IA" },
          iconPath: new vscode.ThemeIcon("sparkle"),
        }),
        new ItemSidebarSema("Copiar Prompt IA", {
          description: "leva para outra IA",
          command: { command: "sema.copiarPromptIa", title: "Copiar Prompt IA" },
          iconPath: new vscode.ThemeIcon("copy"),
        }),
        new ItemSidebarSema("Prompt Curto do Alvo Atual", {
          description: "contexto resumido",
          command: { command: "sema.abrirPromptCurtoAlvoAtual", title: "Abrir Prompt Curto do Alvo Atual" },
          iconPath: new vscode.ThemeIcon("comment-discussion"),
        }),
        new ItemSidebarSema("Resumo do Alvo Atual", {
          description: "micro resumo",
          command: { command: "sema.abrirResumoAlvoAtual", title: "Abrir Resumo do Alvo Atual" },
          iconPath: new vscode.ThemeIcon("list-unordered"),
        }),
        new ItemSidebarSema("Drift do Alvo Atual", {
          description: "medicao em JSON",
          command: { command: "sema.abrirDriftAlvoAtual", title: "Abrir Drift do Alvo Atual" },
          iconPath: new vscode.ThemeIcon("graph"),
        }),
        new ItemSidebarSema("Diagnosticar CLI", {
          description: "ve o que a extensao tentou",
          command: { command: "sema.diagnosticarCli", title: "Diagnosticar CLI" },
          iconPath: new vscode.ThemeIcon("tools"),
        }),
      ];
    }

    return [];
  }
}

async function iniciarCliente(context) {
  const serverModule = context.asAbsolutePath("server.js");
  const serverOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ["--nolazy", "--inspect=6010"],
      },
    },
  };

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "sema" }],
    synchronize: {
      configurationSection: "sema",
    },
    initializationOptions: {
      workspaceFolders: vscode.workspace.workspaceFolders?.map((item) => item.uri.fsPath) ?? [],
    },
  };

  clienteLinguagem = new LanguageClient(
    "semaLanguageServer",
    "Sema Language Server",
    serverOptions,
    clientOptions,
  );

  const resultadoStart = clienteLinguagem.start();
  context.subscriptions.push(resultadoStart);
  if (typeof clienteLinguagem.onReady === "function") {
    await clienteLinguagem.onReady();
    return;
  }
  await Promise.resolve(resultadoStart);
}

async function reiniciarCliente(context) {
  if (clienteLinguagem) {
    await clienteLinguagem.stop();
    clienteLinguagem = undefined;
  }

  await iniciarCliente(context);
  vscode.window.showInformationMessage("Servidor de linguagem da Sema reiniciado.");
}

async function activate(context) {
  canalSaida = vscode.window.createOutputChannel("Sema");
  context.subscriptions.push(canalSaida);

  provedorSidebar = new ProvedorSidebarSema();
  context.subscriptions.push(
    vscode.window.createTreeView("semaSidebar", {
      treeDataProvider: provedorSidebar,
      showCollapseAll: false,
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sema.formatarDocumento", formatarDocumentoAtivo),
    vscode.commands.registerCommand("sema.reiniciarServidor", async () => {
      await reiniciarCliente(context);
    }),
    vscode.commands.registerCommand("sema.abrirStarterIa", comandoAbrirStarterIa),
    vscode.commands.registerCommand("sema.abrirPromptIa", comandoAbrirPromptIa),
    vscode.commands.registerCommand("sema.copiarPromptIa", comandoCopiarPromptIa),
    vscode.commands.registerCommand("sema.abrirPromptCurtoAlvoAtual", comandoAbrirPromptCurtoAlvoAtual),
    vscode.commands.registerCommand("sema.abrirResumoAlvoAtual", comandoAbrirResumoAlvoAtual),
    vscode.commands.registerCommand("sema.abrirDriftAlvoAtual", comandoAbrirDriftAlvoAtual),
    vscode.commands.registerCommand("sema.diagnosticarCli", comandoDiagnosticarCli),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (evento) => {
      if (evento.affectsConfiguration("sema.cliPath") || evento.affectsConfiguration("sema.diagnosticosAoDigitar")) {
        invalidarCacheCli();
        provedorSidebar?.refresh();
        await reiniciarCliente(context);
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      invalidarCacheCli();
      provedorSidebar?.refresh();
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      provedorSidebar?.refresh();
    }),
  );

  await iniciarCliente(context);
}

async function deactivate() {
  if (clienteLinguagem) {
    await clienteLinguagem.stop();
    clienteLinguagem = undefined;
  }
}

module.exports = {
  activate,
  deactivate,
  __testables: {
    descobrirPrefixoGlobalNpm,
    descobrirShellResolvedPath,
    obterCandidatosCliResolvidos,
  },
};
