// SEMA-GOVERNED: sema.produto.sistemas_interativos.autonomia + testes_autonomos
// Descricao: regressao de reparo seguro, playtest/fuzz bounded e autoridade multiplayer declarativa.

import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCEPTANCE_LOCK_SCHEMA_V1,
  validarAcceptanceLock,
} from "../../pacotes/cli/src/sistemasInterativos/operations.js";
import {
  SCHEMA_AUTONOMIA,
  SCHEMA_AUTORIDADE_MULTIPLAYER,
  SCHEMA_PLAYTEST_FUZZ,
  digestAcceptanceClaimAutonomia,
  digestAcceptanceLocksAutonomia,
  tokenRecuperacaoEsperado,
  validarCicloReparoAutonomo,
  validarModeloAutoridadeMultiplayer,
  validarPlanoPlaytestFuzz,
  type CicloReparoAutonomo,
  type ModeloAutoridadeMultiplayer,
  type PlanoPlaytestFuzz,
} from "../../pacotes/cli/src/sistemasInterativos/autonomy.js";

const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;
const D3 = `sha256:${"3".repeat(64)}`;
const D4 = `sha256:${"4".repeat(64)}`;

function cicloSeguro(): CicloReparoAutonomo {
  const acceptanceLocks: CicloReparoAutonomo["acceptanceLocks"] = [];
  const acceptanceLocksDigest = digestAcceptanceLocksAutonomia(acceptanceLocks);
  const acceptanceClaim = {
    claimId: "acceptance.claim.camera.retarget",
    patchId: "patch.camera.retarget",
    artifactDigest: D1,
    sceneId: "scene.main",
    timeRange: { start: 0, end: 240, unit: "FRAME" as const },
    acceptanceLocksDigest,
  };
  const semToken: Omit<CicloReparoAutonomo, "recoveryToken"> = {
    schemaVersion: SCHEMA_AUTONOMIA,
    runId: "run.repair.1",
    cycleIndex: 1,
    previousCycleDigest: "GENESIS",
    triggeredStopCriteria: [],
    systemId: "interactive.system",
    definitionDigest: D1,
    policy: {
      mode: "SAFE_APPLY_EXTERNAL",
      maxCycles: 3,
      stopCriteria: ["invariant passed", "budget reached", "runner unavailable"],
      allowedRiskClasses: ["OBSERVATION_ONLY", "SAFE_REVERSIBLE"],
      requireHumanApprovalFor: ["PRIVILEGED", "IRREVERSIBLE"],
    },
    diagnostics: [{
      diagnosticId: "diagnostic.camera.target",
      failedInvariant: "camera.subject_visible",
      phase: "launch.ascent",
      evidenceIds: ["evidence.812"],
      semanticTargetId: "vehicle.crewed",
    }],
    resourceLocks: [{
      lockId: "lock.editor.1",
      resourceType: "EDITOR",
      ownerRunId: "run.repair.1",
      ownerJobId: "job.repair.1",
      checkpointDigest: D2,
    }],
    acceptanceLocks,
    acceptanceLocksDigest,
    acceptanceClaims: [{ ...acceptanceClaim, claimDigest: digestAcceptanceClaimAutonomia(acceptanceClaim) }],
    proposals: [{
      patchId: "patch.camera.retarget",
      diagnosticId: "diagnostic.camera.target",
      semanticTargetId: "vehicle.crewed",
      ownerJobId: "job.repair.1",
      adapterId: "editor.unreal",
      adapterVersion: "1.0.0",
      operation: "retarget camera to vehicle.crewed",
      riskClass: "SAFE_REVERSIBLE",
      mutates: true,
      humanApproved: false,
      inputDigest: D1,
      mutationScope: {
        artifactDigest: D1,
        sceneId: "scene.main",
        timeRange: { start: 0, end: 240, unit: "FRAME" },
      },
      snapshotDigest: D2,
      checkpointDigest: D2,
      rollbackPlanDigest: D3,
      resourceLockIds: ["lock.editor.1"],
    }],
    simulations: [{
      simulationId: "simulation.camera.retarget",
      patchId: "patch.camera.retarget",
      sandboxDigest: D2,
      resultDigest: D3,
      passed: true,
      evidenceDigests: [D4],
    }],
    proofs: [{
      proofId: "proof.camera.retarget",
      patchId: "patch.camera.retarget",
      simulationId: "simulation.camera.retarget",
      verifierId: "verifier.temporal.independent",
      independentOfProducer: true,
      evidenceDigests: [D4],
      decision: "PASS",
    }],
  };
  return { ...semToken, recoveryToken: tokenRecuperacaoEsperado(semToken) };
}

