// SEMA-GOVERNED: sema.produto.sistemas_interativos.extensoes_cli
// Descricao: superficie CLI read-only para IR, operacao, tempo, autonomia e portabilidade.

import { readFile } from "node:fs/promises";
import {
  SCHEMA_AUTONOMIA,
  SCHEMA_AUTORIDADE_MULTIPLAYER,
  SCHEMA_PLAYTEST_FUZZ,
  validarCicloReparoAutonomo,
  validarModeloAutoridadeMultiplayer,
  validarPlanoPlaytestFuzz,
} from "./autonomy.js";
import {
  EXPERIENCE_IR_CHUNK_SCHEMA_VERSION,
  EXPERIENCE_IR_INDEX_SCHEMA_VERSION,
  EXPERIENCE_IR_SCHEMA_VERSION,
  EXPERIENCE_IR_SERIALIZATION_SCHEMA_VERSION,
  consultarIndiceExperienceIr,
  criarChunkExperienceIr,
  descreverSerializacaoExperienceIr,
  indexarExperienceIr,
  validarExperienceIr,
} from "./experienceIr.js";
import {
  ACCEPTANCE_LOCK_SCHEMA_V1,
  ASSET_PROVENANCE_SCHEMA_V1,
  EDITOR_STATE_SCHEMA_V1,
  ENGINE_DIFF_SCHEMA_V1,
  ENGINE_SNAPSHOT_SCHEMA_V1,
  JOB_ORCHESTRATION_SCHEMA_V1,
  MULTIMODAL_EVIDENCE_SCHEMA_V1,
  OPERATION_RESULT_SCHEMA_V1,
  derivarDiffSnapshotsEngine,
  operarAcceptanceLock,
  planejarOrquestracaoJobs,
  validarAcceptanceLock,
  validarEstadoEditor,
  validarEvidenciaMultimodal,
  validarProvenienciaAsset,
  validarSnapshotEngine,
} from "./operations.js";
import {
  SCHEMA_PORTABILIDADE,
  SCHEMA_WORKERS_DISTRIBUIDOS,
  analisarPlanoPortabilidadeInterativa,
  validarPlanoWorkersDistribuidos,
} from "./portability.js";
import {
  SCHEMA_CONTRATO_TEMPORAL,
  SCHEMA_EVIDENCIA_TEMPORAL,
  validarBundleVerificacaoTemporal,
  validarContratoTemporalInterativo,
} from "./temporal.js";

export const INTERACTIVE_CLI_EXTENSION_SCHEMA_VERSION = "sema.interactive.cli-extensions/v1" as const;

const EXPERIENCE_IR_VALIDATION_RESULT_SCHEMA_VERSION = "sema.experience-ir.validation-result/v1" as const;
const EXPERIENCE_IR_INDEX_ENTRY_SCHEMA_VERSION = "sema.experience-ir.index-entry/v1" as const;
const TEMPORAL_VALIDATION_RESULT_SCHEMA_VERSION = "sema.interactive.temporal-validation-result/v1" as const;
const TEMPORAL_EVIDENCE_VALIDATION_RESULT_SCHEMA_VERSION = "sema.interactive.temporal-evidence-validation-result/v1" as const;
const AUTONOMY_VALIDATION_RESULT_SCHEMA_VERSION = "sema.interactive.autonomy-validation-result/v1" as const;
const PLAYTEST_FUZZ_VALIDATION_RESULT_SCHEMA_VERSION = "sema.interactive.playtest-fuzz-validation-result/v1" as const;
const MULTIPLAYER_VALIDATION_RESULT_SCHEMA_VERSION = "sema.interactive.multiplayer-validation-result/v1" as const;
const PORTABILITY_ANALYSIS_RESULT_SCHEMA_VERSION = "sema.interactive.portability-analysis-result/v1" as const;
const DISTRIBUTED_WORKERS_VALIDATION_RESULT_SCHEMA_VERSION = "sema.interactive.distributed-workers-validation-result/v1" as const;

export const SUBCOMANDOS_EXTENSAO_INTERATIVA = Object.freeze([
  "validar-ir",
  "indexar-ir",
  "consultar-ir",
  "chunk-ir",
  "descrever-ir",
  "validar-engine-snapshot",
  "diff-engine-snapshots",
  "validar-asset-provenance",
  "validar-editor-state",
  "planejar-jobs",
  "validar-acceptance",
  "operar-acceptance",
  "validar-multimodal",
  "validar-temporal",
  "validar-evidencia-temporal",
  "validar-autonomia",
  "validar-playtest-fuzz",
  "validar-multiplayer",
  "analisar-portabilidade",
  "validar-workers",
] as const);

