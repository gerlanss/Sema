// SEMA-GOVERNED: sema.produto.sistemas_interativos.catalogo_avancado
// Descricao: pipelines e descriptors P0/P1/P2, compartilhados pelo planner e pela descoberta AI-first.

import type {
  AdaptadorSistemaInterativo,
  EtapaPipelineSistemaInterativo,
  FidelidadeSistemaInterativo,
  KindSistemaInterativo,
  ModeloEspacialSistemaInterativo,
  ModeloTempoSistemaInterativo,
  ModoControleSistemaInterativo,
  ModoRenderSistemaInterativo,
  PerfilVisualSistemaInterativo,
  PipelineSistemaInterativo,
} from "./types.js";

const KINDS: readonly KindSistemaInterativo[] = ["GAME", "SIMULATION", "HYBRID"];
const SPATIAL: readonly ModeloEspacialSistemaInterativo[] = ["NON_SPATIAL", "TWO_D", "TWO_POINT_FIVE_D", "THREE_D"];
const RENDER: readonly ModoRenderSistemaInterativo[] = ["HEADLESS", "TEXT", "VISUAL", "XR"];
const VISUAL: readonly PerfilVisualSistemaInterativo[] = ["NONE", "PIXEL_8_BIT", "PIXEL_16_BIT", "RASTER", "VECTOR", "STYLIZED", "REALISTIC"];
const CONTROL: readonly ModoControleSistemaInterativo[] = ["HUMAN", "SCRIPTED", "AI", "HYBRID", "AUTONOMOUS", "UNCONTROLLED"];
const TIME: readonly ModeloTempoSistemaInterativo[] = ["TURN_BASED", "FIXED_STEP", "VARIABLE_STEP", "REAL_TIME", "EVENT_DRIVEN", "BATCH", "ACCELERATED"];
const FIDELITY: readonly FidelidadeSistemaInterativo[] = ["ARCADE", "STYLIZED", "SYSTEMIC", "REALISTIC", "CALIBRATED"];

function freezeDeep<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const item of Object.values(value as Record<string, unknown>)) freezeDeep(item);
  return Object.freeze(value);
}

function stage(
  stageId: string,
  capability: string,
  dependsOn: readonly string[],
  produces: readonly string[],
  requiredEvidence: readonly string[],
): EtapaPipelineSistemaInterativo {
  return { stageId, capability, dependsOn, produces, requiredEvidence };
}

type PipelineInput = Pick<PipelineSistemaInterativo,
  "pipelineId" | "label" | "summary" | "capabilities" | "stages" | "requiredEvidence" | "useWhen" | "avoidWhen"
> & Partial<Pick<PipelineSistemaInterativo, "kinds" | "spatialModels" | "renderModes" | "visualProfiles" | "controlModes" | "fidelities">>;

function pipeline(input: PipelineInput): PipelineSistemaInterativo {
  return {
    version: "1.0.0",
    kinds: input.kinds ?? KINDS,
    spatialModels: input.spatialModels ?? SPATIAL,
    renderModes: input.renderModes ?? RENDER,
    visualProfiles: input.visualProfiles ?? VISUAL,
    controlModes: input.controlModes ?? CONTROL,
    fidelities: input.fidelities ?? FIDELITY,
    ...input,
  };
}