function planoFuzz(): PlanoPlaytestFuzz {
  return {
    schemaVersion: SCHEMA_PLAYTEST_FUZZ,
    planId: "playtest.fuzz.1",
    systemId: "interactive.system",
    definitionDigest: D1,
    inputActions: [
      { actionId: "input.move_x", type: "AXIS", minimum: -1, maximum: 1 },
      { actionId: "input.confirm", type: "BUTTON", minimum: 0, maximum: 1 },
    ],
    bots: [{
      botId: "bot.explorer.42",
      strategy: "EXPLORER",
      seed: 42,
      maxSteps: 1000,
      permissions: ["input.move_x", "input.confirm"],
    }],
    stateCheckpoints: [
      { checkpointId: "checkpoint.before", phase: "BEFORE", stateDigest: D2 },
      { checkpointId: "checkpoint.after", phase: "AFTER", stateDigest: D3 },
    ],
    saveLoadCases: [
      { caseId: "case.normal", type: "NORMAL", sourceCheckpointId: "checkpoint.before", targetCheckpointId: "checkpoint.after", sandboxOnly: true, originalImmutable: true },
      { caseId: "case.corrupt", type: "CORRUPT_RECOVERY", sourceCheckpointId: "checkpoint.before", targetCheckpointId: "checkpoint.after", sandboxOnly: true, originalImmutable: true },
      { caseId: "case.migration", type: "VERSION_MIGRATION", sourceCheckpointId: "checkpoint.before", targetCheckpointId: "checkpoint.after", sandboxOnly: true, originalImmutable: true },
    ],
    fuzzBounds: { maxSteps: 10000, maxRuntimeSeconds: 300, maxMemoryMb: 2048, maxDiskMb: 1024, maxCases: 100 },
    stopCriteria: ["CRASH", "HANG", "RESOURCE_EXHAUSTION", "INVARIANT_FAILURE"],
    evidenceRequirements: ["runtime.boot", "runtime.loop", "runtime.failure", "runtime.replay", "state.digest", "crash.trace"],
  };
}

function multiplayer(): ModeloAutoridadeMultiplayer {
  return {
    schemaVersion: SCHEMA_AUTORIDADE_MULTIPLAYER,
    modelId: "authority.game.1",
    systemId: "interactive.system",
    topology: "SERVER_AUTHORITATIVE",
    authorities: [
      { authorityId: "authority.server", role: "SERVER", principalId: "server.primary" },
      { authorityId: "authority.client.1", role: "CLIENT", principalId: "player.1" },
    ],
    replicatedState: [{
      stateId: "state.inventory",
      semanticTargetId: "player.1.inventory",
      sensitive: true,
      ownerAuthorityId: "authority.server",
      writerAuthorityIds: ["authority.server"],
      readerAuthorityIds: ["authority.server", "authority.client.1"],
      frequencyHz: 10,
      conflictPolicy: "SERVER_WINS",
      clientInputValidated: true,
    }],
    conflicts: [{ conflictId: "conflict.inventory", stateId: "state.inventory", resolution: "server validates sequence and wins" }],
    reconnect: {
      disconnectDetected: true,
      reconnectAllowed: true,
      resyncSnapshot: true,
      replaySinceSequence: true,
      timeoutMs: 10000,
    },
    securityInvariants: ["IDENTITY", "AUTHORIZATION", "ANTI_REPLAY", "RATE_LIMIT", "INTEGRITY"],
    evidenceRequirements: ["multiplayer.session", "multiplayer.sync", "multiplayer.conflict", "multiplayer.reconnect", "multiplayer.authority"],
  };
}

