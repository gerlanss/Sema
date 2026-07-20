// SEMA-GOVERNED: sema.produto.sistemas_interativos.operacao
// Descricao: validadores e planejadores operacionais puros; runners externos continuam donos de toda execucao.

import { createHash } from "node:crypto";
import {
  ACCEPTANCE_LOCK_SCHEMA_V1,
  ASSET_PROVENANCE_SCHEMA_V1,
  EDITOR_STATE_SCHEMA_V1,
  ENGINE_DIFF_SCHEMA_V1,
  ENGINE_SNAPSHOT_SCHEMA_V1,
  JOB_ORCHESTRATION_SCHEMA_V1,
  MULTIMODAL_EVIDENCE_SCHEMA_V1,
  OPERATION_RESULT_SCHEMA_V1,
  type AcceptanceInvalidationReason,
  type AcceptanceLockV1,
  type AcceptanceOperationValue,
  type AcceptanceTimeRange,
  type AssetProvenanceV1,
  type EditorStateV1,
  type EngineSnapshotChange,
  type EngineSnapshotDiffV1,
  type EngineSnapshotV1,
  type JobOrchestrationPlanV1,
  type JobOrchestrationRequestV1,
  type MultimodalChannelType,
  type MultimodalEvidenceDescriptorV1,
  type OpaqueSha256,
  type OperationIssue,
  type OperationResult,
  type ResourceLock,
  type Sha256,
  type ValidatedEngineSnapshot,
} from "./operationsTypes.js";
export * from "./operationsTypes.js";

const BASE_FLAGS = {
  executed: false,
  workspaceMutated: false,
  engineProbed: false,
  editorInspected: false,
  processesInspected: false,
  resourcesReserved: false,
  authoritative: false,
} as const;

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const OPAQUE_SHA256_PATTERN = /^opaque:sha256:[a-f0-9]{64}$/;
const SEMANTIC_ID_PATTERN = /^[a-z][a-z0-9_-]{0,31}(?:[.:/][a-z0-9][a-z0-9_-]{0,63})+$/;
const SAFE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._+-]{0,127}$/;
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/;
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,63}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const OPAQUE_SENSITIVE_KEYS = new Set(["recoverytoken", "sourceuriref"]);
const SENSITIVE_KEY_PARTS = [
  "password", "passwd", "secret", "token", "apikey", "privatekey",
  "clientsecret", "accesstoken", "refreshtoken", "credential",
  "authorization", "cookie", "connectionstring",
];
const SENSITIVE_VALUE_PATTERNS = [
  /\bbearer\s+[a-z0-9._~+\/-]{8,}/i,
  /^(?:sk[-_][a-z0-9_-]{8,}|ghp_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,})$/i,
  /^eyJ[a-z0-9_-]{8,}\.eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----/,
  /(?:^|[?&])(?:access_?token|api_?key|aws_?secret_?access_?key|secret|password|passwd|signature|sig|token|credential|authorization)=[^&#\s]+/i,
  /:\/\/[^/\s:@]+:[^/\s@]+@/,
];

function issue(code: string, field: string): OperationIssue {
  return { code, field };
}

function normalizedIssues(issues: readonly OperationIssue[]): OperationIssue[] {
  const unique = new Map<string, OperationIssue>();
  for (const item of issues) unique.set(item.code + "\u0000" + item.field, item);
  return [...unique.values()].sort((a, b) => (
    a.code.localeCompare(b.code) || a.field.localeCompare(b.field)
  ));
}

function failure<T>(issues: readonly OperationIssue[]): OperationResult<T> {
  return {
    schemaVersion: OPERATION_RESULT_SCHEMA_V1,
    valid: false,
    issues: normalizedIssues(issues),
    ...BASE_FLAGS,
  };
}

