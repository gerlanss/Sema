// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.indice
// Descrição: reduz o índice semântico do projeto a módulos determinísticos relevantes para um pedido explícito.
import type { ResumoSemanticoModuloIa } from "./index.part01.js";

type EntradaIndice = Pick<ResumoSemanticoModuloIa,
  | "arquivo"
  | "modulo"
  | "faz"
  | "tarefasPrincipais"
  | "regrasCriticas"
  | "efeitos"
  | "riscosPrincipais"
  | "lacunas"
  | "arquivosProvaveis"
  | "checksSugeridos"
  | "testesMinimos"
  | "arquivosProvaveisEditar"
>;

export type IndexPack = {
  schema: "sema.ai.index-pack/v1";
  selection: "deterministic_weighted_match" | "deterministic_summary_projection";
  request: string;
  source: {
    command: "resumo-projeto";
    baseProject: string;
    generatedAt: string | null;
    totalModules: number;
    mode: string;
    drift: string;
  };
  matches: Array<{
    module: string;
    contract: string;
    relevanceScore: number;
    purpose: string;
    relevantTasks: string[];
    criticalRules: string[];
    effects: string[];
    risks: string[];
    knownGaps: string[];
    likelyFiles: string[];
    filesToEdit: string[];
    requiredChecks: string[];
    minimumTests: string[];
  }>;
  authority: {
    semaRemainsAuthority: true;
    rawIndexForwarded: false;
    executionRequiresFreshValidation: true;
    omitted: string[];
  };
  telemetry: {
    packChars: number;
    packEstimatedTokens: number;
    estimateMethod: "chars_div_4";
    sourceIndexEstimatedTokens: number;
    reductionPercent: number;
    selectedFields: string[];
  };
};

function texto(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function lista(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function tokens(value: string): string[] {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9_]+/)
    .filter((item) => item.length >= 3);
}

function correspondeToken(campo: string, pedido: Set<string>): boolean {
  return tokens(campo).some((token) => [...pedido].some((alvo) => token.startsWith(alvo) || alvo.startsWith(token)));
}

function selecionarValores(values: string[], requestTokens: Set<string>, maximo: number, projetarResumoInteiro: boolean): string[] {
  if (projetarResumoInteiro) return values.slice(0, maximo);
  return values
    .map((value, index) => ({
      value,
      index,
      score: correspondeToken(value, requestTokens) ? 1 : 0,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter((item) => item.score > 0)
    .slice(0, maximo)
    .map((item) => item.value);
}

function estimarTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function compactarModulo(modulo: EntradaIndice, requestTokens: Set<string>, projetarResumoInteiro: boolean) {
  const tarefas = lista(modulo.tarefasPrincipais);
  const regras = lista(modulo.regrasCriticas);
  const efeitos = lista(modulo.efeitos);
  const riscos = lista(modulo.riscosPrincipais);
  const lacunas = lista(modulo.lacunas);
  const arquivos = lista(modulo.arquivosProvaveis);
  const arquivosEditar = lista(modulo.arquivosProvaveisEditar);
  const checks = lista(modulo.checksSugeridos);
  const testes = lista(modulo.testesMinimos);
  const camposComPeso: Array<[string, string[], number]> = [
    [texto(modulo.modulo), [texto(modulo.modulo)], 5],
    [texto(modulo.faz), [texto(modulo.faz)], 3],
    ["tarefas", tarefas, 4],
    ["regras", regras, 2],
    ["efeitos", efeitos, 1],
    ["riscos", riscos, 2],
    ["lacunas", lacunas, 1],
    ["arquivos", [...arquivos, ...arquivosEditar], 1],
  ];
  const relevanceScore = projetarResumoInteiro ? 1 : camposComPeso.reduce((total, [, values, weight]) => total + values.reduce(
    (subtotal, value) => subtotal + (correspondeToken(value, requestTokens) ? weight : 0),
    0,
  ), 0);
  if (!projetarResumoInteiro && relevanceScore === 0) return null;
  return {
    module: texto(modulo.modulo),
    contract: texto(modulo.arquivo),
    relevanceScore,
    purpose: texto(modulo.faz),
    relevantTasks: selecionarValores(tarefas, requestTokens, 8, projetarResumoInteiro),
    criticalRules: selecionarValores(regras, requestTokens, 8, projetarResumoInteiro),
    effects: selecionarValores(efeitos, requestTokens, 6, projetarResumoInteiro),
    risks: selecionarValores(riscos, requestTokens, 6, projetarResumoInteiro),
    knownGaps: selecionarValores(lacunas, requestTokens, 6, projetarResumoInteiro),
    likelyFiles: selecionarValores(arquivos, requestTokens, 8, projetarResumoInteiro),
    filesToEdit: selecionarValores(arquivosEditar, requestTokens, 8, projetarResumoInteiro),
    requiredChecks: selecionarValores(checks, requestTokens, 6, projetarResumoInteiro),
    minimumTests: selecionarValores(testes, requestTokens, 6, projetarResumoInteiro),
  };
}

export function selecionarIndiceContexto(input: {
  modulos: readonly EntradaIndice[];
  request: string;
  baseProject: string;
  generatedAt?: string | null;
  mode?: string;
  drift?: string;
  sourceIndexChars?: number;
}): IndexPack {
  const request = input.request.trim();
  const requestTokens = new Set(tokens(request));
  const projetarResumoInteiro = request.length === 0 || request.startsWith("resumo:");
  const selection: IndexPack["selection"] = projetarResumoInteiro
    ? "deterministic_summary_projection"
    : "deterministic_weighted_match";
  const matches = input.modulos
    .map((modulo) => compactarModulo(modulo, requestTokens, projetarResumoInteiro))
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore || a.module.localeCompare(b.module, "pt-BR"))
    .slice(0, projetarResumoInteiro ? input.modulos.length : 8);
  const base = {
    schema: "sema.ai.index-pack/v1" as const,
    selection,
    request,
    source: {
      command: "resumo-projeto" as const,
      baseProject: input.baseProject,
      generatedAt: input.generatedAt ?? null,
      totalModules: input.modulos.length,
      mode: input.mode ?? "mudanca",
      drift: input.drift ?? "none",
    },
    matches,
    authority: {
      semaRemainsAuthority: true as const,
      rawIndexForwarded: false as const,
      executionRequiresFreshValidation: true as const,
      omitted: [
        "SEMA_INDEX.json completo",
        "agentContextPack duplicado",
        "módulos e campos fora do orçamento da projeção compacta",
        "catálogo e arquivos não relacionados ao pedido",
      ],
    },
  };
  const packChars = JSON.stringify(base).length;
  const sourceIndexChars = input.sourceIndexChars ?? 0;
  const sourceTokens = estimarTokens(sourceIndexChars);
  return {
    ...base,
    telemetry: {
      packChars,
      packEstimatedTokens: estimarTokens(packChars),
      estimateMethod: "chars_div_4",
      sourceIndexEstimatedTokens: sourceTokens,
      reductionPercent: sourceIndexChars === 0 ? 0 : Math.round((1 - packChars / sourceIndexChars) * 10000) / 100,
      selectedFields: [
        "request",
        "source.baseProject",
        "source.generatedAt",
        "matches.module",
        "matches.contract",
        "matches.relevanceScore",
        "matches.purpose",
        "matches.relevantTasks",
        "matches.criticalRules",
        "matches.effects",
        "matches.risks",
        "matches.knownGaps",
        "matches.likelyFiles",
        "matches.filesToEdit",
        "matches.requiredChecks",
        "matches.minimumTests",
        "authority",
      ],
    },
  };
}