test("ciclo completo torna patch seguro elegivel apenas para runner externo", () => {
  const resultado = validarCicloReparoAutonomo(cicloSeguro());
  assert.equal(resultado.valido, true, resultado.bloqueios.join(","));
  assert.deepEqual(resultado.eligibleSafePatches, ["patch.camera.retarget"]);
  assert.deepEqual(resultado.blockedPatches, []);
  assert.equal(resultado.completed, false);
  assert.equal(resultado.authoritative, false);
  assert.equal(resultado.executed, false);
  assert.deepEqual(resultado.nextActions, ["entregar_patch_ao_runner_externo_autorizado:patch.camera.retarget"]);
  assert.equal(resultado.diagnostics[0]?.failedInvariant, "camera.subject_visible");
});

test("patch mutante sem snapshot, prova independente e rollback falha fechado", () => {
  const base = cicloSeguro();
  const proposals = base.proposals.map((item) => ({
    ...item,
    snapshotDigest: undefined,
    rollbackPlanDigest: undefined,
  }));
  const proofs = base.proofs.map((item) => ({ ...item, verifierId: "editor.unreal", independentOfProducer: false }));
  const alterado = { ...base, proposals, proofs };
  const ciclo = { ...alterado, recoveryToken: tokenRecuperacaoEsperado(alterado) };
  const resultado = validarCicloReparoAutonomo(ciclo);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("patch_mutante_sem_snapshot_checkpoint_rollback_ou_lock"));
  assert.ok(resultado.bloqueios.includes("proof_invalida"));
  assert.ok(resultado.bloqueios.includes("patch_mutante_sem_proof_independente"));
  assert.deepEqual(resultado.eligibleSafePatches, []);
});

test("proposal com target divergente do diagnostico nunca fica elegivel", () => {
  const base = cicloSeguro();
  const proposals = base.proposals.map((item) => ({ ...item, semanticTargetId: "camera.main" }));
  const alterado = { ...base, proposals };
  const ciclo = { ...alterado, recoveryToken: tokenRecuperacaoEsperado(alterado) };
  const resultado = validarCicloReparoAutonomo(ciclo);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("proposal_target_diverge_diagnostico"));
  assert.ok(resultado.bloqueios.includes("diagnostic_sem_proposal_valida"));
  assert.deepEqual(resultado.eligibleSafePatches, []);
});

test("diagnostico sem proposal nao satisfaz ciclo diagnose propose", () => {
  const base = cicloSeguro();
  const alterado = { ...base, proposals: [], simulations: [], proofs: [], resourceLocks: [] };
  const ciclo = { ...alterado, recoveryToken: tokenRecuperacaoEsperado(alterado) };
  const resultado = validarCicloReparoAutonomo(ciclo);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("proposals_ausentes"));
  assert.ok(resultado.bloqueios.includes("diagnostic_sem_proposal_valida"));
  assert.deepEqual(resultado.eligibleSafePatches, []);
  assert.deepEqual(resultado.nextActions, ["corrigir_ciclo_autonomia"]);
});

test("lock de run job ou checkpoint concorrente nunca torna patch elegivel", () => {
  const base = cicloSeguro();
  const resourceLocks = base.resourceLocks.map((lock) => ({ ...lock, ownerJobId: "job.concorrente" }));
  const resultadoOwner = validarCicloReparoAutonomo({ ...base, resourceLocks });
  assert.equal(resultadoOwner.valido, false);
  assert.ok(resultadoOwner.bloqueios.includes("resource_lock_owner_ou_checkpoint_divergente"));
  assert.deepEqual(resultadoOwner.eligibleSafePatches, []);

  const proposals = base.proposals.map((proposal) => ({ ...proposal, checkpointDigest: D4 }));
  const alterado = { ...base, proposals };
  const ciclo = { ...alterado, recoveryToken: tokenRecuperacaoEsperado(alterado) };
  const resultadoCheckpoint = validarCicloReparoAutonomo(ciclo);
  assert.equal(resultadoCheckpoint.valido, false);
  assert.ok(resultadoCheckpoint.bloqueios.includes("resource_lock_owner_ou_checkpoint_divergente"));
  assert.deepEqual(resultadoCheckpoint.eligibleSafePatches, []);
});

