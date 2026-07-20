// SEMA-GOVERNED: sema.produto.sistemas_interativos.portabilidade
// Descricao: analise local de portabilidade com perdas declaradas e planejamento de workers distribuidos sem execucao.

import { digestJsonSistemaInterativo, digestSha256Valido } from "./canonical.js";

export const SCHEMA_PORTABILIDADE = "sema.interactive.portability/v1" as const;
export const SCHEMA_WORKERS_DISTRIBUIDOS = "sema.interactive.distributed-jobs/v1" as const;

export type StatusMapeamentoPortabilidade = "EXACT" | "APPROXIMATE" | "UNSUPPORTED";

export interface EntradaManifestoFontePortabilidade {
  readonly semanticId: string;
  readonly sourceKind: string;
  readonly contentDigest: string;
  readonly required: boolean;
}

export interface ManifestoFontePortabilidade {
  readonly experienceIrDigest: string;
  readonly snapshotDigest: string;
  readonly entries: readonly EntradaManifestoFontePortabilidade[];
  readonly manifestDigest: string;
}

export interface OrigemPortabilidade {
  readonly engine: string;
  readonly version: string;
  readonly snapshotDigest: string;
  readonly coordinateSystem: string;
}

export interface MapeamentoPortabilidade {
  readonly mappingId: string;
  readonly semanticId: string;
  readonly sourceKind: string;
  readonly targetKind: string;
  readonly status: StatusMapeamentoPortabilidade;
  readonly losses: readonly string[];
  readonly fallback?: string;
  readonly acceptanceCriteria: readonly string[];
}

export interface AlvoPortabilidade {
  readonly targetId: string;
  readonly engine: string;
  readonly version: string;
  readonly outputFormat: string;
  readonly mappings: readonly MapeamentoPortabilidade[];
}

export interface MigracaoEngine {
  readonly migrationId: string;
  readonly targetId: string;
  readonly engine: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly backupDigest: string;
  readonly compatibilityReportDigest: string;
  readonly testPlanDigest: string;
  readonly rollbackPlanDigest: string;
}

export interface PlanoPortabilidadeInterativa {
  readonly schemaVersion: typeof SCHEMA_PORTABILIDADE;
  readonly planId: string;
  readonly systemId: string;
  readonly experienceIrDigest: string;
  readonly source: OrigemPortabilidade;
  readonly sourceManifest: ManifestoFontePortabilidade;
  readonly targets: readonly AlvoPortabilidade[];
  readonly migrations: readonly MigracaoEngine[];
  readonly acceptance: {
    readonly maxUnsupportedPerTarget: number;
    readonly allowApproximate: boolean;
    readonly requiredEvidence: readonly string[];
  };
}

export interface RelatorioAlvoPortabilidade {
  readonly targetId: string;
  readonly exact: number;
  readonly approximate: number;
  readonly unsupported: number;
  readonly sourceCoverageComplete: boolean;
  readonly mappingsBoundToSource: boolean;
  readonly migrationLinked: boolean;
  readonly readyForExternalMigration: boolean;
  readonly requiresExternalValidation: true;
  readonly converted: false;
}

export interface PerdaPortabilidade {
  readonly targetId: string;
  readonly mappingId: string;
  readonly status: "APPROXIMATE" | "UNSUPPORTED";
  readonly lossCodes: readonly string[];
  readonly fallback: string;
}

export interface ResultadoPortabilidadeInterativa {
  readonly valido: boolean;
  readonly planDigest: string;
  readonly targetReports: readonly RelatorioAlvoPortabilidade[];
  readonly declaredLosses: readonly PerdaPortabilidade[];
  readonly migrationGaps: readonly string[];
  readonly nextActions: readonly string[];
  readonly converted: false;
  readonly authoritative: false;
  readonly executed: false;
  readonly bloqueios: readonly string[];
}

export interface WorkerDistribuido {
  readonly workerId: string;
  readonly capabilities: readonly string[];
  readonly ramMb: number;
  readonly vramMb: number;
  readonly diskMb: number;
  readonly maxConcurrency: number;
  readonly isolation: "CONTAINER" | "VM" | "PROCESS_SANDBOX";
}

