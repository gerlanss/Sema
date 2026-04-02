import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  TOOL_NAMES,
  buildExternalAiHandoff,
  buildLocalExplanation,
  buildSemaPrompt,
  inferWorkspaceKind,
  resolveActionOutputPaths,
} = require(path.resolve("pacotes/editor-vscode/sema-ai-core.js"));

test("editor-vscode ai core classifica workspace sema e legado", () => {
  assert.equal(inferWorkspaceKind({
    workspaceRoot: "C:/GitHub/Sema",
    hasSemaConfig: true,
    semaFilesCount: 0,
    legacySignalsCount: 3,
  }), "sema");

  assert.equal(inferWorkspaceKind({
    workspaceRoot: "C:/GitHub/Legado",
    hasSemaConfig: false,
    semaFilesCount: 0,
    legacySignalsCount: 2,
  }), "legacy");

  assert.equal(inferWorkspaceKind({
    workspaceRoot: undefined,
    hasSemaConfig: false,
    semaFilesCount: 0,
    legacySignalsCount: 0,
  }), "empty");
});

test("editor-vscode ai core resolve caminhos padrao de saida por alvo", () => {
  const caminhos = resolveActionOutputPaths({
    workspaceRoot: "C:/GitHub/Sema",
    targetPath: "C:/GitHub/Sema/contratos/pedidos.sema",
    buildTarget: "lua",
  });

  assert.equal(caminhos.contextOutputPath, path.join("C:/GitHub/Sema", ".tmp", "vscode-sema", "contexto", "contratos-pedidos"));
  assert.equal(caminhos.compileOutputPath, path.join("C:/GitHub/Sema", ".tmp", "vscode-sema", "compile", "contratos-pedidos", "lua"));
  assert.equal(caminhos.testOutputPath, path.join("C:/GitHub/Sema", ".tmp", "vscode-sema", "test", "contratos-pedidos", "lua"));
  assert.equal(caminhos.importOutputPath, path.join("C:/GitHub/Sema", "sema", "importado"));
});

test("editor-vscode ai core monta prompt com seed canonico e pedido do usuario", () => {
  const prompt = buildSemaPrompt({
    workspaceRoot: "C:/GitHub/Sema",
    workspaceKind: "sema",
    workspaceTrusted: true,
    cli: {
      available: true,
      version: "1.2.0",
      origin: "CLI local do repositorio",
    },
    canonicalEntrypoints: ["llms.txt", "SEMA_BRIEF.md", "SEMA_INDEX.json", "README.md", "docs/AGENT_STARTER.md"],
    activeTarget: {
      path: "C:/GitHub/Sema/contratos/pedidos.sema",
      isSema: true,
    },
    summary: {
      text: "MODULO: app.pedidos\nTOP_RISCOS: criar_pedido:alto",
    },
    inspection: {
      raw: {
        comando: "inspecionar",
        entrada: "C:/GitHub/Sema",
        configuracao: {
          scoreDrift: 88,
          confiancaGeral: "alta",
        },
      },
    },
    drift: {
      score: 88,
      confidence: "alta",
      raw: {
        comando: "drift",
        resumo_operacional: {
          scoreMedio: 88,
          confiancaGeral: "alta",
        },
        diagnosticos: [],
      },
    },
  }, {
    userPrompt: "Foca no contrato atual e me diz o que tocar.",
  });

  assert.match(prompt, /Voce e uma IA trabalhando em um projeto que usa Sema/);
  assert.match(prompt, /llms\.txt -> SEMA_BRIEF\.md -> SEMA_INDEX\.json -> README\.md -> docs\/AGENT_STARTER\.md/);
  assert.match(prompt, /npm install -g @semacode\/cli/);
  assert.match(prompt, /workspace_root: C:\/GitHub\/Sema/);
  assert.doesNotMatch(prompt, /extension_version:/);
  assert.doesNotMatch(prompt, /cli_minimum_compatible_version:/);
  assert.doesNotMatch(prompt, /cli_version:/);
  assert.match(prompt, /cli_origin: CLI local do repositorio/);
  assert.match(prompt, /MODULO: app\.pedidos/);
  assert.match(prompt, /Foca no contrato atual e me diz o que tocar/);
});

test("editor-vscode ai core monta handoff para IA externa", () => {
  const handoff = buildExternalAiHandoff({
    workspaceRoot: "C:/GitHub/Sema",
    workspaceKind: "sema",
    workspaceTrusted: true,
    cli: {
      available: true,
      version: "1.2.0",
      origin: "CLI local do repositorio",
    },
    canonicalEntrypoints: ["llms.txt", "SEMA_BRIEF.md", "SEMA_INDEX.json"],
  }, {
    promptText: "Leia a trilha canonica antes do codigo cru.",
    targetPath: "C:/GitHub/Sema/contratos/pedidos.sema",
    contextOutputPath: "C:/GitHub/Sema/.tmp/vscode-sema/contexto/contratos-pedidos",
    handoffPath: "C:/GitHub/Sema/.tmp/vscode-sema/contexto/contratos-pedidos/SEMA_EXTERNAL_AI.md",
  });

  assert.match(handoff, /# Sema External AI Handoff/);
  assert.doesNotMatch(handoff, /extension_version:/);
  assert.doesNotMatch(handoff, /cli_minimum_compatible_version:/);
  assert.doesNotMatch(handoff, /cli_version:/);
  assert.match(handoff, /cli_origin: CLI local do repositorio/);
  assert.match(handoff, /Leia a trilha canonica antes do codigo cru/);
  assert.match(handoff, /C:\/GitHub\/Sema\/\.tmp\/vscode-sema\/contexto\/contratos-pedidos/);
  assert.equal(TOOL_NAMES.inspectProject, "inspect_project");
});

test("editor-vscode ai core nao vaza versao da cli no painel local", () => {
  const explanation = buildLocalExplanation({
    workspaceRoot: "C:/GitHub/Sema",
    workspaceKind: "sema",
    cli: {
      available: true,
      version: "1.2.7",
      origin: "CLI local do repositorio",
    },
    drift: {
      score: 88,
      confidence: "alta",
    },
  });

  assert.match(explanation, /CLI: pronta via CLI local do repositorio/);
  assert.doesNotMatch(explanation, /1\.2\.7/);
});
