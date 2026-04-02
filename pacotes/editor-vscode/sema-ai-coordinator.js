const {
  BUILD_TARGETS,
  CONTEXT_VIEW_ID,
  IMPORT_SOURCES,
  PROJECT_VIEW_ID,
  TOOL_NAMES,
  VIEW_CONTAINER_ID,
} = require("./sema-ai-core");

class SemaAiCoordinator {
  constructor(vscodeApi, context, stateService, sidebarProvider) {
    this.vscode = vscodeApi;
    this.context = context;
    this.stateService = stateService;
    this.sidebarProvider = sidebarProvider;
    this.projectTreeView = undefined;
  }

  async maybeAutoBootstrapCli() {
    const configuration = this.vscode.workspace.getConfiguration("sema");
    const configuredCli = configuration.get("cliPath");
    if (typeof configuredCli === "string" && configuredCli.trim().length > 0) {
      return;
    }

    const bootstrapState = this.context.globalState.get("sema.cli.autoBootstrapAttempt");
    if (bootstrapState?.version === this.context.extension.packageJSON.version) {
      return;
    }

    const payload = await this.stateService.diagnoseCli();
    await this.context.globalState.update("sema.cli.autoBootstrapAttempt", {
      version: this.context.extension.packageJSON.version,
      timestamp: new Date().toISOString(),
      state: payload.resolvedState,
    });

    if (payload.resolvedState !== "ready" || !payload.suggestedCliPath) {
      return;
    }

    await configuration.update(
      "cliPath",
      payload.suggestedCliPath,
      this.vscode.ConfigurationTarget.Global,
    );
    await this.stateService.cliService.markAutoBootstrap({
      version: this.context.extension.packageJSON.version,
      path: payload.suggestedCliPath,
      scope: "user",
      timestamp: new Date().toISOString(),
    });
    this.vscode.window.showInformationMessage(`Bootstrap automatico da Sema aplicou a CLI no usuario: ${payload.suggestedCliPath}`);
    await this.stateService.refresh({ force: true, reason: "auto-bootstrap-cli" });
  }

  async openArtifact(pathOrDirectory) {
    if (!pathOrDirectory) {
      return;
    }

    const uri = this.vscode.Uri.file(pathOrDirectory);
    try {
      const stat = await this.vscode.workspace.fs.stat(uri);
      const isDirectory = Boolean(stat.type & this.vscode.FileType.Directory);
      if (isDirectory) {
        await this.vscode.commands.executeCommand("revealFileInOS", uri);
      } else {
        await this.vscode.commands.executeCommand("vscode.open", uri);
      }
    } catch {
      await this.vscode.commands.executeCommand("revealFileInOS", uri);
    }
  }

  async showActionResult(payload, language = "json") {
    const content = typeof payload === "string"
      ? payload
      : JSON.stringify(payload, null, 2);
    const document = await this.vscode.workspace.openTextDocument({
      content,
      language,
    });
    await this.vscode.window.showTextDocument(document, {
      preview: false,
    });
  }

  async prepareExternalAiContext() {
    const snapshot = await this.stateService.refresh({ reason: "prepare-external-ai" });
    if (!snapshot.workspaceRoot) {
      this.vscode.window.showWarningMessage("Abra um workspace antes de preparar contexto para IA externa.");
      return;
    }

    if (!snapshot.workspaceTrusted) {
      this.vscode.window.showWarningMessage("Workspace nao confiavel: a geracao de artefatos para IA externa foi bloqueada.");
      return;
    }

    const payload = await this.stateService.prepareExternalAiContext();
    await this.vscode.env.clipboard.writeText(payload.promptText);
    await this.openArtifact(payload.handoffPath);
    this.vscode.window.showInformationMessage("Contexto para IA externa preparado e prompt copiado para a area de transferencia.");
  }

  async diagnoseCli() {
    const payload = await this.stateService.diagnoseCli();
    await this.showActionResult(payload);
  }

  async autoConfigureCli() {
    const payload = await this.stateService.diagnoseCli();
    const suggestedPath = payload.suggestedCliPath ?? payload.windowsUserNpmPath;
    if (!suggestedPath) {
      this.vscode.window.showWarningMessage("A extensao nao encontrou um caminho seguro para autoconfigurar a CLI da Sema.");
      await this.showActionResult(payload);
      return;
    }

    await this.vscode.workspace.getConfiguration("sema").update(
      "cliPath",
      suggestedPath,
      this.vscode.ConfigurationTarget.Global,
    );
    await this.stateService.cliService.markAutoBootstrap({
      version: this.context.extension.packageJSON.version,
      path: suggestedPath,
      scope: "user",
      timestamp: new Date().toISOString(),
      manual: true,
    });
    this.vscode.window.showInformationMessage(`CLI da Sema configurada para o usuario: ${suggestedPath}`);
    await this.stateService.refresh({ force: true, reason: "auto-configure-cli" });
  }