export interface JobDistribuido {
  readonly jobId: string;
  readonly type: "COOK" | "SHADERS" | "RENDER" | "TEST";
  readonly inputDigest: string;
  readonly dependsOn: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly budgets: { readonly ramMb: number; readonly vramMb: number; readonly diskMb: number; readonly runtimeSeconds: number };
  readonly idempotencyKey: string;
  readonly checkpointIntervalSeconds: number;
  readonly retry: { readonly maxAttempts: number; readonly backoffSeconds: number };
  readonly resourceLockIds: readonly string[];
  readonly requiredEvidence: readonly string[];
}

export interface LeaseRecursoDistribuido {
  readonly lockId: string;
  readonly resourceId: string;
  readonly resourceType: "GPU" | "EDITOR" | "CACHE";
  readonly ownerJobId: string;
  readonly exclusive: boolean;
  readonly ttlSeconds: number;
  readonly heartbeatSeconds: number;
  readonly checkpointDigest: string;
}

export interface PlanoWorkersDistribuidos {
  readonly schemaVersion: typeof SCHEMA_WORKERS_DISTRIBUIDOS;
  readonly planId: string;
  readonly systemId: string;
  readonly inputDigest: string;
  readonly workers: readonly WorkerDistribuido[];
  readonly jobs: readonly JobDistribuido[];
  readonly leases: readonly LeaseRecursoDistribuido[];
  readonly evidenceRequirements: readonly string[];
}

export interface ResultadoWorkersDistribuidos {
  readonly valido: boolean;
  readonly planDigest: string;
  readonly topologicalOrder: readonly string[];
  readonly assignments: readonly { readonly jobId: string; readonly workerId: string }[];
  readonly capabilityGaps: readonly string[];
  readonly lockConflicts: readonly string[];
  readonly nextActions: readonly string[];
  readonly completed: false;
  readonly authoritative: false;
  readonly executed: false;
  readonly bloqueios: readonly string[];
}

type Registro = Record<string, unknown>;
const ID = /^[a-z0-9][a-z0-9._:/-]{0,127}$/;
const VERSAO = /^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][a-z0-9.-]+)?$/i;
const CHAVE_SENSIVEL = /(?:password|passwd|senha|secret|token|api.?key|private.?key|credential|authorization|cookie)/i;
const VALORES_SENSIVEIS = [
  /\bbearer\s+[a-z0-9._~+\/-]{8,}/i,
  /^(?:sk[-_][a-z0-9_-]{8,}|ghp_[a-z0-9]{20,}|github_pat_[a-z0-9_]{20,})$/i,
  /^eyJ[a-z0-9_-]{8,}\.eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}$/i,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----/,
  /(?:^|[?&])(?:access_?token|api_?key|aws_?secret_?access_?key|secret|password|passwd|signature|sig|token|credential|authorization)=[^&#\s]+/i,
  /:\/\/[^/\s:@]+:[^/\s@]+@/,
];
const STATUS = new Set<StatusMapeamentoPortabilidade>(["EXACT", "APPROXIMATE", "UNSUPPORTED"]);
const EVIDENCIAS_PORTABILIDADE = [
  "import.scene", "import.assets", "import.materials", "import.animation", "import.physics",
  "import.audio", "import.timeline", "package.build", "runtime.smoke",
] as const;
const EVIDENCIAS_JOB = ["output.digest", "job.log", "job.checkpoint", "resources.metrics"] as const;

function objeto(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function id(valor: unknown): valor is string {
  return typeof valor === "string" && ID.test(valor);
}

function positivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

function inteiroNaoNegativo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0;
}

function listaUnica<T extends string>(valor: unknown, validar: (item: unknown) => item is T, permitirVazia = false): valor is readonly T[] {
  return Array.isArray(valor)
    && (permitirVazia || valor.length > 0)
    && valor.every(validar)
    && new Set(valor).size === valor.length;
}

function idsUnicos(valores: readonly unknown[]): boolean {
  return valores.every(id) && new Set(valores).size === valores.length;
}

function somenteChaves(valor: Registro, permitidas: readonly string[]): boolean {
  const allowlist = new Set(permitidas);
  return Object.keys(valor).every((chave) => allowlist.has(chave));
}

function valorSensivel(valor: string): boolean {
  if (digestSha256Valido(valor) || /^opaque:sha256:[a-f0-9]{64}$/.test(valor)) return false;
  return VALORES_SENSIVEIS.some((padrao) => padrao.test(valor));
}