function success<T>(value: T, digest?: Sha256): OperationResult<T> {
  return {
    schemaVersion: OPERATION_RESULT_SCHEMA_V1,
    valid: true,
    issues: [],
    value,
    ...(digest === undefined ? {} : { digest }),
    ...BASE_FLAGS,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSha256(value: unknown): value is Sha256 {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isOpaqueSha256(value: unknown): value is OpaqueSha256 {
  return typeof value === "string" && OPAQUE_SHA256_PATTERN.test(value);
}

function isSemanticId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 192 && SEMANTIC_ID_PATTERN.test(value);
}

function isSafeName(value: unknown): value is string {
  return typeof value === "string" && SAFE_NAME_PATTERN.test(value);
}

function isVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION_PATTERN.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 40) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isIntegerIn(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowlist = new Set(allowed);
  return Object.keys(value).every((key) => allowlist.has(key));
}

function isSensitiveValue(value: string): boolean {
  if (isSha256(value) || isOpaqueSha256(value)) return false;
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function inspectPlainJson(input: unknown, rootField: string): OperationIssue[] {
  const issues: OperationIssue[] = [];
  const active = new Set<object>();
  let nodes = 0;
  const visit = (value: unknown, field: string, depth: number): void => {
    nodes += 1;
    if (nodes > 20_000) {
      issues.push(issue("json_node_limit_exceeded", rootField));
      return;
    }
    if (depth > 48) {
      issues.push(issue("json_depth_limit_exceeded", rootField));
      return;
    }
    if (typeof value === "string") {
      if (isSensitiveValue(value)) issues.push(issue("sensitive_material_forbidden", field));
      return;
    }
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) issues.push(issue("json_number_invalid", field));
      return;
    }
    if (typeof value !== "object") {
      issues.push(issue("json_type_unsupported", field));
      return;
    }
    if (active.has(value)) {
      issues.push(issue("json_cycle_detected", rootField));
      return;
    }
    active.add(value);
    if (Array.isArray(value)) {
      if (value.length > 10_000) issues.push(issue("json_array_limit_exceeded", field));
      for (const item of value) visit(item, field, depth + 1);
      active.delete(value);
      return;
    }
    if (!isRecord(value)) {
      issues.push(issue("json_object_not_plain", field));
      active.delete(value);
      return;
    }
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (DANGEROUS_KEYS.has(key)) issues.push(issue("json_dangerous_key", field));
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        issues.push(issue("json_accessor_forbidden", field));
        continue;
      }
      const keyNormalized = normalizedKey(key);
      const child = descriptor.value;
      const sensitive = SENSITIVE_KEY_PARTS.some((part) => keyNormalized.includes(part));
      const opaqueException = OPAQUE_SENSITIVE_KEYS.has(keyNormalized) && isOpaqueSha256(child);
      if (sensitive && !opaqueException) issues.push(issue("sensitive_material_forbidden", field));
      visit(child, field, depth + 1);
    }
    active.delete(value);
  };
  visit(input, rootField, 0);
  return normalizedIssues(issues);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (isRecord(value)) {
    return "{" + Object.keys(value).sort().map((key) => (
      JSON.stringify(key) + ":" + canonicalJson(value[key])
    )).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function digestJsonOperacional(value: unknown): Sha256 {
  return ("sha256:" + createHash("sha256").update(canonicalJson(value)).digest("hex")) as Sha256;
}

export function criarReferenciaFonteOpaca(sourceUri: unknown): OperationResult<{
  readonly sourceUriRef: OpaqueSha256;
  readonly sourceUriRedacted: true;
}> {
  if (typeof sourceUri !== "string" || sourceUri.length === 0 || sourceUri.length > 4096 || sourceUri.includes("\u0000")) {
    return failure([issue("source_uri_invalid", "sourceUri")]);
  }
  const sourceUriRef = ("opaque:sha256:" + createHash("sha256").update(sourceUri).digest("hex")) as OpaqueSha256;
  return success({ sourceUriRef, sourceUriRedacted: true }, digestJsonOperacional(sourceUriRef));
}

export function validarSnapshotEngine(input: unknown): OperationResult<ValidatedEngineSnapshot> {
  const issues = inspectPlainJson(input, "snapshot");
  if (!isRecord(input)) return failure([...issues, issue("snapshot_object_required", "snapshot")]);
  if (!hasOnlyKeys(input, [
    "schemaVersion", "snapshotId", "projectId", "sceneId", "adapter",
    "semanticObjects", "artifactDigest", "readOnly", "authoritative",
  ])) issues.push(issue("snapshot_unknown_field", "snapshot"));
  if (input.schemaVersion !== ENGINE_SNAPSHOT_SCHEMA_V1) issues.push(issue("snapshot_schema_invalid", "schemaVersion"));
  if (!isSemanticId(input.snapshotId)) issues.push(issue("snapshot_id_invalid", "snapshotId"));
  if (!isSemanticId(input.projectId)) issues.push(issue("project_id_invalid", "projectId"));
  if (!isSemanticId(input.sceneId)) issues.push(issue("scene_id_invalid", "sceneId"));
  if (!isSha256(input.artifactDigest)) issues.push(issue("artifact_digest_invalid", "artifactDigest"));
  if (input.readOnly !== true) issues.push(issue("snapshot_must_be_read_only", "readOnly"));
  if (input.authoritative !== false) issues.push(issue("snapshot_must_be_non_authoritative", "authoritative"));
  const adapter = input.adapter;
  if (!isRecord(adapter)
    || !hasOnlyKeys(adapter, ["adapterId", "adapterVersion"])
    || !isSafeName(adapter.adapterId)
    || !isVersion(adapter.adapterVersion)) issues.push(issue("snapshot_adapter_invalid", "adapter"));

  const objects = input.semanticObjects;
  const ids = new Set<string>();
  if (!Array.isArray(objects) || objects.length === 0) {
    issues.push(issue("snapshot_objects_required", "semanticObjects"));
  } else {
    for (const object of objects) {
      if (!isRecord(object) || !hasOnlyKeys(object, [
        "semanticId", "kind", "parentSemanticId", "stateDigest", "componentDigests",
      ])) {
        issues.push(issue("snapshot_object_invalid", "semanticObjects"));
        continue;
      }
      if (!isSemanticId(object.semanticId)) issues.push(issue("semantic_object_id_invalid", "semanticObjects"));
      else if (ids.has(object.semanticId)) issues.push(issue("semantic_object_id_duplicate", "semanticObjects"));
      else ids.add(object.semanticId);
      if (!isSafeName(object.kind)) issues.push(issue("semantic_object_kind_invalid", "semanticObjects"));
      if (object.parentSemanticId !== undefined && !isSemanticId(object.parentSemanticId)) {
        issues.push(issue("semantic_parent_id_invalid", "semanticObjects"));
      }
      if (!isSha256(object.stateDigest)) issues.push(issue("semantic_state_digest_invalid", "semanticObjects"));
      if (!isRecord(object.componentDigests)) {
        issues.push(issue("component_digests_invalid", "semanticObjects"));
      } else for (const [name, digest] of Object.entries(object.componentDigests)) {
        if (!isSafeName(name) || !isSha256(digest)) issues.push(issue("component_digest_invalid", "semanticObjects"));
      }
    }
    for (const object of objects) {
      if (isRecord(object) && typeof object.parentSemanticId === "string" && !ids.has(object.parentSemanticId)) {
        issues.push(issue("semantic_parent_missing", "semanticObjects"));
      }
    }
    const parentById = new Map<string, string>();
    for (const object of objects) {
      if (!isRecord(object) || !isSemanticId(object.semanticId) || !isSemanticId(object.parentSemanticId)) continue;
      if (object.parentSemanticId === object.semanticId) {
        issues.push(issue("semantic_parent_self_reference", "semanticObjects"));
      } else if (ids.has(object.parentSemanticId)) parentById.set(object.semanticId, object.parentSemanticId);
    }
    for (const start of parentById.keys()) {
      const path = new Set<string>();
      let cursor: string | undefined = start;
      while (cursor !== undefined && parentById.has(cursor)) {
        if (path.has(cursor)) {
          issues.push(issue("semantic_parent_cycle", "semanticObjects"));
          break;
        }
        path.add(cursor);
        cursor = parentById.get(cursor);
      }
      if (issues.some((item) => item.code === "semantic_parent_cycle")) break;
    }
  }
  if (issues.length > 0) return failure(issues);
  const snapshot = input as unknown as EngineSnapshotV1;
  const normalized: EngineSnapshotV1 = {
    ...snapshot,
    adapter: { ...snapshot.adapter },
    semanticObjects: snapshot.semanticObjects.map((object) => ({
      ...object,
      componentDigests: Object.fromEntries(
        Object.entries(object.componentDigests).sort(([left], [right]) => left.localeCompare(right)),
      ) as Record<string, Sha256>,
    })).sort((left, right) => left.semanticId.localeCompare(right.semanticId)),
  };
  const snapshotDigest = digestJsonOperacional(normalized);
  return success({ snapshot: normalized, snapshotDigest, localValidationOnly: true }, snapshotDigest);
}

export function derivarDiffSnapshotsEngine(beforeInput: unknown, afterInput: unknown): OperationResult<EngineSnapshotDiffV1> {
  const beforeResult = validarSnapshotEngine(beforeInput);
  const afterResult = validarSnapshotEngine(afterInput);
  const issues: OperationIssue[] = [];
  if (!beforeResult.valid) issues.push(issue("before_snapshot_invalid", "snapshotBefore"), ...beforeResult.issues);
  if (!afterResult.valid) issues.push(issue("after_snapshot_invalid", "snapshotAfter"), ...afterResult.issues);
  if (!beforeResult.value || !afterResult.value) return failure(issues);
  const before = beforeResult.value.snapshot;
  const after = afterResult.value.snapshot;
  if (before.projectId !== after.projectId) issues.push(issue("snapshot_project_binding_mismatch", "projectId"));
  if (before.sceneId !== after.sceneId) issues.push(issue("snapshot_scene_binding_mismatch", "sceneId"));
  if (before.adapter.adapterId !== after.adapter.adapterId
    || before.adapter.adapterVersion !== after.adapter.adapterVersion) {
    issues.push(issue("snapshot_adapter_binding_mismatch", "adapter"));
  }
  if (issues.length > 0) return failure(issues);
  const beforeById = new Map(before.semanticObjects.map((item) => [item.semanticId, item]));
  const afterById = new Map(after.semanticObjects.map((item) => [item.semanticId, item]));
  const allIds = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();
  const changes: EngineSnapshotChange[] = [];
  for (const semanticId of allIds) {
    const previous = beforeById.get(semanticId);
    const current = afterById.get(semanticId);
    if (!previous && current) {
      changes.push({ semanticId, change: "ADDED", afterDigest: digestJsonOperacional(current) });
    } else if (previous && !current) {
      changes.push({ semanticId, change: "REMOVED", beforeDigest: digestJsonOperacional(previous) });
    } else if (previous && current) {
      const beforeDigest = digestJsonOperacional(previous);
      const afterDigest = digestJsonOperacional(current);
      if (beforeDigest !== afterDigest) changes.push({ semanticId, change: "MODIFIED", beforeDigest, afterDigest });
    }
  }
  const withoutDigest = {
    schemaVersion: ENGINE_DIFF_SCHEMA_V1,
    beforeSnapshotDigest: beforeResult.value.snapshotDigest,
    afterSnapshotDigest: afterResult.value.snapshotDigest,
    bindingDigest: digestJsonOperacional({ projectId: before.projectId, sceneId: before.sceneId, adapter: before.adapter }),
    artifactDigestChanged: before.artifactDigest !== after.artifactDigest,
    changes,
    readOnly: true as const,
    authoritative: false as const,
  };
  const diff: EngineSnapshotDiffV1 = { ...withoutDigest, diffDigest: digestJsonOperacional(withoutDigest) };
  return success(diff, diff.diffDigest);
}

export function validarProvenienciaAsset(input: unknown): OperationResult<{
  readonly provenance: AssetProvenanceV1;
  readonly provenanceDigest: Sha256;
}> {
  const issues = inspectPlainJson(input, "provenance");
  if (!isRecord(input)) return failure([...issues, issue("provenance_object_required", "provenance")]);
  if (!hasOnlyKeys(input, [
    "schemaVersion", "assetId", "sourceUriRef", "sourceUriRedacted", "license",
    "sourceHash", "contentHash", "transforms", "derivatives", "authoritative",
  ])) issues.push(issue("provenance_unknown_field", "provenance"));
  if (input.schemaVersion !== ASSET_PROVENANCE_SCHEMA_V1) issues.push(issue("provenance_schema_invalid", "schemaVersion"));
  if (!isSemanticId(input.assetId)) issues.push(issue("asset_id_invalid", "assetId"));
  if (!isOpaqueSha256(input.sourceUriRef)) issues.push(issue("source_uri_ref_must_be_opaque", "sourceUriRef"));
  if (input.sourceUriRedacted !== true) issues.push(issue("source_uri_must_be_redacted", "sourceUriRedacted"));
  if (!isSha256(input.sourceHash)) issues.push(issue("source_hash_invalid", "sourceHash"));
  if (!isSha256(input.contentHash)) issues.push(issue("content_hash_invalid", "contentHash"));
  if (input.authoritative !== false) issues.push(issue("provenance_must_be_non_authoritative", "authoritative"));
  const license = input.license;
  if (!isRecord(license)
    || !hasOnlyKeys(license, ["licenseId", "evidenceDigest", "redistributable"])
    || !isSafeName(license.licenseId)
    || !isSha256(license.evidenceDigest)
    || typeof license.redistributable !== "boolean") issues.push(issue("asset_license_invalid", "license"));

  const transforms = input.transforms;
  const transformIds = new Set<string>();
  let previousDigest = input.sourceHash;
  if (!Array.isArray(transforms)) {
    issues.push(issue("asset_transforms_invalid", "transforms"));
  } else {
    for (const transform of transforms) {
      if (!isRecord(transform) || !hasOnlyKeys(transform, [
        "transformId", "toolRef", "toolVersion", "inputDigest", "outputDigest", "parametersDigest",
      ])) {
        issues.push(issue("asset_transform_invalid", "transforms"));
        continue;
      }
      if (!isSemanticId(transform.transformId)) issues.push(issue("transform_id_invalid", "transforms"));
      else if (transformIds.has(transform.transformId)) issues.push(issue("transform_id_duplicate", "transforms"));
      else transformIds.add(transform.transformId);
      if (!isSafeName(transform.toolRef) || !isVersion(transform.toolVersion)) issues.push(issue("transform_tool_invalid", "transforms"));
      if (!isSha256(transform.inputDigest) || !isSha256(transform.outputDigest) || !isSha256(transform.parametersDigest)) {
        issues.push(issue("transform_digest_invalid", "transforms"));
      }
      if (transform.inputDigest !== previousDigest) issues.push(issue("transform_chain_broken", "transforms"));
      previousDigest = transform.outputDigest;
    }
    if (previousDigest !== input.contentHash) issues.push(issue("transform_final_hash_mismatch", "contentHash"));
  }
  const derivatives = input.derivatives;
  const derivativeIds = new Set<string>();
  const derivativeHashes = new Set<string>();
  const parentByHash = new Map<string, string>();
  if (!Array.isArray(derivatives)) {
    issues.push(issue("asset_derivatives_invalid", "derivatives"));
  } else {
    for (const derivative of derivatives) {
      if (!isRecord(derivative) || !hasOnlyKeys(derivative, [
        "assetId", "parentContentHash", "contentHash", "transformDigest",
      ])) {
        issues.push(issue("asset_derivative_invalid", "derivatives"));
        continue;
      }
      if (!isSemanticId(derivative.assetId)) issues.push(issue("derivative_asset_id_invalid", "derivatives"));
      else if (derivativeIds.has(derivative.assetId)) issues.push(issue("derivative_asset_id_duplicate", "derivatives"));
      else derivativeIds.add(derivative.assetId);
      if (!isSha256(derivative.parentContentHash)
        || !isSha256(derivative.contentHash)
        || !isSha256(derivative.transformDigest)) {
        issues.push(issue("derivative_digest_invalid", "derivatives"));
        continue;
      }
      if (derivativeHashes.has(derivative.contentHash) || derivative.contentHash === input.contentHash) {
        issues.push(issue("derivative_content_hash_duplicate", "derivatives"));
      }
      derivativeHashes.add(derivative.contentHash);
      parentByHash.set(derivative.contentHash, derivative.parentContentHash);
    }
    const knownHashes = new Set([input.contentHash as string, ...derivativeHashes]);
    for (const [contentHash, parentHash] of parentByHash) {
      if (!knownHashes.has(parentHash)) issues.push(issue("derivative_parent_missing", "derivatives"));
      const visited = new Set<string>();
      let cursor: string | undefined = contentHash;
      while (cursor !== undefined && cursor !== input.contentHash) {
        if (visited.has(cursor)) {
          issues.push(issue("derivative_cycle_detected", "derivatives"));
          break;
        }
        visited.add(cursor);
        cursor = parentByHash.get(cursor);
        if (cursor === undefined) issues.push(issue("derivative_lineage_incomplete", "derivatives"));
      }
    }
  }
  if (issues.length > 0) return failure(issues);
  const provenance = input as unknown as AssetProvenanceV1;
  const normalized: AssetProvenanceV1 = {
    ...provenance,
    license: { ...provenance.license },
    transforms: provenance.transforms.map((item) => ({ ...item })),
    derivatives: provenance.derivatives.map((item) => ({ ...item }))
      .sort((left, right) => left.assetId.localeCompare(right.assetId)),
  };
  const provenanceDigest = digestJsonOperacional(normalized);
  return success({ provenance: normalized, provenanceDigest }, provenanceDigest);
}

const BACKGROUND_JOB_STATES = new Set(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]);
const EDITOR_MODES = new Set(["EDIT", "PLAY", "PAUSED"]);
const PROCESS_ROLES = new Set(["ENGINE", "EDITOR", "SHADER_COMPILER", "IMPORT_WORKER", "BUILD_WORKER"]);
const PROCESS_STATES = new Set(["IDLE", "RUNNING", "BLOCKED", "FAILED", "EXITED"]);

