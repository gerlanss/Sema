// SEMA-GOVERNED: sema.produto.pipeline_conteudo.adaptadores
// Descricao: validacao e planejamento declarativo de destinos abertos do pipeline de conteudo.

import { digestJsonCanonico } from "./canonical.js";
import type {
  AdaptadorConteudo,
  AlvoConteudo,
  ArtefatoConteudo,
  JsonObjeto,
  MetadataPublicaConteudo,
  RestricaoDeterministicaConteudo,
} from "./types.js";

/**
 * Vocabulário inicial para definições usuais. O validador aceita qualquer
 * capability opaca não vazia; esta lista não é uma whitelist.
 */
export const CAPABILITIES_CONTEUDO_PADRAO = Object.freeze([
  "content.topic.plan",
  "content.research.collect",
  "content.master.compose",
  "content.target.adapt",
  "content.qa.deterministic",
  "content.qa.semantic",
  "content.target.deliver",
  "content.target.confirm",
] as const);

export const CONSTRAINTS_DETERMINISTICAS_SUPORTADAS = Object.freeze([
  "artifact.bytes.min",
  "artifact.bytes.max",
  "media.duration.min",
  "media.duration.max",
  "text.length.min",
  "text.length.max",
] as const);

type KindConstraintDeterministica = (typeof CONSTRAINTS_DETERMINISTICAS_SUPORTADAS)[number];

export interface ObservacoesDeterministicasArtefatoConteudo {
  /** Media type observado por sniffing/verificador independente. */
  readonly observedMediaType?: string;
  /** Tamanho materializado do artefato, em bytes. */
  readonly artifactBytes?: number;
  /** Duração observada da mídia, em segundos. */
  readonly mediaDuration?: number;
  /** Comprimento textual observado, em pontos de código Unicode. */
  readonly textLength?: number;
}

export interface ResultadoConstraintDeterministicaConteudo {
  readonly constraintId: string;
  readonly kind: string;
  readonly observed: number | null;
  readonly limit: number | null;
  readonly passed: boolean;
  readonly bloqueios: readonly string[];
}

export interface ResultadoAvaliacaoConstraintsConteudo {
  readonly valido: boolean;
  readonly artifactDigest: string;
  readonly constraintsDigest: string;
  readonly resultsDigest: string;
  readonly resultados: readonly ResultadoConstraintDeterministicaConteudo[];
  readonly bloqueios: readonly string[];
}

export interface ResultadoValidacaoAdaptadorConteudo {
  readonly valido: boolean;
  readonly bloqueios: readonly string[];
}

export interface PlanoAdaptacaoConteudo {
  readonly targetId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly accountScope: string;
  readonly isolationKey: string;
  readonly formatProfileId: string;
  readonly locale: string;
  readonly capabilities: readonly string[];
  readonly acceptedMediaTypes: readonly string[];
  readonly deterministicConstraints: readonly RestricaoDeterministicaConteudo[];
  readonly requiredMetadata: readonly string[];
  readonly optionalMetadata: readonly string[];
  readonly confirmationPredicates: readonly string[];
  readonly metadata: MetadataPublicaConteudo;
  readonly masterArtifacts: readonly unknown[];
}

export interface BloqueioAlvoConteudo {
  readonly targetId: string;
  readonly codigo: string;
}

export interface ResultadoPlanejamentoAlvosConteudo {
  readonly planosAdaptacao: readonly PlanoAdaptacaoConteudo[];
  readonly bloqueiosPorAlvo: readonly BloqueioAlvoConteudo[];
}

