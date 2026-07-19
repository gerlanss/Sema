// SEMA-GOVERNED: sema.produto.pipeline_conteudo.cli
// Descrição: smoke real da CLI de conteúdo com política e eventos Ed25519.

import assert from "node:assert/strict";
import { generateKeyPairSync, type KeyObject } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { assinarEnvelopeConteudo, hashCanonicoConteudo } from "../../pacotes/cli/src/pipelineConteudo/canonical.js";
import { escopoAutorizacaoGlobal } from "../../pacotes/cli/src/pipelineConteudo/adapters.js";
import { comandoPipelineConteudo } from "../../pacotes/cli/src/pipelineConteudo/command.js";
import { anexarEventoLedgerConteudo, HEAD_GENESIS_LEDGER_CONTEUDO } from "../../pacotes/cli/src/pipelineConteudo/ledger.js";
import { validarDefinicaoPipelineConteudo } from "../../pacotes/cli/src/pipelineConteudo/planner.js";
import {
  digestConfiguracaoConfiancaConteudo,
  digestRevogacoesConfiancaConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/trust.js";
import type {
  AlegacaoEvidenciaConteudo,
  ArtefatoConteudo,
  AtestadoEvidenciaConteudo,
  ConfiguracaoConfiancaConteudo,
  DefinicaoPipelineConteudo,
  EnvelopeAssinadoConteudo,
  EventoLedgerConteudo,
  EventoPayloadConteudo,
  InicioExecucaoConteudo,
  PoliticaConfiancaConteudo,
  PrincipalConteudo,
} from "../../pacotes/cli/src/pipelineConteudo/types.js";

interface IdentidadeCliTeste {
  readonly principal: PrincipalConteudo;
  readonly privateKey: KeyObject;
}

function identidade(
  principalId: string,
  controlDomain: string,
  papeis: readonly string[],
  capabilities: readonly string[] = [],
  scopes: readonly string[] = ["GLOBAL"],
): IdentidadeCliTeste {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
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

function envelope<T>(
  ator: IdentidadeCliTeste,
  payloadType: string,
  payload: T,
  nonce: string,
  issuedAt: string,
): EnvelopeAssinadoConteudo<T> {
  return assinarEnvelopeConteudo({
    schemaVersion: "sema.content/v1",
    payloadType,
    payload,
    principalId: ator.principal.principalId,
    keyId: ator.principal.keyId,
    issuedAt,
    nonce,
    signatureAlgorithm: "Ed25519",
  }, ator.privateKey);
}

async function executarComando(args: string[]): Promise<{ codigo: number; payload: any }> {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...itens: unknown[]) => logs.push(itens.map(String).join(" "));
  try {
    const codigo = await comandoPipelineConteudo([], args, true);
    assert.ok(logs.length > 0, "comando deve emitir payload");
    return { codigo, payload: JSON.parse(logs.at(-1)!) };
  } finally {
    console.log = original;
  }
}

function definicaoMinima(): DefinicaoPipelineConteudo {
  return {
    schemaVersion: "sema.content.pipeline/v1",
    pipelineId: "pipeline-cli-arbitrario",
    version: "1.0.0",
    stages: [{
      stageId: "master",
      capability: "content.master.compose",
      scope: "GLOBAL",
      adapterPolicy: "NONE",
      dependsOn: [],
      produces: ["master"],
      gateIds: ["gate-master"],
    }],
    gates: [{
      gateId: "gate-master",
      stageId: "master",
      scope: "GLOBAL",
      evaluationMode: "DETERMINISTICA",
      requiredEvidence: ["artifact.bytes.observed"],
      evaluatorCapabilities: [],
      minAttestationsPerEvidence: 1,
      minDistinctAttesterControlDomains: 1,
      minApprovals: 1,
      minDistinctControlDomains: 1,
      producerDisjoint: true,
      rejectionIsBinding: true,
      rubricDigest: `sha256:${"1".repeat(64)}`,
    }],
    adapters: [{
      adapterId: "destination.arbitrary",
      version: "1.0.0",
      capabilities: ["content.target.deliver"],
      acceptedMediaTypes: ["application/octet-stream"],
      formatProfiles: ["opaque"],
      deterministicConstraints: [{ constraintId: "non-empty", kind: "artifact.bytes.min", config: { minimum: 1 } }],
      requiredMetadata: [],
      optionalMetadata: [],
      confirmationPredicates: ["destination.delivery.observed"],
    }],
    requiredCompletionGates: ["gate-master"],
  };
}

const ALVO_CLI_TESTE = {
  targetId: "target-cli",
  adapterId: "destination.arbitrary",
  accountScope: "account:cli",
  formatProfileId: "opaque",
  locale: "pt-BR",
  metadata: {},
} as const;

test("CLI expoe ajuda autodescritiva para o runner IA", async () => {
  const ajuda = await executarComando(["--help", "--json"]);
  assert.equal(ajuda.codigo, 0);
  assert.equal(ajuda.payload.comando, "ajuda");
  assert.equal(ajuda.payload.nativeHumanReview, false);
  assert.equal(ajuda.payload.runner, "external");
  assert.equal(ajuda.payload.canonicalState, "signed_hash_chained_ledger");
  assert.match(ajuda.payload.mensagem, /sema conteudo validar-envelope/u);
  assert.match(ajuda.payload.mensagem, /nextActions/u);
  assert.match(ajuda.payload.mensagem, /Não existe revisão humana nativa/u);
});

test("CLI falha fechado sem ecoar subcomando, caminho ou JSON controlado", async () => {
  const segredo = `ghp_${"X".repeat(40)}`;
  const desconhecido = await executarComando([segredo, "--json"]);
  assert.equal(desconhecido.codigo, 1);
  assert.equal(desconhecido.payload.comando, "desconhecido");
  assert.equal(desconhecido.payload.erro, "subcomando_conteudo_desconhecido");
  assert.equal(JSON.stringify(desconhecido.payload).includes(segredo), false);

  const base = await mkdtemp(path.join(tmpdir(), "sema-content-cli-no-echo-"));
  try {
    const arquivoControlado = path.join(base, `${segredo}.json`);
    await writeFile(arquivoControlado, `{${segredo}`, "utf8");
    const invalido = await executarComando(["validar", arquivoControlado, "--json"]);
    assert.equal(invalido.codigo, 1);
    assert.equal(invalido.payload.erro, "json_invalido");
    assert.equal(JSON.stringify(invalido.payload).includes(segredo), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("CLI registra evento somente com assinatura, papel e expected-head válidos", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sema-content-cli-register-"));
  try {
    const authority = identidade("policy-register", "control-policy-register", ["POLICY_AUTHORITY"]);
    const controller = identidade("controller", "control-controller", ["PIPELINE_CONTROLLER"]);
    const confianca: ConfiguracaoConfiancaConteudo = {
      trustDomainId: "trust-cli",
      principals: [authority.principal, controller.principal],
      revokedKeyIds: [],
      maxEnvelopeAgeMs: 60_000,
      maxFutureSkewMs: 1_000,
      schemaVersionsAceitas: ["sema.content/v1"],
    };
    const agora = new Date().toISOString();
    const politica: PoliticaConfiancaConteudo = {
      policyId: "policy-register",
      version: "1.0.0",
      runId: "run-register",
      trustDomainId: confianca.trustDomainId,
      trustRootDigest: digestConfiguracaoConfiancaConteudo(confianca),
      definitionDigest: `sha256:${"a".repeat(64)}`,
      targetSetDigest: hashCanonicoConteudo([ALVO_CLI_TESTE]),
      ledgerId: "ledger-register",
      gates: [],
      issuedAt: agora,
      expiresAt: new Date(Date.parse(agora) + 5 * 60 * 1000).toISOString(),
    };
    const inicio: InicioExecucaoConteudo = {
      kind: "RUN_STARTED",
      runId: "run-register",
      trustDomainId: confianca.trustDomainId,
      trustRootDigest: digestConfiguracaoConfiancaConteudo(confianca),
      ledgerId: "ledger-register",
      definitionDigest: politica.definitionDigest,
      policyDigest: hashCanonicoConteudo(politica),
      targets: [ALVO_CLI_TESTE],
      startedAt: agora,
    };
    const envelopeArquivo = path.join(base, "envelope.json");
    const trustArquivo = path.join(base, "trust.json");
    const policyArquivo = path.join(base, "policy.json");
    const ledgerArquivo = path.join(base, "ledger.ndjson");
    await writeFile(envelopeArquivo, JSON.stringify(envelope(controller, "RUN_STARTED", inicio, "nonce-register", agora)), "utf8");
    await writeFile(trustArquivo, JSON.stringify(confianca), "utf8");
    await writeFile(policyArquivo, JSON.stringify(envelope(authority, "TRUST_POLICY", politica, "nonce-policy-register", agora)), "utf8");

    const falha = await executarComando([
      "registrar", ledgerArquivo,
      "--envelope-arquivo", envelopeArquivo,
      "--confianca-arquivo", trustArquivo,
      "--politica-arquivo", policyArquivo,
      "--trust-root-digest", digestConfiguracaoConfiancaConteudo(confianca),
      "--revocation-digest", digestRevogacoesConfiancaConteudo(confianca),
      "--ledger-id", "ledger-register",
      "--expected-head", `sha256:${"f".repeat(64)}`,
      "--json",
    ]);
    assert.equal(falha.codigo, 1);
    assert.match(falha.payload.erro, /expected_head_divergente/u);

    const sucesso = await executarComando([
      "registrar", ledgerArquivo,
      "--envelope-arquivo", envelopeArquivo,
      "--confianca-arquivo", trustArquivo,
      "--politica-arquivo", policyArquivo,
      "--trust-root-digest", digestConfiguracaoConfiancaConteudo(confianca),
      "--revocation-digest", digestRevogacoesConfiancaConteudo(confianca),
      "--ledger-id", "ledger-register",
      "--expected-head", HEAD_GENESIS_LEDGER_CONTEUDO,
      "--json",
    ]);
    assert.equal(sucesso.codigo, 0);
    assert.equal(sucesso.payload.backend, "ndjson_local_nao_worm");
    assert.equal((await readFile(ledgerArquivo, "utf8")).trim().split(/\r?\n/u).length, 1);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("CLI verifica política assinada, deriva status e projeta manifesto não autoritativo", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sema-content-cli-state-"));
  try {
    const runId = "run-cli-state";
    const authorizationScope = escopoAutorizacaoGlobal(runId);
    const authority = identidade("policy", "control-policy", ["POLICY_AUTHORITY"]);
    const controller = identidade("controller", "control-controller", ["PIPELINE_CONTROLLER"]);
    const producer = identidade(
      "producer",
      "control-producer",
      ["PRODUCER"],
      ["content.master.compose"],
      [authorizationScope],
    );
    const attester = identidade(
      "attester",
      "control-attester",
      ["EVIDENCE_ATTESTER"],
      ["content.evidence.attest:artifact.bytes.observed"],
      [authorizationScope],
    );
    const principals = [authority, controller, producer, attester];
    const confianca: ConfiguracaoConfiancaConteudo = {
      trustDomainId: "trust-cli-state",
      principals: principals.map((item) => item.principal),
      revokedKeyIds: [],
      maxEnvelopeAgeMs: 60_000,
      maxFutureSkewMs: 1_000,
      schemaVersionsAceitas: ["sema.content/v1"],
    };
    const definicao = definicaoMinima();
    const validacaoDefinicao = validarDefinicaoPipelineConteudo(definicao);
    assert.equal(validacaoDefinicao.valida, true, validacaoDefinicao.bloqueios.join(","));
    const agora = new Date().toISOString();
    const politica: PoliticaConfiancaConteudo = {
      policyId: "policy-cli",
      version: "1.0.0",
      runId,
      trustDomainId: confianca.trustDomainId,
      trustRootDigest: digestConfiguracaoConfiancaConteudo(confianca),
      definitionDigest: validacaoDefinicao.definitionDigest,
      targetSetDigest: hashCanonicoConteudo([ALVO_CLI_TESTE]),
      ledgerId: "ledger-cli-state",
      gates: definicao.gates,
      issuedAt: agora,
      expiresAt: new Date(Date.parse(agora) + 5 * 60 * 1000).toISOString(),
    };
    const envelopePolitica = envelope(authority, "TRUST_POLICY", politica, "nonce-policy", agora);
    const inicio: InicioExecucaoConteudo = {
      kind: "RUN_STARTED",
      runId,
      trustDomainId: confianca.trustDomainId,
      trustRootDigest: politica.trustRootDigest,
      ledgerId: politica.ledgerId,
      definitionDigest: validacaoDefinicao.definitionDigest,
      policyDigest: hashCanonicoConteudo(politica),
      targets: [ALVO_CLI_TESTE],
      startedAt: agora,
    };
    const artefato: ArtefatoConteudo = {
      kind: "ARTIFACT_REGISTERED",
      artifactId: "artifact-master",
      runId: inicio.runId,
      trustDomainId: inicio.trustDomainId,
      trustRootDigest: inicio.trustRootDigest,
      ledgerId: inicio.ledgerId,
      policyDigest: inicio.policyDigest,
      definitionDigest: inicio.definitionDigest,
      authorizationScope,
      stageId: "master",
      producerId: producer.principal.principalId,
      producerLineageIds: [producer.principal.principalId],
      version: "1",
      artifactType: "master",
      mediaType: "application/octet-stream",
      digest: `sha256:${"c".repeat(64)}`,
      lineageDigests: [],
    };
    const alegacao: AlegacaoEvidenciaConteudo = {
      kind: "EVIDENCE_CLAIMED",
      claimId: "claim-master",
      runId: inicio.runId,
      trustDomainId: inicio.trustDomainId,
      trustRootDigest: inicio.trustRootDigest,
      ledgerId: inicio.ledgerId,
      policyDigest: inicio.policyDigest,
      definitionDigest: inicio.definitionDigest,
      authorizationScope,
      stageId: "master",
      artifactDigest: artefato.digest,
      evidenceType: "artifact.bytes.observed",
      producerId: producer.principal.principalId,
      claimedAt: agora,
    };
    const atestado: AtestadoEvidenciaConteudo = {
      kind: "EVIDENCE_ATTESTED",
      evidenceId: "evidence-master",
      claimId: alegacao.claimId,
      runId: inicio.runId,
      trustDomainId: inicio.trustDomainId,
      trustRootDigest: inicio.trustRootDigest,
      ledgerId: inicio.ledgerId,
      policyDigest: inicio.policyDigest,
      definitionDigest: inicio.definitionDigest,
      authorizationScope,
      gateId: "gate-master",
      stageId: "master",
      artifactDigest: artefato.digest,
      evidenceType: alegacao.evidenceType,
      producerId: producer.principal.principalId,
      attesterId: attester.principal.principalId,
      result: "APROVADO",
      observedAt: agora,
    };

    const envelopes: Array<EnvelopeAssinadoConteudo<EventoPayloadConteudo>> = [
      envelope(controller, "RUN_STARTED", inicio, "nonce-start", agora),
      envelope(producer, "ARTIFACT_REGISTERED", artefato, "nonce-artifact", agora),
      envelope(producer, "CLAIM_SUBMITTED", alegacao, "nonce-claim", agora),
      envelope(attester, "EVIDENCE_ATTESTED", atestado, "nonce-attest", agora),
    ];
    let eventos: readonly EventoLedgerConteudo<EventoPayloadConteudo>[] = [];
    let head = HEAD_GENESIS_LEDGER_CONTEUDO;
    envelopes.forEach((item, indice) => {
      const anexado = anexarEventoLedgerConteudo(eventos, {
        ledgerId: politica.ledgerId,
        expectedHead: head,
        schemaVersion: "sema.content/v1",
        eventId: `event-${indice}`,
        recordedAt: agora,
        envelope: item,
        envelopePolitica,
        configuracaoConfianca: confianca,
        trustRootDigestEsperado: digestConfiguracaoConfiancaConteudo(confianca),
        revocationDigestEsperado: digestRevogacoesConfiancaConteudo(confianca),
      });
      eventos = anexado.eventos;
      head = anexado.head;
    });

    const definicaoArquivo = path.join(base, "definition.json");
    const trustArquivo = path.join(base, "trust.json");
    const policyArquivo = path.join(base, "policy.json");
    const ledgerArquivo = path.join(base, "ledger.ndjson");
    const manifestoArquivo = path.join(base, "manifest.json");
    await Promise.all([
      writeFile(definicaoArquivo, JSON.stringify(definicao), "utf8"),
      writeFile(trustArquivo, JSON.stringify(confianca), "utf8"),
      writeFile(policyArquivo, JSON.stringify(envelopePolitica), "utf8"),
      writeFile(ledgerArquivo, `${eventos.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8"),
    ]);

    const argumentosBase = [
      definicaoArquivo,
      "--politica-arquivo", policyArquivo,
      "--confianca-arquivo", trustArquivo,
      "--trust-root-digest", digestConfiguracaoConfiancaConteudo(confianca),
      "--revocation-digest", digestRevogacoesConfiancaConteudo(confianca),
      "--ledger-arquivo", ledgerArquivo,
      "--expected-head", head,
      "--json",
    ];
    const status = await executarComando(["status", ...argumentosBase]);
    assert.equal(status.codigo, 0, status.payload.erro);
    assert.equal(status.payload.estado.concluido, true);
    assert.equal(status.payload.estado.estadosGate[0].veredito, "APROVADO");
    assert.equal(status.payload.estado.estadosGate[0].condition, "PRONTA");

    const projetar = await executarComando(["projetar", ...argumentosBase, "--saida", manifestoArquivo]);
    assert.equal(projetar.codigo, 0, projetar.payload.erro);
    const manifesto = JSON.parse(await readFile(manifestoArquivo, "utf8"));
    assert.equal(manifesto.authoritative, false);
    assert.equal(manifesto.ledgerHead, head);
    assert.equal("concluido" in manifesto, false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