function validateBackgroundJobs(value: unknown, field: string, issues: OperationIssue[]): void {
  const ids = new Set<string>();
  if (!Array.isArray(value)) {
    issues.push(issue("editor_jobs_invalid", field));
    return;
  }
  for (const job of value) {
    if (!isRecord(job)
      || !hasOnlyKeys(job, ["jobId", "status", "progressBasisPoints"])
      || !isSemanticId(job.jobId)
      || typeof job.status !== "string"
      || !BACKGROUND_JOB_STATES.has(job.status)
      || !isIntegerIn(job.progressBasisPoints, 0, 10_000)) {
      issues.push(issue("editor_job_invalid", field));
      continue;
    }
    if (ids.has(job.jobId)) issues.push(issue("editor_job_id_duplicate", field));
    ids.add(job.jobId);
  }
}

export function validarEstadoEditor(input: unknown): OperationResult<{
  readonly state: EditorStateV1;
  readonly editorStateDigest: Sha256;
  readonly externallyObserved: false;
}> {
  const issues = inspectPlainJson(input, "editorState");
  if (!isRecord(input)) return failure([...issues, issue("editor_state_object_required", "editorState")]);
  if (!hasOnlyKeys(input, [
    "schemaVersion", "editorSessionId", "adapter", "scene", "selection", "mode",
    "unsavedChanges", "shaderJobs", "importJobs", "plugins", "modals", "processes",
    "observedAt", "readOnly", "authoritative",
  ])) issues.push(issue("editor_state_unknown_field", "editorState"));
  if (input.schemaVersion !== EDITOR_STATE_SCHEMA_V1) issues.push(issue("editor_state_schema_invalid", "schemaVersion"));
  if (!isSemanticId(input.editorSessionId)) issues.push(issue("editor_session_id_invalid", "editorSessionId"));
  if (typeof input.mode !== "string" || !EDITOR_MODES.has(input.mode)) issues.push(issue("editor_mode_invalid", "mode"));
  if (typeof input.unsavedChanges !== "boolean") issues.push(issue("unsaved_changes_invalid", "unsavedChanges"));
  if (!isIsoTimestamp(input.observedAt)) issues.push(issue("editor_observed_at_invalid", "observedAt"));
  if (input.readOnly !== true) issues.push(issue("editor_state_must_be_read_only", "readOnly"));
  if (input.authoritative !== false) issues.push(issue("editor_state_must_be_non_authoritative", "authoritative"));
  if (!isRecord(input.adapter)
    || !hasOnlyKeys(input.adapter, ["adapterId", "adapterVersion"])
    || !isSafeName(input.adapter.adapterId)
    || !isVersion(input.adapter.adapterVersion)) issues.push(issue("editor_adapter_invalid", "adapter"));
  if (!isRecord(input.scene)
    || !hasOnlyKeys(input.scene, ["semanticId", "artifactDigest"])
    || !isSemanticId(input.scene.semanticId)
    || !isSha256(input.scene.artifactDigest)) issues.push(issue("editor_scene_invalid", "scene"));

  const selectionIds = new Set<string>();
  if (!Array.isArray(input.selection)) issues.push(issue("editor_selection_invalid", "selection"));
  else for (const selected of input.selection) {
    if (!isSemanticId(selected)) issues.push(issue("editor_selection_id_invalid", "selection"));
    else if (selectionIds.has(selected)) issues.push(issue("editor_selection_duplicate", "selection"));
    else selectionIds.add(selected);
  }
  validateBackgroundJobs(input.shaderJobs, "shaderJobs", issues);
  validateBackgroundJobs(input.importJobs, "importJobs", issues);

  const pluginIds = new Set<string>();
  if (!Array.isArray(input.plugins)) issues.push(issue("editor_plugins_invalid", "plugins"));
  else for (const plugin of input.plugins) {
    if (!isRecord(plugin)
      || !hasOnlyKeys(plugin, ["pluginId", "version", "enabled", "provenanceDigest"])
      || !isSafeName(plugin.pluginId)
      || !isVersion(plugin.version)
      || typeof plugin.enabled !== "boolean"
      || !isSha256(plugin.provenanceDigest)) {
      issues.push(issue("editor_plugin_invalid", "plugins"));
      continue;
    }
    if (pluginIds.has(plugin.pluginId)) issues.push(issue("editor_plugin_id_duplicate", "plugins"));
    pluginIds.add(plugin.pluginId);
  }
  const modalIds = new Set<string>();
  if (!Array.isArray(input.modals)) issues.push(issue("editor_modals_invalid", "modals"));
  else for (const modal of input.modals) {
    if (!isRecord(modal)
      || !hasOnlyKeys(modal, ["modalId", "kind", "blocking"])
      || !isSemanticId(modal.modalId)
      || !isSafeName(modal.kind)
      || typeof modal.blocking !== "boolean") {
      issues.push(issue("editor_modal_invalid", "modals"));
      continue;
    }
    if (modalIds.has(modal.modalId)) issues.push(issue("editor_modal_id_duplicate", "modals"));
    modalIds.add(modal.modalId);
  }
  const processRefs = new Set<string>();
  if (!Array.isArray(input.processes)) issues.push(issue("editor_processes_invalid", "processes"));
  else for (const process of input.processes) {
    if (!isRecord(process)
      || !hasOnlyKeys(process, ["processRef", "role", "state"])
      || !isOpaqueSha256(process.processRef)
      || typeof process.role !== "string"
      || !PROCESS_ROLES.has(process.role)
      || typeof process.state !== "string"
      || !PROCESS_STATES.has(process.state)) {
      issues.push(issue("editor_process_invalid", "processes"));
      continue;
    }
    if (processRefs.has(process.processRef)) issues.push(issue("editor_process_ref_duplicate", "processes"));
    processRefs.add(process.processRef);
  }
  if (issues.length > 0) return failure(issues);
  const state = input as unknown as EditorStateV1;
  const normalized: EditorStateV1 = {
    ...state,
    adapter: { ...state.adapter },
    scene: { ...state.scene },
    selection: [...state.selection].sort(),
    shaderJobs: state.shaderJobs.map((item) => ({ ...item })).sort((a, b) => a.jobId.localeCompare(b.jobId)),
    importJobs: state.importJobs.map((item) => ({ ...item })).sort((a, b) => a.jobId.localeCompare(b.jobId)),
    plugins: state.plugins.map((item) => ({ ...item })).sort((a, b) => a.pluginId.localeCompare(b.pluginId)),
    modals: state.modals.map((item) => ({ ...item })).sort((a, b) => a.modalId.localeCompare(b.modalId)),
    processes: state.processes.map((item) => ({ ...item })).sort((a, b) => a.processRef.localeCompare(b.processRef)),
  };
  const editorStateDigest = digestJsonOperacional(normalized);
  return success({ state: normalized, editorStateDigest, externallyObserved: false }, editorStateDigest);
}

