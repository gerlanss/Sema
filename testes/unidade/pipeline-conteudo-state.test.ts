// SEMA-GOVERNED: sema.produto.pipeline_conteudo.ledger + sema.produto.pipeline_conteudo.estado
// Descricao: regressao adversarial do ledger, replay canonico, escopos, linhagem e projecao.

import assert from "node:assert/strict";
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import test from "node:test";
import {
  avaliarConstraintsDeterministicasConteudo,
  escopoAutorizacaoAlvo,
} from "../../pacotes/cli/src/pipelineConteudo/adapters.js";
import { assinarEnvelopeConteudo, hashCanonicoConteudo } from "../../pacotes/cli/src/pipelineConteudo/canonical.js";
import {
  anexarEventoLedgerConteudo,
  calcularHashEventoLedgerConteudo,
  HEAD_GENESIS_LEDGER_CONTEUDO,
  validarLedgerConteudo,
  validarPayloadEventoConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/ledger.js";
import { validarDefinicaoPipelineConteudo } from "../../pacotes/cli/src/pipelineConteudo/planner.js";
import { projetarManifestoPipelineConteudo } from "../../pacotes/cli/src/pipelineConteudo/projection.js";
import { derivarEstadoPipelineConteudo } from "../../pacotes/cli/src/pipelineConteudo/state.js";
import {
  digestConfiguracaoConfiancaConteudo,
  digestRevogacoesConfiancaConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/trust.js";
import type {
  AlvoConteudo,
  ArtefatoConteudo,
  AtestadoEvidenciaConteudo,
  ConfiguracaoConfiancaConteudo,
  DefinicaoPipelineConteudo,
  EnvelopeAssinadoConteudo,
  EventoLedgerConteudo,
  EventoPayloadConteudo,
  InicioExecucaoConteudo,
  ParecerIAConteudo,
  PoliticaConfiancaConteudo,
  PrincipalConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/types.js";

const TRUST_DOMAIN = "trust-content";
const RUBRICA = `sha256:${"1".repeat(64)}`;

interface IdentidadeTeste {
  readonly principal: PrincipalConteudo;
  readonly privateKey: KeyObject;
}

function identidade(
  principalId: string,
  controlDomain: string,
  papeis: readonly string[],
  capabilities: readonly string[] = [],
  scopes: readonly string[] = [],
): IdentidadeTeste {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKey,
    principal: {
      principalId,
      keyId: `key-${principalId}`,
      controlDomain,
      papeis,
      capabilities,
      scopes,
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    },
  };
}

const autoridadePolitica = identidade(
  "policy-authority",
  "policy-authority-domain",
  ["POLICY_AUTHORITY"],
);

const alvoArtigo: AlvoConteudo = {
  targetId: "site-artigo",
  adapterId: "destination-generic",
  accountScope: "account:publicacao-editorial",
  formatProfileId: "conteudo",
  locale: "pt-BR",
  metadata: {},
};

const alvoAudio: AlvoConteudo = {
  targetId: "feed-audio",
  adapterId: "destination-generic",
  accountScope: "account:podcast-principal",
  formatProfileId: "conteudo",
  locale: "pt-BR",
  metadata: {},
};

function definicaoUmaEtapa(): DefinicaoPipelineConteudo {
  return {
    schemaVersion: "sema.content.pipeline/v1",
    pipelineId: "pipeline-state-test",
    version: "1.0.0",
    stages: [{
      stageId: "adaptacao",
      capability: "content.target.compose",
      scope: "POR_ALVO",
      adapterPolicy: "NONE",
      dependsOn: [],
      produces: ["conteudo-adaptado"],
      gateIds: ["qa-final"],
    }],
    gates: [{
      gateId: "qa-final",
      stageId: "adaptacao",
      scope: "POR_ALVO",
      evaluationMode: "HIBRIDA",
      requiredEvidence: ["artefato_integro"],
      evaluatorCapabilities: ["avaliar_qualidade"],
      minAttestationsPerEvidence: 1,
      minDistinctAttesterControlDomains: 1,
      minApprovals: 1,
      minDistinctControlDomains: 1,
      producerDisjoint: true,
      rejectionIsBinding: true,
      rubricDigest: RUBRICA,
    }],
    adapters: [{
      adapterId: "destination-generic",
      version: "1.0.0",
      capabilities: ["content.target.deliver"],
      acceptedMediaTypes: ["text/markdown", "audio/mpeg"],
      formatProfiles: ["conteudo"],
      deterministicConstraints: [{
        constraintId: "non-empty",
        kind: "artifact.bytes.min",
        config: { minimum: 1 },
      }],
      requiredMetadata: [],
      optionalMetadata: [],
      confirmationPredicates: ["destination.delivery.observed"],
    }],
    requiredCompletionGates: ["qa-final"],
  };
}

function politicaDaDefinicao(
  definicao: DefinicaoPipelineConteudo,
  ledgerId: string,
  trustRootDigest: string,
  runId: string,
  targets: readonly AlvoConteudo[] = [alvoArtigo],
): PoliticaConfiancaConteudo {
  const validacao = validarDefinicaoPipelineConteudo(definicao);
  assert.equal(validacao.valida, true, validacao.bloqueios.join(","));
  const issuedAt = new Date().toISOString();
  return {
    policyId: "policy-content",
    version: "1.0.0",
    runId,
    trustDomainId: TRUST_DOMAIN,
    trustRootDigest,
    definitionDigest: validacao.definitionDigest,
    targetSetDigest: hashCanonicoConteudo(targets),
    ledgerId,
    gates: definicao.gates,
    issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + 5 * 60 * 1000).toISOString(),
  };
}

function envelopeDaPolitica(
  politica: PoliticaConfiancaConteudo,
  autoridade: IdentidadeTeste,
): EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo> {
  return assinarEnvelopeConteudo({
    schemaVersion: "sema.content/v1",
    payloadType: "TRUST_POLICY",
    payload: politica,
    principalId: autoridade.principal.principalId,
    keyId: autoridade.principal.keyId,
    issuedAt: politica.issuedAt,
    nonce: `nonce-policy-${politica.ledgerId}`,
    signatureAlgorithm: "Ed25519",
  }, autoridade.privateKey);
}

function tipoEnvelope(payload: EventoPayloadConteudo): string {
  return payload.kind === "EVIDENCE_CLAIMED" ? "CLAIM_SUBMITTED" : payload.kind;
}

function confiancaDasIdentidades(
  identidades: readonly IdentidadeTeste[],
  revokedKeyIds: readonly string[] = [],
): ConfiguracaoConfiancaConteudo {
  const identidadesComAutoridade = identidades.some(
    (item) => item.principal.principalId === autoridadePolitica.principal.principalId,
  ) ? identidades : [autoridadePolitica, ...identidades];
  return {
    trustDomainId: TRUST_DOMAIN,
    principals: identidadesComAutoridade.map((item) => item.principal),
    revokedKeyIds,
    maxEnvelopeAgeMs: 60_000,
    maxFutureSkewMs: 1_000,
    schemaVersionsAceitas: ["sema.content/v1"],
  };
}

function fabricaLedger(
  ledgerId: string,
  identidades: readonly IdentidadeTeste[],
  envelopePolitica: EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo>,
  revokedKeyIds: readonly string[] = [],
) {
  const porId = new Map(identidades.map((item) => [item.principal.principalId, item]));
  const confianca = confiancaDasIdentidades(identidades, revokedKeyIds);
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confianca);
  const revocationDigest = digestRevogacoesConfiancaConteudo(confianca);
  let eventos: readonly EventoLedgerConteudo<EventoPayloadConteudo>[] = [];
  let contador = 0;

  function anexar<TPayload extends EventoPayloadConteudo>(
    payload: TPayload,
    principalId: string,
  ): EventoLedgerConteudo<TPayload> {
    const ator = porId.get(principalId);
    if (ator === undefined) throw new Error(`identidade_ausente:${principalId}`);
    const instante = new Date().toISOString();
    contador += 1;
    const envelope = assinarEnvelopeConteudo({
      schemaVersion: "sema.content/v1",
      payloadType: tipoEnvelope(payload),
      payload,
      principalId,
      keyId: ator.principal.keyId,
      issuedAt: instante,
      nonce: `nonce-${contador}`,
      signatureAlgorithm: "Ed25519",
    }, ator.privateKey);
    const resultado = anexarEventoLedgerConteudo(eventos, {
      ledgerId,
      expectedHead: eventos.at(-1)?.hash ?? HEAD_GENESIS_LEDGER_CONTEUDO,
      schemaVersion: "sema.content/v1",
      eventId: `event-${contador}`,
      recordedAt: instante,
      envelope,
      envelopePolitica,
      configuracaoConfianca: confianca,
      trustRootDigestEsperado: trustRootDigest,
      revocationDigestEsperado: revocationDigest,
    });
    eventos = resultado.eventos;
    return resultado.evento;
  }

  return {
    anexar,
    confianca,
    trustRootDigest,
    revocationDigest,
    envelopePolitica,
    eventos: () => eventos,
    head: () => eventos.at(-1)?.hash ?? HEAD_GENESIS_LEDGER_CONTEUDO,
  };
}

