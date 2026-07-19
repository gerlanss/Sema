// SEMA-GOVERNED: sema.produto.pipeline_conteudo.confianca
// Descricao: verifica envelopes contra raiz publica e deriva gates sem transformar recibo do executor em evidencia.

import { createPublicKey } from "node:crypto";
import {
  digestEnvelopeConteudo,
  digestJsonCanonico,
  digestSha256,
  verificarAssinaturaEnvelopeConteudo,
} from "./canonical.js";
import type {
  AtestadoEvidenciaConteudo,
  ConfiguracaoConfiancaConteudo,
  EntradaAvaliacaoGateConteudo,
  EnvelopeAssinadoConteudo,
  EnvelopeVerificadoConteudo,
  OpcoesVerificacaoEnvelopeConteudo,
  ParecerIAConteudo,
  PrincipalConteudo,
  ResultadoAvaliacaoGateConteudo,
  ResultadoValidacaoConfiguracaoConfiancaConteudo,
  ResultadoVerificacaoEnvelopeConteudo,
} from "./types.js";

const IDADE_MAXIMA_PADRAO_MS = 5 * 60 * 1000;
const DESVIO_FUTURO_PADRAO_MS = 30 * 1000;
const CAMPOS_CONFIANCA = new Set([
  "trustDomainId", "principals", "revokedKeyIds", "maxEnvelopeAgeMs", "maxFutureSkewMs", "schemaVersionsAceitas",
]);
const CAMPOS_PRINCIPAL = new Set([
  "principalId", "keyId", "controlDomain", "papeis", "capabilities", "scopes", "publicKeyPem",
]);
const CAMPOS_ENVELOPE = new Set([
  "schemaVersion", "payloadType", "payload", "principalId", "keyId", "issuedAt", "nonce",
  "signatureAlgorithm", "signature",
]);

function adicionarBloqueio(bloqueios: string[], bloqueio: string): void {
  if (!bloqueios.includes(bloqueio)) bloqueios.push(bloqueio);
}

function textoNaoVazio(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function textoOpacoNormalizado(valor: unknown): valor is string {
  return typeof valor === "string" &&
    valor.length > 0 &&
    valor === valor.trim() &&
    !/[\s\u0000-\u001f\u007f]/u.test(valor);
}

function listaOpacaUnica(valor: unknown): valor is readonly string[] {
  return Array.isArray(valor) && valor.every(textoOpacoNormalizado) && new Set(valor).size === valor.length;
}

function timestampMs(valor: string | Date | number | undefined): number {
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === "number") return valor;
  return valor === undefined ? Date.now() : Date.parse(valor);
}

function limiteSeguro(
  valorConfigurado: number | undefined,
  valorDaChamada: number | undefined,
  padrao: number,
): number {
  if (valorConfigurado === undefined) return valorDaChamada ?? padrao;
  if (valorDaChamada === undefined) return valorConfigurado;
  return Math.min(valorConfigurado, valorDaChamada);
}

function valoresOrdenados(valores: readonly string[]): string[] {
  return [...valores].sort();
}

function configuracaoConfiancaCanonica(confianca: ConfiguracaoConfiancaConteudo): object {
  // Revogacoes sao overlay operacional mutavel. O digest pina o snapshot
  // imutavel de principals, papeis, scopes, dominios e parametros de verificacao.
  const raiz: Record<string, unknown> = {
    trustDomainId: confianca.trustDomainId,
    principals: [...confianca.principals]
      .map((principal) => ({
        principalId: principal.principalId,
        keyId: principal.keyId,
        controlDomain: principal.controlDomain,
        papeis: valoresOrdenados(principal.papeis),
        capabilities: valoresOrdenados(principal.capabilities),
        scopes: valoresOrdenados(principal.scopes),
        publicKeyPem: principal.publicKeyPem,
      }))
      .sort((a, b) => {
        const chaveA = `${a.principalId}\u0000${a.keyId}`;
        const chaveB = `${b.principalId}\u0000${b.keyId}`;
        return chaveA < chaveB ? -1 : chaveA > chaveB ? 1 : 0;
      }),
  };
  if (confianca.maxEnvelopeAgeMs !== undefined) raiz.maxEnvelopeAgeMs = confianca.maxEnvelopeAgeMs;
  if (confianca.maxFutureSkewMs !== undefined) raiz.maxFutureSkewMs = confianca.maxFutureSkewMs;
  if (confianca.schemaVersionsAceitas !== undefined) {
    raiz.schemaVersionsAceitas = valoresOrdenados(confianca.schemaVersionsAceitas);
  }
  return raiz;
}

export function digestConfiguracaoConfiancaConteudo(confianca: ConfiguracaoConfiancaConteudo): string {
  return digestJsonCanonico(configuracaoConfiancaCanonica(confianca));
}

export function digestRevogacoesConfiancaConteudo(confianca: ConfiguracaoConfiancaConteudo): string {
  return digestJsonCanonico({
    trustDomainId: confianca.trustDomainId,
    revokedKeyIds: valoresOrdenados(confianca.revokedKeyIds),
  });
}