const RESOURCE_LOCKS: readonly ResourceLock[] = ["GPU", "EDITOR", "CACHE"];
function validateBudget(value: unknown, field: string, issues: OperationIssue[]): value is {
  ramMb: number; vramMb: number; diskMb: number;
} {
  if (!isRecord(value)
    || !hasOnlyKeys(value, ["ramMb", "vramMb", "diskMb"])
    || !isIntegerIn(value.ramMb, 1, 16_777_216)
    || !isIntegerIn(value.vramMb, 0, 16_777_216)
    || !isIntegerIn(value.diskMb, 1, 1_073_741_824)) {
    issues.push(issue("resource_budget_invalid", field));
    return false;
  }
  return true;
}

export function planejarOrquestracaoJobs(input: unknown): OperationResult<JobOrchestrationPlanV1> {
  const issues = inspectPlainJson(input, "jobRequest");
  if (!isRecord(input)) return failure([...issues, issue("job_request_object_required", "jobRequest")]);
  if (!hasOnlyKeys(input, ["schemaVersion", "queueId", "capacity", "lockCapacity", "jobs"])) {
    issues.push(issue("job_request_unknown_field", "jobRequest"));
  }
  if (input.schemaVersion !== JOB_ORCHESTRATION_SCHEMA_V1) issues.push(issue("job_schema_invalid", "schemaVersion"));
  if (!isSemanticId(input.queueId)) issues.push(issue("queue_id_invalid", "queueId"));
  const capacity = input.capacity;
  const capacityValid = validateBudget(capacity, "capacity", issues);
  const lockCapacity = input.lockCapacity;
  if (!isRecord(lockCapacity)
    || !hasOnlyKeys(lockCapacity, RESOURCE_LOCKS)
    || !RESOURCE_LOCKS.every((lock) => isIntegerIn(lockCapacity[lock], 0, 1))) {
    issues.push(issue("lock_capacity_invalid", "lockCapacity"));
  }

  const jobs = input.jobs;
  const ids = new Set<string>();
  if (!Array.isArray(jobs) || jobs.length === 0) {
    issues.push(issue("jobs_required", "jobs"));
  } else {
    for (const job of jobs) {
      if (!isRecord(job) || !hasOnlyKeys(job, [
        "jobId", "kind", "priority", "dependencies", "locks", "budget",
        "heartbeat", "checkpoint", "adapter",
      ])) {
        issues.push(issue("job_invalid", "jobs"));
        continue;
      }
      if (!isSemanticId(job.jobId)) issues.push(issue("job_id_invalid", "jobs"));
      else if (ids.has(job.jobId)) issues.push(issue("job_id_duplicate", "jobs"));
      else ids.add(job.jobId);
      if (!isSafeName(job.kind)) issues.push(issue("job_kind_invalid", "jobs"));
      if (!isIntegerIn(job.priority, 0, 100)) issues.push(issue("job_priority_invalid", "jobs"));
      if (!Array.isArray(job.dependencies)
        || job.dependencies.some((dependency) => !isSemanticId(dependency))
        || new Set(job.dependencies).size !== job.dependencies.length
        || job.dependencies.includes(job.jobId)) issues.push(issue("job_dependencies_invalid", "jobs"));
      if (!Array.isArray(job.locks)
        || job.locks.some((lock) => typeof lock !== "string" || !RESOURCE_LOCKS.includes(lock as ResourceLock))
        || new Set(job.locks).size !== job.locks.length) issues.push(issue("job_locks_invalid", "jobs"));
      const budget = job.budget;
      const budgetValid = validateBudget(budget, "jobs", issues);
      if (budgetValid && capacityValid
        && (budget.ramMb > capacity.ramMb
          || budget.vramMb > capacity.vramMb
          || budget.diskMb > capacity.diskMb)) issues.push(issue("job_budget_exceeds_capacity", "jobs"));
      if (Array.isArray(job.locks) && isRecord(lockCapacity)) {
        for (const lock of job.locks) {
          if (typeof lock === "string"
            && RESOURCE_LOCKS.includes(lock as ResourceLock)
            && lockCapacity[lock] !== 1) issues.push(issue("job_lock_unavailable", "jobs"));
        }
        if (job.locks.includes("GPU") && isRecord(job.budget) && job.budget.vramMb === 0) {
          issues.push(issue("gpu_job_requires_vram", "jobs"));
        }
      }
      if (!isRecord(job.heartbeat)
        || !hasOnlyKeys(job.heartbeat, ["intervalMs", "timeoutMs"])
        || !isIntegerIn(job.heartbeat.intervalMs, 100, 86_400_000)
        || !isIntegerIn(job.heartbeat.timeoutMs, 100, 86_400_000)
        || (typeof job.heartbeat.intervalMs === "number"
          && typeof job.heartbeat.timeoutMs === "number"
          && job.heartbeat.timeoutMs < job.heartbeat.intervalMs * 2)) issues.push(issue("job_heartbeat_invalid", "jobs"));
      if (!isRecord(job.checkpoint)
        || !hasOnlyKeys(job.checkpoint, ["intervalMs", "resume", "checkpointDigest", "recoveryToken"])
        || !isIntegerIn(job.checkpoint.intervalMs, 100, 86_400_000)
        || typeof job.checkpoint.resume !== "boolean"
        || !isOpaqueSha256(job.checkpoint.recoveryToken)
        || (job.checkpoint.checkpointDigest !== undefined && !isSha256(job.checkpoint.checkpointDigest))
        || (job.checkpoint.resume === true && !isSha256(job.checkpoint.checkpointDigest))) {
        issues.push(issue("job_checkpoint_invalid", "jobs"));
      }
      if (!isRecord(job.adapter)
        || !hasOnlyKeys(job.adapter, ["adapterId", "adapterVersion"])
        || !isSafeName(job.adapter.adapterId)
        || !isVersion(job.adapter.adapterVersion)) issues.push(issue("job_adapter_invalid", "jobs"));
    }
    for (const job of jobs) {
      if (!isRecord(job) || !Array.isArray(job.dependencies)) continue;
      for (const dependency of job.dependencies) {
        if (typeof dependency === "string" && !ids.has(dependency)) issues.push(issue("job_dependency_missing", "jobs"));
      }
    }
  }
  if (issues.length > 0) return failure(issues);
  const request = input as unknown as JobOrchestrationRequestV1;
  const byId = new Map(request.jobs.map((job) => [job.jobId, job]));
  const indegree = new Map(request.jobs.map((job) => [job.jobId, job.dependencies.length]));
  const dependents = new Map<string, string[]>();
  for (const job of request.jobs) for (const dependency of job.dependencies) {
    const list = dependents.get(dependency) ?? [];
    list.push(job.jobId);
    dependents.set(dependency, list);
  }
  const compareJobs = (leftId: string, rightId: string): number => {
    const left = byId.get(leftId)!;
    const right = byId.get(rightId)!;
    return right.priority - left.priority || left.jobId.localeCompare(right.jobId);
  };
  const ready = request.jobs.filter((job) => job.dependencies.length === 0)
    .map((job) => job.jobId).sort(compareJobs);
  const ordered: JobOrchestrationRequestV1["jobs"][number][] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    ordered.push(byId.get(id)!);
    for (const dependent of (dependents.get(id) ?? []).sort()) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        ready.push(dependent);
        ready.sort(compareJobs);
      }
    }
  }
  if (ordered.length !== request.jobs.length) return failure([issue("job_dependency_cycle", "jobs")]);
  const normalizedRequest = {
    schemaVersion: request.schemaVersion,
    queueId: request.queueId,
    capacity: { ...request.capacity },
    lockCapacity: Object.fromEntries(RESOURCE_LOCKS.map((lock) => [lock, request.lockCapacity[lock]])),
    jobs: request.jobs.map((job) => ({
      jobId: job.jobId,
      kind: job.kind,
      priority: job.priority,
      dependencies: [...job.dependencies].sort(),
      locks: [...job.locks].sort((a, b) => RESOURCE_LOCKS.indexOf(a) - RESOURCE_LOCKS.indexOf(b)),
      budget: { ...job.budget },
      heartbeat: { ...job.heartbeat },
      checkpoint: {
        intervalMs: job.checkpoint.intervalMs,
        resume: job.checkpoint.resume,
        ...(job.checkpoint.checkpointDigest === undefined ? {} : { checkpointDigest: job.checkpoint.checkpointDigest }),
        recoveryToken: job.checkpoint.recoveryToken,
      },
      adapter: { ...job.adapter },
    })).sort((left, right) => left.jobId.localeCompare(right.jobId)),
  };
  const requestDigest = digestJsonOperacional(normalizedRequest);
  const queue = ordered.map((job, index) => ({
    position: index + 1,
    jobId: job.jobId,
    kind: job.kind,
    priority: job.priority,
    adapter: { ...job.adapter },
    dependencies: [...job.dependencies].sort(),
    locks: [...job.locks].sort((a, b) => RESOURCE_LOCKS.indexOf(a) - RESOURCE_LOCKS.indexOf(b)),
    budget: { ...job.budget },
    heartbeatIntervalMs: job.heartbeat.intervalMs,
    heartbeatTimeoutMs: job.heartbeat.timeoutMs,
    checkpointIntervalMs: job.checkpoint.intervalMs,
    resume: job.checkpoint.resume,
    ...(job.checkpoint.checkpointDigest === undefined ? {} : { checkpointDigest: job.checkpoint.checkpointDigest }),
    recoveryToken: job.checkpoint.recoveryToken,
  }));
  const withoutDigest = {
    schemaVersion: JOB_ORCHESTRATION_SCHEMA_V1,
    queueId: request.queueId,
    queue,
    requestDigest,
    externalRunnerRequired: true as const,
    resourcesReserved: false as const,
    authoritative: false as const,
  };
  const plan: JobOrchestrationPlanV1 = { ...withoutDigest, planDigest: digestJsonOperacional(withoutDigest) };
  return success(plan, plan.planDigest);
}

