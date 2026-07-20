// SEMA-GOVERNED: sema.produto.sistemas_interativos.temporal
// Descricao: regressao adversarial de contratos 4D e evidencias temporais locais nao autoritativas.

import assert from "node:assert/strict";
import test from "node:test";
import {
  SCHEMA_CONTRATO_TEMPORAL,
  SCHEMA_EVIDENCIA_TEMPORAL,
  validarBundleVerificacaoTemporal,
  validarContratoTemporalInterativo,
  type BundleVerificacaoTemporal,
  type ContratoTemporalInterativo,
  type ObservacaoTemporal,
  type TipoEvidenciaTemporal,
} from "../../pacotes/cli/src/sistemasInterativos/temporal.js";

const DIGEST_IR = `sha256:${"1".repeat(64)}`;
const DIGEST_ARTEFATO = `sha256:${"2".repeat(64)}`;
const DIGEST_TRACE = `sha256:${"3".repeat(64)}`;
const DIGEST_CONFIG_PRODUTOR = `sha256:${"4".repeat(64)}`;
const DIGEST_CONFIG_VERIFICADOR = `sha256:${"5".repeat(64)}`;

function contratoCompleto(): ContratoTemporalInterativo {
  return {
    schemaVersion: SCHEMA_CONTRATO_TEMPORAL,
    contractId: "mission.return.timeline",
    systemId: "game-or-simulation",
    experienceIrDigest: DIGEST_IR,
    coordinateSystem: { unit: "meter", handedness: "RIGHT", upAxis: "Z", forwardAxis: "X" },
    phases: [{ phaseId: "descent", start: 0, end: 600, timeUnit: "FRAME" }],
    tracks: [
      {
        trackId: "track.audio",
        type: "AUDIO",
        clips: [{ clipId: "clip.audio", phaseId: "descent", semanticTargetId: "audio.splash", start: 300, end: 420, timeUnit: "FRAME" }],
      },
      {
        trackId: "track.event",
        type: "EVENT",
        clips: [{ clipId: "clip.contact", phaseId: "descent", semanticTargetId: "event.water_contact", start: 389, end: 391, timeUnit: "FRAME" }],
      },
    ],
    invariants: [{
      invariantId: "invariant.contact_before_splash",
      type: "ORDER",
      phaseId: "descent",
      trackIds: ["track.audio", "track.event"],
      subjectIds: ["vehicle.crewed", "water.surface"],
      threshold: 3,
      unit: "frame",
    }],
    shots: [{
      shotId: "shot.keep_capsule_visible",
      phaseId: "descent",
      cameraId: "camera.main",
      subjectIds: ["vehicle.crewed"],
      start: 0,
      end: 600,
      timeUnit: "FRAME",
      composition: "capsule centered with horizon context",
      minimumVisibilityRatio: 0.92,
      maximumJitter: 1.5,
    }],
    physics: [{
      relationId: "physics.capsule_water_contact",
      type: "COLLISION",
      phaseId: "descent",
      sourceId: "vehicle.crewed",
      targetId: "water.surface",
      start: 380,
      end: 410,
      timeUnit: "FRAME",
      tolerance: 0.02,
      unit: "meter",
    }],
    temporalQa: {
      checks: [
        { checkId: "qa.flicker", type: "FLICKER", phaseId: "descent", threshold: 0.02, unit: "ratio" },
        { checkId: "qa.ghosting", type: "GHOSTING", phaseId: "descent", threshold: 0.03, unit: "ratio" },
        { checkId: "qa.popping", type: "POPPING", phaseId: "descent", threshold: 1, unit: "event" },
        { checkId: "qa.exposure", type: "EXPOSURE", phaseId: "descent", threshold: 0.2, unit: "ev" },
        { checkId: "qa.jitter", type: "JITTER", phaseId: "descent", threshold: 1.5, unit: "pixel" },
      ],
    },
    buildAcceptance: {
      required: true,
      artifactDigest: DIGEST_ARTEFATO,
      cleanInstallRequired: true,
      launchRequired: true,
      smokePlaytestRequired: true,
    },
    hardwareTargets: [{
      profileId: "rtx3060_1080p60",
      gpu: "RTX 3060",
      cpu: "6-core reference CPU",
      resolution: { width: 1920, height: 1080 },
      targetFps: 60,
      frameTimeP95Ms: 16.7,
      maxRamMb: 8192,
      maxVramMb: 6144,
      maxDiskMb: 4096,
    }],
  };
}