test("cadeia de ciclos respeita previous digest maxCycles e stop criteria", () => {
  const base = cicloSeguro();
  const acimaDoLimiteBase = { ...base, cycleIndex: 4, previousCycleDigest: D1 };
  const acimaDoLimite = { ...acimaDoLimiteBase, recoveryToken: tokenRecuperacaoEsperado(acimaDoLimiteBase) };
  const resultadoLimite = validarCicloReparoAutonomo(acimaDoLimite);
  assert.equal(resultadoLimite.valido, false);
  assert.ok(resultadoLimite.bloqueios.includes("cycle_index_excede_max_cycles"));
  assert.deepEqual(resultadoLimite.eligibleSafePatches, []);

  const paradoBase = { ...base, triggeredStopCriteria: ["invariant passed"] };
  const parado = { ...paradoBase, recoveryToken: tokenRecuperacaoEsperado(paradoBase) };
  const resultadoParado = validarCicloReparoAutonomo(parado);
  assert.equal(resultadoParado.valido, false);
  assert.ok(resultadoParado.bloqueios.includes("stop_criteria_ja_acionado"));
  assert.deepEqual(resultadoParado.eligibleSafePatches, []);

  const cadeiaQuebradaBase = { ...base, cycleIndex: 2, previousCycleDigest: "GENESIS" };
  const cadeiaQuebrada = { ...cadeiaQuebradaBase, recoveryToken: tokenRecuperacaoEsperado(cadeiaQuebradaBase) };
  const resultadoCadeia = validarCicloReparoAutonomo(cadeiaQuebrada);
  assert.ok(resultadoCadeia.bloqueios.includes("previous_cycle_digest_invalido"));
  assert.deepEqual(resultadoCadeia.eligibleSafePatches, []);
});

test("patch privilegiado sem aprovacao nunca vira auto-apply", () => {
  const base = cicloSeguro();
  const proposals = base.proposals.map((item) => ({ ...item, riskClass: "PRIVILEGED" as const }));
  const alterado = { ...base, proposals };
  const ciclo = { ...alterado, recoveryToken: tokenRecuperacaoEsperado(alterado) };
  const resultado = validarCicloReparoAutonomo(ciclo);
  assert.ok(resultado.bloqueios.includes("patch_risco_alto_sem_aprovacao_humana"));
  assert.deepEqual(resultado.eligibleSafePatches, []);
  assert.deepEqual(resultado.blockedPatches, ["patch.camera.retarget"]);
});

test("playtest fuzz produz cenarios deterministas e nao executa runtime", () => {
  const resultado = validarPlanoPlaytestFuzz(planoFuzz());
  assert.equal(resultado.valido, true, resultado.bloqueios.join(","));
  assert.equal(resultado.scenarioIds.length, 3);
  assert.ok(resultado.scenarioIds.every((item) => item.startsWith("playtest.fuzz.1:bot.explorer.42:")));
  assert.deepEqual(resultado.nextActions, ["entregar_cenarios_ao_runner_sandbox_externo"]);
  assert.equal(resultado.executed, false);
  assert.equal(resultado.authoritative, false);
});

test("fuzz sem budget e permissao fora da allowlist e bloqueado", () => {
  const base = planoFuzz();
  const resultado = validarPlanoPlaytestFuzz({
    ...base,
    bots: [{ ...base.bots[0]!, permissions: ["process.kill"] }],
    fuzzBounds: { ...base.fuzzBounds, maxRuntimeSeconds: 0 },
  });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("bot_invalido_ou_permissao_fora_da_allowlist"));
  assert.ok(resultado.bloqueios.includes("fuzz_bounds_invalidos"));
  assert.equal(resultado.executed, false);
});

