const path = require("node:path");

const VIEW_CONTAINER_ID = "sema-ai";
const PROJECT_VIEW_ID = "semaAiProject";
const CONTEXT_VIEW_ID = "semaAiContext";

const TOOL_NAMES = Object.freeze({
  inspectProject: "inspect_project",
  summarizeTarget: "summarize_target",
  measureDrift: "measure_drift",
  buildAiContext: "build_ai_context",
  validateTarget: "validate_target",
  importLegacy: "import_legacy",
  compileTarget: "compile_target",
  testTarget: "test_target",
});

const IMPORT_SOURCES = Object.freeze([
  "nestjs",
  "fastapi",
  "flask",
  "nextjs",
  "nextjs-consumer",
  "react-vite-consumer",
  "angular-consumer",
  "flutter-consumer",
  "firebase",
  "dotnet",
  "java",
  "go",
  "rust",
  "cpp",
  "typescript",
  "python",
  "dart",
  "lua",
]);

const BUILD_TARGETS = Object.freeze(["typescript", "python", "dart", "lua"]);
const BUILD_LAYOUTS = Object.freeze(["flat", "modulos", "backend"]);
const BUILD_FRAMEWORKS = Object.freeze(["base", "nestjs", "fastapi"]);
const SUMMARY_SIZES = Object.freeze(["micro", "curto", "medio"]);
const SUMMARY_MODES = Object.freeze(["resumo", "onboarding", "review", "mudanca", "bug", "arquitetura"]);

const CANONICAL_ENTRYPOINTS = Object.freeze([
  "llms.txt",
  "SEMA_BRIEF.md",
  "SEMA_INDEX.json",
  "README.md",
  "docs/AGENT_STARTER.md",
]);

const INTENT_NAMES = Object.freeze({
  onboard: "onboard",
  current: "current",
  legacy: "legacy",
  general: "general",
});

