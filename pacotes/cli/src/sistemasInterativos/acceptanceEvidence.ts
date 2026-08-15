// SEMA-GOVERNED: sema.produto.sistemas_interativos.operacao.acceptance_evidencias
// Descricao: acceptance locks, invalidacao explicita e evidencia multimodal local nao autoritativa.

import {
  ACCEPTANCE_LOCK_SCHEMA_V1,
  MULTIMODAL_EVIDENCE_SCHEMA_V1,
  type AcceptanceInvalidationReason,
  type AcceptanceLockV1,
  type AcceptanceOperationValue,
  type AcceptanceTimeRange,
  type MultimodalChannelType,
  type MultimodalEvidenceDescriptorV1,
  type OperationIssue,
  type OperationResult,
  type Sha256,
} from "./operationsTypes.js";
import {
  MEDIA_TYPE_PATTERN,
  canonicalJson,
  digestJsonOperacional,
  failure,
  hasOnlyKeys,
  inspectPlainJson,
  isIntegerIn,
  isIsoTimestamp,
  isRecord,
  isSafeName,
  isSemanticId,
  isSha256,
  isVersion,
  issue,
  success,
} from "./operationPrimitives.js";

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