const ACCEPTANCE_REASONS = new Set<AcceptanceInvalidationReason>([
  "ARTIFACT_CHANGED", "SCENE_CHANGED", "TIME_RANGE_CHANGED", "APPROVER_REVOKED", "MANUAL_WITHDRAWAL",
]);

function validateTimeRange(input: unknown, field: string, issues: OperationIssue[]): input is AcceptanceTimeRange {
  if (!isRecord(input)
    || !hasOnlyKeys(input, ["start", "end", "unit"])
    || typeof input.start !== "number"
    || !Number.isFinite(input.start)
    || input.start < 0
    || typeof input.end !== "number"
    || !Number.isFinite(input.end)
    || input.end <= input.start
    || (input.unit !== "FRAME" && input.unit !== "TICK" && input.unit !== "SECOND")) {
    issues.push(issue("time_range_invalid", field));
    return false;
  }
  return true;
}

export function validarAcceptanceLock(input: unknown): OperationResult<{
  readonly lock: AcceptanceLockV1;
  readonly lockDigest: Sha256;
}> {
  const issues = inspectPlainJson(input, "acceptanceLock");
  if (!isRecord(input)) return failure([...issues, issue("acceptance_lock_object_required", "acceptanceLock")]);
  if (!hasOnlyKeys(input, [
    "schemaVersion", "lockId", "artifactDigest", "sceneId", "timeRange", "approver",
    "decision", "status", "createdAt", "invalidation", "authoritative",
  ])) issues.push(issue("acceptance_lock_unknown_field", "acceptanceLock"));
  if (input.schemaVersion !== ACCEPTANCE_LOCK_SCHEMA_V1) issues.push(issue("acceptance_lock_schema_invalid", "schemaVersion"));
  if (!isSemanticId(input.lockId)) issues.push(issue("acceptance_lock_id_invalid", "lockId"));
  if (!isSha256(input.artifactDigest)) issues.push(issue("acceptance_artifact_digest_invalid", "artifactDigest"));
  if (!isSemanticId(input.sceneId)) issues.push(issue("acceptance_scene_id_invalid", "sceneId"));
  validateTimeRange(input.timeRange, "timeRange", issues);
  if (!isRecord(input.approver)
    || !hasOnlyKeys(input.approver, ["approverIdDigest", "role", "method"])
    || !isSha256(input.approver.approverIdDigest)
    || !isSafeName(input.approver.role)
    || (input.approver.method !== "HUMAN" && input.approver.method !== "POLICY")) {
    issues.push(issue("acceptance_approver_invalid", "approver"));
  }
  if (input.decision !== "ACCEPTED") issues.push(issue("acceptance_decision_invalid", "decision"));
  if (input.status !== "ACTIVE" && input.status !== "INVALIDATED") issues.push(issue("acceptance_status_invalid", "status"));
  if (!isIsoTimestamp(input.createdAt)) issues.push(issue("acceptance_created_at_invalid", "createdAt"));
  if (input.authoritative !== false) issues.push(issue("acceptance_lock_must_be_non_authoritative", "authoritative"));
  if (input.status === "ACTIVE" && input.invalidation !== undefined) {
    issues.push(issue("active_lock_cannot_have_invalidation", "invalidation"));
  }
  if (input.status === "INVALIDATED") {
    const invalidation = input.invalidation;
    if (!isRecord(invalidation)
      || !hasOnlyKeys(invalidation, ["previousLockDigest", "invalidatedByDigest", "reasonCode", "invalidatedAt"])
      || !isSha256(invalidation.previousLockDigest)
      || !isSha256(invalidation.invalidatedByDigest)
      || typeof invalidation.reasonCode !== "string"
      || !ACCEPTANCE_REASONS.has(invalidation.reasonCode as AcceptanceInvalidationReason)
      || !isIsoTimestamp(invalidation.invalidatedAt)) {
      issues.push(issue("acceptance_invalidation_invalid", "invalidation"));
    }
  }
  if (issues.length > 0) return failure(issues);
  const lock = input as unknown as AcceptanceLockV1;
  const normalized: AcceptanceLockV1 = {
    ...lock,
    timeRange: { ...lock.timeRange },
    approver: { ...lock.approver },
    ...(lock.invalidation === undefined ? {} : { invalidation: { ...lock.invalidation } }),
  };
  const lockDigest = digestJsonOperacional(normalized);
  return success({ lock: normalized, lockDigest }, lockDigest);
}