export const CATALOGO_PIPELINES_INTERATIVOS_AVANCADOS: readonly PipelineSistemaInterativo[] = freezeDeep([
  pipeline({
    pipelineId: "interactive.experience_ir",
    label: "Experience IR content-addressed",
    summary: "Valida, indexa e consulta o grafo portátil de projeto, mundo, cena, entidade, componente e asset.",
    capabilities: ["interactive.ir.validate", "interactive.ir.index", "interactive.ir.query"],
    stages: [
      stage("validate", "interactive.ir.validate", [], ["validated-ir"], ["ir.schema.valid", "ir.references.resolved", "ir.digest"]),
      stage("index", "interactive.ir.index", ["validate"], ["ir-index"], ["ir.index.valid", "ir.chunks.content_addressed"]),
      stage("query", "interactive.ir.query", ["index"], ["query-plan"], ["ir.query.bounded"]),
    ],
    requiredEvidence: ["ir.schema.valid", "ir.references.resolved", "ir.digest", "ir.index.valid", "ir.chunks.content_addressed", "ir.query.bounded"],
    useWhen: ["modelar experiência independente de engine", "consultar cena por IDs semânticos", "transportar mundo entre ferramentas"],
    avoidWhen: ["o pedido é executar ou converter uma engine diretamente"],
  }),
  pipeline({
    pipelineId: "interactive.observe",
    label: "Observação read-only de engine",
    summary: "Planeja detect, probe, snapshot e diff antes de qualquer mutação em engine ou editor externo.",
    capabilities: ["interactive.engine.detect", "interactive.engine.probe", "interactive.engine.snapshot", "interactive.engine.diff"],
    stages: [
      stage("detect", "interactive.engine.detect", [], ["engine-detection"], ["engine.detected"]),
      stage("probe", "interactive.engine.probe", ["detect"], ["engine-probe"], ["engine.probe.observed"]),
      stage("snapshot", "interactive.engine.snapshot", ["probe"], ["engine-snapshot"], ["engine.snapshot.digest", "semantic.ids.bound"]),
      stage("diff", "interactive.engine.diff", ["snapshot"], ["engine-diff"], ["engine.diff.structured"]),
    ],
    requiredEvidence: ["engine.detected", "engine.probe.observed", "engine.snapshot.digest", "semantic.ids.bound", "engine.diff.structured"],
    useWhen: ["inspecionar Blender Unreal Unity Godot ou runtime", "observar antes de alterar", "comparar estado de cena"],
    avoidWhen: ["não existe autorização nem adapter externo disponível"],
  }),
  pipeline({
    pipelineId: "interactive.asset_provenance",
    label: "Proveniência de assets",
    summary: "Liga fonte, licença, hash, transformações e derivados sem armazenar os binários no Sema.",
    capabilities: ["interactive.asset.provenance", "interactive.asset.license", "interactive.asset.lineage"],
    stages: [
      stage("source", "interactive.asset.provenance", [], ["asset-source-record"], ["asset.source.digest", "asset.source.origin"]),
      stage("license", "interactive.asset.license", ["source"], ["license-record"], ["asset.license.valid"]),
      stage("lineage", "interactive.asset.lineage", ["license"], ["asset-lineage"], ["asset.transforms.recorded", "asset.derivatives.bound"]),
    ],
    requiredEvidence: ["asset.source.digest", "asset.source.origin", "asset.license.valid", "asset.transforms.recorded", "asset.derivatives.bound"],
    useWhen: ["importar ou derivar asset", "provar licença e linhagem", "rastrear Blender até artefato final"],
    avoidWhen: ["a origem ou licença é desconhecida"],
  }),
  pipeline({
    pipelineId: "interactive.editor_state",
    label: "Estado recuperável do editor",
    summary: "Captura cena, seleção, modo, não salvos, shaders, imports, plugins, modais e processos.",
    capabilities: ["interactive.editor.snapshot", "interactive.editor.unsaved", "interactive.editor.background_jobs"],
    stages: [
      stage("snapshot", "interactive.editor.snapshot", [], ["editor-state"], ["editor.scene.active", "editor.mode", "editor.selection"]),
      stage("unsaved", "interactive.editor.unsaved", ["snapshot"], ["unsaved-report"], ["editor.unsaved.observed", "editor.modals.observed"]),
      stage("jobs", "interactive.editor.background_jobs", ["unsaved"], ["editor-jobs"], ["editor.shaders.observed", "editor.imports.observed", "editor.processes.observed"]),
    ],
    requiredEvidence: ["editor.scene.active", "editor.mode", "editor.selection", "editor.unsaved.observed", "editor.modals.observed", "editor.shaders.observed", "editor.imports.observed", "editor.processes.observed"],
    useWhen: ["evitar concorrência no editor", "decidir retomada segura", "diagnosticar editor aparentemente travado"],
    avoidWhen: ["matar processo apenas por timeout"],
  }),
  pipeline({
    pipelineId: "interactive.evidence_capture",
    label: "Captura multimodal de evidência",
    summary: "Planeja captura e verificação de vídeo, depth, normals, object-ID, motion, áudio, eventos e telemetria.",
    capabilities: ["interactive.evidence.plan", "interactive.evidence.capture", "interactive.evidence.verify"],
    stages: [
      stage("plan", "interactive.evidence.plan", [], ["capture-plan"], ["evidence.claim.bound", "evidence.modalities.selected"]),
      stage("capture", "interactive.evidence.capture", ["plan"], ["multimodal-bundle"], ["evidence.artifacts.digested", "evidence.timebase.bound"]),
      stage("verify", "interactive.evidence.verify", ["capture"], ["verification-report"], ["evidence.verifier.independent", "evidence.decision"]),
    ],
    requiredEvidence: ["evidence.claim.bound", "evidence.modalities.selected", "evidence.artifacts.digested", "evidence.timebase.bound", "evidence.verifier.independent", "evidence.decision"],
    useWhen: ["provar claim visual temporal geométrico ou sonoro", "substituir opinião solta por bundle"],
    avoidWhen: ["screenshot isolado é insuficiente para o claim"],
  }),
  pipeline({
    pipelineId: "interactive.job_recovery",
    label: "Job, lock e retomada",
    summary: "Planeja locks, budgets, heartbeat, checkpoint, retomada e recovery token para trabalho externo.",
    capabilities: ["interactive.job.lock", "interactive.job.heartbeat", "interactive.job.checkpoint", "interactive.job.resume"],
    stages: [
      stage("lock", "interactive.job.lock", [], ["resource-locks"], ["job.locks.valid", "job.budgets.valid"]),
      stage("heartbeat", "interactive.job.heartbeat", ["lock"], ["heartbeat-policy"], ["job.heartbeat.valid"]),
      stage("checkpoint", "interactive.job.checkpoint", ["heartbeat"], ["checkpoint-policy"], ["job.checkpoint.digest"]),
      stage("resume", "interactive.job.resume", ["checkpoint"], ["resume-plan"], ["job.recovery.token", "job.resume.idempotent"]),
    ],
    requiredEvidence: ["job.locks.valid", "job.budgets.valid", "job.heartbeat.valid", "job.checkpoint.digest", "job.recovery.token", "job.resume.idempotent"],
    useWhen: ["usar GPU editor ou cache compartilhado", "retomar render cook ou teste", "evitar duas IAs no mesmo recurso"],
    avoidWhen: ["não existe snapshot ou checkpoint recuperável"],
  }),
  pipeline({
    pipelineId: "interactive.acceptance_lock",
    label: "Aceite humano vinculado",
    summary: "Prende aprovação a hash, cena e intervalo temporal, com invalidação explícita após mudança relevante.",
    capabilities: ["interactive.acceptance.bind", "interactive.acceptance.regression", "interactive.acceptance.invalidate"],
    stages: [
      stage("bind", "interactive.acceptance.bind", [], ["acceptance-lock"], ["acceptance.artifact.bound", "acceptance.range.bound"]),
      stage("regression", "interactive.acceptance.regression", ["bind"], ["acceptance-check"], ["acceptance.digest.compared"]),
      stage("invalidate", "interactive.acceptance.invalidate", ["regression"], ["invalidation-plan"], ["acceptance.invalidation.explicit"]),
    ],
    requiredEvidence: ["acceptance.artifact.bound", "acceptance.range.bound", "acceptance.digest.compared", "acceptance.invalidation.explicit"],
    useWhen: ["usuário aprovou trecho e não quer regressão", "preservar shot ou comportamento aceito"],
    avoidWhen: ["aprovação não está ligada ao artefato exato"],
  }),
  pipeline({
    pipelineId: "interactive.temporal_validate",
    label: "Contrato 4D e timeline multimodal",
    summary: "Valida fases, tracks, clips, ordem, sync, bounds e continuidade em uma timebase explícita.",
    capabilities: ["interactive.temporal.contract", "interactive.timeline.sync", "interactive.temporal.invariants"],
    stages: [
      stage("contract", "interactive.temporal.contract", [], ["temporal-contract"], ["temporal.schema.valid", "temporal.timebase.valid"]),
      stage("sync", "interactive.timeline.sync", ["contract"], ["timeline-report"], ["timeline.multimodal.sync"]),
      stage("invariants", "interactive.temporal.invariants", ["sync"], ["invariant-report"], ["temporal.invariants.evaluated"]),
    ],
    requiredEvidence: ["temporal.schema.valid", "temporal.timebase.valid", "timeline.multimodal.sync", "temporal.invariants.evaluated"],
    useWhen: ["validar posição e tempo", "sincronizar animação VFX áudio fala e legenda", "detectar ordem causal errada"],
    avoidWhen: ["não existe timebase ou IDs semânticos"],
  }),
  pipeline({
    pipelineId: "interactive.shot_validate",
    label: "Contrato de câmera e shot",
    summary: "Mede sujeito visível, composição, intervalo e jitter sem confundir frame bonito com continuidade.",
    capabilities: ["interactive.shot.contract", "interactive.camera.visibility", "interactive.camera.jitter"],
    stages: [
      stage("contract", "interactive.shot.contract", [], ["shot-contract"], ["shot.camera.bound", "shot.subjects.bound"]),
      stage("visibility", "interactive.camera.visibility", ["contract"], ["visibility-report"], ["camera.subject.visibility"]),
      stage("jitter", "interactive.camera.jitter", ["visibility"], ["jitter-report"], ["camera.jitter.metric"]),
    ],
    requiredEvidence: ["shot.camera.bound", "shot.subjects.bound", "camera.subject.visibility", "camera.jitter.metric"],
    useWhen: ["câmera perde personagem nave ou objeto", "provar composição ao longo do shot"],
    avoidWhen: ["apenas um frame estático foi capturado"],
  }),
  pipeline({
    pipelineId: "interactive.physics_validate",
    label: "Relações físicas verificáveis",
    summary: "Valida colisão, attachment, separação e constraint por trace geométrico e tolerância.",
    capabilities: ["interactive.physics.contract", "interactive.physics.trace", "interactive.physics.verify"],
    stages: [
      stage("contract", "interactive.physics.contract", [], ["physics-contract"], ["physics.targets.bound", "physics.tolerance.bound"]),
      stage("trace", "interactive.physics.trace", ["contract"], ["physics-trace"], ["physics.transforms.captured", "physics.collisions.captured"]),
      stage("verify", "interactive.physics.verify", ["trace"], ["physics-report"], ["physics.relation.verified"]),
    ],
    requiredEvidence: ["physics.targets.bound", "physics.tolerance.bound", "physics.transforms.captured", "physics.collisions.captured", "physics.relation.verified"],
    useWhen: ["objeto atravessa outro", "validar separação ou attachment", "provar contato antes de efeito"],
    avoidWhen: ["PNG isolado é a única evidência"],
  }),
  pipeline({
    pipelineId: "interactive.temporal_qa",
    label: "QA temporal visual",
    summary: "Mede flicker, ghosting, popping, exposição e jitter com thresholds e métricas.",
    capabilities: ["interactive.qa.capture", "interactive.qa.flicker", "interactive.qa.ghosting", "interactive.qa.popping", "interactive.qa.exposure", "interactive.qa.jitter"],
    stages: [
      stage("capture", "interactive.qa.capture", [], ["qa-sequence"], ["qa.sequence.digested", "qa.timebase.bound"]),
      stage("flicker", "interactive.qa.flicker", ["capture"], ["flicker-metrics"], ["qa.flicker.metric"]),
      stage("ghosting", "interactive.qa.ghosting", ["capture"], ["ghosting-metrics"], ["qa.ghosting.metric"]),
      stage("popping", "interactive.qa.popping", ["capture"], ["popping-metrics"], ["qa.popping.metric"]),
      stage("exposure", "interactive.qa.exposure", ["capture"], ["exposure-metrics"], ["qa.exposure.metric"]),
      stage("jitter", "interactive.qa.jitter", ["capture"], ["jitter-metrics"], ["qa.jitter.metric"]),
    ],
    requiredEvidence: ["qa.sequence.digested", "qa.timebase.bound", "qa.flicker.metric", "qa.ghosting.metric", "qa.popping.metric", "qa.exposure.metric", "qa.jitter.metric"],
    useWhen: ["detectar tremulação ghosting popping exposição ou jitter", "validar render em movimento"],
    avoidWhen: ["não há sequência temporal comparável"],
  }),
  pipeline({
    pipelineId: "interactive.clean_install_smoke",
    label: "Instalação limpa e smoke playtest",
    summary: "Separa build materializado, instalação limpa, launch e smoke do artefato empacotado.",
    capabilities: ["interactive.build.materialize", "interactive.install.clean", "interactive.package.launch", "interactive.package.smoke"],
    stages: [
      stage("build", "interactive.build.materialize", [], ["build-artifact"], ["build.artifact.digest"]),
      stage("install", "interactive.install.clean", ["build"], ["installed-artifact"], ["install.clean.log"]),
      stage("launch", "interactive.package.launch", ["install"], ["launch-trace"], ["package.launch.observed"]),
      stage("smoke", "interactive.package.smoke", ["launch"], ["smoke-trace"], ["package.smoke.playtest"]),
    ],
    requiredEvidence: ["build.artifact.digest", "install.clean.log", "package.launch.observed", "package.smoke.playtest"],
    useWhen: ["provar pacote fora do monorepo ou editor", "evitar build passou logo funciona"],
    avoidWhen: ["não existe artefato empacotado"],
  }),
  pipeline({
    pipelineId: "interactive.hardware_budget",
    label: "Budget por hardware",
    summary: "Liga profile de hardware a resolução, FPS, frame time, RAM, VRAM e disco medidos.",
    capabilities: ["interactive.hardware.profile", "interactive.resources.measure", "interactive.hardware.compare"],
    stages: [
      stage("profile", "interactive.hardware.profile", [], ["hardware-profile"], ["hardware.profile.bound"]),
      stage("measure", "interactive.resources.measure", ["profile"], ["resource-metrics"], ["hardware.metrics.observed"]),
      stage("compare", "interactive.hardware.compare", ["measure"], ["budget-report"], ["hardware.budget.compared"]),
    ],
    requiredEvidence: ["hardware.profile.bound", "hardware.metrics.observed", "hardware.budget.compared"],
    useWhen: ["validar RTX3060 1080p60 ou outro alvo", "medir frame time RAM VRAM e disco"],
    avoidWhen: ["perfil de hardware ou métricas não foram declarados"],
  }),
  pipeline({
    pipelineId: "interactive.autonomous_repair",
    label: "Reparo autônomo seguro",
    summary: "Ordena diagnosticar, propor, simular e provar; apenas patch reversível elegível vai a runner autorizado.",
    capabilities: ["interactive.autonomy.diagnose", "interactive.autonomy.propose", "interactive.autonomy.simulate", "interactive.autonomy.prove"],
    stages: [
      stage("diagnose", "interactive.autonomy.diagnose", [], ["diagnostic"], ["repair.invariant.failed", "repair.evidence.bound"]),
      stage("propose", "interactive.autonomy.propose", ["diagnose"], ["patch-proposal"], ["repair.risk.classified", "repair.rollback.planned"]),
      stage("simulate", "interactive.autonomy.simulate", ["propose"], ["simulation-result"], ["repair.sandbox.result"]),
      stage("prove", "interactive.autonomy.prove", ["simulate"], ["repair-proof"], ["repair.verifier.independent", "repair.proof.decision"]),
    ],
    requiredEvidence: ["repair.invariant.failed", "repair.evidence.bound", "repair.risk.classified", "repair.rollback.planned", "repair.sandbox.result", "repair.verifier.independent", "repair.proof.decision"],
    useWhen: ["diagnosticar e propor correção recuperável", "automatizar patch seguro com prova"],
    avoidWhen: ["operação privilegiada irreversível ou sem snapshot"],
  }),
  pipeline({
    pipelineId: "interactive.bot_playtest",
    label: "Playtest por bots seeded",
    summary: "Planeja bots bounded com allowlist de input, seed, estado, failure e replay.",
    capabilities: ["interactive.bot.plan", "interactive.bot.run", "interactive.bot.observe"],
    stages: [
      stage("plan", "interactive.bot.plan", [], ["bot-scenarios"], ["bot.seed.bound", "bot.inputs.allowlisted", "bot.budgets.bound"]),
      stage("run", "interactive.bot.run", ["plan"], ["bot-run"], ["bot.runtime.trace", "bot.state.digest"]),
      stage("observe", "interactive.bot.observe", ["run"], ["bot-report"], ["bot.failure.trace", "bot.replay.trace"]),
    ],
    requiredEvidence: ["bot.seed.bound", "bot.inputs.allowlisted", "bot.budgets.bound", "bot.runtime.trace", "bot.state.digest", "bot.failure.trace", "bot.replay.trace"],
    useWhen: ["automatizar playtest repetível", "explorar loop com seed", "testar estados e falhas"],
    avoidWhen: ["input ou runtime está fora do sandbox"],
  }),
  pipeline({
    pipelineId: "interactive.state_fuzz",
    label: "Fuzz de input, save e load",
    summary: "Faz plano bounded para input, save/load, corrupção, recovery e migração de versão sem tocar original.",
    capabilities: ["interactive.fuzz.plan", "interactive.fuzz.save_load", "interactive.fuzz.recovery"],
    stages: [
      stage("plan", "interactive.fuzz.plan", [], ["fuzz-plan"], ["fuzz.bounds.valid", "fuzz.stop.valid"]),
      stage("save-load", "interactive.fuzz.save_load", ["plan"], ["save-load-traces"], ["fuzz.save_load.sandboxed", "fuzz.original.immutable"]),
      stage("recovery", "interactive.fuzz.recovery", ["save-load"], ["recovery-report"], ["fuzz.corrupt.recovery", "fuzz.version.migration"]),
    ],
    requiredEvidence: ["fuzz.bounds.valid", "fuzz.stop.valid", "fuzz.save_load.sandboxed", "fuzz.original.immutable", "fuzz.corrupt.recovery", "fuzz.version.migration"],
    useWhen: ["testar input save load e corrupção", "achar crash hang ou state drift"],
    avoidWhen: ["save canônico seria sobrescrito"],
  }),
  pipeline({
    pipelineId: "interactive.multiplayer_authority",
    label: "Autoridade e replicação multiplayer",
    summary: "Modela owner, writers, readers, conflito, validação, reconnect, resync e anti-replay.",
    kinds: ["GAME", "HYBRID"],
    capabilities: ["interactive.multiplayer.authority", "interactive.multiplayer.replication", "interactive.multiplayer.conflict", "interactive.multiplayer.reconnect"],
    stages: [
      stage("authority", "interactive.multiplayer.authority", [], ["authority-model"], ["multiplayer.authority.bound"]),
      stage("replication", "interactive.multiplayer.replication", ["authority"], ["replication-trace"], ["multiplayer.replication.trace"]),
      stage("conflict", "interactive.multiplayer.conflict", ["replication"], ["conflict-report"], ["multiplayer.conflict.resolved"]),
      stage("reconnect", "interactive.multiplayer.reconnect", ["conflict"], ["reconnect-report"], ["multiplayer.resync.snapshot", "multiplayer.replay.sequence"]),
    ],
    requiredEvidence: ["multiplayer.authority.bound", "multiplayer.replication.trace", "multiplayer.conflict.resolved", "multiplayer.resync.snapshot", "multiplayer.replay.sequence"],
    useWhen: ["validar autoridade multiplayer", "detectar cliente confiável demais", "provar reconnect e resync"],
    avoidWhen: ["experiência não possui rede"],
  }),
  pipeline({
    pipelineId: "interactive.engine_migration",
    label: "Migração versionada de engine",
    summary: "Exige backup, relatório de compatibilidade, teste e rollback antes da migração externa.",
    capabilities: ["interactive.migration.snapshot", "interactive.migration.compatibility", "interactive.migration.execute", "interactive.migration.verify"],
    stages: [
      stage("snapshot", "interactive.migration.snapshot", [], ["migration-backup"], ["migration.backup.digest", "migration.rollback.plan"]),
      stage("compatibility", "interactive.migration.compatibility", ["snapshot"], ["compatibility-report"], ["migration.compatibility.report"]),
      stage("migrate", "interactive.migration.execute", ["compatibility"], ["migration-candidate"], ["migration.candidate.digest"]),
      stage("verify", "interactive.migration.verify", ["migrate"], ["migration-test-report"], ["migration.tests", "migration.smoke"]),
    ],
    requiredEvidence: ["migration.backup.digest", "migration.rollback.plan", "migration.compatibility.report", "migration.candidate.digest", "migration.tests", "migration.smoke"],
    useWhen: ["migrar versão de engine", "testar upgrade com rollback"],
    avoidWhen: ["não há backup ou versão de origem e destino"],
  }),
  pipeline({
    pipelineId: "interactive.portability",
    label: "Portabilidade assistida entre engines",
    summary: "Mapeia semanticamente origem e alvo, declarando aproximações, unsupported, fallback e perdas.",
    capabilities: ["interactive.portability.map", "interactive.portability.losses", "interactive.portability.export", "interactive.portability.verify"],
    stages: [
      stage("map", "interactive.portability.map", [], ["semantic-mapping"], ["portability.semantic.map"]),
      stage("losses", "interactive.portability.losses", ["map"], ["loss-report"], ["portability.losses.declared", "portability.fallbacks.declared"]),
      stage("export", "interactive.portability.export", ["losses"], ["export-plan"], ["portability.export.digest"]),
      stage("verify", "interactive.portability.verify", ["export"], ["target-report"], ["portability.import.verify", "portability.smoke"]),
    ],
    requiredEvidence: ["portability.semantic.map", "portability.losses.declared", "portability.fallbacks.declared", "portability.export.digest", "portability.import.verify", "portability.smoke"],
    useWhen: ["portar Unreal Unity Godot Blender ou custom", "comparar perdas entre engines"],
    avoidWhen: ["o pedido exige conversão perfeita sem perdas declaradas"],
  }),
  pipeline({
    pipelineId: "interactive.distributed_jobs",
    label: "Workers distribuídos",
    summary: "Planeja DAG, assignment, leases, heartbeat e checkpoints para cook, shaders, render e testes.",
    capabilities: ["interactive.workers.dag", "interactive.workers.assign", "interactive.workers.lease", "interactive.workers.execute", "interactive.workers.verify"],
    stages: [
      stage("dag", "interactive.workers.dag", [], ["job-dag"], ["workers.dag.valid"]),
      stage("assign", "interactive.workers.assign", ["dag"], ["assignments"], ["workers.capabilities.covered", "workers.budgets.covered"]),
      stage("lease", "interactive.workers.lease", ["assign"], ["leases"], ["workers.locks.valid", "workers.heartbeat.valid", "workers.checkpoint.valid"]),
      stage("execute", "interactive.workers.execute", ["lease"], ["worker-results"], ["workers.jobs.observed"]),
      stage("verify", "interactive.workers.verify", ["execute"], ["distributed-report"], ["workers.outputs.digested", "workers.resources.measured"]),
    ],
    requiredEvidence: ["workers.dag.valid", "workers.capabilities.covered", "workers.budgets.covered", "workers.locks.valid", "workers.heartbeat.valid", "workers.checkpoint.valid", "workers.jobs.observed", "workers.outputs.digested", "workers.resources.measured"],
    useWhen: ["distribuir cook shaders render e testes", "usar workers com recursos distintos"],
    avoidWhen: ["DAG tem ciclo ou lock exclusivo concorrente"],
  }),
]);

