// SEMA-GOVERNED: sema.produto.sistemas_interativos.temporal
// Descricao: contratos 4D e verificacao estrutural local de timeline, camera, fisica, QA, build e hardware.

import {
  digestJsonSistemaInterativo,
  digestSha256Valido,
} from "./canonical.js";

export const SCHEMA_CONTRATO_TEMPORAL = "sema.interactive.temporal/v1" as const;
export const SCHEMA_EVIDENCIA_TEMPORAL = "sema.interactive.temporal-evidence/v1" as const;

export type UnidadeTempoTemporal = "FRAME" | "MILLISECOND" | "SECOND" | "TICK";
export type TipoTrackTemporal = "TRANSFORM" | "ANIMATION" | "VFX" | "AUDIO" | "SPEECH" | "SUBTITLE" | "EVENT";
export type TipoInvariantTemporal = "ORDER" | "SYNC" | "VISIBILITY" | "BOUNDS" | "NO_OVERLAP" | "CONTINUITY";
export type TipoRelacaoFisica = "COLLISION" | "ATTACHMENT" | "SEPARATION" | "CONSTRAINT";
export type TipoQaTemporal = "FLICKER" | "GHOSTING" | "POPPING" | "EXPOSURE" | "JITTER";
export type TipoEvidenciaTemporal =
  | "SCREENSHOT"
  | "VIDEO"
  | "DEPTH"
  | "NORMALS"
  | "OBJECT_ID"
  | "MOTION_VECTORS"
  | "TRANSFORMS"
  | "EVENT_TRACE"
  | "COLLISION_TRACE"
  | "AUDIO_TRACE"
  | "TELEMETRY"
  | "INSTALL_LOG"
  | "LAUNCH_LOG"
  | "PLAYTEST_TRACE";
export type DecisaoObservacaoTemporal = "PASS" | "FAIL" | "INCONCLUSIVE";

export interface SistemaCoordenadasTemporal {
  readonly unit: string;
  readonly handedness: "LEFT" | "RIGHT";
  readonly upAxis: "X" | "Y" | "Z";
  readonly forwardAxis: "X" | "Y" | "Z";
}

export interface FaseTemporal {
  readonly phaseId: string;
  readonly start: number;
  readonly end: number;
  readonly timeUnit: UnidadeTempoTemporal;
}

export interface ClipTemporal {
  readonly clipId: string;
  readonly phaseId: string;
  readonly semanticTargetId: string;
  readonly start: number;
  readonly end: number;
  readonly timeUnit: UnidadeTempoTemporal;
}

export interface TrackTemporal {
  readonly trackId: string;
  readonly type: TipoTrackTemporal;
  readonly clips: readonly ClipTemporal[];
}

export interface InvariantTemporal {
  readonly invariantId: string;
  readonly type: TipoInvariantTemporal;
  readonly phaseId: string;
  readonly trackIds: readonly string[];
  readonly subjectIds: readonly string[];
  readonly threshold: number;
  readonly unit: string;
}

export interface ShotTemporal {
  readonly shotId: string;
  readonly phaseId: string;
  readonly cameraId: string;
  readonly subjectIds: readonly string[];
  readonly start: number;
  readonly end: number;
  readonly timeUnit: UnidadeTempoTemporal;
  readonly composition: string;
  readonly minimumVisibilityRatio: number;
  readonly maximumJitter: number;
}

export interface RelacaoFisicaTemporal {
  readonly relationId: string;
  readonly type: TipoRelacaoFisica;
  readonly phaseId: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly start: number;
  readonly end: number;
  readonly timeUnit: UnidadeTempoTemporal;
  readonly tolerance: number;
  readonly unit: string;
}

export interface CheckQaTemporal {
  readonly checkId: string;
  readonly type: TipoQaTemporal;
  readonly phaseId: string;
  readonly threshold: number;
  readonly unit: string;
}

export interface AceitacaoBuildTemporal {
  readonly required: boolean;
  readonly artifactDigest?: string;
  readonly cleanInstallRequired: boolean;
  readonly launchRequired: boolean;
  readonly smokePlaytestRequired: boolean;
}

export interface AlvoHardwareTemporal {
  readonly profileId: string;
  readonly gpu: string;
  readonly cpu: string;
  readonly resolution: { readonly width: number; readonly height: number };
  readonly targetFps: number;
  readonly frameTimeP95Ms: number;
  readonly maxRamMb: number;
  readonly maxVramMb: number;
  readonly maxDiskMb: number;
}

export interface ContratoTemporalInterativo {
  readonly schemaVersion: typeof SCHEMA_CONTRATO_TEMPORAL;
  readonly contractId: string;
  readonly systemId: string;
  readonly experienceIrDigest: string;
  readonly coordinateSystem: SistemaCoordenadasTemporal;
  readonly phases: readonly FaseTemporal[];
  readonly tracks: readonly TrackTemporal[];
  readonly invariants: readonly InvariantTemporal[];
  readonly shots: readonly ShotTemporal[];
  readonly physics: readonly RelacaoFisicaTemporal[];
  readonly temporalQa: { readonly checks: readonly CheckQaTemporal[] };
  readonly buildAcceptance: AceitacaoBuildTemporal;
  readonly hardwareTargets: readonly AlvoHardwareTemporal[];
}

