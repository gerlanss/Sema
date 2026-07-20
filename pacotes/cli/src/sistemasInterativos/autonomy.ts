// SEMA-GOVERNED: sema.produto.sistemas_interativos.autonomia + sema.produto.sistemas_interativos.testes_autonomos
// Descricao: validadores locais para reparo autonomo elegivel, playtest/fuzz bounded e autoridade multiplayer.

import { digestJsonSistemaInterativo, digestSha256Valido } from "./canonical.js";
import { validarAcceptanceLock, type AcceptanceLockV1 } from "./operations.js";

export const SCHEMA_AUTONOMIA = "sema.interactive.autonomy/v1" as const;
export const SCHEMA_PLAYTEST_FUZZ = "sema.interactive.playtest-fuzz/v1" as const;
export const SCHEMA_AUTORIDADE_MULTIPLAYER = "sema.interactive.multiplayer-authority/v1" as const;

export type ModoAutonomia = "OBSERVE_ONLY" | "SUGGEST" | "SAFE_APPLY_EXTERNAL";
export type ClasseRiscoPatch = "OBSERVATION_ONLY" | "SAFE_REVERSIBLE" | "PRIVILEGED" | "IRREVERSIBLE";
export type DecisaoProvaAutonomia = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface PoliticaAutonomia {
  readonly mode: ModoAutonomia;
  readonly maxCycles: number;
  readonly stopCriteria: readonly string[];
  readonly allowedRiskClasses: readonly ClasseRiscoPatch[];
  readonly requireHumanApprovalFor: readonly ClasseRiscoPatch[];
}

export interface DiagnosticoAutonomia {
  readonly diagnosticId: string;
  readonly failedInvariant: string;
  readonly phase: string;
  readonly evidenceIds: readonly string[];
  readonly semanticTargetId: string;
}

export interface PropostaPatchAutonomia {
  readonly patchId: string;
  readonly diagnosticId: string;
  readonly semanticTargetId: string;
  readonly ownerJobId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly operation: string;
  readonly riskClass: ClasseRiscoPatch;
  readonly mutates: boolean;
  readonly humanApproved: boolean;
  readonly inputDigest: string;
  readonly mutationScope: {
    readonly artifactDigest: string;
    readonly sceneId: string;
    readonly timeRange: FaixaTempoAcceptanceAutonomia;
  };
  readonly snapshotDigest?: string;
  readonly checkpointDigest?: string;
  readonly rollbackPlanDigest?: string;
  readonly resourceLockIds: readonly string[];
}

export interface SimulacaoPatchAutonomia {
  readonly simulationId: string;
  readonly patchId: string;
  readonly sandboxDigest: string;
  readonly resultDigest: string;
  readonly passed: boolean;
  readonly evidenceDigests: readonly string[];
}

export interface ProvaPatchAutonomia {
  readonly proofId: string;
  readonly patchId: string;
  readonly simulationId: string;
  readonly verifierId: string;
  readonly independentOfProducer: boolean;
  readonly evidenceDigests: readonly string[];
  readonly decision: DecisaoProvaAutonomia;
}

export interface LockAutonomia {
  readonly lockId: string;
  readonly resourceType: "GPU" | "EDITOR" | "CACHE";
  readonly ownerRunId: string;
  readonly ownerJobId: string;
  readonly checkpointDigest: string;
}

export interface FaixaTempoAcceptanceAutonomia {
  readonly start: number;
  readonly end: number;
  readonly unit: "FRAME" | "TICK" | "SECOND";
}

export interface AcceptanceLockAutonomia {
  readonly lock: AcceptanceLockV1;
  readonly lockDigest: string;
  readonly invalidationEvidenceDigest?: string;
}

export interface AcceptanceClaimAutonomia {
  readonly claimId: string;
  readonly patchId: string;
  readonly artifactDigest: string;
  readonly sceneId: string;
  readonly timeRange: FaixaTempoAcceptanceAutonomia;
  readonly acceptanceLocksDigest: string;
  readonly claimDigest: string;
}

export interface CicloReparoAutonomo {
  readonly schemaVersion: typeof SCHEMA_AUTONOMIA;
  readonly runId: string;
  readonly cycleIndex: number;
  readonly previousCycleDigest: "GENESIS" | string;
  readonly triggeredStopCriteria: readonly string[];
  readonly systemId: string;
  readonly definitionDigest: string;
  readonly policy: PoliticaAutonomia;
  readonly diagnostics: readonly DiagnosticoAutonomia[];
  readonly proposals: readonly PropostaPatchAutonomia[];
  readonly simulations: readonly SimulacaoPatchAutonomia[];
  readonly proofs: readonly ProvaPatchAutonomia[];
  readonly resourceLocks: readonly LockAutonomia[];
  readonly acceptanceLocks: readonly AcceptanceLockAutonomia[];
  readonly acceptanceLocksDigest: string;
  readonly acceptanceClaims: readonly AcceptanceClaimAutonomia[];
  readonly recoveryToken: string;
}

export interface ResultadoCicloReparoAutonomo {
  readonly valido: boolean;
  readonly cycleDigest: string;
  readonly eligibleSafePatches: readonly string[];
  readonly blockedPatches: readonly string[];
  readonly diagnostics: readonly {
    readonly failedInvariant: string;
    readonly phase: string;
    readonly evidenceIds: readonly string[];
    readonly likelyCauses: readonly string[];
    readonly nextActions: readonly string[];
  }[];
  readonly nextActions: readonly string[];
  readonly completed: false;
  readonly authoritative: false;
  readonly executed: false;
  readonly bloqueios: readonly string[];
}

export interface BotPlaytest {
  readonly botId: string;
  readonly strategy: "EXPLORER" | "GOAL" | "ADVERSARIAL" | "REGRESSION";
  readonly seed: number;
  readonly maxSteps: number;
  readonly permissions: readonly string[];
}

export interface AcaoInputFuzz {
  readonly actionId: string;
  readonly type: "BUTTON" | "AXIS" | "POINTER" | "TEXT";
  readonly minimum: number;
  readonly maximum: number;
}

export interface CheckpointPlaytest {
  readonly checkpointId: string;
  readonly phase: "BEFORE" | "AFTER";
  readonly stateDigest: string;
}

export interface CasoSaveLoad {
  readonly caseId: string;
  readonly type: "NORMAL" | "CORRUPT_RECOVERY" | "VERSION_MIGRATION";
  readonly sourceCheckpointId: string;
  readonly targetCheckpointId: string;
  readonly sandboxOnly: boolean;
  readonly originalImmutable: boolean;
}