test("fuzz sem bots nao e valido nem produz cenarios planejaveis", () => {
  const resultado = validarPlanoPlaytestFuzz({ ...planoFuzz(), bots: [] });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("bots_ausentes"));
  assert.deepEqual(resultado.scenarioIds, []);
  assert.deepEqual(resultado.nextActions, ["corrigir_plano_playtest_fuzz"]);
  assert.equal(resultado.executed, false);
});

test("save load exige transicao BEFORE para AFTER com ids distintos", () => {
  const base = planoFuzz();
  const stateCheckpoints = base.stateCheckpoints.map((checkpoint) => ({ ...checkpoint, phase: "BEFORE" as const }));
  const resultado = validarPlanoPlaytestFuzz({ ...base, stateCheckpoints });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("save_load_case_invalido_ou_nao_isolado"));
  assert.deepEqual(resultado.scenarioIds, []);
});

test("bots e total de cenarios respeitam fuzz bounds", () => {
  const base = planoFuzz();
  const botExcessivo = validarPlanoPlaytestFuzz({
    ...base,
    bots: base.bots.map((bot) => ({ ...bot, maxSteps: base.fuzzBounds.maxSteps + 1 })),
  });
  assert.ok(botExcessivo.bloqueios.includes("bot_max_steps_excede_fuzz_bounds"));
  assert.deepEqual(botExcessivo.scenarioIds, []);

  const casosExcessivos = validarPlanoPlaytestFuzz({ ...base, fuzzBounds: { ...base.fuzzBounds, maxCases: 2 } });
  assert.ok(casosExcessivos.bloqueios.includes("scenario_count_excede_fuzz_bounds"));
  assert.deepEqual(casosExcessivos.scenarioIds, []);
});

test("modelo multiplayer resolve autoridade sensivel, conflito e reconnect", () => {
  const resultado = validarModeloAutoridadeMultiplayer(multiplayer());
  assert.equal(resultado.valido, true, [...resultado.bloqueios, ...resultado.authorityGaps].join(","));
  assert.deepEqual(resultado.authorityGaps, []);
  assert.deepEqual(resultado.nextActions, ["capturar_traces_multiplayer_em_runner_externo"]);
  assert.equal(resultado.executed, false);
});

test("estado sensivel controlado pelo cliente vira gap explicito", () => {
  const base = multiplayer();
  const authorities = base.authorities.map((item) => item.authorityId === "authority.server"
    ? { ...item, role: "CLIENT" as const }
    : item);
  const replicatedState = base.replicatedState.map((item) => ({ ...item, clientInputValidated: false }));
  const resultado = validarModeloAutoridadeMultiplayer({ ...base, authorities, replicatedState });
  assert.equal(resultado.valido, false);
  assert.deepEqual(resultado.authorityGaps, ["state.inventory"]);
  assert.deepEqual(resultado.nextActions, ["definir_autoridade_e_validacao:state.inventory"]);
});

test("SERVER_AUTHORITATIVE rejeita writer CLIENT mesmo com owner server e input validado", () => {
  const base = multiplayer();
  const replicatedState = base.replicatedState.map((item) => ({
    ...item,
    writerAuthorityIds: ["authority.client.1"],
    ownerAuthorityId: "authority.server",
    clientInputValidated: true,
  }));
  const resultado = validarModeloAutoridadeMultiplayer({ ...base, replicatedState });
  assert.equal(resultado.valido, false);
  assert.deepEqual(resultado.authorityGaps, ["state.inventory"]);
  assert.deepEqual(resultado.nextActions, ["definir_autoridade_e_validacao:state.inventory"]);
});

