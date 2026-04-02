import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";

test("extensao VS Code declara painel de contexto e handoff para IA externa", async () => {
  const pacote = JSON.parse(await readFile(path.resolve("pacotes/editor-vscode/package.json"), "utf8"));
  const extension = await readFile(path.resolve("pacotes/editor-vscode/extension.js"), "utf8");
  const empacotador = await readFile(path.resolve("scripts/empacotar-extensao-vscode.mjs"), "utf8");

  assert.ok(pacote.activationEvents.includes("onStartupFinished"));
  assert.ok(pacote.activationEvents.includes("onLanguage:sema"));
  assert.ok(pacote.activationEvents.includes("onView:semaAiProject"));
  assert.ok(pacote.activationEvents.includes("onView:semaAiContext"));
  assert.ok(pacote.activationEvents.includes("workspaceContains:sema.config.json"));
  assert.ok(pacote.activationEvents.includes("workspaceContains:**/*.sema"));
  assert.ok(!pacote.activationEvents.some((item: string) => item.startsWith("onChatParticipant:")));
  assert.ok(!pacote.activationEvents.some((item: string) => item.startsWith("onLanguageModelTool:")));

  assert.equal(pacote.contributes.viewsContainers.activitybar[0].id, "sema-ai");
  assert.equal(pacote.contributes.viewsContainers.activitybar[0].title, "Sema Contexto");
  assert.deepEqual(
    pacote.contributes.views["sema-ai"].map((view: { id: string }) => view.id),
    ["semaAiProject", "semaAiContext"],
  );
  assert.equal(
    pacote.contributes.views["sema-ai"].find((view: { id: string }) => view.id === "semaAiContext").type,
    "webview",
  );

  assert.ok(!("chatParticipants" in pacote.contributes));
  assert.ok(!("languageModelTools" in pacote.contributes));

  assert.equal(pacote.contributes.configuration.properties["sema.ai.autoSeedOnOpen"].default, true);
  assert.equal(pacote.contributes.configuration.properties["sema.ai.sidebarEnabled"].default, true);
  assert.deepEqual(
    pacote.contributes.configuration.properties["sema.ai.seedScope"].enum,
    ["workspace+active", "workspace", "active"],
  );
  assert.ok(!("sema.ai.allowMutatingTools" in pacote.contributes.configuration.properties));

  assert.ok(pacote.contributes.commands.some((command: { command: string }) => command.command === "sema.abrirPainelIa"));
  assert.ok(pacote.contributes.commands.some((command: { command: string }) => command.command === "sema.atualizarContextoIa"));
  assert.ok(pacote.contributes.commands.some((command: { command: string }) => command.command === "sema.prepararContextoIaExterna"));
  assert.ok(pacote.contributes.commands.some((command: { command: string }) => command.command === "sema.diagnosticarCli"));
  assert.ok(pacote.contributes.commands.some((command: { command: string }) => command.command === "sema.autoconfigurarCli"));
  assert.ok(pacote.contributes.commands.some((command: { command: string }) => command.command === "sema.copiarPromptSema"));
  assert.ok(pacote.contributes.commands.some((command: { command: string }) => command.command === "sema.executarAcaoIa"));

  assert.match(extension, /SemaAiCoordinator/);
  assert.match(extension, /SemaWorkspaceStateService/);
  assert.doesNotMatch(extension, /SemaToolRegistry/);
  assert.doesNotMatch(extension, /SemaChatParticipant/);
  assert.match(empacotador, /sema-ai-core\.js/);
  assert.match(empacotador, /sema-sidebar-provider\.js/);
  assert.doesNotMatch(empacotador, /sema-chat-participant\.js/);
  assert.doesNotMatch(empacotador, /sema-tool-registry\.js/);
  assert.match(empacotador, /media/);
});
