const path = require("node:path");

const {
  INTENT_NAMES,
  TOOL_NAMES,
  buildSemaPrompt,
  truncateText,
} = require("./sema-ai-core");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

class SemaSidebarItem {
  constructor(vscodeApi, options) {
    this.vscode = vscodeApi;
    this.label = options.label;
    this.description = options.description;
    this.tooltip = options.tooltip;
    this.command = options.command;
    this.iconPath = options.iconPath;
    this.children = options.children ?? [];
    this.contextValue = options.contextValue;
    this.collapsibleState = options.collapsibleState
      ?? (this.children.length > 0
        ? this.vscode.TreeItemCollapsibleState.Expanded
        : this.vscode.TreeItemCollapsibleState.None);
  }
}

class SemaSidebarProvider {
  constructor(vscodeApi, stateService) {
    this.vscode = vscodeApi;
    this.stateService = stateService;
    this._onDidChangeTreeData = new this.vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.webviewView = undefined;
  }

  dispose() {
    this._onDidChangeTreeData.dispose();
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
    this.renderWebview();
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    const snapshot = this.stateService.getSnapshot();
    if (!element) {
      return this.createRootItems(snapshot);
    }

    return element.children ?? [];
  }

  createLeaf(options) {
    return new SemaSidebarItem(this.vscode, options);
  }

