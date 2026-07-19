// SEMA-GOVERNED: sema.produto.pipeline_conteudo + confianca + ledger + estado + adaptadores
// Descricao: tipos abertos do pipeline AI-native de conteudo, sem enum de canal, marca ou formato.

export type JsonPrimitivo = string | number | boolean | null;
export type JsonValor = JsonPrimitivo | JsonObjeto | readonly JsonValor[];
export interface JsonObjeto {
  readonly [chave: string]: JsonValor;
}
export interface MetadataPublicaConteudo {
  readonly [chave: string]: JsonPrimitivo;
}

export type VereditoConteudo = "NAO_AVALIADO" | "APROVADO" | "REPROVADO" | "INCONCLUSIVO";
export type EstadoEvidenciaConteudo = "DECLARADA" | "ACEITA" | "REJEITADA" | "EXPIRADA" | "REVOGADA" | "SUPERADA";
export type ModoAvaliacaoConteudo = "DETERMINISTICA" | "IA_ESPECIALIZADA" | "HIBRIDA";
export type CondicaoOperacionalConteudo =
  | "PENDENTE"
  | "PRONTA"
  | "EXECUTANDO"
  | "AGUARDANDO_EVIDENCIA"
  | "AGUARDANDO_EVENTO_EXTERNO"
  | "FERRAMENTA_INDISPONIVEL"
  | "CAPACIDADE_AUSENTE"
  | "AUTORIZACAO_AUSENTE"
  | "FALHA_TRANSITORIA"
  | "FALHA_TERMINAL"
  | "EXECUCAO_ENCERRADA";
export type EscopoEtapaConteudo = "GLOBAL" | "POR_ALVO";
export type ResultadoAvaliacaoConteudo = "APROVADO" | "REPROVADO" | "INCONCLUSIVO";

export interface PrincipalConteudo {
  readonly principalId: string;
  readonly keyId: string;
  readonly controlDomain: string;
  readonly papeis: readonly string[];
  readonly capabilities: readonly string[];
  readonly scopes: readonly string[];
  readonly publicKeyPem: string;
}

/**
 * Raiz publica de confianca. Chaves privadas nunca pertencem a esta configuracao
 * nem ao workspace canonico do pipeline.
 */
export interface ConfiguracaoConfiancaConteudo {
  readonly trustDomainId: string;
  readonly principals: readonly PrincipalConteudo[];
  readonly revokedKeyIds: readonly string[];
  readonly maxEnvelopeAgeMs?: number;
  readonly maxFutureSkewMs?: number;
  readonly schemaVersionsAceitas?: readonly string[];
}

export interface ResultadoValidacaoConfiguracaoConfiancaConteudo {
  readonly valida: boolean;
  readonly trustRootDigest: string;
  readonly revocationDigest: string;
  readonly fingerprints: readonly string[];
  readonly bloqueios: readonly string[];
}

export interface EnvelopeAssinavelConteudo<TPayload = JsonValor> {
  readonly schemaVersion: string;
  readonly payloadType: string;
  readonly payload: TPayload;
  readonly principalId: string;
  readonly keyId: string;
  readonly issuedAt: string;
  readonly nonce: string;
  readonly signatureAlgorithm: "Ed25519";
}

export interface EnvelopeAssinadoConteudo<TPayload = JsonValor> extends EnvelopeAssinavelConteudo<TPayload> {
  /** Assinatura Ed25519 em base64 do JSON canonico de EnvelopeAssinavelConteudo. */
  readonly signature: string;
}

export interface OpcoesVerificacaoEnvelopeConteudo {
  /** Pins fornecidos por uma fronteira externa; nunca podem ser derivados da configuracao recebida. */
  readonly trustRootDigestEsperado: string;
  readonly revocationDigestEsperado: string;
  readonly payloadTypeEsperado: string;
  readonly capabilityRequerida?: string;
  readonly scopeRequerido?: string;
  readonly papelRequerido?: string;
  readonly papeisPermitidos?: readonly string[];
  readonly agora?: string | Date | number;
  readonly maxEnvelopeAgeMs?: number;
  readonly maxFutureSkewMs?: number;
  /** Nonces ja observados. A verificacao e pura e nao altera este conjunto. */
  readonly noncesUsados?: ReadonlySet<string>;
}

export interface EnvelopeVerificadoConteudo<TPayload = JsonValor> {
  readonly estado: "ACEITA";
  readonly digest: string;
  readonly principal: PrincipalConteudo;
  readonly envelope: EnvelopeAssinadoConteudo<TPayload>;
  readonly payload: TPayload;
}

export interface ResultadoVerificacaoEnvelopeConteudo<TPayload = JsonValor> {
  readonly valido: boolean;
  readonly digest: string;
  readonly principal?: PrincipalConteudo;
  readonly envelopeVerificado?: EnvelopeVerificadoConteudo<TPayload>;
  readonly bloqueios: readonly string[];
}

