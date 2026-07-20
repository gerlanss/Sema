// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: tipos e constantes compartilhadas para a entrada IA-first nativa do Codex.

import type { ResumoDescobertaAgentContext } from "./discovery/types.js";

export type CapacidadeIa = "fraca" | "media" | "forte";
export type CapacidadeIaLegada = "pequena" | "grande";
export type ChaveGuiaCapacidadeIa = CapacidadeIa | CapacidadeIaLegada;
export type GuiaCapacidadeIaMap = Record<ChaveGuiaCapacidadeIa, GuiaCapacidadeIa>;

export type TipoFonteAgentContext = "entrypoint" | "resumo" | "indice" | "operacional" | "exemplos" | "docs" | "contrato";

export interface GuiaCapacidadeIa {
  descricao: string;
  artefatos: string[];
  ordemLeitura: string[];
  evitar: string[];
}

export interface FonteAgentContextPack {
  caminho: string;
  tipo: TipoFonteAgentContext;
  prioridade: number;
  obrigatorio: boolean;
  quandoUsar: string;
  incluirTextoBrutoQuando: string;
}

export interface PoliticaIdiomaAgentContext {
  regra: string;
  idiomaHumanoPadrao: string;
  preservarAcentos: boolean;
  separarDslDeTextoHumano: boolean;
  comandosESimbolos: string;
}

export interface PoliticaCodigoGovernadoAgentContext {
  marcador: "SEMA-GOVERNED";
  regra: string;
  descricaoHumana: string;
  porCapacidade: Record<CapacidadeIa, string>;
  formatosPorAlvo: Record<string, string>;
}

export interface PoliticaTimeoutResumoAgentContext {
  regra: string;
  timeoutInicialSegundos: number;
  escalonamentoSegundos: number[];
  timeoutDoAgenteNaoEhFalhaSema: boolean;
  ateQuandoTentar: string;
  porCapacidade: Record<CapacidadeIa, string>;
}

export interface PoliticaDesignVisualAgentContext {
  regra: string;
  modernoObrigatorio: boolean;
  aplicarQuando: string;
  proibicoes: string[];
  porCapacidade: Record<CapacidadeIa, string>;
  evidencias: Record<CapacidadeIa, string[]>;
  criteriosMinimos: string[];
}

export interface PoliticaPlataformaAgentContext {
  regra: string;
  escopoGovernanca: string;
  naoContornaPoliticas: boolean;
  quandoHouverBloqueio: string;
  proibicoes: string[];
  porCapacidade: Record<CapacidadeIa, string>;
}

export interface AgentContextPack {
  nome: "Agent Context Pack";
  versao: number;
  objetivo: string;
  ordemLeitura: string[];
  regrasObrigatorias: string[];
  proibicoes: string[];
  prioridades: string[];
  fontes: FonteAgentContextPack[];
  descoberta: ResumoDescobertaAgentContext;
  exemplosOficiais: string[];
  textoBrutoSobDemanda: Record<string, string>;
  guiaPorCapacidade: Record<ChaveGuiaCapacidadeIa, string[]>;
  aliasesCapacidade: Record<CapacidadeIaLegada, CapacidadeIa>;
  entrypointCodex: "AGENTS.md";
  codexNativo: true;
  cliLocalSemAutorizacao: true;
  politicaIdioma: PoliticaIdiomaAgentContext;
  politicaCodigoGovernado: PoliticaCodigoGovernadoAgentContext;
  politicaTimeoutResumo: PoliticaTimeoutResumoAgentContext;
  politicaDesignVisual: PoliticaDesignVisualAgentContext;
  politicaPlataforma: PoliticaPlataformaAgentContext;
  failClosed: string[];
}

export const ARQUIVO_SEMA_BOOT = "SEMA_BOOT.md";
export const ARQUIVO_SEMA_SMALL_MODEL = "SEMA_SMALL_MODEL.md";
export const ARQUIVO_AGENT_CONTEXT_PACK = "AGENT_CONTEXT_PACK.json";
export const ARQUIVO_ENTRYPOINT_CODEX = "AGENTS.md";
export const ARQUIVO_DOC_AGENTES_CAPACIDADE = "docs/ai-integration.md";
export const ARQUIVOS_CANONICOS_IA_RAIZ = [
  ARQUIVO_SEMA_BOOT,
  ARQUIVO_AGENT_CONTEXT_PACK,
  ARQUIVO_SEMA_SMALL_MODEL,
  "SEMA_BRIEF.micro.txt",
  "SEMA_BRIEF.curto.txt",
  "SEMA_BRIEF.md",
  "SEMA_INDEX.json",
  ARQUIVO_ENTRYPOINT_CODEX,
  "README.md",
] as const;
export const CAPACIDADES_IA_OPERACIONAIS = ["fraca", "media", "forte"] as const;
export const ALIASES_CAPACIDADE_IA: Record<CapacidadeIaLegada, CapacidadeIa> = {
  pequena: "fraca",
  grande: "forte",
};
export const MARCADOR_SEMA_AGENT_ENTRYPOINT_INICIO = "<!-- sema:agent-entrypoint:start -->";
export const MARCADOR_SEMA_AGENT_ENTRYPOINT_FIM = "<!-- sema:agent-entrypoint:end -->";
export const DOCUMENTOS_SUPORTE_IA = [
  ARQUIVO_DOC_AGENTES_CAPACIDADE,
  "docs/ai-workflow.md",
  "docs/ai-onboarding.md",
  "docs/syntax.md",
  "docs/cli.md",
  "docs/commands.md",
  "docs/descoberta-capacidades.md",
  "docs/profiles.md",
  "docs/sistemas-interativos.md",
  "docs/testing.md",
  "docs/documentation.md",
  "docs/deploy.md",
  "docs/env.md",
  "docs/rollback.md",
] as const;
export const EXEMPLOS_OFICIAIS_AGENT_CONTEXT = [
  "exemplos/calculadora.sema",
  "exemplos/pagamento.sema",
  "exemplos/profile_software.sema",
  "exemplos/profile_workflow_n8n.sema",
  "exemplos/profile_ops.sema",
  "exemplos/profile_game.sema",
  "exemplos/profile_simulation.sema",
  "exemplos/sistemas-interativos/game-pixel-16-bit.json",
  "exemplos/sistemas-interativos/simulation-headless-autonomous-batch.json",
  "exemplos/sistemas-interativos/simulation-3d-calibrated-autonomous.json",
  "exemplos/sistemas-interativos/protocol-read-only-valid.json",
  "exemplos/profile_legal.sema",
  "exemplos/profile_research.sema",
  "exemplos/author_obra_comum.sema",
] as const;