export function validarConfiguracaoConfiancaConteudo(
  confianca: ConfiguracaoConfiancaConteudo,
  trustRootDigestEsperado: string,
  revocationDigestEsperado: string,
): ResultadoValidacaoConfiguracaoConfiancaConteudo {
  const bloqueios: string[] = [];
  const fingerprints: string[] = [];
  const trustRootDigest = digestConfiguracaoConfiancaConteudo(confianca);
  const revocationDigest = digestRevogacoesConfiancaConteudo(confianca);
  if (Object.keys(confianca as unknown as Record<string, unknown>).some((chave) => /private.?key/i.test(chave))) {
    adicionarBloqueio(bloqueios, "chave_privada_na_configuracao");
  }
  for (const campo of Object.keys(confianca as unknown as Record<string, unknown>)) {
    if (!CAMPOS_CONFIANCA.has(campo)) adicionarBloqueio(bloqueios, "campo_confianca_nao_permitido");
  }
  if (!textoOpacoNormalizado(confianca.trustDomainId)) adicionarBloqueio(bloqueios, "trust_domain_id_invalido");
  if (confianca.principals.length === 0) adicionarBloqueio(bloqueios, "principals_ausentes");

  const principalIds = new Set<string>();
  const keyIds = new Set<string>();
  const fingerprintsVistos = new Map<string, PrincipalConteudo>();
  for (const principal of confianca.principals) {
    for (const campo of Object.keys(principal as unknown as Record<string, unknown>)) {
      if (!CAMPOS_PRINCIPAL.has(campo)) {
        adicionarBloqueio(bloqueios, "campo_principal_nao_permitido");
      }
    }
    if (!textoOpacoNormalizado(principal.principalId)) adicionarBloqueio(bloqueios, "principal_id_invalido");
    if (!textoOpacoNormalizado(principal.keyId)) adicionarBloqueio(bloqueios, "key_id_invalido");
    if (
      !textoOpacoNormalizado(principal.controlDomain) ||
      principal.controlDomain !== principal.controlDomain.toLowerCase()
    ) adicionarBloqueio(bloqueios, "control_domain_invalido");
    if (!listaOpacaUnica(principal.papeis)) adicionarBloqueio(bloqueios, "papeis_invalidos");
    if (!listaOpacaUnica(principal.capabilities)) adicionarBloqueio(bloqueios, "capabilities_invalidas");
    if (!listaOpacaUnica(principal.scopes)) adicionarBloqueio(bloqueios, "scopes_invalidos");
    if (principalIds.has(principal.principalId)) adicionarBloqueio(bloqueios, "principal_id_duplicado");
    if (keyIds.has(principal.keyId)) adicionarBloqueio(bloqueios, "key_id_duplicado");
    principalIds.add(principal.principalId);
    keyIds.add(principal.keyId);

    if (Object.keys(principal as unknown as Record<string, unknown>).some((chave) => /private.?key/i.test(chave))) {
      adicionarBloqueio(bloqueios, "chave_privada_na_configuracao");
    }
    if (
      typeof principal.publicKeyPem !== "string" ||
      !/^-----BEGIN PUBLIC KEY-----\r?\n[\s\S]+\r?\n-----END PUBLIC KEY-----\r?\n?$/u.test(principal.publicKeyPem) ||
      /PRIVATE KEY/u.test(principal.publicKeyPem)
    ) {
      adicionarBloqueio(bloqueios, "public_key_pem_nao_spki_publica");
      continue;
    }
    try {
      const publicKey = createPublicKey(principal.publicKeyPem);
      if (publicKey.asymmetricKeyType !== "ed25519") {
        adicionarBloqueio(bloqueios, "chave_publica_nao_ed25519");
        continue;
      }
      const spki = publicKey.export({ type: "spki", format: "der" });
      const fingerprint = digestSha256(spki);
      fingerprints.push(fingerprint);
      const anterior = fingerprintsVistos.get(fingerprint);
      if (anterior !== undefined) {
        adicionarBloqueio(bloqueios, "fingerprint_duplicado");
      } else {
        fingerprintsVistos.set(fingerprint, principal);
      }
    } catch {
      adicionarBloqueio(bloqueios, "chave_publica_invalida");
    }
  }

  const revogadasVistas = new Set<string>();
  for (const keyId of confianca.revokedKeyIds) {
    if (!keyIds.has(keyId)) adicionarBloqueio(bloqueios, "chave_revogada_desconhecida");
    if (revogadasVistas.has(keyId)) adicionarBloqueio(bloqueios, "chave_revogada_duplicada");
    revogadasVistas.add(keyId);
  }
  if (!textoNaoVazio(trustRootDigestEsperado) || trustRootDigest !== trustRootDigestEsperado) {
    adicionarBloqueio(bloqueios, "trust_root_digest_divergente");
  }
  if (!textoNaoVazio(revocationDigestEsperado) || revocationDigest !== revocationDigestEsperado) {
    adicionarBloqueio(bloqueios, "revocation_digest_divergente");
  }
  return { valida: bloqueios.length === 0, trustRootDigest, revocationDigest, fingerprints, bloqueios };
}

function digestInvalido(envelope: EnvelopeAssinadoConteudo<unknown>): string {
  const partes = [
    envelope.schemaVersion,
    envelope.payloadType,
    envelope.principalId,
    envelope.keyId,
    envelope.issuedAt,
    envelope.nonce,
    envelope.signature,
  ].map((parte) => (typeof parte === "string" ? parte : String(parte)));
  return digestSha256(`envelope-nao-canonico\u0000${partes.join("\u0000")}`);
}