export interface PlanoPlaytestFuzz {
  readonly schemaVersion: typeof SCHEMA_PLAYTEST_FUZZ;
  readonly planId: string;
  readonly systemId: string;
  readonly definitionDigest: string;
  readonly bots: readonly BotPlaytest[];
  readonly inputActions: readonly AcaoInputFuzz[];
  readonly stateCheckpoints: readonly CheckpointPlaytest[];
  readonly saveLoadCases: readonly CasoSaveLoad[];
  readonly fuzzBounds: {
    readonly maxSteps: number;
    readonly maxRuntimeSeconds: number;
    readonly maxMemoryMb: number;
    readonly maxDiskMb: number;
    readonly maxCases: number;
  };
  readonly stopCriteria: readonly ("CRASH" | "HANG" | "RESOURCE_EXHAUSTION" | "INVARIANT_FAILURE")[];
  readonly evidenceRequirements: readonly string[];
}

export interface ResultadoPlanoPlaytestFuzz {
  readonly valido: boolean;
  readonly planDigest: string;
  readonly scenarioIds: readonly string[];
  readonly nextActions: readonly string[];
  readonly authoritative: false;
  readonly executed: false;
  readonly bloqueios: readonly string[];
}

export interface AutoridadeMultiplayer {
  readonly authorityId: string;
  readonly role: "SERVER" | "CLIENT" | "PEER";
  readonly principalId: string;
}

export interface EstadoReplicadoMultiplayer {
  readonly stateId: string;
  readonly semanticTargetId: string;
  readonly sensitive: boolean;
  readonly ownerAuthorityId: string;
  readonly writerAuthorityIds: readonly string[];
  readonly readerAuthorityIds: readonly string[];
  readonly frequencyHz: number;
  readonly conflictPolicy: "SERVER_WINS" | "SEQUENCE" | "CRDT" | "LOCKSTEP" | "CONSENSUS";
  readonly clientInputValidated: boolean;
}

export interface ModeloAutoridadeMultiplayer {
  readonly schemaVersion: typeof SCHEMA_AUTORIDADE_MULTIPLAYER;
  readonly modelId: string;
  readonly systemId: string;
  readonly topology: "SERVER_AUTHORITATIVE" | "CLIENT_AUTHORITATIVE" | "PEER_TO_PEER" | "HYBRID";
  readonly authorities: readonly AutoridadeMultiplayer[];
  readonly replicatedState: readonly EstadoReplicadoMultiplayer[];
  readonly conflicts: readonly { readonly conflictId: string; readonly stateId: string; readonly resolution: string }[];
  readonly reconnect: {
    readonly disconnectDetected: boolean;
    readonly reconnectAllowed: boolean;
    readonly resyncSnapshot: boolean;
    readonly replaySinceSequence: boolean;
    readonly timeoutMs: number;
  };
  readonly securityInvariants: readonly string[];
  readonly evidenceRequirements: readonly string[];
}

export interface ResultadoModeloAutoridadeMultiplayer {
  readonly valido: boolean;
  readonly modelDigest: string;
  readonly authorityGaps: readonly string[];
  readonly nextActions: readonly string[];
  readonly authoritative: false;
  readonly executed: false;
  readonly bloqueios: readonly string[];
}

type Registro = Record<string, unknown>;
const ID = /^[a-z0-9][a-z0-9._:/-]{0,127}$/;
const VERSAO = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-z0-9.-]+)?$/i;
const TOKEN_RECOVERY = /^sha256:[a-f0-9]{64}$/;
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
const RISCOS = new Set<ClasseRiscoPatch>(["OBSERVATION_ONLY", "SAFE_REVERSIBLE", "PRIVILEGED", "IRREVERSIBLE"]);
const MODOS = new Set<ModoAutonomia>(["OBSERVE_ONLY", "SUGGEST", "SAFE_APPLY_EXTERNAL"]);
const DECISOES = new Set<DecisaoProvaAutonomia>(["PASS", "FAIL", "INCONCLUSIVE"]);

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

function inteiroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0;
}