function contemSensivel(valor: unknown, visitados = new Set<object>()): boolean {
  if (typeof valor === "string") return valorSensivel(valor);
  if (!objeto(valor) && !Array.isArray(valor)) return false;
  if (visitados.has(valor)) return true;
  visitados.add(valor);
  try {
    if (Array.isArray(valor)) return valor.some((item) => contemSensivel(item, visitados));
    return Object.entries(valor).some(([chave, item]) => CHAVE_SENSIVEL.test(chave) || contemSensivel(item, visitados));
  } finally {
    visitados.delete(valor);
  }
}

function exigir(bloqueios: string[], condicao: boolean, codigo: string): void {
  if (!condicao) bloqueios.push(codigo);
}

function digestSeguro(valor: unknown, bloqueios: string[], codigo: string): string {
  try {
    return digestJsonSistemaInterativo(valor);
  } catch {
    bloqueios.push(codigo);
    return "sha256:invalid";
  }
}

function versao(valor: unknown): valor is string {
  return typeof valor === "string" && VERSAO.test(valor);
}

export function digestManifestoFontePortabilidade(
  manifesto: Omit<ManifestoFontePortabilidade, "manifestDigest">,
): string {
  return digestJsonSistemaInterativo({
    experienceIrDigest: manifesto.experienceIrDigest,
    snapshotDigest: manifesto.snapshotDigest,
    entries: [...manifesto.entries]
      .map((entry) => ({
        semanticId: entry.semanticId,
        sourceKind: entry.sourceKind,
        contentDigest: entry.contentDigest,
        required: entry.required,
      }))
      .sort((a, b) => a.semanticId.localeCompare(b.semanticId)),
  });
}

