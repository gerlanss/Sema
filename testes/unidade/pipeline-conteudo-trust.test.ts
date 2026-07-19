// SEMA-GOVERNED: sema.produto.pipeline_conteudo.confianca
// Descricao: prova canonicalizacao, raiz publica Ed25519 e gates AI-native independentes do produtor.

import assert from "node:assert/strict";
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import test from "node:test";
import {
  assinarEnvelopeConteudo,
  canonicalizarJson,
  digestJsonCanonico,
} from "../../pacotes/cli/src/pipelineConteudo/canonical.js";
import {
  avaliarGateConteudoInterno as avaliarGateConteudoBase,
  digestConfiguracaoConfiancaConteudo,
  digestRevogacoesConfiancaConteudo,
  validarConfiguracaoConfiancaConteudo,
  verificarEnvelopeAssinadoConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/trust.js";
import type {
  AlegacaoEvidenciaConteudo,
  AtestadoEvidenciaConteudo,
  ConfiguracaoConfiancaConteudo,
  EntradaAvaliacaoGateConteudo,
  EnvelopeAssinadoConteudo,
  EnvelopeVerificadoConteudo,
  ParecerIAConteudo,
  PoliticaConfiancaConteudo,
  PoliticaGateConteudo,
  PrincipalConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/types.js";

const AGORA = "2026-07-19T16:00:00.000Z";
const ARTEFATO = "sha256:artefato-v1";
const RUBRICA = "sha256:rubrica-v1";
const TARGET = "target-arbitrario-1";
const RUN = "run-1";
const TRUST_DOMAIN = "trust-test";
const TRUST_ROOT = "sha256:trust-root-v1";
const LEDGER = "ledger-test";
const POLICY = "sha256:policy-v1";
const DEFINITION = "sha256:definition-v1";
const AUTHORIZATION_SCOPE = "run:run-1:target:target-arbitrario-1:account:account-test";
let trustRootAtual = TRUST_ROOT;

function contextoEvento() {
  return {
    runId: RUN,
    trustDomainId: TRUST_DOMAIN,
    trustRootDigest: trustRootAtual,
    ledgerId: LEDGER,
    policyDigest: POLICY,
    definitionDigest: DEFINITION,
    authorizationScope: AUTHORIZATION_SCOPE,
  } as const;
}

function avaliarGateConteudo(
  entrada: Omit<
    EntradaAvaliacaoGateConteudo,
    "trustDomainId" | "trustRootDigest" | "revocationDigestEsperado" | "ledgerId" | "policyDigest" |
    "definitionDigest" | "configuracaoConfianca" | "envelopePolitica"
  > & {
    readonly principals: readonly PrincipalConteudo[];
    readonly revokedKeyIds?: readonly string[];
    readonly gateAssinado?: PoliticaGateConteudo;
  },
) {
  const { principals, revokedKeyIds = [], gateAssinado, ...restante } = entrada;
  const principalsComAutoridade = principals.some(
    (principal) => principal.principalId === autoridadePolitica.principal.principalId,
  ) ? principals : [autoridadePolitica.principal, ...principals];
  const confianca: ConfiguracaoConfiancaConteudo = {
    trustDomainId: TRUST_DOMAIN,
    principals: principalsComAutoridade,
    revokedKeyIds,
    maxEnvelopeAgeMs: 60_000,
    maxFutureSkewMs: 1_000,
    schemaVersionsAceitas: ["1"],
  };
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confianca);
  const politica: PoliticaConfiancaConteudo = {
    policyId: "policy-trust-test",
    version: "1.0.0",
    runId: RUN,
    trustDomainId: TRUST_DOMAIN,
    trustRootDigest,
    definitionDigest: DEFINITION,
    targetSetDigest: digestJsonCanonico([TARGET]),
    ledgerId: LEDGER,
    gates: [gateAssinado ?? restante.gate],
    issuedAt: AGORA,
    expiresAt: new Date(Date.parse(AGORA) + 5 * 60 * 1000).toISOString(),
  };
  const policyDigest = digestJsonCanonico(politica);
  const envelopePolitica = assinar(
    autoridadePolitica,
    "TRUST_POLICY",
    politica,
    `nonce-policy-${policyDigest.slice(-12)}`,
  );
  const normalizarRegistro = <TPayload extends AtestadoEvidenciaConteudo | ParecerIAConteudo>(
    registro: EnvelopeVerificadoConteudo<TPayload>,
  ): EnvelopeVerificadoConteudo<TPayload> => {
    const identidade = identidadesPorPrincipal.get(registro.envelope.principalId);
    if (identidade === undefined || typeof registro.envelope.payload !== "object" || registro.envelope.payload === null) {
      return registro;
    }
    const payload = {
      ...registro.envelope.payload,
      trustDomainId: TRUST_DOMAIN,
      trustRootDigest,
      ledgerId: LEDGER,
      policyDigest,
      definitionDigest: DEFINITION,
    } as TPayload;
    const envelope = assinar(
      identidade,
      registro.envelope.payloadType,
      payload,
      registro.envelope.nonce,
      registro.envelope.issuedAt,
    );
    return {
      estado: "ACEITA",
      digest: digestJsonCanonico(envelope),
      principal: identidade.principal,
      envelope,
      payload,
    };
  };
  return avaliarGateConteudoBase({
    trustDomainId: TRUST_DOMAIN,
    trustRootDigest,
    revocationDigestEsperado: digestRevogacoesConfiancaConteudo(confianca),
    ledgerId: LEDGER,
    policyDigest,
    definitionDigest: DEFINITION,
    ...restante,
    evidenciasAceitas: restante.evidenciasAceitas.map(normalizarRegistro),
    pareceresIa: restante.pareceresIa.map(normalizarRegistro),
    envelopePolitica,
    configuracaoConfianca: confianca,
  });
}

interface IdentidadeTeste {
  principal: PrincipalConteudo;
  privateKey: KeyObject;
}

const identidadesPorPrincipal = new Map<string, IdentidadeTeste>();

function criarIdentidade(
  principalId: string,
  controlDomain: string,
  capabilities: readonly string[] = [],
  scopes: readonly string[] = [],
  papeis: readonly string[] = ["AI_AGENT"],
): IdentidadeTeste {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const criada = {
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
  identidadesPorPrincipal.set(principalId, criada);
  return criada;
}

const autoridadePolitica = criarIdentidade(
  "policy-authority",
  "policy-authority-domain",
  [],
  [],
  ["POLICY_AUTHORITY"],
);

function assinar<TPayload>(
  identidade: IdentidadeTeste,
  payloadType: string,
  payload: TPayload,
  nonce: string,
  issuedAt = AGORA,
): EnvelopeAssinadoConteudo<TPayload> {
  return assinarEnvelopeConteudo(
    {
      schemaVersion: "1",
      payloadType,
      payload,
      principalId: identidade.principal.principalId,
      keyId: identidade.principal.keyId,
      issuedAt,
      nonce,
      signatureAlgorithm: "Ed25519",
    },
    identidade.privateKey,
  );
}

function configurarConfianca(identidades: readonly IdentidadeTeste[]): ConfiguracaoConfiancaConteudo {
  const identidadesComAutoridade = identidades.some(
    (item) => item.principal.principalId === autoridadePolitica.principal.principalId,
  ) ? identidades : [autoridadePolitica, ...identidades];
  const confianca = {
    trustDomainId: TRUST_DOMAIN,
    principals: identidadesComAutoridade.map((item) => item.principal),
    revokedKeyIds: [],
    maxEnvelopeAgeMs: 60_000,
    maxFutureSkewMs: 1_000,
    schemaVersionsAceitas: ["1"],
  };
  trustRootAtual = digestConfiguracaoConfiancaConteudo(confianca);
  return confianca;
}

function pinsConfianca(confianca: ConfiguracaoConfiancaConteudo) {
  return {
    trustRootDigestEsperado: digestConfiguracaoConfiancaConteudo(confianca),
    revocationDigestEsperado: digestRevogacoesConfiancaConteudo(confianca),
  } as const;
}

function verificar<TPayload>(
  envelope: EnvelopeAssinadoConteudo<TPayload>,
  confianca: ConfiguracaoConfiancaConteudo,
  payloadTypeEsperado: string,
): EnvelopeVerificadoConteudo<TPayload> {
  const resultado = verificarEnvelopeAssinadoConteudo(envelope, confianca, {
    ...pinsConfianca(confianca),
    payloadTypeEsperado,
    agora: AGORA,
  });
  assert.equal(resultado.valido, true, resultado.bloqueios.join(","));
  assert.ok(resultado.envelopeVerificado);
  return resultado.envelopeVerificado;
}

function criarAtestado(
  identidade: IdentidadeTeste,
  produtorId: string,
  sobrescrever: Partial<AtestadoEvidenciaConteudo> = {},
): EnvelopeAssinadoConteudo<AtestadoEvidenciaConteudo> {
  const payload: AtestadoEvidenciaConteudo = {
    ...contextoEvento(),
    kind: "EVIDENCE_ATTESTED",
    evidenceId: `evidence-${identidade.principal.principalId}`,
    gateId: "gate-qualidade",
    stageId: "qa",
    targetId: TARGET,
    artifactDigest: ARTEFATO,
    evidenceType: "constraints-ok",
    producerId: produtorId,
    attesterId: identidade.principal.principalId,
    result: "APROVADO",
    observedAt: AGORA,
    ...sobrescrever,
  };
  return assinar(identidade, "EVIDENCE_ATTESTED", payload, `nonce-${payload.evidenceId}`);
}

function criarParecer(
  identidade: IdentidadeTeste,
  resultado: ParecerIAConteudo["result"] = "APROVADO",
  sobrescrever: Partial<ParecerIAConteudo> = {},
): EnvelopeAssinadoConteudo<ParecerIAConteudo> {
  const payload: ParecerIAConteudo = {
    ...contextoEvento(),
    kind: "AI_ASSESSMENT",
    assessmentId: `assessment-${identidade.principal.principalId}-${resultado}`,
    gateId: "gate-qualidade",
    targetId: TARGET,
    artifactDigest: ARTEFATO,
    rubricDigest: RUBRICA,
    evaluatorId: identidade.principal.principalId,
    capability: "quality.evaluate",
    result: resultado,
    assessedAt: AGORA,
    ...sobrescrever,
  };
  return assinar(identidade, "AI_ASSESSMENT", payload, `nonce-${payload.assessmentId}`);
}

function politicaGate(sobrescrever: Partial<PoliticaGateConteudo> = {}): PoliticaGateConteudo {
  return {
    gateId: "gate-qualidade",
    stageId: "qa",
    scope: "POR_ALVO",
    evaluationMode: "HIBRIDA",
    requiredEvidence: ["constraints-ok"],
    evaluatorCapabilities: ["quality.evaluate"],
    minAttestationsPerEvidence: 1,
    minDistinctAttesterControlDomains: 1,
    minApprovals: 2,
    minDistinctControlDomains: 2,
    producerDisjoint: true,
    rejectionIsBinding: true,
    rubricDigest: RUBRICA,
    ...sobrescrever,
  };
}

test("JSON canonico e digest independem da ordem das chaves", () => {
  const primeiro = { z: 2, a: { y: true, x: [3, "ok"] } };
  const segundo = { a: { x: [3, "ok"], y: true }, z: 2 };

  assert.equal(canonicalizarJson(primeiro), '{"a":{"x":[3,"ok"],"y":true},"z":2}');
  assert.equal(canonicalizarJson(primeiro), canonicalizarJson(segundo));
  assert.equal(digestJsonCanonico(primeiro), digestJsonCanonico(segundo));
  assert.match(digestJsonCanonico(primeiro), /^sha256:[a-f0-9]{64}$/);
  assert.throws(() => canonicalizarJson({ valor: undefined }), /json_canonico_invalido/);
  assert.throws(() => canonicalizarJson(new Array(1)), /array_esparso/);
});

test("raiz pinada rejeita digest divergente, revogacao desconhecida e mesma SPKI em dois principals", () => {
  const principalA = criarIdentidade("principal-a", "domain-a");
  const principalB = criarIdentidade("principal-b", "domain-b");
  const confianca = configurarConfianca([principalA, principalB]);
  const digest = digestConfiguracaoConfiancaConteudo(confianca);
  const revocationDigest = digestRevogacoesConfiancaConteudo(confianca);
  assert.equal(validarConfiguracaoConfiancaConteudo(confianca, digest, revocationDigest).valida, true);
  assert.equal(
    digestConfiguracaoConfiancaConteudo({ ...confianca, principals: [...confianca.principals].reverse() }),
    digest,
  );

  const digestErrado = validarConfiguracaoConfiancaConteudo(confianca, "sha256:nao-pinada", revocationDigest);
  assert.ok(digestErrado.bloqueios.includes("trust_root_digest_divergente"));
  const revogacaoDesconhecida = { ...confianca, revokedKeyIds: ["key-inexistente"] };
  const resultadoRevogacaoDesconhecida = validarConfiguracaoConfiancaConteudo(
    revogacaoDesconhecida,
    digestConfiguracaoConfiancaConteudo(revogacaoDesconhecida),
    digestRevogacoesConfiancaConteudo(revogacaoDesconhecida),
  );
  assert.ok(resultadoRevogacaoDesconhecida.bloqueios.includes("chave_revogada_desconhecida"));
  assert.equal(JSON.stringify(resultadoRevogacaoDesconhecida).includes("key-inexistente"), false);

  const principalClonado: PrincipalConteudo = {
    ...principalB.principal,
    publicKeyPem: principalA.principal.publicKeyPem,
  };
  const raizClonada = { ...confianca, principals: [principalA.principal, principalClonado] };
  const ataque = validarConfiguracaoConfiancaConteudo(
    raizClonada,
    digestConfiguracaoConfiancaConteudo(raizClonada),
    digestRevogacoesConfiancaConteudo(raizClonada),
  );
  assert.equal(ataque.valida, false);
  assert.ok(ataque.bloqueios.includes("fingerprint_duplicado"));

  const pemPrivada = principalA.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const raizComSegredo: ConfiguracaoConfiancaConteudo = {
    ...confianca,
    principals: confianca.principals.map((principal) =>
      principal.principalId === principalA.principal.principalId
        ? { ...principal, publicKeyPem: pemPrivada }
        : principal,
    ),
  };
  const segredo = validarConfiguracaoConfiancaConteudo(
    raizComSegredo,
    digestConfiguracaoConfiancaConteudo(raizComSegredo),
    digestRevogacoesConfiancaConteudo(raizComSegredo),
  );
  assert.equal(segredo.valida, false);
  assert.ok(segredo.bloqueios.includes("public_key_pem_nao_spki_publica"));

  const campoSecreto = `ghp_${"S".repeat(40)}`;
  const raizComCampoExtra = {
    ...confianca,
    [campoSecreto]: true,
  } as unknown as ConfiguracaoConfiancaConteudo;
  const campoExtra = validarConfiguracaoConfiancaConteudo(
    raizComCampoExtra,
    digestConfiguracaoConfiancaConteudo(raizComCampoExtra),
    digestRevogacoesConfiancaConteudo(raizComCampoExtra),
  );
  assert.ok(campoExtra.bloqueios.includes("campo_confianca_nao_permitido"));
  assert.equal(JSON.stringify(campoExtra).includes(campoSecreto), false);
});

test("verificador publico rejeita raiz atacante contra pins fornecidos pela fronteira", () => {
  const legitimo = criarIdentidade("attester-legitimo", "domain-legitimo", [], [], ["EVIDENCE_ATTESTER"]);
  const atacante = criarIdentidade("attester-atacante", "domain-atacante", [], [], ["EVIDENCE_ATTESTER"]);
  const confiancaLegitima = configurarConfianca([legitimo]);
  const confiancaAtacante: ConfiguracaoConfiancaConteudo = {
    trustDomainId: "trust-atacante",
    principals: [atacante.principal],
    revokedKeyIds: [],
    maxEnvelopeAgeMs: 60_000,
    maxFutureSkewMs: 1_000,
    schemaVersionsAceitas: ["1"],
  };
  const envelopeAtacante = assinar(atacante, "EVIDENCE_ATTESTED", { ok: true }, "nonce-raiz-atacante");

  const contraPinsLegitimos = verificarEnvelopeAssinadoConteudo(envelopeAtacante, confiancaAtacante, {
    ...pinsConfianca(confiancaLegitima),
    payloadTypeEsperado: "EVIDENCE_ATTESTED",
    agora: AGORA,
  });
  assert.equal(contraPinsLegitimos.valido, false);
  assert.ok(contraPinsLegitimos.bloqueios.includes("raiz_confianca_invalida:trust_root_digest_divergente"));
  assert.ok(contraPinsLegitimos.bloqueios.includes("raiz_confianca_invalida:revocation_digest_divergente"));

  const semPins = verificarEnvelopeAssinadoConteudo(
    envelopeAtacante,
    confiancaAtacante,
    { payloadTypeEsperado: "EVIDENCE_ATTESTED", agora: AGORA } as never,
  );
  assert.equal(semPins.valido, false);
  assert.ok(semPins.bloqueios.includes("raiz_confianca_invalida:trust_root_digest_divergente"));
  assert.ok(semPins.bloqueios.includes("raiz_confianca_invalida:revocation_digest_divergente"));
});

test("envelope Ed25519 valido nao carrega chave privada e adulteracao falha", () => {
  const adapter = criarIdentidade("adapter-a", "infra-adapter", ["publish.attest"], ["conta:a"], ["ADAPTER"]);
  const confianca = configurarConfianca([adapter]);
  const envelope = assinar(adapter, "EVIDENCE_ATTESTED", { ok: true }, "nonce-valido");

  const valido = verificarEnvelopeAssinadoConteudo(envelope, confianca, {
    ...pinsConfianca(confianca),
    payloadTypeEsperado: "EVIDENCE_ATTESTED",
    capabilityRequerida: "publish.attest",
    scopeRequerido: "conta:a",
    agora: AGORA,
  });
  assert.equal(valido.valido, true);
  assert.equal("privateKey" in envelope, false);

  const adulterado = { ...envelope, payload: { ok: false } };
  const invalido = verificarEnvelopeAssinadoConteudo(adulterado, confianca, {
    ...pinsConfianca(confianca),
    payloadTypeEsperado: "EVIDENCE_ATTESTED",
    capabilityRequerida: "publish.attest",
    scopeRequerido: "conta:a",
    agora: AGORA,
  });
  assert.equal(invalido.valido, false);
  assert.ok(invalido.bloqueios.includes("assinatura_invalida"));
});

test("verificacao trava chave revogada, capability, scope, frescura e replay", () => {
  const adapter = criarIdentidade("adapter-a", "infra-adapter", ["publish.attest"], ["conta:a"], ["ADAPTER"]);
  const envelope = assinar(adapter, "EVIDENCE_ATTESTED", { ok: true }, "nonce-unico");
  const confianca = configurarConfianca([adapter]);

  const semAutorizacao = verificarEnvelopeAssinadoConteudo(envelope, confianca, {
    ...pinsConfianca(confianca),
    payloadTypeEsperado: "OUTRO_PAYLOAD",
    capabilityRequerida: "quality.evaluate",
    scopeRequerido: "conta:b",
    papeisPermitidos: ["EVALUATOR"],
    agora: AGORA,
    noncesUsados: new Set(["nonce-unico"]),
  });
  assert.equal(semAutorizacao.valido, false);
  assert.ok(semAutorizacao.bloqueios.includes("payload_type_incompativel"));
  assert.ok(semAutorizacao.bloqueios.includes("capability_ausente"));
  assert.ok(semAutorizacao.bloqueios.includes("scope_ausente"));
  assert.ok(semAutorizacao.bloqueios.includes("papel_nao_permitido"));
  assert.ok(semAutorizacao.bloqueios.includes("nonce_reutilizado"));

  const confiancaRevogada = { ...confianca, revokedKeyIds: [adapter.principal.keyId] };
  const revogada = verificarEnvelopeAssinadoConteudo(
    envelope,
    confiancaRevogada,
    { ...pinsConfianca(confiancaRevogada), payloadTypeEsperado: "EVIDENCE_ATTESTED", agora: AGORA },
  );
  assert.equal(revogada.valido, false);
  assert.ok(revogada.bloqueios.includes("chave_revogada"));

  const antigo = assinar(adapter, "EVIDENCE_ATTESTED", { ok: true }, "nonce-antigo", "2026-07-19T15:00:00.000Z");
  const expirado = verificarEnvelopeAssinadoConteudo(antigo, confianca, {
    ...pinsConfianca(confianca),
    payloadTypeEsperado: "EVIDENCE_ATTESTED",
    agora: AGORA,
  });
  assert.equal(expirado.valido, false);
  assert.ok(expirado.bloqueios.includes("envelope_expirado"));
});

test("recibo do executor continua alegacao e nao satisfaz evidencia deterministica", () => {
  const produtor = criarIdentidade("producer-a", "producer-domain");
  const alegacao: AlegacaoEvidenciaConteudo = {
    ...contextoEvento(),
    kind: "EVIDENCE_CLAIMED",
    claimId: "claim-runner",
    stageId: "qa",
    targetId: TARGET,
    artifactDigest: ARTEFATO,
    evidenceType: "constraints-ok",
    producerId: produtor.principal.principalId,
    claimedAt: AGORA,
  };
  const envelope = assinar(produtor, "EVIDENCE_CLAIMED", alegacao, "nonce-claim");
  const falsoAceito = {
    estado: "ACEITA",
    digest: digestJsonCanonico(envelope),
    principal: produtor.principal,
    envelope,
    payload: alegacao,
  } as unknown as EnvelopeVerificadoConteudo<AtestadoEvidenciaConteudo>;

  const resultado = avaliarGateConteudo({
    gate: politicaGate({ evaluationMode: "DETERMINISTICA", minApprovals: 1, minDistinctControlDomains: 1 }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [falsoAceito],
    pareceresIa: [],
    principals: [produtor.principal],
  });

  assert.equal(resultado.veredito, "NAO_AVALIADO");
  assert.ok(resultado.bloqueios.includes("evidencia_envelope:payload_type_incompativel"));
});

test("gate hibrido aprova apenas evidencia e quorum IA de dominios independentes", () => {
  const scope = [AUTHORIZATION_SCOPE];
  const produtor = criarIdentidade("producer-a", "producer-domain");
  const atestador = criarIdentidade("attester-a", "attester-domain", ["content.evidence.attest:constraints-ok"], scope, ["EVIDENCE_ATTESTER"]);
  const avaliadorA = criarIdentidade("evaluator-a", "evaluator-domain-a", ["quality.evaluate"], scope, ["EVALUATOR"]);
  const avaliadorB = criarIdentidade("evaluator-b", "evaluator-domain-b", ["quality.evaluate"], scope, ["EVALUATOR"]);
  const identidades = [produtor, atestador, avaliadorA, avaliadorB];
  const confianca = configurarConfianca(identidades);

  const resultado = avaliarGateConteudo({
    gate: politicaGate(),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [verificar(criarAtestado(atestador, produtor.principal.principalId), confianca, "EVIDENCE_ATTESTED")],
    pareceresIa: [
      verificar(criarParecer(avaliadorA), confianca, "AI_ASSESSMENT"),
      verificar(criarParecer(avaliadorB), confianca, "AI_ASSESSMENT"),
    ],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.veredito, "APROVADO");
  assert.equal(resultado.aprovacoesValidas, 2);
  assert.equal(resultado.controlDomainsDistintos, 2);
});

test("nomes diferentes sob o mesmo controlDomain nao formam quorum", () => {
  const scope = [AUTHORIZATION_SCOPE];
  const produtor = criarIdentidade("producer-a", "producer-domain");
  const atestador = criarIdentidade("attester-a", "attester-domain", ["content.evidence.attest:constraints-ok"], scope, ["EVIDENCE_ATTESTER"]);
  const avaliadorA = criarIdentidade("evaluator-a", "mesmo-evaluator-domain", ["quality.evaluate"], scope, ["EVALUATOR"]);
  const avaliadorB = criarIdentidade("evaluator-b", "mesmo-evaluator-domain", ["quality.evaluate"], scope, ["EVALUATOR"]);
  const identidades = [produtor, atestador, avaliadorA, avaliadorB];
  const confianca = configurarConfianca(identidades);
  const resultado = avaliarGateConteudo({
    gate: politicaGate(),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [verificar(criarAtestado(atestador, produtor.principal.principalId), confianca, "EVIDENCE_ATTESTED")],
    pareceresIa: [
      verificar(criarParecer(avaliadorA), confianca, "AI_ASSESSMENT"),
      verificar(criarParecer(avaliadorB), confianca, "AI_ASSESSMENT"),
    ],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.veredito, "INCONCLUSIVO");
  assert.equal(resultado.aprovacoesValidas, 2);
  assert.equal(resultado.controlDomainsDistintos, 1);
  assert.ok(resultado.bloqueios.includes("quorum_ia_insuficiente"));
});

test("quorum especializado precisa cobrir todas as capabilities da politica", () => {
  const scope = [AUTHORIZATION_SCOPE];
  const produtor = criarIdentidade("producer-a", "producer-domain", [], [], ["PRODUCER"]);
  const avaliadorA = criarIdentidade("evaluator-a", "domain-a", ["quality.evaluate"], scope, ["EVALUATOR"]);
  const avaliadorB = criarIdentidade("evaluator-b", "domain-b", ["quality.evaluate"], scope, ["EVALUATOR"]);
  const identidades = [produtor, avaliadorA, avaliadorB];
  const confianca = configurarConfianca(identidades);
  const resultado = avaliarGateConteudo({
    gate: politicaGate({
      evaluationMode: "IA_ESPECIALIZADA",
      requiredEvidence: [],
      evaluatorCapabilities: ["quality.evaluate", "safety.evaluate"],
    }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [],
    pareceresIa: [
      verificar(criarParecer(avaliadorA), confianca, "AI_ASSESSMENT"),
      verificar(criarParecer(avaliadorB), confianca, "AI_ASSESSMENT"),
    ],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.aprovacoesValidas, 2);
  assert.equal(resultado.controlDomainsDistintos, 2);
  assert.equal(resultado.veredito, "INCONCLUSIVO");
  assert.ok(resultado.bloqueios.includes("capability_ia_nao_coberta:safety.evaluate"));
});

test("AI_AGENT e compativel somente quando possui a capability autorizada", () => {
  const scope = [AUTHORIZATION_SCOPE];
  const produtor = criarIdentidade("producer-a", "producer-domain", [], [], ["PRODUCER"]);
  const atestadorIa = criarIdentidade(
    "attester-ai",
    "attester-domain",
    ["content.evidence.attest:constraints-ok"],
    scope,
    ["AI_AGENT"],
  );
  const avaliadorIa = criarIdentidade("evaluator-ai", "evaluator-domain", ["quality.evaluate"], scope, ["AI_AGENT"]);
  const identidades = [produtor, atestadorIa, avaliadorIa];
  const confianca = configurarConfianca(identidades);
  const resultado = avaliarGateConteudo({
    gate: politicaGate({ minApprovals: 1, minDistinctControlDomains: 1 }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [verificar(criarAtestado(atestadorIa, produtor.principal.principalId), confianca, "EVIDENCE_ATTESTED")],
    pareceresIa: [verificar(criarParecer(avaliadorIa), confianca, "AI_ASSESSMENT")],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.veredito, "APROVADO");
});

test("produtor nao aprova o proprio artefato e vinculos divergentes nao contam", () => {
  const scope = [AUTHORIZATION_SCOPE];
  const produtor = criarIdentidade("producer-a", "producer-domain", ["quality.evaluate"], scope, ["PRODUCER", "EVALUATOR"]);
  const atestador = criarIdentidade("attester-a", "attester-domain", ["content.evidence.attest:constraints-ok"], scope, ["EVIDENCE_ATTESTER"]);
  const outro = criarIdentidade("evaluator-b", "evaluator-domain-b", ["quality.evaluate"], scope, ["EVALUATOR"]);
  const identidades = [produtor, atestador, outro];
  const confianca = configurarConfianca(identidades);

  const resultado = avaliarGateConteudo({
    gate: politicaGate({ minApprovals: 1, minDistinctControlDomains: 1 }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [verificar(criarAtestado(atestador, produtor.principal.principalId), confianca, "EVIDENCE_ATTESTED")],
    pareceresIa: [
      verificar(criarParecer(produtor), confianca, "AI_ASSESSMENT"),
      verificar(
        criarParecer(outro, "APROVADO", { rubricDigest: "sha256:outra-rubrica" }),
        confianca,
        "AI_ASSESSMENT",
      ),
    ],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.veredito, "INCONCLUSIVO");
  assert.equal(resultado.aprovacoesValidas, 0);
  assert.ok(resultado.bloqueios.some((item) => item.endsWith("produtor_ou_ancestral_e_avaliador_nao_disjuntos")));
  assert.ok(resultado.bloqueios.some((item) => item.endsWith("rubric_digest_divergente")));
});

test("produtor nao pode atestar sozinho evidencia deterministica critica", () => {
  const scope = [AUTHORIZATION_SCOPE];
  const produtor = criarIdentidade("producer-a", "producer-domain", ["content.evidence.attest:constraints-ok"], scope, ["PRODUCER", "EVIDENCE_ATTESTER"]);
  const confianca = configurarConfianca([produtor]);
  const resultado = avaliarGateConteudo({
    gate: politicaGate({
      evaluationMode: "DETERMINISTICA",
      minApprovals: 1,
      minDistinctControlDomains: 1,
    }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [verificar(criarAtestado(produtor, produtor.principal.principalId), confianca, "EVIDENCE_ATTESTED")],
    pareceresIa: [],
    principals: [produtor.principal],
  });

  assert.equal(resultado.veredito, "NAO_AVALIADO");
  assert.ok(resultado.bloqueios.some((item) => item.endsWith("produtor_ou_ancestral_e_atestador_nao_disjuntos")));
});

test("evidencia deterministica respeita quorum de atestadores e dominios por tipo", () => {
  const scope = [AUTHORIZATION_SCOPE];
  const produtor = criarIdentidade("producer-quorum-evidence", "producer-quorum-domain", [], [], ["PRODUCER"]);
  const atestadorA = criarIdentidade(
    "attester-quorum-a",
    "attester-shared-domain",
    ["content.evidence.attest:constraints-ok"],
    scope,
    ["EVIDENCE_ATTESTER"],
  );
  const atestadorB = criarIdentidade(
    "attester-quorum-b",
    "attester-shared-domain",
    ["content.evidence.attest:constraints-ok"],
    scope,
    ["EVIDENCE_ATTESTER"],
  );
  const identidades = [produtor, atestadorA, atestadorB];
  const confianca = configurarConfianca(identidades);
  const gate = politicaGate({
    evaluationMode: "DETERMINISTICA",
    minAttestationsPerEvidence: 2,
    minDistinctAttesterControlDomains: 2,
    minApprovals: 1,
    minDistinctControlDomains: 1,
  });
  const resultado = avaliarGateConteudo({
    gate,
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [
      verificar(criarAtestado(atestadorA, produtor.principal.principalId), confianca, "EVIDENCE_ATTESTED"),
      verificar(criarAtestado(atestadorB, produtor.principal.principalId), confianca, "EVIDENCE_ATTESTED"),
    ],
    pareceresIa: [],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.veredito, "INCONCLUSIVO");
  assert.ok(resultado.bloqueios.includes("dominios_atestadores_insuficientes:constraints-ok"));
});

test("parecer assinado para outro run nao pode ser reutilizado", () => {
  const produtor = criarIdentidade("producer-a", "producer-domain", [], [], ["PRODUCER"]);
  const avaliador = criarIdentidade(
    "evaluator-a",
    "evaluator-domain",
    ["quality.evaluate"],
    [AUTHORIZATION_SCOPE],
    ["EVALUATOR"],
  );
  const identidades = [produtor, avaliador];
  const confianca = configurarConfianca(identidades);
  const parecerOutroRun = criarParecer(avaliador, "APROVADO", { runId: "run-anterior" });
  const resultado = avaliarGateConteudo({
    gate: politicaGate({
      evaluationMode: "IA_ESPECIALIZADA",
      requiredEvidence: [],
      minApprovals: 1,
      minDistinctControlDomains: 1,
    }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [],
    pareceresIa: [verificar(parecerOutroRun, confianca, "AI_ASSESSMENT")],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.veredito, "NAO_AVALIADO");
  assert.ok(resultado.bloqueios.some((item) => item.endsWith("run_divergente")));
});

test("parecer de outra conta nao atravessa authorizationScope mesmo com principal multi-scope", () => {
  const outroScope = "run:run-1:target:target-arbitrario-1:account:outra-account";
  const produtor = criarIdentidade("producer-a", "producer-domain", [], [], ["PRODUCER"]);
  const avaliador = criarIdentidade(
    "evaluator-a",
    "evaluator-domain",
    ["quality.evaluate"],
    [AUTHORIZATION_SCOPE, outroScope],
    ["EVALUATOR"],
  );
  const identidades = [produtor, avaliador];
  const confianca = configurarConfianca(identidades);
  const resultado = avaliarGateConteudo({
    gate: politicaGate({
      evaluationMode: "IA_ESPECIALIZADA",
      requiredEvidence: [],
      minApprovals: 1,
      minDistinctControlDomains: 1,
    }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: outroScope,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [],
    pareceresIa: [verificar(criarParecer(avaliador), confianca, "AI_ASSESSMENT")],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.veredito, "NAO_AVALIADO");
  assert.ok(resultado.bloqueios.some((item) => item.endsWith("authorization_scope_divergente")));
});

test("ancestral da linhagem nao pode avaliar artefato descendente", () => {
  const produtor = criarIdentidade("producer-child", "producer-child-domain", [], [], ["PRODUCER"]);
  const ancestral = criarIdentidade(
    "producer-parent",
    "producer-parent-domain",
    ["quality.evaluate"],
    [AUTHORIZATION_SCOPE],
    ["PRODUCER", "EVALUATOR"],
  );
  const identidades = [produtor, ancestral];
  const confianca = configurarConfianca(identidades);
  const resultado = avaliarGateConteudo({
    gate: politicaGate({
      evaluationMode: "IA_ESPECIALIZADA",
      requiredEvidence: [],
      minApprovals: 1,
      minDistinctControlDomains: 1,
    }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId, ancestral.principal.principalId],
    evidenciasAceitas: [],
    pareceresIa: [verificar(criarParecer(ancestral), confianca, "AI_ASSESSMENT")],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.veredito, "NAO_AVALIADO");
  assert.ok(
    resultado.bloqueios.some((item) => item.endsWith("produtor_ou_ancestral_e_avaliador_nao_disjuntos")),
  );
});

test("rejeicao especializada vinculada e obrigatoria reprova o gate", () => {
  const scope = [AUTHORIZATION_SCOPE];
  const produtor = criarIdentidade("producer-a", "producer-domain");
  const avaliador = criarIdentidade("evaluator-a", "evaluator-domain", ["quality.evaluate"], scope, ["EVALUATOR"]);
  const identidades = [produtor, avaliador];
  const confianca = configurarConfianca(identidades);
  const resultado = avaliarGateConteudo({
    gate: politicaGate({
      evaluationMode: "IA_ESPECIALIZADA",
      requiredEvidence: [],
      minApprovals: 1,
      minDistinctControlDomains: 1,
    }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [],
    pareceresIa: [verificar(criarParecer(avaliador, "REPROVADO"), confianca, "AI_ASSESSMENT")],
    principals: identidades.map((item) => item.principal),
  });

  assert.equal(resultado.veredito, "REPROVADO");
  assert.equal(resultado.aprovacoesValidas, 0);
});

test("gate sem evidencia nem parecer permanece NAO_AVALIADO", () => {
  const produtor = criarIdentidade("producer-a", "producer-domain");
  const resultado = avaliarGateConteudo({
    gate: politicaGate({ evaluationMode: "IA_ESPECIALIZADA", requiredEvidence: [] }),
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [],
    pareceresIa: [],
    principals: [produtor.principal],
  });
  assert.equal(resultado.veredito, "NAO_AVALIADO");
});

test("gate solto enfraquecido nao pode reutilizar digest de politica assinada", () => {
  const produtor = criarIdentidade("producer-policy-binding", "producer-policy-domain", [], [], ["PRODUCER"]);
  const gateAssinado = politicaGate({
    evaluationMode: "IA_ESPECIALIZADA",
    requiredEvidence: [],
    minApprovals: 2,
    minDistinctControlDomains: 2,
  });
  const resultado = avaliarGateConteudo({
    gate: { ...gateAssinado, minApprovals: 1, minDistinctControlDomains: 1 },
    gateAssinado,
    artifactDigest: ARTEFATO,
    targetId: TARGET,
    runId: RUN,
    authorizationScope: AUTHORIZATION_SCOPE,
    producerId: produtor.principal.principalId,
    producerLineageIds: [produtor.principal.principalId],
    evidenciasAceitas: [],
    pareceresIa: [],
    principals: [produtor.principal],
  });

  assert.equal(resultado.veredito, "NAO_AVALIADO");
  assert.ok(resultado.bloqueios.includes("politica_assinada_contexto_ou_gate_divergente"));
});