function contextoInicio(
  runId: string,
  politica: PoliticaConfiancaConteudo,
  targets: readonly AlvoConteudo[],
): InicioExecucaoConteudo {
  return {
    kind: "RUN_STARTED",
    runId,
    trustDomainId: politica.trustDomainId,
    trustRootDigest: politica.trustRootDigest,
    ledgerId: politica.ledgerId,
    policyDigest: hashCanonicoConteudo(politica),
    definitionDigest: politica.definitionDigest,
    targets,
    startedAt: "2026-07-19T12:00:00.000Z",
  };
}

function contextoAlvo(inicio: InicioExecucaoConteudo, alvo: AlvoConteudo) {
  return {
    runId: inicio.runId,
    trustDomainId: inicio.trustDomainId,
    trustRootDigest: inicio.trustRootDigest,
    ledgerId: inicio.ledgerId,
    policyDigest: inicio.policyDigest,
    definitionDigest: inicio.definitionDigest,
    authorizationScope: escopoAutorizacaoAlvo(inicio.runId, alvo),
  } as const;
}

function artefato(
  inicio: InicioExecucaoConteudo,
  alvo: AlvoConteudo,
  produtor: IdentidadeTeste,
  sufixo: string,
  mediaType = "text/markdown",
): ArtefatoConteudo {
  return {
    ...contextoAlvo(inicio, alvo),
    kind: "ARTIFACT_REGISTERED",
    artifactId: `artifact-${alvo.targetId}-${sufixo}`,
    stageId: "adaptacao",
    targetId: alvo.targetId,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    version: sufixo,
    artifactType: "conteudo-adaptado",
    mediaType,
    digest: `sha256:${sufixo.padEnd(64, sufixo[0] ?? "a").slice(0, 64)}`,
    lineageDigests: [],
  };
}

function aprovarArtefato(
  ledger: ReturnType<typeof fabricaLedger>,
  inicio: InicioExecucaoConteudo,
  alvo: AlvoConteudo,
  artifact: ArtefatoConteudo,
  atestador: IdentidadeTeste,
  avaliador: IdentidadeTeste,
): { atestado: AtestadoEvidenciaConteudo; parecer: ParecerIAConteudo } {
  const atestado: AtestadoEvidenciaConteudo = {
    ...contextoAlvo(inicio, alvo),
    kind: "EVIDENCE_ATTESTED",
    evidenceId: `evidence-${artifact.artifactId}`,
    gateId: "qa-final",
    stageId: "adaptacao",
    targetId: alvo.targetId,
    artifactDigest: artifact.digest,
    evidenceType: "artefato_integro",
    producerId: artifact.producerId,
    attesterId: atestador.principal.principalId,
    result: "APROVADO",
    observedAt: new Date().toISOString(),
  };
  const parecer: ParecerIAConteudo = {
    ...contextoAlvo(inicio, alvo),
    kind: "AI_ASSESSMENT",
    assessmentId: `assessment-${artifact.artifactId}`,
    gateId: "qa-final",
    targetId: alvo.targetId,
    artifactDigest: artifact.digest,
    rubricDigest: RUBRICA,
    evaluatorId: avaliador.principal.principalId,
    capability: "avaliar_qualidade",
    result: "APROVADO",
    assessedAt: new Date().toISOString(),
  };
  ledger.anexar(atestado, atestador.principal.principalId);
  ledger.anexar(parecer, avaliador.principal.principalId);
  return { atestado, parecer };
}