function observacao(
  checkId: string,
  evidenceTypes: readonly TipoEvidenciaTemporal[],
  indice: number,
  contrato: ContratoTemporalInterativo,
): ObservacaoTemporal {
  const qa = contrato.temporalQa.checks.find((item) => item.checkId === checkId);
  const hardware = contrato.hardwareTargets.find((item) => `hardware:${item.profileId}` === checkId);
  return {
    observationId: `observation.${indice}`,
    checkId,
    decision: "PASS",
    evidenceTypes,
    artifactDigests: [DIGEST_ARTEFATO],
    sampleCount: 2,
    traceDigest: DIGEST_TRACE,
    phaseId: checkId.startsWith("build.") || checkId.startsWith("hardware:") ? undefined : "descent",
    frame: checkId.startsWith("build.") || checkId.startsWith("hardware:") ? undefined : 390,
    timeUnit: checkId.startsWith("build.") || checkId.startsWith("hardware:") ? undefined : "FRAME",
    metrics: qa
      ? [{ name: qa.type.toLowerCase(), value: qa.threshold / 2, unit: qa.unit, threshold: qa.threshold }]
      : hardware ? [
        { name: "target_fps", value: hardware.targetFps, unit: "fps", threshold: hardware.targetFps },
        { name: "frame_time_p95_ms", value: 16, unit: "ms", threshold: hardware.frameTimeP95Ms },
        { name: "ram_mb", value: 4096, unit: "mb", threshold: hardware.maxRamMb },
        { name: "vram_mb", value: 3072, unit: "mb", threshold: hardware.maxVramMb },
        { name: "disk_mb", value: 2048, unit: "mb", threshold: hardware.maxDiskMb },
      ] : undefined,
  };
}

function bundleCompleto(contrato: ContratoTemporalInterativo): BundleVerificacaoTemporal {
  const validacao = validarContratoTemporalInterativo(contrato);
  assert.equal(validacao.valido, true, validacao.bloqueios.join(","));
  let indice = 0;
  const observations = validacao.requiredCheckIds.map((checkId) => {
    indice += 1;
    if (checkId === "invariant.contact_before_splash") return observacao(checkId, ["AUDIO_TRACE", "EVENT_TRACE"], indice, contrato);
    if (checkId.startsWith("shot.")) return observacao(checkId, ["VIDEO", "OBJECT_ID", "DEPTH"], indice, contrato);
    if (checkId.startsWith("physics.")) return observacao(checkId, ["COLLISION_TRACE", "TRANSFORMS"], indice, contrato);
    if (checkId === "build.clean_install") return observacao(checkId, ["INSTALL_LOG"], indice, contrato);
    if (checkId === "build.launch") return observacao(checkId, ["LAUNCH_LOG"], indice, contrato);
    if (checkId === "build.smoke_playtest") return observacao(checkId, ["PLAYTEST_TRACE"], indice, contrato);
    return observacao(checkId, ["TELEMETRY"], indice, contrato);
  });
  return {
    schemaVersion: SCHEMA_EVIDENCIA_TEMPORAL,
    runId: "run.temporal.1",
    contractDigest: validacao.contractDigest,
    producerId: "runner.temporal.external",
    producerVersion: "2.0.0",
    producerConfigurationDigest: DIGEST_CONFIG_PRODUTOR,
    verifierId: "verifier.temporal.independent",
    verifierVersion: "1.0.0",
    verifierConfigurationDigest: DIGEST_CONFIG_VERIFICADOR,
    independentOfProducer: true,
    observations,
  };
}

test("contrato 4D completo separa timeline, shot, fisica, QA, build e hardware", () => {
  const resultado = validarContratoTemporalInterativo(contratoCompleto());
  assert.equal(resultado.valido, true, resultado.bloqueios.join(","));
  assert.match(resultado.contractDigest, /^sha256:[a-f0-9]{64}$/);
  for (const id of [
    "invariant.contact_before_splash", "shot.keep_capsule_visible", "physics.capsule_water_contact",
    "qa.flicker", "qa.ghosting", "qa.popping", "qa.exposure", "qa.jitter",
    "build.materialize", "build.clean_install", "build.launch", "build.smoke_playtest",
    "hardware:rtx3060_1080p60",
  ]) assert.ok(resultado.requiredCheckIds.includes(id), id);
  assert.equal(resultado.executed, false);
  assert.equal(resultado.authoritative, false);
});