function truncateText(value, maxChars = 4000) {
  if (!value) {
    return "";
  }

  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 24)).trimEnd()}\n...[truncado pela extensao]`;
}

function slugifySegment(value) {
  return String(value ?? "workspace")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/\.[^./\\]+$/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "workspace";
}

function buildTargetSlug(workspaceRoot, targetPath) {
  if (!targetPath) {
    return "workspace";
  }

  const relativePath = workspaceRoot && path.isAbsolute(targetPath)
    ? path.relative(workspaceRoot, targetPath)
    : targetPath;

  return slugifySegment(relativePath);
}

function resolveActionOutputPaths({ workspaceRoot, targetPath, buildTarget = "typescript" }) {
  const targetSlug = buildTargetSlug(workspaceRoot, targetPath);
  const outputTarget = BUILD_TARGETS.includes(buildTarget) ? buildTarget : "typescript";

  return {
    contextOutputPath: path.join(workspaceRoot, ".tmp", "vscode-sema", "contexto", targetSlug),
    compileOutputPath: path.join(workspaceRoot, ".tmp", "vscode-sema", "compile", targetSlug, outputTarget),
    testOutputPath: path.join(workspaceRoot, ".tmp", "vscode-sema", "test", targetSlug, outputTarget),
    importOutputPath: path.join(workspaceRoot, "sema", "importado"),
  };
}

function inferWorkspaceKind({ workspaceRoot, hasSemaConfig = false, semaFilesCount = 0, legacySignalsCount = 0 }) {
  if (!workspaceRoot) {
    return "empty";
  }

  if (hasSemaConfig || semaFilesCount > 0) {
    return "sema";
  }

  if (legacySignalsCount > 0) {
    return "legacy";
  }

  return "empty";
}

function pickSeedScope(value) {
  if (value === "workspace") {
    return {
      mode: "workspace",
      includesWorkspace: true,
      includesActive: false,
    };
  }

  if (value === "active") {
    return {
      mode: "active",
      includesWorkspace: false,
      includesActive: true,
    };
  }

  return {
    mode: "workspace+active",
    includesWorkspace: true,
    includesActive: true,
  };
}

function previewJson(value, maxChars = 2800) {
  if (!value) {
    return "";
  }

  try {
    return truncateText(JSON.stringify(value, null, 2), maxChars);
  } catch {
    return truncateText(String(value), maxChars);
  }
}

function extractResponsePartText(part) {
  if (!part) {
    return "";
  }

  if (typeof part === "string") {
    return part;
  }

  if (typeof part.value === "string") {
    return part.value;
  }

  if (part.value && typeof part.value === "object" && typeof part.value.value === "string") {
    return part.value.value;
  }

  if (typeof part.markdown === "string") {
    return part.markdown;
  }

  if (part.markdown && typeof part.markdown.value === "string") {
    return part.markdown.value;
  }

  if (typeof part.content === "string") {
    return part.content;
  }

  return "";
}

function summarizeHistory(history = []) {
  return history
    .slice(-6)
    .map((turn) => {
      if (turn && typeof turn.prompt === "string") {
        return `usuario: ${turn.prompt}`;
      }

      if (turn && Array.isArray(turn.response)) {
        const responseText = turn.response.map(extractResponsePartText).filter(Boolean).join("\n");
        if (responseText) {
          return `@sema: ${truncateText(responseText, 600)}`;
        }
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function inferIntent(command, prompt = "", workspaceKind = "sema") {
  if (command === "onboard") {
    return INTENT_NAMES.onboard;
  }

  if (command === "current") {
    return INTENT_NAMES.current;
  }

  if (command === "legacy") {
    return INTENT_NAMES.legacy;
  }

  const normalized = String(prompt ?? "").toLowerCase();
  if (normalized.includes("legado") || normalized.includes("importar") || normalized.includes("adotar")) {
    return INTENT_NAMES.legacy;
  }

  if (normalized.includes("arquivo atual") || normalized.includes("modulo atual") || normalized.includes("current")) {
    return INTENT_NAMES.current;
  }

  if (normalized.includes("onboard") || normalized.includes("comecar") || normalized.includes("explica o projeto")) {
    return workspaceKind === "legacy" ? INTENT_NAMES.legacy : INTENT_NAMES.onboard;
  }

  return workspaceKind === "legacy" ? INTENT_NAMES.legacy : INTENT_NAMES.general;
}

function buildSnapshotSummary(snapshot) {
  const lines = [];

  lines.push(`workspace_root: ${snapshot.workspaceRoot ?? "nenhum"}`);
  lines.push(`workspace_kind: ${snapshot.workspaceKind ?? "empty"}`);
  lines.push(`workspace_trusted: ${snapshot.workspaceTrusted ? "sim" : "nao"}`);
  lines.push(`cli_available: ${snapshot.cli?.available ? "sim" : "nao"}`);

  if (snapshot.cli?.available) {
    lines.push(`cli_origin: ${snapshot.cli.origin ?? "desconhecida"}`);
  } else if (snapshot.cli?.error) {
    lines.push(`cli_error: ${snapshot.cli.error}`);
  }

  if (snapshot.activeTarget?.path) {
    lines.push(`active_target: ${snapshot.activeTarget.path}`);
    lines.push(`active_target_kind: ${snapshot.activeTarget.isSema ? "sema" : "legacy_or_workspace"}`);
  }

  const score = snapshot.drift?.score ?? snapshot.inspection?.raw?.configuracao?.scoreDrift;
  const confidence = snapshot.drift?.confidence ?? snapshot.inspection?.raw?.configuracao?.confiancaGeral;
  if (score !== undefined) {
    lines.push(`drift_score: ${score}`);
  }
  if (confidence) {
    lines.push(`drift_confidence: ${confidence}`);
  }

  if (Array.isArray(snapshot.canonicalEntrypoints) && snapshot.canonicalEntrypoints.length > 0) {
    lines.push(`canonical_entrypoints: ${snapshot.canonicalEntrypoints.join(" -> ")}`);
  }

  return lines.join("\n");
}

function buildSemaPrompt(snapshot, { intent = INTENT_NAMES.general, userPrompt = "", historyText = "" } = {}) {
  const instructions = [
    "Voce e uma IA trabalhando em um projeto que usa Sema como camada semantica para reduzir ambiguidade.",
    "Use a CLI da Sema como backend operacional e trate a camada semantica como fonte de verdade.",
    "Nao invente sintaxe fora da gramatica oficial da Sema.",
    "Se houver artefatos canonicos do projeto, recomende a trilha llms.txt -> SEMA_BRIEF.md -> SEMA_INDEX.json -> README.md -> docs/AGENT_STARTER.md.",
    "Ao orientar mudancas, cite comandos concretos da CLI quando isso reduzir adivinhacao.",
    "Se o workspace estiver em modo legado, priorize inspecionar, importar, drift e validacao incremental.",
    "Se a CLI da Sema estiver indisponivel ou incompatível, recomende atualizar ou instalar a versao mais recente com npm install -g @semacode/cli antes de seguir.",
  ];

  if (intent === INTENT_NAMES.onboard) {
    instructions.push("Foque em onboarding do projeto, rota canonica, modulos principais, score/confianca e proximo passo seguro.");
  } else if (intent === INTENT_NAMES.current) {
    instructions.push("Foque no alvo atual do editor e no que editar, validar, medir e gerar sem espalhar contexto inutil.");
  } else if (intent === INTENT_NAMES.legacy) {
    instructions.push("Foque em adocao de legado com Sema, incluindo importacao assistida, lacunas, drift e riscos.");
  } else {
    instructions.push("Responda de forma pragmatica, usando o seed local do workspace para evitar chute.");
  }

  const sections = [
    instructions.join("\n"),
    "",
    "[estado]",
    buildSnapshotSummary(snapshot),
  ];

  if (snapshot.summary?.text) {
    sections.push("", "[resumo]", truncateText(snapshot.summary.text, 2600));
  }

  if (snapshot.inspection?.raw) {
    const inspection = {
      comando: snapshot.inspection.raw.comando,
      entrada: snapshot.inspection.raw.entrada,
      configuracao: snapshot.inspection.raw.configuracao,
      projeto: snapshot.inspection.raw.projeto
        ? {
          arquivos: snapshot.inspection.raw.projeto.arquivos,
          modulos: snapshot.inspection.raw.projeto.modulos,
        }
        : undefined,
    };
    sections.push("", "[inspecionar_json]", previewJson(inspection, 3200));
  }

  if (snapshot.drift?.raw) {
    const drift = {
      comando: snapshot.drift.raw.comando,
      sucesso: snapshot.drift.raw.sucesso,
      resumo_operacional: snapshot.drift.raw.resumo_operacional,
      diagnosticos: snapshot.drift.raw.diagnosticos,
      rotas_divergentes: snapshot.drift.raw.rotas_divergentes,
    };
    sections.push("", "[drift_json]", previewJson(drift, 2800));
  }

  if (historyText) {
    sections.push("", "[historico]", truncateText(historyText, 1800));
  }

  sections.push("", "[pedido_usuario]", userPrompt || "Sem pedido explicito. Ofereca o proximo passo util.");

  return sections.join("\n");
}

function buildExternalAiHandoff(snapshot, { promptText, targetPath, contextOutputPath, handoffPath } = {}) {
  const lines = [];
  lines.push("# Sema External AI Handoff");
  lines.push("");
  lines.push("Use este arquivo como ponto de entrada antes de abrir codigo cru.");
  lines.push("");
  lines.push("## Estado");
  lines.push("");
  lines.push("```text");
  lines.push(buildSnapshotSummary(snapshot));
  lines.push("```");
  lines.push("");

  if (Array.isArray(snapshot.canonicalEntrypoints) && snapshot.canonicalEntrypoints.length > 0) {
    lines.push("## Trilha canonica");
    lines.push("");
    for (const entrypoint of snapshot.canonicalEntrypoints) {
      lines.push(`- ${entrypoint}`);
    }
    lines.push("");
  }

  if (targetPath) {
    lines.push(`## Alvo sugerido`);
    lines.push("");
    lines.push(`- \`${targetPath}\``);
    lines.push("");
  }

  if (contextOutputPath) {
    lines.push("## Pacote gerado");
    lines.push("");
    lines.push(`- diretorio: \`${contextOutputPath}\``);
    lines.push("- leia os artefatos desse pacote antes de editar ou revisar");
    lines.push("");
  }

  lines.push("## Prompt para colar em outra IA");
  lines.push("");
  lines.push("```text");
  lines.push(promptText || "Nenhum prompt gerado.");
  lines.push("```");
  lines.push("");
  lines.push("## Comandos uteis");
  lines.push("");
  lines.push("- `sema resumo <arquivo-ou-pasta> --micro --para mudanca`");
  lines.push("- `sema prompt-curto <arquivo-ou-pasta> --curto --para review`");
  lines.push("- `sema drift <arquivo-ou-pasta> --json`");
  lines.push("- `sema contexto-ia <arquivo.sema> --saida ./.tmp/contexto --json`");
  lines.push("- `sema validar <arquivo-ou-pasta> --json`");
  lines.push("");

  if (handoffPath) {
    lines.push("## Origem");
    lines.push("");
    lines.push(`- handoff: \`${handoffPath}\``);
    lines.push("");
  }

  return lines.join("\n");
}

