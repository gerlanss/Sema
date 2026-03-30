const vscode = require("vscode");
const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const executarArquivo = promisify(execFile);

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

  const raizWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const caminhoCli = raizWorkspace
    ? path.join(raizWorkspace, "pacotes", "cli", "dist", "index.js")
    : undefined;

  if (!caminhoCli) {
    vscode.window.showErrorMessage("Nao foi possivel localizar a raiz do workspace para executar a CLI da Sema.");
    return;
  }

  try {
    await executarArquivo("node", [caminhoCli, "formatar", editor.document.uri.fsPath], {
      cwd: raizWorkspace,
    });
    await editor.document.save();
    await vscode.commands.executeCommand("workbench.action.files.revert");
    vscode.window.showInformationMessage("Documento Sema formatado com sucesso.");
  } catch (erro) {
    const mensagem = erro && typeof erro === "object" && "stderr" in erro && typeof erro.stderr === "string"
      ? erro.stderr
      : "Falha ao formatar o documento com a CLI da Sema.";
    vscode.window.showErrorMessage(mensagem.trim());
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("sema.formatarDocumento", formatarDocumentoAtivo),
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
