import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { SemaCliService } = require(path.resolve("pacotes/editor-vscode/sema-cli-service.js"));
const { SemaAiCoordinator } = require(path.resolve("pacotes/editor-vscode/sema-ai-coordinator.js"));

function criarVscodeFake(configPath = "") {
  const estado = {
    value: configPath,
    updates: [] as Array<{ key: string; value: string; target: unknown }>,
  };

  return {
    estado,
    workspace: {
      getConfiguration() {
        return {
          get(key: string) {
            if (key === "cliPath") {
              return estado.value;
            }
            return undefined;
          },
          inspect(key: string) {
            if (key !== "cliPath") {
              return undefined;
            }
            return {
              globalValue: estado.value || undefined,
            };
          },
          async update(key: string, value: string, target: unknown) {
            estado.value = value;
            estado.updates.push({ key, value, target });
          },
        };
      },
    },
    ConfigurationTarget: {
      Global: "global",
    },
    window: {
      showInformationMessage() {},
      showWarningMessage() {},
    },
  };
}

test("editor-vscode cli service respeita cliPath configurado com precedencia total", async () => {
  const vscode = criarVscodeFake("C:\\Sema\\sema.cmd");
  const service = new SemaCliService(vscode);
  service.buildCandidates = async () => ([
    { command: "C:\\Sema\\sema.cmd", baseArgs: [], origin: "configuracao sema.cliPath", explicitPath: "C:\\Sema\\sema.cmd" },
    { command: "C:\\Outra\\sema.cmd", baseArgs: [], origin: "AppData do usuario no Windows", explicitPath: "C:\\Outra\\sema.cmd" },
  ]);
  service.validateCandidate = async (candidate: { origin: string; explicitPath: string }) => ({
    candidate,
    compatible: true,
    status: "compatible",
    version: "1.2.5",
    commandLine: candidate.explicitPath,
  });

  const info = await service.getInfo("C:\\GitHub\\Projeto", true);
  assert.equal(info.available, true);
  assert.equal(info.origin, "configuracao do usuario");
  assert.equal(info.configuredCliPath, "C:\\Sema\\sema.cmd");
});

test("editor-vscode cli service marca cli antiga como incompatível", async () => {
  const vscode = criarVscodeFake("");
  const service = new SemaCliService(vscode);
  service.buildCandidates = async () => ([
    { command: "C:\\Old\\sema.cmd", baseArgs: [], origin: "AppData do usuario no Windows", explicitPath: "C:\\Old\\sema.cmd" },
  ]);
  service.validateCandidate = async (candidate: { origin: string; explicitPath: string }) => ({
    candidate,
    compatible: false,
    status: "incompatible",
    version: "1.2.0",
    commandLine: candidate.explicitPath,
    reason: "CLI encontrada, mas incompatível com esta extensão. Minimo requerido: 1.2.5.",
  });

  const info = await service.getInfo("C:\\GitHub\\Projeto", true);
  assert.equal(info.available, false);
  assert.equal(info.status, "incompatible");
  assert.match(info.error, /incompatível/i);
});

test("editor-vscode cli service aponta ambiguidade com duas clis validas", async () => {
  const vscode = criarVscodeFake("");
  const service = new SemaCliService(vscode);
  service.buildCandidates = async () => ([
    { command: "C:\\A\\sema.cmd", baseArgs: [], origin: "prefixo global do npm", explicitPath: "C:\\A\\sema.cmd" },
    { command: "C:\\B\\sema.cmd", baseArgs: [], origin: "AppData do usuario no Windows", explicitPath: "C:\\B\\sema.cmd" },
  ]);
  service.validateCandidate = async (candidate: { origin: string; explicitPath: string }) => ({
    candidate,
    compatible: true,
    status: "compatible",
    version: "1.2.5",
    commandLine: candidate.explicitPath,
  });

  const info = await service.getInfo("C:\\GitHub\\Projeto", true);
  assert.equal(info.available, false);
  assert.equal(info.status, "ambiguous");
  assert.match(info.error, /Mais de uma CLI valida/);
});

test("editor-vscode ai coordinator faz auto bootstrap no usuario quando existe um unico candidato valido", async () => {
  const vscode = criarVscodeFake("");
  const globalStateStore = new Map<string, unknown>();
  const context = {
    extension: { packageJSON: { version: "1.2.5" } },
    globalState: {
      get(key: string) {
        return globalStateStore.get(key);
      },
      async update(key: string, value: unknown) {
        globalStateStore.set(key, value);
      },
    },
    subscriptions: [],
  };
  const stateService = {
    cliService: {
      async markAutoBootstrap() {},
    },
    async diagnoseCli() {
      return {
        resolvedState: "ready",
        suggestedCliPath: "C:\\Users\\gerlanss\\AppData\\Roaming\\npm\\sema.cmd",
      };
    },
    async refresh() {},
    scheduleRefresh() {},
    onDidChangeState() {},
  };
  const sidebarProvider = {
    refresh() {},
  };
  const coordinator = new SemaAiCoordinator(vscode, context, stateService, sidebarProvider);

  await coordinator.maybeAutoBootstrapCli();

  assert.equal(vscode.estado.updates.length, 1);
  assert.equal(vscode.estado.updates[0].key, "cliPath");
  assert.equal(vscode.estado.updates[0].value, "C:\\Users\\gerlanss\\AppData\\Roaming\\npm\\sema.cmd");
  assert.equal(vscode.estado.updates[0].target, "global");
});
