const vscode = require("vscode");
const { execFile } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");

const executarArquivo = promisify(execFile);

let clienteLinguagem = undefined;

function obterRaizWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function obterNomeExecutavelSema() {
  return process.platform === "win32" ? "sema.cmd" : "sema";
}

function criarExecucaoPorCaminho(caminhoExecutavel, origem) {
  const finalizaEmJs = caminhoExecutavel.toLowerCase().endsWith(".js") || caminhoExecutavel.toLowerCase().endsWith(".mjs");
  if (finalizaEmJs) {
    return {
      comando: "node",
      argumentosBase: [caminhoExecutavel],
      origem,
    };
  }

  return {
    comando: caminhoExecutavel,
    argumentosBase: [],
    origem,
  };
}

function obterCandidatosCli() {
  const configuracao = vscode.workspace.getConfiguration("sema");
  const cliConfigurada = configuracao.get("cliPath");
  const raizWorkspace = obterRaizWorkspace();
  const nomeExecutavel = obterNomeExecutavelSema();
  const candidatos = [];

  if (typeof cliConfigurada === "string" && cliConfigurada.trim().length > 0) {
    candidatos.push(criarExecucaoPorCaminho(cliConfigurada.trim(), "configuracao sema.cliPath"));
  }

  candidatos.push({
    comando: "sema",
    argumentosBase: [],
    origem: "bin global ou shell atual",
  });

  if (raizWorkspace) {
    const binLocal = path.join(raizWorkspace, "node_modules", ".bin", nomeExecutavel);
    if (existsSync(binLocal)) {
      candidatos.push(criarExecucaoPorCaminho(binLocal, "bin local do projeto"));
    }

    const cliRepositorio = path.join(raizWorkspace, "pacotes", "cli", "dist", "index.js");
    if (existsSync(cliRepositorio)) {
      candidatos.push(criarExecucaoPorCaminho(cliRepositorio, "CLI local do repositorio"));
    }
  }

  return candidatos;
}

async function executarCliSema(argumentos, opcoes = {}) {
  const raizWorkspace = obterRaizWorkspace();
  const erros = [];

  for (const candidato of obterCandidatosCli()) {
    try {
      return await executarArquivo(candidato.comando, [...candidato.argumentosBase, ...argumentos], {
        cwd: raizWorkspace,
        windowsHide: true,
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
      vscode.window.showErrorMessage(mensagem);
    }
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

  context.subscriptions.push(clienteLinguagem.start());
  await clienteLinguagem.onReady();
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
  context.subscriptions.push(
    vscode.commands.registerCommand("sema.formatarDocumento", formatarDocumentoAtivo),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sema.reiniciarServidor", async () => {
      await reiniciarCliente(context);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (evento) => {
      if (evento.affectsConfiguration("sema.cliPath") || evento.affectsConfiguration("sema.diagnosticosAoDigitar")) {
        await reiniciarCliente(context);
      }
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
};
