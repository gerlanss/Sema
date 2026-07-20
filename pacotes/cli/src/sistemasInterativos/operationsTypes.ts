// SEMA-GOVERNED: sema.produto.sistemas_interativos.operacao
// Descricao: schemas JSON v1 e tipos estaveis da fundacao operacional interativa.

export const OPERATION_RESULT_SCHEMA_V1 = "sema.interactive.operation-result/v1" as const;
export const ENGINE_SNAPSHOT_SCHEMA_V1 = "sema.interactive.engine-snapshot/v1" as const;
export const ENGINE_DIFF_SCHEMA_V1 = "sema.interactive.engine-diff/v1" as const;
export const ASSET_PROVENANCE_SCHEMA_V1 = "sema.interactive.asset-provenance/v1" as const;
export const EDITOR_STATE_SCHEMA_V1 = "sema.interactive.editor-state/v1" as const;
export const JOB_ORCHESTRATION_SCHEMA_V1 = "sema.interactive.job-orchestration/v1" as const;
export const ACCEPTANCE_LOCK_SCHEMA_V1 = "sema.interactive.acceptance-lock/v1" as const;
export const MULTIMODAL_EVIDENCE_SCHEMA_V1 = "sema.interactive.multimodal-evidence/v1" as const;

export type Sha256 = string & { readonly __sha256Brand: unique symbol };
export type OpaqueSha256 = string & { readonly __opaqueSha256Brand: unique symbol };

export interface OperationIssue {
  readonly code: string;
  readonly field: string;
}

export interface OperationResult<T> {
  readonly schemaVersion: typeof OPERATION_RESULT_SCHEMA_V1;
  readonly valid: boolean;
  readonly issues: readonly OperationIssue[];
  readonly value?: T;
  readonly digest?: Sha256;
  readonly executed: false;
  readonly workspaceMutated: false;
  readonly engineProbed: false;
  readonly editorInspected: false;
  readonly processesInspected: false;
  readonly resourcesReserved: false;
  readonly authoritative: false;
}

export interface EngineSemanticObjectSnapshot {
  readonly semanticId: string;
  readonly kind: string;
  readonly parentSemanticId?: string;
  readonly stateDigest: Sha256;
  readonly componentDigests: Readonly<Record<string, Sha256>>;
}

export interface EngineSnapshotV1 {
  readonly schemaVersion: typeof ENGINE_SNAPSHOT_SCHEMA_V1;
  readonly snapshotId: string;
  readonly projectId: string;
  readonly sceneId: string;
  readonly adapter: { readonly adapterId: string; readonly adapterVersion: string };
  readonly semanticObjects: readonly EngineSemanticObjectSnapshot[];
  readonly artifactDigest: Sha256;
  readonly readOnly: true;
  readonly authoritative: false;
}

export interface ValidatedEngineSnapshot {
  readonly snapshot: EngineSnapshotV1;
  readonly snapshotDigest: Sha256;
  readonly localValidationOnly: true;
}

export interface EngineSnapshotChange {
  readonly semanticId: string;
  readonly change: "ADDED" | "REMOVED" | "MODIFIED";
  readonly beforeDigest?: Sha256;
  readonly afterDigest?: Sha256;
}

export interface EngineSnapshotDiffV1 {
  readonly schemaVersion: typeof ENGINE_DIFF_SCHEMA_V1;
  readonly beforeSnapshotDigest: Sha256;
  readonly afterSnapshotDigest: Sha256;
  readonly bindingDigest: Sha256;
  readonly artifactDigestChanged: boolean;
  readonly changes: readonly EngineSnapshotChange[];
  readonly diffDigest: Sha256;
  readonly readOnly: true;
  readonly authoritative: false;
}

export interface AssetProvenanceV1 {
  readonly schemaVersion: typeof ASSET_PROVENANCE_SCHEMA_V1;
  readonly assetId: string;
  readonly sourceUriRef: OpaqueSha256;
  readonly sourceUriRedacted: true;
  readonly license: { readonly licenseId: string; readonly evidenceDigest: Sha256; readonly redistributable: boolean };
  readonly sourceHash: Sha256;
  readonly contentHash: Sha256;
  readonly transforms: readonly {
    readonly transformId: string; readonly toolRef: string; readonly toolVersion: string;
    readonly inputDigest: Sha256; readonly outputDigest: Sha256; readonly parametersDigest: Sha256;
  }[];
  readonly derivatives: readonly {
    readonly assetId: string; readonly parentContentHash: Sha256;
    readonly contentHash: Sha256; readonly transformDigest: Sha256;
  }[];
  readonly authoritative: false;
}

export interface EditorStateV1 {
  readonly schemaVersion: typeof EDITOR_STATE_SCHEMA_V1;
  readonly editorSessionId: string;
  readonly adapter: { readonly adapterId: string; readonly adapterVersion: string };
  readonly scene: { readonly semanticId: string; readonly artifactDigest: Sha256 };
  readonly selection: readonly string[];
  readonly mode: "EDIT" | "PLAY" | "PAUSED";
  readonly unsavedChanges: boolean;
  readonly shaderJobs: readonly { readonly jobId: string; readonly status: string; readonly progressBasisPoints: number }[];
  readonly importJobs: readonly { readonly jobId: string; readonly status: string; readonly progressBasisPoints: number }[];
  readonly plugins: readonly {
    readonly pluginId: string; readonly version: string; readonly enabled: boolean; readonly provenanceDigest: Sha256;
  }[];
  readonly modals: readonly { readonly modalId: string; readonly kind: string; readonly blocking: boolean }[];
  readonly processes: readonly { readonly processRef: OpaqueSha256; readonly role: string; readonly state: string }[];
  readonly observedAt: string;
  readonly readOnly: true;
  readonly authoritative: false;
}

