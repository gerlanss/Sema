// SEMA-GOVERNED: sema.produto.sistemas_interativos + adaptadores + evidencias
// Descricao: tipos publicos do control plane declarativo para jogos e simulacoes.

export type JsonPrimitivoSistemaInterativo = string | number | boolean | null;
export type JsonValorSistemaInterativo = JsonPrimitivoSistemaInterativo | JsonObjetoSistemaInterativo | readonly JsonValorSistemaInterativo[];
export interface JsonObjetoSistemaInterativo {
  readonly [chave: string]: JsonValorSistemaInterativo;
}

export type KindSistemaInterativo = "GAME" | "SIMULATION" | "HYBRID";
export type ModeloEspacialSistemaInterativo =
  | "NON_SPATIAL"
  | "TWO_D"
  | "TWO_POINT_FIVE_D"
  | "THREE_D";
export type ModoRenderSistemaInterativo = "HEADLESS" | "TEXT" | "VISUAL" | "XR";
export type PerfilVisualSistemaInterativo =
  | "NONE"
  | "PIXEL_8_BIT"
  | "PIXEL_16_BIT"
  | "RASTER"
  | "VECTOR"
  | "STYLIZED"
  | "REALISTIC";
export type FidelidadeSistemaInterativo =
  | "ARCADE"
  | "STYLIZED"
  | "SYSTEMIC"
  | "REALISTIC"
  | "CALIBRATED";
export type ModoControleSistemaInterativo =
  | "HUMAN"
  | "SCRIPTED"
  | "AI"
  | "HYBRID"
  | "AUTONOMOUS"
  | "UNCONTROLLED";
export type ModeloTempoSistemaInterativo =
  | "TURN_BASED"
  | "FIXED_STEP"
  | "VARIABLE_STEP"
  | "REAL_TIME"
  | "EVENT_DRIVEN"
  | "BATCH"
  | "ACCELERATED";
export type DeterminismoSistemaInterativo = "NONE" | "BEST_EFFORT" | "STOCHASTIC" | "SEEDED" | "STRICT";

export interface DefinicaoSistemaInterativo {
  readonly schemaVersion: string;
  readonly systemId: string;
  readonly version: string;
  readonly kind: KindSistemaInterativo;
  readonly spatialModel: ModeloEspacialSistemaInterativo;
  readonly renderMode: ModoRenderSistemaInterativo;
  readonly visualProfile: PerfilVisualSistemaInterativo;
  readonly fidelity: FidelidadeSistemaInterativo;
  readonly controlModes: readonly ModoControleSistemaInterativo[];
  readonly timeModel: ModeloTempoSistemaInterativo;
  readonly determinism: DeterminismoSistemaInterativo;
  readonly capabilities: readonly string[];
  readonly pipelines: readonly string[];
  readonly adapterTargets: readonly string[];
  readonly world: JsonObjetoSistemaInterativo;
  readonly budgets?: JsonObjetoSistemaInterativo;
  readonly acceptance: JsonObjetoSistemaInterativo;
}

export interface ResultadoValidacaoDefinicaoSistemaInterativo {
  readonly valida: boolean;
  readonly definitionDigest: string;
  readonly capabilitiesRequeridas: readonly string[];
  readonly bloqueios: readonly string[];
}

export interface EtapaPipelineSistemaInterativo {
  readonly stageId: string;
  readonly capability: string;
  readonly dependsOn: readonly string[];
  readonly produces: readonly string[];
  readonly requiredEvidence: readonly string[];
}

export interface PipelineSistemaInterativo {
  readonly pipelineId: string;
  readonly version: string;
  readonly label: string;
  readonly summary: string;
  readonly kinds: readonly KindSistemaInterativo[];
  readonly spatialModels: readonly ModeloEspacialSistemaInterativo[];
  readonly renderModes: readonly ModoRenderSistemaInterativo[];
  readonly visualProfiles: readonly PerfilVisualSistemaInterativo[];
  readonly controlModes: readonly ModoControleSistemaInterativo[];
  readonly fidelities: readonly FidelidadeSistemaInterativo[];
  readonly capabilities: readonly string[];
  readonly stages: readonly EtapaPipelineSistemaInterativo[];
  readonly requiredEvidence: readonly string[];
  readonly useWhen: readonly string[];
  readonly avoidWhen: readonly string[];
}

export interface CapabilitySistemaInterativo {
  readonly capability: string;
  readonly label: string;
  readonly summary: string;
  readonly kinds: readonly KindSistemaInterativo[];
}

export type PapelAdaptadorSistemaInterativo =
  | "ENGINE"
  | "RUNTIME"
  | "EDITOR"
  | "ASSET"
  | "BUILD"
  | "TELEMETRY"
  | "VALIDATOR"
  | "CUSTOM";
export type FaseProtocoloAdaptador =
  | "DETECT"
  | "PROBE"
  | "SNAPSHOT"
  | "PLAN"
  | "APPLY"
  | "VALIDATE"
  | "EVIDENCE"
  | "ROLLBACK";

export interface AdaptadorSistemaInterativo {
  readonly adapterId: string;
  readonly version: string;
  readonly role: PapelAdaptadorSistemaInterativo;
  readonly engine: string;
  readonly kinds: readonly KindSistemaInterativo[];
  readonly spatialModels: readonly ModeloEspacialSistemaInterativo[];
  readonly renderModes: readonly ModoRenderSistemaInterativo[];
  readonly visualProfiles: readonly PerfilVisualSistemaInterativo[];
  readonly controlModes: readonly ModoControleSistemaInterativo[];
  readonly timeModels: readonly ModeloTempoSistemaInterativo[];
  readonly fidelities: readonly FidelidadeSistemaInterativo[];
  readonly capabilities: readonly string[];
  readonly protocol: readonly FaseProtocoloAdaptador[];
  readonly readOnlyProbe: true;
  readonly mutatesWorkspace: boolean;
  readonly supportsRollback: boolean;
  readonly executionBoundary: "EXTERNAL";
}