const VERSOES_FLUTUANTES = new Set(["*", "current", "latest", "stable"]);
const CONSTRAINTS_SUPORTADAS = new Set<string>(CONSTRAINTS_DETERMINISTICAS_SUPORTADAS);
const DECLARACOES_NAO_CONFIAVEIS = new Set([
  "executor_declared",
  "executor_declaration",
  "runner_declared",
  "runner_declaration",
]);
const CHAVES_METADATA_SENSIVEIS = new Set([
  "apikey", "accesstoken", "refreshtoken", "authorization", "bearer", "password", "passwd",
  "secret", "clientsecret", "privatekey", "credential", "credentials", "apitoken",
  "awssecretaccesskey", "sessioncookie", "sessiontoken", "authcookie", "signingkey",
]);
const PADROES_VALOR_SENSIVEL = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/iu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
  /\b(?:github_pat_|gh[pousr]_|xox[baprs]-|sk_(?:live|test)_|sk-|AIza)[A-Za-z0-9_-]{12,}\b/u,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u,
];
const ACCOUNT_SCOPE = /^account:[a-z0-9][a-z0-9._-]{0,63}$/u;

function textoOpaco(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor === valor.trim() && !/[\s\u0000-\u001f\u007f]/u.test(valor);
}

function textosUnicosNaoVazios(valores: readonly string[]): boolean {
  return valores.every(textoOpaco) && new Set(valores).size === valores.length;
}

function clonarJson<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map((item) => clonarJson(item)) as T;
  }
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([chave, item]) => [chave, clonarJson(item)]),
    ) as T;
  }
  return valor;
}

function chaveMetadataNormalizada(chave: string): string {
  return chave.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function chaveMetadataSensivel(chave: string): boolean {
  const normalizada = chaveMetadataNormalizada(chave);
  if (CHAVES_METADATA_SENSIVEIS.has(normalizada)) return true;
  if (/(?:token|secret|password|passwd|credential|authorization|bearer|cookie|privatekey)/u.test(normalizada)) {
    return true;
  }
  return /(?:api|access|aws|client|private|signing|encryption).*key/u.test(normalizada);
}

function valorPareceSegredo(valor: string): boolean {
  return PADROES_VALOR_SENSIVEL.some((padrao) => padrao.test(valor));
}

export function validarReferenciaAccountScopeConteudo(valor: unknown): readonly string[] {
  if (typeof valor !== "string" || !ACCOUNT_SCOPE.test(valor)) return ["account_scope_referencia_invalida"];
  if (valorPareceSegredo(valor)) return ["account_scope_contem_possivel_credencial"];
  return [];
}

/** Metadata de target e publica no plano/ledger/projecao; segredos sao sempre externos. */
export function validarMetadataPublicaConteudo(valor: unknown): readonly string[] {
  const bloqueios: string[] = [];
  const visitar = (atual: unknown): void => {
    if (typeof atual === "string" && valorPareceSegredo(atual)) {
      bloqueios.push("valor_sensivel_em_metadata");
      return;
    }
    if (Array.isArray(atual)) {
      atual.forEach((item) => visitar(item));
      return;
    }
    if (atual === null || typeof atual !== "object") return;
    for (const [chave, item] of Object.entries(atual as Record<string, unknown>)) {
      if (chaveMetadataSensivel(chave) || valorPareceSegredo(chave)) {
        bloqueios.push("chave_sensivel_em_metadata");
      }
      visitar(item);
    }
  };
  visitar(valor);
  return [...new Set(bloqueios)];
}

function chaveIsolamento(alvo: AlvoConteudo): string {
  return `target:${encodeURIComponent(alvo.targetId)}:account:${encodeURIComponent(alvo.accountScope)}`;
}

/**
 * Escopo exato e injetivo para autorização target-bound. Alterar execução,
 * target ou conta sempre altera o escopo.
 */
export function escopoAutorizacaoAlvo(runId: string, alvo: AlvoConteudo): string {
  if (
    !textoOpaco(runId) ||
    !textoOpaco(alvo.targetId) ||
    validarReferenciaAccountScopeConteudo(alvo.accountScope).length > 0
  ) {
    throw new TypeError("escopo_autorizacao_alvo_invalido");
  }
  return `run:${encodeURIComponent(runId)}:target:${encodeURIComponent(alvo.targetId)}:account:${encodeURIComponent(alvo.accountScope)}`;
}

export function escopoAutorizacaoGlobal(runId: string): string {
  if (!textoOpaco(runId)) throw new TypeError("escopo_autorizacao_global_invalido");
  return `run:${encodeURIComponent(runId)}:global`;
}

function numeroFinitoNaoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0;
}

