const { existsSync, readdirSync } = require("node:fs");
const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");

const {
  INTENT_NAMES,
  buildExternalAiHandoff,
  buildSemaPrompt,
  inferWorkspaceKind,
  pickSeedScope,
  resolveActionOutputPaths,
} = require("./sema-ai-core");

function safeReaddir(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function normalizePathInsideWorkspace(workspaceRoot, value) {
  if (!value) {
    return undefined;
  }

  return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}

function createEmptySnapshot() {
  return {
    workspaceRoot: undefined,
    workspaceName: undefined,
    workspaceKind: "empty",
    workspaceTrusted: false,
    cli: {
      available: false,
      error: "Nenhum workspace aberto.",
    },
    canonicalEntrypoints: [],
    activeTarget: undefined,
    inspection: undefined,
    summary: undefined,
    prompt: undefined,
    drift: undefined,
    artifacts: {},
    lastRefreshAt: undefined,
    lastRefreshReason: undefined,
  };
}

class SemaWorkspaceStateService {
  constructor(vscodeApi, cliService) {
    this.vscode = vscodeApi;
    this.cliService = cliService;
    this.current = createEmptySnapshot();
    this.debounceHandle = undefined;
    this._onDidChangeState = new this.vscode.EventEmitter();
    this.onDidChangeState = this._onDidChangeState.event;
  }

  dispose() {
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
      this.debounceHandle = undefined;
    }
    this._onDidChangeState.dispose();
  }

  getSnapshot() {
    return this.current;
  }

  getConfiguration() {
    return this.vscode.workspace.getConfiguration("sema");
  }

  resolveWorkspaceRoot(preferredUri) {
    const uri = preferredUri
      ?? this.vscode.window.activeTextEditor?.document?.uri
      ?? this.vscode.workspace.workspaceFolders?.[0]?.uri;

    if (!uri) {
      return undefined;
    }

    return this.vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath
      ?? this.vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  resolveActiveTarget(workspaceRoot) {
    const editor = this.vscode.window.activeTextEditor;
    const document = editor?.document;
    if (!document || document.isUntitled) {
      return undefined;
    }

    const currentFolder = this.vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    if (!currentFolder || currentFolder !== workspaceRoot) {
      return undefined;
    }

    return {
      path: document.uri.fsPath,
      label: path.basename(document.uri.fsPath),
      isSema: document.uri.fsPath.toLowerCase().endsWith(".sema"),
    };
  }

  collectWorkspaceSignals(workspaceRoot) {
    const rootEntries = safeReaddir(workspaceRoot);
    const rootNames = new Set(rootEntries.map((entry) => entry.name.toLowerCase()));
    const semaDirs = [
      workspaceRoot,
      path.join(workspaceRoot, "contratos"),
      path.join(workspaceRoot, "sema"),
    ];

    let semaFilesCount = 0;
    for (const directory of semaDirs) {
      for (const entry of safeReaddir(directory)) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith(".sema")) {
          semaFilesCount += 1;
        }
      }
    }

    const legacySignals = [];
    const directSignals = [
      "package.json",
      "pyproject.toml",
      "requirements.txt",
      "go.mod",
      "cargo.toml",
      "pom.xml",
      "build.gradle",
      "pubspec.yaml",
      "tsconfig.json",
      "next.config.js",
      "next.config.mjs",
      "angular.json",
      "firebase.json",
    ];

    for (const signal of directSignals) {
      if (rootNames.has(signal)) {
        legacySignals.push(signal);
      }
    }

    for (const entry of rootEntries) {
      if (entry.isFile() && (entry.name.toLowerCase().endsWith(".csproj") || entry.name.toLowerCase().endsWith(".sln"))) {
        legacySignals.push(entry.name);
      }
    }

    return {
      hasSemaConfig: existsSync(path.join(workspaceRoot, "sema.config.json")),
      semaFilesCount,
      legacySignals,
    };
  }

  getCanonicalEntrypoints(workspaceRoot) {
    const paths = [
      "llms.txt",
      "SEMA_BRIEF.md",
      "SEMA_INDEX.json",
      "README.md",
      path.join("docs", "AGENT_STARTER.md"),
    ];

    return paths.filter((relativePath) => existsSync(path.join(workspaceRoot, relativePath)));
  }

  chooseSummaryTarget(workspaceRoot, activeTarget) {
    const seedScope = pickSeedScope(this.getConfiguration().get("ai.seedScope"));
    if (seedScope.includesActive && activeTarget?.isSema) {
      return {
        path: activeTarget.path,
        reason: "active-sema",
      };
    }

    if (seedScope.includesWorkspace) {
      return {
        path: workspaceRoot,
        reason: activeTarget?.path ? "workspace-from-active" : "workspace",
      };
    }

    if (seedScope.includesActive && activeTarget?.path) {
      return {
        path: activeTarget.path,
        reason: activeTarget.isSema ? "active-sema" : "active-legacy",
      };
    }

    return undefined;
  }

  scheduleRefresh(reason = "auto", options = {}) {
    if (this.debounceHandle) {
      clearTimeout(this.debounceHandle);
    }

    this.debounceHandle = setTimeout(() => {
      this.refresh({ ...options, reason }).catch(() => {
        // snapshot degradado ja e suficiente para o resto da extensao seguir viva
      });
    }, 250);
  }

  async refresh({ force = false, reason = "manual", preferredUri } = {}) {
    const workspaceRoot = this.resolveWorkspaceRoot(preferredUri);
    if (!workspaceRoot) {
      this.current = createEmptySnapshot();
      this.current.lastRefreshAt = new Date().toISOString();
      this.current.lastRefreshReason = reason;
      this._onDidChangeState.fire(this.current);
      return this.current;
    }

    const previous = this.current;
    const signals = this.collectWorkspaceSignals(workspaceRoot);
    const activeTarget = this.resolveActiveTarget(workspaceRoot);
    const workspaceKind = inferWorkspaceKind({
      workspaceRoot,
      hasSemaConfig: signals.hasSemaConfig,
      semaFilesCount: signals.semaFilesCount,
      legacySignalsCount: signals.legacySignals.length,
    });

    const cli = await this.cliService.getInfo(workspaceRoot, force);
    const next = {
      workspaceRoot,
      workspaceName: path.basename(workspaceRoot),
      workspaceKind,
      workspaceTrusted: this.vscode.workspace.isTrusted,
      cli,
      canonicalEntrypoints: this.getCanonicalEntrypoints(workspaceRoot),
      activeTarget,
      inspection: previous.workspaceRoot === workspaceRoot && !force ? previous.inspection : undefined,
      summary: previous.workspaceRoot === workspaceRoot && previous.activeTarget?.path === activeTarget?.path && !force
        ? previous.summary
        : undefined,
      prompt: previous.workspaceRoot === workspaceRoot && previous.activeTarget?.path === activeTarget?.path && !force
        ? previous.prompt
        : undefined,
      drift: previous.workspaceRoot === workspaceRoot && !force ? previous.drift : undefined,
      artifacts: previous.workspaceRoot === workspaceRoot ? previous.artifacts : {},
      lastRefreshAt: new Date().toISOString(),
      lastRefreshReason: reason,
      legacySignals: signals.legacySignals,
    };

    if (cli.available && !next.inspection) {
      try {
        const inspection = await this.cliService.runJson(["inspecionar", ".", "--json"], {
          workspaceRoot,
          cwd: workspaceRoot,
          allowNonZero: true,
        });
        next.inspection = {
          targetPath: workspaceRoot,
          raw: inspection.payload,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        next.inspection = {
          targetPath: workspaceRoot,
          error: error instanceof Error ? error.message : String(error),
          generatedAt: new Date().toISOString(),
        };
      }
    }

    const summaryTarget = this.chooseSummaryTarget(workspaceRoot, activeTarget);
    if (cli.available && summaryTarget && !next.summary) {
      try {
        const mode = workspaceKind === "legacy" ? "onboarding" : "mudanca";
        const summary = await this.cliService.run(["resumo", summaryTarget.path, "--micro", "--para", mode], {
          workspaceRoot,
          cwd: workspaceRoot,
          allowNonZero: true,
        });
        next.summary = {
          targetPath: summaryTarget.path,
          reason: summaryTarget.reason,
          text: summary.stdout.trim(),
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        next.summary = {
          targetPath: summaryTarget.path,
          reason: summaryTarget.reason,
          error: error instanceof Error ? error.message : String(error),
          generatedAt: new Date().toISOString(),
        };
      }
    }

    if (!next.prompt) {
      next.prompt = {
        targetPath: summaryTarget?.path ?? workspaceRoot,
        fromCli: false,
        text: buildSemaPrompt(next, {
          intent: workspaceKind === "legacy" ? INTENT_NAMES.legacy : INTENT_NAMES.onboard,
        }),
        generatedAt: new Date().toISOString(),
      };
    }

    this.current = next;
    this._onDidChangeState.fire(this.current);
    return this.current;
  }

  async ensurePrompt({ force = false, intent } = {}) {
    const snapshot = this.current.workspaceRoot ? this.current : await this.refresh({ reason: "prompt" });
    if (!snapshot.workspaceRoot) {
      return buildSemaPrompt(snapshot, { intent: intent ?? INTENT_NAMES.general });
    }

    if (!force && snapshot.prompt?.text) {
      return snapshot.prompt.text;
    }

    const workspaceRoot = snapshot.workspaceRoot;
    const targetPath = snapshot.activeTarget?.isSema
      ? snapshot.activeTarget.path
      : workspaceRoot;

    let promptText;
    if (snapshot.cli?.available) {
      try {
        const mode = snapshot.workspaceKind === "legacy" ? "onboarding" : "mudanca";
        const prompt = await this.cliService.run(["prompt-curto", targetPath, "--curto", "--para", mode], {
          workspaceRoot,
          cwd: workspaceRoot,
          allowNonZero: true,
        });
        promptText = prompt.stdout.trim();
      } catch {
        promptText = undefined;
      }
    }

    if (!promptText) {
      promptText = buildSemaPrompt(snapshot, {
        intent: intent ?? (snapshot.workspaceKind === "legacy" ? INTENT_NAMES.legacy : INTENT_NAMES.current),
      });
    }

    this.current = {
      ...snapshot,
      prompt: {
        targetPath,
        fromCli: Boolean(snapshot.cli?.available && promptText),
        text: promptText,
        generatedAt: new Date().toISOString(),
      },
    };
    this._onDidChangeState.fire(this.current);
    return promptText;
  }

  async resolveWorkspaceContext(providedPath, { requireSema = false, preferWorkspace = false } = {}) {
    const snapshot = this.current.workspaceRoot ? this.current : await this.refresh({ reason: "resolve" });
    if (!snapshot.workspaceRoot) {
      throw new Error("Nenhum workspace aberto no VS Code para a Sema operar.");
    }

    let resolvedPath = normalizePathInsideWorkspace(snapshot.workspaceRoot, providedPath);
    if (!resolvedPath) {
      if (requireSema) {
        if (snapshot.activeTarget?.isSema) {
          resolvedPath = snapshot.activeTarget.path;
        } else {
          throw new Error("Informe o caminho absoluto de um arquivo .sema ou deixe um arquivo .sema ativo no editor.");
        }
      } else if (preferWorkspace) {
        resolvedPath = snapshot.workspaceRoot;
      } else {
        resolvedPath = snapshot.activeTarget?.path ?? snapshot.workspaceRoot;
      }
    }

    if (requireSema && !resolvedPath.toLowerCase().endsWith(".sema")) {
      throw new Error(`O alvo ${resolvedPath} nao e um arquivo .sema. Use um contrato Sema valido.`);
    }

    return {
      snapshot,
      workspaceRoot: snapshot.workspaceRoot,
      targetPath: resolvedPath,
      defaultOutputPaths: resolveActionOutputPaths({
        workspaceRoot: snapshot.workspaceRoot,
        targetPath: resolvedPath,
      }),
    };
  }

  async inspectProject(resourcePath) {
    const { workspaceRoot, targetPath } = await this.resolveWorkspaceContext(resourcePath, {
      preferWorkspace: true,
    });

    const result = await this.cliService.runJson(["inspecionar", targetPath, "--json"], {
      workspaceRoot,
      cwd: workspaceRoot,
      allowNonZero: true,
    });

    this.current = {
      ...this.current,
      inspection: {
        targetPath,
        raw: result.payload,
        generatedAt: new Date().toISOString(),
      },
    };
    this._onDidChangeState.fire(this.current);
    return result.payload;
  }

  async diagnoseCli() {
    const snapshot = this.current.workspaceRoot ? this.current : await this.refresh({ reason: "diagnose-cli" });
    const workspaceRoot = snapshot.workspaceRoot;
    const resolution = await this.cliService.explainResolution(workspaceRoot);

    this.current = {
      ...snapshot,
      artifacts: {
        ...snapshot.artifacts,
        cliDiagnostics: {
          generatedAt: new Date().toISOString(),
          payload: resolution,
        },
      },
    };
    this._onDidChangeState.fire(this.current);
    return resolution;
  }

  async summarizeTarget(resourcePath, size = "micro", mode = "mudanca") {
    const { workspaceRoot, targetPath } = await this.resolveWorkspaceContext(resourcePath, {
      preferWorkspace: !resourcePath,
    });

    const args = ["resumo", targetPath];
    if (size) {
      args.push(`--${size}`);
    }
    if (mode) {
      args.push("--para", mode);
    }

    const result = await this.cliService.run(args, {
      workspaceRoot,
      cwd: workspaceRoot,
      allowNonZero: true,
    });

    this.current = {
      ...this.current,
      summary: {
        targetPath,
        reason: targetPath === workspaceRoot ? "workspace" : "explicit-target",
        text: result.stdout.trim(),
        generatedAt: new Date().toISOString(),
      },
    };
    this._onDidChangeState.fire(this.current);
    return result.stdout.trim();
  }

  async measureDrift(resourcePath) {
    const { workspaceRoot, targetPath } = await this.resolveWorkspaceContext(resourcePath, {
      preferWorkspace: !resourcePath,
    });

    const result = await this.cliService.runJson(["drift", targetPath, "--json"], {
      workspaceRoot,
      cwd: workspaceRoot,
      allowNonZero: true,
    });

    this.current = {
      ...this.current,
      drift: {
        targetPath,
        raw: result.payload,
        score: result.payload?.resumo_operacional?.scoreMedio,
        confidence: result.payload?.resumo_operacional?.confiancaGeral,
        generatedAt: new Date().toISOString(),
      },
    };
    this._onDidChangeState.fire(this.current);
    return result.payload;
  }

  async validateTarget(resourcePath) {
    const { workspaceRoot, targetPath } = await this.resolveWorkspaceContext(resourcePath, {
      preferWorkspace: !resourcePath,
    });

    const result = await this.cliService.runJson(["validar", targetPath, "--json"], {
      workspaceRoot,
      cwd: workspaceRoot,
      allowNonZero: true,
    });

    return result.payload;
  }

  async buildAiContext(resourcePath, outputPath) {
    const { workspaceRoot, targetPath, defaultOutputPaths } = await this.resolveWorkspaceContext(resourcePath, {
      requireSema: true,
    });
    const finalOutputPath = normalizePathInsideWorkspace(workspaceRoot, outputPath) ?? defaultOutputPaths.contextOutputPath;

    const result = await this.cliService.runJson(["contexto-ia", targetPath, "--saida", finalOutputPath, "--json"], {
      workspaceRoot,
      cwd: workspaceRoot,
      allowNonZero: false,
    });

    this.current = {
      ...this.current,
      artifacts: {
        ...this.current.artifacts,
        context: {
          path: finalOutputPath,
          generatedAt: new Date().toISOString(),
          payload: result.payload,
        },
      },
    };
    this._onDidChangeState.fire(this.current);
    return result.payload;
  }

  async prepareExternalAiContext(resourcePath, outputPath) {
    const snapshot = await this.refresh({ force: true, reason: "prepare-external-ai" });
    const promptText = await this.ensurePrompt({
      force: true,
      intent: snapshot.workspaceKind === "legacy" ? INTENT_NAMES.legacy : INTENT_NAMES.current,
    });

    const { workspaceRoot, targetPath, defaultOutputPaths } = await this.resolveWorkspaceContext(resourcePath, {
      preferWorkspace: !resourcePath,
    });

    const artifacts = {
      promptText,
      targetPath,
      generatedAt: new Date().toISOString(),
    };

    let contextOutputPath;
    let contextPayload;
    if (targetPath.toLowerCase().endsWith(".sema")) {
      contextOutputPath = normalizePathInsideWorkspace(workspaceRoot, outputPath) ?? defaultOutputPaths.contextOutputPath;
      contextPayload = await this.buildAiContext(targetPath, contextOutputPath);
      artifacts.contextOutputPath = contextOutputPath;
      artifacts.contextPayload = contextPayload;
    }

    const handoffDirectory = contextOutputPath
      ?? path.join(workspaceRoot, ".tmp", "vscode-sema", "prompt", path.basename(defaultOutputPaths.contextOutputPath));
    await mkdir(handoffDirectory, { recursive: true });
    const handoffPath = path.join(handoffDirectory, "SEMA_EXTERNAL_AI.md");
    const handoffText = buildExternalAiHandoff(this.current, {
      promptText,
      targetPath,
      contextOutputPath,
      handoffPath,
    });
    await writeFile(handoffPath, `${handoffText}\n`, "utf8");

    this.current = {
      ...this.current,
      artifacts: {
        ...this.current.artifacts,
        externalAi: {
          path: handoffPath,
          generatedAt: new Date().toISOString(),
          targetPath,
          contextOutputPath,
        },
      },
    };
    this._onDidChangeState.fire(this.current);

    return {
      ...artifacts,
      handoffPath,
      handoffText,
    };
  }

  async importLegacy(sourceKind, resourcePath, outputPath, namespaceBase) {
    const { workspaceRoot, targetPath, defaultOutputPaths } = await this.resolveWorkspaceContext(resourcePath, {
      preferWorkspace: true,
    });
    const finalOutputPath = normalizePathInsideWorkspace(workspaceRoot, outputPath) ?? defaultOutputPaths.importOutputPath;
    const args = ["importar", sourceKind, targetPath, "--saida", finalOutputPath, "--json"];
    if (namespaceBase) {
      args.push("--namespace", namespaceBase);
    }

    const result = await this.cliService.runJson(args, {
      workspaceRoot,
      cwd: workspaceRoot,
      allowNonZero: true,
    });

    this.current = {
      ...this.current,
      artifacts: {
        ...this.current.artifacts,
        import: {
          path: finalOutputPath,
          generatedAt: new Date().toISOString(),
          payload: result.payload,
        },
      },
    };
    this._onDidChangeState.fire(this.current);
    return result.payload;
  }

  async compileTarget(resourcePath, buildTarget, outputPath, outputLayout, framework) {
    const { workspaceRoot, targetPath, defaultOutputPaths } = await this.resolveWorkspaceContext(resourcePath, {
      preferWorkspace: !resourcePath,
    });
    const finalOutputPath = normalizePathInsideWorkspace(workspaceRoot, outputPath) ?? defaultOutputPaths.compileOutputPath;

    const args = ["compilar", targetPath, "--alvo", buildTarget, "--saida", finalOutputPath];
    if (outputLayout) {
      args.push("--estrutura", outputLayout);
    }
    if (framework) {
      args.push("--framework", framework);
    }

    const result = await this.cliService.run(args, {
      workspaceRoot,
      cwd: workspaceRoot,
      allowNonZero: true,
    });

    this.current = {
      ...this.current,
      artifacts: {
        ...this.current.artifacts,
        compile: {
          path: finalOutputPath,
          generatedAt: new Date().toISOString(),
          buildTarget,
          stdout: result.stdout.trim(),
        },
      },
    };
    this._onDidChangeState.fire(this.current);
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      outputPath: finalOutputPath,
      buildTarget,
    };
  }

  async testTarget(resourcePath, buildTarget, outputPath, outputLayout, framework) {
    const { workspaceRoot, targetPath, defaultOutputPaths } = await this.resolveWorkspaceContext(resourcePath, {
      requireSema: true,
    });
    const finalOutputPath = normalizePathInsideWorkspace(workspaceRoot, outputPath) ?? defaultOutputPaths.testOutputPath;

    const args = ["testar", targetPath, "--alvo", buildTarget, "--saida", finalOutputPath];
    if (outputLayout) {
      args.push("--estrutura", outputLayout);
    }
    if (framework) {
      args.push("--framework", framework);
    }

    const result = await this.cliService.run(args, {
      workspaceRoot,
      cwd: workspaceRoot,
      allowNonZero: true,
    });

    this.current = {
      ...this.current,
      artifacts: {
        ...this.current.artifacts,
        test: {
          path: finalOutputPath,
          generatedAt: new Date().toISOString(),
          buildTarget,
          stdout: result.stdout.trim(),
        },
      },
    };
    this._onDidChangeState.fire(this.current);
    return {
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      outputPath: finalOutputPath,
      buildTarget,
    };
  }
}

module.exports = {
  SemaWorkspaceStateService,
};