export type SubcomandoExtensaoInterativa = typeof SUBCOMANDOS_EXTENSAO_INTERATIVA[number];

type ResultadoExtensao = {
  readonly exitCode: number;
  readonly payload: Record<string, unknown>;
};

type Especificacao = {
  readonly posicionais: number;
  readonly opcoes?: Readonly<Record<string, string>>;
  readonly flags?: readonly string[];
  readonly obrigatorias?: readonly string[];
};

type ArgumentosExtensao = {
  readonly subcomando: SubcomandoExtensaoInterativa;
  readonly posicionais: readonly string[];
  readonly opcoes: Readonly<Record<string, string>>;
  readonly flags: ReadonlySet<string>;
};

const COMANDOS_SCHEMA = Object.freeze({
  "validar-ir": { positionals: ["irFile"], purpose: "validate content-addressed Experience IR" },
  "indexar-ir": { positionals: ["irFile"], purpose: "derive an in-memory semantic index" },
  "consultar-ir": { positionals: ["irFile"], options: ["--semantic-id"], purpose: "query one semantic ID" },
  "chunk-ir": { positionals: ["irFile"], options: ["--semantic-id", "--raso"], purpose: "derive a bounded IR chunk" },
  "descrever-ir": { positionals: [], purpose: "describe native JSON and external CBOR support" },
  "validar-engine-snapshot": { positionals: ["snapshotFile"], purpose: "validate a declared read-only engine snapshot" },
  "diff-engine-snapshots": { positionals: ["beforeFile", "afterFile"], purpose: "derive a deterministic snapshot diff" },
  "validar-asset-provenance": { positionals: ["provenanceFile"], purpose: "validate opaque asset provenance" },
  "validar-editor-state": { positionals: ["editorStateFile"], purpose: "validate a declared editor state" },
  "planejar-jobs": { positionals: ["jobsFile"], purpose: "plan jobs, locks, budgets and recovery" },
  "validar-acceptance": { positionals: ["lockFile"], purpose: "validate an acceptance lock" },
  "operar-acceptance": { positionals: ["lockFile"], options: ["--operation", "--context-file"], purpose: "validate, evaluate or invalidate an acceptance lock" },
  "validar-multimodal": { positionals: ["evidenceFile"], purpose: "validate multimodal evidence descriptors" },
  "validar-temporal": { positionals: ["contractFile"], purpose: "validate 4D, camera, physics, QA, build and hardware contracts" },
  "validar-evidencia-temporal": { positionals: ["contractFile"], options: ["--bundle-arquivo", "--evidencias-arquivo"], purpose: "validate temporal evidence against its contract" },
  "validar-autonomia": { positionals: ["cycleFile"], purpose: "validate diagnose-propose-simulate-prove cycles" },
  "validar-playtest-fuzz": { positionals: ["planFile"], purpose: "validate bounded bot, fuzz and save/load plans" },
  "validar-multiplayer": { positionals: ["modelFile"], purpose: "validate authority, replication and conflicts" },
  "analisar-portabilidade": { positionals: ["planFile"], purpose: "analyze explicit losses, fallbacks and migration gates" },
  "validar-workers": { positionals: ["planFile"], purpose: "validate distributed workers, leases and dependencies" },
});