const READ_ONLY_PROTOCOL = ["DETECT", "PROBE", "SNAPSHOT", "PLAN", "VALIDATE", "EVIDENCE"] as const;
const MUTATING_PROTOCOL = ["DETECT", "PROBE", "SNAPSHOT", "PLAN", "APPLY", "VALIDATE", "EVIDENCE", "ROLLBACK"] as const;

type AdapterInput = Omit<AdaptadorSistemaInterativo,
  "version" | "kinds" | "spatialModels" | "renderModes" | "visualProfiles" | "controlModes" | "timeModels" | "fidelities" |
  "protocol" | "readOnlyProbe" | "supportsRollback" | "executionBoundary"
> & Partial<Pick<AdaptadorSistemaInterativo, "kinds" | "spatialModels" | "renderModes" | "visualProfiles" | "controlModes" | "timeModels" | "fidelities">>;

function adapter(input: AdapterInput): AdaptadorSistemaInterativo {
  return {
    version: "1.0.0",
    kinds: input.kinds ?? KINDS,
    spatialModels: input.spatialModels ?? SPATIAL,
    renderModes: input.renderModes ?? RENDER,
    visualProfiles: input.visualProfiles ?? VISUAL,
    controlModes: input.controlModes ?? CONTROL,
    timeModels: input.timeModels ?? TIME,
    fidelities: input.fidelities ?? FIDELITY,
    protocol: input.mutatesWorkspace ? MUTATING_PROTOCOL : READ_ONLY_PROTOCOL,
    readOnlyProbe: true,
    supportsRollback: input.mutatesWorkspace,
    executionBoundary: "EXTERNAL",
    ...input,
  };
}

