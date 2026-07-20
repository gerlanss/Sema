// SEMA-GOVERNED: sema.produto.sistemas_interativos.portabilidade
// Descricao: regressao de perdas de portabilidade, migracao versionada e DAG de workers sem execucao.

import assert from "node:assert/strict";
import test from "node:test";
import {
  SCHEMA_PORTABILIDADE,
  SCHEMA_WORKERS_DISTRIBUIDOS,
  analisarPlanoPortabilidadeInterativa,
  digestManifestoFontePortabilidade,
  validarPlanoWorkersDistribuidos,
  type PlanoPortabilidadeInterativa,
  type PlanoWorkersDistribuidos,
} from "../../pacotes/cli/src/sistemasInterativos/portability.js";

const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;
const D3 = `sha256:${"3".repeat(64)}`;
const D4 = `sha256:${"4".repeat(64)}`;

const EVIDENCIAS_PORTABILIDADE = [
  "import.scene", "import.assets", "import.materials", "import.animation", "import.physics",
  "import.audio", "import.timeline", "package.build", "runtime.smoke",
];
const EVIDENCIAS_JOB = ["output.digest", "job.log", "job.checkpoint", "resources.metrics"];

function planoPortabilidade(): PlanoPortabilidadeInterativa {
  const sourceManifest = {
    experienceIrDigest: D1,
    snapshotDigest: D2,
    entries: [
      { semanticId: "vehicle.crewed", sourceKind: "Actor.Transform", contentDigest: D1, required: true },
      { semanticId: "vfx.reentry.plasma", sourceKind: "NiagaraSystem", contentDigest: D2, required: true },
      { semanticId: "audio.reentry.dynamic", sourceKind: "MetaSound", contentDigest: D3, required: true },
    ],
  } as const;
  return {
    schemaVersion: SCHEMA_PORTABILIDADE,
    planId: "portability.unreal.unity",
    systemId: "interactive.system",
    experienceIrDigest: D1,
    source: {
      engine: "Unreal",
      version: "5.6.0",
      snapshotDigest: D2,
      coordinateSystem: "centimeter left-handed Z-up",
    },
    sourceManifest: {
      ...sourceManifest,
      manifestDigest: digestManifestoFontePortabilidade(sourceManifest),
    },
    targets: [{
      targetId: "target.unity",
      engine: "Unity",
      version: "6.0.0",
      outputFormat: "USD plus sidecars",
      mappings: [
        {
          mappingId: "mapping.transform",
          semanticId: "vehicle.crewed",
          sourceKind: "Actor.Transform",
          targetKind: "GameObject.Transform",
          status: "EXACT",
          losses: [],
          acceptanceCriteria: ["world transform preserved within tolerance"],
        },
        {
          mappingId: "mapping.niagara",
          semanticId: "vfx.reentry.plasma",
          sourceKind: "NiagaraSystem",
          targetKind: "VFXGraph",
          status: "APPROXIMATE",
          losses: ["renderer_module_mapping", "curve_precision"],
          fallback: "bake curves and rebuild unsupported modules",
          acceptanceCriteria: ["timing and bounds preserved", "visual review required"],
        },
        {
          mappingId: "mapping.metasound",
          semanticId: "audio.reentry.dynamic",
          sourceKind: "MetaSound",
          targetKind: "AudioMixerGraph",
          status: "UNSUPPORTED",
          losses: ["procedural_audio_graph"],
          fallback: "render stems and preserve event sidecar",
          acceptanceCriteria: ["event timing preserved", "user accepts non-procedural fallback"],
        },
      ],
    }],
    migrations: [{
      migrationId: "migration.unreal.55.56",
      targetId: "target.unity",
      engine: "Unreal",
      fromVersion: "5.5.0",
      toVersion: "5.6.0",
      backupDigest: D1,
      compatibilityReportDigest: D2,
      testPlanDigest: D3,
      rollbackPlanDigest: D4,
    }],
    acceptance: {
      maxUnsupportedPerTarget: 1,
      allowApproximate: true,
      requiredEvidence: EVIDENCIAS_PORTABILIDADE,
    },
  };
}