/** Contexto anti-replay que faz parte do payload assinado de todo evento. */
export interface ContextoAssinadoEventoConteudo {
  readonly runId: string;
  readonly trustDomainId: string;
  readonly trustRootDigest: string;
  readonly ledgerId: string;
  readonly policyDigest: string;
  readonly definitionDigest: string;
}

/** Eventos ligados a um alvo/conta carregam tambem o escopo derivado pelo planner. */
export interface ContextoAutorizadoEventoConteudo extends ContextoAssinadoEventoConteudo {
  readonly authorizationScope: string;
}

/** Declaracao do runner/produtor. So vira evidencia depois de um atestado confiavel. */
export interface AlegacaoEvidenciaConteudo extends ContextoAutorizadoEventoConteudo {
  readonly kind: "EVIDENCE_CLAIMED";
  readonly claimId: string;
  readonly stageId: string;
  readonly targetId?: string;
  readonly artifactDigest: string;
  readonly evidenceType: string;
  readonly producerId: string;
  readonly claimedAt: string;
  readonly data?: JsonObjeto;
}

/** Observacao assinada por um verificador/adapter autorizado, nunca pelo recibo em si. */
export interface AtestadoEvidenciaConteudo extends ContextoAutorizadoEventoConteudo {
  readonly kind: "EVIDENCE_ATTESTED";
  readonly evidenceId: string;
  readonly claimId?: string;
  readonly gateId: string;
  readonly stageId: string;
  readonly targetId?: string;
  readonly artifactDigest: string;
  readonly evidenceType: string;
  readonly producerId: string;
  readonly attesterId: string;
  readonly result: ResultadoAvaliacaoConteudo;
  readonly observedAt: string;
  readonly data?: JsonObjeto;
}

export interface ParecerIAConteudo extends ContextoAutorizadoEventoConteudo {
  readonly kind: "AI_ASSESSMENT";
  readonly assessmentId: string;
  readonly gateId: string;
  readonly targetId?: string;
  readonly artifactDigest: string;
  readonly rubricDigest: string;
  readonly evaluatorId: string;
  /** Capability especializada concreta exercida neste parecer. */
  readonly capability: string;
  readonly result: ResultadoAvaliacaoConteudo;
  readonly assessedAt: string;
  readonly rationaleDigest?: string;
  readonly data?: JsonObjeto;
}

export interface PoliticaGateConteudo {
  readonly gateId: string;
  readonly stageId: string;
  readonly scope: EscopoEtapaConteudo;
  readonly evaluationMode: ModoAvaliacaoConteudo;
  readonly requiredEvidence: readonly string[];
  readonly evaluatorCapabilities: readonly string[];
  /** Quorum independente exigido para cada tipo de evidencia deterministica. */
  readonly minAttestationsPerEvidence: number;
  readonly minDistinctAttesterControlDomains: number;
  readonly minApprovals: number;
  readonly minDistinctControlDomains: number;
  readonly producerDisjoint: boolean;
  readonly rejectionIsBinding: boolean;
  readonly rubricDigest: string;
}