function verificarEnvelopeAssinadoConteudoComRaizValidada<TPayload>(
  envelope: EnvelopeAssinadoConteudo<TPayload>,
  confianca: ConfiguracaoConfiancaConteudo,
  opcoes: OpcoesVerificacaoEnvelopeConteudo,
  bloqueiosRaiz: readonly string[],
): ResultadoVerificacaoEnvelopeConteudo<TPayload> {
  const bloqueios = [...bloqueiosRaiz];
  let digest: string;

  for (const campo of Object.keys(envelope as unknown as Record<string, unknown>)) {
    if (!CAMPOS_ENVELOPE.has(campo)) adicionarBloqueio(bloqueios, "campo_envelope_nao_permitido");
  }

  try {
    digest = digestEnvelopeConteudo(envelope);
  } catch {
    digest = digestInvalido(envelope);
    adicionarBloqueio(bloqueios, "payload_nao_canonico");
  }

  if (
    !textoNaoVazio(envelope.schemaVersion) ||
    !textoNaoVazio(envelope.payloadType) ||
    !textoNaoVazio(envelope.principalId) ||
    !textoNaoVazio(envelope.keyId) ||
    !textoNaoVazio(envelope.issuedAt) ||
    !textoNaoVazio(envelope.nonce) ||
    !textoNaoVazio(envelope.signature)
  ) {
    adicionarBloqueio(bloqueios, "envelope_incompleto");
  }

  if (envelope.signatureAlgorithm !== "Ed25519") {
    adicionarBloqueio(bloqueios, "algoritmo_assinatura_invalido");
  }
  if (envelope.payloadType !== opcoes.payloadTypeEsperado) {
    adicionarBloqueio(bloqueios, "payload_type_incompativel");
  }
  if (
    confianca.schemaVersionsAceitas !== undefined &&
    !confianca.schemaVersionsAceitas.includes(envelope.schemaVersion)
  ) {
    adicionarBloqueio(bloqueios, "schema_version_nao_aceita");
  }
  if (confianca.revokedKeyIds.includes(envelope.keyId)) {
    adicionarBloqueio(bloqueios, "chave_revogada");
  }

  const candidatos = confianca.principals.filter(
    (item) => item.principalId === envelope.principalId && item.keyId === envelope.keyId,
  );
  const principal = candidatos.length === 1 ? candidatos[0] : undefined;
  if (candidatos.length === 0) adicionarBloqueio(bloqueios, "principal_nao_encontrado");
  if (candidatos.length > 1) adicionarBloqueio(bloqueios, "principal_ambiguo");

  if (principal !== undefined) {
    if (
      opcoes.capabilityRequerida !== undefined &&
      !principal.capabilities.includes(opcoes.capabilityRequerida)
    ) {
      adicionarBloqueio(bloqueios, "capability_ausente");
    }
    if (opcoes.scopeRequerido !== undefined && !principal.scopes.includes(opcoes.scopeRequerido)) {
      adicionarBloqueio(bloqueios, "scope_ausente");
    }
    if (opcoes.papelRequerido !== undefined && !principal.papeis.includes(opcoes.papelRequerido)) {
      adicionarBloqueio(bloqueios, "papel_ausente");
    }
    if (
      opcoes.papeisPermitidos !== undefined &&
      !opcoes.papeisPermitidos.some((papel) => principal.papeis.includes(papel))
    ) {
      adicionarBloqueio(bloqueios, "papel_nao_permitido");
    }
  }

  const agora = timestampMs(opcoes.agora);
  const emitidoEm = Date.parse(envelope.issuedAt);
  const idadeMaxima = limiteSeguro(
    confianca.maxEnvelopeAgeMs,
    opcoes.maxEnvelopeAgeMs,
    IDADE_MAXIMA_PADRAO_MS,
  );
  const desvioFuturo = limiteSeguro(
    confianca.maxFutureSkewMs,
    opcoes.maxFutureSkewMs,
    DESVIO_FUTURO_PADRAO_MS,
  );

  if (
    !Number.isFinite(agora) ||
    !Number.isFinite(idadeMaxima) ||
    !Number.isFinite(desvioFuturo) ||
    idadeMaxima < 0 ||
    desvioFuturo < 0
  ) {
    adicionarBloqueio(bloqueios, "configuracao_frescura_invalida");
  }
  if (!Number.isFinite(emitidoEm)) {
    adicionarBloqueio(bloqueios, "issued_at_invalido");
  } else if (Number.isFinite(agora) && Number.isFinite(desvioFuturo) && emitidoEm > agora + desvioFuturo) {
    adicionarBloqueio(bloqueios, "issued_at_no_futuro");
  } else if (Number.isFinite(agora) && Number.isFinite(idadeMaxima) && agora - emitidoEm > idadeMaxima) {
    adicionarBloqueio(bloqueios, "envelope_expirado");
  }

  if (opcoes.noncesUsados?.has(envelope.nonce)) {
    adicionarBloqueio(bloqueios, "nonce_reutilizado");
  }

  if (principal !== undefined && !confianca.revokedKeyIds.includes(envelope.keyId)) {
    try {
      const publicKey = createPublicKey(principal.publicKeyPem);
      if (publicKey.asymmetricKeyType !== "ed25519") {
        adicionarBloqueio(bloqueios, "chave_publica_nao_ed25519");
      } else if (!verificarAssinaturaEnvelopeConteudo(envelope, publicKey)) {
        adicionarBloqueio(bloqueios, "assinatura_invalida");
      }
    } catch {
      adicionarBloqueio(bloqueios, "chave_publica_invalida");
    }
  }

  if (bloqueios.length > 0 || principal === undefined) {
    return { valido: false, digest, principal, bloqueios };
  }

  const envelopeVerificado: EnvelopeVerificadoConteudo<TPayload> = {
    estado: "ACEITA",
    digest,
    principal,
    envelope,
    payload: envelope.payload,
  };
  return { valido: true, digest, principal, envelopeVerificado, bloqueios };
}