test("modelo multiplayer vazio nao finge autoridade valida", () => {
  const resultado = validarModeloAutoridadeMultiplayer({
    ...multiplayer(),
    authorities: [],
    replicatedState: [],
    conflicts: [],
  });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("authorities_ausentes"));
  assert.ok(resultado.bloqueios.includes("replicated_state_ausente"));
  assert.deepEqual(resultado.authorityGaps, []);
  assert.deepEqual(resultado.nextActions, ["corrigir_modelo_autoridade"]);
});

test("topology SERVER_AUTHORITATIVE exige role owner e writers SERVER para todo estado", () => {
  const base = multiplayer();
  const authorities = base.authorities.filter((authority) => authority.role === "CLIENT");
  const replicatedState = base.replicatedState.map((state) => ({
    ...state,
    sensitive: false,
    ownerAuthorityId: "authority.client.1",
    writerAuthorityIds: ["authority.client.1"],
    readerAuthorityIds: ["authority.client.1"],
  }));
  const resultado = validarModeloAutoridadeMultiplayer({ ...base, authorities, replicatedState });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("topology_sem_authority_role_compativel"));
  assert.deepEqual(resultado.authorityGaps, ["state.inventory"]);
});

test("segredo e bloqueado sem eco de valor", () => {
  const segredo = "nao-ecoar-autonomia-9442";
  const resultado = validarCicloReparoAutonomo({ ...cicloSeguro(), apiToken: segredo });
  assert.ok(resultado.bloqueios.includes("ciclo_contem_dado_sensivel"));
  assert.doesNotMatch(JSON.stringify(resultado), new RegExp(segredo));
});

test("allowlist top-level e estrita em autonomia fuzz e multiplayer", () => {
  for (const resultado of [
    validarCicloReparoAutonomo({ ...cicloSeguro(), typoField: "nao-permitido" }),
    validarPlanoPlaytestFuzz({ ...planoFuzz(), typoField: "nao-permitido" }),
    validarModeloAutoridadeMultiplayer({ ...multiplayer(), typoField: "nao-permitido" }),
  ]) {
    assert.equal(resultado.valido, false);
    assert.ok(resultado.bloqueios.includes("campos_top_level_desconhecidos"));
  }
});

test("valor sensivel aninhado bloqueia sem eco mesmo quando parece ID valido", () => {
  const segredo = "sk-proj-secret123";
  const base = cicloSeguro();
  const diagnostics = base.diagnostics.map((diagnostic) => ({ ...diagnostic, evidenceIds: [segredo] }));
  const resultado = validarCicloReparoAutonomo({ ...base, diagnostics });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("ciclo_contem_dado_sensivel"));
  assert.deepEqual(resultado.eligibleSafePatches, []);
  assert.deepEqual(resultado.diagnostics, []);
  assert.equal(JSON.stringify(resultado).includes(segredo), false);
});

test("qualquer bloqueio global zera elegibilidade e handoff externo", () => {
  const resultado = validarCicloReparoAutonomo({ ...cicloSeguro(), definitionDigest: "not-a-digest" });
  assert.equal(resultado.valido, false);
  assert.deepEqual(resultado.eligibleSafePatches, []);
  assert.deepEqual(resultado.nextActions, ["corrigir_ciclo_autonomia"]);
  assert.equal(resultado.nextActions.some((action) => action.startsWith("entregar_patch_")), false);

  const base = cicloSeguro();
  const proposals = base.proposals.map((proposal) => ({ ...proposal, inputDigest: D4 }));
  const digestDivergente = validarCicloReparoAutonomo({ ...base, proposals });
  assert.ok(digestDivergente.bloqueios.includes("proposal_input_digest_diverge_definition"));
  assert.deepEqual(digestDivergente.eligibleSafePatches, []);
  assert.deepEqual(digestDivergente.nextActions, ["corrigir_ciclo_autonomia"]);
});