function faixaTempoAcceptanceValida(valor: unknown): valor is FaixaTempoAcceptanceAutonomia {
  return objeto(valor)
    && somenteChaves(valor, ["start", "end", "unit"])
    && typeof valor.start === "number"
    && Number.isFinite(valor.start)
    && valor.start >= 0
    && typeof valor.end === "number"
    && Number.isFinite(valor.end)
    && valor.end > valor.start
    && ["FRAME", "TICK", "SECOND"].includes(String(valor.unit));
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
    return Object.entries(valor).some(([chave, item]) => {
      if (chave === "recoveryToken" && digestSha256Valido(item)) return false;
      return CHAVE_SENSIVEL.test(chave) || contemSensivel(item, visitados);
    });
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

function causaPorInvariante(invariante: string): string[] {
  if (invariante.includes("camera")) return ["camera_target_or_shot_contract_diverged"];
  if (invariante.includes("physics") || invariante.includes("collision")) return ["physics_relation_diverged"];
  if (invariante.includes("audio") || invariante.includes("speech")) return ["timeline_audio_sync_diverged"];
  if (invariante.includes("save")) return ["state_persistence_diverged"];
  return ["observed_state_diverged_from_contract"];
}

export function tokenRecuperacaoEsperado(
  ciclo: Pick<CicloReparoAutonomo, "runId" | "cycleIndex" | "previousCycleDigest" | "proposals">,
): string {
  return digestJsonSistemaInterativo({
    runId: ciclo.runId,
    cycleIndex: ciclo.cycleIndex,
    previousCycleDigest: ciclo.previousCycleDigest,
    checkpoints: ciclo.proposals.filter((item) => item.mutates).map((item) => item.checkpointDigest).sort(),
  });
}

export function digestAcceptanceLocksAutonomia(locks: readonly AcceptanceLockAutonomia[]): string {
  return digestJsonSistemaInterativo([...locks].map((item) => ({
    lock: {
      ...item.lock,
      timeRange: { ...item.lock.timeRange },
      approver: { ...item.lock.approver },
      ...(item.lock.invalidation === undefined ? {} : { invalidation: { ...item.lock.invalidation } }),
    },
    lockDigest: item.lockDigest,
    ...(item.invalidationEvidenceDigest === undefined ? {} : { invalidationEvidenceDigest: item.invalidationEvidenceDigest }),
  })).sort((a, b) => a.lock.lockId.localeCompare(b.lock.lockId)));
}

export function digestAcceptanceClaimAutonomia(
  claim: Omit<AcceptanceClaimAutonomia, "claimDigest">,
): string {
  return digestJsonSistemaInterativo({ ...claim, timeRange: { ...claim.timeRange } });
}

export function validarCicloReparoAutonomo(entrada: unknown): ResultadoCicloReparoAutonomo {
  const bloqueios: string[] = [];
  const elegiveis: string[] = [];
  const bloqueados: string[] = [];
  const diagnosticosSaida: ResultadoCicloReparoAutonomo["diagnostics"][number][] = [];
  if (!objeto(entrada)) {
    return {
      valido: false, cycleDigest: "sha256:invalid", eligibleSafePatches: [], blockedPatches: [], diagnostics: [],
      nextActions: ["corrigir_ciclo_autonomia"], completed: false, authoritative: false, executed: false, bloqueios: ["ciclo_invalido"],
    };
  }
  const entradaSensivel = contemSensivel(entrada);
  if (entradaSensivel) bloqueios.push("ciclo_contem_dado_sensivel");
  exigir(bloqueios, somenteChaves(entrada, [
    "schemaVersion", "runId", "cycleIndex", "previousCycleDigest", "triggeredStopCriteria", "systemId",
    "definitionDigest", "policy", "diagnostics", "proposals", "simulations", "proofs", "resourceLocks",
    "acceptanceLocks", "acceptanceLocksDigest", "acceptanceClaims", "recoveryToken",
  ]), "campos_top_level_desconhecidos");
  exigir(bloqueios, entrada.schemaVersion === SCHEMA_AUTONOMIA, "schema_version_nao_suportada");
  exigir(bloqueios, id(entrada.runId), "run_id_invalido");
  const cycleIndexValido = inteiroPositivo(entrada.cycleIndex);
  const cycleIndex = cycleIndexValido ? entrada.cycleIndex as number : 0;
  exigir(bloqueios, cycleIndexValido, "cycle_index_invalido");
  const previousCycleDigestValido = cycleIndexValido && (cycleIndex === 1
    ? entrada.previousCycleDigest === "GENESIS"
    : digestSha256Valido(entrada.previousCycleDigest));
  exigir(bloqueios, previousCycleDigestValido, "previous_cycle_digest_invalido");
  exigir(bloqueios, id(entrada.systemId), "system_id_invalido");
  exigir(bloqueios, digestSha256Valido(entrada.definitionDigest), "definition_digest_invalido");

  const policy = entrada.policy;
  const policyValida = objeto(policy)
    && MODOS.has(policy.mode as ModoAutonomia)
    && Number.isInteger(policy.maxCycles)
    && (policy.maxCycles as number) > 0
    && listaUnica(policy.stopCriteria, texto)
    && listaUnica(policy.allowedRiskClasses, (item): item is ClasseRiscoPatch => RISCOS.has(item as ClasseRiscoPatch))
    && listaUnica(policy.requireHumanApprovalFor, (item): item is ClasseRiscoPatch => RISCOS.has(item as ClasseRiscoPatch), true)
    && (policy.requireHumanApprovalFor as readonly ClasseRiscoPatch[]).includes("PRIVILEGED")
    && (policy.requireHumanApprovalFor as readonly ClasseRiscoPatch[]).includes("IRREVERSIBLE");
  exigir(bloqueios, policyValida, "policy_invalida");
  const policyTipada = policyValida ? policy as unknown as PoliticaAutonomia : undefined;
  const cycleDentroDoLimite = Boolean(policyTipada && cycleIndexValido && cycleIndex <= policyTipada.maxCycles);
  exigir(bloqueios, cycleDentroDoLimite, "cycle_index_excede_max_cycles");
  const triggeredStopCriteriaValidos = listaUnica(entrada.triggeredStopCriteria, texto, true)
    && policyTipada !== undefined
    && (entrada.triggeredStopCriteria as readonly string[]).every((criterion) => policyTipada.stopCriteria.includes(criterion));
  exigir(bloqueios, triggeredStopCriteriaValidos, "triggered_stop_criteria_invalidos");
  const stopCriteriaAcionado = triggeredStopCriteriaValidos && (entrada.triggeredStopCriteria as readonly string[]).length > 0;
  if (stopCriteriaAcionado) bloqueios.push("stop_criteria_ja_acionado");
  const cicloPodeProsseguir = cycleDentroDoLimite && previousCycleDigestValido && !stopCriteriaAcionado;

  const diagnostics = Array.isArray(entrada.diagnostics) ? entrada.diagnostics : [];
  exigir(bloqueios, diagnostics.length > 0, "diagnostics_ausentes");
  exigir(bloqueios, idsUnicos(diagnostics.map((item) => objeto(item) ? item.diagnosticId : undefined)), "diagnostic_ids_invalidos_ou_duplicados");
  const diagnosticIds = new Set<string>();
  const diagnosticTargets = new Map<string, string>();
  for (const item of diagnostics) {
    const valido = objeto(item)
      && id(item.diagnosticId)
      && id(item.failedInvariant)
      && id(item.phase)
      && listaUnica(item.evidenceIds, id)
      && id(item.semanticTargetId);
    exigir(bloqueios, valido, "diagnostic_invalido");
    if (valido) {
      const tipado = item as unknown as DiagnosticoAutonomia;
      diagnosticIds.add(tipado.diagnosticId);
      diagnosticTargets.set(tipado.diagnosticId, tipado.semanticTargetId);
      diagnosticosSaida.push({
        failedInvariant: tipado.failedInvariant,
        phase: tipado.phase,
        evidenceIds: tipado.evidenceIds,
        likelyCauses: causaPorInvariante(tipado.failedInvariant),
        nextActions: [`propor_patch_sem_apply:${tipado.diagnosticId}`],
      });
    }
  }

  const locks = Array.isArray(entrada.resourceLocks) ? entrada.resourceLocks : [];
  exigir(bloqueios, idsUnicos(locks.map((item) => objeto(item) ? item.lockId : undefined)), "lock_ids_invalidos_ou_duplicados");
  const locksPorId = new Map<string, LockAutonomia>();
  for (const lock of locks) {
    const baseValido = objeto(lock)
      && id(lock.lockId)
      && ["GPU", "EDITOR", "CACHE"].includes(String(lock.resourceType))
      && id(lock.ownerRunId)
      && id(lock.ownerJobId)
      && digestSha256Valido(lock.checkpointDigest);
    exigir(bloqueios, baseValido, "resource_lock_invalido");
    if (!baseValido) continue;
    const tipado = lock as unknown as LockAutonomia;
    if (tipado.ownerRunId !== entrada.runId) {
      bloqueios.push("resource_lock_owner_run_divergente");
      continue;
    }
    locksPorId.set(tipado.lockId, tipado);
  }

  const proposals = Array.isArray(entrada.proposals) ? entrada.proposals : [];
  exigir(bloqueios, proposals.length > 0, "proposals_ausentes");
  exigir(bloqueios, idsUnicos(proposals.map((item) => objeto(item) ? item.patchId : undefined)), "patch_ids_invalidos_ou_duplicados");
  const propostasValidas = new Map<string, PropostaPatchAutonomia>();
  const patchesReversiveis = new Set<string>();
  const diagnosticsCobertos = new Set<string>();
  for (const proposal of proposals) {
    const baseValida = objeto(proposal)
      && id(proposal.patchId)
      && id(proposal.diagnosticId)
      && diagnosticIds.has(proposal.diagnosticId)
      && id(proposal.semanticTargetId)
      && id(proposal.ownerJobId)
      && id(proposal.adapterId)
      && typeof proposal.adapterVersion === "string"
      && VERSAO.test(proposal.adapterVersion)
      && texto(proposal.operation)
      && RISCOS.has(proposal.riskClass as ClasseRiscoPatch)
      && typeof proposal.mutates === "boolean"
      && typeof proposal.humanApproved === "boolean"
      && digestSha256Valido(proposal.inputDigest)
      && objeto(proposal.mutationScope)
      && somenteChaves(proposal.mutationScope, ["artifactDigest", "sceneId", "timeRange"])
      && digestSha256Valido(proposal.mutationScope.artifactDigest)
      && id(proposal.mutationScope.sceneId)
      && faixaTempoAcceptanceValida(proposal.mutationScope.timeRange)
      && Array.isArray(proposal.resourceLockIds)
      && proposal.resourceLockIds.every(id)
      && new Set(proposal.resourceLockIds).size === proposal.resourceLockIds.length;
    exigir(bloqueios, baseValida, "proposal_invalida");
    if (!baseValida) continue;
    const tipada = proposal as unknown as PropostaPatchAutonomia;
    if (diagnosticTargets.get(tipada.diagnosticId) !== tipada.semanticTargetId) {
      bloqueios.push("proposal_target_diverge_diagnostico");
      continue;
    }
    if (tipada.inputDigest !== entrada.definitionDigest) {
      bloqueios.push("proposal_input_digest_diverge_definition");
      continue;
    }
    diagnosticsCobertos.add(tipada.diagnosticId);
    propostasValidas.set(tipada.patchId, tipada);
    const locksCoerentes = tipada.resourceLockIds.length > 0
      && tipada.resourceLockIds.every((lockId) => {
        const lock = locksPorId.get(lockId);
        if (!lock) return false;
        return lock.ownerRunId === entrada.runId
          && lock.ownerJobId === tipada.ownerJobId
          && lock.checkpointDigest === tipada.checkpointDigest
          && lock.checkpointDigest === tipada.snapshotDigest;
      });
    if (tipada.mutates && !locksCoerentes) bloqueios.push("resource_lock_owner_ou_checkpoint_divergente");
    const reversivel = !tipada.mutates || (
      digestSha256Valido(tipada.snapshotDigest)
      && digestSha256Valido(tipada.checkpointDigest)
      && digestSha256Valido(tipada.rollbackPlanDigest)
      && locksCoerentes
    );
    exigir(bloqueios, reversivel, "patch_mutante_sem_snapshot_checkpoint_rollback_ou_lock");
    if (reversivel) patchesReversiveis.add(tipada.patchId);
    if (tipada.riskClass === "OBSERVATION_ONLY" && tipada.mutates) bloqueios.push("observation_only_nao_pode_mutar");
    if (tipada.riskClass === "PRIVILEGED" || tipada.riskClass === "IRREVERSIBLE") {
      if (!tipada.humanApproved) bloqueios.push("patch_risco_alto_sem_aprovacao_humana");
      bloqueados.push(tipada.patchId);
    }
  }
  for (const diagnosticId of diagnosticTargets.keys()) {
    if (!diagnosticsCobertos.has(diagnosticId)) bloqueios.push("diagnostic_sem_proposal_valida");
  }

  const acceptanceLocksBrutos = Array.isArray(entrada.acceptanceLocks) ? entrada.acceptanceLocks : [];
  exigir(bloqueios, idsUnicos(acceptanceLocksBrutos.map((item) => objeto(item) && objeto(item.lock) ? item.lock.lockId : undefined)), "acceptance_lock_ids_invalidos_ou_duplicados");
  const acceptanceLocks: AcceptanceLockAutonomia[] = [];
  for (const item of acceptanceLocksBrutos) {
    const lockResult = objeto(item) ? validarAcceptanceLock(item.lock) : undefined;
    let valido = objeto(item)
      && somenteChaves(item, ["lock", "lockDigest", "invalidationEvidenceDigest"])
      && Boolean(lockResult?.valid && lockResult.value)
      && digestSha256Valido(item.lockDigest)
      && item.lockDigest === lockResult?.value?.lockDigest;
    if (valido && lockResult?.value) {
      const lock = lockResult.value.lock;
      if (lock.status === "ACTIVE") valido = item.invalidationEvidenceDigest === undefined;
      else {
        const { invalidation: _invalidation, ...base } = lock;
        const previousResult = validarAcceptanceLock({ ...base, status: "ACTIVE" });
        valido = digestSha256Valido(item.invalidationEvidenceDigest)
          && Boolean(previousResult.value
            && lock.invalidation?.previousLockDigest === previousResult.value.lockDigest
            && Date.parse(lock.invalidation.invalidatedAt) >= Date.parse(lock.createdAt));
      }
    }
    exigir(bloqueios, valido, "acceptance_lock_invalido");
    if (valido && objeto(item) && lockResult?.value) acceptanceLocks.push({
      lock: lockResult.value.lock,
      lockDigest: lockResult.value.lockDigest,
      ...(item.invalidationEvidenceDigest === undefined ? {} : { invalidationEvidenceDigest: item.invalidationEvidenceDigest as string }),
    });
  }
  const acceptanceLocksDigestValido = digestSha256Valido(entrada.acceptanceLocksDigest)
    && entrada.acceptanceLocksDigest === digestAcceptanceLocksAutonomia(acceptanceLocks);
  exigir(bloqueios, acceptanceLocksDigestValido, "acceptance_locks_digest_divergente");

  const acceptanceClaimsBrutos = Array.isArray(entrada.acceptanceClaims) ? entrada.acceptanceClaims : [];
  exigir(bloqueios, idsUnicos(acceptanceClaimsBrutos.map((item) => objeto(item) ? item.claimId : undefined)), "acceptance_claim_ids_invalidos_ou_duplicados");
  const claimsPorPatch = new Map<string, AcceptanceClaimAutonomia>();
  for (const claim of acceptanceClaimsBrutos) {
    const baseValida = objeto(claim)
      && somenteChaves(claim, ["claimId", "patchId", "artifactDigest", "sceneId", "timeRange", "acceptanceLocksDigest", "claimDigest"])
      && id(claim.claimId)
      && id(claim.patchId)
      && propostasValidas.has(claim.patchId)
      && digestSha256Valido(claim.artifactDigest)
      && id(claim.sceneId)
      && faixaTempoAcceptanceValida(claim.timeRange)
      && digestSha256Valido(claim.acceptanceLocksDigest)
      && claim.acceptanceLocksDigest === entrada.acceptanceLocksDigest
      && digestSha256Valido(claim.claimDigest);
    let valida = baseValida;
    if (baseValida) {
      const tipada = claim as unknown as AcceptanceClaimAutonomia;
      valida = tipada.claimDigest === digestAcceptanceClaimAutonomia({
        claimId: tipada.claimId,
        patchId: tipada.patchId,
        artifactDigest: tipada.artifactDigest,
        sceneId: tipada.sceneId,
        timeRange: tipada.timeRange,
        acceptanceLocksDigest: tipada.acceptanceLocksDigest,
      }) && !claimsPorPatch.has(tipada.patchId)
        && tipada.artifactDigest === propostasValidas.get(tipada.patchId)?.mutationScope.artifactDigest
        && tipada.sceneId === propostasValidas.get(tipada.patchId)?.mutationScope.sceneId
        && tipada.timeRange.start === propostasValidas.get(tipada.patchId)?.mutationScope.timeRange.start
        && tipada.timeRange.end === propostasValidas.get(tipada.patchId)?.mutationScope.timeRange.end
        && tipada.timeRange.unit === propostasValidas.get(tipada.patchId)?.mutationScope.timeRange.unit;
      if (valida) claimsPorPatch.set(tipada.patchId, tipada);
    }
    exigir(bloqueios, valida, "acceptance_claim_invalido_ou_duplicado_por_patch");
  }
  const patchesLiberadosPorAcceptance = new Set<string>();
  for (const proposal of propostasValidas.values()) {
    const claim = claimsPorPatch.get(proposal.patchId);
    if (!claim || !acceptanceLocksDigestValido) {
      bloqueios.push("patch_sem_acceptance_claim_content_addressed");
      continue;
    }
    const locksMesmoBinding = acceptanceLocks.map((item) => item.lock).filter((lock) => lock.status === "ACTIVE"
      && lock.artifactDigest === claim.artifactDigest && lock.sceneId === claim.sceneId);
    const unidadeAmbigua = locksMesmoBinding.some((lock) => lock.timeRange.unit !== claim.timeRange.unit);
    const sobreposto = locksMesmoBinding.some((lock) => lock.timeRange.unit === claim.timeRange.unit
      && claim.timeRange.start < lock.timeRange.end && lock.timeRange.start < claim.timeRange.end);
    if (unidadeAmbigua || sobreposto) {
      bloqueios.push(unidadeAmbigua ? "acceptance_lock_time_unit_ambigua" : "patch_toca_acceptance_lock_ativo");
      bloqueados.push(proposal.patchId);
    } else patchesLiberadosPorAcceptance.add(proposal.patchId);
  }

  const simulations = Array.isArray(entrada.simulations) ? entrada.simulations : [];
  exigir(bloqueios, idsUnicos(simulations.map((item) => objeto(item) ? item.simulationId : undefined)), "simulation_ids_invalidos_ou_duplicados");
  const simulacoes = new Map<string, SimulacaoPatchAutonomia>();
  for (const simulation of simulations) {
    const valido = objeto(simulation)
      && id(simulation.simulationId)
      && id(simulation.patchId)
      && propostasValidas.has(simulation.patchId)
      && digestSha256Valido(simulation.sandboxDigest)
      && digestSha256Valido(simulation.resultDigest)
      && typeof simulation.passed === "boolean"
      && Array.isArray(simulation.evidenceDigests)
      && simulation.evidenceDigests.length > 0
      && simulation.evidenceDigests.every(digestSha256Valido);
    exigir(bloqueios, valido, "simulation_invalida");
    if (valido) {
      const tipada = simulation as unknown as SimulacaoPatchAutonomia;
      simulacoes.set(tipada.simulationId, tipada);
    }
  }

  const proofs = Array.isArray(entrada.proofs) ? entrada.proofs : [];
  exigir(bloqueios, idsUnicos(proofs.map((item) => objeto(item) ? item.proofId : undefined)), "proof_ids_invalidos_ou_duplicados");
  const provasPorPatch = new Map<string, ProvaPatchAutonomia>();
  for (const proof of proofs) {
    const simulacao = objeto(proof) && id(proof.simulationId) ? simulacoes.get(proof.simulationId) : undefined;
    const proposta = objeto(proof) && id(proof.patchId) ? propostasValidas.get(proof.patchId) : undefined;
    const valido = objeto(proof)
      && id(proof.proofId)
      && id(proof.patchId)
      && propostasValidas.has(proof.patchId)
      && Boolean(simulacao && simulacao.patchId === proof.patchId)
      && id(proof.verifierId)
      && Boolean(proposta && proof.verifierId !== proposta.adapterId)
      && proof.independentOfProducer === true
      && Array.isArray(proof.evidenceDigests)
      && proof.evidenceDigests.length > 0
      && proof.evidenceDigests.every(digestSha256Valido)
      && DECISOES.has(proof.decision as DecisaoProvaAutonomia);
    exigir(bloqueios, valido, "proof_invalida");
    if (valido) {
      const tipada = proof as unknown as ProvaPatchAutonomia;
      provasPorPatch.set(tipada.patchId, tipada);
    }
  }

  for (const proposal of propostasValidas.values()) {
    if (!proposal.mutates) continue;
    const simulacao = [...simulacoes.values()].find((item) => item.patchId === proposal.patchId);
    if (!simulacao) bloqueios.push("patch_mutante_sem_simulation");
    if (!provasPorPatch.has(proposal.patchId)) bloqueios.push("patch_mutante_sem_proof_independente");
  }

  if (policyValida) {
    for (const proposal of propostasValidas.values()) {
      const simulacao = [...simulacoes.values()].find((item) => item.patchId === proposal.patchId);
      const proof = provasPorPatch.get(proposal.patchId);
      const seguro = proposal.riskClass === "SAFE_REVERSIBLE"
        && proposal.mutates
        && policy.mode === "SAFE_APPLY_EXTERNAL"
        && cicloPodeProsseguir
        && (policy.allowedRiskClasses as readonly ClasseRiscoPatch[]).includes("SAFE_REVERSIBLE")
        && patchesReversiveis.has(proposal.patchId)
        && patchesLiberadosPorAcceptance.has(proposal.patchId)
        && Boolean(simulacao?.passed)
        && proof?.decision === "PASS";
      if (seguro) elegiveis.push(proposal.patchId);
      else if (proposal.riskClass !== "OBSERVATION_ONLY" && !bloqueados.includes(proposal.patchId)) bloqueados.push(proposal.patchId);
    }
  }

  exigir(bloqueios, TOKEN_RECOVERY.test(String(entrada.recoveryToken)), "recovery_token_invalido");
  if (id(entrada.runId) && proposals.every(objeto)) {
    try {
      exigir(bloqueios, entrada.recoveryToken === tokenRecuperacaoEsperado(entrada as unknown as CicloReparoAutonomo), "recovery_token_checkpoint_divergente");
    } catch {
      bloqueios.push("recovery_token_nao_derivavel");
    }
  }

  const cycleDigest = digestSeguro(entrada, bloqueios, "ciclo_nao_canonicalizavel");
  const bloqueiosUnicos = [...new Set(bloqueios)].sort();
  const valido = bloqueiosUnicos.length === 0;
  const elegiveisFinais = valido ? [...new Set(elegiveis)].sort() : [];
  const bloqueadosFinais = entradaSensivel ? [] : [...new Set(bloqueados)].sort();
  const nextActions = valido
    ? [...bloqueadosFinais.map((patchId) => `revisar_ou_rejeitar_patch:${patchId}`),
      ...elegiveisFinais.map((patchId) => `entregar_patch_ao_runner_externo_autorizado:${patchId}`)]
    : ["corrigir_ciclo_autonomia"];
  if (nextActions.length === 0) nextActions.push("corrigir_ciclo_autonomia");
  return {
    valido,
    cycleDigest,
    eligibleSafePatches: elegiveisFinais,
    blockedPatches: bloqueadosFinais,
    diagnostics: entradaSensivel ? [] : diagnosticosSaida,
    nextActions,
    completed: false,
    authoritative: false,
    executed: false,
    bloqueios: bloqueiosUnicos,
  };
}

const STOP_FUZZ = ["CRASH", "HANG", "RESOURCE_EXHAUSTION", "INVARIANT_FAILURE"] as const;
const EVIDENCIAS_FUZZ = ["runtime.boot", "runtime.loop", "runtime.failure", "runtime.replay", "state.digest", "crash.trace"] as const;

export function validarPlanoPlaytestFuzz(entrada: unknown): ResultadoPlanoPlaytestFuzz {
  const bloqueios: string[] = [];
  const scenarioIds: string[] = [];
  if (!objeto(entrada)) {
    return { valido: false, planDigest: "sha256:invalid", scenarioIds: [], nextActions: ["corrigir_plano_playtest_fuzz"], authoritative: false, executed: false, bloqueios: ["plano_invalido"] };
  }
  if (contemSensivel(entrada)) bloqueios.push("plano_contem_dado_sensivel");
  exigir(bloqueios, somenteChaves(entrada, [
    "schemaVersion", "planId", "systemId", "definitionDigest", "bots", "inputActions", "stateCheckpoints",
    "saveLoadCases", "fuzzBounds", "stopCriteria", "evidenceRequirements",
  ]), "campos_top_level_desconhecidos");
  exigir(bloqueios, entrada.schemaVersion === SCHEMA_PLAYTEST_FUZZ, "schema_version_nao_suportada");
  exigir(bloqueios, id(entrada.planId), "plan_id_invalido");
  exigir(bloqueios, id(entrada.systemId), "system_id_invalido");
  exigir(bloqueios, digestSha256Valido(entrada.definitionDigest), "definition_digest_invalido");

  const actions = Array.isArray(entrada.inputActions) ? entrada.inputActions : [];
  exigir(bloqueios, idsUnicos(actions.map((item) => objeto(item) ? item.actionId : undefined)), "action_ids_invalidos_ou_duplicados");
  const actionIds = new Set<string>();
  for (const action of actions) {
    const valido = objeto(action)
      && id(action.actionId)
      && ["BUTTON", "AXIS", "POINTER", "TEXT"].includes(String(action.type))
      && typeof action.minimum === "number"
      && Number.isFinite(action.minimum)
      && typeof action.maximum === "number"
      && Number.isFinite(action.maximum)
      && action.minimum <= action.maximum;
    exigir(bloqueios, valido, "input_action_invalida");
    if (valido) actionIds.add((action as unknown as AcaoInputFuzz).actionId);
  }

  const bots = Array.isArray(entrada.bots) ? entrada.bots : [];
  exigir(bloqueios, bots.length > 0, "bots_ausentes");
  exigir(bloqueios, idsUnicos(bots.map((item) => objeto(item) ? item.botId : undefined)), "bot_ids_invalidos_ou_duplicados");
  const botsValidos: BotPlaytest[] = [];
  for (const bot of bots) {
    const valido = objeto(bot)
      && id(bot.botId)
      && ["EXPLORER", "GOAL", "ADVERSARIAL", "REGRESSION"].includes(String(bot.strategy))
      && inteiroNaoNegativo(bot.seed)
      && inteiroPositivo(bot.maxSteps)
      && listaUnica(bot.permissions, id)
      && (bot.permissions as readonly string[]).every((permission) => actionIds.has(permission));
    exigir(bloqueios, valido, "bot_invalido_ou_permissao_fora_da_allowlist");
    if (valido) botsValidos.push(bot as unknown as BotPlaytest);
  }

  const checkpoints = Array.isArray(entrada.stateCheckpoints) ? entrada.stateCheckpoints : [];
  exigir(bloqueios, idsUnicos(checkpoints.map((item) => objeto(item) ? item.checkpointId : undefined)), "checkpoint_ids_invalidos_ou_duplicados");
  const checkpointIds = new Set<string>();
  const checkpointPorId = new Map<string, CheckpointPlaytest>();
  for (const checkpoint of checkpoints) {
    const valido = objeto(checkpoint)
      && id(checkpoint.checkpointId)
      && ["BEFORE", "AFTER"].includes(String(checkpoint.phase))
      && digestSha256Valido(checkpoint.stateDigest);
    exigir(bloqueios, valido, "state_checkpoint_invalido");
    if (valido) {
      const tipado = checkpoint as unknown as CheckpointPlaytest;
      checkpointIds.add(tipado.checkpointId);
      checkpointPorId.set(tipado.checkpointId, tipado);
    }
  }

  const cases = Array.isArray(entrada.saveLoadCases) ? entrada.saveLoadCases : [];
  exigir(bloqueios, idsUnicos(cases.map((item) => objeto(item) ? item.caseId : undefined)), "save_load_case_ids_invalidos_ou_duplicados");
  const tiposCaso = new Set<string>();
  const casosValidos: CasoSaveLoad[] = [];
  for (const caso of cases) {
    const valido = objeto(caso)
      && id(caso.caseId)
      && ["NORMAL", "CORRUPT_RECOVERY", "VERSION_MIGRATION"].includes(String(caso.type))
      && id(caso.sourceCheckpointId)
      && checkpointIds.has(caso.sourceCheckpointId)
      && id(caso.targetCheckpointId)
      && checkpointIds.has(caso.targetCheckpointId)
      && caso.sourceCheckpointId !== caso.targetCheckpointId
      && checkpointPorId.get(caso.sourceCheckpointId)?.phase === "BEFORE"
      && checkpointPorId.get(caso.targetCheckpointId)?.phase === "AFTER"
      && caso.sandboxOnly === true
      && caso.originalImmutable === true;
    exigir(bloqueios, valido, "save_load_case_invalido_ou_nao_isolado");
    if (valido) {
      tiposCaso.add(String(caso.type));
      casosValidos.push(caso as unknown as CasoSaveLoad);
    }
  }
  for (const tipo of ["NORMAL", "CORRUPT_RECOVERY", "VERSION_MIGRATION"]) exigir(bloqueios, tiposCaso.has(tipo), `save_load_case_${tipo.toLowerCase()}_ausente`);

  const bounds = entrada.fuzzBounds;
  const boundsValidos = objeto(bounds)
    && inteiroPositivo(bounds.maxSteps)
    && positivo(bounds.maxRuntimeSeconds)
    && positivo(bounds.maxMemoryMb)
    && positivo(bounds.maxDiskMb)
    && inteiroPositivo(bounds.maxCases);
  exigir(bloqueios, boundsValidos, "fuzz_bounds_invalidos");
  const boundsTipados = boundsValidos ? bounds as unknown as PlanoPlaytestFuzz["fuzzBounds"] : undefined;
  if (boundsTipados) {
    exigir(bloqueios, botsValidos.every((bot) => bot.maxSteps <= boundsTipados.maxSteps), "bot_max_steps_excede_fuzz_bounds");
    exigir(bloqueios, botsValidos.length * casosValidos.length <= boundsTipados.maxCases, "scenario_count_excede_fuzz_bounds");
  }
  exigir(bloqueios, listaUnica(entrada.stopCriteria, (item): item is typeof STOP_FUZZ[number] => STOP_FUZZ.includes(item as typeof STOP_FUZZ[number]))
    && STOP_FUZZ.every((item) => (entrada.stopCriteria as readonly string[]).includes(item)), "stop_criteria_incompletos");
  exigir(bloqueios, listaUnica(entrada.evidenceRequirements, texto)
    && EVIDENCIAS_FUZZ.every((item) => (entrada.evidenceRequirements as readonly string[]).includes(item)), "evidence_requirements_incompletos");

  for (const bot of botsValidos) for (const caso of casosValidos) {
    scenarioIds.push(`${entrada.planId}:${bot.botId}:${caso.caseId}`);
  }
  const planDigest = digestSeguro(entrada, bloqueios, "plano_nao_canonicalizavel");
  const bloqueiosUnicos = [...new Set(bloqueios)].sort();
  return {
    valido: bloqueiosUnicos.length === 0,
    planDigest,
    scenarioIds: bloqueiosUnicos.length === 0 ? scenarioIds.sort() : [],
    nextActions: bloqueiosUnicos.length === 0 ? ["entregar_cenarios_ao_runner_sandbox_externo"] : ["corrigir_plano_playtest_fuzz"],
    authoritative: false,
    executed: false,
    bloqueios: bloqueiosUnicos,
  };
}

const SEGURANCA_MULTIPLAYER = ["IDENTITY", "AUTHORIZATION", "ANTI_REPLAY", "RATE_LIMIT", "INTEGRITY"] as const;
const EVIDENCIA_MULTIPLAYER = ["multiplayer.session", "multiplayer.sync", "multiplayer.conflict", "multiplayer.reconnect", "multiplayer.authority"] as const;

export function validarModeloAutoridadeMultiplayer(entrada: unknown): ResultadoModeloAutoridadeMultiplayer {
  const bloqueios: string[] = [];
  const gaps: string[] = [];
  if (!objeto(entrada)) {
    return { valido: false, modelDigest: "sha256:invalid", authorityGaps: [], nextActions: ["corrigir_modelo_autoridade"], authoritative: false, executed: false, bloqueios: ["modelo_invalido"] };
  }
  const entradaSensivel = contemSensivel(entrada);
  if (entradaSensivel) bloqueios.push("modelo_contem_dado_sensivel");
  exigir(bloqueios, somenteChaves(entrada, [
    "schemaVersion", "modelId", "systemId", "topology", "authorities", "replicatedState", "conflicts",
    "reconnect", "securityInvariants", "evidenceRequirements",
  ]), "campos_top_level_desconhecidos");
  exigir(bloqueios, entrada.schemaVersion === SCHEMA_AUTORIDADE_MULTIPLAYER, "schema_version_nao_suportada");
  exigir(bloqueios, id(entrada.modelId), "model_id_invalido");
  exigir(bloqueios, id(entrada.systemId), "system_id_invalido");
  exigir(bloqueios, ["SERVER_AUTHORITATIVE", "CLIENT_AUTHORITATIVE", "PEER_TO_PEER", "HYBRID"].includes(String(entrada.topology)), "topology_invalida");

  const authorities = Array.isArray(entrada.authorities) ? entrada.authorities : [];
  exigir(bloqueios, authorities.length > 0, "authorities_ausentes");
  exigir(bloqueios, idsUnicos(authorities.map((item) => objeto(item) ? item.authorityId : undefined)), "authority_ids_invalidos_ou_duplicados");
  const autoridadePorId = new Map<string, AutoridadeMultiplayer>();
  for (const authority of authorities) {
    const valido = objeto(authority)
      && id(authority.authorityId)
      && ["SERVER", "CLIENT", "PEER"].includes(String(authority.role))
      && id(authority.principalId);
    exigir(bloqueios, valido, "authority_invalida");
    if (valido) {
      const tipada = authority as unknown as AutoridadeMultiplayer;
      autoridadePorId.set(tipada.authorityId, tipada);
    }
  }
  const roles = [...autoridadePorId.values()].map((authority) => authority.role);
  const topology = String(entrada.topology);
  const topologyRolesCoerentes = topology === "SERVER_AUTHORITATIVE"
    ? roles.includes("SERVER")
    : topology === "CLIENT_AUTHORITATIVE"
      ? roles.includes("CLIENT")
      : topology === "PEER_TO_PEER"
        ? roles.filter((role) => role === "PEER").length >= 2
        : topology === "HYBRID"
          ? roles.includes("SERVER") && (roles.includes("CLIENT") || roles.includes("PEER"))
          : false;
  exigir(bloqueios, topologyRolesCoerentes, "topology_sem_authority_role_compativel");

  const states = Array.isArray(entrada.replicatedState) ? entrada.replicatedState : [];
  exigir(bloqueios, states.length > 0, "replicated_state_ausente");
  exigir(bloqueios, idsUnicos(states.map((item) => objeto(item) ? item.stateId : undefined)), "state_ids_invalidos_ou_duplicados");
  const stateIds = new Set<string>();
  for (const state of states) {
    const baseValida = objeto(state)
      && id(state.stateId)
      && id(state.semanticTargetId)
      && typeof state.sensitive === "boolean"
      && id(state.ownerAuthorityId)
      && listaUnica(state.writerAuthorityIds, id)
      && listaUnica(state.readerAuthorityIds, id)
      && positivo(state.frequencyHz)
      && ["SERVER_WINS", "SEQUENCE", "CRDT", "LOCKSTEP", "CONSENSUS"].includes(String(state.conflictPolicy))
      && typeof state.clientInputValidated === "boolean";
    exigir(bloqueios, baseValida, "replicated_state_invalido");
    if (!baseValida) continue;
    const tipado = state as unknown as EstadoReplicadoMultiplayer;
    stateIds.add(tipado.stateId);
    const owner = autoridadePorId.get(tipado.ownerAuthorityId);
    const expectedRole = topology === "SERVER_AUTHORITATIVE"
      ? "SERVER"
      : topology === "CLIENT_AUTHORITATIVE"
        ? "CLIENT"
        : topology === "PEER_TO_PEER"
          ? "PEER"
          : undefined;
    if (!owner
      || !tipado.writerAuthorityIds.every((item) => autoridadePorId.has(item))
      || !tipado.readerAuthorityIds.every((item) => autoridadePorId.has(item))) gaps.push(tipado.stateId);
    if (expectedRole && (owner?.role !== expectedRole
      || !tipado.writerAuthorityIds.every((item) => autoridadePorId.get(item)?.role === expectedRole))) gaps.push(tipado.stateId);
    if (tipado.sensitive && (owner?.role !== "SERVER" || tipado.clientInputValidated !== true)) gaps.push(tipado.stateId);
    if (tipado.sensitive && !tipado.writerAuthorityIds.every((item) => autoridadePorId.get(item)?.role === "SERVER")) gaps.push(tipado.stateId);
    if (tipado.writerAuthorityIds.length > 1 && !["SEQUENCE", "CRDT", "LOCKSTEP", "CONSENSUS"].includes(tipado.conflictPolicy)) gaps.push(tipado.stateId);
  }

  const conflicts = Array.isArray(entrada.conflicts) ? entrada.conflicts : [];
  exigir(bloqueios, idsUnicos(conflicts.map((item) => objeto(item) ? item.conflictId : undefined)), "conflict_ids_invalidos_ou_duplicados");
  for (const conflict of conflicts) exigir(bloqueios, objeto(conflict)
    && id(conflict.conflictId)
    && id(conflict.stateId)
    && stateIds.has(conflict.stateId)
    && texto(conflict.resolution), "conflict_invalido");

  const reconnect = entrada.reconnect;
  exigir(bloqueios, objeto(reconnect)
    && reconnect.disconnectDetected === true
    && reconnect.reconnectAllowed === true
    && reconnect.resyncSnapshot === true
    && reconnect.replaySinceSequence === true
    && positivo(reconnect.timeoutMs), "reconnect_incompleto");
  exigir(bloqueios, listaUnica(entrada.securityInvariants, texto)
    && SEGURANCA_MULTIPLAYER.every((item) => (entrada.securityInvariants as readonly string[]).includes(item)), "security_invariants_incompletos");
  exigir(bloqueios, listaUnica(entrada.evidenceRequirements, texto)
    && EVIDENCIA_MULTIPLAYER.every((item) => (entrada.evidenceRequirements as readonly string[]).includes(item)), "evidence_requirements_incompletos");

  const modelDigest = digestSeguro(entrada, bloqueios, "modelo_nao_canonicalizavel");
  const gapsUnicos = entradaSensivel ? [] : [...new Set(gaps)].sort();
  const bloqueiosUnicos = [...new Set(bloqueios)].sort();
  return {
    valido: bloqueiosUnicos.length === 0 && gapsUnicos.length === 0,
    modelDigest,
    authorityGaps: gapsUnicos,
    nextActions: gapsUnicos.length > 0
      ? gapsUnicos.map((stateId) => `definir_autoridade_e_validacao:${stateId}`)
      : bloqueiosUnicos.length > 0
        ? ["corrigir_modelo_autoridade"]
        : ["capturar_traces_multiplayer_em_runner_externo"],
    authoritative: false,
    executed: false,
    bloqueios: bloqueiosUnicos,
  };
}