const VINCULOS_SCHEMA_COMANDO: Readonly<Record<SubcomandoExtensaoInterativa, {
  readonly inputSchemaKeys: readonly string[];
  readonly outputSchemaKeys: readonly string[];
  readonly officialFixturePaths: readonly string[];
  readonly contextRequiredTopLevelFields?: readonly string[];
}>> = Object.freeze({
  "validar-ir": { inputSchemaKeys: ["experienceIr"], outputSchemaKeys: ["experienceIrValidationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/experience-ir-valid.json"] },
  "indexar-ir": { inputSchemaKeys: ["experienceIr"], outputSchemaKeys: ["experienceIrIndex"], officialFixturePaths: ["exemplos/sistemas-interativos/experience-ir-valid.json"] },
  "consultar-ir": { inputSchemaKeys: ["experienceIr"], outputSchemaKeys: ["experienceIrIndexEntry"], officialFixturePaths: ["exemplos/sistemas-interativos/experience-ir-valid.json"] },
  "chunk-ir": { inputSchemaKeys: ["experienceIr"], outputSchemaKeys: ["experienceIrChunk"], officialFixturePaths: ["exemplos/sistemas-interativos/experience-ir-valid.json"] },
  "descrever-ir": { inputSchemaKeys: [], outputSchemaKeys: ["experienceIrSerialization"], officialFixturePaths: [] },
  "validar-engine-snapshot": { inputSchemaKeys: ["engineSnapshot"], outputSchemaKeys: ["operationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/engine-snapshot-before-valid.json"] },
  "diff-engine-snapshots": { inputSchemaKeys: ["engineSnapshot", "engineSnapshot"], outputSchemaKeys: ["operationResult", "engineDiff"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/engine-snapshot-before-valid.json", "exemplos/sistemas-interativos/advanced/engine-snapshot-after-valid.json"] },
  "validar-asset-provenance": { inputSchemaKeys: ["assetProvenance"], outputSchemaKeys: ["operationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/asset-provenance-valid.json"] },
  "validar-editor-state": { inputSchemaKeys: ["editorState"], outputSchemaKeys: ["operationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/editor-state-valid.json"] },
  "planejar-jobs": { inputSchemaKeys: ["jobOrchestration"], outputSchemaKeys: ["operationResult", "jobOrchestrationPlan"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/job-orchestration-valid.json"] },
  "validar-acceptance": { inputSchemaKeys: ["acceptanceLock"], outputSchemaKeys: ["operationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/acceptance-lock-valid.json"] },
  "operar-acceptance": { inputSchemaKeys: ["acceptanceLock"], outputSchemaKeys: ["operationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/acceptance-lock-valid.json", "exemplos/sistemas-interativos/advanced/acceptance-context-evaluate-valid.json"], contextRequiredTopLevelFields: ["artifactDigest", "sceneId", "timeRange"] },
  "validar-multimodal": { inputSchemaKeys: ["multimodalEvidence"], outputSchemaKeys: ["operationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/multimodal-evidence-valid.json"] },
  "validar-temporal": { inputSchemaKeys: ["temporalContract"], outputSchemaKeys: ["temporalValidationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/temporal-valid.json"] },
  "validar-evidencia-temporal": { inputSchemaKeys: ["temporalContract", "temporalEvidence"], outputSchemaKeys: ["temporalEvidenceValidationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/temporal-valid.json", "exemplos/sistemas-interativos/advanced/temporal-evidence-valid.json"] },
  "validar-autonomia": { inputSchemaKeys: ["autonomy"], outputSchemaKeys: ["autonomyValidationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/autonomy-repair-valid.json"] },
  "validar-playtest-fuzz": { inputSchemaKeys: ["playtestFuzz"], outputSchemaKeys: ["playtestFuzzValidationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/playtest-fuzz-valid.json"] },
  "validar-multiplayer": { inputSchemaKeys: ["multiplayerAuthority"], outputSchemaKeys: ["multiplayerValidationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/multiplayer-authority-valid.json"] },
  "analisar-portabilidade": { inputSchemaKeys: ["portability"], outputSchemaKeys: ["portabilityAnalysisResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/portability-valid.json"] },
  "validar-workers": { inputSchemaKeys: ["distributedWorkers"], outputSchemaKeys: ["distributedWorkersValidationResult"], officialFixturePaths: ["exemplos/sistemas-interativos/advanced/distributed-workers-valid.json"] },
});

const OUTPUT_TARGETS_SCHEMA: Readonly<Record<SubcomandoExtensaoInterativa, Readonly<Record<string, readonly string[]>>>> = Object.freeze({
  "validar-ir": { experienceIrValidationResult: ["resultado"] },
  "indexar-ir": { experienceIrIndex: ["resultado", "indice"] },
  "consultar-ir": { experienceIrIndexEntry: ["resultado", "entry"] },
  "chunk-ir": { experienceIrChunk: ["resultado", "chunk"] },
  "descrever-ir": { experienceIrSerialization: ["resultado", "descriptor"] },
  "validar-engine-snapshot": { operationResult: ["resultado"] },
  "diff-engine-snapshots": { operationResult: ["resultado"], engineDiff: ["resultado", "value"] },
  "validar-asset-provenance": { operationResult: ["resultado"] },
  "validar-editor-state": { operationResult: ["resultado"] },
  "planejar-jobs": { operationResult: ["resultado"], jobOrchestrationPlan: ["resultado", "value"] },
  "validar-acceptance": { operationResult: ["resultado"] },
  "operar-acceptance": { operationResult: ["resultado"] },
  "validar-multimodal": { operationResult: ["resultado"] },
  "validar-temporal": { temporalValidationResult: ["resultado"] },
  "validar-evidencia-temporal": { temporalEvidenceValidationResult: ["resultado"] },
  "validar-autonomia": { autonomyValidationResult: ["resultado"] },
  "validar-playtest-fuzz": { playtestFuzzValidationResult: ["resultado"] },
  "validar-multiplayer": { multiplayerValidationResult: ["resultado"] },
  "analisar-portabilidade": { portabilityAnalysisResult: ["resultado"] },
  "validar-workers": { distributedWorkersValidationResult: ["resultado"] },
});

function shape(schemaVersion: string, requiredTopLevelFields: readonly string[], officialFixturePaths: readonly string[] = []) {
  return Object.freeze({ type: "object" as const, schemaVersion, requiredTopLevelFields, officialFixturePaths });
}

const DATA_SCHEMA_SHAPES = Object.freeze({
  experienceIr: shape(EXPERIENCE_IR_SCHEMA_VERSION, ["schemaVersion", "revision", "coordinateSystem", "serialization", "project", "worlds", "scenes", "entities", "components", "transforms", "cameras", "lights", "materials", "textures", "audio", "physics", "constraints", "animations", "vfx", "timelines", "inputs", "saves", "networks", "builds"], ["exemplos/sistemas-interativos/experience-ir-valid.json"]),
  experienceIrValidationResult: shape(EXPERIENCE_IR_VALIDATION_RESULT_SCHEMA_VERSION, ["sucesso", "valido", "documentDigest", "issues", "executed", "workspaceMutated", "authoritative"]),
  experienceIrIndex: shape(EXPERIENCE_IR_INDEX_SCHEMA_VERSION, ["schemaVersion", "documentDigest", "entries", "partitions", "authoritative"]),
  experienceIrIndexEntry: shape(EXPERIENCE_IR_INDEX_ENTRY_SCHEMA_VERSION, ["semanticId", "kind", "semanticRoles", "path", "contentDigest", "references"]),
  experienceIrChunk: shape(EXPERIENCE_IR_CHUNK_SCHEMA_VERSION, ["schemaVersion", "chunkDigest", "documentDigest", "requestedSemanticIdDigests", "entries", "externalReferences", "authoritative"]),
  experienceIrSerialization: shape(EXPERIENCE_IR_SERIALIZATION_SCHEMA_VERSION, ["schemaVersion", "json", "cbor", "semanticRoles"]),
  operationResult: shape(OPERATION_RESULT_SCHEMA_V1, ["schemaVersion", "valid", "issues", "value", "digest", "executed", "workspaceMutated", "engineProbed", "editorInspected", "processesInspected", "resourcesReserved", "authoritative"]),
  engineSnapshot: shape(ENGINE_SNAPSHOT_SCHEMA_V1, ["schemaVersion", "snapshotId", "projectId", "sceneId", "adapter", "semanticObjects", "artifactDigest", "readOnly", "authoritative"], ["exemplos/sistemas-interativos/advanced/engine-snapshot-before-valid.json"]),
  engineDiff: shape(ENGINE_DIFF_SCHEMA_V1, ["schemaVersion", "beforeSnapshotDigest", "afterSnapshotDigest", "bindingDigest", "artifactDigestChanged", "changes", "diffDigest", "readOnly", "authoritative"]),
  assetProvenance: shape(ASSET_PROVENANCE_SCHEMA_V1, ["schemaVersion", "assetId", "sourceUriRef", "sourceUriRedacted", "license", "sourceHash", "contentHash", "transforms", "derivatives", "authoritative"], ["exemplos/sistemas-interativos/advanced/asset-provenance-valid.json"]),
  editorState: shape(EDITOR_STATE_SCHEMA_V1, ["schemaVersion", "editorSessionId", "adapter", "scene", "selection", "mode", "unsavedChanges", "shaderJobs", "importJobs", "plugins", "modals", "processes", "observedAt", "readOnly", "authoritative"], ["exemplos/sistemas-interativos/advanced/editor-state-valid.json"]),
  jobOrchestration: shape(JOB_ORCHESTRATION_SCHEMA_V1, ["schemaVersion", "queueId", "capacity", "lockCapacity", "jobs"], ["exemplos/sistemas-interativos/advanced/job-orchestration-valid.json"]),
  jobOrchestrationPlan: shape(JOB_ORCHESTRATION_SCHEMA_V1, ["schemaVersion", "queueId", "queue", "requestDigest", "externalRunnerRequired", "resourcesReserved", "authoritative", "planDigest"]),
  acceptanceLock: shape(ACCEPTANCE_LOCK_SCHEMA_V1, ["schemaVersion", "lockId", "artifactDigest", "sceneId", "timeRange", "approver", "decision", "status", "createdAt", "authoritative"], ["exemplos/sistemas-interativos/advanced/acceptance-lock-valid.json"]),
  multimodalEvidence: shape(MULTIMODAL_EVIDENCE_SCHEMA_V1, ["schemaVersion", "evidenceId", "runId", "claimId", "definitionDigest", "planDigest", "contractDigest", "claimBindingDigest", "artifactDigest", "sceneId", "timeRange", "requiredModalities", "channels", "producer", "verifier", "decision", "observedAt", "authoritative"], ["exemplos/sistemas-interativos/advanced/multimodal-evidence-valid.json"]),
  temporalContract: shape(SCHEMA_CONTRATO_TEMPORAL, ["schemaVersion", "contractId", "systemId", "experienceIrDigest", "coordinateSystem", "phases", "tracks", "invariants", "shots", "physics", "temporalQa", "buildAcceptance", "hardwareTargets"], ["exemplos/sistemas-interativos/advanced/temporal-valid.json"]),
  temporalEvidence: shape(SCHEMA_EVIDENCIA_TEMPORAL, ["schemaVersion", "runId", "contractDigest", "producerId", "producerVersion", "producerConfigurationDigest", "verifierId", "verifierVersion", "verifierConfigurationDigest", "independentOfProducer", "observations"], ["exemplos/sistemas-interativos/advanced/temporal-evidence-valid.json"]),
  temporalValidationResult: shape(TEMPORAL_VALIDATION_RESULT_SCHEMA_VERSION, ["valido", "contractDigest", "requiredCheckIds", "bloqueios", "executed", "authoritative"]),
  temporalEvidenceValidationResult: shape(TEMPORAL_EVIDENCE_VALIDATION_RESULT_SCHEMA_VERSION, ["valido", "contractDigest", "bundleDigest", "checksAceitos", "checksAusentes", "checksFalhos", "diagnostics", "nextActions", "bloqueios", "completed", "localCoverageComplete", "awaitingExternalAttestation", "completionScope", "authoritative", "executed", "resultDigest"]),
  autonomy: shape(SCHEMA_AUTONOMIA, ["schemaVersion", "runId", "cycleIndex", "previousCycleDigest", "triggeredStopCriteria", "systemId", "definitionDigest", "policy", "diagnostics", "resourceLocks", "acceptanceLocks", "acceptanceLocksDigest", "acceptanceClaims", "proposals", "simulations", "proofs", "recoveryToken"], ["exemplos/sistemas-interativos/advanced/autonomy-repair-valid.json"]),
  autonomyValidationResult: shape(AUTONOMY_VALIDATION_RESULT_SCHEMA_VERSION, ["valido", "cycleDigest", "eligibleSafePatches", "blockedPatches", "diagnostics", "nextActions", "completed", "authoritative", "executed", "bloqueios"]),
  playtestFuzz: shape(SCHEMA_PLAYTEST_FUZZ, ["schemaVersion", "planId", "systemId", "definitionDigest", "inputActions", "bots", "stateCheckpoints", "saveLoadCases", "fuzzBounds", "stopCriteria", "evidenceRequirements"], ["exemplos/sistemas-interativos/advanced/playtest-fuzz-valid.json"]),
  playtestFuzzValidationResult: shape(PLAYTEST_FUZZ_VALIDATION_RESULT_SCHEMA_VERSION, ["valido", "planDigest", "scenarioIds", "nextActions", "authoritative", "executed", "bloqueios"]),
  multiplayerAuthority: shape(SCHEMA_AUTORIDADE_MULTIPLAYER, ["schemaVersion", "modelId", "systemId", "topology", "authorities", "replicatedState", "conflicts", "reconnect", "securityInvariants", "evidenceRequirements"], ["exemplos/sistemas-interativos/advanced/multiplayer-authority-valid.json"]),
  multiplayerValidationResult: shape(MULTIPLAYER_VALIDATION_RESULT_SCHEMA_VERSION, ["valido", "modelDigest", "authorityGaps", "nextActions", "authoritative", "executed", "bloqueios"]),
  portability: shape(SCHEMA_PORTABILIDADE, ["schemaVersion", "planId", "systemId", "experienceIrDigest", "source", "sourceManifest", "targets", "migrations", "acceptance"], ["exemplos/sistemas-interativos/advanced/portability-valid.json"]),
  portabilityAnalysisResult: shape(PORTABILITY_ANALYSIS_RESULT_SCHEMA_VERSION, ["valido", "planDigest", "targetReports", "declaredLosses", "migrationGaps", "nextActions", "converted", "authoritative", "executed", "bloqueios"]),
  distributedWorkers: shape(SCHEMA_WORKERS_DISTRIBUIDOS, ["schemaVersion", "planId", "systemId", "inputDigest", "workers", "jobs", "leases", "evidenceRequirements"], ["exemplos/sistemas-interativos/advanced/distributed-workers-valid.json"]),
  distributedWorkersValidationResult: shape(DISTRIBUTED_WORKERS_VALIDATION_RESULT_SCHEMA_VERSION, ["valido", "planDigest", "topologicalOrder", "assignments", "capabilityGaps", "lockConflicts", "nextActions", "completed", "authoritative", "executed", "bloqueios"]),
});

const COMANDOS_SCHEMA_ACIONAVEL = Object.freeze(Object.fromEntries(
  SUBCOMANDOS_EXTENSAO_INTERATIVA.map((comando) => [comando, {
    ...COMANDOS_SCHEMA[comando],
    ...VINCULOS_SCHEMA_COMANDO[comando],
    outputTargets: OUTPUT_TARGETS_SCHEMA[comando],
  }]),
));

export const SCHEMA_EXTENSOES_CLI_INTERATIVAS = Object.freeze({
  schemaVersion: INTERACTIVE_CLI_EXTENSION_SCHEMA_VERSION,
  readOnly: true,
  executed: false,
  workspaceMutated: false,
  authoritative: false,
  externalExecutionRequired: true,
  commands: COMANDOS_SCHEMA_ACIONAVEL,
  dataSchemas: Object.freeze({
    experienceIr: EXPERIENCE_IR_SCHEMA_VERSION,
    experienceIrValidationResult: EXPERIENCE_IR_VALIDATION_RESULT_SCHEMA_VERSION,
    experienceIrIndex: EXPERIENCE_IR_INDEX_SCHEMA_VERSION,
    experienceIrIndexEntry: EXPERIENCE_IR_INDEX_ENTRY_SCHEMA_VERSION,
    experienceIrChunk: EXPERIENCE_IR_CHUNK_SCHEMA_VERSION,
    experienceIrSerialization: EXPERIENCE_IR_SERIALIZATION_SCHEMA_VERSION,
    operationResult: OPERATION_RESULT_SCHEMA_V1,
    engineSnapshot: ENGINE_SNAPSHOT_SCHEMA_V1,
    engineDiff: ENGINE_DIFF_SCHEMA_V1,
    assetProvenance: ASSET_PROVENANCE_SCHEMA_V1,
    editorState: EDITOR_STATE_SCHEMA_V1,
    jobOrchestration: JOB_ORCHESTRATION_SCHEMA_V1,
    jobOrchestrationPlan: JOB_ORCHESTRATION_SCHEMA_V1,
    acceptanceLock: ACCEPTANCE_LOCK_SCHEMA_V1,
    multimodalEvidence: MULTIMODAL_EVIDENCE_SCHEMA_V1,
    temporalContract: SCHEMA_CONTRATO_TEMPORAL,
    temporalEvidence: SCHEMA_EVIDENCIA_TEMPORAL,
    temporalValidationResult: TEMPORAL_VALIDATION_RESULT_SCHEMA_VERSION,
    temporalEvidenceValidationResult: TEMPORAL_EVIDENCE_VALIDATION_RESULT_SCHEMA_VERSION,
    autonomy: SCHEMA_AUTONOMIA,
    autonomyValidationResult: AUTONOMY_VALIDATION_RESULT_SCHEMA_VERSION,
    playtestFuzz: SCHEMA_PLAYTEST_FUZZ,
    playtestFuzzValidationResult: PLAYTEST_FUZZ_VALIDATION_RESULT_SCHEMA_VERSION,
    multiplayerAuthority: SCHEMA_AUTORIDADE_MULTIPLAYER,
    multiplayerValidationResult: MULTIPLAYER_VALIDATION_RESULT_SCHEMA_VERSION,
    portability: SCHEMA_PORTABILIDADE,
    portabilityAnalysisResult: PORTABILITY_ANALYSIS_RESULT_SCHEMA_VERSION,
    distributedWorkers: SCHEMA_WORKERS_DISTRIBUIDOS,
    distributedWorkersValidationResult: DISTRIBUTED_WORKERS_VALIDATION_RESULT_SCHEMA_VERSION,
  }),
  dataSchemaShapes: DATA_SCHEMA_SHAPES,
});

const ESPECIFICACOES: Readonly<Record<SubcomandoExtensaoInterativa, Especificacao>> = Object.freeze({
  "validar-ir": { posicionais: 1 },
  "indexar-ir": { posicionais: 1 },
  "consultar-ir": { posicionais: 1, opcoes: { "--semantic-id": "semanticId" }, obrigatorias: ["semanticId"] },
  "chunk-ir": { posicionais: 1, opcoes: { "--semantic-id": "semanticId" }, flags: ["--raso"], obrigatorias: ["semanticId"] },
  "descrever-ir": { posicionais: 0 },
  "validar-engine-snapshot": { posicionais: 1 },
  "diff-engine-snapshots": { posicionais: 2 },
  "validar-asset-provenance": { posicionais: 1 },
  "validar-editor-state": { posicionais: 1 },
  "planejar-jobs": { posicionais: 1 },
  "validar-acceptance": { posicionais: 1 },
  "operar-acceptance": {
    posicionais: 1,
    opcoes: { "--operation": "operation", "--context-file": "contextFile" },
    obrigatorias: ["operation", "contextFile"],
  },
  "validar-multimodal": { posicionais: 1 },
  "validar-temporal": { posicionais: 1 },
  "validar-evidencia-temporal": {
    posicionais: 1,
    opcoes: { "--bundle-arquivo": "bundleFile", "--evidencias-arquivo": "bundleFile" },
    obrigatorias: ["bundleFile"],
  },
  "validar-autonomia": { posicionais: 1 },
  "validar-playtest-fuzz": { posicionais: 1 },
  "validar-multiplayer": { posicionais: 1 },
  "analisar-portabilidade": { posicionais: 1 },
  "validar-workers": { posicionais: 1 },
});

const SUBCOMANDOS = new Set<string>(SUBCOMANDOS_EXTENSAO_INTERATIVA);
const OPERACOES_ACCEPTANCE = new Set(["VALIDATE", "EVALUATE", "INVALIDATE"]);

function basePayload(comando: string, sucesso: boolean): Record<string, unknown> {
  return {
    sucesso,
    comando,
    readOnly: true,
    executed: false,
    workspaceMutated: false,
    authoritative: false,
    externalExecutionRequired: true,
  };
}

function resposta(comando: string, sucesso: boolean, valor: Record<string, unknown>): ResultadoExtensao {
  return {
    exitCode: sucesso ? 0 : 1,
    payload: { ...valor, ...basePayload(comando, sucesso) },
  };
}

function erro(comando: string, errorCode: string): ResultadoExtensao {
  return resposta(comando, false, { errorCode });
}

function parsear(args: readonly string[]): ArgumentosExtensao | ResultadoExtensao | null {
  const nome = args[0]?.toLowerCase().replace(/_/g, "-");
  if (!nome || !SUBCOMANDOS.has(nome)) return null;
  const subcomando = nome as SubcomandoExtensaoInterativa;
  const especificacao = ESPECIFICACOES[subcomando];
  const posicionais: string[] = [];
  const opcoes: Record<string, string> = {};
  const flags = new Set<string>();

  for (let indice = 1; indice < args.length; indice += 1) {
    const token = args[indice];
    if (!token.startsWith("--")) {
      posicionais.push(token);
      continue;
    }
    if (token === "--json") {
      if (flags.has(token)) return erro(subcomando, "INTERATIVO_ARGUMENTOS_INVALIDOS");
      flags.add(token);
      continue;
    }
    if (especificacao.flags?.includes(token)) {
      if (flags.has(token)) return erro(subcomando, "INTERATIVO_ARGUMENTOS_INVALIDOS");
      flags.add(token);
      continue;
    }
    const chave = especificacao.opcoes?.[token];
    if (!chave || opcoes[chave] !== undefined) return erro(subcomando, "INTERATIVO_ARGUMENTOS_INVALIDOS");
    const valor = args[indice + 1];
    if (valor === undefined || valor.startsWith("--")) return erro(subcomando, "INTERATIVO_ARGUMENTOS_INVALIDOS");
    opcoes[chave] = valor;
    indice += 1;
  }

  if (posicionais.length !== especificacao.posicionais
    || especificacao.obrigatorias?.some((chave) => opcoes[chave] === undefined)) {
    return erro(subcomando, "INTERATIVO_ARGUMENTOS_INVALIDOS");
  }
  if (subcomando === "operar-acceptance" && !OPERACOES_ACCEPTANCE.has(opcoes.operation)) {
    return erro(subcomando, "INTERATIVO_FILTRO_INVALIDO");
  }
  return { subcomando, posicionais, opcoes, flags };
}

async function lerJson(arquivo: string): Promise<unknown> {
  return JSON.parse(await readFile(arquivo, "utf8")) as unknown;
}

export async function executarExtensaoCliInterativa(args: readonly string[]): Promise<ResultadoExtensao | null> {
  const parse = parsear(args);
  if (parse === null || "exitCode" in parse) return parse;
  const { subcomando, posicionais, opcoes, flags } = parse;
  try {
    if (subcomando === "descrever-ir") {
      const resultado = descreverSerializacaoExperienceIr();
      return resposta(subcomando, resultado.sucesso, { resultado });
    }
    if (subcomando === "diff-engine-snapshots") {
      const [antes, depois] = await Promise.all([lerJson(posicionais[0]), lerJson(posicionais[1])]);
      const resultado = derivarDiffSnapshotsEngine(antes, depois);
      return resposta(subcomando, resultado.valid, { resultado });
    }
    if (subcomando === "operar-acceptance") {
      const [lock, contexto] = await Promise.all([lerJson(posicionais[0]), lerJson(opcoes.contextFile)]);
      const resultado = operarAcceptanceLock(opcoes.operation, lock, contexto);
      return resposta(subcomando, resultado.valid, { resultado });
    }
    if (subcomando === "validar-evidencia-temporal") {
      const [contrato, bundle] = await Promise.all([lerJson(posicionais[0]), lerJson(opcoes.bundleFile)]);
      const resultado = validarBundleVerificacaoTemporal(contrato, bundle);
      return resposta(subcomando, resultado.valido, { resultado });
    }

    const entrada = await lerJson(posicionais[0]);
    if (subcomando === "validar-ir") {
      const resultado = validarExperienceIr(entrada);
      return resposta(subcomando, resultado.valido, { resultado });
    }
    if (subcomando === "indexar-ir") {
      const resultado = indexarExperienceIr(entrada);
      return resposta(subcomando, resultado.sucesso, { resultado });
    }
    if (subcomando === "consultar-ir" || subcomando === "chunk-ir") {
      const indice = indexarExperienceIr(entrada);
      if (!indice.sucesso || indice.indice === null) return resposta(subcomando, false, { resultado: indice });
      if (subcomando === "consultar-ir") {
        const resultado = consultarIndiceExperienceIr(indice.indice, opcoes.semanticId);
        return resposta(subcomando, resultado.sucesso, { resultado });
      }
      const resultado = criarChunkExperienceIr(entrada, [opcoes.semanticId], !flags.has("--raso"));
      return resposta(subcomando, resultado.sucesso, { resultado });
    }
    if (subcomando === "validar-engine-snapshot") {
      const resultado = validarSnapshotEngine(entrada);
      return resposta(subcomando, resultado.valid, { resultado });
    }
    if (subcomando === "validar-asset-provenance") {
      const resultado = validarProvenienciaAsset(entrada);
      return resposta(subcomando, resultado.valid, { resultado });
    }
    if (subcomando === "validar-editor-state") {
      const resultado = validarEstadoEditor(entrada);
      return resposta(subcomando, resultado.valid, { resultado });
    }
    if (subcomando === "planejar-jobs") {
      const resultado = planejarOrquestracaoJobs(entrada);
      return resposta(subcomando, resultado.valid, { resultado });
    }
    if (subcomando === "validar-acceptance") {
      const resultado = validarAcceptanceLock(entrada);
      return resposta(subcomando, resultado.valid, { resultado });
    }
    if (subcomando === "validar-multimodal") {
      const resultado = validarEvidenciaMultimodal(entrada);
      return resposta(subcomando, resultado.valid, { resultado });
    }
    if (subcomando === "validar-temporal") {
      const resultado = validarContratoTemporalInterativo(entrada);
      return resposta(subcomando, resultado.valido, { resultado });
    }
    if (subcomando === "validar-autonomia") {
      const resultado = validarCicloReparoAutonomo(entrada);
      return resposta(subcomando, resultado.valido, { resultado });
    }
    if (subcomando === "validar-playtest-fuzz") {
      const resultado = validarPlanoPlaytestFuzz(entrada);
      return resposta(subcomando, resultado.valido, { resultado });
    }
    if (subcomando === "validar-multiplayer") {
      const resultado = validarModeloAutoridadeMultiplayer(entrada);
      return resposta(subcomando, resultado.valido, { resultado });
    }
    if (subcomando === "analisar-portabilidade") {
      const resultado = analisarPlanoPortabilidadeInterativa(entrada);
      return resposta(subcomando, resultado.valido, { resultado });
    }
    const resultado = validarPlanoWorkersDistribuidos(entrada);
    return resposta(subcomando, resultado.valido, { resultado });
  } catch {
    return erro(subcomando, "INTERATIVO_ENTRADA_INVALIDA");
  }
}