  createRootItems(snapshot) {
    const cliStatusLabel = snapshot.cli?.status === "ready"
      ? "CLI: pronta"
      : snapshot.cli?.status === "incompatible"
        ? "CLI: incompatível"
        : snapshot.cli?.status === "ambiguous"
          ? "CLI: multiplas detectadas"
          : "CLI: indisponivel";
    const cliStatusDescription = snapshot.cli?.available
      ? `${snapshot.cli.version ?? "?"} via ${snapshot.cli.origin}`
      : snapshot.cli?.status === "incompatible"
        ? `minimo ${snapshot.cli?.minimumCompatibleCliVersion ?? "?"}`
        : snapshot.cli?.status === "ambiguous"
          ? "use Diagnosticar CLI ou Autoconfigurar CLI"
          : "configure sema.cliPath ou instale @semacode/cli";
    const statusChildren = [
      this.createLeaf({
        label: `Workspace: ${snapshot.workspaceName ?? "nenhum"}`,
        description: snapshot.workspaceKind,
        tooltip: snapshot.workspaceRoot ?? "Nenhum workspace aberto.",
        iconPath: new this.vscode.ThemeIcon("folder-opened"),
      }),
      this.createLeaf({
        label: cliStatusLabel,
        description: cliStatusDescription,
        tooltip: snapshot.cli?.available ? snapshot.cli.commandLine : snapshot.cli?.error,
        iconPath: new this.vscode.ThemeIcon(snapshot.cli?.available ? "check" : (snapshot.cli?.status === "incompatible" ? "error" : "warning")),
      }),
      this.createLeaf({
        label: `Trust: ${snapshot.workspaceTrusted ? "completo" : "restrito"}`,
        description: snapshot.workspaceTrusted ? "tools mutantes liberadas" : "somente leitura",
        iconPath: new this.vscode.ThemeIcon(snapshot.workspaceTrusted ? "shield" : "shield-notification"),
      }),
    ];

    if (Array.isArray(snapshot.canonicalEntrypoints) && snapshot.canonicalEntrypoints.length > 0) {
      statusChildren.push(this.createLeaf({
        label: "Trilha canonica",
        description: snapshot.canonicalEntrypoints.join(" -> "),
        tooltip: snapshot.canonicalEntrypoints.join("\n"),
        iconPath: new this.vscode.ThemeIcon("book"),
      }));
    }

    const targetChildren = [];
    if (snapshot.activeTarget?.path) {
      targetChildren.push(this.createLeaf({
        label: snapshot.activeTarget.label,
        description: snapshot.activeTarget.isSema ? "alvo .sema ativo" : "arquivo ativo / alvo corrente",
        tooltip: snapshot.activeTarget.path,
        command: {
          title: "Abrir alvo atual",
          command: "vscode.open",
          arguments: [this.vscode.Uri.file(snapshot.activeTarget.path)],
        },
        iconPath: new this.vscode.ThemeIcon(snapshot.activeTarget.isSema ? "symbol-interface" : "file"),
      }));
    }

    if (snapshot.summary?.text) {
      targetChildren.push(this.createLeaf({
        label: "Resumo pronto",
        description: truncateText(snapshot.summary.text.replace(/\s+/g, " ").trim(), 90),
        tooltip: snapshot.summary.text,
        iconPath: new this.vscode.ThemeIcon("note"),
      }));
    }

    const driftScore = snapshot.drift?.score ?? snapshot.inspection?.raw?.configuracao?.scoreDrift;
    const driftConfidence = snapshot.drift?.confidence ?? snapshot.inspection?.raw?.configuracao?.confiancaGeral;
    if (driftScore !== undefined || driftConfidence) {
      targetChildren.push(this.createLeaf({
        label: "Drift",
        description: `score ${driftScore ?? "?"} / confianca ${driftConfidence ?? "desconhecida"}`,
        tooltip: snapshot.drift?.raw ? JSON.stringify(snapshot.drift.raw, null, 2) : "Seed inicial do inspecionar.",
        iconPath: new this.vscode.ThemeIcon("pulse"),
      }));
    }

    const actionChildren = [
      this.createLeaf({
        label: "Diagnosticar CLI",
        description: "mostra o que a extensao tentou para achar a CLI",
        command: {
          title: "Diagnosticar CLI",
          command: "sema.diagnosticarCli",
        },
        iconPath: new this.vscode.ThemeIcon("debug-alt-small"),
      }),
      this.createLeaf({
        label: "Autoconfigurar CLI",
        description: "grava um caminho detectado para este workspace",
        command: {
          title: "Autoconfigurar CLI",
          command: "sema.autoconfigurarCli",
        },
        iconPath: new this.vscode.ThemeIcon("tools"),
      }),
      this.createLeaf({
        label: "Preparar contexto para IA externa",
        description: "gera handoff e copia prompt pronto",
        command: {
          title: "Preparar contexto para IA externa",
          command: "sema.prepararContextoIaExterna",
        },
        iconPath: new this.vscode.ThemeIcon("sparkle"),
      }),
      this.createLeaf({
        label: "Atualizar contexto",
        description: "recalcula seed, resumo e estado",
        command: {
          title: "Atualizar contexto",
          command: "sema.atualizarContextoIa",
        },
        iconPath: new this.vscode.ThemeIcon("refresh"),
      }),
      this.createLeaf({
        label: "Copiar prompt Sema",
        description: "gera prompt curto para qualquer IA",
        command: {
          title: "Copiar prompt Sema",
          command: "sema.copiarPromptSema",
        },
        iconPath: new this.vscode.ThemeIcon("copy"),
      }),
      this.createLeaf({
        label: "Inspecionar projeto",
        description: "roda sema inspecionar",
        command: {
          title: "Inspecionar projeto",
          command: "sema.executarAcaoIa",
          arguments: [TOOL_NAMES.inspectProject],
        },
        iconPath: new this.vscode.ThemeIcon("search"),
      }),
      this.createLeaf({
        label: "Medir drift",
        description: "roda sema drift",
        command: {
          title: "Medir drift",
          command: "sema.executarAcaoIa",
          arguments: [TOOL_NAMES.measureDrift],
        },
        iconPath: new this.vscode.ThemeIcon("graph"),
      }),
      this.createLeaf({
        label: "Gerar contexto IA",
        description: "roda sema contexto-ia",
        command: {
          title: "Gerar contexto IA",
          command: "sema.executarAcaoIa",
          arguments: [TOOL_NAMES.buildAiContext],
        },
        iconPath: new this.vscode.ThemeIcon("sparkle"),
      }),
    ];

    const artifactChildren = [];
    for (const [artifactKey, artifactValue] of Object.entries(snapshot.artifacts ?? {})) {
      if (!artifactValue?.path) {
        continue;
      }

      artifactChildren.push(this.createLeaf({
        label: artifactKey,
        description: artifactValue.path,
        tooltip: artifactValue.path,
        command: {
          title: "Abrir artefato",
          command: "sema.executarAcaoIa",
          arguments: ["openArtifact", artifactValue.path],
        },
        iconPath: new this.vscode.ThemeIcon("output"),
      }));
    }

    return [
      new SemaSidebarItem(this.vscode, {
        label: "Projeto",
        iconPath: new this.vscode.ThemeIcon("repo"),
        children: statusChildren,
      }),
      new SemaSidebarItem(this.vscode, {
        label: "Alvo Atual",
        iconPath: new this.vscode.ThemeIcon("target"),
        children: targetChildren.length > 0
          ? targetChildren
          : [
            this.createLeaf({
              label: "Nenhum alvo ativo",
              description: "abra um arquivo .sema ou um arquivo do workspace",
              iconPath: new this.vscode.ThemeIcon("circle-slash"),
            }),
          ],
      }),
      new SemaSidebarItem(this.vscode, {
        label: "Acoes Rapidas",
        iconPath: new this.vscode.ThemeIcon("play"),
        children: actionChildren,
      }),
      new SemaSidebarItem(this.vscode, {
        label: "Artefatos Recentes",
        iconPath: new this.vscode.ThemeIcon("archive"),
        children: artifactChildren.length > 0
          ? artifactChildren
          : [
            this.createLeaf({
              label: "Nenhum artefato ainda",
              description: "gere contexto, compile ou rode testes por aqui",
              iconPath: new this.vscode.ThemeIcon("circle-outline"),
            }),
          ],
      }),
    ];
  }