test("acceptance claim content-addressed bloqueia patch sobre faixa aprovada ativa", () => {
  const base = cicloSeguro();
  const lock = {
    schemaVersion: ACCEPTANCE_LOCK_SCHEMA_V1,
    lockId: "acceptance.launch.approved",
    artifactDigest: D1,
    sceneId: "scene.main",
    timeRange: { start: 100, end: 200, unit: "FRAME" as const },
    approver: { approverIdDigest: D2, role: "ArtDirector", method: "HUMAN" as const },
    decision: "ACCEPTED" as const,
    status: "ACTIVE" as const,
    createdAt: "2026-07-20T03:00:00.000Z",
    authoritative: false as const,
  };
  const lockResult = validarAcceptanceLock(lock);
  assert.equal(lockResult.valid, true, JSON.stringify(lockResult.issues));
  const acceptanceLocks = [{ lock: lockResult.value!.lock, lockDigest: lockResult.value!.lockDigest }];
  const acceptanceLocksDigest = digestAcceptanceLocksAutonomia(acceptanceLocks);
  const acceptanceClaims = base.acceptanceClaims.map(({ claimDigest: _claimDigest, ...claim }) => {
    const rebound = { ...claim, acceptanceLocksDigest };
    return { ...rebound, claimDigest: digestAcceptanceClaimAutonomia(rebound) };
  });
  const resultado = validarCicloReparoAutonomo({ ...base, acceptanceLocks, acceptanceLocksDigest, acceptanceClaims });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("patch_toca_acceptance_lock_ativo"));
  assert.deepEqual(resultado.eligibleSafePatches, []);
  assert.deepEqual(resultado.nextActions, ["corrigir_ciclo_autonomia"]);

  const claimAdulterada = base.acceptanceClaims.map((claim) => ({
    ...claim,
    timeRange: { ...claim.timeRange, end: claim.timeRange.end + 1 },
  }));
  const adulterado = validarCicloReparoAutonomo({ ...base, acceptanceClaims: claimAdulterada });
  assert.ok(adulterado.bloqueios.includes("acceptance_claim_invalido_ou_duplicado_por_patch"));
  assert.deepEqual(adulterado.eligibleSafePatches, []);

  const claimEscopoFalso = base.acceptanceClaims.map(({ claimDigest: _claimDigest, ...claim }) => {
    const falso = { ...claim, artifactDigest: D2 };
    return { ...falso, claimDigest: digestAcceptanceClaimAutonomia(falso) };
  });
  const escopoFalso = validarCicloReparoAutonomo({ ...base, acceptanceClaims: claimEscopoFalso });
  assert.ok(escopoFalso.bloqueios.includes("acceptance_claim_invalido_ou_duplicado_por_patch"));
  assert.deepEqual(escopoFalso.eligibleSafePatches, []);

  const invalidatedLock = {
    ...lock,
    status: "INVALIDATED" as const,
    invalidation: {
      previousLockDigest: lockResult.value!.lockDigest,
      invalidatedByDigest: D3,
      reasonCode: "ARTIFACT_CHANGED" as const,
      invalidatedAt: "2026-07-20T04:00:00.000Z",
    },
  };
  const invalidatedResult = validarAcceptanceLock(invalidatedLock);
  assert.equal(invalidatedResult.valid, true, JSON.stringify(invalidatedResult.issues));
  const locksSemEvidencia = [{ lock: invalidatedResult.value!.lock, lockDigest: invalidatedResult.value!.lockDigest }];
  const digestSemEvidencia = digestAcceptanceLocksAutonomia(locksSemEvidencia);
  const claimsSemEvidencia = base.acceptanceClaims.map(({ claimDigest: _claimDigest, ...claim }) => {
    const rebound = { ...claim, acceptanceLocksDigest: digestSemEvidencia };
    return { ...rebound, claimDigest: digestAcceptanceClaimAutonomia(rebound) };
  });
  const invalidacaoSemEvidencia = validarCicloReparoAutonomo({
    ...base,
    acceptanceLocks: locksSemEvidencia,
    acceptanceLocksDigest: digestSemEvidencia,
    acceptanceClaims: claimsSemEvidencia,
  });
  assert.ok(invalidacaoSemEvidencia.bloqueios.includes("acceptance_lock_invalido"));
  assert.deepEqual(invalidacaoSemEvidencia.eligibleSafePatches, []);
});