function chavesLimiteConstraint(constraint: RestricaoDeterministicaConteudo): readonly string[] {
  return constraint.kind.endsWith(".min")
    ? ["value", "limit", "min", "minimum"]
    : ["value", "limit", "max", "maximum"];
}

function validarConfigConstraint(constraint: RestricaoDeterministicaConteudo): readonly string[] {
  const config = constraint.config;
  if (
    config === undefined
    || config === null
    || typeof config !== "object"
    || Array.isArray(config)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(config))
  ) {
    return ["adapter_constraint_config_invalida"];
  }
  if (validarMetadataPublicaConteudo(config).length > 0) {
    return ["adapter_constraint_config_sensivel"];
  }
  const chaves = Object.keys(config);
  const permitidas = new Set(chavesLimiteConstraint(constraint));
  if (chaves.length !== 1 || !permitidas.has(chaves[0]!)) {
    return ["adapter_constraint_config_campos_invalidos"];
  }
  return numeroFinitoNaoNegativo(config[chaves[0]!])
    ? []
    : ["adapter_constraint_limite_invalido"];
}

function limiteConstraint(constraint: RestricaoDeterministicaConteudo): number | undefined {
  const config = constraint.config as Record<string, unknown> | undefined;
  if (!config) return undefined;
  for (const chave of chavesLimiteConstraint(constraint)) {
    if (numeroFinitoNaoNegativo(config[chave])) return config[chave];
  }
  return undefined;
}

function valorEmCaminho(fonte: unknown, caminho: readonly string[]): unknown {
  let atual = fonte;
  for (const segmento of caminho) {
    if (atual === null || typeof atual !== "object" || Array.isArray(atual)) return undefined;
    atual = (atual as Record<string, unknown>)[segmento];
  }
  return atual;
}

function primeiraMedicaoValida(fontes: readonly unknown[], caminhos: readonly (readonly string[])[]): number | undefined {
  for (const fonte of fontes) {
    for (const caminho of caminhos) {
      const valor = valorEmCaminho(fonte, caminho);
      if (numeroFinitoNaoNegativo(valor)) return valor;
    }
  }
  return undefined;
}

function medicaoConstraint(
  kind: KindConstraintDeterministica,
  artefato: ArtefatoConteudo,
  observacoes: ObservacoesDeterministicasArtefatoConteudo,
): number | undefined {
  // Metadado do artefato e declaracao do produtor. Somente observacao
  // independente pode satisfazer uma constraint canonica.
  const fontes = [observacoes];
  if (kind.startsWith("artifact.bytes.")) {
    return primeiraMedicaoValida(fontes, [["artifactBytes"], ["artifact.bytes"], ["artifact", "bytes"], ["bytes"]]);
  }
  if (kind.startsWith("media.duration.")) {
    return primeiraMedicaoValida(
      fontes,
      [["mediaDuration"], ["mediaDurationSeconds"], ["media.duration"], ["media", "duration"], ["duration"]],
    );
  }
  return primeiraMedicaoValida(fontes, [["textLength"], ["text.length"], ["text", "length"]]);
}

/**
 * Avalia somente medições fornecidas. Não lê arquivos, não chama ferramentas e
 * nunca trata um kind desconhecido como aprovação implícita.
 */