test("ledger detecta adulteracao, truncamento e append com signatario fora da raiz", () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-integridade";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner", "execucao", ["PIPELINE_CONTROLLER", "RUNNER"], [], [scope]);
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades([runner]));
  const politica = politicaDaDefinicao(definicao, "ledger-integridade", trustRootDigest, runId);
  const ledger = fabricaLedger(politica.ledgerId, [runner], envelopeDaPolitica(politica, autoridadePolitica));
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  const segredoLineage = "TOKEN-LINHAGEM-NAO-PODE-VAZAR";
  const payloadLineageInvalida = validarPayloadEventoConteudo({
    ...artefato(inicio, alvoArtigo, runner, "d"),
    lineageDigests: [segredoLineage],
  }, {
    principalId: runner.principal.principalId,
    contextoEsperado: {
      runId,
      trustDomainId: politica.trustDomainId,
      trustRootDigest,
      ledgerId: politica.ledgerId,
      policyDigest: hashCanonicoConteudo(politica),
      definitionDigest: politica.definitionDigest,
    },
    inicio,
    artefatosAnteriores: [],
    alegacoesAnteriores: [],
  });
  assert.equal(payloadLineageInvalida.valido, false);
  assert.ok(payloadLineageInvalida.bloqueios.includes("lineageDigests_invalidos"));
  assert.equal(JSON.stringify(payloadLineageInvalida).includes(segredoLineage), false);
  const segredoReason = `Bearer ${"R".repeat(32)}`;
  const payloadReasonInvalido = validarPayloadEventoConteudo({
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "OPERATIONAL_CONDITION",
    gateId: "qa-final",
    targetId: alvoArtigo.targetId,
    condition: "EXECUTANDO",
    reason: segredoReason,
    reportedAt: "2026-07-19T12:00:01.000Z",
  }, {
    principalId: runner.principal.principalId,
    contextoEsperado: {
      runId,
      trustDomainId: politica.trustDomainId,
      trustRootDigest,
      ledgerId: politica.ledgerId,
      policyDigest: hashCanonicoConteudo(politica),
      definitionDigest: politica.definitionDigest,
    },
    inicio,
    artefatosAnteriores: [],
    alegacoesAnteriores: [],
  });
  assert.equal(payloadReasonInvalido.valido, false);
  assert.ok(payloadReasonInvalido.bloqueios.includes("reason_contem_possivel_credencial"));
  assert.equal(JSON.stringify(payloadReasonInvalido).includes(segredoReason), false);
  assert.throws(() => ledger.anexar({
    ...inicio,
    trustDomainId: "trust-forjado",
    trustRootDigest: `sha256:${"f".repeat(64)}`,
  }, runner.principal.principalId), /payload_invalido:.*trustDomainId_divergente.*trustRootDigest_divergente/u);
  ledger.anexar(inicio, runner.principal.principalId);
  ledger.anexar({
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "OPERATIONAL_CONDITION",
    gateId: "qa-final",
    targetId: alvoArtigo.targetId,
    condition: "EXECUTANDO",
    reason: "execucao iniciada",
    reportedAt: "2026-07-19T12:00:01.000Z",
  }, runner.principal.principalId);

  const original = ledger.eventos();
  const wrapperMaleavel = [
    { ...original[0], concluido: true },
    ...original.slice(1),
  ] as unknown as readonly EventoLedgerConteudo<EventoPayloadConteudo>[];
  const adulterado = [
    { ...original[0], recordedAt: "2026-07-19T12:05:00.000Z" },
    original[1],
  ] as readonly EventoLedgerConteudo<EventoPayloadConteudo>[];
  const contextoEsperado = {
    runId,
    trustDomainId: politica.trustDomainId,
    trustRootDigest,
    ledgerId: politica.ledgerId,
    policyDigest: hashCanonicoConteudo(politica),
    definitionDigest: politica.definitionDigest,
  };
  assert.equal(validarLedgerConteudo({
    eventos: adulterado,
    envelopePolitica: ledger.envelopePolitica,
    ledgerId: politica.ledgerId,
    expectedHead: ledger.head(),
    principals: ledger.confianca.principals,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    configuracaoConfianca: ledger.confianca,
    contextoEsperado,
  }).valido, false);
  const wrapperInvalido = validarLedgerConteudo({
    eventos: wrapperMaleavel,
    envelopePolitica: ledger.envelopePolitica,
    ledgerId: politica.ledgerId,
    expectedHead: ledger.head(),
    principals: ledger.confianca.principals,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    configuracaoConfianca: ledger.confianca,
    contextoEsperado,
  });
  assert.equal(wrapperInvalido.valido, false);
  assert.ok(wrapperInvalido.bloqueios.includes("evento_0:campo_nao_permitido"));
  assert.ok(validarLedgerConteudo({
    eventos: original.slice(0, 1),
    envelopePolitica: ledger.envelopePolitica,
    ledgerId: politica.ledgerId,
    expectedHead: ledger.head(),
    principals: ledger.confianca.principals,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    configuracaoConfianca: ledger.confianca,
    contextoEsperado,
  }).bloqueios.includes("expected_head_divergente"));

  const invasor = identidade("invasor", "fora-da-raiz", ["RUNNER"], [], [scope]);
  const payload: EventoPayloadConteudo = {
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "OPERATIONAL_CONDITION",
    gateId: "qa-final",
    targetId: alvoArtigo.targetId,
    condition: "EXECUCAO_ENCERRADA",
    reason: "forjado",
    reportedAt: "2026-07-19T12:00:20.000Z",
  };
  const envelope = assinarEnvelopeConteudo({
    schemaVersion: "sema.content/v1",
    payloadType: payload.kind,
    payload,
    principalId: invasor.principal.principalId,
    keyId: invasor.principal.keyId,
    issuedAt: new Date().toISOString(),
    nonce: "nonce-invasor",
    signatureAlgorithm: "Ed25519",
  }, invasor.privateKey);
  assert.throws(() => anexarEventoLedgerConteudo(original, {
    ledgerId: politica.ledgerId,
    expectedHead: ledger.head(),
    schemaVersion: "sema.content/v1",
    eventId: "event-invasor",
    recordedAt: new Date().toISOString(),
    envelope,
    envelopePolitica: ledger.envelopePolitica,
    configuracaoConfianca: ledger.confianca,
    trustRootDigestEsperado: ledger.trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
  }), /envelope_nao_confiavel/u);

  const instanteAntigo = "2020-01-01T00:00:00.000Z";
  const envelopeAntigo = assinarEnvelopeConteudo({
    schemaVersion: "sema.content/v1",
    payloadType: payload.kind,
    payload: { ...payload, reason: "backdating", reportedAt: instanteAntigo },
    principalId: runner.principal.principalId,
    keyId: runner.principal.keyId,
    issuedAt: instanteAntigo,
    nonce: "nonce-backdating",
    signatureAlgorithm: "Ed25519",
  }, runner.privateKey);
  assert.throws(() => anexarEventoLedgerConteudo(original, {
    ledgerId: politica.ledgerId,
    expectedHead: ledger.head(),
    schemaVersion: "sema.content/v1",
    eventId: "event-backdating",
    recordedAt: instanteAntigo,
    envelope: envelopeAntigo,
    envelopePolitica: ledger.envelopePolitica,
    configuracaoConfianca: ledger.confianca,
    trustRootDigestEsperado: ledger.trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
  }), /recorded_at_expirado/u);
});

