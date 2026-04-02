const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const {
  executarCandidato,
  obterCandidatosCli,
} = require("./cli-helpers");

const executarArquivo = promisify(execFile);

let clienteLinguagem = undefined;

function obterRaizWorkspace() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
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

async function executarCliSema(argumentos, opcoes = {}) {
  const raizWorkspace = obterRaizWorkspace();
  const erros = [];

  for (const candidato of await obterCandidatosCliResolvidos()) {
    try {
      return await executarCandidato(candidato, argumentos, {
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
  __testables: {
    descobrirPrefixoGlobalNpm,
    descobrirShellResolvedPath,
    obterCandidatosCliResolvidos,
  },
};
