// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: tipos públicos e fronteira sem efeitos da descoberta de capacidades.

export const DISCOVERY_SCHEMA_VERSION = "sema.discovery/v1" as const;

export const DISCOVERY_KINDS = [
  "GOVERNANCE_FLOW",
  "PROFILE_GATE",
  "SPECIALIZED_WORKFLOW",
  "ORCHESTRATION_PIPELINE",
  "CAPABILITY_TOKEN",
  "GENERATOR",
  "ADAPTER",
] as const;

export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number];

export type DiscoveryEffectClass =
  | "READ_ONLY_DISCOVERY"
  | "READ_ONLY_VALIDATION"
  | "DECLARATIVE_PLANNING"
  | "WORKSPACE_BOOTSTRAP"
  | "WORKSPACE_GENERATION"
  | "WORKSPACE_VERIFICATION";

export interface DiscoveryCommandTemplate {
  readonly id: string;
  readonly command: string;
  readonly effectClass: DiscoveryEffectClass;
  readonly mutatesWorkspace: boolean;
  readonly executesExternalRuntime: boolean;
}

export interface DiscoveryEntry {
  readonly id: string;
  readonly kind: DiscoveryKind;
  readonly domains: readonly string[];
  readonly label: string;
  readonly summary: string;
  readonly useWhen: readonly string[];
  readonly avoidWhen: readonly string[];
  readonly intentSignals: readonly string[];
  readonly negativeSignals: readonly string[];
  readonly requiredInputs: readonly string[];
  readonly commandTemplates: readonly DiscoveryCommandTemplate[];
  readonly related: readonly string[];
  readonly source: string;
  readonly extensible: boolean;
  readonly aliases?: readonly string[];
}

export interface DiscoveryExecutionBoundary {
  readonly executed: false;
  readonly workspaceMutated: false;
  readonly externalCalls: false;
  readonly requiresExplicitRun: true;
}

export interface DiscoveryCatalogFilters {
  readonly kind?: DiscoveryKind | string | null;
  readonly id?: string | null;
  readonly domain?: string | null;
}

export interface DiscoveryCatalogPayload extends DiscoveryExecutionBoundary {
  readonly schemaVersion: typeof DISCOVERY_SCHEMA_VERSION;
  readonly command: "descobrir catalogo" | "descobrir pipeline listar";
  readonly success: true;
  readonly mode: "catalog";
  readonly filters: {
    readonly kind: DiscoveryKind | null;
    readonly id: string | null;
    readonly domain: string | null;
  };
  readonly entries: readonly DiscoveryEntry[];
}

export interface DiscoveryRecommendation {
  readonly rank: number;
  readonly id: string;
  readonly kind: DiscoveryKind;
  readonly label: string;
  readonly score: number;
  readonly matchedSignals: readonly string[];
  readonly reasons: readonly string[];
  readonly missingInputs: readonly string[];
  readonly suggestedCommandTemplate: string | null;
}

export interface DiscoveryAmbiguity {
  readonly detected: boolean;
  readonly delta: number | null;
  readonly candidates: readonly string[];
}

export interface DiscoveryRecommendationPayload extends DiscoveryExecutionBoundary {
  readonly schemaVersion: typeof DISCOVERY_SCHEMA_VERSION;
  readonly command: "descobrir recomendar";
  readonly success: true;
  readonly mode: "ranking";
  readonly intent: string;
  readonly recommendations: readonly DiscoveryRecommendation[];
  readonly ambiguity: DiscoveryAmbiguity;
  readonly noMatch: boolean;
}

export interface DiscoveryExplainPayload extends DiscoveryExecutionBoundary {
  readonly schemaVersion: typeof DISCOVERY_SCHEMA_VERSION;
  readonly command: "descobrir explicar" | "descobrir pipeline descrever";
  readonly success: true;
  readonly mode: "explain";
  readonly entry: DiscoveryEntry;
}

export interface DiscoveryErrorPayload extends DiscoveryExecutionBoundary {
  readonly schemaVersion: typeof DISCOVERY_SCHEMA_VERSION;
  readonly command: "descobrir";
  readonly success: false;
  readonly mode: "error";
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export type DiscoveryPayload =
  | DiscoveryCatalogPayload
  | DiscoveryRecommendationPayload
  | DiscoveryExplainPayload
  | DiscoveryErrorPayload;

export interface DiscoveryCommandResult {
  readonly exitCode: 0 | 2;
  readonly payload: DiscoveryPayload;
  readonly text: string;
  readonly outputFormat: "json" | "text";
  readonly executed: false;
}

export interface ResumoDescobertaAgentContext {
  readonly schemaVersion: typeof DISCOVERY_SCHEMA_VERSION;
  readonly command: "sema descobrir catalogo --json";
  readonly kinds: readonly DiscoveryKind[];
  readonly pipelinesPrincipais: readonly {
    readonly id: string;
    readonly label: string;
    readonly command: string;
  }[];
  readonly commands: {
    readonly catalogo: "sema descobrir catalogo --json";
    readonly recomendar: "sema descobrir recomendar --intencao <texto> --json";
    readonly explicar: "sema descobrir explicar <id> --json";
  };
}

/** @deprecated Prefira o nome canônico em PT-BR. */
export type DiscoveryAgentContextSummary = ResumoDescobertaAgentContext;