export interface FiltrosAdaptadoresSistemasInterativos {
  readonly kind?: KindSistemaInterativo;
  readonly spatialModel?: ModeloEspacialSistemaInterativo;
  readonly renderMode?: ModoRenderSistemaInterativo;
  readonly visualProfile?: PerfilVisualSistemaInterativo;
  readonly role?: PapelAdaptadorSistemaInterativo;
  readonly controlMode?: ModoControleSistemaInterativo;
  readonly timeModel?: ModeloTempoSistemaInterativo;
  readonly fidelity?: FidelidadeSistemaInterativo;
}

export interface ResultadoListagemAdaptadoresSistemasInterativos {
  readonly adapters: readonly AdaptadorSistemaInterativo[];
  readonly filtrosAplicados: FiltrosAdaptadoresSistemasInterativos;
  readonly executed: false;
}

export interface ResultadoValidacaoAdaptadorSistemaInterativo {
  readonly valido: boolean;
  readonly bloqueios: readonly string[];
}

export interface FaseExecutadaProtocoloAdapter {
  readonly phaseId: string;
  readonly phase: FaseProtocoloAdaptador;
  readonly semanticTargetId: string;
  readonly inputDigest: string;
  readonly outputDigest: string;
  readonly success: boolean;
}

export interface RegistroProtocoloAdapter {
  readonly runId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly semanticTargetId: string;
  readonly phases: readonly FaseExecutadaProtocoloAdapter[];
  readonly mutated: boolean;
  readonly success: boolean;
  readonly rollbackEvidenceId?: string;
}

export interface ResultadoValidacaoProtocoloAdapter {
  readonly valido: boolean;
  readonly faseAtual: FaseProtocoloAdaptador | "NOT_STARTED";
  readonly bloqueios: readonly string[];
  readonly exigeRollback: boolean;
}

export interface InstanciaEtapaSistemaInterativo extends EtapaPipelineSistemaInterativo {
  readonly pipelineId: string;
  readonly stageInstanceId: string;
}

export interface InstanciaPipelineSistemaInterativo {
  readonly pipelineId: string;
  readonly version: string;
  readonly stageInstanceIds: readonly string[];
  readonly requiredEvidence: readonly string[];
}

export interface ProvedorEtapaSistemaInterativo {
  readonly stageInstanceId: string;
  readonly capability: string;
  readonly candidateAdapterIds: readonly string[];
  readonly selectedAdapterIds: readonly string[];
  readonly coveredBySelection: boolean;
}

export interface PlanoSistemaInterativo {
  readonly systemId: string;
  readonly definitionDigest: string;
  readonly planDigest: string;
  readonly capabilitiesRequeridas: readonly string[];
  readonly capabilitiesAusentes: readonly string[];
  readonly pipelines: readonly InstanciaPipelineSistemaInterativo[];
  readonly adaptersCompativeis: readonly string[];
  readonly adaptersSelecionados: readonly string[];
  readonly adapterSelectionExplicit: boolean;
  readonly adapterCoverageComplete: boolean;
  readonly capabilitiesSemAdapter: readonly string[];
  readonly stageProviderMap: readonly ProvedorEtapaSistemaInterativo[];
  readonly stages: readonly InstanciaEtapaSistemaInterativo[];
  readonly nextActions: readonly string[];
  readonly executed: false;
}

export interface ResultadoPlanejamentoSistemaInterativo {
  readonly plano: PlanoSistemaInterativo;
  readonly bloqueios: readonly string[];
}

export interface ObservacaoSistemaInterativo {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly stageId: string;
  readonly semanticTargetId: string;
  readonly producerAdapterId: string;
  readonly producerAdapterVersion: string;
  readonly artifactDigest: string;
  readonly observedAt: string;
  readonly source: string;
  readonly data: JsonObjetoSistemaInterativo;
}

export interface BundleEvidenciasSistemaInterativo {
  readonly schemaVersion: string;
  readonly runId: string;
  readonly systemId: string;
  readonly definitionDigest: string;
  readonly planDigest: string;
  readonly observations: readonly ObservacaoSistemaInterativo[];
}

export interface ResultadoValidacaoBundleEvidenciasSistemaInterativo {
  readonly valido: boolean;
  readonly evidenciasAceitas: readonly string[];
  readonly evidenciasAusentes: readonly string[];
  readonly bloqueios: readonly string[];
}

export type StatusSistemaInterativo =
  | "INVALID"
  | "PLANNED"
  | "READY"
  | "RUNNING"
  | "WAITING_EVIDENCE"
  | "BLOCKED"
  | "STRUCTURALLY_COMPLETE";

export interface EstadoEtapaSistemaInterativo {
  readonly stageId: string;
  readonly status: "WAITING_EVIDENCE" | "STRUCTURALLY_COMPLETE";
  readonly evidenciasAusentes: readonly string[];
}

export interface EstadoSistemaInterativo {
  readonly status: StatusSistemaInterativo;
  readonly stages: readonly EstadoEtapaSistemaInterativo[];
  readonly evidenciasAceitas: readonly string[];
  readonly evidenciasAusentes: readonly string[];
  readonly bloqueios: readonly string[];
  readonly nextActions: readonly string[];
  readonly completed: false;
  readonly localCoverageComplete: boolean;
  readonly awaitingExternalAttestation: true;
  readonly completionScope: "STRUCTURAL_LOCAL";
  readonly authoritative: false;
}
