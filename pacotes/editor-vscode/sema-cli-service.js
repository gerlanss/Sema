const { execFile, spawn } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");

const executarArquivo = promisify(execFile);

function obterNomeExecutavelSema() {
  return process.platform === "win32" ? "sema.cmd" : "sema";
}

function escaparArgumentoCmd(valor) {
  return `"${String(valor).replace(/"/g, '""')}"`;
}

function isWindowsWrapper(command) {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
}

function versionToParts(value) {
  const match = String(value ?? "").match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return undefined;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

function compareVersions(left, right) {
  if (!left || !right) {
    return undefined;
  }

  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  return left.patch - right.patch;
}

function safeReadExtensionVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf8"));
    return String(packageJson.version ?? "").trim() || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function criarExecucaoPorCaminho(caminhoExecutavel, origem, options = {}) {
  const normalizado = caminhoExecutavel.toLowerCase();
  const finalizaEmJs = normalizado.endsWith(".js") || normalizado.endsWith(".mjs");
  if (finalizaEmJs) {
    return {
      command: "node",
      baseArgs: [caminhoExecutavel],
      origin: origem,
      explicitPath: caminhoExecutavel,
      ...options,
    };
  }

  return {
    command: caminhoExecutavel,
    baseArgs: [],
    origin: origem,
    explicitPath: path.isAbsolute(caminhoExecutavel) ? caminhoExecutavel : undefined,
    ...options,
  };
}

function formatCommandLine(candidate, args) {
  return [candidate.command, ...candidate.baseArgs, ...args]
    .map((item) => (/\s/.test(item) ? `"${item}"` : item))
    .join(" ");
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = JSON.stringify({
      command: candidate.command,
      baseArgs: candidate.baseArgs,
      explicitPath: candidate.explicitPath,
      origin: candidate.origin,
    });
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function candidateIdentity(candidate) {
  if (candidate.explicitPath) {
    return `path:${candidate.explicitPath.toLowerCase()}`;
  }

  return `cmd:${candidate.command.toLowerCase()} ${candidate.baseArgs.join(" ").toLowerCase()}`;
}

function executarViaCmd(command, args, options = {}) {
  const {
    cwd,
    timeoutMs = 120000,
  } = options;

  return new Promise((resolve, reject) => {
    const line = [escaparArgumentoCmd(command), ...args.map(escaparArgumentoCmd)].join(" ");
    const child = spawn("cmd.exe", ["/d", "/s", "/c", line], {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    let timer = undefined;

    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      timer = setTimeout(() => {
        if (finished) {
          return;
        }
        finished = true;
        child.kill();
        reject(Object.assign(new Error(`Command failed: ${line}\nProcesso excedeu o timeout de ${timeoutMs}ms.`), {
          stdout,
          stderr,
          code: 124,
        }));
      }, timeoutMs);
    }

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      if (finished) {
        return;
      }
      finished = true;
      if (timer) {
        clearTimeout(timer);
      }
      reject(Object.assign(error, { stdout, stderr }));
    });

    child.on("close", (code) => {
      if (finished) {
        return;
      }
      finished = true;
      if (timer) {
        clearTimeout(timer);
      }

      if ((code ?? 0) === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(Object.assign(new Error(`Command failed: ${line}`), {
        stdout,
        stderr,
        code: code ?? 1,
      }));
    });
  });
}

class SemaCliService {
  constructor(vscodeApi, context = undefined) {
    this.vscode = vscodeApi;
    this.context = context;
    this.infoCache = new Map();
    this.globalPrefixCache = undefined;
    this.shellPathCache = undefined;
    this.extensionVersion = safeReadExtensionVersion();
    this.minimumCompatibleCliVersion = this.extensionVersion;
  }

  getConfiguration() {
    return this.vscode.workspace.getConfiguration("sema");
  }

  getConfiguredCliPath() {
    const configured = this.getConfiguration().get("cliPath");
    return typeof configured === "string" && configured.trim().length > 0
      ? configured.trim()
      : undefined;
  }

  getConfiguredCliScope() {
    const inspection = this.getConfiguration().inspect?.("cliPath");
    if (!inspection) {
      return undefined;
    }

    if (typeof inspection.workspaceFolderValue === "string" && inspection.workspaceFolderValue.trim().length > 0) {
      return "workspace-folder";
    }
    if (typeof inspection.workspaceValue === "string" && inspection.workspaceValue.trim().length > 0) {
      return "workspace";
    }
    if (typeof inspection.globalValue === "string" && inspection.globalValue.trim().length > 0) {
      return "user";
    }
    if (typeof inspection.defaultValue === "string" && inspection.defaultValue.trim().length > 0) {
      return "default";
    }

    return undefined;
  }

  getAutoBootstrapMetadata() {
    return this.context?.globalState?.get?.("sema.cli.autoBootstrap") ?? undefined;
  }

  async markAutoBootstrap(metadata) {
    if (!this.context?.globalState?.update) {
      return;
    }

    await this.context.globalState.update("sema.cli.autoBootstrap", metadata);
  }

  async getGlobalNpmPrefix() {
    if (this.globalPrefixCache !== undefined) {
      return this.globalPrefixCache;
    }

    try {
      const result = await executarArquivo("npm", ["prefix", "-g"], {
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      });
      this.globalPrefixCache = String(result.stdout ?? "").trim() || undefined;
    } catch {
      this.globalPrefixCache = undefined;
    }

    return this.globalPrefixCache;
  }

  getWindowsUserNpmPath() {
    if (process.platform !== "win32") {
      return undefined;
    }

    const appData = process.env.APPDATA;
    if (!appData) {
      return undefined;
    }

    return path.join(appData, "npm", "sema.cmd");
  }

  async discoverShellResolvedPath() {
    if (this.shellPathCache !== undefined) {
      return this.shellPathCache;
    }

    try {
      if (process.platform === "win32") {
        const result = await executarArquivo("where.exe", ["sema"], {
          windowsHide: true,
          timeout: 10000,
          maxBuffer: 1024 * 1024,
        });
        this.shellPathCache = String(result.stdout ?? "")
          .split(/\r?\n/)
          .map((item) => item.trim())
          .find(Boolean);
        return this.shellPathCache;
      }

      const result = await executarArquivo("which", ["sema"], {
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
      this.shellPathCache = String(result.stdout ?? "").trim() || undefined;
      return this.shellPathCache;
    } catch {
      this.shellPathCache = undefined;
      return undefined;
    }
  }

  async buildCandidates(workspaceRoot) {
    const candidates = [];
    const configuredCli = this.getConfiguredCliPath();
    const executableName = obterNomeExecutavelSema();

    if (configuredCli) {
      candidates.push(criarExecucaoPorCaminho(configuredCli, "configuracao sema.cliPath", {
        sourceKind: "configured",
      }));
    }

    candidates.push({
      command: executableName,
      baseArgs: [],
      origin: "bin global ou shell atual",
      explicitPath: undefined,
      sourceKind: "shell-alias",
    });

    const shellResolvedPath = await this.discoverShellResolvedPath();
    if (shellResolvedPath && existsSync(shellResolvedPath)) {
      candidates.push(criarExecucaoPorCaminho(shellResolvedPath, "resolvido do shell", {
        sourceKind: "shell-path",
      }));
    }

    const globalPrefix = await this.getGlobalNpmPrefix();
    if (globalPrefix) {
      const globalBinary = path.join(globalPrefix, executableName);
      if (existsSync(globalBinary)) {
        candidates.push(criarExecucaoPorCaminho(globalBinary, "prefixo global do npm", {
          sourceKind: "npm-prefix",
        }));
      }
    }

    const windowsUserBinary = this.getWindowsUserNpmPath();
    if (windowsUserBinary && existsSync(windowsUserBinary)) {
      candidates.push(criarExecucaoPorCaminho(windowsUserBinary, "AppData do usuario no Windows", {
        sourceKind: "windows-appdata",
      }));
    }

    if (workspaceRoot) {
      const localBinary = path.join(workspaceRoot, "node_modules", ".bin", executableName);
      if (existsSync(localBinary)) {
        candidates.push(criarExecucaoPorCaminho(localBinary, "bin local do projeto", {
          sourceKind: "workspace-bin",
        }));
      }

      const repositoryCli = path.join(workspaceRoot, "pacotes", "cli", "dist", "index.js");
      if (existsSync(repositoryCli)) {
        candidates.push(criarExecucaoPorCaminho(repositoryCli, "CLI local do repositorio", {
          sourceKind: "workspace-repo",
        }));
      }
    }

    return uniqueCandidates(candidates);
  }

  async executeCandidate(candidate, args, options = {}) {
    const {
      cwd,
      timeoutMs = 120000,
      allowNonZero = false,
      expectJson = false,
    } = options;

    try {
      const result = isWindowsWrapper(candidate.command)
        ? await executarViaCmd(candidate.command, [...candidate.baseArgs, ...args], { cwd, timeoutMs })
        : await executarArquivo(candidate.command, [...candidate.baseArgs, ...args], {
          cwd,
          maxBuffer: 10 * 1024 * 1024,
          timeout: timeoutMs,
          windowsHide: true,
        });

      return {
        stdout: String(result.stdout ?? ""),
        stderr: String(result.stderr ?? ""),
        exitCode: 0,
        commandLine: formatCommandLine(candidate, args),
      };
    } catch (error) {
      const stdout = String(error.stdout ?? "");
      const stderr = String(error.stderr ?? "");
      const exitCode = typeof error.code === "number" ? error.code : 1;

      if ((allowNonZero || expectJson) && stdout.trim().length > 0) {
        return {
          stdout,
          stderr,
          exitCode,
          commandLine: formatCommandLine(candidate, args),
        };
      }

      if (allowNonZero) {
        return {
          stdout,
          stderr,
          exitCode,
          commandLine: formatCommandLine(candidate, args),
        };
      }

      throw error;
    }
  }

  async validateCandidate(candidate, workspaceRoot) {
    const versionResult = await this.executeCandidate(candidate, ["--version"], {
      cwd: workspaceRoot,
      timeoutMs: 15000,
    });

    const versionText = versionResult.stdout.trim() || versionResult.stderr.trim() || "desconhecida";
    const parsedVersion = versionToParts(versionText);
    const minimumVersion = versionToParts(this.minimumCompatibleCliVersion);

    if (!parsedVersion) {
      return {
        candidate,
        status: "incompatible",
        compatible: false,
        commandLine: versionResult.commandLine,
        version: versionText,
        reason: "A CLI foi encontrada, mas nao expôs uma versao semantica valida.",
      };
    }

    if (compareVersions(parsedVersion, minimumVersion) < 0) {
      return {
        candidate,
        status: "incompatible",
        compatible: false,
        commandLine: versionResult.commandLine,
        version: parsedVersion.raw,
        reason: `CLI encontrada, mas incompatível com esta extensao. Minimo requerido: ${this.minimumCompatibleCliVersion}.`,
      };
    }

    if (!workspaceRoot) {
      return {
        candidate,
        status: "compatible",
        compatible: true,
        commandLine: versionResult.commandLine,
        version: parsedVersion.raw,
        jsonCheck: "skipped",
      };
    }

    const jsonResult = await this.executeCandidate(candidate, ["inspecionar", ".", "--json"], {
      cwd: workspaceRoot,
      timeoutMs: 20000,
      allowNonZero: true,
      expectJson: true,
    });

    try {
      const payload = JSON.parse(jsonResult.stdout);
      return {
        candidate,
        status: "compatible",
        compatible: true,
        commandLine: versionResult.commandLine,
        version: parsedVersion.raw,
        jsonCheck: "ok",
        payloadSummary: {
          comando: payload.comando,
          sucesso: payload.sucesso,
        },
      };
    } catch {
      return {
        candidate,
        status: "incompatible",
        compatible: false,
        commandLine: versionResult.commandLine,
        version: parsedVersion.raw,
        reason: "CLI encontrada, mas respondeu sem JSON compatível para a checagem leve da extensão.",
        stdout: jsonResult.stdout,
      };
    }
  }

  resolveConfiguredOriginLabel(candidate) {
    const scope = this.getConfiguredCliScope();
    const autoBootstrap = this.getAutoBootstrapMetadata();
    if (autoBootstrap?.path && candidate.explicitPath && autoBootstrap.path.toLowerCase() === candidate.explicitPath.toLowerCase()) {
      return "auto bootstrap (usuario)";
    }
    if (scope === "user") {
      return "configuracao do usuario";
    }
    if (scope === "workspace" || scope === "workspace-folder") {
      return "configuracao do workspace";
    }
    return "configuracao sema.cliPath";
  }

  async explainResolution(workspaceRoot) {
    const configuredCli = this.getConfiguredCliPath();
    const configuredCliScope = this.getConfiguredCliScope();
    const candidates = await this.buildCandidates(workspaceRoot);
    const attempts = [];
    const compatibleCandidates = [];
    const incompatibleCandidates = [];
    const compatibleIdentities = new Set();
    const incompatibleIdentities = new Set();

    for (const candidate of candidates) {
      try {
        const validation = await this.validateCandidate(candidate, workspaceRoot);
        const attempt = {
          origin: candidate.origin,
          commandLine: validation.commandLine,
          explicitPath: candidate.explicitPath,
          success: validation.compatible,
          status: validation.status,
          version: validation.version,
          reason: validation.reason,
          jsonCheck: validation.jsonCheck,
        };
        attempts.push(attempt);

        const identity = candidateIdentity(validation.candidate);
        if (validation.compatible) {
          if (!compatibleIdentities.has(identity)) {
            compatibleCandidates.push(validation);
            compatibleIdentities.add(identity);
          }
        } else if (!incompatibleIdentities.has(identity)) {
          incompatibleCandidates.push(validation);
          incompatibleIdentities.add(identity);
        }
      } catch (error) {
        attempts.push({
          origin: candidate.origin,
          commandLine: formatCommandLine(candidate, ["--version"]),
          explicitPath: candidate.explicitPath,
          success: false,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const suggestedValidation = compatibleCandidates.find((item) => item.candidate.explicitPath);

    return {
      extensionVersion: this.extensionVersion,
      minimumCompatibleCliVersion: this.minimumCompatibleCliVersion,
      configuredCliPath: configuredCli,
      configuredCliScope,
      windowsUserNpmPath: this.getWindowsUserNpmPath(),
      globalNpmPrefix: await this.getGlobalNpmPrefix(),
      attempts,
      compatibleCandidates: compatibleCandidates.map((item) => ({
        origin: item.candidate.origin,
        explicitPath: item.candidate.explicitPath,
        version: item.version,
      })),
      incompatibleCandidates: incompatibleCandidates.map((item) => ({
        origin: item.candidate.origin,
        explicitPath: item.candidate.explicitPath,
        version: item.version,
        reason: item.reason,
      })),
      suggestedCliPath: suggestedValidation?.candidate.explicitPath,
      resolvedState: compatibleCandidates.length === 0
        ? (incompatibleCandidates.length > 0 ? "incompatible" : "unavailable")
        : compatibleCandidates.length === 1
          ? "ready"
          : "ambiguous",
    };
  }

  async getInfo(workspaceRoot, force = false) {
    const cacheKey = workspaceRoot ?? "__no-workspace__";
    if (!force && this.infoCache.has(cacheKey)) {
      return this.infoCache.get(cacheKey);
    }

    const explanation = await this.explainResolution(workspaceRoot);
    const compatibleCandidates = explanation.compatibleCandidates;
    const incompatibleCandidates = explanation.incompatibleCandidates;
    const configuredCliPath = explanation.configuredCliPath;

    let chosenCandidate;
    if (configuredCliPath) {
      chosenCandidate = compatibleCandidates.find((item) => item.explicitPath && item.explicitPath.toLowerCase() === configuredCliPath.toLowerCase());
    }

    if (!chosenCandidate && compatibleCandidates.length === 1) {
      chosenCandidate = compatibleCandidates[0];
    }

    if (chosenCandidate) {
      const info = {
        available: true,
        status: "ready",
        extensionVersion: this.extensionVersion,
        version: chosenCandidate.version,
        origin: chosenCandidate.origin === "configuracao sema.cliPath"
          ? this.resolveConfiguredOriginLabel({ explicitPath: chosenCandidate.explicitPath })
          : chosenCandidate.origin,
        commandLine: chosenCandidate.explicitPath ?? chosenCandidate.origin,
        configuredCliPath,
        configuredCliScope: explanation.configuredCliScope,
        minimumCompatibleCliVersion: this.minimumCompatibleCliVersion,
      };
      this.infoCache.set(cacheKey, info);
      return info;
    }

    const status = explanation.resolvedState;
    const unavailable = {
      available: false,
      status,
      extensionVersion: this.extensionVersion,
      version: undefined,
      origin: undefined,
      configuredCliPath,
      configuredCliScope: explanation.configuredCliScope,
      minimumCompatibleCliVersion: this.minimumCompatibleCliVersion,
      error: status === "ambiguous"
        ? `Mais de uma CLI valida da Sema foi encontrada.\n${compatibleCandidates.map((item) => `- ${item.origin}: ${item.explicitPath ?? item.origin} (${item.version})`).join("\n")}`
        : status === "incompatible"
          ? `A CLI da Sema foi encontrada, mas e incompatível com esta extensão.\n${incompatibleCandidates.map((item) => `- ${item.origin}: ${item.reason}`).join("\n")}`
          : "Nao foi possivel localizar a CLI da Sema.",
    };
    this.infoCache.set(cacheKey, unavailable);
    return unavailable;
  }

  invalidateInfo(workspaceRoot) {
    this.shellPathCache = undefined;
    this.globalPrefixCache = undefined;
    if (!workspaceRoot) {
      this.infoCache.clear();
      return;
    }

    this.infoCache.delete(workspaceRoot);
  }

  async run(args, options = {}) {
    const workspaceRoot = options.workspaceRoot;
    const failures = [];

    for (const candidate of await this.buildCandidates(workspaceRoot)) {
      try {
        const validation = await this.validateCandidate(candidate, workspaceRoot);
        if (!validation.compatible) {
          failures.push(`- ${candidate.origin}: ${validation.reason}`);
          continue;
        }

        const result = await this.executeCandidate(candidate, args, options);
        return {
          ...result,
          origin: candidate.origin,
          explicitPath: candidate.explicitPath,
        };
      } catch (error) {
        failures.push(`- ${candidate.origin}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    throw new Error(`Nao foi possivel executar a CLI da Sema.\n${failures.join("\n")}`);
  }

  async runJson(args, options = {}) {
    const result = await this.run(args, {
      ...options,
      allowNonZero: options.allowNonZero ?? true,
      expectJson: true,
    });

    try {
      return {
        ...result,
        payload: JSON.parse(result.stdout),
      };
    } catch (error) {
      throw new Error(
        `A CLI da Sema respondeu sem JSON valido para \`${result.commandLine}\`.\n` +
        `${error instanceof Error ? error.message : String(error)}\n\n` +
        `${result.stdout}`,
      );
    }
  }
}

module.exports = {
  SemaCliService,
  compareVersions,
  versionToParts,
};
