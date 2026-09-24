// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.entrypoint_pack
// Descrição: seleciona a política operacional mínima do Agent Context Pack para uma capacidade explícita.
import type { AgentContextPack, CapacidadeIa } from "./agentContextTipos.js";

export type EntrypointPack = {
  schema: "sema.ai.entrypoint-pack/v1";
  selection: "deterministic_capacity_allowlist";
  capacity: CapacidadeIa;
  source: {
    command: "contexto-ia";
    entrypoint: string;
    version: number;
  };
  context: {
    objective: string;
    readingOrder: string[];
    capacityGuide: string[];
    mandatoryRules: string[];
    prohibitions: string[];
    priorities: string[];
    failClosed: string[];
    policies: {
      language: string;
      governedCode: string;
      timeout: string;
      platform: string;
      design: string;
    };
    onDemand: string[];
  };
  authority: {
    semaRemainsAuthority: true;
    rawAgentContextForwarded: false;
    freshValidationRequired: true;
    omitted: string[];
  };
  telemetry: {
    packChars: number;
    packEstimatedTokens: number;
    estimateMethod: "chars_div_4";
    rawAgentContextEstimatedTokens: number;
    reductionPercent: number;
    selectedFields: string[];
  };
};

function estimarTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export function criarEntrypointPack(input: {
  agentContextPack: AgentContextPack;
  capacity: CapacidadeIa;
  rawAgentContextChars?: number;
}): EntrypointPack {
  const source = input.agentContextPack;
  const base = {
    schema: "sema.ai.entrypoint-pack/v1" as const,
    selection: "deterministic_capacity_allowlist" as const,
    capacity: input.capacity,
    source: {
      command: "contexto-ia" as const,
      entrypoint: source.entrypointCodex,
      version: source.versao,
    },
    context: {
      objective: source.objetivo,
      readingOrder: source.ordemLeitura,
      capacityGuide: source.guiaPorCapacidade[input.capacity],
      mandatoryRules: source.regrasObrigatorias,
      prohibitions: source.proibicoes,
      priorities: source.prioridades,
      failClosed: source.failClosed,
      policies: {
        language: source.politicaIdioma.regra,
        governedCode: source.politicaCodigoGovernado.porCapacidade[input.capacity],
        timeout: source.politicaTimeoutResumo.porCapacidade[input.capacity],
        platform: source.politicaPlataforma.porCapacidade[input.capacity],
        design: source.politicaDesignVisual.porCapacidade[input.capacity],
      },
      onDemand: [
        "AGENTS.md",
        "SEMA_BOOT.md",
        "AGENT_CONTEXT_PACK.json",
        "SEMA_INDEX.json",
        "exemplos/",
        "contratos/",
      ],
    },
    authority: {
      semaRemainsAuthority: true as const,
      rawAgentContextForwarded: false as const,
      freshValidationRequired: true as const,
      omitted: [
        "fontes e descoberta completas",
        "exemplos oficiais completos",
        "texto bruto sob demanda",
        "guias e aliases de outras capacidades",
        "políticas duplicadas fora da capacidade selecionada",
      ],
    },
  };
  const packChars = JSON.stringify(base).length;
  const rawAgentContextChars = input.rawAgentContextChars ?? 0;
  return {
    ...base,
    telemetry: {
      packChars,
      packEstimatedTokens: estimarTokens(packChars),
      estimateMethod: "chars_div_4",
      rawAgentContextEstimatedTokens: estimarTokens(rawAgentContextChars),
      reductionPercent: rawAgentContextChars === 0 ? 0 : Math.round((1 - packChars / rawAgentContextChars) * 10000) / 100,
      selectedFields: [
        "capacity",
        "source",
        "context.objective",
        "context.readingOrder",
        "context.capacityGuide",
        "context.mandatoryRules",
        "context.prohibitions",
        "context.priorities",
        "context.failClosed",
        "context.policies",
        "context.onDemand",
        "authority",
      ],
    },
  };
}