test("campo concluido e override de completion gates nao alteram estado canonico", () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-manifesto";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner", "execucao", ["PIPELINE_CONTROLLER", "RUNNER"], [], [scope]);
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades([runner]));
  const politica = politicaDaDefinicao(definicao, "ledger-manifesto", trustRootDigest, runId);
  const ledger = fabricaLedger(politica.ledgerId, [runner], envelopeDaPolitica(politica, autoridadePolitica));
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  assert.throws(() => ledger.anexar({ ...inicio, concluido: true } as unknown as InicioExecucaoConteudo, runner.principal.principalId), /campo_nao_permitido/u);
  ledger.anexar(inicio, runner.principal.principalId);
  ledger.anexar({
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "OPERATIONAL_CONDITION",
    gateId: "qa-final",
    targetId: alvoArtigo.targetId,
    condition: "EXECUCAO_ENCERRADA",
    reason: "runner encerrou sem evidencia",
    reportedAt: "2026-07-19T12:00:01.000Z",
  }, runner.principal.principalId);

  const entrada = {
    eventos: ledger.eventos(),
    envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica),
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(),
    configuracaoConfianca: ledger.confianca,
    requiredCompletionGates: [],
  } as unknown as Parameters<typeof derivarEstadoPipelineConteudo>[0];
  const estado = derivarEstadoPipelineConteudo(entrada);
  assert.equal(estado.concluido, false);
  assert.equal(estado.estadosGate[0]?.condition, "EXECUCAO_ENCERRADA");
  assert.equal(estado.estadosGate[0]?.veredito, "NAO_AVALIADO");

  const projecao = projetarManifestoPipelineConteudo({
    eventos: ledger.eventos(),
    envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica),
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(),
    configuracaoConfianca: ledger.confianca,
    generatedAt: "2026-07-19T12:30:00.000Z",
  });
  assert.equal(projecao.authoritative, false);
  assert.equal(projecao.ledgerHead, ledger.head());
  assert.equal("concluido" in projecao, false);

  assert.throws(() => projetarManifestoPipelineConteudo({
    eventos: ledger.eventos(),
    envelopePolitica: envelopeDaPolitica(politica, runner),
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(),
    configuracaoConfianca: ledger.confianca,
  }), /ledger_invalido:.*politica_nao_confiavel/u);
});

test("target set do RUN_STARTED deve coincidir com a politica assinada", () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-target-set-divergente";
  const scope = escopoAutorizacaoAlvo(runId, alvoAudio);
  const runner = identidade("runner-target-set", "execucao-target-set", ["PIPELINE_CONTROLLER"], [], [scope]);
  const identidades = [runner];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const politica = politicaDaDefinicao(definicao, "ledger-target-set", trustRootDigest, runId, [alvoArtigo]);
  const ledger = fabricaLedger(politica.ledgerId, identidades, envelopeDaPolitica(politica, autoridadePolitica));
  const inicioDivergente = contextoInicio(runId, politica, [alvoAudio]);
  assert.throws(
    () => ledger.anexar(inicioDivergente, runner.principal.principalId),
    /politica_target_set_digest_divergente/u,
  );
});

test("policy antiga nao pode ser ativada hoje por um novo RUN_STARTED", () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-policy-expirada";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner-policy-expirada", "execucao-policy-expirada", ["PIPELINE_CONTROLLER"], [], [scope]);
  const identidades = [runner];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const atual = politicaDaDefinicao(definicao, "ledger-policy-expirada", trustRootDigest, runId);
  const politica: PoliticaConfiancaConteudo = {
    ...atual,
    issuedAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2020-01-01T00:01:00.000Z",
  };
  const ledger = fabricaLedger(
    politica.ledgerId,
    identidades,
    envelopeDaPolitica(politica, autoridadePolitica),
  );
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  assert.throws(
    () => ledger.anexar(inicio, runner.principal.principalId),
    /politica_expirada/u,
  );
});

test("policy expirada depois do RUN_STARTED nao autoriza novo append", async () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-policy-expira-durante-execucao";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner-policy-curta", "execucao-policy-curta", ["PIPELINE_CONTROLLER", "RUNNER"], [], [scope]);
  const identidades = [runner];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const base = politicaDaDefinicao(definicao, "ledger-policy-curta", trustRootDigest, runId);
  const politica: PoliticaConfiancaConteudo = {
    ...base,
    expiresAt: new Date(Date.parse(base.issuedAt) + 500).toISOString(),
  };
  const ledger = fabricaLedger(politica.ledgerId, identidades, envelopeDaPolitica(politica, autoridadePolitica));
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  ledger.anexar(inicio, runner.principal.principalId);
  const espera = Math.max(0, Date.parse(politica.expiresAt) - Date.now() + 25);
  await new Promise((resolve) => setTimeout(resolve, espera));

  assert.throws(() => ledger.anexar({
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "OPERATIONAL_CONDITION",
    gateId: "qa-final",
    targetId: alvoArtigo.targetId,
    condition: "EXECUTANDO",
    reason: "evento tardio",
    reportedAt: new Date().toISOString(),
  }, runner.principal.principalId), /politica_expirada/u);
});

test("replay canonico rejeita evento registrado depois de expiresAt", () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-policy-replay-expirado";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner-policy-replay", "execucao-policy-replay", ["PIPELINE_CONTROLLER", "RUNNER"], [], [scope]);
  const identidades = [runner];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const base = politicaDaDefinicao(definicao, "ledger-policy-replay", trustRootDigest, runId);
  const politica: PoliticaConfiancaConteudo = {
    ...base,
    expiresAt: new Date(Date.parse(base.issuedAt) + 1_000).toISOString(),
  };
  const envelopePolitica = envelopeDaPolitica(politica, autoridadePolitica);
  const ledger = fabricaLedger(politica.ledgerId, identidades, envelopePolitica);
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  ledger.anexar(inicio, runner.principal.principalId);
  ledger.anexar({
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "OPERATIONAL_CONDITION",
    gateId: "qa-final",
    targetId: alvoArtigo.targetId,
    condition: "EXECUTANDO",
    reason: "evento originalmente valido",
    reportedAt: new Date().toISOString(),
  }, runner.principal.principalId);

  const eventos = [...ledger.eventos()];
  const ultimo = eventos[1]!;
  const semHash = {
    schemaVersion: ultimo.schemaVersion,
    ledgerId: ultimo.ledgerId,
    sequence: ultimo.sequence,
    eventId: ultimo.eventId,
    recordedAt: new Date(Date.parse(politica.expiresAt) + 1).toISOString(),
    previousHash: ultimo.previousHash,
    envelope: ultimo.envelope,
  };
  eventos[1] = { ...semHash, hash: calcularHashEventoLedgerConteudo(semHash) };
  const estado = derivarEstadoPipelineConteudo({
    eventos,
    envelopePolitica,
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: eventos[1]!.hash,
    configuracaoConfianca: ledger.confianca,
  });
  assert.equal(estado.valido, false);
  assert.ok(estado.nextActions.includes("corrigir_ledger:evento_1:recorded_at_fora_da_janela_da_politica"));
});

