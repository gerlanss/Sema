// SEMA-GOVERNED: sema.produto.sistemas_interativos.adaptadores + evidencias
// Descricao: protocolo seguro, proveniencia de observacao e conclusao apenas estrutural local.

import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOGO_ADAPTADORES_INTERATIVOS,
  bundleVazioSistemaInterativo,
  derivarEstadoSistemaInterativo,
  digestJsonSistemaInterativo,
  planejarSistemaInterativo,
  validarAdaptadorSistemaInterativo,
  validarBundleEvidenciasSistemaInterativo,
  validarDefinicaoSistemaInterativo,
  validarProtocoloAdapterSistemaInterativo,
  type BundleEvidenciasSistemaInterativo,
  type DefinicaoSistemaInterativo,
  type FaseProtocoloAdaptador,
  type PlanoSistemaInterativo,
  type RegistroProtocoloAdapter,
} from "../../pacotes/cli/src/sistemasInterativos/index.js";

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;

function simulacaoMinima(adapterTargets: readonly string[] = ["runtime.headless.generic"]): DefinicaoSistemaInterativo {
  const base: DefinicaoSistemaInterativo = {
    schemaVersion: "1.0",
    systemId: "simulation.minimal",
    version: "1.0.0",
    kind: "SIMULATION",
    spatialModel: "NON_SPATIAL",
    renderMode: "HEADLESS",
    visualProfile: "NONE",
    fidelity: "SYSTEMIC",
    controlModes: ["SCRIPTED"],
    timeModel: "EVENT_DRIVEN",
    determinism: "NONE",
    capabilities: ["interactive.control.scripted"],
    pipelines: ["interactive.prototype"],
    adapterTargets,
    world: {
      identity: "bounded-queue",
      state: { length: 0 },
      time: { model: "event-driven" },
      events: ["enqueue", "dequeue"],
      initialConditions: ["empty queue"],
      model: "bounded queue",
      assumptions: ["single producer"],
      boundaryConditions: ["capacity 10"],
      outputs: ["queue length"],
      validation: { method: "invariant check", invariants: ["length from zero to ten"] },
    },
    acceptance: { criteria: ["queue length remains bounded"] },
  };
  return { ...base, capabilities: validarDefinicaoSistemaInterativo(base).capabilitiesRequeridas };
}

function registroProtocolo(
  adapterId: string,
  fases: readonly { phase: FaseProtocoloAdaptador; success: boolean }[],
  mutated: boolean,
  success: boolean,
  rollbackEvidenceId?: string,
): RegistroProtocoloAdapter {
  return {
    runId: "run.adapter.1",
    adapterId,
    adapterVersion: "1.0.0",
    semanticTargetId: "target.system.1",
    phases: fases.map((item, indice) => ({
      phaseId: `phase.${indice + 1}`,
      phase: item.phase,
      semanticTargetId: "target.system.1",
      inputDigest: DIGEST_A,
      outputDigest: DIGEST_B,
      success: item.success,
    })),
    mutated,
    success,
    rollbackEvidenceId,
  };
}

const FASES_LEITURA = [
  { phase: "DETECT", success: true },
  { phase: "PROBE", success: true },
  { phase: "SNAPSHOT", success: true },
  { phase: "PLAN", success: true },
  { phase: "VALIDATE", success: true },
  { phase: "EVIDENCE", success: true },
] as const;

