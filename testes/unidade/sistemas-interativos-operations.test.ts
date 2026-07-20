// SEMA-GOVERNED: sema.produto.sistemas_interativos.operacao
// Descricao: regressao adversarial da fundacao operacional local, pura e nao autoritativa.

import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCEPTANCE_LOCK_SCHEMA_V1,
  ASSET_PROVENANCE_SCHEMA_V1,
  EDITOR_STATE_SCHEMA_V1,
  ENGINE_SNAPSHOT_SCHEMA_V1,
  JOB_ORCHESTRATION_SCHEMA_V1,
  MULTIMODAL_EVIDENCE_SCHEMA_V1,
  criarReferenciaFonteOpaca,
  derivarDiffSnapshotsEngine,
  digestVinculoClaimMultimodal,
  operarAcceptanceLock,
  planejarOrquestracaoJobs,
  validarEvidenciaMultimodal,
  validarEstadoEditor,
  validarProvenienciaAsset,
  validarSnapshotEngine,
  type OperationResult,
} from "../../pacotes/cli/src/sistemasInterativos/operations.js";

const DIGEST_A = "sha256:" + "a".repeat(64);
const DIGEST_B = "sha256:" + "b".repeat(64);
const DIGEST_C = "sha256:" + "c".repeat(64);
const DIGEST_D = "sha256:" + "d".repeat(64);
const OPAQUE_A = "opaque:sha256:" + "a".repeat(64);
const OPAQUE_B = "opaque:sha256:" + "b".repeat(64);

function assertPure(result: OperationResult<unknown>): void {
  assert.equal(result.executed, false);
  assert.equal(result.workspaceMutated, false);
  assert.equal(result.engineProbed, false);
  assert.equal(result.editorInspected, false);
  assert.equal(result.processesInspected, false);
  assert.equal(result.resourcesReserved, false);
  assert.equal(result.authoritative, false);
}

function snapshot(snapshotId: string, stateDigest = DIGEST_A, extra = false) {
  return {
    schemaVersion: ENGINE_SNAPSHOT_SCHEMA_V1,
    snapshotId,
    projectId: "project.demo",
    sceneId: "scene.main",
    adapter: { adapterId: "engine.custom", adapterVersion: "1.0.0" },
    semanticObjects: [
      {
        semanticId: "entity.root",
        kind: "Entity",
        stateDigest,
        componentDigests: { Transform: stateDigest },
      },
      ...(extra ? [{
        semanticId: "entity.child",
        kind: "Entity",
        parentSemanticId: "entity.root",
        stateDigest: DIGEST_C,
        componentDigests: { Mesh: DIGEST_C },
      }] : []),
    ],
    artifactDigest: stateDigest,
    readOnly: true,
    authoritative: false,
  };
}

test("snapshot e diff usam IDs semanticos e digests sem fingir probe", () => {
  const before = snapshot("snapshot.before");
  const after = snapshot("snapshot.after", DIGEST_B, true);
  const validated = validarSnapshotEngine(before);
  assert.equal(validated.valid, true, JSON.stringify(validated.issues));
  assert.match(validated.value!.snapshotDigest, /^sha256:[a-f0-9]{64}$/);
  assertPure(validated);

  const first = derivarDiffSnapshotsEngine(before, after);
  const second = derivarDiffSnapshotsEngine(before, after);
  assert.equal(first.valid, true, JSON.stringify(first.issues));
  assert.deepEqual(first, second);
  assert.deepEqual(first.value!.changes.map((item) => [item.semanticId, item.change]), [
    ["entity.child", "ADDED"],
    ["entity.root", "MODIFIED"],
  ]);
  assert.equal(first.value!.readOnly, true);
  assert.match(first.value!.diffDigest, /^sha256:[a-f0-9]{64}$/);
  assertPure(first);
});