test("replay historico exige policy assinada e aceita os limites inclusivos da janela", () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-policy-replay-historico";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner-policy-historico", "execucao-policy-historico", ["PIPELINE_CONTROLLER", "RUNNER"], [], [scope]);
  const confianca = confiancaDasIdentidades([runner]);
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confianca);
  const revocationDigest = digestRevogacoesConfiancaConteudo(confianca);
  const base = politicaDaDefinicao(definicao, "ledger-policy-historico", trustRootDigest, runId);
  const politica: PoliticaConfiancaConteudo = {
    ...base,
    issuedAt: "2020-01-01T00:00:00.000Z",
    expiresAt: "2020-01-01T00:05:00.000Z",
  };
  const envelopePolitica = envelopeDaPolitica(politica, autoridadePolitica);
  const inicio: InicioExecucaoConteudo = {
    ...contextoInicio(runId, politica, [alvoArtigo]),
    startedAt: politica.issuedAt,
  };
  const envelopeInicio = assinarEnvelopeConteudo({
    schemaVersion: "sema.content/v1",
    payloadType: "RUN_STARTED",
    payload: inicio,
    principalId: runner.principal.principalId,
    keyId: runner.principal.keyId,
    issuedAt: politica.issuedAt,
    nonce: "nonce-replay-historico-inicio",
    signatureAlgorithm: "Ed25519",
  }, runner.privateKey);
  const inicioSemHash = {
    schemaVersion: "sema.content/v1",
    ledgerId: politica.ledgerId,
    sequence: 0,
    eventId: "event-replay-historico-inicio",
    recordedAt: politica.issuedAt,
    previousHash: HEAD_GENESIS_LEDGER_CONTEUDO,
    envelope: envelopeInicio,
  };
  const eventoInicio = {
    ...inicioSemHash,
    hash: calcularHashEventoLedgerConteudo(inicioSemHash),
  };
  const operacao: EventoPayloadConteudo = {
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "OPERATIONAL_CONDITION",
    gateId: "qa-final",
    targetId: alvoArtigo.targetId,
    condition: "EXECUCAO_ENCERRADA",
    reason: "execucao historica encerrada",
    reportedAt: politica.expiresAt,
  };
  const envelopeOperacao = assinarEnvelopeConteudo({
    schemaVersion: "sema.content/v1",
    payloadType: "OPERATIONAL_CONDITION",
    payload: operacao,
    principalId: runner.principal.principalId,
    keyId: runner.principal.keyId,
    issuedAt: politica.expiresAt,
    nonce: "nonce-replay-historico-fim",
    signatureAlgorithm: "Ed25519",
  }, runner.privateKey);
  const operacaoSemHash = {
    schemaVersion: "sema.content/v1",
    ledgerId: politica.ledgerId,
    sequence: 1,
    eventId: "event-replay-historico-fim",
    recordedAt: politica.expiresAt,
    previousHash: eventoInicio.hash,
    envelope: envelopeOperacao,
  };
  const eventoOperacao = {
    ...operacaoSemHash,
    hash: calcularHashEventoLedgerConteudo(operacaoSemHash),
  };
  const eventos = [eventoInicio, eventoOperacao] as readonly EventoLedgerConteudo<EventoPayloadConteudo>[];
  const entrada = {
    eventos,
    envelopePolitica,
    ledgerId: politica.ledgerId,
    expectedHead: eventoOperacao.hash,
    principals: confianca.principals,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: revocationDigest,
    configuracaoConfianca: confianca,
    contextoEsperado: {
      runId,
      trustDomainId: politica.trustDomainId,
      trustRootDigest,
      ledgerId: politica.ledgerId,
      policyDigest: hashCanonicoConteudo(politica),
      definitionDigest: politica.definitionDigest,
    },
  };

  const valido = validarLedgerConteudo(entrada);
  assert.equal(valido.valido, true, valido.bloqueios.join(","));

  const inicioAntesDaJanelaSemHash = {
    ...inicioSemHash,
    recordedAt: new Date(Date.parse(politica.issuedAt) - 1).toISOString(),
  };
  const eventoAntesDaJanela = {
    ...inicioAntesDaJanelaSemHash,
    hash: calcularHashEventoLedgerConteudo(inicioAntesDaJanelaSemHash),
  };
  const antesDaJanela = validarLedgerConteudo({
    ...entrada,
    eventos: [eventoAntesDaJanela] as readonly EventoLedgerConteudo<EventoPayloadConteudo>[],
    expectedHead: eventoAntesDaJanela.hash,
  });
  assert.equal(antesDaJanela.valido, false);
  assert.ok(antesDaJanela.bloqueios.includes("evento_0:recorded_at_fora_da_janela_da_politica"));

  const politicaOutroRun: PoliticaConfiancaConteudo = {
    ...politica,
    runId: "run-policy-divergente",
  };
  const politicaDivergente = validarLedgerConteudo({
    ...entrada,
    envelopePolitica: envelopeDaPolitica(politicaOutroRun, autoridadePolitica),
  });
  assert.equal(politicaDivergente.valido, false);
  assert.ok(politicaDivergente.bloqueios.includes("politica_contexto_divergente"));

  const semPolitica = validarLedgerConteudo({
    ...entrada,
    envelopePolitica: undefined,
  } as unknown as Parameters<typeof validarLedgerConteudo>[0]);
  assert.equal(semPolitica.valido, false);
  assert.ok(semPolitica.bloqueios.includes("envelope_politica_ausente"));
});