function bundleCompleto(): {
  definicao: DefinicaoSistemaInterativo;
  plano: PlanoSistemaInterativo;
  bundle: BundleEvidenciasSistemaInterativo;
} {
  const definicao = simulacaoMinima();
  const planejamento = planejarSistemaInterativo(definicao);
  assert.deepEqual(planejamento.bloqueios, []);
  let contador = 0;
  const observations = planejamento.plano.stages.flatMap((stage) => {
    const provider = planejamento.plano.stageProviderMap.find((item) => item.stageInstanceId === stage.stageInstanceId);
    const producerAdapterId = provider?.selectedAdapterIds[0];
    assert.ok(producerAdapterId, stage.stageInstanceId);
    const producer = CATALOGO_ADAPTADORES_INTERATIVOS.find((item) => item.adapterId === producerAdapterId);
    assert.ok(producer);
    return stage.requiredEvidence.map((evidenceType) => ({
      evidenceId: `evidence.${++contador}`,
      evidenceType,
      stageId: stage.stageInstanceId,
      semanticTargetId: "target.simulation.minimal",
      producerAdapterId,
      producerAdapterVersion: producer.version,
      artifactDigest: DIGEST_A,
      observedAt: "2026-07-20T01:00:00.000Z",
      source: "external-observer",
      data: { observed: true },
    }));
  });
  return {
    definicao,
    plano: planejamento.plano,
    bundle: {
      schemaVersion: "1.0",
      runId: "run.evidence.1",
      systemId: definicao.systemId,
      definitionDigest: planejamento.plano.definitionDigest,
      planDigest: planejamento.plano.planDigest,
      observations,
    },
  };
}

test("todos os adapters canonicos satisfazem seu descriptor seguro", () => {
  for (const adapter of CATALOGO_ADAPTADORES_INTERATIVOS) {
    const resultado = validarAdaptadorSistemaInterativo(adapter);
    assert.equal(resultado.valido, true, `${adapter.adapterId}: ${resultado.bloqueios.join(",")}`);
    assert.equal(adapter.executionBoundary, "EXTERNAL");
    assert.equal(adapter.readOnlyProbe, true);
    assert.ok(adapter.protocol.includes("DETECT"));
    assert.ok(adapter.protocol.includes("PROBE"));
    assert.ok(adapter.protocol.includes("SNAPSHOT"));
    assert.ok(adapter.protocol.includes("PLAN"));
    assert.ok(adapter.protocol.includes("VALIDATE"));
    assert.ok(adapter.protocol.includes("EVIDENCE"));
  }
});

test("protocolo exige todas as fases base e tipos estritos", () => {
  const semSnapshot = registroProtocolo(
    "runtime.headless.generic",
    FASES_LEITURA.filter((item) => item.phase !== "SNAPSHOT"),
    false,
    true,
  );
  assert.ok(validarProtocoloAdapterSistemaInterativo(semSnapshot).bloqueios.includes(
    "protocolo_fase_base_ausente:SNAPSHOT",
  ));

  const malformado = {
    ...registroProtocolo("runtime.headless.generic", FASES_LEITURA, false, true),
    phases: { nao: "e-lista" },
    mutated: "false",
    success: 1,
  } as unknown as RegistroProtocoloAdapter;
  assert.doesNotThrow(() => validarProtocoloAdapterSistemaInterativo(malformado));
  const resultado = validarProtocoloAdapterSistemaInterativo(malformado);
  assert.ok(resultado.bloqueios.includes("phases_ausentes_ou_malformadas"));
  assert.ok(resultado.bloqueios.includes("mutated_deve_ser_booleano"));
  assert.ok(resultado.bloqueios.includes("success_deve_ser_booleano"));
});

test("registro fica vinculado ao adapter, versao e permissao de mutacao", () => {
  const versaoErrada = {
    ...registroProtocolo("runtime.headless.generic", FASES_LEITURA, false, true),
    adapterVersion: "1.0.1",
  };
  assert.ok(validarProtocoloAdapterSistemaInterativo(versaoErrada).bloqueios.includes(
    "registro_adapter_version_divergente",
  ));

  const leituraMutante = registroProtocolo("runtime.headless.generic", [
    ...FASES_LEITURA.slice(0, 4),
    { phase: "APPLY", success: true },
    ...FASES_LEITURA.slice(4),
    { phase: "ROLLBACK", success: true },
  ], true, false, "evidence.rollback.1");
  const resultado = validarProtocoloAdapterSistemaInterativo(leituraMutante);
  assert.ok(resultado.bloqueios.includes("adapter_read_only_nao_pode_mutar"));
  assert.ok(resultado.bloqueios.some((item) => item.startsWith("phase_nao_permitida_pelo_adapter_indice:")));
});

