// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.seletor
// Descrição: seleciona contexto semântico relevante para uma IA a partir do resumo Sema, sem LLM, rede ou autorização implícita.
import type { ResumoSemanticoModuloIa, TamanhoResumoIa } from "./index.part01.js";

type ResumoEntrada = Partial<ResumoSemanticoModuloIa>;

export type ContextPackPayload = {
  geradoEm?: string;
  arquivo?: string;
  modulo?: string;
  modo?: string;
  tamanho?: string;
  analiseDrift?: {
    modo?: string;
    executada?: boolean;
    sucesso?: boolean | null;
    aviso?: string | null;
  };
  guiaPorCapacidade?: unknown;
  texto?: string;
  resumo?: ResumoEntrada;
};

export type ContextPack = {
  schema: "sema.ai.context-pack/v1";
  selection: "deterministic_allowlist";
  request: string;
  source: {
    command: "resumo";
    mode: string;
    size: string;
    drift: string;
    generatedAt: string | null;
    contract: string | null;
  };
  context: {
    module: string | null;
    purpose: string | null;
    relevantTasks: string[];
    criticalRules: string[];
    effects: string[];
    entities: string[];
    risks: string[];
    likelyFiles: string[];
    requiredChecks: string[];
    minimumTests: string[];
    compatibilityProfile: string | null;
    knownGaps: string[];
  };
  authority: {
    semaRemainsAuthority: true;
    rawSummaryForwarded: false;
    executionRequiresFreshValidation: true;
    omitted: string[];
  };
  telemetry: {
    packChars: number;
    packEstimatedTokens: number;
    estimateMethod: "chars_div_4";
    selectedFields: string[];
  };
};

export type ContextPackResult = {
  pack: ContextPack;
  rawSummaryChars: number;
  rawSummaryEstimatedTokens: number;
  rawSummaryEstimateMethod: "chars_div_4";
  reductionPercent: number;
};

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizedTokens(value: string): string[] {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9_]+/)
    .filter((token) => token.length >= 4);
}

function selectRelevantTasks(tasks: string[], request: string): string[] {
  if (request.startsWith("resumo:")) return tasks.slice(0, 8);
  const requestTokens = new Set(normalizedTokens(request));
  const intentRoots = ["cancel", "notific", "export", "reagend", "registr", "consult"];
  const rootedMatches = intentRoots
    .filter((root) => [...requestTokens].some((token) => token.startsWith(root)))
    .flatMap((root) => tasks.filter((task) => normalizedTokens(task).some((token) => token.startsWith(root))));
  if (rootedMatches.length > 0) return [...new Set(rootedMatches)];

  const scored = tasks.map((task, index) => {
    const taskTokens = normalizedTokens(task);
    const score = taskTokens.reduce((total, token) => total + (requestTokens.has(token) ? 1 : 0), 0);
    return { task, index, score };
  });
  const selected = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.task);
  return selected.length > 0 ? selected : tasks.slice(0, 3);
}

function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export function selecionarContexto(payload: ContextPackPayload, request: string): ContextPackResult {
  const resumo = payload.resumo ?? {};
  const context = {
    module: text(resumo.modulo) ?? text(payload.modulo),
    purpose: text(resumo.faz),
    relevantTasks: selectRelevantTasks(list(resumo.tarefasPrincipais), request),
    criticalRules: list(resumo.regrasCriticas),
    effects: list(resumo.efeitos),
    entities: list(resumo.entidadesAfetadas),
    risks: list(resumo.riscosPrincipais),
    likelyFiles: list(resumo.arquivosProvaveis),
    requiredChecks: list(resumo.checksSugeridos),
    minimumTests: list(resumo.testesMinimos),
    compatibilityProfile: text(resumo.perfilCompatibilidade),
    knownGaps: list(resumo.lacunas),
  };
  const packWithoutTelemetry = {
    schema: "sema.ai.context-pack/v1" as const,
    selection: "deterministic_allowlist" as const,
    request,
    source: {
      command: "resumo" as const,
      mode: text(payload.modo) ?? "mudanca",
      size: text(payload.tamanho) ?? "micro",
      drift: text(payload.analiseDrift?.modo) ?? "none",
      generatedAt: text(resumo.geradoEm) ?? text(payload.geradoEm),
      contract: text(resumo.arquivo) ?? text(payload.arquivo),
    },
    context,
    authority: {
      semaRemainsAuthority: true as const,
      rawSummaryForwarded: false as const,
      executionRequiresFreshValidation: true as const,
      omitted: [
        "cli_result_envelope",
        "guiaPorCapacidade",
        "texto_bruto_do_resumo",
        "metadados_fora_do_escopo",
      ],
    },
  };
  const packChars = JSON.stringify(packWithoutTelemetry).length;
  const selectedFields = [
    "request",
    "source.module",
    "source.contract",
    "context.module",
    "context.purpose",
    "context.relevantTasks",
    "context.criticalRules",
    "context.effects",
    "context.entities",
    "context.risks",
    "context.likelyFiles",
    "context.requiredChecks",
    "context.minimumTests",
    "context.compatibilityProfile",
    "context.knownGaps",
    "authority",
  ];
  const pack: ContextPack = {
    ...packWithoutTelemetry,
    telemetry: {
      packChars,
      packEstimatedTokens: estimateTokens(packChars),
      estimateMethod: "chars_div_4",
      selectedFields,
    },
  };
  const rawSummaryChars = JSON.stringify(payload).length;
  return {
    pack,
    rawSummaryChars,
    rawSummaryEstimatedTokens: estimateTokens(rawSummaryChars),
    rawSummaryEstimateMethod: "chars_div_4",
    reductionPercent: rawSummaryChars === 0 ? 0 : Math.round((1 - packChars / rawSummaryChars) * 10000) / 100,
  };
}

export function criarContextPackAPartirDoResumo(input: {
  resumo: ResumoSemanticoModuloIa;
  pedido?: string;
  modo: string;
  tamanho: TamanhoResumoIa;
  analiseDrift: ContextPackPayload["analiseDrift"];
  guiaPorCapacidade: unknown;
  texto: string;
}): ContextPackResult {
  const pedido = input.pedido?.trim() || `resumo:${input.tamanho}`;
  return selecionarContexto({
    geradoEm: input.resumo.geradoEm,
    arquivo: input.resumo.arquivo,
    modulo: input.resumo.modulo,
    modo: input.modo,
    tamanho: input.tamanho,
    analiseDrift: input.analiseDrift,
    guiaPorCapacidade: input.guiaPorCapacidade,
    texto: input.texto,
    resumo: input.resumo,
  }, pedido);
}