function planoWorkers(): PlanoWorkersDistribuidos {
  return {
    schemaVersion: SCHEMA_WORKERS_DISTRIBUIDOS,
    planId: "workers.build.1",
    systemId: "interactive.system",
    inputDigest: D1,
    workers: [{
      workerId: "worker.gpu.1",
      capabilities: ["job.cook", "job.shaders", "job.render", "job.test"],
      ramMb: 32768,
      vramMb: 12288,
      diskMb: 102400,
      maxConcurrency: 1,
      isolation: "CONTAINER",
    }],
    jobs: [
      {
        jobId: "job.cook",
        type: "COOK",
        inputDigest: D1,
        dependsOn: [],
        requiredCapabilities: ["job.cook"],
        budgets: { ramMb: 8192, vramMb: 0, diskMb: 20480, runtimeSeconds: 1800 },
        idempotencyKey: "idempotency.cook.1",
        checkpointIntervalSeconds: 60,
        retry: { maxAttempts: 1, backoffSeconds: 10 },
        resourceLockIds: ["lock.cache.cook"],
        requiredEvidence: EVIDENCIAS_JOB,
      },
      {
        jobId: "job.shaders",
        type: "SHADERS",
        inputDigest: D2,
        dependsOn: ["job.cook"],
        requiredCapabilities: ["job.shaders"],
        budgets: { ramMb: 16384, vramMb: 8192, diskMb: 20480, runtimeSeconds: 3600 },
        idempotencyKey: "idempotency.shaders.1",
        checkpointIntervalSeconds: 60,
        retry: { maxAttempts: 1, backoffSeconds: 10 },
        resourceLockIds: ["lock.gpu.shaders"],
        requiredEvidence: EVIDENCIAS_JOB,
      },
      {
        jobId: "job.render",
        type: "RENDER",
        inputDigest: D3,
        dependsOn: ["job.shaders"],
        requiredCapabilities: ["job.render"],
        budgets: { ramMb: 16384, vramMb: 10240, diskMb: 40960, runtimeSeconds: 7200 },
        idempotencyKey: "idempotency.render.1",
        checkpointIntervalSeconds: 30,
        retry: { maxAttempts: 1, backoffSeconds: 10 },
        resourceLockIds: ["lock.gpu.render"],
        requiredEvidence: EVIDENCIAS_JOB,
      },
      {
        jobId: "job.test",
        type: "TEST",
        inputDigest: D4,
        dependsOn: ["job.render"],
        requiredCapabilities: ["job.test"],
        budgets: { ramMb: 8192, vramMb: 2048, diskMb: 10240, runtimeSeconds: 1800 },
        idempotencyKey: "idempotency.test.1",
        checkpointIntervalSeconds: 30,
        retry: { maxAttempts: 2, backoffSeconds: 10 },
        resourceLockIds: ["lock.gpu.test", "lock.editor.test"],
        requiredEvidence: EVIDENCIAS_JOB,
      },
    ],
    leases: [
      { lockId: "lock.cache.cook", resourceId: "cache.project", resourceType: "CACHE", ownerJobId: "job.cook", exclusive: true, ttlSeconds: 120, heartbeatSeconds: 30, checkpointDigest: D1 },
      { lockId: "lock.gpu.shaders", resourceId: "gpu.0", resourceType: "GPU", ownerJobId: "job.shaders", exclusive: true, ttlSeconds: 120, heartbeatSeconds: 30, checkpointDigest: D2 },
      { lockId: "lock.gpu.render", resourceId: "gpu.0", resourceType: "GPU", ownerJobId: "job.render", exclusive: true, ttlSeconds: 120, heartbeatSeconds: 30, checkpointDigest: D3 },
      { lockId: "lock.gpu.test", resourceId: "gpu.0", resourceType: "GPU", ownerJobId: "job.test", exclusive: true, ttlSeconds: 120, heartbeatSeconds: 30, checkpointDigest: D4 },
      { lockId: "lock.editor.test", resourceId: "editor.0", resourceType: "EDITOR", ownerJobId: "job.test", exclusive: true, ttlSeconds: 120, heartbeatSeconds: 30, checkpointDigest: D4 },
    ],
    evidenceRequirements: EVIDENCIAS_JOB,
  };
}