  async promptForBuildTarget(placeHolder) {
    const selection = await this.vscode.window.showQuickPick(
      BUILD_TARGETS.map((item) => ({
        label: item,
      })),
      { placeHolder },
    );
    return selection?.label;
  }

  async promptForImportSource() {
    const selection = await this.vscode.window.showQuickPick(
      IMPORT_SOURCES.map((item) => ({
        label: item,
      })),
      {
        placeHolder: "Escolha a fonte de legado para o importador da Sema",
      },
    );
    return selection?.label;
  }

  async executeAction(actionId, extraArgument) {
    if (actionId === "openArtifact") {
      await this.openArtifact(extraArgument);
      return;
    }

    const snapshot = await this.stateService.refresh({ reason: `action:${actionId}` });
    if (!snapshot.workspaceRoot) {
      this.vscode.window.showWarningMessage("Abra um workspace antes de usar as acoes da Sema.");
      return;
    }

    try {
      switch (actionId) {
        case "prepareExternalAiContext": {
          await this.prepareExternalAiContext();
          break;
        }
        case "diagnoseCli": {
          await this.diagnoseCli();
          break;
        }
        case "autoConfigureCli": {
          await this.autoConfigureCli();
          break;
        }
        case TOOL_NAMES.inspectProject: {
          const payload = await this.stateService.inspectProject();
          await this.showActionResult(payload);
          break;
        }
        case TOOL_NAMES.summarizeTarget: {
          const payload = await this.stateService.summarizeTarget();
          await this.showActionResult(payload, "markdown");
          break;
        }
        case TOOL_NAMES.measureDrift: {
          const payload = await this.stateService.measureDrift();
          await this.showActionResult(payload);
          break;
        }
        case TOOL_NAMES.buildAiContext: {
          if (!snapshot.workspaceTrusted) {
            this.vscode.window.showWarningMessage("Workspace nao confiavel: gerar contexto da Sema fica bloqueado ate o trust ser concedido.");
            return;
          }

          const payload = await this.stateService.buildAiContext();
          await this.showActionResult(payload);
          break;
        }
        case TOOL_NAMES.validateTarget: {
          const payload = await this.stateService.validateTarget();
          await this.showActionResult(payload);
          break;
        }
        case TOOL_NAMES.importLegacy: {
          if (!snapshot.workspaceTrusted) {
            this.vscode.window.showWarningMessage("Workspace nao confiavel: a importacao de legado foi bloqueada.");
            return;
          }

          const sourceKind = await this.promptForImportSource();
          if (!sourceKind) {
            return;
          }
          const payload = await this.stateService.importLegacy(sourceKind);
          await this.showActionResult(payload);
          break;
        }
        case TOOL_NAMES.compileTarget: {
          if (!snapshot.workspaceTrusted) {
            this.vscode.window.showWarningMessage("Workspace nao confiavel: a compilacao foi bloqueada.");
            return;
          }

          const buildTarget = await this.promptForBuildTarget("Escolha o alvo para `sema compilar`");
          if (!buildTarget) {
            return;
          }
          const payload = await this.stateService.compileTarget(undefined, buildTarget);
          await this.showActionResult(payload, "text");
          break;
        }
        case TOOL_NAMES.testTarget: {
          if (!snapshot.workspaceTrusted) {
            this.vscode.window.showWarningMessage("Workspace nao confiavel: o teste derivado foi bloqueado.");
            return;
          }

          const buildTarget = await this.promptForBuildTarget("Escolha o alvo para `sema testar`");
          if (!buildTarget) {
            return;
          }
          const payload = await this.stateService.testTarget(undefined, buildTarget);
          await this.showActionResult(payload, "text");
          break;
        }
        default: {
          const selection = await this.vscode.window.showQuickPick([
            { label: "Preparar contexto para IA externa", actionId: "prepareExternalAiContext" },
            { label: "Diagnosticar CLI da Sema", actionId: "diagnoseCli" },
            { label: "Autoconfigurar CLI da Sema", actionId: "autoConfigureCli" },
            { label: "Inspecionar projeto", actionId: TOOL_NAMES.inspectProject },
            { label: "Resumir alvo atual", actionId: TOOL_NAMES.summarizeTarget },
            { label: "Medir drift", actionId: TOOL_NAMES.measureDrift },
            { label: "Gerar contexto-ia", actionId: TOOL_NAMES.buildAiContext },
            { label: "Validar alvo", actionId: TOOL_NAMES.validateTarget },
            { label: "Importar legado", actionId: TOOL_NAMES.importLegacy },
            { label: "Compilar", actionId: TOOL_NAMES.compileTarget },
            { label: "Testar", actionId: TOOL_NAMES.testTarget },
          ], {
            placeHolder: "Escolha a acao da Sema que voce quer executar",
          });
          if (selection?.actionId) {
            await this.executeAction(selection.actionId);
          }
          break;
        }
      }
    } catch (error) {
      this.vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  registerCommands() {
    this.context.subscriptions.push(
      this.vscode.commands.registerCommand("sema.abrirPainelIa", async () => {
        await this.vscode.commands.executeCommand(`workbench.view.extension.${VIEW_CONTAINER_ID}`);
      }),
    );

    this.context.subscriptions.push(
      this.vscode.commands.registerCommand("sema.atualizarContextoIa", async () => {
        await this.stateService.refresh({ force: true, reason: "manual-refresh" });
      }),
    );

    this.context.subscriptions.push(
      this.vscode.commands.registerCommand("sema.prepararContextoIaExterna", async () => {
        await this.prepareExternalAiContext();
      }),
    );

    this.context.subscriptions.push(
      this.vscode.commands.registerCommand("sema.diagnosticarCli", async () => {
        await this.diagnoseCli();
      }),
    );

    this.context.subscriptions.push(
      this.vscode.commands.registerCommand("sema.autoconfigurarCli", async () => {
        await this.autoConfigureCli();
      }),
    );

    this.context.subscriptions.push(
      this.vscode.commands.registerCommand("sema.copiarPromptSema", async () => {
        const prompt = await this.stateService.ensurePrompt();
        await this.vscode.env.clipboard.writeText(prompt);
        this.vscode.window.showInformationMessage("Prompt da Sema copiado para a area de transferencia.");
      }),
    );

    this.context.subscriptions.push(
      this.vscode.commands.registerCommand("sema.executarAcaoIa", async (actionId, extraArgument) => {
        await this.executeAction(actionId, extraArgument);
      }),
    );
  }

  registerViews() {
    this.projectTreeView = this.vscode.window.createTreeView(PROJECT_VIEW_ID, {
      treeDataProvider: this.sidebarProvider,
      showCollapseAll: true,
    });
    this.context.subscriptions.push(this.projectTreeView);
    this.context.subscriptions.push(
      this.vscode.window.registerWebviewViewProvider(CONTEXT_VIEW_ID, this.sidebarProvider),
    );
  }

  registerListeners() {
    this.context.subscriptions.push(
      this.stateService.onDidChangeState(() => {
        this.sidebarProvider.refresh();
      }),
    );

    this.context.subscriptions.push(
      this.vscode.window.onDidChangeActiveTextEditor(() => {
        this.stateService.scheduleRefresh("active-editor");
      }),
    );

    this.context.subscriptions.push(
      this.vscode.workspace.onDidSaveTextDocument(() => {
        this.stateService.scheduleRefresh("save");
      }),
    );

    this.context.subscriptions.push(
      this.vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.stateService.scheduleRefresh("workspace-folders", { force: true });
      }),
    );

    this.context.subscriptions.push(
      this.vscode.workspace.onDidGrantWorkspaceTrust(() => {
        this.stateService.scheduleRefresh("workspace-trust", { force: true });
      }),
    );

    this.context.subscriptions.push(
      this.vscode.workspace.onDidChangeConfiguration((event) => {
        if (
          event.affectsConfiguration("sema.ai.autoSeedOnOpen")
          || event.affectsConfiguration("sema.ai.sidebarEnabled")
          || event.affectsConfiguration("sema.ai.seedScope")
          || event.affectsConfiguration("sema.cliPath")
        ) {
          this.stateService.scheduleRefresh("config", { force: true });
        }
      }),
    );
  }

  async register() {
    this.registerCommands();
    this.registerViews();
    this.registerListeners();
    await this.maybeAutoBootstrapCli();

    const autoSeedEnabled = this.vscode.workspace.getConfiguration("sema").get("ai.autoSeedOnOpen") !== false;
    if (autoSeedEnabled) {
      this.stateService.scheduleRefresh("startup", { force: true });
    }
  }
}

module.exports = {
  SemaAiCoordinator,
};
