// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: saída humana agrupada, contextual e explícita sobre ausência de execução.

import type {
  DiscoveryCatalogPayload,
  DiscoveryEntry,
  DiscoveryExplainPayload,
  DiscoveryKind,
  DiscoveryPayload,
  DiscoveryRecommendationPayload,
} from "./types.js";

const KIND_LABELS: Record<DiscoveryKind, string> = {
  GOVERNANCE_FLOW: "Fluxos de governança",
  PROFILE_GATE: "Gates por profile",
  SPECIALIZED_WORKFLOW: "Workflows especializados",
  ORCHESTRATION_PIPELINE: "Pipelines de orquestração",
  CAPABILITY_TOKEN: "Capabilities declarativas",
  GENERATOR: "Geradores",
  ADAPTER: "Adapters externos",
};

const FRONTEIRA = "Nenhuma ação foi executada; o workspace e serviços externos não foram tocados.";

function linhaComando(entry: DiscoveryEntry): string {
  const command = entry.commandTemplates[0]?.command;
  return command ? `   Comando explícito: ${command}` : "   Comando explícito: não disponível";
}

function renderizarCatalogo(payload: DiscoveryCatalogPayload): string {
  const linhas = [
    "DESCOBERTA SEMA",
    `CATÁLOGO · ${payload.entries.length} capacidade(s)`,
    FRONTEIRA,
  ];

  if (payload.entries.length === 0) {
    linhas.push("", "Nenhuma capacidade corresponde aos filtros informados.");
    return linhas.join("\n");
  }

  for (const kind of Object.keys(KIND_LABELS) as DiscoveryKind[]) {
    const entries = payload.entries.filter((entry) => entry.kind === kind);
    if (entries.length === 0) continue;
    linhas.push("", `${KIND_LABELS[kind]} (${entries.length})`);
    for (const entry of entries) {
      linhas.push(
        `- ${entry.label} · ${entry.id}`,
        `   ${entry.summary}`,
        `   Use quando: ${entry.useWhen[0] ?? "consulte a descrição detalhada"}`,
        linhaComando(entry),
      );
    }
  }
  return linhas.join("\n");
}

function renderizarRanking(payload: DiscoveryRecommendationPayload): string {
  const linhas = [
    "DESCOBERTA SEMA",
    `INTENÇÃO · ${payload.intent}`,
    FRONTEIRA,
  ];

  if (payload.noMatch) {
    linhas.push("", "Sem correspondência segura (o melhor score ficou abaixo de 60/100).");
  } else if (payload.ambiguity.detected) {
    linhas.push(
      "",
      `Ambiguidade detectada entre ${payload.ambiguity.candidates.join(" e ")}.`,
      "Nenhum comando único foi sugerido; refine a intenção ou escolha uma capacidade explicitamente.",
    );
  }

  if (payload.recommendations.length === 0) {
    linhas.push("", "Nenhuma candidata recebeu sinais positivos.");
    return linhas.join("\n");
  }

  linhas.push("");
  for (const recommendation of payload.recommendations) {
    linhas.push(
      `${recommendation.rank}. ${recommendation.label} · ${recommendation.id} — ${recommendation.score}/100`,
      `   Motivos: ${recommendation.reasons.join("; ")}`,
      `   Sinais: ${recommendation.matchedSignals.join(", ") || "nenhum"}`,
    );
    if (recommendation.missingInputs.length > 0) {
      linhas.push(`   Entradas ainda necessárias: ${recommendation.missingInputs.join(", ")}`);
    }
    if (recommendation.suggestedCommandTemplate) {
      linhas.push(`   Comando explícito: ${recommendation.suggestedCommandTemplate}`);
    }
  }
  return linhas.join("\n");
}

function renderizarExplicacao(payload: DiscoveryExplainPayload): string {
  const entry = payload.entry;
  const linhas = [
    "DESCOBERTA SEMA",
    `${entry.label} · ${entry.id}`,
    `${KIND_LABELS[entry.kind]} · ${entry.domains.join(", ")}`,
    FRONTEIRA,
    "",
    entry.summary,
    "",
    "Use quando:",
    ...entry.useWhen.map((item) => `- ${item}`),
    "",
    "Evite quando:",
    ...entry.avoidWhen.map((item) => `- ${item}`),
    "",
    "Comandos explícitos:",
    ...entry.commandTemplates.map((item) => (
      `- ${item.command} [${item.effectClass}; muta workspace: ${item.mutatesWorkspace ? "sim" : "não"}; runtime externo: ${item.executesExternalRuntime ? "sim" : "não"}]`
    )),
  ];
  return linhas.join("\n");
}

export function renderizarResultadoDescoberta(payload: DiscoveryPayload): string {
  if (payload.mode === "catalog") return renderizarCatalogo(payload);
  if (payload.mode === "ranking") return renderizarRanking(payload);
  if (payload.mode === "explain") return renderizarExplicacao(payload);
  return [
    "DESCOBERTA SEMA · ERRO",
    payload.error.message,
    FRONTEIRA,
  ].join("\n");
}