test("falha mutante exige rollback observado", () => {
  const fasesFalha = [
    ...FASES_LEITURA.slice(0, 4),
    { phase: "APPLY", success: true },
    { phase: "VALIDATE", success: false },
    { phase: "EVIDENCE", success: true },
  ] as const;
  const semRollback = validarProtocoloAdapterSistemaInterativo(registroProtocolo(
    "engine.godot", fasesFalha, true, false,
  ));
  assert.equal(semRollback.exigeRollback, true);
  assert.ok(semRollback.bloqueios.includes("falha_mutante_exige_rollback"));

  const comRollback = validarProtocoloAdapterSistemaInterativo(registroProtocolo(
    "engine.godot",
    [...fasesFalha, { phase: "ROLLBACK", success: true }],
    true,
    false,
    "evidence.rollback.1",
  ));
  assert.equal(comRollback.valido, true, comRollback.bloqueios.join(","));
  assert.equal(comRollback.exigeRollback, false);
});

test("bundle completo deriva conclusao estrutural sem fabricar conclusao operacional", () => {
  const { definicao, plano, bundle } = bundleCompleto();
  const validacao = validarBundleEvidenciasSistemaInterativo(definicao, plano, bundle);
  assert.equal(validacao.valido, true, [...validacao.bloqueios, ...validacao.evidenciasAusentes].join(","));
  const estado = derivarEstadoSistemaInterativo(definicao, plano, bundle);
  assert.equal(estado.status, "STRUCTURALLY_COMPLETE");
  assert.equal(estado.completed, false);
  assert.equal(estado.localCoverageComplete, true);
  assert.equal(estado.awaitingExternalAttestation, true);
  assert.equal(estado.completionScope, "STRUCTURAL_LOCAL");
  assert.equal(estado.authoritative, false);
});

test("observacao exige dados e produtor selecionado com versao exata", () => {
  const { definicao, plano, bundle } = bundleCompleto();
  const semDados = {
    ...bundle,
    observations: bundle.observations.map((item, indice) => indice === 0 ? { ...item, data: {} } : item),
  };
  assert.ok(validarBundleEvidenciasSistemaInterativo(definicao, plano, semDados).bloqueios.includes(
    "evidence_data_invalida_ou_vazia_indice:0",
  ));

  const produtorErrado = {
    ...bundle,
    observations: bundle.observations.map((item, indice) => indice === 0 ? {
      ...item,
      producerAdapterId: "telemetry.trace.local",
      producerAdapterVersion: "1.0.0",
    } : item),
  };
  assert.ok(validarBundleEvidenciasSistemaInterativo(definicao, plano, produtorErrado).bloqueios.includes(
    "producer_adapter_nao_selecionado_para_stage_indice:0",
  ));

  const versaoErrada = {
    ...bundle,
    observations: bundle.observations.map((item, indice) => indice === 0 ? {
      ...item,
      producerAdapterVersion: "9.9.9",
    } : item),
  };
  assert.ok(validarBundleEvidenciasSistemaInterativo(definicao, plano, versaoErrada).bloqueios.includes(
    "producer_adapter_version_divergente_indice:0",
  ));
});

test("plano falso nao consegue apagar exigencias canonicas", () => {
  const { definicao, plano, bundle } = bundleCompleto();
  const semDigest = {
    ...plano,
    capabilitiesRequeridas: [],
    capabilitiesAusentes: [],
    pipelines: [],
    adaptersCompativeis: [],
    adaptersSelecionados: [],
    capabilitiesSemAdapter: [],
    stageProviderMap: [],
    stages: [],
    nextActions: [],
  };
  const { planDigest: _digest, ...conteudo } = semDigest;
  const planoFalso = { ...conteudo, planDigest: digestJsonSistemaInterativo(conteudo) } as PlanoSistemaInterativo;
  const bundleFalso = { ...bundle, planDigest: planoFalso.planDigest, observations: [] };
  const validacao = validarBundleEvidenciasSistemaInterativo(definicao, planoFalso, bundleFalso);
  assert.equal(validacao.valido, false);
  assert.ok(validacao.bloqueios.includes("plano_plan_digest_divergente"));
  assert.ok(validacao.evidenciasAusentes.length > 0);
  assert.equal(derivarEstadoSistemaInterativo(definicao, planoFalso, bundleFalso).status, "INVALID");
});