export function operarAcceptanceLock(
  operation: unknown,
  lockInput: unknown,
  contextInput: unknown,
): OperationResult<AcceptanceOperationValue> {
  if (operation !== "VALIDATE" && operation !== "EVALUATE" && operation !== "INVALIDATE") {
    return failure([issue("acceptance_operation_invalid", "operation")]);
  }
  const lockResult = validarAcceptanceLock(lockInput);
  if (!lockResult.value) return failure(lockResult.issues);
  const contextIssues = inspectPlainJson(contextInput, "context");
  if (!isRecord(contextInput)) return failure([...contextIssues, issue("acceptance_context_object_required", "context")]);
  const lock = lockResult.value.lock;
  const active = lock.status === "ACTIVE";

  if (operation === "VALIDATE") {
    if (!hasOnlyKeys(contextInput, [])) contextIssues.push(issue("acceptance_validate_context_must_be_empty", "context"));
    if (contextIssues.length > 0) return failure(contextIssues);
    return success({
      operation,
      accepted: active,
      bindingMatches: active,
      invalidated: !active,
      blockers: active ? [] : ["acceptance_lock_invalidated"],
      lock,
      lockDigest: lockResult.value.lockDigest,
    }, lockResult.value.lockDigest);
  }

  if (operation === "EVALUATE") {
    if (!hasOnlyKeys(contextInput, ["artifactDigest", "sceneId", "timeRange"])) {
      contextIssues.push(issue("acceptance_evaluate_unknown_field", "context"));
    }
    if (!isSha256(contextInput.artifactDigest)) contextIssues.push(issue("acceptance_context_artifact_invalid", "context"));
    if (!isSemanticId(contextInput.sceneId)) contextIssues.push(issue("acceptance_context_scene_invalid", "context"));
    validateTimeRange(contextInput.timeRange, "context", contextIssues);
    if (contextIssues.length > 0) return failure(contextIssues);
    const bindingMatches = lock.artifactDigest === contextInput.artifactDigest
      && lock.sceneId === contextInput.sceneId
      && canonicalJson(lock.timeRange) === canonicalJson(contextInput.timeRange);
    const blockers = [
      ...(active ? [] : ["acceptance_lock_invalidated"]),
      ...(bindingMatches ? [] : ["acceptance_binding_mismatch"]),
    ];
    return success({
      operation,
      accepted: active && bindingMatches,
      bindingMatches,
      invalidated: !active,
      blockers,
      lock,
      lockDigest: lockResult.value.lockDigest,
    }, lockResult.value.lockDigest);
  }

  if (!hasOnlyKeys(contextInput, ["lockDigest", "invalidatedByDigest", "reasonCode", "invalidatedAt"])) {
    contextIssues.push(issue("acceptance_invalidate_unknown_field", "context"));
  }
  if (!isSha256(contextInput.lockDigest) || contextInput.lockDigest !== lockResult.value.lockDigest) {
    contextIssues.push(issue("acceptance_lock_digest_mismatch", "context"));
  }
  if (!isSha256(contextInput.invalidatedByDigest)) contextIssues.push(issue("acceptance_invalidator_invalid", "context"));
  if (typeof contextInput.reasonCode !== "string"
    || !ACCEPTANCE_REASONS.has(contextInput.reasonCode as AcceptanceInvalidationReason)) {
    contextIssues.push(issue("acceptance_invalidation_reason_invalid", "context"));
  }
  if (!isIsoTimestamp(contextInput.invalidatedAt)) contextIssues.push(issue("acceptance_invalidated_at_invalid", "context"));
  if (!active) contextIssues.push(issue("acceptance_lock_already_invalidated", "acceptanceLock"));
  if (contextIssues.length > 0) return failure(contextIssues);
  const invalidatedLock: AcceptanceLockV1 = {
    ...lock,
    status: "INVALIDATED",
    invalidation: {
      previousLockDigest: lockResult.value.lockDigest,
      invalidatedByDigest: contextInput.invalidatedByDigest as Sha256,
      reasonCode: contextInput.reasonCode as AcceptanceInvalidationReason,
      invalidatedAt: contextInput.invalidatedAt as string,
    },
  };
  const lockDigest = digestJsonOperacional(invalidatedLock);
  return success({
    operation,
    accepted: false,
    bindingMatches: true,
    invalidated: true,
    blockers: ["acceptance_lock_invalidated"],
    lock: invalidatedLock,
    lockDigest,
  }, lockDigest);
}