test("portabilidade cross-engine declara perdas e nunca afirma conversao", () => {
  const resultado = analisarPlanoPortabilidadeInterativa(planoPortabilidade());
  assert.equal(resultado.valido, true, [...resultado.bloqueios, ...resultado.migrationGaps].join(","));
  assert.equal(resultado.converted, false);
  assert.equal(resultado.authoritative, false);
  assert.equal(resultado.executed, false);
  assert.equal(resultado.declaredLosses.length, 2);
  assert.deepEqual(resultado.targetReports[0], {
    targetId: "target.unity",
    exact: 1,
    approximate: 1,
    unsupported: 1,
    sourceCoverageComplete: true,
    mappingsBoundToSource: true,
    migrationLinked: true,
    readyForExternalMigration: true,
    requiresExternalValidation: true,
    converted: false,
  });
  assert.deepEqual(resultado.nextActions, ["entregar_plano_ao_adapter_externo:target.unity"]);
});

test("aproximacao sem perda e fallback falha fechado", () => {
  const base = planoPortabilidade();
  const targets = base.targets.map((target) => ({
    ...target,
    mappings: target.mappings.map((mapping) => mapping.status === "APPROXIMATE"
      ? { ...mapping, losses: [], fallback: undefined }
      : mapping),
  }));
  const resultado = analisarPlanoPortabilidadeInterativa({ ...base, targets });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("mapping_nao_exato_exige_loss_e_fallback"));
  assert.equal(resultado.converted, false);
});

test("limite de unsupported produz gap explicito em vez de fingir conversao", () => {
  const base = planoPortabilidade();
  const resultado = analisarPlanoPortabilidadeInterativa({
    ...base,
    acceptance: { ...base.acceptance, maxUnsupportedPerTarget: 0 },
  });
  assert.equal(resultado.valido, false);
  assert.deepEqual(resultado.migrationGaps, ["target.unity"]);
  assert.deepEqual(resultado.nextActions, ["revisar_perdas_e_acceptance:target.unity"]);
});

test("mapping arbitrario desconectado do manifesto nunca fica pronto para migracao", () => {
  const base = planoPortabilidade();
  const targets = base.targets.map((target) => ({
    ...target,
    mappings: target.mappings.map((mapping, index) => index === 0
      ? { ...mapping, semanticId: "arbitrary.node", sourceKind: "Invented.Source" }
      : mapping),
  }));
  const resultado = analisarPlanoPortabilidadeInterativa({ ...base, targets });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("mapping_desconectado_do_source_manifest"));
  assert.ok(resultado.bloqueios.includes("mapping_cobertura_origem_incompleta"));
  assert.equal(resultado.targetReports[0]?.mappingsBoundToSource, false);
  assert.equal(resultado.targetReports[0]?.sourceCoverageComplete, false);
  assert.equal(resultado.targetReports[0]?.readyForExternalMigration, false);
  assert.deepEqual(resultado.migrationGaps, ["target.unity"]);
});

test("mapping parcial sem cobertura de toda origem obrigatoria nunca fica pronto", () => {
  const base = planoPortabilidade();
  const targets = base.targets.map((target) => ({ ...target, mappings: target.mappings.slice(0, 1) }));
  const resultado = analisarPlanoPortabilidadeInterativa({ ...base, targets });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("mapping_cobertura_origem_incompleta"));
  assert.equal(resultado.targetReports[0]?.mappingsBoundToSource, true);
  assert.equal(resultado.targetReports[0]?.sourceCoverageComplete, false);
  assert.equal(resultado.targetReports[0]?.readyForExternalMigration, false);
});