function validarPinsExternosDaRaiz(
  confianca: ConfiguracaoConfiancaConteudo,
  opcoes: OpcoesVerificacaoEnvelopeConteudo,
): readonly string[] {
  const estruturaConfianca = validarConfiguracaoConfiancaConteudo(
    confianca,
    opcoes.trustRootDigestEsperado,
    opcoes.revocationDigestEsperado,
  );
  return estruturaConfianca.bloqueios.map((bloqueio) => `raiz_confianca_invalida:${bloqueio}`);
}

/** Verificacao publica: a autoridade so existe quando os dois pins externos conferem. */
export function verificarEnvelopeAssinadoConteudo<TPayload>(
  envelope: EnvelopeAssinadoConteudo<TPayload>,
  confianca: ConfiguracaoConfiancaConteudo,
  opcoes: OpcoesVerificacaoEnvelopeConteudo,
): ResultadoVerificacaoEnvelopeConteudo<TPayload> {
  return verificarEnvelopeAssinadoConteudoComRaizValidada(
    envelope,
    confianca,
    opcoes,
    validarPinsExternosDaRaiz(confianca, opcoes),
  );
}

/**
 * Replay historico interno: valida os pins contra o overlay atual antes de
 * ignorar revogacoes somente para provar assinaturas historicas. Nao exportar
 * este simbolo pela superficie publica do pacote.
 */
export function verificarEnvelopeAssinadoConteudoHistoricoInterno<TPayload>(
  envelope: EnvelopeAssinadoConteudo<TPayload>,
  confiancaAtual: ConfiguracaoConfiancaConteudo,
  opcoes: OpcoesVerificacaoEnvelopeConteudo,
): ResultadoVerificacaoEnvelopeConteudo<TPayload> {
  const bloqueiosRaiz = validarPinsExternosDaRaiz(confiancaAtual, opcoes);
  const confiancaHistorica: ConfiguracaoConfiancaConteudo = {
    ...confiancaAtual,
    revokedKeyIds: [],
  };
  return verificarEnvelopeAssinadoConteudoComRaizValidada(
    envelope,
    confiancaHistorica,
    opcoes,
    bloqueiosRaiz,
  );
}

function alvoExato(recebido: string | undefined, esperado: string | undefined): boolean {
  return recebido === esperado;
}

function principalPorId(
  principals: readonly PrincipalConteudo[],
  principalId: string,
): PrincipalConteudo | undefined {
  const encontrados = principals.filter((item) => item.principalId === principalId);
  if (encontrados.length === 0) return undefined;
  const dominios = new Set(encontrados.map((item) => item.controlDomain));
  return dominios.size === 1 ? encontrados[0] : undefined;
}

interface ContextoGateConteudo {
  readonly trustDomainId: string;
  readonly trustRootDigest: string;
  readonly ledgerId: string;
  readonly policyDigest: string;
  readonly definitionDigest: string;
}

function contextoGateDaEntrada(entrada: EntradaAvaliacaoGateConteudo): ContextoGateConteudo {
  return {
    trustDomainId: entrada.trustDomainId,
    trustRootDigest: entrada.trustRootDigest,
    ledgerId: entrada.ledgerId,
    policyDigest: entrada.policyDigest,
    definitionDigest: entrada.definitionDigest,
  };
}

function conferirContextoGate(
  payload: AtestadoEvidenciaConteudo | ParecerIAConteudo,
  entrada: EntradaAvaliacaoGateConteudo,
  referencia: ContextoGateConteudo,
  prefixo: string,
  bloqueios: string[],
): boolean {
  let valido = true;
  const bloquear = (codigo: string): void => {
    adicionarBloqueio(bloqueios, `${prefixo}:${codigo}`);
    valido = false;
  };
  if (payload.runId !== entrada.runId) bloquear("run_divergente");
  if (payload.authorizationScope !== entrada.authorizationScope) bloquear("authorization_scope_divergente");
  if (!textoNaoVazio(payload.trustDomainId)) bloquear("trust_domain_id_ausente");
  if (!textoNaoVazio(payload.ledgerId)) bloquear("ledger_id_ausente");
  if (!textoNaoVazio(payload.policyDigest)) bloquear("policy_digest_ausente");
  if (!textoNaoVazio(payload.definitionDigest)) bloquear("definition_digest_ausente");
  if (payload.trustDomainId !== referencia.trustDomainId) bloquear("trust_domain_divergente");
  if (payload.trustRootDigest !== referencia.trustRootDigest) bloquear("trust_root_digest_divergente");
  if (payload.ledgerId !== referencia.ledgerId) bloquear("ledger_divergente");
  if (payload.policyDigest !== referencia.policyDigest) bloquear("policy_digest_divergente");
  if (payload.definitionDigest !== referencia.definitionDigest) bloquear("definition_digest_divergente");
  return valido;
}