export function analisarPlanoPortabilidadeInterativa(entrada: unknown): ResultadoPortabilidadeInterativa {
  const bloqueios: string[] = [];
  const reports: RelatorioAlvoPortabilidade[] = [];
  const perdas: PerdaPortabilidade[] = [];
  const gaps: string[] = [];
  if (!objeto(entrada)) {
    return {
      valido: false, planDigest: "sha256:invalid", targetReports: [], declaredLosses: [], migrationGaps: [],
      nextActions: ["corrigir_plano_portabilidade"], converted: false, authoritative: false, executed: false, bloqueios: ["plano_invalido"],
    };
  }
  const entradaSensivel = contemSensivel(entrada);
  if (entradaSensivel) bloqueios.push("plano_contem_dado_sensivel");
  exigir(bloqueios, somenteChaves(entrada, [
    "schemaVersion", "planId", "systemId", "experienceIrDigest", "source", "sourceManifest", "targets", "migrations", "acceptance",
  ]), "campos_top_level_desconhecidos");
  exigir(bloqueios, entrada.schemaVersion === SCHEMA_PORTABILIDADE, "schema_version_nao_suportada");
  exigir(bloqueios, id(entrada.planId), "plan_id_invalido");
  exigir(bloqueios, id(entrada.systemId), "system_id_invalido");
  exigir(bloqueios, digestSha256Valido(entrada.experienceIrDigest), "experience_ir_digest_invalido");
  const source = entrada.source;
  const sourceValida = objeto(source)
    && texto(source.engine)
    && versao(source.version)
    && digestSha256Valido(source.snapshotDigest)
    && texto(source.coordinateSystem);
  exigir(bloqueios, sourceValida, "source_invalida");

  const sourceManifest = entrada.sourceManifest;
  const manifestEntries = objeto(sourceManifest) && Array.isArray(sourceManifest.entries) ? sourceManifest.entries : [];
  const manifestEntryIdsValidos = idsUnicos(manifestEntries.map((item) => objeto(item) ? item.semanticId : undefined));
  const manifestEntriesPorId = new Map<string, EntradaManifestoFontePortabilidade>();
  let manifestEntriesValidas = manifestEntries.length > 0 && manifestEntryIdsValidos;
  for (const entry of manifestEntries) {
    const valida = objeto(entry)
      && id(entry.semanticId)
      && texto(entry.sourceKind)
      && digestSha256Valido(entry.contentDigest)
      && typeof entry.required === "boolean";
    if (!valida) manifestEntriesValidas = false;
    else {
      const tipada = entry as unknown as EntradaManifestoFontePortabilidade;
      manifestEntriesPorId.set(tipada.semanticId, tipada);
    }
  }
  const manifestShapeValido = objeto(sourceManifest)
    && digestSha256Valido(sourceManifest.experienceIrDigest)
    && digestSha256Valido(sourceManifest.snapshotDigest)
    && digestSha256Valido(sourceManifest.manifestDigest)
    && manifestEntriesValidas
    && [...manifestEntriesPorId.values()].some((entry) => entry.required);
  exigir(bloqueios, manifestShapeValido, "source_manifest_invalido");
  const manifestVinculado = manifestShapeValido
    && sourceManifest.experienceIrDigest === entrada.experienceIrDigest
    && sourceValida
    && sourceManifest.snapshotDigest === source.snapshotDigest;
  exigir(bloqueios, manifestVinculado, "source_manifest_desvinculado");
  let manifestDigestValido = false;
  if (manifestShapeValido) {
    const manifestoTipado = sourceManifest as unknown as ManifestoFontePortabilidade;
    manifestDigestValido = manifestoTipado.manifestDigest === digestManifestoFontePortabilidade({
      experienceIrDigest: manifestoTipado.experienceIrDigest,
      snapshotDigest: manifestoTipado.snapshotDigest,
      entries: manifestoTipado.entries,
    });
  }
  exigir(bloqueios, manifestDigestValido, "source_manifest_digest_divergente");
  const sourceManifestValido = manifestShapeValido && manifestVinculado && manifestDigestValido;
  const semanticIdsObrigatorios = [...manifestEntriesPorId.values()]
    .filter((entry) => entry.required)
    .map((entry) => entry.semanticId);

  const acceptance = entrada.acceptance;
  const acceptanceValida = objeto(acceptance)
    && inteiroNaoNegativo(acceptance.maxUnsupportedPerTarget)
    && typeof acceptance.allowApproximate === "boolean"
    && listaUnica(acceptance.requiredEvidence, texto)
    && EVIDENCIAS_PORTABILIDADE.every((item) => (acceptance.requiredEvidence as readonly string[]).includes(item));
  exigir(bloqueios, acceptanceValida, "acceptance_invalida_ou_evidencias_incompletas");

  const targets = Array.isArray(entrada.targets) ? entrada.targets : [];
  exigir(bloqueios, targets.length > 0, "targets_ausentes");
  const targetIdsValidos = idsUnicos(targets.map((item) => objeto(item) ? item.targetId : undefined));
  exigir(bloqueios, targetIdsValidos, "target_ids_invalidos_ou_duplicados");
  const targetBasicoPorId = new Map<string, { engine: string; version: string }>();
  for (const target of targets) {
    if (objeto(target) && id(target.targetId) && texto(target.engine) && versao(target.version)) {
      targetBasicoPorId.set(target.targetId, { engine: target.engine, version: target.version });
    }
  }

  const migrations = Array.isArray(entrada.migrations) ? entrada.migrations : [];
  exigir(bloqueios, migrations.length > 0, "migrations_ausentes");
  const migrationIdsValidos = idsUnicos(migrations.map((item) => objeto(item) ? item.migrationId : undefined));
  exigir(bloqueios, migrationIdsValidos, "migration_ids_invalidos_ou_duplicados");
  let migrationsValidasGlobais = migrations.length > 0 && migrationIdsValidos;
  const targetIdsComMigration = new Set<string>();
  for (const migration of migrations) {
    const baseValida = objeto(migration)
      && id(migration.migrationId)
      && id(migration.targetId)
      && texto(migration.engine)
      && versao(migration.fromVersion)
      && versao(migration.toVersion)
      && migration.fromVersion !== migration.toVersion
      && digestSha256Valido(migration.backupDigest)
      && digestSha256Valido(migration.compatibilityReportDigest)
      && digestSha256Valido(migration.testPlanDigest)
      && digestSha256Valido(migration.rollbackPlanDigest);
    exigir(bloqueios, baseValida, "migration_invalida_sem_backup_teste_ou_rollback");
    if (!baseValida) {
      migrationsValidasGlobais = false;
      continue;
    }
    const tipada = migration as unknown as MigracaoEngine;
    const target = targetBasicoPorId.get(tipada.targetId);
    const ligadaNaOrigem = sourceValida && tipada.engine === source.engine && tipada.toVersion === source.version;
    const ligadaNoTarget = Boolean(target && tipada.engine === target.engine && tipada.toVersion === target.version);
    if (!target || (!ligadaNaOrigem && !ligadaNoTarget)) {
      bloqueios.push("migration_desconectada_do_target_ou_source");
      migrationsValidasGlobais = false;
      continue;
    }
    targetIdsComMigration.add(tipada.targetId);
  }
  for (const target of targets) {
    if (!objeto(target)
      || !id(target.targetId)
      || !texto(target.engine)
      || !versao(target.version)
      || !texto(target.outputFormat)
      || !Array.isArray(target.mappings)
      || target.mappings.length === 0) {
      bloqueios.push("target_invalido");
      if (objeto(target) && id(target.targetId)) gaps.push(target.targetId);
      continue;
    }
    const targetDiferenteDaSource = !(sourceValida && source.engine === target.engine && source.version === target.version);
    if (!targetDiferenteDaSource) bloqueios.push("target_igual_a_source_sem_migracao");
    const mappingIdsValidos = idsUnicos(target.mappings.map((item) => objeto(item) ? item.mappingId : undefined));
    const semanticIdsValidos = idsUnicos(target.mappings.map((item) => objeto(item) ? item.semanticId : undefined));
    exigir(bloqueios, mappingIdsValidos, "mapping_ids_invalidos_ou_duplicados");
    exigir(bloqueios, semanticIdsValidos, "semantic_ids_invalidos_ou_duplicados");
    let exact = 0;
    let approximate = 0;
    let unsupported = 0;
    let mappingsValidos = mappingIdsValidos && semanticIdsValidos;
    let mappingsBoundToSource = sourceManifestValido;
    const semanticIdsMapeados = new Set<string>();
    for (const mapping of target.mappings) {
      const baseValida = objeto(mapping)
        && id(mapping.mappingId)
        && id(mapping.semanticId)
        && texto(mapping.sourceKind)
        && texto(mapping.targetKind)
        && STATUS.has(mapping.status as StatusMapeamentoPortabilidade)
        && Array.isArray(mapping.losses)
        && mapping.losses.every(texto)
        && new Set(mapping.losses).size === mapping.losses.length
        && listaUnica(mapping.acceptanceCriteria, texto);
      exigir(bloqueios, baseValida, "mapping_invalido");
      if (!baseValida) {
        mappingsValidos = false;
        continue;
      }
      const tipado = mapping as unknown as MapeamentoPortabilidade;
      const manifestEntry = manifestEntriesPorId.get(tipado.semanticId);
      if (!sourceManifestValido || !manifestEntry || manifestEntry.sourceKind !== tipado.sourceKind) {
        bloqueios.push("mapping_desconectado_do_source_manifest");
        mappingsBoundToSource = false;
        continue;
      }
      semanticIdsMapeados.add(tipado.semanticId);
      if (tipado.status === "EXACT") {
        exact += 1;
        if (tipado.losses.length > 0) {
          bloqueios.push("mapping_exact_nao_pode_declarar_loss");
          mappingsValidos = false;
        }
      } else {
        if (tipado.status === "APPROXIMATE") approximate += 1;
        if (tipado.status === "UNSUPPORTED") unsupported += 1;
        const perdaValida = tipado.losses.length > 0 && texto(tipado.fallback);
        exigir(bloqueios, perdaValida, "mapping_nao_exato_exige_loss_e_fallback");
        if (!perdaValida) mappingsValidos = false;
        if (perdaValida) perdas.push({
          targetId: target.targetId,
          mappingId: tipado.mappingId,
          status: tipado.status,
          lossCodes: [...tipado.losses].sort(),
          fallback: tipado.fallback!,
        });
      }
    }
    const sourceCoverageComplete = sourceManifestValido
      && semanticIdsObrigatorios.every((semanticId) => semanticIdsMapeados.has(semanticId));
    exigir(bloqueios, sourceCoverageComplete, "mapping_cobertura_origem_incompleta");
    const migrationLinked = targetIdsComMigration.has(target.targetId);
    exigir(bloqueios, migrationLinked, "target_sem_migration_ligada");
    const limite = acceptanceValida ? acceptance.maxUnsupportedPerTarget as number : 0;
    const aceitaApproximate = acceptanceValida && acceptance.allowApproximate === true;
    const ready = acceptanceValida
      && targetIdsValidos
      && targetDiferenteDaSource
      && migrationsValidasGlobais
      && mappingsValidos
      && mappingsBoundToSource
      && sourceCoverageComplete
      && migrationLinked
      && unsupported <= limite
      && (approximate === 0 || aceitaApproximate);
    if (!ready) gaps.push(target.targetId);
    reports.push({
      targetId: target.targetId,
      exact,
      approximate,
      unsupported,
      sourceCoverageComplete,
      mappingsBoundToSource,
      migrationLinked,
      readyForExternalMigration: ready,
      requiresExternalValidation: true,
      converted: false,
    });
  }

  const planDigest = digestSeguro(entrada, bloqueios, "plano_nao_canonicalizavel");
  const gapsUnicos = entradaSensivel ? [] : [...new Set(gaps)].sort();
  const bloqueiosUnicos = [...new Set(bloqueios)].sort();
  const valido = bloqueiosUnicos.length === 0 && gapsUnicos.length === 0;
  const reportsFinais = entradaSensivel ? [] : reports.sort((a, b) => a.targetId.localeCompare(b.targetId))
    .map((report) => valido ? report : { ...report, readyForExternalMigration: false });
  return {
    valido,
    planDigest,
    targetReports: reportsFinais,
    declaredLosses: entradaSensivel ? [] : perdas.sort((a, b) => `${a.targetId}:${a.mappingId}`.localeCompare(`${b.targetId}:${b.mappingId}`)),
    migrationGaps: gapsUnicos,
    nextActions: bloqueiosUnicos.length > 0
      ? ["corrigir_plano_portabilidade"]
      : gapsUnicos.length > 0
        ? gapsUnicos.map((targetId) => `revisar_perdas_e_acceptance:${targetId}`)
        : reportsFinais.map((item) => `entregar_plano_ao_adapter_externo:${item.targetId}`),
    converted: false,
    authoritative: false,
    executed: false,
    bloqueios: bloqueiosUnicos,
  };
}