export interface MetricaTemporal {
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  readonly threshold: number;
}

export interface ObservacaoTemporal {
  readonly observationId: string;
  readonly checkId: string;
  readonly decision: DecisaoObservacaoTemporal;
  readonly evidenceTypes: readonly TipoEvidenciaTemporal[];
  readonly artifactDigests: readonly string[];
  readonly sampleCount: number;
  readonly traceDigest?: string;
  readonly phaseId?: string;
  readonly frame?: number;
  readonly time?: number;
  readonly timeUnit?: UnidadeTempoTemporal;
  readonly metrics?: readonly MetricaTemporal[];
}

export interface BundleVerificacaoTemporal {
  readonly schemaVersion: typeof SCHEMA_EVIDENCIA_TEMPORAL;
  readonly runId: string;
  readonly contractDigest: string;
  readonly producerId: string;
  readonly producerVersion: string;
  readonly producerConfigurationDigest: string;
  readonly verifierId: string;
  readonly verifierVersion: string;
  readonly verifierConfigurationDigest: string;
  readonly independentOfProducer: boolean;
  readonly observations: readonly ObservacaoTemporal[];
}

export interface ResultadoValidacaoContratoTemporal {
  readonly valido: boolean;
  readonly contractDigest: string;
  readonly requiredCheckIds: readonly string[];
  readonly bloqueios: readonly string[];
  readonly executed: false;
  readonly authoritative: false;
}

export interface DiagnosticoTemporal {
  readonly failedInvariant: string;
  readonly phase?: string;
  readonly frame?: number;
  readonly time?: number;
  readonly timeUnit?: UnidadeTempoTemporal;
  readonly evidenceIds: readonly string[];
  readonly decision: "FAIL" | "INCONCLUSIVE";
  readonly likelyCauses: readonly string[];
}

export interface ResultadoValidacaoBundleTemporal {
  readonly valido: boolean;
  readonly contractDigest: string;
  readonly bundleDigest: string;
  readonly resultDigest: string;
  readonly checksAceitos: readonly string[];
  readonly checksAusentes: readonly string[];
  readonly checksFalhos: readonly string[];
  readonly diagnostics: readonly DiagnosticoTemporal[];
  readonly nextActions: readonly string[];
  readonly bloqueios: readonly string[];
  readonly completed: false;
  readonly localCoverageComplete: boolean;
  readonly awaitingExternalAttestation: true;
  readonly completionScope: "STRUCTURAL_LOCAL";
  readonly authoritative: false;
  readonly executed: false;
}

type Registro = Record<string, unknown>;