export type ResourceLock = "GPU" | "EDITOR" | "CACHE";

export interface JobOrchestrationRequestV1 {
  readonly schemaVersion: typeof JOB_ORCHESTRATION_SCHEMA_V1;
  readonly queueId: string;
  readonly capacity: { readonly ramMb: number; readonly vramMb: number; readonly diskMb: number };
  readonly lockCapacity: Readonly<Record<ResourceLock, number>>;
  readonly jobs: readonly {
    readonly jobId: string;
    readonly kind: string;
    readonly priority: number;
    readonly dependencies: readonly string[];
    readonly locks: readonly ResourceLock[];
    readonly budget: { readonly ramMb: number; readonly vramMb: number; readonly diskMb: number };
    readonly heartbeat: { readonly intervalMs: number; readonly timeoutMs: number };
    readonly checkpoint: {
      readonly intervalMs: number; readonly resume: boolean;
      readonly checkpointDigest?: Sha256; readonly recoveryToken: OpaqueSha256;
    };
    readonly adapter: { readonly adapterId: string; readonly adapterVersion: string };
  }[];
}

export interface JobOrchestrationPlanV1 {
  readonly schemaVersion: typeof JOB_ORCHESTRATION_SCHEMA_V1;
  readonly queueId: string;
  readonly queue: readonly {
    readonly position: number; readonly jobId: string; readonly kind: string; readonly priority: number;
    readonly adapter: { readonly adapterId: string; readonly adapterVersion: string };
    readonly dependencies: readonly string[];
    readonly locks: readonly ResourceLock[];
    readonly budget: { readonly ramMb: number; readonly vramMb: number; readonly diskMb: number };
    readonly heartbeatIntervalMs: number; readonly heartbeatTimeoutMs: number;
    readonly checkpointIntervalMs: number; readonly resume: boolean;
    readonly checkpointDigest?: Sha256; readonly recoveryToken: OpaqueSha256;
  }[];
  readonly requestDigest: Sha256;
  readonly planDigest: Sha256;
  readonly externalRunnerRequired: true;
  readonly resourcesReserved: false;
  readonly authoritative: false;
}

export type AcceptanceOperation = "VALIDATE" | "EVALUATE" | "INVALIDATE";
export type AcceptanceInvalidationReason =
  | "ARTIFACT_CHANGED" | "SCENE_CHANGED" | "TIME_RANGE_CHANGED"
  | "APPROVER_REVOKED" | "MANUAL_WITHDRAWAL";
export type AcceptanceTimeRange = {
  readonly start: number;
  readonly end: number;
  readonly unit: "FRAME" | "TICK" | "SECOND";
};

export interface AcceptanceLockV1 {
  readonly schemaVersion: typeof ACCEPTANCE_LOCK_SCHEMA_V1;
  readonly lockId: string;
  readonly artifactDigest: Sha256;
  readonly sceneId: string;
  readonly timeRange: AcceptanceTimeRange;
  readonly approver: {
    readonly approverIdDigest: Sha256;
    readonly role: string;
    readonly method: "HUMAN" | "POLICY";
  };
  readonly decision: "ACCEPTED";
  readonly status: "ACTIVE" | "INVALIDATED";
  readonly createdAt: string;
  readonly invalidation?: {
    readonly previousLockDigest: Sha256;
    readonly invalidatedByDigest: Sha256;
    readonly reasonCode: AcceptanceInvalidationReason;
    readonly invalidatedAt: string;
  };
  readonly authoritative: false;
}

export interface AcceptanceOperationValue {
  readonly operation: AcceptanceOperation;
  readonly accepted: boolean;
  readonly bindingMatches: boolean;
  readonly invalidated: boolean;
  readonly blockers: readonly string[];
  readonly lock: AcceptanceLockV1;
  readonly lockDigest: Sha256;
}

export type MultimodalChannelType =
  | "SCREENSHOT" | "VIDEO" | "DEPTH" | "NORMALS" | "OBJECT_ID"
  | "MOTION" | "TRANSFORMS" | "EVENTS" | "AUDIO" | "TELEMETRY";

export interface MultimodalEvidenceDescriptorV1 {
  readonly schemaVersion: typeof MULTIMODAL_EVIDENCE_SCHEMA_V1;
  readonly evidenceId: string;
  readonly runId: string;
  readonly claimId: string;
  readonly definitionDigest: Sha256;
  readonly planDigest: Sha256;
  readonly contractDigest: Sha256;
  readonly claimBindingDigest: Sha256;
  readonly artifactDigest: Sha256;
  readonly sceneId: string;
  readonly timeRange: AcceptanceTimeRange;
  readonly requiredModalities: readonly MultimodalChannelType[];
  readonly channels: readonly {
    readonly channelId: string;
    readonly type: MultimodalChannelType;
    readonly artifactDigest: Sha256;
    readonly mediaType: string;
    readonly metadataDigest: Sha256;
    readonly sampleCount: number;
  }[];
  readonly producer: {
    readonly producerIdDigest: Sha256;
    readonly producerType: "ENGINE" | "EDITOR" | "RUNNER" | "MODEL" | "HUMAN" | "SENSOR";
    readonly version: string;
    readonly configurationDigest: Sha256;
  };
  readonly verifier: {
    readonly verifierIdDigest: Sha256;
    readonly verifierType: "RULE" | "MODEL" | "HUMAN" | "SENSOR";
    readonly version: string;
    readonly independent: true;
    readonly configurationDigest: Sha256;
  };
  readonly decision: {
    readonly verdict: "PASS" | "FAIL" | "INCONCLUSIVE";
    readonly reasonCodes: readonly string[];
    readonly confidenceBasisPoints: number;
  };
  readonly observedAt: string;
  readonly authoritative: false;
}