export const CATALOGO_ADAPTADORES_INTERATIVOS_AVANCADOS: readonly AdaptadorSistemaInterativo[] = freezeDeep([
  adapter({
    adapterId: "validator.experience-ir.external",
    role: "VALIDATOR",
    engine: "experience-ir-validator",
    capabilities: ["interactive.ir.validate", "interactive.ir.index", "interactive.ir.query"],
    mutatesWorkspace: false,
  }),
  adapter({
    adapterId: "observer.engine.external",
    role: "ENGINE",
    engine: "engine-observer",
    capabilities: ["interactive.engine.detect", "interactive.engine.probe", "interactive.engine.snapshot", "interactive.engine.diff"],
    mutatesWorkspace: false,
  }),
  adapter({
    adapterId: "validator.asset-provenance.external",
    role: "ASSET",
    engine: "asset-provenance-validator",
    capabilities: ["interactive.asset.provenance", "interactive.asset.license", "interactive.asset.lineage"],
    mutatesWorkspace: false,
  }),
  adapter({
    adapterId: "observer.editor-state.external",
    role: "EDITOR",
    engine: "editor-state-observer",
    capabilities: ["interactive.editor.snapshot", "interactive.editor.unsaved", "interactive.editor.background_jobs"],
    mutatesWorkspace: false,
  }),
  adapter({
    adapterId: "validator.multimodal.external",
    role: "TELEMETRY",
    engine: "multimodal-validator",
    capabilities: [
      "interactive.evidence.plan", "interactive.evidence.capture", "interactive.evidence.verify",
      "interactive.temporal.contract", "interactive.timeline.sync", "interactive.temporal.invariants",
      "interactive.shot.contract", "interactive.camera.visibility", "interactive.camera.jitter",
      "interactive.physics.contract", "interactive.physics.trace", "interactive.physics.verify",
      "interactive.qa.capture", "interactive.qa.flicker", "interactive.qa.ghosting", "interactive.qa.popping", "interactive.qa.exposure", "interactive.qa.jitter",
      "interactive.hardware.profile", "interactive.resources.measure", "interactive.hardware.compare",
    ],
    mutatesWorkspace: false,
  }),
  adapter({
    adapterId: "orchestrator.job.external",
    role: "CUSTOM",
    engine: "job-orchestrator",
    capabilities: [
      "interactive.job.lock", "interactive.job.heartbeat", "interactive.job.checkpoint", "interactive.job.resume",
      "interactive.acceptance.bind", "interactive.acceptance.regression", "interactive.acceptance.invalidate",
    ],
    mutatesWorkspace: false,
  }),
  adapter({
    adapterId: "runner.package-test.external",
    role: "BUILD",
    engine: "package-test-runner",
    capabilities: ["interactive.build.materialize", "interactive.install.clean", "interactive.package.launch", "interactive.package.smoke"],
    mutatesWorkspace: true,
  }),
  adapter({
    adapterId: "runner.autonomy.external",
    role: "RUNTIME",
    engine: "autonomy-sandbox-runner",
    capabilities: [
      "interactive.autonomy.diagnose", "interactive.autonomy.propose", "interactive.autonomy.simulate", "interactive.autonomy.prove",
      "interactive.bot.plan", "interactive.bot.run", "interactive.bot.observe",
      "interactive.fuzz.plan", "interactive.fuzz.save_load", "interactive.fuzz.recovery",
      "interactive.multiplayer.authority", "interactive.multiplayer.replication", "interactive.multiplayer.conflict", "interactive.multiplayer.reconnect",
    ],
    mutatesWorkspace: true,
  }),
  adapter({
    adapterId: "adapter.portability.external",
    role: "CUSTOM",
    engine: "portability-adapter",
    capabilities: [
      "interactive.migration.snapshot", "interactive.migration.compatibility", "interactive.migration.execute", "interactive.migration.verify",
      "interactive.portability.map", "interactive.portability.losses", "interactive.portability.export", "interactive.portability.verify",
    ],
    mutatesWorkspace: true,
  }),
  adapter({
    adapterId: "orchestrator.workers.external",
    role: "BUILD",
    engine: "distributed-worker-orchestrator",
    capabilities: ["interactive.workers.dag", "interactive.workers.assign", "interactive.workers.lease", "interactive.workers.execute", "interactive.workers.verify"],
    mutatesWorkspace: true,
  }),
]);

export function listarPipelinesInterativosAvancados(): readonly PipelineSistemaInterativo[] {
  return CATALOGO_PIPELINES_INTERATIVOS_AVANCADOS;
}

export function listarAdaptadoresInterativosAvancados(): readonly AdaptadorSistemaInterativo[] {
  return CATALOGO_ADAPTADORES_INTERATIVOS_AVANCADOS;
}