export function avaliarConstraintsDeterministicasConteudo(
  artefato: ArtefatoConteudo,
  constraints: readonly RestricaoDeterministicaConteudo[],
  observacoes: ObservacoesDeterministicasArtefatoConteudo = {},
): ResultadoAvaliacaoConstraintsConteudo {
  const constraintsDigest = digestJsonCanonico(constraints);
  const resultados: ResultadoConstraintDeterministicaConteudo[] = [];
  const bloqueios: string[] = [];

  for (const constraint of constraints) {
    const bloqueiosConstraint: string[] = [];
    if (!CONSTRAINTS_SUPORTADAS.has(constraint.kind)) {
      bloqueiosConstraint.push(`constraint_kind_nao_suportado:${constraint.constraintId}:${constraint.kind}`);
      resultados.push({
        constraintId: constraint.constraintId,
        kind: constraint.kind,
        observed: null,
        limit: null,
        passed: false,
        bloqueios: bloqueiosConstraint,
      });
      bloqueios.push(...bloqueiosConstraint);
      continue;
    }

    const kind = constraint.kind as KindConstraintDeterministica;
    const limit = limiteConstraint(constraint);
    const observed = medicaoConstraint(kind, artefato, observacoes);
    if (limit === undefined) bloqueiosConstraint.push(`constraint_limite_invalido:${constraint.constraintId}`);
    if (observed === undefined) bloqueiosConstraint.push(`constraint_observacao_ausente:${constraint.constraintId}`);

    const passed = bloqueiosConstraint.length === 0
      && (kind.endsWith(".min") ? observed! >= limit! : observed! <= limit!);
    if (!passed && bloqueiosConstraint.length === 0) {
      bloqueiosConstraint.push(`constraint_nao_satisfeita:${constraint.constraintId}`);
    }

    resultados.push({
      constraintId: constraint.constraintId,
      kind,
      observed: observed ?? null,
      limit: limit ?? null,
      passed,
      bloqueios: bloqueiosConstraint,
    });
    bloqueios.push(...bloqueiosConstraint);
  }

  const resultsDigest = digestJsonCanonico({
    schemaVersion: "1.0",
    artifactId: artefato.artifactId,
    artifactDigest: artefato.digest,
    runId: artefato.runId,
    targetId: artefato.targetId ?? null,
    constraintsDigest,
    observedMediaType: observacoes.observedMediaType ?? null,
    resultados,
  });

  return {
    valido: bloqueios.length === 0 && resultados.every((resultado) => resultado.passed),
    artifactDigest: artefato.digest,
    constraintsDigest,
    resultsDigest,
    resultados,
    bloqueios,
  };
}