test("snapshot divergente ou malicioso falha fechado e sem eco", () => {
  const sensitiveValue = "snapshot-secret-nao-ecoar-918";
  const changedScene = { ...snapshot("snapshot.after"), sceneId: "scene.other" };
  const mismatch = derivarDiffSnapshotsEngine(snapshot("snapshot.before"), changedScene);
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.value, undefined);
  assert.ok(mismatch.issues.some((item) => item.code === "snapshot_scene_binding_mismatch"));

  const malicious = { ...snapshot("snapshot.bad"), apiToken: sensitiveValue };
  const rejected = validarSnapshotEngine(malicious);
  assert.equal(rejected.valid, false);
  assert.equal(rejected.value, undefined);
  assert.doesNotMatch(JSON.stringify(rejected), new RegExp(sensitiveValue));
  assertPure(rejected);
});

test("snapshot rejeita autoparent e ciclos hierarquicos entre objetos", () => {
  const selfParent = snapshot("snapshot.self");
  selfParent.semanticObjects[0]!.parentSemanticId = "entity.root";
  const selfResult = validarSnapshotEngine(selfParent);
  assert.equal(selfResult.valid, false);
  assert.ok(selfResult.issues.some((item) => item.code === "semantic_parent_self_reference"));

  const cyclic = snapshot("snapshot.cycle", DIGEST_A, true);
  cyclic.semanticObjects[0]!.parentSemanticId = "entity.child";
  const cycleResult = validarSnapshotEngine(cyclic);
  assert.equal(cycleResult.valid, false);
  assert.ok(cycleResult.issues.some((item) => item.code === "semantic_parent_cycle"));
  assertPure(cycleResult);
});

test("URI de origem vira referencia opaca e proveniencia preserva toda a linhagem", () => {
  const rawUri = "https://assets.example.invalid/private/ship.fbx?signature=never-log";
  const opaque = criarReferenciaFonteOpaca(rawUri);
  assert.equal(opaque.valid, true);
  assert.match(opaque.value!.sourceUriRef, /^opaque:sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(opaque), /ship\.fbx|signature/);

  const provenance = {
    schemaVersion: ASSET_PROVENANCE_SCHEMA_V1,
    assetId: "asset.ship",
    sourceUriRef: opaque.value!.sourceUriRef,
    sourceUriRedacted: true,
    license: { licenseId: "CC-BY-4.0", evidenceDigest: DIGEST_D, redistributable: true },
    sourceHash: DIGEST_A,
    contentHash: DIGEST_B,
    transforms: [{
      transformId: "transform.optimize",
      toolRef: "Blender",
      toolVersion: "4.3.0",
      inputDigest: DIGEST_A,
      outputDigest: DIGEST_B,
      parametersDigest: DIGEST_C,
    }],
    derivatives: [{
      assetId: "asset.ship_lod",
      parentContentHash: DIGEST_B,
      contentHash: DIGEST_C,
      transformDigest: DIGEST_D,
    }],
    authoritative: false,
  };
  const result = validarProvenienciaAsset(provenance);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.match(result.value!.provenanceDigest, /^sha256:[a-f0-9]{64}$/);
  assertPure(result);
});

test("proveniencia rejeita URI crua, segredo e cadeia quebrada sem eco", () => {
  const sensitiveValue = "asset-secret-nao-ecoar-722";
  const malicious = {
    schemaVersion: ASSET_PROVENANCE_SCHEMA_V1,
    assetId: "asset.bad",
    sourceUriRef: "file:///private/secret.fbx",
    sourceUriRedacted: false,
    license: { licenseId: "UNKNOWN", evidenceDigest: DIGEST_D, redistributable: false },
    sourceHash: DIGEST_A,
    contentHash: DIGEST_C,
    transforms: [{
      transformId: "transform.bad",
      toolRef: "Tool",
      toolVersion: "1.0.0",
      inputDigest: DIGEST_B,
      outputDigest: DIGEST_C,
      parametersDigest: DIGEST_D,
      clientSecret: sensitiveValue,
    }],
    derivatives: [],
    authoritative: false,
  };
  const result = validarProvenienciaAsset(malicious);
  assert.equal(result.valid, false);
  assert.equal(result.value, undefined);
  assert.ok(result.issues.some((item) => item.code === "source_uri_ref_must_be_opaque"));
  assert.ok(result.issues.some((item) => item.code === "asset_transform_invalid"));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sensitiveValue));
});