export interface PoliticaConfiancaConteudo {
  readonly policyId: string;
  readonly version: string;
  readonly runId: string;
  readonly trustDomainId: string;
  readonly trustRootDigest: string;
  readonly definitionDigest: string;
  readonly targetSetDigest: string;
  readonly ledgerId: string;
  readonly gates: readonly PoliticaGateConteudo[];
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface EntradaAvaliacaoGateConteudo {
  /** Politica assinada que vincula o gate base; requisitos adicionais so podem endurece-lo. */
  readonly envelopePolitica: EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo>;
  readonly gate: PoliticaGateConteudo;
  readonly requiredEvidenceAdicional?: readonly string[];
  /** Requisitos adicionais derivados do adapter; so endurecem a policy assinada. */
  readonly attesterCapabilitiesAdicionais?: Readonly<Record<string, string>>;
  readonly artifactDigest: string;
  readonly targetId?: string;
  readonly runId: string;
  readonly trustDomainId: string;
  readonly trustRootDigest: string;
  readonly revocationDigestEsperado: string;
  readonly ledgerId: string;
  readonly policyDigest: string;
  readonly definitionDigest: string;
  readonly authorizationScope: string;
  readonly producerId: string;
  readonly producerLineageIds: readonly string[];
  readonly evidenciasAceitas: readonly EnvelopeVerificadoConteudo<AtestadoEvidenciaConteudo>[];
  readonly pareceresIa: readonly EnvelopeVerificadoConteudo<ParecerIAConteudo>[];
  readonly configuracaoConfianca: ConfiguracaoConfiancaConteudo;
}

export interface ResultadoAvaliacaoGateConteudo {
  readonly veredito: VereditoConteudo;
  readonly aprovacoesValidas: number;
  readonly controlDomainsDistintos: number;
  readonly evidenceIds: readonly string[];
  readonly assessmentIds: readonly string[];
  readonly bloqueios: readonly string[];
}

export interface RestricaoDeterministicaConteudo {
  readonly constraintId: string;
  readonly kind: string;
  readonly config?: JsonObjeto;
}

export interface AdaptadorConteudo {
  readonly adapterId: string;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly acceptedMediaTypes: readonly string[];
  readonly formatProfiles: readonly string[];
  readonly deterministicConstraints: readonly RestricaoDeterministicaConteudo[];
  readonly requiredMetadata: readonly string[];
  readonly optionalMetadata: readonly string[];
  readonly confirmationPredicates: readonly string[];
}

export interface AlvoConteudo {
  readonly targetId: string;
  readonly adapterId: string;
  readonly accountScope: string;
  readonly formatProfileId: string;
  readonly locale: string;
  readonly metadata: MetadataPublicaConteudo;
}

export interface EtapaPipelineConteudo {
  readonly stageId: string;
  readonly capability: string;
  readonly scope: EscopoEtapaConteudo;
  readonly adapterPolicy: "NONE" | "CONSTRAINTS" | "CONFIRMATION";
  readonly dependsOn: readonly string[];
  readonly produces: readonly string[];
  readonly gateIds: readonly string[];
}

export interface DefinicaoPipelineConteudo {
  readonly schemaVersion: string;
  readonly pipelineId: string;
  readonly version: string;
  readonly stages: readonly EtapaPipelineConteudo[];
  readonly gates: readonly PoliticaGateConteudo[];
  readonly adapters: readonly AdaptadorConteudo[];
  readonly requiredCompletionGates: readonly string[];
}

export interface InstanciaEtapaConteudo {
  readonly stageInstanceId: string;
  readonly stageId: string;
  readonly targetId?: string;
  readonly capability: string;
  readonly dependsOn: readonly string[];
  readonly produces: readonly string[];
  readonly gateIds: readonly string[];
}

export interface SlotArtefatoConteudo {
  readonly slotId: string;
  readonly stageInstanceId: string;
  readonly artifactType: string;
  readonly targetId?: string;
}

export interface InstanciaGateConteudo {
  readonly gateInstanceId: string;
  readonly gateId: string;
  readonly stageInstanceId: string;
  readonly targetId?: string;
}

export interface PlanoPipelineConteudo {
  readonly pipelineId: string;
  readonly definitionDigest: string;
  readonly targetIds: readonly string[];
  readonly stageInstances: readonly InstanciaEtapaConteudo[];
  readonly artifactSlots: readonly SlotArtefatoConteudo[];
  readonly gateInstances: readonly InstanciaGateConteudo[];
  readonly nextActions: readonly string[];
}

export interface ArtefatoConteudo extends ContextoAutorizadoEventoConteudo {
  readonly kind: "ARTIFACT_REGISTERED";
  readonly artifactId: string;
  readonly stageId: string;
  readonly targetId?: string;
  readonly producerId: string;
  readonly producerLineageIds: readonly string[];
  readonly version: string;
  readonly artifactType: string;
  readonly mediaType: string;
  readonly digest: string;
  readonly lineageDigests: readonly string[];
}

export interface InicioExecucaoConteudo extends ContextoAssinadoEventoConteudo {
  readonly kind: "RUN_STARTED";
  readonly targets: readonly AlvoConteudo[];
  readonly startedAt: string;
}

export interface CondicaoOperacionalReportadaConteudo extends ContextoAutorizadoEventoConteudo {
  readonly kind: "OPERATIONAL_CONDITION";
  readonly gateId: string;
  readonly targetId?: string;
  readonly condition: CondicaoOperacionalConteudo;
  readonly reason: string;
  readonly reportedAt: string;
}

export type EventoPayloadConteudo =
  | InicioExecucaoConteudo
  | CondicaoOperacionalReportadaConteudo
  | ArtefatoConteudo
  | AlegacaoEvidenciaConteudo
  | AtestadoEvidenciaConteudo
  | ParecerIAConteudo;

export interface EventoLedgerConteudo<TPayload = JsonValor> {
  readonly schemaVersion: string;
  readonly ledgerId: string;
  readonly sequence: number;
  readonly eventId: string;
  readonly recordedAt: string;
  readonly previousHash: string;
  readonly envelope: EnvelopeAssinadoConteudo<TPayload>;
  readonly hash: string;
}

export interface EstadoGateConteudo {
  readonly gateId: string;
  readonly targetId?: string;
  readonly artifactDigest: string;
  readonly veredito: VereditoConteudo;
  readonly condition: CondicaoOperacionalConteudo;
  readonly evidenceIds: readonly string[];
  readonly assessmentIds: readonly string[];
  readonly blockers: readonly string[];
}

export interface ProjecaoPipelineConteudo {
  readonly authoritative: false;
  readonly ledgerId: string;
  readonly ledgerHead: string;
  readonly runId: string;
  readonly generatedAt: string;
  readonly gates: readonly EstadoGateConteudo[];
  readonly targets: readonly AlvoConteudo[];
  readonly artifacts: readonly ArtefatoConteudo[];
  readonly nextActions: readonly string[];
}