test("confirmacao de adapter exige capability e observacao vinculadas ao adapter exato", () => {
  const base = definicaoUmaEtapa();
  const definicao: DefinicaoPipelineConteudo = {
    ...base,
    stages: [{
      stageId: "entrega",
      capability: "content.target.deliver",
      scope: "POR_ALVO",
      adapterPolicy: "CONFIRMATION",
      dependsOn: [],
      produces: ["confirmacao-entrega"],
      gateIds: ["confirmacao-externa"],
    }],
    gates: [{
      gateId: "confirmacao-externa",
      stageId: "entrega",
      scope: "POR_ALVO",
      evaluationMode: "DETERMINISTICA",
      requiredEvidence: ["destination.delivery.observed"],
      evaluatorCapabilities: [],
      minAttestationsPerEvidence: 1,
      minDistinctAttesterControlDomains: 1,
      minApprovals: 1,
      minDistinctControlDomains: 1,
      producerDisjoint: true,
      rejectionIsBinding: true,
      rubricDigest: RUBRICA,
    }],
    requiredCompletionGates: ["confirmacao-externa"],
  };
  const runId = "run-adapter-binding";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner-adapter", "execucao-adapter", ["PIPELINE_CONTROLLER"], [], [scope]);
  const produtor = identidade(
    "producer-adapter",
    "producao-adapter",
    ["PRODUCER"],
    ["content.target.deliver"],
    [scope],
  );
  const atestadorGenerico = identidade(
    "attester-generic",
    "attester-generic-domain",
    ["EVIDENCE_ATTESTER"],
    ["content.evidence.attest:destination.delivery.observed"],
    [scope],
  );
  const atestadorAdapter = identidade(
    "attester-adapter",
    "attester-adapter-domain",
    ["EVIDENCE_ATTESTER"],
    ["content.adapter.attest:destination-generic@1.0.0:destination.delivery.observed"],
    [scope],
  );
  const identidades = [runner, produtor, atestadorGenerico, atestadorAdapter];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const politica = politicaDaDefinicao(definicao, "ledger-adapter-binding", trustRootDigest, runId);
  const ledger = fabricaLedger(politica.ledgerId, identidades, envelopeDaPolitica(politica, autoridadePolitica));
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  ledger.anexar(inicio, runner.principal.principalId);
  const artifact: ArtefatoConteudo = {
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "ARTIFACT_REGISTERED",
    artifactId: "artifact-delivery",
    stageId: "entrega",
    targetId: alvoArtigo.targetId,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    version: "1",
    artifactType: "confirmacao-entrega",
    mediaType: "text/markdown",
    digest: `sha256:${"9".repeat(64)}`,
    lineageDigests: [],
  };
  ledger.anexar(artifact, produtor.principal.principalId);
  const atestado = (atestador: IdentidadeTeste, evidenceId: string): AtestadoEvidenciaConteudo => ({
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "EVIDENCE_ATTESTED",
    evidenceId,
    gateId: "confirmacao-externa",
    stageId: "entrega",
    targetId: alvoArtigo.targetId,
    artifactDigest: artifact.digest,
    evidenceType: "destination.delivery.observed",
    producerId: produtor.principal.principalId,
    attesterId: atestador.principal.principalId,
    result: "APROVADO",
    observedAt: new Date().toISOString(),
    data: {
      adapterId: "destination-generic",
      adapterVersion: "1.0.0",
      observationDigest: `sha256:${"a".repeat(64)}`,
    },
  });
  ledger.anexar(atestado(atestadorGenerico, "evidence-generic"), atestadorGenerico.principal.principalId);
  const entrada = {
    eventos: ledger.eventos(),
    envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica),
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(),
    configuracaoConfianca: ledger.confianca,
  };
  const semCapabilityEspecifica = derivarEstadoPipelineConteudo(entrada);
  assert.notEqual(semCapabilityEspecifica.estadosGate[0]?.veredito, "APROVADO");
  assert.ok(semCapabilityEspecifica.estadosGate[0]?.blockers.some((item) => item.endsWith("capability_ausente")));

  ledger.anexar(atestado(atestadorAdapter, "evidence-adapter"), atestadorAdapter.principal.principalId);
  const aprovado = derivarEstadoPipelineConteudo({
    ...entrada,
    eventos: ledger.eventos(),
    expectedHead: ledger.head(),
  });
  assert.equal(aprovado.estadosGate[0]?.veredito, "APROVADO");
  assert.equal(aprovado.concluido, true);
});

test("constraints exigem media type observado independentemente do rotulo do produtor", () => {
  const base = definicaoUmaEtapa();
  const definicao: DefinicaoPipelineConteudo = {
    ...base,
    stages: [{ ...base.stages[0]!, adapterPolicy: "CONSTRAINTS" }],
    gates: [{
      ...base.gates[0]!,
      evaluationMode: "DETERMINISTICA",
      requiredEvidence: ["adapter.constraints.passed"],
      evaluatorCapabilities: [],
      minApprovals: 1,
      minDistinctControlDomains: 1,
    }],
  };
  const runId = "run-observed-media-type";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner-media", "execucao-media", ["PIPELINE_CONTROLLER"], [], [scope]);
  const produtor = identidade(
    "producer-media",
    "producao-media",
    ["PRODUCER"],
    ["content.target.compose"],
    [scope],
  );
  const atestador = identidade(
    "attester-media",
    "atestacao-media",
    ["EVIDENCE_ATTESTER"],
    ["content.adapter.attest:destination-generic@1.0.0:adapter.constraints.passed"],
    [scope],
  );
  const identidades = [runner, produtor, atestador];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const politica = politicaDaDefinicao(definicao, "ledger-observed-media-type", trustRootDigest, runId);
  const ledger = fabricaLedger(politica.ledgerId, identidades, envelopeDaPolitica(politica, autoridadePolitica));
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  ledger.anexar(inicio, runner.principal.principalId);
  const artifact = artefato(inicio, alvoArtigo, produtor, "d");
  ledger.anexar(artifact, produtor.principal.principalId);
  const adapter = definicao.adapters[0]!;

  const criarAtestado = (
    evidenceId: string,
    observedMediaType: string,
    result: AtestadoEvidenciaConteudo["result"],
  ): AtestadoEvidenciaConteudo => {
    const observations = { observedMediaType, artifactBytes: 42 };
    const recalculado = avaliarConstraintsDeterministicasConteudo(
      artifact,
      adapter.deterministicConstraints,
      observations,
    );
    return {
      ...contextoAlvo(inicio, alvoArtigo),
      kind: "EVIDENCE_ATTESTED",
      evidenceId,
      gateId: "qa-final",
      stageId: "adaptacao",
      targetId: alvoArtigo.targetId,
      artifactDigest: artifact.digest,
      evidenceType: "adapter.constraints.passed",
      producerId: produtor.principal.principalId,
      attesterId: atestador.principal.principalId,
      result,
      observedAt: new Date().toISOString(),
      data: {
        adapterId: adapter.adapterId,
        adapterVersion: adapter.version,
        constraintsDigest: recalculado.constraintsDigest,
        resultsDigest: recalculado.resultsDigest,
        observations,
      },
    };
  };

  ledger.anexar(
    criarAtestado("evidence-mime-falso", "application/octet-stream", "APROVADO"),
    atestador.principal.principalId,
  );
  const falso = derivarEstadoPipelineConteudo({
    eventos: ledger.eventos(),
    envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica),
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(),
    configuracaoConfianca: ledger.confianca,
  });
  assert.notEqual(falso.estadosGate[0]?.veredito, "APROVADO");
  assert.ok(falso.estadosGate[0]?.blockers.some((item) => item.startsWith("constraint_observed_media_type_divergente:")));

  ledger.anexar(
    criarAtestado("evidence-mime-observado", artifact.mediaType, "APROVADO"),
    atestador.principal.principalId,
  );
  const valido = derivarEstadoPipelineConteudo({
    eventos: ledger.eventos(),
    envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica),
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(),
    configuracaoConfianca: ledger.confianca,
  });
  assert.equal(valido.estadosGate[0]?.veredito, "APROVADO");
  assert.equal(valido.concluido, true);
});