function conferirCamposAtestado(
  payload: AtestadoEvidenciaConteudo,
  entrada: EntradaAvaliacaoGateConteudo,
  principal: PrincipalConteudo,
  principalsDaLinhagem: ReadonlySet<string>,
  dominiosDaLinhagem: ReadonlySet<string>,
  bloqueios: string[],
): boolean {
  const prefixo = `evidencia:${payload.evidenceId || "sem_id"}`;
  let valido = true;
  const bloquear = (codigo: string): void => {
    adicionarBloqueio(bloqueios, `${prefixo}:${codigo}`);
    valido = false;
  };

  if (payload.kind !== "EVIDENCE_ATTESTED") bloquear("tipo_invalido");
  if (!textoNaoVazio(payload.evidenceId)) bloquear("id_ausente");
  if (payload.gateId !== entrada.gate.gateId) bloquear("gate_divergente");
  if (payload.artifactDigest !== entrada.artifactDigest) bloquear("artifact_digest_divergente");
  if (!alvoExato(payload.targetId, entrada.targetId)) bloquear("target_divergente");
  if (payload.producerId !== entrada.producerId) bloquear("produtor_divergente");
  if (payload.attesterId !== principal.principalId) bloquear("atestador_divergente");
  const capabilityEspecifica =
    entrada.attesterCapabilitiesAdicionais?.[payload.evidenceType] ??
    `content.evidence.attest:${payload.evidenceType}`;
  const capabilityAutorizada = principal.capabilities.includes(capabilityEspecifica);
  if (!capabilityAutorizada) bloquear("capability_ausente");
  const papelAutorizado =
    principal.papeis.includes("EVIDENCE_ATTESTER") ||
    principal.papeis.includes("ADAPTER") ||
    (principal.papeis.includes("AI_AGENT") && capabilityAutorizada);
  if (!papelAutorizado) bloquear("papel_nao_permitido");
  if (entrada.gate.producerDisjoint) {
    if (principalsDaLinhagem.has(principal.principalId) || dominiosDaLinhagem.has(principal.controlDomain)) {
      bloquear("produtor_ou_ancestral_e_atestador_nao_disjuntos");
    }
  }
  if (!["APROVADO", "REPROVADO", "INCONCLUSIVO"].includes(payload.result)) bloquear("resultado_invalido");
  return valido;
}

function conferirCamposParecer(
  payload: ParecerIAConteudo,
  entrada: EntradaAvaliacaoGateConteudo,
  principal: PrincipalConteudo,
  principalsDaLinhagem: ReadonlySet<string>,
  dominiosDaLinhagem: ReadonlySet<string>,
  bloqueios: string[],
): boolean {
  const prefixo = `parecer:${payload.assessmentId || "sem_id"}`;
  let valido = true;
  const bloquear = (codigo: string): void => {
    adicionarBloqueio(bloqueios, `${prefixo}:${codigo}`);
    valido = false;
  };

  if (payload.kind !== "AI_ASSESSMENT") bloquear("tipo_invalido");
  if (!textoNaoVazio(payload.assessmentId)) bloquear("id_ausente");
  if (payload.gateId !== entrada.gate.gateId) bloquear("gate_divergente");
  if (payload.artifactDigest !== entrada.artifactDigest) bloquear("artifact_digest_divergente");
  if (!alvoExato(payload.targetId, entrada.targetId)) bloquear("target_divergente");
  if (payload.rubricDigest !== entrada.gate.rubricDigest) bloquear("rubric_digest_divergente");
  if (payload.evaluatorId !== principal.principalId) bloquear("avaliador_divergente");
  if (!["APROVADO", "REPROVADO", "INCONCLUSIVO"].includes(payload.result)) bloquear("resultado_invalido");
  const capabilityAutorizada =
    textoNaoVazio(payload.capability) &&
    entrada.gate.evaluatorCapabilities.includes(payload.capability) &&
    principal.capabilities.includes(payload.capability);
  if (!capabilityAutorizada) {
    bloquear("capability_ausente");
  }
  const papelAutorizado =
    principal.papeis.includes("EVALUATOR") ||
    (principal.papeis.includes("AI_AGENT") && capabilityAutorizada);
  if (!papelAutorizado) bloquear("papel_nao_permitido");
  if (entrada.gate.producerDisjoint) {
    if (principalsDaLinhagem.has(principal.principalId) || dominiosDaLinhagem.has(principal.controlDomain)) {
      bloquear("produtor_ou_ancestral_e_avaliador_nao_disjuntos");
    }
  }
  return valido;
}

/**
 * @internal O chamador deve fornecer contexto derivado pelo replay canonico.
 * A unica superficie publica autoritativa para gates e derivarEstadoPipelineConteudo.
 */