function editorState() {
  return {
    schemaVersion: EDITOR_STATE_SCHEMA_V1,
    editorSessionId: "editor.session",
    adapter: { adapterId: "engine.custom", adapterVersion: "1.0.0" },
    scene: { semanticId: "scene.main", artifactDigest: DIGEST_A },
    selection: ["entity.root"],
    mode: "EDIT",
    unsavedChanges: true,
    shaderJobs: [{ jobId: "job.shader", status: "RUNNING", progressBasisPoints: 4200 }],
    importJobs: [{ jobId: "job.import", status: "QUEUED", progressBasisPoints: 0 }],
    plugins: [{ pluginId: "Plugin.Render", version: "1.2.0", enabled: true, provenanceDigest: DIGEST_B }],
    modals: [{ modalId: "modal.import", kind: "ImportOptions", blocking: true }],
    processes: [{ processRef: OPAQUE_A, role: "SHADER_COMPILER", state: "RUNNING" }],
    observedAt: "2026-07-20T03:00:00.000Z",
    readOnly: true,
    authoritative: false,
  };
}

test("EDITOR_STATE cobre cena selecao modo dirty jobs plugins modais e processos opacos", () => {
  const result = validarEstadoEditor(editorState());
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.equal(result.value!.state.unsavedChanges, true);
  assert.equal(result.value!.externallyObserved, false);
  assert.match(result.value!.editorStateDigest, /^sha256:[a-f0-9]{64}$/);
  assertPure(result);
});

test("EDITOR_STATE nunca aceita PID comando path ou segredo embutido", () => {
  const sensitiveValue = "editor-secret-nao-ecoar-244";
  const malicious = {
    ...editorState(),
    processes: [{ processRef: OPAQUE_A, role: "EDITOR", state: "RUNNING", pid: 4312, command: sensitiveValue }],
  };
  const result = validarEstadoEditor(malicious);
  assert.equal(result.valid, false);
  assert.equal(result.value, undefined);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sensitiveValue));
  assertPure(result);
});

function jobsRequest() {
  return {
    schemaVersion: JOB_ORCHESTRATION_SCHEMA_V1,
    queueId: "queue.render",
    capacity: { ramMb: 32768, vramMb: 12288, diskMb: 200000 },
    lockCapacity: { GPU: 1, EDITOR: 1, CACHE: 1 },
    jobs: [
      {
        jobId: "job.import",
        kind: "IMPORT",
        priority: 50,
        dependencies: [],
        locks: ["CACHE"],
        budget: { ramMb: 2048, vramMb: 0, diskMb: 10000 },
        heartbeat: { intervalMs: 1000, timeoutMs: 5000 },
        checkpoint: { intervalMs: 10000, resume: false, recoveryToken: OPAQUE_A },
        adapter: { adapterId: "engine.custom", adapterVersion: "1.0.0" },
      },
      {
        jobId: "job.render",
        kind: "RENDER",
        priority: 90,
        dependencies: ["job.import"],
        locks: ["GPU", "EDITOR"],
        budget: { ramMb: 8192, vramMb: 8192, diskMb: 50000 },
        heartbeat: { intervalMs: 1000, timeoutMs: 5000 },
        checkpoint: {
          intervalMs: 10000,
          resume: true,
          checkpointDigest: DIGEST_C,
          recoveryToken: OPAQUE_B,
        },
        adapter: { adapterId: "engine.custom", adapterVersion: "1.0.0" },
      },
    ],
  };
}