function buildLocalExplanation(snapshot, intent = INTENT_NAMES.general) {
  const lines = [];
  lines.push("## Contexto Sema local");
  lines.push("");
  lines.push(`- Workspace: \`${snapshot.workspaceRoot ?? "nenhum"}\``);
  lines.push(`- Tipo: \`${snapshot.workspaceKind ?? "empty"}\``);
  lines.push(`- CLI: ${snapshot.cli?.available ? `pronta via ${snapshot.cli.origin}` : "indisponivel"}`);

  if (snapshot.activeTarget?.path) {
    lines.push(`- Alvo atual: \`${snapshot.activeTarget.path}\``);
  }

  const score = snapshot.drift?.score ?? snapshot.inspection?.raw?.configuracao?.scoreDrift;
  const confidence = snapshot.drift?.confidence ?? snapshot.inspection?.raw?.configuracao?.confiancaGeral;
  if (score !== undefined || confidence) {
    lines.push(`- Drift: score \`${score ?? "?"}\` com confianca \`${confidence ?? "desconhecida"}\``);
  }

  lines.push("");
  if (snapshot.summary?.text) {
    lines.push("### Resumo");
    lines.push("");
    lines.push("```text");
    lines.push(truncateText(snapshot.summary.text, 1600));
    lines.push("```");
    lines.push("");
  }

  lines.push("### Comandos uteis");
  lines.push("");
  if (intent === INTENT_NAMES.legacy) {
    lines.push("- `sema inspecionar . --json`");
    lines.push("- `sema importar <fonte> <diretorio> --saida ./sema/importado --json`");
    lines.push("- `sema drift . --json`");
  } else if (intent === INTENT_NAMES.current) {
    lines.push("- `sema resumo <arquivo-ou-pasta> --micro --para mudanca`");
    lines.push("- `sema validar <arquivo-ou-pasta> --json`");
    lines.push("- `sema drift <arquivo-ou-pasta> --json`");
  } else {
    lines.push("- `sema inspecionar . --json`");
    lines.push("- `sema resumo <arquivo-ou-pasta> --micro --para onboarding`");
    lines.push("- `sema prompt-curto <arquivo-ou-pasta> --curto --para review`");
  }

  if (!snapshot.cli?.available) {
    lines.push("");
    lines.push("### CLI indisponivel");
    lines.push("");
    lines.push("- Atualize ou instale a versao mais recente com `npm install -g @semacode/cli`.");
    lines.push("- Se o VS Code continuar cego, configure `sema.cliPath` ou rode a extensao dentro do monorepo da Sema.");
  }

  return lines.join("\n");
}

module.exports = {
  BUILD_FRAMEWORKS,
  BUILD_LAYOUTS,
  BUILD_TARGETS,
  CANONICAL_ENTRYPOINTS,
  CONTEXT_VIEW_ID,
  IMPORT_SOURCES,
  INTENT_NAMES,
  PROJECT_VIEW_ID,
  SUMMARY_MODES,
  SUMMARY_SIZES,
  TOOL_NAMES,
  VIEW_CONTAINER_ID,
  buildExternalAiHandoff,
  buildLocalExplanation,
  buildSemaPrompt,
  buildSnapshotSummary,
  buildTargetSlug,
  inferIntent,
  inferWorkspaceKind,
  pickSeedScope,
  previewJson,
  resolveActionOutputPaths,
  slugifySegment,
  summarizeHistory,
  truncateText,
};