export function avaliarGateConteudoInterno(entrada: EntradaAvaliacaoGateConteudo): ResultadoAvaliacaoGateConteudo {
  const bloqueios: string[] = [];
  const requisitosAdicionais = entrada.requiredEvidenceAdicional ?? [];
  const requisitosAdicionaisValidos =
    Array.isArray(requisitosAdicionais) &&
    requisitosAdicionais.every(textoOpacoNormalizado) &&
    new Set(requisitosAdicionais).size === requisitosAdicionais.length;
  const attesterCapabilitiesAdicionais = entrada.attesterCapabilitiesAdicionais ?? {};
  const attesterCapabilitiesAdicionaisValidas =
    attesterCapabilitiesAdicionais !== null &&
    typeof attesterCapabilitiesAdicionais === "object" &&
    !Array.isArray(attesterCapabilitiesAdicionais) &&
    Object.entries(attesterCapabilitiesAdicionais).every(
      ([evidenceType, capability]) => textoOpacoNormalizado(evidenceType) && textoOpacoNormalizado(capability),
    );
  const requiredEvidenceEfetiva = [...new Set([
    ...entrada.gate.requiredEvidence,
    ...requisitosAdicionais,
  ])];
  const entradaValida =
    textoNaoVazio(entrada.runId) &&
    textoNaoVazio(entrada.trustDomainId) &&
    entrada.trustDomainId === entrada.configuracaoConfianca.trustDomainId &&
    textoNaoVazio(entrada.trustRootDigest) &&
    textoNaoVazio(entrada.revocationDigestEsperado) &&
    textoNaoVazio(entrada.ledgerId) &&
    textoNaoVazio(entrada.policyDigest) &&
    textoNaoVazio(entrada.definitionDigest) &&
    textoNaoVazio(entrada.authorizationScope) &&
    Array.isArray(entrada.producerLineageIds) &&
    entrada.producerLineageIds.length > 0 &&
    entrada.producerLineageIds.includes(entrada.producerId) &&
    (entrada.gate.scope === "GLOBAL"
      ? entrada.targetId === undefined
      : textoOpacoNormalizado(entrada.targetId));
  if (!entradaValida) adicionarBloqueio(bloqueios, "contexto_avaliacao_invalido");
  let politicaValida = entradaValida &&
    textoNaoVazio(entrada.gate.gateId) &&
    textoNaoVazio(entrada.gate.stageId) &&
    ["GLOBAL", "POR_ALVO"].includes(entrada.gate.scope) &&
    textoNaoVazio(entrada.gate.rubricDigest) &&
    requisitosAdicionaisValidos &&
    attesterCapabilitiesAdicionaisValidas &&
    listaOpacaUnica(entrada.gate.requiredEvidence) &&
    listaOpacaUnica(entrada.gate.evaluatorCapabilities) &&
    ["DETERMINISTICA", "IA_ESPECIALIZADA", "HIBRIDA"].includes(entrada.gate.evaluationMode) &&
    Number.isInteger(entrada.gate.minApprovals) &&
    entrada.gate.minApprovals >= 1 &&
    Number.isInteger(entrada.gate.minAttestationsPerEvidence) &&
    entrada.gate.minAttestationsPerEvidence >= 1 &&
    Number.isInteger(entrada.gate.minDistinctAttesterControlDomains) &&
    entrada.gate.minDistinctAttesterControlDomains >= 1 &&
    entrada.gate.minDistinctAttesterControlDomains <= entrada.gate.minAttestationsPerEvidence &&
    typeof entrada.gate.producerDisjoint === "boolean" &&
    typeof entrada.gate.rejectionIsBinding === "boolean" &&
    Number.isInteger(entrada.gate.minDistinctControlDomains) &&
    entrada.gate.minDistinctControlDomains >= 1 &&
    (
      entrada.gate.evaluationMode === "IA_ESPECIALIZADA" ||
      entrada.gate.requiredEvidence.length > 0
    ) &&
    (
      entrada.gate.evaluationMode === "DETERMINISTICA" ||
      entrada.gate.evaluatorCapabilities.length > 0
    );
  if (!politicaValida) adicionarBloqueio(bloqueios, "politica_gate_invalida");
  const confianca = entrada.configuracaoConfianca;
  const revokedKeyIds = confianca.revokedKeyIds;
  const raizConfianca = validarConfiguracaoConfiancaConteudo(
    confianca,
    entrada.trustRootDigest,
    entrada.revocationDigestEsperado,
  );
  if (!raizConfianca.valida) {
    politicaValida = false;
    for (const bloqueio of raizConfianca.bloqueios) adicionarBloqueio(bloqueios, `raiz_confianca_invalida:${bloqueio}`);
  }
  const politica = entrada.envelopePolitica?.payload;
  const verificacaoPolitica = verificarEnvelopeAssinadoConteudo(
    entrada.envelopePolitica,
    confianca,
    {
      trustRootDigestEsperado: entrada.trustRootDigest,
      revocationDigestEsperado: entrada.revocationDigestEsperado,
      payloadTypeEsperado: "TRUST_POLICY",
      papelRequerido: "POLICY_AUTHORITY",
      agora: politica?.issuedAt,
    },
  );
  let politicaAssinadaValida = verificacaoPolitica.valido;
  if (!verificacaoPolitica.valido) {
    for (const bloqueio of verificacaoPolitica.bloqueios) {
      adicionarBloqueio(bloqueios, `politica_assinada:${bloqueio}`);
    }
  }
  try {
    const gatesCorrespondentes = Array.isArray(politica?.gates)
      ? politica.gates.filter((gate) => gate.gateId === entrada.gate.gateId)
      : [];
    if (
      politica === undefined ||
      digestJsonCanonico(politica) !== entrada.policyDigest ||
      politica.runId !== entrada.runId ||
      politica.trustDomainId !== entrada.trustDomainId ||
      politica.trustRootDigest !== entrada.trustRootDigest ||
      politica.ledgerId !== entrada.ledgerId ||
      politica.definitionDigest !== entrada.definitionDigest ||
      !textoOpacoNormalizado(politica.targetSetDigest) ||
      entrada.envelopePolitica.issuedAt !== politica.issuedAt ||
      !Number.isFinite(Date.parse(politica.issuedAt)) ||
      !Number.isFinite(Date.parse(politica.expiresAt)) ||
      Date.parse(politica.expiresAt) <= Date.parse(politica.issuedAt) ||
      gatesCorrespondentes.length !== 1 ||
      digestJsonCanonico(gatesCorrespondentes[0]) !== digestJsonCanonico(entrada.gate)
    ) {
      politicaAssinadaValida = false;
      adicionarBloqueio(bloqueios, "politica_assinada_contexto_ou_gate_divergente");
    }
  } catch {
    politicaAssinadaValida = false;
    adicionarBloqueio(bloqueios, "politica_assinada_payload_invalido");
  }
  politicaValida &&= politicaAssinadaValida;
  const noncesUsados = new Set<string>();
  const evidenciasValidas: Array<{ payload: AtestadoEvidenciaConteudo; principal: PrincipalConteudo }> = [];
  const pareceresValidos: Array<{ payload: ParecerIAConteudo; principal: PrincipalConteudo }> = [];
  const evidenceIds = new Set<string>();
  const assessmentIds = new Set<string>();
  const principalsDaLinhagem = new Set<string>(entrada.producerLineageIds);
  principalsDaLinhagem.add(entrada.producerId);
  const dominiosDaLinhagem = new Set<string>();
  for (const principalId of principalsDaLinhagem) {
    const principal = principalPorId(confianca.principals, principalId);
    if (principal === undefined) {
      adicionarBloqueio(bloqueios, `principal_linhagem_nao_encontrado:${principalId}`);
      politicaValida = false;
    } else {
      dominiosDaLinhagem.add(principal.controlDomain);
    }
  }
  const contextoReferencia = contextoGateDaEntrada(entrada);

  for (const registro of entrada.evidenciasAceitas) {
    const payload = registro.envelope.payload;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      adicionarBloqueio(bloqueios, "evidencia:payload_invalido");
      continue;
    }
    const verificacao = verificarEnvelopeAssinadoConteudo(registro.envelope, confianca, {
      trustRootDigestEsperado: entrada.trustRootDigest,
      revocationDigestEsperado: entrada.revocationDigestEsperado,
      payloadTypeEsperado: "EVIDENCE_ATTESTED",
      scopeRequerido: entrada.authorizationScope,
      agora: typeof payload === "object" && payload !== null && "observedAt" in payload
        ? String(payload.observedAt)
        : undefined,
      noncesUsados,
    });
    noncesUsados.add(registro.envelope.nonce);
    if (!verificacao.valido || verificacao.principal === undefined) {
      for (const bloqueio of verificacao.bloqueios) adicionarBloqueio(bloqueios, `evidencia_envelope:${bloqueio}`);
      continue;
    }

    const atestado = payload as AtestadoEvidenciaConteudo;
    if (!conferirContextoGate(atestado, entrada, contextoReferencia, `evidencia:${atestado.evidenceId || "sem_id"}`, bloqueios)) continue;
    if (!conferirCamposAtestado(atestado, entrada, verificacao.principal, principalsDaLinhagem, dominiosDaLinhagem, bloqueios)) continue;
    if (evidenceIds.has(atestado.evidenceId)) {
      adicionarBloqueio(bloqueios, `evidencia:${atestado.evidenceId}:id_duplicado`);
      continue;
    }
    evidenceIds.add(atestado.evidenceId);
    evidenciasValidas.push({ payload: atestado, principal: verificacao.principal });
  }

  for (const registro of entrada.pareceresIa) {
    const payload = registro.envelope.payload;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      adicionarBloqueio(bloqueios, "parecer:payload_invalido");
      continue;
    }
    const verificacao = verificarEnvelopeAssinadoConteudo(registro.envelope, confianca, {
      trustRootDigestEsperado: entrada.trustRootDigest,
      revocationDigestEsperado: entrada.revocationDigestEsperado,
      payloadTypeEsperado: "AI_ASSESSMENT",
      scopeRequerido: entrada.authorizationScope,
      agora: typeof payload === "object" && payload !== null && "assessedAt" in payload
        ? String(payload.assessedAt)
        : undefined,
      noncesUsados,
    });
    noncesUsados.add(registro.envelope.nonce);
    if (!verificacao.valido || verificacao.principal === undefined) {
      for (const bloqueio of verificacao.bloqueios) adicionarBloqueio(bloqueios, `parecer_envelope:${bloqueio}`);
      continue;
    }

    const parecer = payload as ParecerIAConteudo;
    if (!conferirContextoGate(parecer, entrada, contextoReferencia, `parecer:${parecer.assessmentId || "sem_id"}`, bloqueios)) continue;
    if (!conferirCamposParecer(parecer, entrada, verificacao.principal, principalsDaLinhagem, dominiosDaLinhagem, bloqueios)) continue;
    if (assessmentIds.has(parecer.assessmentId)) {
      adicionarBloqueio(bloqueios, `parecer:${parecer.assessmentId}:id_duplicado`);
      continue;
    }
    assessmentIds.add(parecer.assessmentId);
    pareceresValidos.push({ payload: parecer, principal: verificacao.principal });
  }

  const evidenciasPorTipo = new Map<
    string,
    Array<{ payload: AtestadoEvidenciaConteudo; principal: PrincipalConteudo }>
  >();
  for (const evidencia of evidenciasValidas) {
    const { payload } = evidencia;
    const atuais = evidenciasPorTipo.get(payload.evidenceType) ?? [];
    atuais.push(evidencia);
    evidenciasPorTipo.set(payload.evidenceType, atuais);
  }

  let evidenciaDeterministicaReprovada = false;
  let evidenciaDeterministicaCompleta = true;
  for (const tipo of requiredEvidenceEfetiva) {
    const atestados = evidenciasPorTipo.get(tipo) ?? [];
    if (atestados.some((item) => item.payload.result === "REPROVADO")) evidenciaDeterministicaReprovada = true;
    const aprovacoesPorPrincipal = new Map<string, PrincipalConteudo>();
    for (const item of atestados) {
      if (item.payload.result === "APROVADO") {
        aprovacoesPorPrincipal.set(item.principal.principalId, item.principal);
      }
    }
    const dominiosAtestadores = new Set(
      [...aprovacoesPorPrincipal.values()].map((principal) => principal.controlDomain),
    );
    if (aprovacoesPorPrincipal.size < entrada.gate.minAttestationsPerEvidence) {
      evidenciaDeterministicaCompleta = false;
      adicionarBloqueio(bloqueios, `quorum_atestadores_insuficiente:${tipo}`);
    }
    if (dominiosAtestadores.size < entrada.gate.minDistinctAttesterControlDomains) {
      evidenciaDeterministicaCompleta = false;
      adicionarBloqueio(bloqueios, `dominios_atestadores_insuficientes:${tipo}`);
    }
  }

  const pareceresPorAvaliador = new Map<string, Array<{ payload: ParecerIAConteudo; principal: PrincipalConteudo }>>();
  for (const parecer of pareceresValidos) {
    const atuais = pareceresPorAvaliador.get(parecer.principal.principalId) ?? [];
    atuais.push(parecer);
    pareceresPorAvaliador.set(parecer.principal.principalId, atuais);
  }

  const aprovacoes = new Map<string, PrincipalConteudo>();
  const capabilitiesCobertas = new Set<string>();
  let haRejeicaoIa = false;
  let haConflitoIa = false;
  for (const [principalId, pareceres] of pareceresPorAvaliador) {
    const resultados = new Set(pareceres.map((item) => item.payload.result));
    if (resultados.size > 1) {
      haConflitoIa = true;
      adicionarBloqueio(bloqueios, `avaliador:${principalId}:pareceres_conflitantes`);
      continue;
    }
    const unico = pareceres[0];
    if (unico.payload.result === "APROVADO") {
      aprovacoes.set(principalId, unico.principal);
      for (const parecer of pareceres) capabilitiesCobertas.add(parecer.payload.capability);
    }
    if (unico.payload.result === "REPROVADO") haRejeicaoIa = true;
  }

  const controlDomains = new Set([...aprovacoes.values()].map((principal) => principal.controlDomain));
  const aprovacoesValidas = aprovacoes.size;
  const controlDomainsDistintos = controlDomains.size;
  const capabilitiesFaltantes = entrada.gate.evaluatorCapabilities.filter(
    (capability) => !capabilitiesCobertas.has(capability),
  );
  const coberturaCapabilitiesIa = capabilitiesFaltantes.length === 0;
  const quorumIa = politicaValida &&
    aprovacoesValidas >= entrada.gate.minApprovals &&
    controlDomainsDistintos >= entrada.gate.minDistinctControlDomains &&
    coberturaCapabilitiesIa;
  const exigeDeterministica = entrada.gate.evaluationMode !== "IA_ESPECIALIZADA" || requiredEvidenceEfetiva.length > 0;
  const exigeIa = entrada.gate.evaluationMode !== "DETERMINISTICA";
  const possuiQualquerEntrada = evidenciasValidas.length > 0 || pareceresValidos.length > 0;

  let veredito: ResultadoAvaliacaoGateConteudo["veredito"];
  if (!politicaValida) {
    veredito = possuiQualquerEntrada ? "INCONCLUSIVO" : "NAO_AVALIADO";
  } else if (exigeDeterministica && evidenciaDeterministicaReprovada) {
    veredito = "REPROVADO";
  } else if (exigeIa && haRejeicaoIa && entrada.gate.rejectionIsBinding) {
    veredito = "REPROVADO";
  } else if (!possuiQualquerEntrada) {
    veredito = "NAO_AVALIADO";
  } else if (exigeDeterministica && !evidenciaDeterministicaCompleta) {
    veredito = "INCONCLUSIVO";
  } else if (exigeIa && (haConflitoIa || haRejeicaoIa || !quorumIa)) {
    for (const capability of capabilitiesFaltantes) {
      adicionarBloqueio(bloqueios, `capability_ia_nao_coberta:${capability}`);
    }
    if (!quorumIa) adicionarBloqueio(bloqueios, "quorum_ia_insuficiente");
    veredito = "INCONCLUSIVO";
  } else {
    veredito = "APROVADO";
  }

  return {
    veredito,
    aprovacoesValidas,
    controlDomainsDistintos,
    evidenceIds: [...evidenceIds],
    assessmentIds: [...assessmentIds],
    bloqueios,
  };
}