test("orquestracao planeja fila locks budgets heartbeat checkpoint e resume sem reservar nada", () => {
  const first = planejarOrquestracaoJobs(jobsRequest());
  const second = planejarOrquestracaoJobs(jobsRequest());
  assert.equal(first.valid, true, JSON.stringify(first.issues));
  assert.deepEqual(first, second);
  assert.deepEqual(first.value!.queue.map((item) => item.jobId), ["job.import", "job.render"]);
  assert.deepEqual(first.value!.queue[1]!.locks, ["GPU", "EDITOR"]);
  assert.equal(first.value!.queue[1]!.kind, "RENDER");
  assert.equal(first.value!.queue[1]!.priority, 90);
  assert.deepEqual(first.value!.queue[1]!.adapter, { adapterId: "engine.custom", adapterVersion: "1.0.0" });
  assert.equal(first.value!.queue[1]!.resume, true);
  assert.match(first.value!.requestDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.value!.externalRunnerRequired, true);
  assert.equal(first.value!.resourcesReserved, false);
  assertPure(first);
});

test("requestDigest e planDigest cobrem kind priority adapter e requisicao canonica completa", () => {
  const base = jobsRequest();
  const baseline = planejarOrquestracaoJobs(base);
  assert.equal(baseline.valid, true, JSON.stringify(baseline.issues));
  const variants = [
    { ...base, jobs: base.jobs.map((job, index) => index === 1 ? { ...job, kind: "BAKE" } : job) },
    { ...base, jobs: base.jobs.map((job, index) => index === 1 ? { ...job, priority: 89 } : job) },
    { ...base, jobs: base.jobs.map((job, index) => index === 1 ? {
      ...job,
      adapter: { adapterId: "engine.alternate", adapterVersion: "2.0.0" },
    } : job) },
    { ...base, capacity: { ...base.capacity, ramMb: 32767 } },
  ];
  for (const variant of variants) {
    const changed = planejarOrquestracaoJobs(variant);
    assert.equal(changed.valid, true, JSON.stringify(changed.issues));
    assert.notEqual(changed.value!.requestDigest, baseline.value!.requestDigest);
    assert.notEqual(changed.value!.planDigest, baseline.value!.planDigest);
  }
});

test("orquestracao bloqueia ciclo budget excessivo lock ausente e recovery token cru", () => {
  const sensitiveValue = "recovery-token-nao-ecoar-311";
  const base = jobsRequest();
  const malicious = {
    ...base,
    lockCapacity: { ...base.lockCapacity, GPU: 0 },
    jobs: base.jobs.map((job, index) => index === 0 ? {
      ...job,
      dependencies: ["job.render"],
      budget: { ...job.budget, ramMb: 99999999 },
      checkpoint: { ...job.checkpoint, recoveryToken: sensitiveValue },
    } : job),
  };
  const result = planejarOrquestracaoJobs(malicious);
  assert.equal(result.valid, false);
  assert.equal(result.value, undefined);
  assert.ok(result.issues.some((item) => item.code === "resource_budget_invalid"));
  assert.ok(result.issues.some((item) => item.code === "job_lock_unavailable"));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sensitiveValue));
  assertPure(result);
});

function acceptanceLock() {
  return {
    schemaVersion: ACCEPTANCE_LOCK_SCHEMA_V1,
    lockId: "acceptance.main",
    artifactDigest: DIGEST_A,
    sceneId: "scene.main",
    timeRange: { start: 0, end: 240, unit: "FRAME" },
    approver: { approverIdDigest: DIGEST_B, role: "ArtDirector", method: "HUMAN" },
    decision: "ACCEPTED",
    status: "ACTIVE",
    createdAt: "2026-07-20T03:00:00.000Z",
    authoritative: false,
  };
}