/** Valida somente propriedades declarativas; nenhuma capability é executada. */
export function validarAdaptadorConteudo(adapter: AdaptadorConteudo): ResultadoValidacaoAdaptadorConteudo {
  const bloqueios: string[] = [];

  if (!textoOpaco(adapter.adapterId)) {
    bloqueios.push("adapter_id_invalido");
  }
  if (!textoOpaco(adapter.version) || VERSOES_FLUTUANTES.has(adapter.version.toLowerCase())) {
    bloqueios.push("adapter_version_nao_fixada");
  }
  if (!Array.isArray(adapter.capabilities) || adapter.capabilities.length === 0 || !textosUnicosNaoVazios(adapter.capabilities)) {
    bloqueios.push("adapter_capabilities_invalidas");
  }
  if (
    !Array.isArray(adapter.acceptedMediaTypes)
    || adapter.acceptedMediaTypes.length === 0
    || !textosUnicosNaoVazios(adapter.acceptedMediaTypes)
  ) {
    bloqueios.push("adapter_media_types_invalidos");
  }
  if (!Array.isArray(adapter.formatProfiles) || adapter.formatProfiles.length === 0 || !textosUnicosNaoVazios(adapter.formatProfiles)) {
    bloqueios.push("adapter_format_profiles_invalidos");
  }

  if (!Array.isArray(adapter.deterministicConstraints) || adapter.deterministicConstraints.length === 0) {
    bloqueios.push("adapter_constraints_deterministicas_ausentes");
  } else {
    const ids = new Set<string>();
    for (const constraint of adapter.deterministicConstraints) {
      if (!textoOpaco(constraint.constraintId) || !textoOpaco(constraint.kind)) {
        bloqueios.push("adapter_constraint_invalida");
        continue;
      }
      if (valorPareceSegredo(constraint.constraintId) || valorPareceSegredo(constraint.kind)) {
        bloqueios.push("adapter_constraint_identificador_sensivel");
        continue;
      }
      if (ids.has(constraint.constraintId)) {
        bloqueios.push(`adapter_constraint_id_duplicado:${constraint.constraintId}`);
      }
      ids.add(constraint.constraintId);
      if (!CONSTRAINTS_SUPORTADAS.has(constraint.kind)) {
        bloqueios.push(`adapter_constraint_kind_nao_suportado:${constraint.constraintId}:${constraint.kind}`);
      } else {
        bloqueios.push(...validarConfigConstraint(constraint));
      }
    }
  }

  if (!Array.isArray(adapter.requiredMetadata) || !textosUnicosNaoVazios(adapter.requiredMetadata)) {
    bloqueios.push("adapter_required_metadata_invalido");
  } else {
    for (const campo of adapter.requiredMetadata) {
      if (chaveMetadataSensivel(campo) || valorPareceSegredo(campo)) {
        bloqueios.push("adapter_required_metadata_sensivel");
      }
    }
  }
  if (!Array.isArray(adapter.optionalMetadata) || !textosUnicosNaoVazios(adapter.optionalMetadata)) {
    bloqueios.push("adapter_optional_metadata_invalido");
  } else {
    for (const campo of adapter.optionalMetadata) {
      if (chaveMetadataSensivel(campo) || valorPareceSegredo(campo)) {
        bloqueios.push("adapter_optional_metadata_sensivel");
      }
      if (adapter.requiredMetadata.includes(campo)) bloqueios.push("adapter_metadata_required_optional_sobreposta");
    }
  }
  if (
    !Array.isArray(adapter.confirmationPredicates)
    || adapter.confirmationPredicates.length === 0
    || !textosUnicosNaoVazios(adapter.confirmationPredicates)
  ) {
    bloqueios.push("adapter_confirmation_predicates_invalidos");
  } else if (adapter.confirmationPredicates.some((item) => DECLARACOES_NAO_CONFIAVEIS.has(item.toLowerCase()))) {
    bloqueios.push("adapter_confirmacao_baseada_em_declaracao_do_executor");
  }

  return { valido: bloqueios.length === 0, bloqueios };
}

/**
 * Materializa um plano isolado por targetId/accountScope. Os planos carregam
 * instruções e referências; credenciais e chamadas de ferramenta ficam no
 * runner externo.
 */