test("bundle completo so prova cobertura estrutural local", () => {
  const contrato = contratoCompleto();
  const resultado = validarBundleVerificacaoTemporal(contrato, bundleCompleto(contrato));
  assert.equal(resultado.valido, true, resultado.bloqueios.join(","));
  assert.equal(resultado.checksAusentes.length, 0);
  assert.equal(resultado.checksFalhos.length, 0);
  assert.equal(resultado.localCoverageComplete, true);
  assert.equal(resultado.completed, false);
  assert.equal(resultado.awaitingExternalAttestation, true);
  assert.equal(resultado.completionScope, "STRUCTURAL_LOCAL");
  assert.equal(resultado.authoritative, false);
  assert.match(resultado.bundleDigest, /^sha256:[a-f0-9]{64}$/u);
  assert.match(resultado.resultDigest, /^sha256:[a-f0-9]{64}$/u);
  const repetido = validarBundleVerificacaoTemporal(contrato, bundleCompleto(contrato));
  assert.equal(repetido.bundleDigest, resultado.bundleDigest);
  assert.equal(repetido.resultDigest, resultado.resultDigest);
  assert.deepEqual(resultado.nextActions, ["solicitar_atestacao_externa"]);
});

test("bundle e resultado ficam ligados ao produtor, verificador e input exatos", () => {
  const contrato = contratoCompleto();
  const bundle = bundleCompleto(contrato);
  const outroRun = validarBundleVerificacaoTemporal(contrato, { ...bundle, runId: "run.temporal.2" });
  const original = validarBundleVerificacaoTemporal(contrato, bundle);
  assert.notEqual(outroRun.bundleDigest, original.bundleDigest);
  assert.notEqual(outroRun.resultDigest, original.resultDigest);

  const autoVerificado = validarBundleVerificacaoTemporal(contrato, {
    ...bundle,
    verifierId: bundle.producerId,
  });
  assert.equal(autoVerificado.valido, false);
  assert.ok(autoVerificado.bloqueios.includes("verifier_id_deve_diferir_do_produtor"));
});

test("screenshot isolado nao prova ordem, camera ou fisica", () => {
  const contrato = contratoCompleto();
  const bundle = bundleCompleto(contrato);
  const observations = bundle.observations.map((item) => item.checkId === "physics.capsule_water_contact"
    ? { ...item, evidenceTypes: ["SCREENSHOT" as const], sampleCount: 1, traceDigest: undefined }
    : item);
  const resultado = validarBundleVerificacaoTemporal(contrato, { ...bundle, observations });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("check_temporal_exige_amostras_ou_trace"));
  assert.ok(resultado.bloqueios.includes("check_geometrico_exige_evidencia_geometrica"));
  assert.equal(resultado.completed, false);
});

test("falha temporal gera diagnostico AI-native sem aplicar correcao", () => {
  const contrato = contratoCompleto();
  const bundle = bundleCompleto(contrato);
  const observations = bundle.observations.map((item) => item.checkId === "invariant.contact_before_splash"
    ? { ...item, decision: "FAIL" as const, frame: 390 }
    : item);
  const resultado = validarBundleVerificacaoTemporal(contrato, { ...bundle, observations });
  assert.equal(resultado.valido, false);
  assert.deepEqual(resultado.checksFalhos, ["invariant.contact_before_splash"]);
  assert.equal(resultado.diagnostics[0]?.failedInvariant, "invariant.contact_before_splash");
  assert.equal(resultado.diagnostics[0]?.phase, "descent");
  assert.equal(resultado.diagnostics[0]?.frame, 390);
  assert.deepEqual(resultado.diagnostics[0]?.likelyCauses, ["event_order_diverged"]);
  assert.ok(resultado.nextActions.includes("diagnosticar_e_corrigir_sem_apply:invariant.contact_before_splash"));
  assert.ok(resultado.nextActions.includes("reexecutar_check_temporal:invariant.contact_before_splash"));
  assert.equal(resultado.executed, false);
});