test("acceptance lock so aceita binding exato e invalidacao explicita ligada ao digest", () => {
  const lock = acceptanceLock();
  const validated = operarAcceptanceLock("VALIDATE", lock, {});
  assert.equal(validated.valid, true, JSON.stringify(validated.issues));
  assert.equal(validated.value!.accepted, true);

  const mismatch = operarAcceptanceLock("EVALUATE", lock, {
    artifactDigest: DIGEST_D,
    sceneId: "scene.main",
    timeRange: { start: 0, end: 240, unit: "FRAME" },
  });
  assert.equal(mismatch.valid, true);
  assert.equal(mismatch.value!.accepted, false);
  assert.ok(mismatch.value!.blockers.includes("acceptance_binding_mismatch"));

  const wrongDigest = operarAcceptanceLock("INVALIDATE", lock, {
    lockDigest: DIGEST_D,
    invalidatedByDigest: DIGEST_C,
    reasonCode: "ARTIFACT_CHANGED",
    invalidatedAt: "2026-07-20T04:00:00.000Z",
  });
  assert.equal(wrongDigest.valid, false);
  assert.equal(wrongDigest.value, undefined);

  const invalidated = operarAcceptanceLock("INVALIDATE", lock, {
    lockDigest: validated.value!.lockDigest,
    invalidatedByDigest: DIGEST_C,
    reasonCode: "ARTIFACT_CHANGED",
    invalidatedAt: "2026-07-20T04:00:00.000Z",
  });
  assert.equal(invalidated.valid, true, JSON.stringify(invalidated.issues));
  assert.equal(invalidated.value!.invalidated, true);
  assert.equal(invalidated.value!.lock.status, "INVALIDATED");
  assert.equal(invalidated.value!.lock.invalidation!.previousLockDigest, validated.value!.lockDigest);
  assertPure(invalidated);
});

const CHANNEL_TYPES = [
  "SCREENSHOT", "VIDEO", "DEPTH", "NORMALS", "OBJECT_ID",
  "MOTION", "TRANSFORMS", "EVENTS", "AUDIO", "TELEMETRY",
] as const;

function evidenceDescriptor() {
  const claim = {
    claimId: "claim.render.quality",
    runId: "run.validation",
    definitionDigest: DIGEST_A,
    planDigest: DIGEST_B,
    contractDigest: DIGEST_C,
    artifactDigest: DIGEST_A,
    sceneId: "scene.main",
    timeRange: { start: 0, end: 10, unit: "SECOND" as const },
    requiredModalities: [...CHANNEL_TYPES],
  };
  return {
    schemaVersion: MULTIMODAL_EVIDENCE_SCHEMA_V1,
    evidenceId: "evidence.multimodal",
    ...claim,
    claimBindingDigest: digestVinculoClaimMultimodal(claim),
    channels: CHANNEL_TYPES.map((type, index) => ({
      channelId: "channel." + type.toLowerCase(),
      type,
      artifactDigest: index % 2 === 0 ? DIGEST_B : DIGEST_C,
      mediaType: type === "SCREENSHOT" || type === "OBJECT_ID"
        ? "image/png"
        : type === "VIDEO"
          ? "video/mp4"
          : type === "AUDIO"
            ? "audio/wav"
            : "application/json",
      metadataDigest: DIGEST_D,
      sampleCount: index + 1,
    })),
    producer: {
      producerIdDigest: DIGEST_A,
      producerType: "ENGINE",
      version: "1.0.0",
      configurationDigest: DIGEST_D,
    },
    verifier: {
      verifierIdDigest: DIGEST_B,
      verifierType: "MODEL",
      version: "1.0.0",
      independent: true,
      configurationDigest: DIGEST_C,
    },
    decision: { verdict: "PASS", reasonCodes: ["geometry_ok", "timing_ok"], confidenceBasisPoints: 9500 },
    observedAt: "2026-07-20T03:30:00.000Z",
    authoritative: false,
  };
}

