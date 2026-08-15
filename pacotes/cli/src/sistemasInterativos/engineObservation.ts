// SEMA-GOVERNED: sema.produto.sistemas_interativos.operacao, sema.produto.sistemas_interativos.operacao.observacao_engine
// Descricao: snapshots, diffs, proveniencia de assets e estado declarado de editor, sem sondar runtimes.

import {
  ASSET_PROVENANCE_SCHEMA_V1,
  EDITOR_STATE_SCHEMA_V1,
  ENGINE_DIFF_SCHEMA_V1,
  ENGINE_SNAPSHOT_SCHEMA_V1,
  type AssetProvenanceV1,
  type EditorStateV1,
  type EngineSnapshotChange,
  type EngineSnapshotDiffV1,
  type EngineSnapshotV1,
  type OperationIssue,
  type OperationResult,
  type Sha256,
  type ValidatedEngineSnapshot,
} from "./operationsTypes.js";
import {
  canonicalJson,
  digestJsonOperacional,
  failure,
  hasOnlyKeys,
  inspectPlainJson,
  isIntegerIn,
  isIsoTimestamp,
  isOpaqueSha256,
  isRecord,
  isSafeName,
  isSemanticId,
  isSha256,
  isVersion,
  issue,
  success,
} from "./operationPrimitives.js";

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