test("metricas obedecem limites, contrato e coerencia da decision", () => {
  const contrato = contratoCompleto();
  const base = bundleCompleto(contrato);
  const alterarQa = (mutacao: (metric: NonNullable<ObservacaoTemporal["metrics"]>[number]) => object) => ({
    ...base,
    observations: base.observations.map((item) => item.checkId === "qa.flicker"
      ? { ...item, metrics: item.metrics?.map((metric) => mutacao(metric)) }
      : item),
  });

  const excessiva = validarBundleVerificacaoTemporal(contrato, alterarQa((metric) => ({ ...metric, value: 1e99 })));
  assert.ok(excessiva.bloqueios.includes("observacao_invalida"));
  assert.equal(excessiva.localCoverageComplete, false);

  const thresholdNegativo = validarBundleVerificacaoTemporal(contrato, alterarQa((metric) => ({ ...metric, threshold: -1 })));
  assert.ok(thresholdNegativo.bloqueios.includes("observacao_invalida"));

  const contratoDivergente = validarBundleVerificacaoTemporal(contrato, alterarQa((metric) => ({ ...metric, threshold: 2 })));
  assert.ok(contratoDivergente.bloqueios.includes("metricas_divergem_do_contrato"));

  const passIncoerente = validarBundleVerificacaoTemporal(contrato, alterarQa((metric) => ({ ...metric, value: 0.5 })));
  assert.ok(passIncoerente.bloqueios.includes("decision_pass_incoerente_com_metricas"));
  assert.equal(passIncoerente.checksAceitos.includes("qa.flicker"), false);
});

test("referencias quebradas, QA incompleto e build sem clean install falham fechado", () => {
  const base = contratoCompleto();
  const invalido = {
    ...base,
    invariants: [{ ...base.invariants[0]!, phaseId: "phase.nao.existe" }],
    temporalQa: { checks: base.temporalQa.checks.filter((item) => item.type !== "JITTER") },
    buildAcceptance: { ...base.buildAcceptance, cleanInstallRequired: false },
  };
  const resultado = validarContratoTemporalInterativo(invalido);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("invariant_invalido"));
  assert.ok(resultado.bloqueios.includes("qa_check_jitter_ausente"));
  assert.ok(resultado.bloqueios.includes("build_acceptance_invalida"));
});

test("chave sensivel bloqueia sem ecoar o valor", () => {
  const segredo = "nao-ecoar-temporal-9381";
  const contrato = { ...contratoCompleto(), apiToken: segredo };
  const resultado = validarContratoTemporalInterativo(contrato);
  assert.ok(resultado.bloqueios.includes("contrato_contem_dado_sensivel"));
  assert.doesNotMatch(JSON.stringify(resultado), new RegExp(segredo));

  const base = contratoCompleto();
  const bundle = { ...bundleCompleto(base), privateKey: segredo };
  const bundleResultado = validarBundleVerificacaoTemporal(base, bundle);
  assert.ok(bundleResultado.bloqueios.includes("bundle_contem_dado_sensivel"));
  assert.doesNotMatch(JSON.stringify(bundleResultado), new RegExp(segredo));
});

test("campos top-level desconhecidos e schema global falham fechado", () => {
  const contrato = contratoCompleto();
  const contratoComTypo = validarContratoTemporalInterativo({ ...contrato, typoField: true });
  assert.equal(contratoComTypo.valido, false);
  assert.ok(contratoComTypo.bloqueios.includes("contrato_campo_top_level_desconhecido"));

  const bundle = bundleCompleto(contrato);
  const typo = validarBundleVerificacaoTemporal(contrato, { ...bundle, typoField: true });
  assert.equal(typo.valido, false);
  assert.ok(typo.bloqueios.includes("bundle_campo_top_level_desconhecido"));
  assert.deepEqual(typo.checksAceitos, []);
  assert.deepEqual(typo.nextActions, ["corrigir_bundle_temporal"]);

  const schemaInvalido = validarBundleVerificacaoTemporal(contrato, { ...bundle, schemaVersion: "invalid" });
  assert.equal(schemaInvalido.valido, false);
  assert.deepEqual(schemaInvalido.checksAceitos, []);
  assert.equal(schemaInvalido.nextActions.includes("solicitar_atestacao_externa"), false);
});

test("valor sensivel em campo refletido bloqueia sem eco", () => {
  const contrato = contratoCompleto();
  const bundle = bundleCompleto(contrato);
  const segredo = "sk-proj-temporal-secret123";
  const observations = bundle.observations.map((item, indice) => indice === 0
    ? { ...item, observationId: segredo, decision: "FAIL" as const }
    : item);
  const resultado = validarBundleVerificacaoTemporal(contrato, { ...bundle, observations });
  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("bundle_contem_dado_sensivel"));
  assert.deepEqual(resultado.checksAceitos, []);
  assert.deepEqual(resultado.diagnostics, []);
  assert.doesNotMatch(JSON.stringify(resultado), new RegExp(segredo, "u"));
});