test("descriptor multimodal tipa os dez canais e prova producer diferente do verifier", () => {
  const result = validarEvidenciaMultimodal(evidenceDescriptor());
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.deepEqual(result.value!.descriptor.channels.map((item) => item.type).sort(), [...CHANNEL_TYPES].sort());
  assert.notEqual(result.value!.descriptor.producer.producerIdDigest, result.value!.descriptor.verifier.verifierIdDigest);
  assert.equal(result.value!.descriptor.verifier.independent, true);
  assert.equal(result.value!.localDescriptorOnly, true);
  assert.match(result.value!.descriptorDigest, /^sha256:[a-f0-9]{64}$/);
  assertPure(result);
});

test("descriptor rejeita verifier igual ao producer mesmo com flag independent", () => {
  const base = evidenceDescriptor();
  const result = validarEvidenciaMultimodal({
    ...base,
    verifier: { ...base.verifier, verifierIdDigest: base.producer.producerIdDigest, independent: true },
  });
  assert.equal(result.valid, false);
  assert.equal(result.value, undefined);
  assert.ok(result.issues.some((item) => item.code === "evidence_verifier_not_independent"));
  assertPure(result);
});

test("PASS multimodal exige claim binding e todas as modalidades requeridas", () => {
  const base = evidenceDescriptor();
  const screenshotOnly = validarEvidenciaMultimodal({
    ...base,
    requiredModalities: ["SCREENSHOT"],
    channels: [base.channels[0]],
  });
  assert.equal(screenshotOnly.valid, false);
  assert.ok(screenshotOnly.issues.some((item) => item.code === "evidence_pass_requires_multiple_modalities"));

  const missingVideo = validarEvidenciaMultimodal({
    ...base,
    requiredModalities: ["SCREENSHOT", "VIDEO"],
    channels: [base.channels[0]],
  });
  assert.equal(missingVideo.valid, false);
  assert.ok(missingVideo.issues.some((item) => item.code === "evidence_pass_missing_required_modality"));

  const brokenBinding = validarEvidenciaMultimodal({ ...base, definitionDigest: DIGEST_D });
  assert.equal(brokenBinding.valid, false);
  assert.ok(brokenBinding.issues.some((item) => item.code === "evidence_claim_binding_invalid"));
});

test("descriptor nao executa verifier e rejeita duplicata ou segredo sem eco", () => {
  const sensitiveValue = "verifier-secret-nao-ecoar-655";
  const base = evidenceDescriptor();
  const malicious = {
    ...base,
    channels: [...base.channels, { ...base.channels[0], channelId: "channel.duplicate", apiKey: sensitiveValue }],
  };
  const result = validarEvidenciaMultimodal(malicious);
  assert.equal(result.valid, false);
  assert.equal(result.value, undefined);
  assert.ok(result.issues.some((item) => item.code === "evidence_channel_type_duplicate"
    || item.code === "sensitive_material_forbidden"));
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sensitiveValue));
  assertPure(result);
});

test("descriptor rejeita valores sensiveis por conteudo sem eco", () => {
  const secrets = [
    "sk-proj-secret123",
    "Bearer abcdefghijklmnop",
    ["-----BEGIN", "PRIVATE", "KEY-----"].join(" "),
    "https://runner.invalid/callback?api_key=segredo123",
    "eyJabcdefgh.eyJijklmnop.qrstuvwxyz",
    "AKIAABCDEFGHIJKLMNOP",
  ];
  for (const secret of secrets) {
    const base = evidenceDescriptor();
    const result = validarEvidenciaMultimodal({
      ...base,
      decision: { ...base.decision, reasonCodes: [secret] },
    });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((item) => item.code === "sensitive_material_forbidden"));
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});

test("JSON ciclico falha sem excecao, payload ou vazamento", () => {
  const cyclic: Record<string, unknown> = { schemaVersion: EDITOR_STATE_SCHEMA_V1 };
  cyclic.self = cyclic;
  assert.doesNotThrow(() => validarEstadoEditor(cyclic));
  const result = validarEstadoEditor(cyclic);
  assert.equal(result.valid, false);
  assert.equal(result.value, undefined);
  assert.ok(result.issues.some((item) => item.code === "json_cycle_detected"));
  assertPure(result);
});