  async resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message?.type) {
        case "refresh":
          await this.vscode.commands.executeCommand("sema.atualizarContextoIa");
          break;
        case "copyPrompt":
          await this.vscode.commands.executeCommand("sema.copiarPromptSema");
          break;
        case "prepareExternal":
          await this.vscode.commands.executeCommand("sema.prepararContextoIaExterna");
          break;
        case "diagnoseCli":
          await this.vscode.commands.executeCommand("sema.diagnosticarCli");
          break;
        case "autoConfigureCli":
          await this.vscode.commands.executeCommand("sema.autoconfigurarCli");
          break;
        case "runAction":
          await this.vscode.commands.executeCommand("sema.executarAcaoIa", message.actionId);
          break;
        case "openPath":
          await this.vscode.commands.executeCommand("sema.executarAcaoIa", "openArtifact", message.path);
          break;
        default:
          break;
      }
    });

    this.renderWebview();
  }

  renderWebview() {
    if (!this.webviewView) {
      return;
    }

    const snapshot = this.stateService.getSnapshot();
    const promptText = snapshot.prompt?.text ?? buildSemaPrompt(snapshot, {
      intent: snapshot.workspaceKind === "legacy" ? INTENT_NAMES.legacy : INTENT_NAMES.current,
    });
    const cliStatusText = snapshot.cli?.available
      ? `${snapshot.cli.version ?? "ok"} via ${snapshot.cli.origin}`
      : snapshot.cli?.status === "incompatible"
        ? `incompatível com esta extensão (mínimo ${snapshot.cli?.minimumCompatibleCliVersion ?? "?"})`
        : snapshot.cli?.status === "ambiguous"
          ? "múltiplas CLIs válidas detectadas"
          : "indisponível";

    const artifactRows = Object.values(snapshot.artifacts ?? {})
      .filter((artifact) => artifact?.path)
      .map((artifact) => `
        <li>
          <button class="link-button" data-open-path="${escapeHtml(artifact.path)}">${escapeHtml(path.basename(artifact.path))}</button>
          <span class="muted">${escapeHtml(artifact.path)}</span>
        </li>
      `)
      .join("");

    const summaryText = snapshot.summary?.text
      ? `<pre>${escapeHtml(truncateText(snapshot.summary.text, 3200))}</pre>`
      : `<p class="muted">Nenhum resumo em cache ainda. Atualize o contexto para forcar um seed novo.</p>`;

    this.webviewView.webview.html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
        --fg: var(--vscode-foreground);
        --muted: var(--vscode-descriptionForeground);
        --border: var(--vscode-panel-border);
        --card: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-textLink-foreground) 6%);
        --accent: var(--vscode-textLink-foreground);
      }
      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        color: var(--fg);
        background: var(--vscode-editor-background);
      }
      .grid { display: grid; gap: 12px; }
      .card {
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 12px;
        background: var(--card);
      }
      h2, h3 { margin: 0 0 8px 0; }
      .status { display: grid; gap: 6px; font-size: 12px; }
      .muted { color: var(--muted); }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; }
      button {
        border: 1px solid var(--border);
        background: transparent;
        color: var(--fg);
        border-radius: 999px;
        padding: 6px 10px;
        cursor: pointer;
      }
      button.primary { border-color: var(--accent); color: var(--accent); }
      .link-button { border: none; padding: 0; color: var(--accent); background: transparent; }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
        margin: 0;
      }
      ul { margin: 0; padding-left: 18px; }
      li { margin: 6px 0; }
      textarea {
        width: 100%;
        min-height: 180px;
        resize: vertical;
        box-sizing: border-box;
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 10px;
      }
    </style>
  </head>
  <body>
    <div class="grid">
      <section class="card">
        <h2>Sema para IA</h2>
        <div class="status">
          <span><strong>Workspace:</strong> ${escapeHtml(snapshot.workspaceName ?? "nenhum")}</span>
          <span><strong>Tipo:</strong> ${escapeHtml(snapshot.workspaceKind ?? "empty")}</span>
          <span><strong>CLI:</strong> ${escapeHtml(cliStatusText)}</span>
          <span><strong>Alvo:</strong> ${escapeHtml(snapshot.activeTarget?.path ?? snapshot.workspaceRoot ?? "nenhum")}</span>
          <span><strong>Drift:</strong> ${escapeHtml(String(snapshot.drift?.score ?? snapshot.inspection?.raw?.configuracao?.scoreDrift ?? "?"))} / ${escapeHtml(snapshot.drift?.confidence ?? snapshot.inspection?.raw?.configuracao?.confiancaGeral ?? "desconhecida")}</span>
        </div>
        <div class="actions" style="margin-top: 12px;">
          <button class="primary" data-command="prepareExternal">Preparar handoff</button>
          <button data-command="diagnoseCli">Diagnosticar CLI</button>
          <button data-command="autoConfigureCli">Autoconfigurar CLI</button>
          <button data-command="refresh">Atualizar contexto</button>
          <button data-command="copyPrompt">Copiar prompt</button>
          <button data-action="${TOOL_NAMES.measureDrift}">Drift</button>
          <button data-action="${TOOL_NAMES.buildAiContext}">Contexto IA</button>
        </div>
      </section>

      <section class="card">
        <h3>Resumo</h3>
        ${summaryText}
      </section>

      <section class="card">
        <h3>Prompt para IA externa</h3>
        <textarea readonly>${escapeHtml(promptText)}</textarea>
      </section>

      <section class="card">
        <h3>Artefatos recentes</h3>
        ${artifactRows ? `<ul>${artifactRows}</ul>` : `<p class="muted">Ainda nao ha artefatos gerados por esta extensao.</p>`}
      </section>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      for (const button of document.querySelectorAll("[data-command]")) {
        button.addEventListener("click", () => {
          vscode.postMessage({ type: button.dataset.command });
        });
      }
      for (const button of document.querySelectorAll("[data-action]")) {
        button.addEventListener("click", () => {
          vscode.postMessage({ type: "runAction", actionId: button.dataset.action });
        });
      }
      for (const button of document.querySelectorAll("[data-open-path]")) {
        button.addEventListener("click", () => {
          vscode.postMessage({ type: "openPath", path: button.dataset.openPath });
        });
      }
    </script>
  </body>
</html>`;
  }
}

module.exports = {
  SemaSidebarProvider,
};