function ordemTopologica(jobs: readonly JobDistribuido[]): { ordem: string[]; ciclo: boolean; referenciasInvalidas: boolean } {
  const ids = new Set(jobs.map((job) => job.jobId));
  const referenciasInvalidas = jobs.some((job) => job.dependsOn.some((dep) => !ids.has(dep) || dep === job.jobId));
  const graus = new Map(jobs.map((job) => [job.jobId, job.dependsOn.length] as const));
  const filhos = new Map<string, string[]>();
  for (const job of jobs) for (const dep of job.dependsOn) filhos.set(dep, [...(filhos.get(dep) ?? []), job.jobId]);
  const fila = [...graus.entries()].filter(([, grau]) => grau === 0).map(([jobId]) => jobId).sort();
  const ordem: string[] = [];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    ordem.push(atual);
    for (const filho of (filhos.get(atual) ?? []).sort()) {
      const grau = (graus.get(filho) ?? 0) - 1;
      graus.set(filho, grau);
      if (grau === 0) {
        fila.push(filho);
        fila.sort();
      }
    }
  }
  return { ordem, ciclo: ordem.length !== jobs.length, referenciasInvalidas };
}

function dependeDe(jobId: string, ancestorId: string, porId: ReadonlyMap<string, JobDistribuido>, visitados = new Set<string>()): boolean {
  if (visitados.has(jobId)) return false;
  visitados.add(jobId);
  const job = porId.get(jobId);
  if (!job) return false;
  if (job.dependsOn.includes(ancestorId)) return true;
  return job.dependsOn.some((dep) => dependeDe(dep, ancestorId, porId, visitados));
}