test("gap de selecao e BLOCKED; bundle vazio de plano pronto e PLANNED", () => {
  const definicaoSemAdapter = simulacaoMinima([]);
  const planoSemAdapter = planejarSistemaInterativo(definicaoSemAdapter).plano;
  const estadoBloqueado = derivarEstadoSistemaInterativo(
    definicaoSemAdapter,
    planoSemAdapter,
    bundleVazioSistemaInterativo(definicaoSemAdapter, planoSemAdapter, "run.blocked.1"),
  );
  assert.equal(estadoBloqueado.status, "BLOCKED");
  assert.equal(estadoBloqueado.completed, false);

  const { definicao, plano } = bundleCompleto();
  const estadoPlanejado = derivarEstadoSistemaInterativo(
    definicao,
    plano,
    bundleVazioSistemaInterativo(definicao, plano, "run.planned.1"),
  );
  assert.equal(estadoPlanejado.status, "PLANNED");
  assert.equal(estadoPlanejado.localCoverageComplete, false);
});

test("chaves e valores sensiveis sao bloqueados sem eco", () => {
  const segredoApi = "sk_proibido_123456789012345";
  const adapterBase = CATALOGO_ADAPTADORES_INTERATIVOS[0]!;
  const adapterMalicioso = { ...adapterBase, apiKey: segredoApi } as unknown as typeof adapterBase;
  const resultadoAdapter = validarAdaptadorSistemaInterativo(adapterMalicioso);
  assert.ok(resultadoAdapter.bloqueios.includes("adapter_contem_dado_sensivel"));
  assert.doesNotMatch(JSON.stringify(resultadoAdapter), new RegExp(segredoApi));

  const registroBase = registroProtocolo("runtime.headless.generic", FASES_LEITURA, false, true);
  const registroMalicioso = { ...registroBase, privateKey: segredoApi } as unknown as RegistroProtocoloAdapter;
  const resultadoProtocolo = validarProtocoloAdapterSistemaInterativo(registroMalicioso);
  assert.ok(resultadoProtocolo.bloqueios.includes("registro_contem_dado_sensivel"));
  assert.doesNotMatch(JSON.stringify(resultadoProtocolo), new RegExp(segredoApi));

  const { definicao, plano, bundle } = bundleCompleto();
  const bundleMalicioso = {
    ...bundle,
    observations: bundle.observations.map((item, indice) => indice === 0
      ? { ...item, data: { accessToken: segredoApi } }
      : item),
  };
  const resultadoEvidencia = validarBundleEvidenciasSistemaInterativo(definicao, plano, bundleMalicioso);
  assert.ok(resultadoEvidencia.bloqueios.includes("evidence_contem_dado_sensivel_indice:0"));
  assert.doesNotMatch(JSON.stringify(resultadoEvidencia), new RegExp(segredoApi));
});

test("valores controlados maliciosos nunca reaparecem nos resultados", () => {
  const caminho = "C:\\private\\operator\\secret.txt";
  const bearer = "Bearer abcdefghijklmnopqrstuvwxyz";
  const chave = "sk_proibido_abcdefghijklmnop";

  const definicao = { ...simulacaoMinima(), systemId: caminho };
  const validacao = validarDefinicaoSistemaInterativo(definicao);
  const planejamento = planejarSistemaInterativo(definicao);
  assert.ok(validacao.bloqueios.includes("system_id_invalido"));
  for (const valor of [caminho, bearer, chave]) {
    assert.doesNotMatch(JSON.stringify({ validacao, planejamento }), new RegExp(valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const registro = registroProtocolo("runtime.headless.generic", FASES_LEITURA, false, true);
  const protocoloMalicioso = {
    ...registro,
    semanticTargetId: bearer,
    phases: registro.phases.map((item, indice) => indice === 0
      ? { ...item, phaseId: caminho, phase: chave as FaseProtocoloAdaptador, semanticTargetId: bearer }
      : { ...item, semanticTargetId: bearer }),
  };
  const resultado = validarProtocoloAdapterSistemaInterativo(protocoloMalicioso);
  const serializado = JSON.stringify(resultado);
  for (const valor of [caminho, bearer, chave]) {
    assert.equal(serializado.includes(valor), false);
  }
});