const MULTIMODAL_CHANNEL_TYPES = new Set<MultimodalChannelType>([
  "SCREENSHOT", "VIDEO", "DEPTH", "NORMALS", "OBJECT_ID",
  "MOTION", "TRANSFORMS", "EVENTS", "AUDIO", "TELEMETRY",
]);

export function digestVinculoClaimMultimodal(input: {
  readonly claimId: string; readonly runId: string;
  readonly definitionDigest: Sha256; readonly planDigest: Sha256; readonly contractDigest: Sha256;
  readonly artifactDigest: Sha256; readonly sceneId: string; readonly timeRange: AcceptanceTimeRange;
  readonly requiredModalities: readonly MultimodalChannelType[];
}): Sha256 {
  return digestJsonOperacional({ ...input, requiredModalities: [...input.requiredModalities].sort() });
}

export function validarEvidenciaMultimodal(input: unknown): OperationResult<{
  readonly descriptor: MultimodalEvidenceDescriptorV1;
  readonly descriptorDigest: Sha256;
  readonly localDescriptorOnly: true;
}> {
  const issues = inspectPlainJson(input, "evidence");
  if (!isRecord(input)) return failure([...issues, issue("evidence_object_required", "evidence")]);
  if (!hasOnlyKeys(input, [
    "schemaVersion", "evidenceId", "runId", "claimId", "definitionDigest", "planDigest", "contractDigest",
    "claimBindingDigest", "artifactDigest", "sceneId", "timeRange", "requiredModalities", "channels",
    "producer", "verifier", "decision", "observedAt", "authoritative",
  ])) issues.push(issue("evidence_unknown_field", "evidence"));
  if (input.schemaVersion !== MULTIMODAL_EVIDENCE_SCHEMA_V1) issues.push(issue("evidence_schema_invalid", "schemaVersion"));
  if (!isSemanticId(input.evidenceId)) issues.push(issue("evidence_id_invalid", "evidenceId"));
  if (!isSemanticId(input.runId)) issues.push(issue("evidence_run_id_invalid", "runId"));
  if (!isSemanticId(input.claimId)) issues.push(issue("evidence_claim_id_invalid", "claimId"));
  if (!isSha256(input.definitionDigest)) issues.push(issue("evidence_definition_digest_invalid", "definitionDigest"));
  if (!isSha256(input.planDigest)) issues.push(issue("evidence_plan_digest_invalid", "planDigest"));
  if (!isSha256(input.contractDigest)) issues.push(issue("evidence_contract_digest_invalid", "contractDigest"));
  if (!isSha256(input.artifactDigest)) issues.push(issue("evidence_artifact_digest_invalid", "artifactDigest"));
  if (!isSemanticId(input.sceneId)) issues.push(issue("evidence_scene_id_invalid", "sceneId"));
  const timeRange = input.timeRange;
  const timeRangeValid = validateTimeRange(timeRange, "timeRange", issues);
  const requiredModalitiesInput = input.requiredModalities;
  const requiredModalitiesValid = Array.isArray(requiredModalitiesInput)
    && requiredModalitiesInput.length > 0
    && requiredModalitiesInput.every((type) => typeof type === "string"
      && MULTIMODAL_CHANNEL_TYPES.has(type as MultimodalChannelType))
    && new Set(requiredModalitiesInput).size === requiredModalitiesInput.length;
  const requiredModalities = requiredModalitiesValid
    ? requiredModalitiesInput as readonly MultimodalChannelType[]
    : [];
  if (!requiredModalitiesValid) issues.push(issue("evidence_required_modalities_invalid", "requiredModalities"));
  if (!isSha256(input.claimBindingDigest)
    || !isSemanticId(input.claimId)
    || !isSemanticId(input.runId)
    || !isSha256(input.definitionDigest)
    || !isSha256(input.planDigest)
    || !isSha256(input.contractDigest)
    || !isSha256(input.artifactDigest)
    || !isSemanticId(input.sceneId)
    || !timeRangeValid
    || input.claimBindingDigest !== digestVinculoClaimMultimodal({
      claimId: input.claimId,
      runId: input.runId,
      definitionDigest: input.definitionDigest,
      planDigest: input.planDigest,
      contractDigest: input.contractDigest,
      artifactDigest: input.artifactDigest,
      sceneId: input.sceneId,
      timeRange,
      requiredModalities,
    })) issues.push(issue("evidence_claim_binding_invalid", "claimBindingDigest"));
  if (!isIsoTimestamp(input.observedAt)) issues.push(issue("evidence_observed_at_invalid", "observedAt"));
  if (input.authoritative !== false) issues.push(issue("evidence_must_be_non_authoritative", "authoritative"));

  const channelIds = new Set<string>();
  const channelTypes = new Set<string>();
  if (!Array.isArray(input.channels) || input.channels.length === 0) {
    issues.push(issue("evidence_channels_required", "channels"));
  } else for (const channel of input.channels) {
    if (!isRecord(channel)
      || !hasOnlyKeys(channel, [
        "channelId", "type", "artifactDigest", "mediaType", "metadataDigest", "sampleCount",
      ])
      || !isSemanticId(channel.channelId)
      || typeof channel.type !== "string"
      || !MULTIMODAL_CHANNEL_TYPES.has(channel.type as MultimodalChannelType)
      || !isSha256(channel.artifactDigest)
      || typeof channel.mediaType !== "string"
      || !MEDIA_TYPE_PATTERN.test(channel.mediaType)
      || !isSha256(channel.metadataDigest)
      || !isIntegerIn(channel.sampleCount, 1, 1_000_000_000)) {
      issues.push(issue("evidence_channel_invalid", "channels"));
      continue;
    }
    if (channelIds.has(channel.channelId)) issues.push(issue("evidence_channel_id_duplicate", "channels"));
    if (channelTypes.has(channel.type)) issues.push(issue("evidence_channel_type_duplicate", "channels"));
    channelIds.add(channel.channelId);
    channelTypes.add(channel.type);
  }
  const producer = input.producer;
  if (!isRecord(producer)
    || !hasOnlyKeys(producer, ["producerIdDigest", "producerType", "version", "configurationDigest"])
    || !isSha256(producer.producerIdDigest)
    || (producer.producerType !== "ENGINE"
      && producer.producerType !== "EDITOR"
      && producer.producerType !== "RUNNER"
      && producer.producerType !== "MODEL"
      && producer.producerType !== "HUMAN"
      && producer.producerType !== "SENSOR")
    || !isVersion(producer.version)
    || !isSha256(producer.configurationDigest)) issues.push(issue("evidence_producer_invalid", "producer"));
  const verifier = input.verifier;
  if (!isRecord(verifier)
    || !hasOnlyKeys(verifier, [
      "verifierIdDigest", "verifierType", "version", "independent", "configurationDigest",
    ])
    || !isSha256(verifier.verifierIdDigest)
    || (verifier.verifierType !== "RULE"
      && verifier.verifierType !== "MODEL"
      && verifier.verifierType !== "HUMAN"
      && verifier.verifierType !== "SENSOR")
    || !isVersion(verifier.version)
    || verifier.independent !== true
    || !isSha256(verifier.configurationDigest)) issues.push(issue("evidence_verifier_invalid", "verifier"));
  if (isRecord(producer) && isRecord(verifier)
    && isSha256(producer.producerIdDigest) && isSha256(verifier.verifierIdDigest)
    && producer.producerIdDigest === verifier.verifierIdDigest) {
    issues.push(issue("evidence_verifier_not_independent", "verifier"));
  }
  const decision = input.decision;
  if (!isRecord(decision)
    || !hasOnlyKeys(decision, ["verdict", "reasonCodes", "confidenceBasisPoints"])
    || (decision.verdict !== "PASS" && decision.verdict !== "FAIL" && decision.verdict !== "INCONCLUSIVE")
    || !Array.isArray(decision.reasonCodes)
    || decision.reasonCodes.length === 0
    || decision.reasonCodes.some((code) => !isSafeName(code))
    || new Set(decision.reasonCodes).size !== decision.reasonCodes.length
    || !isIntegerIn(decision.confidenceBasisPoints, 0, 10_000)) issues.push(issue("evidence_decision_invalid", "decision"));
  if (isRecord(decision) && decision.verdict === "PASS") {
    if (!requiredModalitiesValid || requiredModalities.length < 2) {
      issues.push(issue("evidence_pass_requires_multiple_modalities", "requiredModalities"));
    } else if (!requiredModalities.every((type) => channelTypes.has(type))) {
      issues.push(issue("evidence_pass_missing_required_modality", "channels"));
    }
  }
  if (issues.length > 0) return failure(issues);
  const descriptor = input as unknown as MultimodalEvidenceDescriptorV1;
  const normalized: MultimodalEvidenceDescriptorV1 = {
    ...descriptor,
    timeRange: { ...descriptor.timeRange },
    requiredModalities: [...descriptor.requiredModalities].sort(),
    channels: descriptor.channels.map((channel) => ({ ...channel }))
      .sort((left, right) => left.type.localeCompare(right.type) || left.channelId.localeCompare(right.channelId)),
    producer: { ...descriptor.producer },
    verifier: { ...descriptor.verifier },
    decision: { ...descriptor.decision, reasonCodes: [...descriptor.decision.reasonCodes].sort() },
  };
  const descriptorDigest = digestJsonOperacional(normalized);
  return success({ descriptor: normalized, descriptorDigest, localDescriptorOnly: true }, descriptorDigest);
}
