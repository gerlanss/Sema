// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.drift_pack
// Descrição: transporta evidência de drift em formato compacto sem esconder travas ou transformar inferência em prova.
import type { ResultadoDrift } from "./drift.part01.js";

export type DriftPack = {
  schema: "sema.ai.drift-pack/v1";
  selection: "deterministic_evidence_compaction";
  source: {
    command: "drift";
    scope: string;
    cache: string;
    targetModule: string | null;
  };
  status: {
    success: boolean;
    score: number;
    confidence: string;
    belowFloor: boolean;
    belowTarget: boolean;
    blocks: string[];
  };
  counts: {
    modules: number;
    tasks: number;
    validImplementations: number;
    brokenImplementations: number;
    validLinks: number;
    brokenLinks: number;
    outOfScopeLinks: number;
    divergentRoutes: number;
    validResources: number;
    divergentResources: number;
    realPersistence: number;
  };
  blockers: {
    implementations: Array<Record<string, unknown>>;
    links: Array<Record<string, unknown>>;
    routes: Array<Record<string, unknown>>;
    resources: Array<Record<string, unknown>>;
    diagnostics: Array<Record<string, unknown>>;
    tasksWithoutImplementation: Array<Record<string, unknown>>;
  };
  guidance: {
    touchFirst: string[];
    validate: string[];
    loose: string[];
    inferred: string[];
    risks: string[];
  };
  authority: {
    semaRemainsAuthority: true;
    rawDriftForwarded: false;
    freshValidationRequired: true;
    omitted: string[];
  };
  telemetry: {
    packChars: number;
    packEstimatedTokens: number;
    estimateMethod: "chars_div_4";
    rawDriftEstimatedTokens: number;
    reductionPercent: number;
    selectedFields: string[];
  };
};

function estimarTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function compactarRegistro(registro: Record<string, unknown>, campos: string[]): Record<string, unknown> {
  return Object.fromEntries(campos
    .filter((campo) => registro[campo] !== undefined && registro[campo] !== null)
    .map((campo) => [campo, registro[campo]]));
}

export function criarDriftPack(resultado: ResultadoDrift, options: {
  targetModule?: string;
  rawDriftChars?: number;
} = {}): DriftPack {
  const targetModule = options.targetModule ?? null;
  const tarefas = resultado.tasks
    .filter((task) => !targetModule || task.modulo === targetModule)
    .filter((task) => task.semImplementacao || task.implsQuebrados > 0 || task.lacunas.length > 0)
    .map((task) => compactarRegistro(task as unknown as Record<string, unknown>, [
      "modulo", "task", "impls", "implsValidos", "implsQuebrados", "semImplementacao", "scoreSemantico",
      "confiancaVinculo", "riscoOperacional", "lacunas", "arquivosProvaveisEditar", "checksSugeridos",
    ]));
  const base = {
    schema: "sema.ai.drift-pack/v1" as const,
    selection: "deterministic_evidence_compaction" as const,
    source: {
      command: "drift" as const,
      scope: resultado.escopo_aplicado.escopo,
      cache: resultado.escopo_aplicado.cache?.modo ?? "unknown",
      targetModule,
    },
    status: {
      success: resultado.sucesso,
      score: resultado.resumo_operacional.scoreMedio,
      confidence: resultado.resumo_operacional.confiancaGeral,
      belowFloor: resultado.resumo_operacional.pontuacaoAbaixoDoPiso,
      belowTarget: resultado.resumo_operacional.pontuacaoAbaixoDoAlvo,
      blocks: resultado.resumo_operacional.travasPontuacao,
    },
    counts: {
      modules: resultado.modulos.length,
      tasks: resultado.tasks.length,
      validImplementations: resultado.impls_validos.length,
      brokenImplementations: resultado.impls_quebrados.length,
      validLinks: resultado.vinculos_validos.length,
      brokenLinks: resultado.vinculos_quebrados.length,
      outOfScopeLinks: resultado.vinculos_fora_do_escopo.length,
      divergentRoutes: resultado.rotas_divergentes.length,
      validResources: resultado.recursos_validos.length,
      divergentResources: resultado.recursos_divergentes.length,
      realPersistence: resultado.persistencia_real.length,
    },
    blockers: {
      implementations: resultado.impls_quebrados.map((item) => compactarRegistro(item as unknown as Record<string, unknown>, ["modulo", "task", "origem", "caminho", "arquivo", "simbolo", "caminhoResolvido", "candidatos"])),
      links: resultado.vinculos_quebrados.map((item) => compactarRegistro(item as unknown as Record<string, unknown>, ["modulo", "donoTipo", "dono", "tipo", "valor", "arquivo", "simbolo", "status", "confianca"])),
      routes: resultado.rotas_divergentes.map((item) => compactarRegistro(item as unknown as Record<string, unknown>, ["modulo", "route", "metodo", "caminho", "motivo"])),
      resources: resultado.recursos_divergentes.map((item) => compactarRegistro(item as unknown as Record<string, unknown>, ["modulo", "task", "categoria", "alvo", "arquivo", "origem", "tipo", "status"])),
      diagnostics: resultado.diagnosticos.map((item) => compactarRegistro(item as unknown as Record<string, unknown>, ["tipo", "modulo", "task", "route", "arquivo", "severidade", "mensagem"])),
      tasksWithoutImplementation: tarefas,
    },
    guidance: {
      touchFirst: resultado.resumo_operacional.oQueTocar,
      validate: resultado.resumo_operacional.oQueValidar,
      loose: resultado.resumo_operacional.oQueEstaFrouxo,
      inferred: resultado.resumo_operacional.oQueFoiInferido,
      risks: resultado.resumo_operacional.riscosPrincipais,
    },
    authority: {
      semaRemainsAuthority: true as const,
      rawDriftForwarded: false as const,
      freshValidationRequired: true as const,
      omitted: [
        "implementações válidas detalhadas",
        "vínculos válidos detalhados",
        "catálogo de arquivos e bytes lidos",
        "cache interno e candidatos não bloqueantes",
      ],
    },
  };
  const packChars = JSON.stringify(base).length;
  const rawDriftChars = options.rawDriftChars ?? 0;
  return {
    ...base,
    telemetry: {
      packChars,
      packEstimatedTokens: estimarTokens(packChars),
      estimateMethod: "chars_div_4",
      rawDriftEstimatedTokens: estimarTokens(rawDriftChars),
      reductionPercent: rawDriftChars === 0 ? 0 : Math.round((1 - packChars / rawDriftChars) * 10000) / 100,
      selectedFields: [
        "source",
        "status",
        "counts",
        "blockers",
        "guidance",
        "authority",
      ],
    },
  };
}