export function planejarAlvosConteudo(
  alvos: readonly AlvoConteudo[],
  adapters: readonly AdaptadorConteudo[],
  artefatosMestre: readonly unknown[],
): ResultadoPlanejamentoAlvosConteudo {
  const planosAdaptacao: PlanoAdaptacaoConteudo[] = [];
  const bloqueiosPorAlvo: BloqueioAlvoConteudo[] = [];
  const adicionarBloqueio = (targetId: string, codigo: string): void => {
    bloqueiosPorAlvo.push({ targetId, codigo });
  };

  if (alvos.length === 0) {
    adicionarBloqueio("*", "alvos_ausentes");
    return { planosAdaptacao, bloqueiosPorAlvo };
  }

  const contagemTargets = new Map<string, number>();
  for (const alvo of alvos) {
    contagemTargets.set(alvo.targetId, (contagemTargets.get(alvo.targetId) ?? 0) + 1);
  }

  const adaptersPorId = new Map<string, AdaptadorConteudo[]>();
  for (const adapter of adapters) {
    const encontrados = adaptersPorId.get(adapter.adapterId) ?? [];
    encontrados.push(adapter);
    adaptersPorId.set(adapter.adapterId, encontrados);
  }

  for (const alvo of alvos) {
    const targetId = textoOpaco(alvo.targetId) ? alvo.targetId : "<target-invalido>";
    const bloqueiosAntes = bloqueiosPorAlvo.length;

    if (!textoOpaco(alvo.targetId)) {
      adicionarBloqueio(targetId, "target_id_invalido");
    } else if ((contagemTargets.get(alvo.targetId) ?? 0) > 1) {
      adicionarBloqueio(targetId, "target_id_duplicado");
    }
    for (const bloqueio of validarReferenciaAccountScopeConteudo(alvo.accountScope)) {
      adicionarBloqueio(targetId, bloqueio);
    }
    if (!textoOpaco(alvo.formatProfileId)) {
      adicionarBloqueio(targetId, "format_profile_id_invalido");
    }
    if (!textoOpaco(alvo.locale)) {
      adicionarBloqueio(targetId, "locale_invalido");
    }
    if (alvo.metadata === null || typeof alvo.metadata !== "object" || Array.isArray(alvo.metadata)) {
      adicionarBloqueio(targetId, "metadata_invalido");
    } else {
      for (const valor of Object.values(alvo.metadata)) {
        if (valor !== null && !["string", "number", "boolean"].includes(typeof valor)) {
          adicionarBloqueio(targetId, "metadata_valor_nao_escalar");
        } else if (typeof valor === "number" && !Number.isFinite(valor)) {
          adicionarBloqueio(targetId, "metadata_numero_nao_finito");
        }
      }
      for (const bloqueio of validarMetadataPublicaConteudo(alvo.metadata)) {
        adicionarBloqueio(targetId, bloqueio);
      }
    }

    const candidatos = adaptersPorId.get(alvo.adapterId) ?? [];
    if (candidatos.length === 0) {
      adicionarBloqueio(targetId, "adapter_nao_encontrado");
    } else if (candidatos.length > 1) {
      adicionarBloqueio(targetId, "adapter_id_ambiguo_na_definicao");
    }

    const adapter = candidatos.length === 1 ? candidatos[0] : undefined;
    if (adapter) {
      const resultadoAdapter = validarAdaptadorConteudo(adapter);
      for (const bloqueio of resultadoAdapter.bloqueios) {
        adicionarBloqueio(targetId, `adapter_invalido:${bloqueio}`);
      }
      if (!adapter.formatProfiles.includes(alvo.formatProfileId)) {
        adicionarBloqueio(targetId, "format_profile_nao_declarado_no_adapter");
      }
      for (const campo of adapter.requiredMetadata) {
        if (!Object.prototype.hasOwnProperty.call(alvo.metadata, campo)) {
          adicionarBloqueio(targetId, "metadata_obrigatorio_ausente");
        }
      }
      const permitidos = new Set([...adapter.requiredMetadata, ...adapter.optionalMetadata]);
      for (const campo of Object.keys(alvo.metadata)) {
        if (!permitidos.has(campo)) adicionarBloqueio(targetId, "metadata_nao_declarado_no_adapter");
      }
    }

    if (bloqueiosPorAlvo.length !== bloqueiosAntes || !adapter) {
      continue;
    }

    planosAdaptacao.push({
      targetId: alvo.targetId,
      adapterId: adapter.adapterId,
      adapterVersion: adapter.version,
      accountScope: alvo.accountScope,
      isolationKey: chaveIsolamento(alvo),
      formatProfileId: alvo.formatProfileId,
      locale: alvo.locale,
      capabilities: [...adapter.capabilities],
      acceptedMediaTypes: [...adapter.acceptedMediaTypes],
      deterministicConstraints: clonarJson(adapter.deterministicConstraints),
      requiredMetadata: [...adapter.requiredMetadata],
      optionalMetadata: [...adapter.optionalMetadata],
      confirmationPredicates: [...adapter.confirmationPredicates],
      metadata: clonarJson(alvo.metadata),
      masterArtifacts: [...artefatosMestre],
    });
  }

  return { planosAdaptacao, bloqueiosPorAlvo };
}