const IDS_SEGUROS = /^[a-z0-9][a-z0-9._:/-]{0,127}$/;
const TIPOS_TRACK = new Set<TipoTrackTemporal>(["TRANSFORM", "ANIMATION", "VFX", "AUDIO", "SPEECH", "SUBTITLE", "EVENT"]);
const TIPOS_INVARIANT = new Set<TipoInvariantTemporal>(["ORDER", "SYNC", "VISIBILITY", "BOUNDS", "NO_OVERLAP", "CONTINUITY"]);
const TIPOS_FISICA = new Set<TipoRelacaoFisica>(["COLLISION", "ATTACHMENT", "SEPARATION", "CONSTRAINT"]);
const TIPOS_QA = new Set<TipoQaTemporal>(["FLICKER", "GHOSTING", "POPPING", "EXPOSURE", "JITTER"]);
const TIPOS_EVIDENCIA = new Set<TipoEvidenciaTemporal>([
  "SCREENSHOT", "VIDEO", "DEPTH", "NORMALS", "OBJECT_ID", "MOTION_VECTORS", "TRANSFORMS",
  "EVENT_TRACE", "COLLISION_TRACE", "AUDIO_TRACE", "TELEMETRY", "INSTALL_LOG", "LAUNCH_LOG", "PLAYTEST_TRACE",
]);
const UNIDADES_TEMPO = new Set<UnidadeTempoTemporal>(["FRAME", "MILLISECOND", "SECOND", "TICK"]);
const DECISOES = new Set<DecisaoObservacaoTemporal>(["PASS", "FAIL", "INCONCLUSIVE"]);
const CHAVE_SENSIVEL = /(?:password|passwd|senha|secret|token|api.?key|private.?key|credential|authorization|cookie)/i;
const VALOR_SENSIVEL = /(?:\bBearer\s+[A-Za-z0-9._~+/-]{8,}|\b(?:sk|pk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|[?&](?:access_token|token|api_?key|signature|x-amz-signature)=)/i;
const CHAVES_CONTRATO = new Set([
  "schemaVersion", "contractId", "systemId", "experienceIrDigest", "coordinateSystem", "phases", "tracks",
  "invariants", "shots", "physics", "temporalQa", "buildAcceptance", "hardwareTargets",
]);
const CHAVES_BUNDLE = new Set([
  "schemaVersion", "runId", "contractDigest", "producerId", "producerVersion", "producerConfigurationDigest",
  "verifierId", "verifierVersion", "verifierConfigurationDigest", "independentOfProducer", "observations",
]);
const LIMITE_METRICA = 1_000_000_000_000;

function objeto(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function digestJsonSeguro(valor: unknown): string {
  try {
    const serializado = JSON.stringify(valor);
    if (typeof serializado !== "string") throw new TypeError("json_nao_serializavel");
    return digestJsonSistemaInterativo(JSON.parse(serializado) as unknown);
  } catch {
    return digestJsonSistemaInterativo({ invalidCanonicalInput: true });
  }
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function idSeguro(valor: unknown): valor is string {
  return typeof valor === "string" && IDS_SEGUROS.test(valor);
}

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

function positivo(valor: unknown): valor is number {
  return numeroFinito(valor) && valor > 0;
}

function naoNegativo(valor: unknown): valor is number {
  return numeroFinito(valor) && valor >= 0;
}

function numeroMetricoSeguro(valor: unknown): valor is number {
  return naoNegativo(valor) && valor <= LIMITE_METRICA;
}

function idsUnicosValidos(valores: readonly unknown[]): boolean {
  return valores.every(idSeguro) && new Set(valores).size === valores.length;
}

function stringsUnicasValidas(valores: unknown): valores is readonly string[] {
  return Array.isArray(valores) && valores.length > 0 && valores.every(texto) && new Set(valores).size === valores.length;
}

function contemMaterialSensivel(valor: unknown, visitados = new Set<object>()): boolean {
  if (typeof valor === "string") return VALOR_SENSIVEL.test(valor);
  if (!objeto(valor) && !Array.isArray(valor)) return false;
  if (visitados.has(valor)) return true;
  visitados.add(valor);
  try {
    if (Array.isArray(valor)) return valor.some((item) => contemMaterialSensivel(item, visitados));
    return Object.entries(valor).some(([chave, item]) => CHAVE_SENSIVEL.test(chave) || contemMaterialSensivel(item, visitados));
  } finally {
    visitados.delete(valor);
  }
}

function somenteChaves(valor: Registro, permitidas: ReadonlySet<string>): boolean {
  return Object.keys(valor).every((chave) => permitidas.has(chave));
}

function adicionar(bloqueios: string[], condicao: boolean, codigo: string): void {
  if (!condicao) bloqueios.push(codigo);
}

function faseValida(valor: unknown): valor is FaseTemporal {
  return objeto(valor)
    && idSeguro(valor.phaseId)
    && naoNegativo(valor.start)
    && positivo(valor.end)
    && valor.start < valor.end
    && UNIDADES_TEMPO.has(valor.timeUnit as UnidadeTempoTemporal);
}

function intervaloNaFase(
  valor: { readonly phaseId: string; readonly start: number; readonly end: number; readonly timeUnit: UnidadeTempoTemporal },
  fases: ReadonlyMap<string, FaseTemporal>,
): boolean {
  const fase = fases.get(valor.phaseId);
  return Boolean(fase && fase.timeUnit === valor.timeUnit && valor.start >= fase.start && valor.end <= fase.end && valor.start < valor.end);
}

function checkIdsContrato(contrato: ContratoTemporalInterativo): string[] {
  const ids = [
    ...contrato.invariants.map((item) => item.invariantId),
    ...contrato.shots.map((item) => item.shotId),
    ...contrato.physics.map((item) => item.relationId),
    ...contrato.temporalQa.checks.map((item) => item.checkId),
    ...contrato.hardwareTargets.map((item) => `hardware:${item.profileId}`),
  ];
  if (contrato.buildAcceptance.required) {
    ids.push("build.materialize", "build.clean_install", "build.launch", "build.smoke_playtest");
  }
  return ids.sort((a, b) => a.localeCompare(b));
}

function validarContratoInterno(entrada: unknown): {
  contrato?: ContratoTemporalInterativo;
  digest: string;
  checks: string[];
  bloqueios: string[];
} {
  const bloqueios: string[] = [];
  let digest = "sha256:invalid";
  if (!objeto(entrada)) return { digest, checks: [], bloqueios: ["contrato_invalido"] };
  const contemSensivel = contemMaterialSensivel(entrada);
  if (contemSensivel) bloqueios.push("contrato_contem_dado_sensivel");
  adicionar(bloqueios, somenteChaves(entrada, CHAVES_CONTRATO), "contrato_campo_top_level_desconhecido");
  adicionar(bloqueios, entrada.schemaVersion === SCHEMA_CONTRATO_TEMPORAL, "schema_version_nao_suportada");
  adicionar(bloqueios, idSeguro(entrada.contractId), "contract_id_invalido");
  adicionar(bloqueios, idSeguro(entrada.systemId), "system_id_invalido");
  adicionar(bloqueios, digestSha256Valido(entrada.experienceIrDigest), "experience_ir_digest_invalido");

  const coordenadas = entrada.coordinateSystem;
  adicionar(bloqueios, objeto(coordenadas)
    && texto(coordenadas.unit)
    && (coordenadas.handedness === "LEFT" || coordenadas.handedness === "RIGHT")
    && ["X", "Y", "Z"].includes(String(coordenadas.upAxis))
    && ["X", "Y", "Z"].includes(String(coordenadas.forwardAxis))
    && coordenadas.upAxis !== coordenadas.forwardAxis, "coordinate_system_invalido");

  const fasesBrutas = Array.isArray(entrada.phases) ? entrada.phases : [];
  adicionar(bloqueios, fasesBrutas.length > 0 && fasesBrutas.every(faseValida), "phases_invalidas");
  const fases = new Map<string, FaseTemporal>();
  if (fasesBrutas.every(faseValida)) {
    adicionar(bloqueios, idsUnicosValidos(fasesBrutas.map((item) => item.phaseId)), "phase_ids_invalidos_ou_duplicados");
    for (const fase of fasesBrutas) fases.set(fase.phaseId, fase);
    for (let indice = 1; indice < fasesBrutas.length; indice += 1) {
      if (fasesBrutas[indice]!.start < fasesBrutas[indice - 1]!.start) bloqueios.push("phases_fora_de_ordem");
    }
  }

  const tracksBrutos = Array.isArray(entrada.tracks) ? entrada.tracks : [];
  adicionar(bloqueios, tracksBrutos.length > 0, "tracks_ausentes");
  adicionar(bloqueios, idsUnicosValidos(tracksBrutos.map((item) => objeto(item) ? item.trackId : undefined)), "track_ids_invalidos_ou_duplicados");
  const trackTypes = new Map<string, TipoTrackTemporal>();
  for (const track of tracksBrutos) {
    if (!objeto(track) || !idSeguro(track.trackId) || !TIPOS_TRACK.has(track.type as TipoTrackTemporal) || !Array.isArray(track.clips) || track.clips.length === 0) {
      bloqueios.push("track_invalido");
      continue;
    }
    trackTypes.set(track.trackId, track.type as TipoTrackTemporal);
    adicionar(bloqueios, idsUnicosValidos(track.clips.map((clip) => objeto(clip) ? clip.clipId : undefined)), "clip_ids_invalidos_ou_duplicados");
    for (const clip of track.clips) {
      const valido = objeto(clip)
        && idSeguro(clip.clipId)
        && idSeguro(clip.phaseId)
        && idSeguro(clip.semanticTargetId)
        && naoNegativo(clip.start)
        && positivo(clip.end)
        && UNIDADES_TEMPO.has(clip.timeUnit as UnidadeTempoTemporal)
        && intervaloNaFase(clip as unknown as ClipTemporal, fases);
      adicionar(bloqueios, valido, "clip_invalido_ou_fora_da_phase");
    }
  }

  const invariantsBrutos = Array.isArray(entrada.invariants) ? entrada.invariants : [];
  adicionar(bloqueios, idsUnicosValidos(invariantsBrutos.map((item) => objeto(item) ? item.invariantId : undefined)), "invariant_ids_invalidos_ou_duplicados");
  for (const item of invariantsBrutos) {
    const valido = objeto(item)
      && idSeguro(item.invariantId)
      && TIPOS_INVARIANT.has(item.type as TipoInvariantTemporal)
      && idSeguro(item.phaseId)
      && fases.has(item.phaseId)
      && stringsUnicasValidas(item.trackIds)
      && item.trackIds.every((id) => trackTypes.has(id))
      && stringsUnicasValidas(item.subjectIds)
      && naoNegativo(item.threshold)
      && texto(item.unit);
    adicionar(bloqueios, valido, "invariant_invalido");
  }

  const shotsBrutos = Array.isArray(entrada.shots) ? entrada.shots : [];
  adicionar(bloqueios, idsUnicosValidos(shotsBrutos.map((item) => objeto(item) ? item.shotId : undefined)), "shot_ids_invalidos_ou_duplicados");
  for (const shot of shotsBrutos) {
    const valido = objeto(shot)
      && idSeguro(shot.shotId)
      && idSeguro(shot.phaseId)
      && idSeguro(shot.cameraId)
      && stringsUnicasValidas(shot.subjectIds)
      && !shot.subjectIds.includes(shot.cameraId)
      && naoNegativo(shot.start)
      && positivo(shot.end)
      && UNIDADES_TEMPO.has(shot.timeUnit as UnidadeTempoTemporal)
      && intervaloNaFase(shot as unknown as ShotTemporal, fases)
      && texto(shot.composition)
      && numeroFinito(shot.minimumVisibilityRatio)
      && shot.minimumVisibilityRatio >= 0
      && shot.minimumVisibilityRatio <= 1
      && naoNegativo(shot.maximumJitter);
    adicionar(bloqueios, valido, "shot_invalido");
  }

  const physicsBrutos = Array.isArray(entrada.physics) ? entrada.physics : [];
  adicionar(bloqueios, idsUnicosValidos(physicsBrutos.map((item) => objeto(item) ? item.relationId : undefined)), "physics_ids_invalidos_ou_duplicados");
  for (const item of physicsBrutos) {
    const valido = objeto(item)
      && idSeguro(item.relationId)
      && TIPOS_FISICA.has(item.type as TipoRelacaoFisica)
      && idSeguro(item.phaseId)
      && idSeguro(item.sourceId)
      && idSeguro(item.targetId)
      && item.sourceId !== item.targetId
      && naoNegativo(item.start)
      && positivo(item.end)
      && UNIDADES_TEMPO.has(item.timeUnit as UnidadeTempoTemporal)
      && intervaloNaFase(item as unknown as RelacaoFisicaTemporal, fases)
      && naoNegativo(item.tolerance)
      && texto(item.unit);
    adicionar(bloqueios, valido, "physics_relation_invalida");
  }

  const qaChecks = objeto(entrada.temporalQa) && Array.isArray(entrada.temporalQa.checks) ? entrada.temporalQa.checks : [];
  adicionar(bloqueios, idsUnicosValidos(qaChecks.map((item) => objeto(item) ? item.checkId : undefined)), "qa_check_ids_invalidos_ou_duplicados");
  const tiposQa = new Set<TipoQaTemporal>();
  for (const check of qaChecks) {
    const valido = objeto(check)
      && idSeguro(check.checkId)
      && TIPOS_QA.has(check.type as TipoQaTemporal)
      && idSeguro(check.phaseId)
      && fases.has(check.phaseId)
      && positivo(check.threshold)
      && texto(check.unit);
    if (valido) tiposQa.add(check.type as TipoQaTemporal);
    adicionar(bloqueios, valido, "qa_check_invalido");
  }
  for (const tipo of TIPOS_QA) adicionar(bloqueios, tiposQa.has(tipo), `qa_check_${tipo.toLowerCase()}_ausente`);

  const build = entrada.buildAcceptance;
  const buildValido = objeto(build)
    && typeof build.required === "boolean"
    && typeof build.cleanInstallRequired === "boolean"
    && typeof build.launchRequired === "boolean"
    && typeof build.smokePlaytestRequired === "boolean"
    && (!build.required || (
      digestSha256Valido(build.artifactDigest)
      && build.cleanInstallRequired === true
      && build.launchRequired === true
      && build.smokePlaytestRequired === true
    ));
  adicionar(bloqueios, buildValido, "build_acceptance_invalida");

  const hardware = Array.isArray(entrada.hardwareTargets) ? entrada.hardwareTargets : [];
  adicionar(bloqueios, idsUnicosValidos(hardware.map((item) => objeto(item) ? item.profileId : undefined)), "hardware_profile_ids_invalidos_ou_duplicados");
  for (const alvo of hardware) {
    const resolucao = objeto(alvo) && objeto(alvo.resolution) ? alvo.resolution : undefined;
    const valido = objeto(alvo)
      && idSeguro(alvo.profileId)
      && texto(alvo.gpu)
      && texto(alvo.cpu)
      && Boolean(resolucao && positivo(resolucao.width) && positivo(resolucao.height))
      && positivo(alvo.targetFps)
      && positivo(alvo.frameTimeP95Ms)
      && positivo(alvo.maxRamMb)
      && positivo(alvo.maxVramMb)
      && positivo(alvo.maxDiskMb);
    adicionar(bloqueios, valido, "hardware_target_invalido");
  }

  const contrato = entrada as unknown as ContratoTemporalInterativo;
  let checks: string[] = [];
  try {
    digest = digestJsonSistemaInterativo(entrada);
    checks = contemSensivel ? [] : checkIdsContrato(contrato);
    adicionar(bloqueios, idsUnicosValidos(checks), "required_check_ids_invalidos_ou_duplicados");
  } catch {
    bloqueios.push("contrato_nao_canonicalizavel");
  }
  return { contrato, digest, checks, bloqueios: [...new Set(bloqueios)].sort() };
}

export function validarContratoTemporalInterativo(entrada: unknown): ResultadoValidacaoContratoTemporal {
  const resultado = validarContratoInterno(entrada);
  return {
    valido: resultado.bloqueios.length === 0,
    contractDigest: resultado.digest,
    requiredCheckIds: resultado.checks,
    bloqueios: resultado.bloqueios,
    executed: false,
    authoritative: false,
  };
}

function categoriaCheck(contrato: ContratoTemporalInterativo, checkId: string): "INVARIANT" | "SHOT" | "PHYSICS" | "QA" | "BUILD" | "HARDWARE" {
  if (contrato.invariants.some((item) => item.invariantId === checkId)) return "INVARIANT";
  if (contrato.shots.some((item) => item.shotId === checkId)) return "SHOT";
  if (contrato.physics.some((item) => item.relationId === checkId)) return "PHYSICS";
  if (contrato.temporalQa.checks.some((item) => item.checkId === checkId)) return "QA";
  if (checkId.startsWith("build.")) return "BUILD";
  return "HARDWARE";
}

function faseDoCheck(contrato: ContratoTemporalInterativo, checkId: string): string | undefined {
  return contrato.invariants.find((item) => item.invariantId === checkId)?.phaseId
    ?? contrato.shots.find((item) => item.shotId === checkId)?.phaseId
    ?? contrato.physics.find((item) => item.relationId === checkId)?.phaseId
    ?? contrato.temporalQa.checks.find((item) => item.checkId === checkId)?.phaseId;
}

function causasProvaveis(contrato: ContratoTemporalInterativo, checkId: string): string[] {
  const invariant = contrato.invariants.find((item) => item.invariantId === checkId);
  if (invariant) {
    return ({
      ORDER: ["event_order_diverged"],
      SYNC: ["timeline_tracks_out_of_sync"],
      VISIBILITY: ["subject_visibility_below_contract"],
      BOUNDS: ["target_left_declared_bounds"],
      NO_OVERLAP: ["tracks_or_objects_overlap"],
      CONTINUITY: ["temporal_discontinuity_detected"],
    } as const)[invariant.type].slice();
  }
  const categoria = categoriaCheck(contrato, checkId);
  if (categoria === "SHOT") return ["camera_or_subject_contract_diverged"];
  if (categoria === "PHYSICS") return ["physics_relation_diverged"];
  if (categoria === "QA") return ["temporal_quality_threshold_exceeded"];
  if (categoria === "BUILD") return ["packaged_artifact_chain_incomplete"];
  return ["hardware_budget_exceeded"];
}

function observacaoEstruturalmenteValida(valor: unknown, checks: ReadonlySet<string>): valor is ObservacaoTemporal {
  if (!objeto(valor)
    || !idSeguro(valor.observationId)
    || !idSeguro(valor.checkId)
    || !checks.has(valor.checkId)
    || !DECISOES.has(valor.decision as DecisaoObservacaoTemporal)
    || !Array.isArray(valor.evidenceTypes)
    || valor.evidenceTypes.length === 0
    || !valor.evidenceTypes.every((tipo) => TIPOS_EVIDENCIA.has(tipo as TipoEvidenciaTemporal))
    || new Set(valor.evidenceTypes).size !== valor.evidenceTypes.length
    || !Array.isArray(valor.artifactDigests)
    || valor.artifactDigests.length === 0
    || !valor.artifactDigests.every(digestSha256Valido)
    || !Number.isInteger(valor.sampleCount)
    || (valor.sampleCount as number) < 1) return false;
  if (valor.traceDigest !== undefined && !digestSha256Valido(valor.traceDigest)) return false;
  if (valor.phaseId !== undefined && !idSeguro(valor.phaseId)) return false;
  if (valor.frame !== undefined && !naoNegativo(valor.frame)) return false;
  if (valor.time !== undefined && !naoNegativo(valor.time)) return false;
  if (valor.timeUnit !== undefined && !UNIDADES_TEMPO.has(valor.timeUnit as UnidadeTempoTemporal)) return false;
  if (valor.metrics !== undefined && (!Array.isArray(valor.metrics)
    || valor.metrics.length === 0
    || !valor.metrics.every((metrica) => objeto(metrica)
      && idSeguro(metrica.name)
      && numeroMetricoSeguro(metrica.value)
      && texto(metrica.unit)
      && numeroMetricoSeguro(metrica.threshold))
    || new Set(valor.metrics.map((metrica) => objeto(metrica) ? metrica.name : undefined)).size !== valor.metrics.length)) return false;
  return true;
}

interface ExpectativaMetricaTemporal {
  readonly name: string;
  readonly unit: string;
  readonly threshold: number;
  readonly direction: "MIN" | "MAX";
}

function expectativasMetricas(
  contrato: ContratoTemporalInterativo,
  checkId: string,
): readonly ExpectativaMetricaTemporal[] {
  const qa = contrato.temporalQa.checks.find((item) => item.checkId === checkId);
  if (qa) return [{ name: qa.type.toLowerCase(), unit: qa.unit, threshold: qa.threshold, direction: "MAX" }];
  const hardware = contrato.hardwareTargets.find((item) => `hardware:${item.profileId}` === checkId);
  if (!hardware) return [];
  return [
    { name: "target_fps", unit: "fps", threshold: hardware.targetFps, direction: "MIN" },
    { name: "frame_time_p95_ms", unit: "ms", threshold: hardware.frameTimeP95Ms, direction: "MAX" },
    { name: "ram_mb", unit: "mb", threshold: hardware.maxRamMb, direction: "MAX" },
    { name: "vram_mb", unit: "mb", threshold: hardware.maxVramMb, direction: "MAX" },
    { name: "disk_mb", unit: "mb", threshold: hardware.maxDiskMb, direction: "MAX" },
  ];
}

function validarMetricasContraContrato(
  contrato: ContratoTemporalInterativo,
  observacao: ObservacaoTemporal,
  bloqueios: string[],
): void {
  const esperadas = expectativasMetricas(contrato, observacao.checkId);
  if (esperadas.length === 0) return;
  const metricas = new Map((observacao.metrics ?? []).map((item) => [item.name, item]));
  const contratoCoerente = metricas.size === esperadas.length && esperadas.every((esperada) => {
    const recebida = metricas.get(esperada.name);
    return recebida?.unit === esperada.unit && recebida.threshold === esperada.threshold;
  });
  if (!contratoCoerente) {
    bloqueios.push("metricas_divergem_do_contrato");
    return;
  }
  const excedeu = esperadas.some((esperada) => {
    const value = metricas.get(esperada.name)?.value as number;
    return esperada.direction === "MAX" ? value > esperada.threshold : value < esperada.threshold;
  });
  if (observacao.decision === "PASS" && excedeu) bloqueios.push("decision_pass_incoerente_com_metricas");
  if (observacao.decision === "FAIL" && !excedeu) bloqueios.push("decision_fail_incoerente_com_metricas");
}

function validarEvidenciaPorCategoria(
  contrato: ContratoTemporalInterativo,
  observacao: ObservacaoTemporal,
  bloqueios: string[],
): void {
  const tipos = new Set(observacao.evidenceTypes);
  const categoria = categoriaCheck(contrato, observacao.checkId);
  const temporal = categoria === "INVARIANT" || categoria === "SHOT" || categoria === "PHYSICS" || categoria === "QA";
  const faseEsperada = faseDoCheck(contrato, observacao.checkId);
  if (faseEsperada !== undefined && observacao.phaseId !== faseEsperada) bloqueios.push("check_phase_divergente");
  if (temporal && observacao.sampleCount < 2 && !observacao.traceDigest) bloqueios.push("check_temporal_exige_amostras_ou_trace");
  if ((categoria === "SHOT" || categoria === "PHYSICS") && ![
    "DEPTH", "NORMALS", "OBJECT_ID", "TRANSFORMS", "COLLISION_TRACE",
  ].some((tipo) => tipos.has(tipo as TipoEvidenciaTemporal))) bloqueios.push("check_geometrico_exige_evidencia_geometrica");
  const invariant = contrato.invariants.find((item) => item.invariantId === observacao.checkId);
  const tracks = invariant?.trackIds.map((id) => contrato.tracks.find((track) => track.trackId === id)?.type).filter(Boolean) ?? [];
  if (tracks.some((tipo) => tipo === "AUDIO" || tipo === "SPEECH")
    && (!tipos.has("AUDIO_TRACE") || !tipos.has("EVENT_TRACE"))) bloqueios.push("check_audio_exige_audio_trace_e_event_trace");
  if ((categoria === "QA" || categoria === "HARDWARE") && (!observacao.metrics || observacao.metrics.length === 0)) {
    bloqueios.push("check_metrico_exige_metricas");
  }
  validarMetricasContraContrato(contrato, observacao, bloqueios);
  if (categoria === "BUILD") {
    const tipoEsperado: Partial<Record<string, TipoEvidenciaTemporal>> = {
      "build.materialize": "TELEMETRY",
      "build.clean_install": "INSTALL_LOG",
      "build.launch": "LAUNCH_LOG",
      "build.smoke_playtest": "PLAYTEST_TRACE",
    };
    const esperado = tipoEsperado[observacao.checkId];
    if (esperado && !tipos.has(esperado)) bloqueios.push("build_check_exige_evidencia_especifica");
  }
}

export function validarBundleVerificacaoTemporal(
  contratoEntrada: unknown,
  bundleEntrada: unknown,
): ResultadoValidacaoBundleTemporal {
  const bundleDigest = digestJsonSeguro(bundleEntrada);
  const contratoValidado = validarContratoInterno(contratoEntrada);
  const bloqueios = contratoValidado.bloqueios.map((item) => `contrato_invalido:${item}`);
  const contrato = contratoValidado.contrato;
  const checksAceitos: string[] = [];
  const checksFalhos: string[] = [];
  const diagnostics: DiagnosticoTemporal[] = [];
  const observados = new Set<string>();
  let bundleSensivel = false;

  if (!contrato || !objeto(bundleEntrada)) {
    bloqueios.push("bundle_invalido");
  } else {
    bundleSensivel = contemMaterialSensivel(bundleEntrada);
    if (bundleSensivel) bloqueios.push("bundle_contem_dado_sensivel");
    adicionar(bloqueios, somenteChaves(bundleEntrada, CHAVES_BUNDLE), "bundle_campo_top_level_desconhecido");
    adicionar(bloqueios, bundleEntrada.schemaVersion === SCHEMA_EVIDENCIA_TEMPORAL, "bundle_schema_version_nao_suportada");
    adicionar(bloqueios, idSeguro(bundleEntrada.runId), "bundle_run_id_invalido");
    adicionar(bloqueios, bundleEntrada.contractDigest === contratoValidado.digest, "bundle_contract_digest_divergente");
    adicionar(bloqueios, idSeguro(bundleEntrada.producerId), "bundle_producer_id_invalido");
    adicionar(bloqueios, texto(bundleEntrada.producerVersion), "bundle_producer_version_invalida");
    adicionar(bloqueios, digestSha256Valido(bundleEntrada.producerConfigurationDigest), "bundle_producer_configuration_digest_invalido");
    adicionar(bloqueios, idSeguro(bundleEntrada.verifierId), "bundle_verifier_id_invalido");
    adicionar(bloqueios, texto(bundleEntrada.verifierVersion), "bundle_verifier_version_invalida");
    adicionar(bloqueios, digestSha256Valido(bundleEntrada.verifierConfigurationDigest), "bundle_verifier_configuration_digest_invalido");
    adicionar(bloqueios, bundleEntrada.independentOfProducer === true, "verifier_deve_ser_independente_do_produtor");
    adicionar(bloqueios, bundleEntrada.producerId !== bundleEntrada.verifierId, "verifier_id_deve_diferir_do_produtor");
    const brutas = Array.isArray(bundleEntrada.observations) ? bundleEntrada.observations : [];
    adicionar(bloqueios, Array.isArray(bundleEntrada.observations), "bundle_observations_invalidas");
    adicionar(bloqueios, idsUnicosValidos(brutas.map((item) => objeto(item) ? item.observationId : undefined)), "observation_ids_invalidos_ou_duplicados");
    const required = new Set(contratoValidado.checks);
    const checkIdsBrutos = brutas.map((item) => objeto(item) ? item.checkId : undefined);
    adicionar(bloqueios, idsUnicosValidos(checkIdsBrutos), "observation_check_ids_invalidos_ou_duplicados");
    for (const bruta of brutas) {
      if (!observacaoEstruturalmenteValida(bruta, required)) {
        bloqueios.push("observacao_invalida");
        continue;
      }
      const observacao = bruta;
      observados.add(observacao.checkId);
      const bloqueiosAntes = bloqueios.length;
      validarEvidenciaPorCategoria(contrato, observacao, bloqueios);
      if (observacao.decision === "PASS") {
        if (bloqueios.length === bloqueiosAntes) checksAceitos.push(observacao.checkId);
      } else {
        checksFalhos.push(observacao.checkId);
        diagnostics.push({
          failedInvariant: observacao.checkId,
          phase: faseDoCheck(contrato, observacao.checkId),
          frame: observacao.frame,
          time: observacao.time,
          timeUnit: observacao.timeUnit,
          evidenceIds: [observacao.observationId],
          decision: observacao.decision,
          likelyCauses: causasProvaveis(contrato, observacao.checkId),
        });
      }
    }
  }

  const bloqueiosUnicos = [...new Set(bloqueios)].sort();
  const bloqueioEstrutural = bloqueiosUnicos.length > 0;
  const checksAceitosFinais = bloqueioEstrutural ? [] : [...new Set(checksAceitos)].sort();
  const checksFalhosFinais = bundleSensivel ? [] : [...new Set(checksFalhos)].sort();
  const diagnosticsFinais = bundleSensivel ? [] : diagnostics;
  const checksAusentes = bloqueioEstrutural
    ? [...contratoValidado.checks]
    : contratoValidado.checks.filter((id) => !observados.has(id));
  const valido = !bloqueioEstrutural && checksAusentes.length === 0 && checksFalhosFinais.length === 0;
  const nextActions = bloqueioEstrutural
    ? ["corrigir_bundle_temporal"]
    : [
      ...checksAusentes.map((id) => `capturar_evidencia_temporal:${id}`),
      ...checksFalhosFinais.map((id) => `diagnosticar_e_corrigir_sem_apply:${id}`),
      ...checksFalhosFinais.map((id) => `reexecutar_check_temporal:${id}`),
    ];
  if (valido) nextActions.push("solicitar_atestacao_externa");
  const resultadoSemDigest: Omit<ResultadoValidacaoBundleTemporal, "resultDigest"> = {
    valido,
    contractDigest: contratoValidado.digest,
    bundleDigest,
    checksAceitos: checksAceitosFinais,
    checksAusentes,
    checksFalhos: checksFalhosFinais,
    diagnostics: diagnosticsFinais,
    nextActions,
    bloqueios: bloqueiosUnicos,
    completed: false,
    localCoverageComplete: valido,
    awaitingExternalAttestation: true,
    completionScope: "STRUCTURAL_LOCAL",
    authoritative: false,
    executed: false,
  };
  return {
    ...resultadoSemDigest,
    resultDigest: digestJsonSeguro(resultadoSemDigest),
  };
}