export function validarPlanoWorkersDistribuidos(entrada: unknown): ResultadoWorkersDistribuidos {
  const bloqueios: string[] = [];
  const gaps: string[] = [];
  const conflicts: string[] = [];
  const assignments: { jobId: string; workerId: string }[] = [];
  if (!objeto(entrada)) {
    return {
      valido: false, planDigest: "sha256:invalid", topologicalOrder: [], assignments: [], capabilityGaps: [], lockConflicts: [],
      nextActions: ["corrigir_plano_workers"], completed: false, authoritative: false, executed: false, bloqueios: ["plano_invalido"],
    };
  }
  const entradaSensivel = contemSensivel(entrada);
  if (entradaSensivel) bloqueios.push("plano_contem_dado_sensivel");
  exigir(bloqueios, somenteChaves(entrada, [
    "schemaVersion", "planId", "systemId", "inputDigest", "workers", "jobs", "leases", "evidenceRequirements",
  ]), "campos_top_level_desconhecidos");
  exigir(bloqueios, entrada.schemaVersion === SCHEMA_WORKERS_DISTRIBUIDOS, "schema_version_nao_suportada");
  exigir(bloqueios, id(entrada.planId), "plan_id_invalido");
  exigir(bloqueios, id(entrada.systemId), "system_id_invalido");
  exigir(bloqueios, digestSha256Valido(entrada.inputDigest), "input_digest_invalido");

  const workersBrutos = Array.isArray(entrada.workers) ? entrada.workers : [];
  exigir(bloqueios, idsUnicos(workersBrutos.map((item) => objeto(item) ? item.workerId : undefined)), "worker_ids_invalidos_ou_duplicados");
  const workers: WorkerDistribuido[] = [];
  for (const worker of workersBrutos) {
    const valido = objeto(worker)
      && id(worker.workerId)
      && listaUnica(worker.capabilities, id)
      && positivo(worker.ramMb)
      && inteiroNaoNegativo(worker.vramMb)
      && positivo(worker.diskMb)
      && positivo(worker.maxConcurrency)
      && ["CONTAINER", "VM", "PROCESS_SANDBOX"].includes(String(worker.isolation));
    exigir(bloqueios, valido, "worker_invalido");
    if (valido) workers.push(worker as unknown as WorkerDistribuido);
  }

  const jobsBrutos = Array.isArray(entrada.jobs) ? entrada.jobs : [];
  exigir(bloqueios, jobsBrutos.length > 0, "jobs_ausentes");
  exigir(bloqueios, idsUnicos(jobsBrutos.map((item) => objeto(item) ? item.jobId : undefined)), "job_ids_invalidos_ou_duplicados");
  const jobs: JobDistribuido[] = [];
  for (const job of jobsBrutos) {
    const budgets = objeto(job) ? job.budgets : undefined;
    const retry = objeto(job) ? job.retry : undefined;
    const valido = objeto(job)
      && id(job.jobId)
      && ["COOK", "SHADERS", "RENDER", "TEST"].includes(String(job.type))
      && digestSha256Valido(job.inputDigest)
      && listaUnica(job.dependsOn, id, true)
      && listaUnica(job.requiredCapabilities, id)
      && objeto(budgets)
      && positivo(budgets.ramMb)
      && inteiroNaoNegativo(budgets.vramMb)
      && positivo(budgets.diskMb)
      && positivo(budgets.runtimeSeconds)
      && id(job.idempotencyKey)
      && positivo(job.checkpointIntervalSeconds)
      && objeto(retry)
      && inteiroNaoNegativo(retry.maxAttempts)
      && positivo(retry.backoffSeconds)
      && listaUnica(job.resourceLockIds, id, true)
      && listaUnica(job.requiredEvidence, texto)
      && EVIDENCIAS_JOB.every((item) => (job.requiredEvidence as readonly string[]).includes(item));
    exigir(bloqueios, valido, "job_invalido_sem_budget_checkpoint_idempotency_ou_evidencia");
    if (valido) jobs.push(job as unknown as JobDistribuido);
  }
  exigir(bloqueios, new Set(jobs.map((job) => job.idempotencyKey)).size === jobs.length, "job_idempotency_key_duplicada");

  const dag = ordemTopologica(jobs);
  exigir(bloqueios, !dag.referenciasInvalidas, "job_dependency_invalida");
  exigir(bloqueios, !dag.ciclo, "job_dependency_cycle");
  const porId = new Map(jobs.map((job) => [job.jobId, job] as const));

  for (const job of jobs) {
    const candidatos = workers.filter((worker) => (
      job.requiredCapabilities.every((capability) => worker.capabilities.includes(capability))
      && worker.ramMb >= job.budgets.ramMb
      && worker.vramMb >= job.budgets.vramMb
      && worker.diskMb >= job.budgets.diskMb
    )).sort((a, b) => a.workerId.localeCompare(b.workerId));
    if (candidatos.length === 0) gaps.push(job.jobId);
    else assignments.push({ jobId: job.jobId, workerId: candidatos[0]!.workerId });
  }

  const leasesBrutos = Array.isArray(entrada.leases) ? entrada.leases : [];
  exigir(bloqueios, idsUnicos(leasesBrutos.map((item) => objeto(item) ? item.lockId : undefined)), "lease_ids_invalidos_ou_duplicados");
  const leases: LeaseRecursoDistribuido[] = [];
  for (const lease of leasesBrutos) {
    const valido = objeto(lease)
      && id(lease.lockId)
      && id(lease.resourceId)
      && ["GPU", "EDITOR", "CACHE"].includes(String(lease.resourceType))
      && id(lease.ownerJobId)
      && porId.has(lease.ownerJobId)
      && typeof lease.exclusive === "boolean"
      && positivo(lease.ttlSeconds)
      && positivo(lease.heartbeatSeconds)
      && (lease.heartbeatSeconds as number) < (lease.ttlSeconds as number)
      && digestSha256Valido(lease.checkpointDigest);
    exigir(bloqueios, valido, "lease_invalido_sem_ttl_heartbeat_ou_checkpoint");
    if (valido) leases.push(lease as unknown as LeaseRecursoDistribuido);
  }
  const leasesPorId = new Map(leases.map((lease) => [lease.lockId, lease] as const));
  for (const job of jobs) {
    const leasesDoJob = job.resourceLockIds.map((lockId) => leasesPorId.get(lockId));
    exigir(bloqueios, leasesDoJob.every((lease) => lease?.ownerJobId === job.jobId
      && lease.checkpointDigest === job.inputDigest), "job_lock_ausente_owner_ou_checkpoint_divergente");
    const exigeGpu = job.type === "RENDER" || job.type === "SHADERS" || job.budgets.vramMb > 0;
    exigir(bloqueios, !exigeGpu || leasesDoJob.some((lease) => lease?.resourceType === "GPU"), "job_gpu_lease_ausente");
  }
  for (let i = 0; i < leases.length; i += 1) for (let j = i + 1; j < leases.length; j += 1) {
    const a = leases[i]!;
    const b = leases[j]!;
    if (a.resourceId !== b.resourceId || (!a.exclusive && !b.exclusive) || a.ownerJobId === b.ownerJobId) continue;
    const ordenados = dependeDe(a.ownerJobId, b.ownerJobId, porId) || dependeDe(b.ownerJobId, a.ownerJobId, porId);
    if (!ordenados) conflicts.push(`${a.ownerJobId}|${b.ownerJobId}|${a.resourceId}`);
  }

  exigir(bloqueios, listaUnica(entrada.evidenceRequirements, texto)
    && EVIDENCIAS_JOB.every((item) => (entrada.evidenceRequirements as readonly string[]).includes(item)), "evidence_requirements_incompletos");
  const planDigest = digestSeguro(entrada, bloqueios, "plano_nao_canonicalizavel");
  const gapsUnicos = entradaSensivel ? [] : [...new Set(gaps)].sort();
  const conflitosUnicos = entradaSensivel ? [] : [...new Set(conflicts)].sort();
  const bloqueiosUnicos = [...new Set(bloqueios)].sort();
  const valido = bloqueiosUnicos.length === 0 && gapsUnicos.length === 0 && conflitosUnicos.length === 0;
  return {
    valido,
    planDigest,
    topologicalOrder: valido ? dag.ordem : [],
    assignments: valido ? assignments.sort((a, b) => a.jobId.localeCompare(b.jobId)) : [],
    capabilityGaps: gapsUnicos,
    lockConflicts: conflitosUnicos,
    nextActions: bloqueiosUnicos.length > 0
      ? ["corrigir_plano_workers"]
      : gapsUnicos.length > 0
        ? gapsUnicos.map((jobId) => `provisionar_worker_compativel:${jobId}`)
        : conflitosUnicos.length > 0
          ? conflitosUnicos.map((conflictId) => `serializar_jobs_com_lock_conflitante:${conflictId}`)
          : ["entregar_DAG_ao_orquestrador_externo"],
    completed: false,
    authoritative: false,
    executed: false,
    bloqueios: bloqueiosUnicos,
  };
}
