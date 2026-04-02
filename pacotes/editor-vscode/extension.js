const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");
const { SemaCliService } = require("./sema-cli-service");
const { SemaWorkspaceStateService } = require("./sema-workspace-state-service");
const { SemaSidebarProvider } = require("./sema-sidebar-provider");
const { SemaAiCoordinator } = require("./sema-ai-coordinator");

let clienteLinguagem = undefined;
let cliService = undefined;
let aiCoordinator = undefined;

function obterRaizWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

async function executarCliSema(argumentos, opcoes = {}) {
  if (!cliService) {
    throw new Error("A CLI da Sema ainda nao foi inicializada na extensao.");
  }

  const resultado = await cliService.run(argumentos, {
    workspaceRoot: obterRaizWorkspace(),
    cwd: obterRaizWorkspace(),
    allowNonZero: Boolean(opcoes.allowNonZero),
    timeoutMs: opcoes.timeout,
  });

  return {
    stdout: resultado.stdout,
    stderr: resultado.stderr,
  };
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

  try {
    await iniciarCliente(context);
    vscode.window.showInformationMessage("Servidor de linguagem da Sema reiniciado.");
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    vscode.window.showErrorMessage(`Falha ao reiniciar o servidor de linguagem da Sema: ${mensagem}`);
  }
}

async function activate(context) {
  cliService = new SemaCliService(vscode, context);
  const workspaceStateService = new SemaWorkspaceStateService(vscode, cliService);
  const sidebarProvider = new SemaSidebarProvider(vscode, workspaceStateService);
  aiCoordinator = new SemaAiCoordinator(
    vscode,
    context,
    workspaceStateService,
    sidebarProvider,
  );

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
        cliService?.invalidateInfo(obterRaizWorkspace());
        await reiniciarCliente(context);
      }
    }),
  );

  context.subscriptions.push(workspaceStateService);
  context.subscriptions.push(sidebarProvider);
  context.subscriptions.push({
    dispose() {
      aiCoordinator = undefined;
      cliService = undefined;
    },
  });

  await aiCoordinator.register();

  try {
    await iniciarCliente(context);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    vscode.window.showErrorMessage(`A Sema carregou o painel de contexto, mas o servidor de linguagem falhou ao iniciar: ${mensagem}`);
  }
}

async function deactivate() {
  aiCoordinator = undefined;
  cliService = undefined;
  if (clienteLinguagem) {
    await clienteLinguagem.stop();
    clienteLinguagem = undefined;
  }
}

module.exports = {
  activate,
  deactivate,
};
