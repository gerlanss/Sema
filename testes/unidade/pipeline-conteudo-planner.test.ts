// SEMA-GOVERNED: sema.produto.pipeline_conteudo + sema.produto.pipeline_conteudo.adaptadores
// Descricao: valida DAG, isolamento multialvo e planejamento declarativo do pipeline AI-native.

import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPABILITIES_CONTEUDO_PADRAO,
  avaliarConstraintsDeterministicasConteudo,
  escopoAutorizacaoAlvo,
  escopoAutorizacaoGlobal,
  planejarAlvosConteudo,
  validarAdaptadorConteudo,
  validarMetadataPublicaConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/adapters.js";
import { canonicalizarJson } from "../../pacotes/cli/src/pipelineConteudo/canonical.js";
import {
  planejarPipelineConteudo,
  validarDefinicaoPipelineConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/planner.js";
import type {
  AdaptadorConteudo,
  AlvoConteudo,
  ArtefatoConteudo,
  DefinicaoPipelineConteudo,
  RestricaoDeterministicaConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/types.js";

function criarAdapter(
  adapterId: string,
  formatProfileId: string,
  mediaType: string,
  capability: string,
): AdaptadorConteudo {
  return {
    adapterId,
    version: "2026.1",
    capabilities: [capability],
    acceptedMediaTypes: [mediaType],
    formatProfiles: [formatProfileId],
    deterministicConstraints: [
      { constraintId: "payload-limit", kind: "artifact.bytes.max", config: { limit: 100_000 } },
    ],
    requiredMetadata: ["destinationLabel"],
    optionalMetadata: ["publicNote"],
    confirmationPredicates: ["external.attestation.signature_valid"],
  };
}

const adapterTexto = criarAdapter("destination-alpha", "longform-copy", "text/markdown", "delivery.future-text");
const adapterAudio = criarAdapter("destination-beta", "episodic-audio", "audio/ogg", "delivery.future-audio");

const alvos: readonly AlvoConteudo[] = [
  {
    targetId: "target-alpha",
    adapterId: adapterTexto.adapterId,
    accountScope: "account:alpha",
    formatProfileId: adapterTexto.formatProfiles[0],
    locale: "pt-BR",
    metadata: { destinationLabel: "Destino textual" },
  },
  {
    targetId: "target-beta",
    adapterId: adapterAudio.adapterId,
    accountScope: "account:beta",
    formatProfileId: adapterAudio.formatProfiles[0],
    locale: "pt-BR",
    metadata: { destinationLabel: "Destino sonoro" },
  },
];

function criarDefinicao(): DefinicaoPipelineConteudo {
  return {
    schemaVersion: "1.0",
    pipelineId: "content-pipeline-fixture",
    version: "1.0.0",
    stages: [
      {
        stageId: "topic",
        capability: CAPABILITIES_CONTEUDO_PADRAO[0],
        scope: "GLOBAL",
        adapterPolicy: "NONE",
        dependsOn: [],
        produces: ["topic-brief"],
        gateIds: [],
      },
      {
        stageId: "master",
        capability: CAPABILITIES_CONTEUDO_PADRAO[2],
        scope: "GLOBAL",
        adapterPolicy: "NONE",
        dependsOn: ["topic"],
        produces: ["master-content"],
        gateIds: ["master-quality"],
      },
      {
        stageId: "adapt",
        capability: "content.target.brand-new-capability",
        scope: "POR_ALVO",
        adapterPolicy: "NONE",
        dependsOn: ["master"],
        produces: ["target-content"],
        gateIds: [],
      },
      {
        stageId: "quality",
        capability: CAPABILITIES_CONTEUDO_PADRAO[5],
        scope: "POR_ALVO",
        adapterPolicy: "NONE",
        dependsOn: ["adapt"],
        produces: ["quality-result"],
        gateIds: ["target-quality"],
      },
      {
        stageId: "aggregate",
        capability: "content.results.aggregate",
        scope: "GLOBAL",
        adapterPolicy: "NONE",
        dependsOn: ["quality"],
        produces: ["aggregate-result"],
        gateIds: [],
      },
    ],
    gates: [
      {
        gateId: "master-quality",
        stageId: "master",
        scope: "GLOBAL",
        evaluationMode: "IA_ESPECIALIZADA",
        requiredEvidence: ["artifact.digest"],
        evaluatorCapabilities: ["content.master.evaluate"],
        minAttestationsPerEvidence: 1,
        minDistinctAttesterControlDomains: 1,
        minApprovals: 2,
        minDistinctControlDomains: 2,
        producerDisjoint: true,
        rejectionIsBinding: true,
        rubricDigest: "sha256:master-rubric",
      },
      {
        gateId: "target-quality",
        stageId: "quality",
        scope: "POR_ALVO",
        evaluationMode: "HIBRIDA",
        requiredEvidence: ["artifact.digest", "constraint.report"],
        evaluatorCapabilities: ["content.target.evaluate"],
        minAttestationsPerEvidence: 1,
        minDistinctAttesterControlDomains: 1,
        minApprovals: 2,
        minDistinctControlDomains: 2,
        producerDisjoint: true,
        rejectionIsBinding: true,
        rubricDigest: "sha256:target-rubric",
      },
    ],
    adapters: [adapterTexto, adapterAudio],
    requiredCompletionGates: ["master-quality", "target-quality"],
  };
}

test("adaptador aberto aceita capability e destino arbitrarios, mas exige versao fixa", () => {
  const resultado = validarAdaptadorConteudo(adapterTexto);
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.bloqueios, []);

  const comCapabilityNova = validarAdaptadorConteudo({
    ...adapterTexto,
    capabilities: ["capability.never-seen-before"],
  });
  assert.equal(comCapabilityNova.valido, true);

  const versaoFlutuante = validarAdaptadorConteudo({ ...adapterTexto, version: "latest" });
  assert.equal(versaoFlutuante.valido, false);
  assert.ok(versaoFlutuante.bloqueios.includes("adapter_version_nao_fixada"));
});

test("planejamento de adaptacoes isola targetId, accountScope, formato e linhagem", () => {
  const masterArtifacts = [{ artifactId: "master-1", digest: "sha256:abc" }];
  const resultado = planejarAlvosConteudo(alvos, [adapterTexto, adapterAudio], masterArtifacts);

  assert.deepEqual(resultado.bloqueiosPorAlvo, []);
  assert.equal(resultado.planosAdaptacao.length, 2);
  assert.notEqual(resultado.planosAdaptacao[0].isolationKey, resultado.planosAdaptacao[1].isolationKey);
  assert.deepEqual(
    resultado.planosAdaptacao.map((plano) => [plano.targetId, plano.accountScope, plano.formatProfileId]),
    [
      ["target-alpha", "account:alpha", "longform-copy"],
      ["target-beta", "account:beta", "episodic-audio"],
    ],
  );
  assert.deepEqual(resultado.planosAdaptacao[0].masterArtifacts, masterArtifacts);
  assert.notEqual(resultado.planosAdaptacao[0].masterArtifacts, masterArtifacts);
});

test("escopo de autorizacao vincula run, target e conta sem colisoes", () => {
  const alvoOutraConta: AlvoConteudo = { ...alvos[0], accountScope: "account:gamma" };
  const escopoAlpha = escopoAutorizacaoAlvo("run:one", alvos[0]);
  const escopoGamma = escopoAutorizacaoAlvo("run:one", alvoOutraConta);

  assert.equal(
    escopoAlpha,
    "run:run%3Aone:target:target-alpha:account:account%3Aalpha",
  );
  assert.equal(escopoAutorizacaoAlvo("run:one", alvos[0]), escopoAlpha);
  assert.notEqual(escopoGamma, escopoAlpha);
  assert.notEqual(escopoAutorizacaoAlvo("run:two", alvos[0]), escopoAlpha);
  assert.equal(escopoAutorizacaoGlobal("run:one"), "run:run%3Aone:global");

  const alvoComSeparadoresA: AlvoConteudo = {
    ...alvos[0],
    targetId: "a:account:b",
    accountScope: "account:c",
  };
  const alvoComSeparadoresB: AlvoConteudo = {
    ...alvos[0],
    targetId: "a",
    accountScope: "account:b.account.c",
  };
  assert.notEqual(
    escopoAutorizacaoAlvo("run:one", alvoComSeparadoresA),
    escopoAutorizacaoAlvo("run:one", alvoComSeparadoresB),
  );
  assert.throws(
    () => escopoAutorizacaoAlvo("run:one", { ...alvos[0], accountScope: "sk-live-nao-e-referencia" }),
    /escopo_autorizacao_alvo_invalido/u,
  );
});

test("constraints deterministicas suportadas aprovam observacoes e geram digests vinculados", () => {
  const artefato: ArtefatoConteudo = {
    artifactId: "artifact-alpha",
    runId: "run-alpha",
    stageId: "quality",
    targetId: "target-alpha",
    artifactType: "target-content",
    mediaType: "application/octet-stream",
    digest: "sha256:artifact-alpha",
    lineageDigests: ["sha256:master"],
    metadata: { artifactBytes: 1_024, mediaDuration: 42, textLength: 500 },
  };
  const constraints: readonly RestricaoDeterministicaConteudo[] = [
    { constraintId: "bytes-min", kind: "artifact.bytes.min", config: { value: 100 } },
    { constraintId: "bytes-max", kind: "artifact.bytes.max", config: { value: 2_000 } },
    { constraintId: "duration-min", kind: "media.duration.min", config: { value: 30 } },
    { constraintId: "duration-max", kind: "media.duration.max", config: { value: 60 } },
    { constraintId: "text-min", kind: "text.length.min", config: { value: 400 } },
    { constraintId: "text-max", kind: "text.length.max", config: { value: 600 } },
  ];

  const observacoes = { artifactBytes: 1_024, mediaDuration: 42, textLength: 500 };
  const resultado = avaliarConstraintsDeterministicasConteudo(artefato, constraints, observacoes);
  const repetido = avaliarConstraintsDeterministicasConteudo(artefato, constraints, observacoes);
  assert.equal(resultado.valido, true);
  assert.equal(resultado.resultados.length, 6);
  assert.ok(resultado.resultados.every((item) => item.passed));
  assert.match(resultado.constraintsDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(resultado.resultsDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(repetido.constraintsDigest, resultado.constraintsDigest);
  assert.equal(repetido.resultsDigest, resultado.resultsDigest);

  const outroArtefato = avaliarConstraintsDeterministicasConteudo(
    { ...artefato, digest: "sha256:artifact-beta" },
    constraints,
    observacoes,
  );
  assert.equal(outroArtefato.constraintsDigest, resultado.constraintsDigest);
  assert.notEqual(outroArtefato.resultsDigest, resultado.resultsDigest);

  const apenasDeclaracaoDoProdutor = avaliarConstraintsDeterministicasConteudo(artefato, constraints);
  assert.equal(apenasDeclaracaoDoProdutor.valido, false);
  assert.ok(apenasDeclaracaoDoProdutor.bloqueios.includes("constraint_observacao_ausente:bytes-min"));
});

test("constraint desconhecida ou nao satisfeita bloqueia em vez de aprovar", () => {
  const artefato: ArtefatoConteudo = {
    artifactId: "artifact-beta",
    runId: "run-beta",
    stageId: "quality",
    artifactType: "target-content",
    mediaType: "text/plain",
    digest: "sha256:artifact-beta",
    lineageDigests: [],
  };
  const constraints: readonly RestricaoDeterministicaConteudo[] = [
    { constraintId: "text-too-long", kind: "text.length.max", config: { value: 3 } },
    { constraintId: "unknown", kind: "custom.opaque.constraint", config: { value: 1 } },
  ];
  const resultado = avaliarConstraintsDeterministicasConteudo(
    artefato,
    constraints,
    { textLength: 10 },
  );

  assert.equal(resultado.valido, false);
  assert.ok(resultado.bloqueios.includes("constraint_nao_satisfeita:text-too-long"));
  assert.ok(resultado.bloqueios.includes("constraint_kind_nao_suportado:unknown:custom.opaque.constraint"));
  assert.equal(resultado.resultados[1].passed, false);

  const adapterDesconhecido = validarAdaptadorConteudo({
    ...adapterTexto,
    deterministicConstraints: [constraints[1]],
  });
  assert.equal(adapterDesconhecido.valido, false);
  assert.ok(adapterDesconhecido.bloqueios.some((item) => item.includes("constraint_kind_nao_suportado")));
});

test("definicao valida IDs, referencias, gates e DAG aciclico", () => {
  const valida = validarDefinicaoPipelineConteudo(criarDefinicao());
  assert.equal(valida.valida, true);
  assert.match(valida.definitionDigest, /^sha256:[a-f0-9]{64}$/);

  const base = criarDefinicao();
  const ciclica: DefinicaoPipelineConteudo = {
    ...base,
    stages: base.stages.map((stage) =>
      stage.stageId === "topic" ? { ...stage, dependsOn: ["aggregate"] } : stage,
    ),
  };
  const invalida = validarDefinicaoPipelineConteudo(ciclica);
  assert.equal(invalida.valida, false);
  assert.ok(invalida.bloqueios.some((bloqueio) => bloqueio.startsWith("stage_graph_ciclico:")));

  const autoAprovavel: DefinicaoPipelineConteudo = {
    ...base,
    gates: base.gates.map((gate) =>
      gate.gateId === base.requiredCompletionGates[0] ? { ...gate, producerDisjoint: false } : gate,
    ),
  };
  const semSeparacao = validarDefinicaoPipelineConteudo(autoAprovavel);
  assert.equal(semSeparacao.valida, false);
  assert.ok(semSeparacao.bloqueios.some((item) => item.startsWith("completion_gate_exige_produtor_disjunto:")));
});

test("plano instancia GLOBAL uma vez, POR_ALVO por target e preserva dependencias por escopo", () => {
  const resultado = planejarPipelineConteudo(criarDefinicao(), alvos);
  assert.deepEqual(resultado.bloqueios, []);

  const { plano } = resultado;
  assert.equal(plano.stageInstances.length, 7);
  assert.equal(plano.artifactSlots.length, 7);
  assert.equal(plano.gateInstances.length, 3);
  assert.deepEqual(plano.targetIds, ["target-alpha", "target-beta"]);

  const globals = plano.stageInstances.filter((stage) => stage.targetId === undefined);
  assert.deepEqual(globals.map((stage) => stage.stageId), ["topic", "master", "aggregate"]);

  const adaptAlpha = plano.stageInstances.find(
    (stage) => stage.stageId === "adapt" && stage.targetId === "target-alpha",
  );
  const qualityAlpha = plano.stageInstances.find(
    (stage) => stage.stageId === "quality" && stage.targetId === "target-alpha",
  );
  const aggregate = plano.stageInstances.find((stage) => stage.stageId === "aggregate");
  assert.deepEqual(adaptAlpha?.dependsOn, ["stage/master/global"]);
  assert.deepEqual(qualityAlpha?.dependsOn, ["stage/adapt/target/target-alpha"]);
  assert.deepEqual(aggregate?.dependsOn, [
    "stage/quality/target/target-alpha",
    "stage/quality/target/target-beta",
  ]);

  assert.deepEqual(plano.nextActions, ["runner_externo.executar_etapa:stage/topic/global"]);
  assert.ok(plano.nextActions.every((acao) => acao.startsWith("runner_externo.executar_etapa:")));

  const planoSerializado = JSON.stringify(plano).toLowerCase();
  for (const literalProibido of ["youtube", "instagram", "engrenagem"]) {
    assert.equal(planoSerializado.includes(literalProibido), false);
  }
});

test("alvo com perfil inexistente ou targetId repetido fica bloqueado sem plano parcial", () => {
  const alvoInvalido: AlvoConteudo = { ...alvos[0], formatProfileId: "unknown-format" };
  const resultadoPerfil = planejarPipelineConteudo(criarDefinicao(), [alvoInvalido]);
  assert.equal(resultadoPerfil.plano.stageInstances.length, 0);
  assert.ok(resultadoPerfil.bloqueios.some((item) => item.includes("format_profile_nao_declarado_no_adapter")));

  const resultadoDuplicado = planejarPipelineConteudo(criarDefinicao(), [alvos[0], alvos[0]]);
  assert.equal(resultadoDuplicado.plano.stageInstances.length, 0);
  assert.ok(resultadoDuplicado.bloqueios.some((item) => item.includes("target_id_duplicado")));

  const segredo = "SECRET-NAO-PODE-VAZAR";
  for (const campo of ["api_token", "aws_secret_access_key", "sessionCookie"]) {
    const resultadoSegredo = planejarPipelineConteudo(criarDefinicao(), [{
      ...alvos[0],
      metadata: { destinationLabel: "Destino", [campo]: segredo },
    }]);
    assert.equal(resultadoSegredo.plano.stageInstances.length, 0);
    assert.ok(resultadoSegredo.bloqueios.some((item) => item.includes("chave_sensivel_em_metadata")));
    const diagnostico = JSON.stringify(resultadoSegredo);
    assert.equal(diagnostico.includes(campo), false);
    assert.equal(diagnostico.includes(segredo), false);
  }

  const resultadoAninhado = planejarPipelineConteudo(criarDefinicao(), [{
    ...alvos[0],
    metadata: { destinationLabel: "Destino", nested: { public: true } } as unknown as AlvoConteudo["metadata"],
  }]);
  assert.ok(resultadoAninhado.bloqueios.some((item) => item.includes("metadata_valor_nao_escalar")));
  assert.equal(JSON.stringify(resultadoAninhado).includes("nested"), false);

  const resultadoExtra = planejarPipelineConteudo(criarDefinicao(), [{
    ...alvos[0],
    metadata: { destinationLabel: "Destino", undeclared: "publico" },
  }]);
  assert.ok(resultadoExtra.bloqueios.some((item) => item.includes("metadata_nao_declarado_no_adapter")));
  assert.equal(JSON.stringify(resultadoExtra).includes("undeclared"), false);

  const adapterComSegredo = validarAdaptadorConteudo({
    ...adapterTexto,
    requiredMetadata: ["apiKey"],
  });
  assert.equal(adapterComSegredo.valido, false);
  assert.ok(adapterComSegredo.bloqueios.includes("adapter_required_metadata_sensivel"));
  assert.equal(JSON.stringify(adapterComSegredo).includes("apiKey"), false);

  const adapterSobreposto = validarAdaptadorConteudo({
    ...adapterTexto,
    optionalMetadata: ["destinationLabel"],
  });
  assert.equal(adapterSobreposto.valido, false);
  assert.ok(adapterSobreposto.bloqueios.includes("adapter_metadata_required_optional_sobreposta"));
});

test("diagnosticos DLP e de canonicalizacao nao ecoam chave, caminho nem valor sensivel", () => {
  const chaveToken = `ghp_${"A".repeat(40)}`;
  const valorJwt = `eyJ${"a".repeat(16)}.${"b".repeat(16)}.${"c".repeat(16)}`;
  const bloqueios = validarMetadataPublicaConteudo({
    [chaveToken]: { sessionCookie: valorJwt },
  });
  const diagnostico = JSON.stringify(bloqueios);
  assert.ok(bloqueios.includes("chave_sensivel_em_metadata"));
  assert.ok(bloqueios.includes("valor_sensivel_em_metadata"));
  assert.equal(diagnostico.includes(chaveToken), false);
  assert.equal(diagnostico.includes("sessionCookie"), false);
  assert.equal(diagnostico.includes(valorJwt), false);

  const segredoConstraint = `ghp_${"C".repeat(40)}`;
  const adapterComConfigSensivel: AdaptadorConteudo = {
    ...adapterTexto,
    deterministicConstraints: [{
      constraintId: "constraint-segura",
      kind: "artifact.bytes.min",
      config: { minimum: 1, api_token: segredoConstraint },
    }],
  };
  const validacaoConfigSensivel = validarAdaptadorConteudo(adapterComConfigSensivel);
  assert.equal(validacaoConfigSensivel.valido, false);
  assert.ok(validacaoConfigSensivel.bloqueios.includes("adapter_constraint_config_sensivel"));
  assert.equal(JSON.stringify(validacaoConfigSensivel).includes(segredoConstraint), false);
  const planoConfigSensivel = planejarAlvosConteudo([alvos[0]], [adapterComConfigSensivel], []);
  assert.equal(planoConfigSensivel.planosAdaptacao.length, 0);
  assert.equal(JSON.stringify(planoConfigSensivel).includes(segredoConstraint), false);

  const configComCampoExtra = validarAdaptadorConteudo({
    ...adapterTexto,
    deterministicConstraints: [{
      constraintId: "constraint-campo-extra",
      kind: "artifact.bytes.min",
      config: { minimum: 1, unidade: "bytes" },
    }],
  });
  assert.ok(configComCampoExtra.bloqueios.includes("adapter_constraint_config_campos_invalidos"));

  const configAmbigua = validarAdaptadorConteudo({
    ...adapterTexto,
    deterministicConstraints: [{
      constraintId: "constraint-ambigua",
      kind: "artifact.bytes.min",
      config: { value: 1, minimum: 1 },
    }],
  });
  assert.ok(configAmbigua.bloqueios.includes("adapter_constraint_config_campos_invalidos"));

  const chaveSecreta = `xoxb-${"Z".repeat(24)}`;
  assert.throws(
    () => canonicalizarJson({ [chaveSecreta]: Number.NaN }),
    (erro: unknown) => {
      assert.ok(erro instanceof TypeError);
      assert.equal(erro.message, "json_canonico_invalido:numero_nao_finito");
      assert.equal(erro.message.includes(chaveSecreta), false);
      return true;
    },
  );
});