test("gates ficam isolados por target e novo digest supera evidencia anterior", () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-targets";
  const scopes = [
    escopoAutorizacaoAlvo(runId, alvoArtigo),
    escopoAutorizacaoAlvo(runId, alvoAudio),
  ];
  const runner = identidade("runner", "execucao", ["PIPELINE_CONTROLLER", "RUNNER"], [], scopes);
  const produtor = identidade("producer", "producao", ["PRODUCER"], ["content.target.compose"], scopes);
  const atestador = identidade("attester", "atestacao", ["EVIDENCE_ATTESTER"], ["content.evidence.attest:artefato_integro"], scopes);
  const avaliador = identidade("evaluator", "avaliacao", ["EVALUATOR"], ["avaliar_qualidade"], scopes);
  const identidades = [runner, produtor, atestador, avaliador];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const politica = politicaDaDefinicao(definicao, "ledger-targets", trustRootDigest, runId, [alvoArtigo, alvoAudio]);
  const ledger = fabricaLedger(politica.ledgerId, identidades, envelopeDaPolitica(politica, autoridadePolitica));
  const inicio = contextoInicio(runId, politica, [alvoArtigo, alvoAudio]);
  ledger.anexar(inicio, runner.principal.principalId);
  assert.throws(() => ledger.anexar({
    ...artefato(inicio, alvoArtigo, produtor, "secret"),
    digest: `sha256:${"6".repeat(64)}`,
    metadata: { accessToken: "SECRET-NAO-PODE-ENTRAR-NO-LEDGER" },
  } as unknown as ArtefatoConteudo, produtor.principal.principalId), /campo_extra_nao_assinado:metadata|artifact_metadata_nao_permitida/u);
  const artigoV1 = artefato(inicio, alvoArtigo, produtor, "a");
  const audioV1 = artefato(inicio, alvoAudio, produtor, "b", "audio/mpeg");
  ledger.anexar(artigoV1, produtor.principal.principalId);
  ledger.anexar(audioV1, produtor.principal.principalId);
  const aprovacao = aprovarArtefato(ledger, inicio, alvoArtigo, artigoV1, atestador, avaliador);
  ledger.anexar({
    ...contextoAlvo(inicio, alvoAudio),
    kind: "OPERATIONAL_CONDITION",
    gateId: "qa-final",
    targetId: alvoAudio.targetId,
    condition: "EXECUCAO_ENCERRADA",
    reason: "somente audio encerrado",
    reportedAt: "2026-07-19T12:00:12.000Z",
  }, runner.principal.principalId);

  const entrada = {
    eventos: ledger.eventos(),
    envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica),
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(),
    configuracaoConfianca: ledger.confianca,
  };
  const antes = derivarEstadoPipelineConteudo(entrada);
  const gateArtigo = antes.estadosGate.find((gate) => gate.targetId === alvoArtigo.targetId);
  const gateAudio = antes.estadosGate.find((gate) => gate.targetId === alvoAudio.targetId);
  assert.equal(gateArtigo?.veredito, "APROVADO");
  assert.deepEqual(gateArtigo?.evidenceIds, [aprovacao.atestado.evidenceId]);
  assert.equal(gateAudio?.veredito, "NAO_AVALIADO");
  assert.equal(gateAudio?.condition, "EXECUCAO_ENCERRADA");
  assert.equal(antes.concluido, false);

  const artigoV2 = artefato(inicio, alvoArtigo, produtor, "c");
  ledger.anexar(artigoV2, produtor.principal.principalId);
  const depois = derivarEstadoPipelineConteudo({ ...entrada, eventos: ledger.eventos(), expectedHead: ledger.head() });
  const gateArtigoV2 = depois.estadosGate.find((gate) => gate.targetId === alvoArtigo.targetId);
  assert.equal(gateArtigoV2?.artifactDigest, artigoV2.digest);
  assert.equal(gateArtigoV2?.veredito, "NAO_AVALIADO");
  assert.deepEqual(gateArtigoV2?.assessmentIds, []);
  assert.deepEqual(gateArtigoV2?.evidenceIds, []);
});

test("produtor sem capability nao substitui artefato aprovado", () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-capability";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner", "execucao", ["PIPELINE_CONTROLLER"], [], [scope]);
  const produtor = identidade("producer", "producao", ["PRODUCER"], ["content.target.compose"], [scope]);
  const invasor = identidade("producer-sem-cap", "outra-producao", ["PRODUCER"], [], [scope]);
  const atestador = identidade("attester", "atestacao", ["EVIDENCE_ATTESTER"], ["content.evidence.attest:artefato_integro"], [scope]);
  const avaliador = identidade("evaluator", "avaliacao", ["EVALUATOR"], ["avaliar_qualidade"], [scope]);
  const identidades = [runner, produtor, invasor, atestador, avaliador];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const politica = politicaDaDefinicao(definicao, "ledger-capability", trustRootDigest, runId);
  const ledger = fabricaLedger(politica.ledgerId, identidades, envelopeDaPolitica(politica, autoridadePolitica));
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  ledger.anexar(inicio, runner.principal.principalId);
  const original = artefato(inicio, alvoArtigo, produtor, "d");
  ledger.anexar(original, produtor.principal.principalId);
  aprovarArtefato(ledger, inicio, alvoArtigo, original, atestador, avaliador);
  const antes = derivarEstadoPipelineConteudo({
    eventos: ledger.eventos(), envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica), definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(), configuracaoConfianca: ledger.confianca,
  });
  assert.equal(antes.concluido, true);

  const substituto = artefato(inicio, alvoArtigo, invasor, "e");
  ledger.anexar(substituto, invasor.principal.principalId);
  const depois = derivarEstadoPipelineConteudo({
    eventos: ledger.eventos(), envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica), definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(), configuracaoConfianca: ledger.confianca,
  });
  assert.equal(depois.estadosGate[0]?.artifactDigest, original.digest);
  assert.equal(depois.concluido, false);
  assert.ok(depois.nextActions.some((acao) => acao.includes("capability_produtor_ausente")));
});