test("manifesto sem vinculo criptografico aos digests da origem bloqueia readiness", () => {
  const base = planoPortabilidade();
  const sourceManifest = { ...base.sourceManifest, snapshotDigest: D4 };
  const resultado = analisarPlanoPortabilidadeInterativa({ ...base, sourceManifest });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("source_manifest_desvinculado"));
  assert.ok(resultado.bloqueios.includes("source_manifest_digest_divergente"));
  assert.equal(resultado.targetReports[0]?.readyForExternalMigration, false);
});

test("plano sem migration ligada ao target nunca fica pronto", () => {
  const resultado = analisarPlanoPortabilidadeInterativa({ ...planoPortabilidade(), migrations: [] });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("migrations_ausentes"));
  assert.ok(resultado.bloqueios.includes("target_sem_migration_ligada"));
  assert.equal(resultado.targetReports[0]?.migrationLinked, false);
  assert.equal(resultado.targetReports[0]?.readyForExternalMigration, false);
  assert.deepEqual(resultado.migrationGaps, ["target.unity"]);
});

test("migration com target ou versao desconectados nao satisfaz readiness", () => {
  const base = planoPortabilidade();
  const migrations = base.migrations.map((migration) => ({
    ...migration,
    targetId: "target.inexistente",
    toVersion: "9.9.9",
  }));
  const resultado = analisarPlanoPortabilidadeInterativa({ ...base, migrations });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("migration_desconectada_do_target_ou_source"));
  assert.ok(resultado.bloqueios.includes("target_sem_migration_ligada"));
  assert.equal(resultado.targetReports[0]?.migrationLinked, false);
  assert.equal(resultado.targetReports[0]?.readyForExternalMigration, false);
});

test("DAG de cook shaders render e test e atribuida sem executar", () => {
  const resultado = validarPlanoWorkersDistribuidos(planoWorkers());
  assert.equal(resultado.valido, true, [...resultado.bloqueios, ...resultado.capabilityGaps, ...resultado.lockConflicts].join(","));
  assert.deepEqual(resultado.topologicalOrder, ["job.cook", "job.shaders", "job.render", "job.test"]);
  assert.equal(resultado.assignments.length, 4);
  assert.equal(resultado.capabilityGaps.length, 0);
  assert.equal(resultado.lockConflicts.length, 0);
  assert.equal(resultado.completed, false);
  assert.equal(resultado.authoritative, false);
  assert.equal(resultado.executed, false);
  assert.deepEqual(resultado.nextActions, ["entregar_DAG_ao_orquestrador_externo"]);
});

test("worker sem capability vira gap e ciclo de jobs vira bloqueio", () => {
  const base = planoWorkers();
  const workers = base.workers.map((worker) => ({ ...worker, capabilities: worker.capabilities.filter((item) => item !== "job.render") }));
  const jobs = base.jobs.map((job) => job.jobId === "job.cook" ? { ...job, dependsOn: ["job.test"] } : job);
  const resultado = validarPlanoWorkersDistribuidos({ ...base, workers, jobs });
  assert.equal(resultado.valido, false);
  assert.deepEqual(resultado.capabilityGaps, ["job.render"]);
  assert.ok(resultado.bloqueios.includes("job_dependency_cycle"));
});

test("locks exclusivos de jobs concorrentes sao detectados", () => {
  const base = planoWorkers();
  const jobs = base.jobs.map((job) => job.jobId === "job.render" ? { ...job, dependsOn: ["job.cook"] } : job);
  const resultado = validarPlanoWorkersDistribuidos({ ...base, jobs });
  assert.equal(resultado.valido, false);
  assert.deepEqual(resultado.lockConflicts, ["job.shaders|job.render|gpu.0", "job.shaders|job.test|gpu.0"]);
  assert.deepEqual(resultado.nextActions, [
    "serializar_jobs_com_lock_conflitante:job.shaders|job.render|gpu.0",
    "serializar_jobs_com_lock_conflitante:job.shaders|job.test|gpu.0",
  ]);
});

test("segredo e bloqueado sem eco", () => {
  const segredo = "nao-ecoar-portabilidade-3388";
  const resultado = analisarPlanoPortabilidadeInterativa({ ...planoPortabilidade(), clientSecret: segredo });
  assert.ok(resultado.bloqueios.includes("plano_contem_dado_sensivel"));
  assert.doesNotMatch(JSON.stringify(resultado), new RegExp(segredo));
});

test("allowlist top-level e estrita em portabilidade e workers", () => {
  const portabilidade = analisarPlanoPortabilidadeInterativa({ ...planoPortabilidade(), typoField: "nao-permitido" });
  const workers = validarPlanoWorkersDistribuidos({ ...planoWorkers(), typoField: "nao-permitido" });
  for (const resultado of [portabilidade, workers]) {
    assert.equal(resultado.valido, false);
    assert.ok(resultado.bloqueios.includes("campos_top_level_desconhecidos"));
  }
});

test("valor sensivel aninhado e bloqueado sem eco em portabilidade e workers", () => {
  const segredo = "https://runner.invalid/callback?access_token=segredo123";
  const basePortabilidade = planoPortabilidade();
  const targets = basePortabilidade.targets.map((target) => ({
    ...target,
    mappings: target.mappings.map((mapping, index) => index === 1 ? { ...mapping, fallback: segredo } : mapping),
  }));
  const portabilidade = analisarPlanoPortabilidadeInterativa({ ...basePortabilidade, targets });
  assert.ok(portabilidade.bloqueios.includes("plano_contem_dado_sensivel"));
  assert.deepEqual(portabilidade.targetReports, []);
  assert.equal(JSON.stringify(portabilidade).includes(segredo), false);

  const baseWorkers = planoWorkers();
  const jobs = baseWorkers.jobs.map((job, index) => index === 0 ? { ...job, idempotencyKey: "sk-proj-workersecret123" } : job);
  const workers = validarPlanoWorkersDistribuidos({ ...baseWorkers, jobs });
  assert.ok(workers.bloqueios.includes("plano_contem_dado_sensivel"));
  assert.deepEqual(workers.assignments, []);
  assert.equal(JSON.stringify(workers).includes("sk-proj-workersecret123"), false);
});

test("bloqueio global zera readiness assignments ordem e handoff", () => {
  const portabilidade = analisarPlanoPortabilidadeInterativa({ ...planoPortabilidade(), schemaVersion: "schema.invalido" });
  assert.equal(portabilidade.valido, false);
  assert.ok(portabilidade.targetReports.every((report) => report.readyForExternalMigration === false));
  assert.deepEqual(portabilidade.nextActions, ["corrigir_plano_portabilidade"]);

  const workers = validarPlanoWorkersDistribuidos({ ...planoWorkers(), schemaVersion: "schema.invalido" });
  assert.equal(workers.valido, false);
  assert.deepEqual(workers.assignments, []);
  assert.deepEqual(workers.topologicalOrder, []);
  assert.deepEqual(workers.nextActions, ["corrigir_plano_workers"]);
});

test("workers exigem GPU lease idempotency unica e checkpoint ligado ao job", () => {
  const base = planoWorkers();
  const semGpu = validarPlanoWorkersDistribuidos({
    ...base,
    jobs: base.jobs.map((job) => job.jobId === "job.render" ? { ...job, resourceLockIds: [] } : job),
  });
  assert.ok(semGpu.bloqueios.includes("job_gpu_lease_ausente"));
  assert.deepEqual(semGpu.assignments, []);

  const duplicada = validarPlanoWorkersDistribuidos({
    ...base,
    jobs: base.jobs.map((job) => job.jobId === "job.render" ? { ...job, idempotencyKey: "idempotency.cook.1" } : job),
  });
  assert.ok(duplicada.bloqueios.includes("job_idempotency_key_duplicada"));

  const leases = base.leases.map((lease) => lease.lockId === "lock.gpu.render" ? { ...lease, checkpointDigest: D4 } : lease);
  const checkpoint = validarPlanoWorkersDistribuidos({ ...base, leases });
  assert.ok(checkpoint.bloqueios.includes("job_lock_ausente_owner_ou_checkpoint_divergente"));
});