test("revogacao preserva integridade historica mas recalcula evidencia ativa", () => {
  const definicao = definicaoUmaEtapa();
  const runId = "run-revogacao";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner", "execucao", ["PIPELINE_CONTROLLER"], [], [scope]);
  const produtor = identidade("producer", "producao", ["PRODUCER"], ["content.target.compose"], [scope]);
  const atestador = identidade("attester", "atestacao", ["EVIDENCE_ATTESTER"], ["content.evidence.attest:artefato_integro"], [scope]);
  const avaliador = identidade("evaluator", "avaliacao", ["EVALUATOR"], ["avaliar_qualidade"], [scope]);
  const identidades = [runner, produtor, atestador, avaliador];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const politica = politicaDaDefinicao(definicao, "ledger-revogacao", trustRootDigest, runId);
  const ledger = fabricaLedger(politica.ledgerId, identidades, envelopeDaPolitica(politica, autoridadePolitica));
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  ledger.anexar(inicio, runner.principal.principalId);
  const artifact = artefato(inicio, alvoArtigo, produtor, "f");
  ledger.anexar(artifact, produtor.principal.principalId);
  aprovarArtefato(ledger, inicio, alvoArtigo, artifact, atestador, avaliador);

  const confiancaRevogada: ConfiguracaoConfiancaConteudo = {
    ...ledger.confianca,
    revokedKeyIds: [atestador.principal.keyId],
  };
  const revocationDigestRevogado = digestRevogacoesConfiancaConteudo(confiancaRevogada);
  const validacaoHistorica = validarLedgerConteudo({
    eventos: ledger.eventos(),
    envelopePolitica: ledger.envelopePolitica,
    ledgerId: politica.ledgerId,
    expectedHead: ledger.head(),
    principals: confiancaRevogada.principals,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: revocationDigestRevogado,
    configuracaoConfianca: confiancaRevogada,
    contextoEsperado: {
      runId: politica.runId,
      trustDomainId: politica.trustDomainId,
      trustRootDigest,
      ledgerId: politica.ledgerId,
      policyDigest: hashCanonicoConteudo(politica),
      definitionDigest: politica.definitionDigest,
    },
  });
  assert.equal(validacaoHistorica.valido, true, validacaoHistorica.bloqueios.join(","));
  const estado = derivarEstadoPipelineConteudo({
    eventos: ledger.eventos(),
    envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica),
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: revocationDigestRevogado,
    expectedHead: ledger.head(),
    configuracaoConfianca: confiancaRevogada,
  });
  assert.equal(estado.estadosGate[0]?.veredito, "INCONCLUSIVO");
  assert.equal(estado.concluido, false);

  const confiancaAutoridadeRevogada: ConfiguracaoConfiancaConteudo = {
    ...ledger.confianca,
    revokedKeyIds: [autoridadePolitica.principal.keyId],
  };
  const estadoSemAutoridade = derivarEstadoPipelineConteudo({
    eventos: ledger.eventos(),
    envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica),
    definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: digestRevogacoesConfiancaConteudo(confiancaAutoridadeRevogada),
    expectedHead: ledger.head(),
    configuracaoConfianca: confiancaAutoridadeRevogada,
  });
  assert.equal(estadoSemAutoridade.valido, false);
  assert.ok(estadoSemAutoridade.nextActions.some((acao) => acao.includes("politica_nao_confiavel:chave_revogada")));
});

test("linhagem declarada deve incluir todos os produtores ancestrais", () => {
  const base = definicaoUmaEtapa();
  const definicao: DefinicaoPipelineConteudo = {
    ...base,
    stages: [
      {
        stageId: "origem",
        capability: "content.source.create",
        scope: "POR_ALVO",
        adapterPolicy: "NONE",
        dependsOn: [],
        produces: ["origem"],
        gateIds: [],
      },
      { ...base.stages[0], dependsOn: ["origem"] },
    ],
  };
  const runId = "run-linhagem";
  const scope = escopoAutorizacaoAlvo(runId, alvoArtigo);
  const runner = identidade("runner", "execucao", ["PIPELINE_CONTROLLER"], [], [scope]);
  const pai = identidade("producer-parent", "producao-pai", ["PRODUCER"], ["content.source.create"], [scope]);
  const filho = identidade("producer-child", "producao-filho", ["PRODUCER"], ["content.target.compose"], [scope]);
  const identidades = [runner, pai, filho];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confiancaDasIdentidades(identidades));
  const politica = politicaDaDefinicao(definicao, "ledger-linhagem", trustRootDigest, runId);
  const ledger = fabricaLedger(politica.ledgerId, identidades, envelopeDaPolitica(politica, autoridadePolitica));
  const inicio = contextoInicio(runId, politica, [alvoArtigo]);
  ledger.anexar(inicio, runner.principal.principalId);
  const ancestral: ArtefatoConteudo = {
    ...contextoAlvo(inicio, alvoArtigo),
    kind: "ARTIFACT_REGISTERED",
    artifactId: "artifact-parent",
    stageId: "origem",
    targetId: alvoArtigo.targetId,
    producerId: pai.principal.principalId,
    producerLineageIds: [pai.principal.principalId],
    version: "1",
    artifactType: "origem",
    mediaType: "text/markdown",
    digest: `sha256:${"7".repeat(64)}`,
    lineageDigests: [],
  };
  ledger.anexar(ancestral, pai.principal.principalId);
  const descendente: ArtefatoConteudo = {
    ...artefato(inicio, alvoArtigo, filho, "8"),
    lineageDigests: [ancestral.digest],
    producerLineageIds: [filho.principal.principalId],
  };
  ledger.anexar(descendente, filho.principal.principalId);
  const estado = derivarEstadoPipelineConteudo({
    eventos: ledger.eventos(), envelopePolitica: envelopeDaPolitica(politica, autoridadePolitica), definicao,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: ledger.revocationDigest,
    expectedHead: ledger.head(), configuracaoConfianca: ledger.confianca,
  });
  assert.equal(estado.estadosGate[0]?.artifactDigest, "");
  assert.equal(estado.concluido, false);
  assert.ok(estado.nextActions.some((acao) => acao.includes("producer_lineage_divergente")));
});
