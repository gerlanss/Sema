// SEMA-GOVERNED: sema.produto.sistemas_interativos + sema.produto.sistemas_interativos.adaptadores
// Descricao: catalogo canonico, versionado e apenas declarativo de capabilities, pipelines e adapters.

import type {
  AdaptadorSistemaInterativo,
  CapabilitySistemaInterativo,
  EtapaPipelineSistemaInterativo,
  FidelidadeSistemaInterativo,
  FiltrosAdaptadoresSistemasInterativos,
  KindSistemaInterativo,
  ModeloEspacialSistemaInterativo,
  ModeloTempoSistemaInterativo,
  ModoRenderSistemaInterativo,
  ModoControleSistemaInterativo,
  PapelAdaptadorSistemaInterativo,
  PerfilVisualSistemaInterativo,
  PipelineSistemaInterativo,
  ResultadoListagemAdaptadoresSistemasInterativos,
} from "./types.js";
import {
  CATALOGO_ADAPTADORES_INTERATIVOS_AVANCADOS,
  CATALOGO_PIPELINES_INTERATIVOS_AVANCADOS,
} from "./advancedCatalog.js";

const KINDS: readonly KindSistemaInterativo[] = ["GAME", "SIMULATION", "HYBRID"];
const MODELOS_ESPACIAIS: readonly ModeloEspacialSistemaInterativo[] = [
  "NON_SPATIAL", "TWO_D", "TWO_POINT_FIVE_D", "THREE_D",
];
const MODOS_RENDER: readonly ModoRenderSistemaInterativo[] = ["HEADLESS", "TEXT", "VISUAL", "XR"];
const PERFIS_VISUAIS: readonly PerfilVisualSistemaInterativo[] = [
  "NONE", "PIXEL_8_BIT", "PIXEL_16_BIT", "RASTER", "VECTOR", "STYLIZED", "REALISTIC",
];
const CONTROLES: readonly ModoControleSistemaInterativo[] = [
  "HUMAN", "SCRIPTED", "AI", "HYBRID", "AUTONOMOUS", "UNCONTROLLED",
];
const TEMPOS: readonly ModeloTempoSistemaInterativo[] = [
  "TURN_BASED", "FIXED_STEP", "VARIABLE_STEP", "REAL_TIME", "EVENT_DRIVEN", "BATCH", "ACCELERATED",
];
const FIDELIDADES: readonly FidelidadeSistemaInterativo[] = [
  "ARCADE", "STYLIZED", "SYSTEMIC", "REALISTIC", "CALIBRATED",
];

function congelarProfundo<T>(valor: T): T {
  if (typeof valor !== "object" || valor === null || Object.isFrozen(valor)) return valor;
  for (const item of Object.values(valor as Record<string, unknown>)) congelarProfundo(item);
  return Object.freeze(valor);
}

function etapa(
  stageId: string,
  capability: string,
  dependsOn: readonly string[],
  produces: readonly string[],
  requiredEvidence: readonly string[],
): EtapaPipelineSistemaInterativo {
  return { stageId, capability, dependsOn, produces, requiredEvidence };
}

function pipeline(
  entrada: Omit<PipelineSistemaInterativo, "version">,
): PipelineSistemaInterativo {
  return { version: "1.0.0", ...entrada };
}

export const CATALOGO_PIPELINES_INTERATIVOS: readonly PipelineSistemaInterativo[] = congelarProfundo([
  pipeline({
    pipelineId: "interactive.prototype",
    label: "Protótipo interativo",
    summary: "Modela mundo, estado, tempo e runtime antes do primeiro smoke test externo.",
    kinds: KINDS,
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: FIDELIDADES,
    capabilities: ["interactive.world.model", "interactive.state.model", "interactive.runtime.bind", "interactive.smoke.observe"],
    stages: [
      etapa("world", "interactive.world.model", [], ["world-model"], ["world.model.valid"]),
      etapa("state", "interactive.state.model", ["world"], ["state-model"], ["state.transitions.valid"]),
      etapa("runtime", "interactive.runtime.bind", ["state"], ["runtime-binding"], ["runtime.binding.observed"]),
      etapa("smoke", "interactive.smoke.observe", ["runtime"], ["smoke-report"], ["runtime.boot", "runtime.loop"]),
    ],
    requiredEvidence: ["world.model.valid", "state.transitions.valid", "runtime.binding.observed", "runtime.boot", "runtime.loop"],
    useWhen: ["criar primeiro prototipo", "validar arquitetura interativa", "ligar mundo a runtime"],
    avoidWhen: ["o sistema ja esta empacotado e precisa apenas de release"],
  }),
  pipeline({
    pipelineId: "interactive.playtest",
    label: "Playtest observável",
    summary: "Exige boot, loop, falha e replay observados; compilação isolada não prova jogabilidade.",
    kinds: ["GAME", "HYBRID"],
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: ["HUMAN", "SCRIPTED", "AI", "HYBRID"],
    fidelities: FIDELIDADES,
    capabilities: ["interactive.playtest.plan", "interactive.runtime.observe", "interactive.failure.observe", "interactive.replay.compare"],
    stages: [
      etapa("plan", "interactive.playtest.plan", [], ["playtest-plan"], ["playtest.plan.valid"]),
      etapa("boot", "interactive.runtime.observe", ["plan"], ["boot-trace"], ["runtime.boot"]),
      etapa("loop", "interactive.runtime.observe", ["boot"], ["loop-trace"], ["runtime.loop"]),
      etapa("failure", "interactive.failure.observe", ["loop"], ["failure-trace"], ["runtime.failure"]),
      etapa("replay", "interactive.replay.compare", ["failure"], ["replay-report"], ["runtime.replay"]),
    ],
    requiredEvidence: ["playtest.plan.valid", "runtime.boot", "runtime.loop", "runtime.failure", "runtime.replay"],
    useWhen: ["testar loop jogavel", "provar primeiros minutos", "observar falha e recuperacao"],
    avoidWhen: ["simulacao sem objetivo de jogador"],
  }),
  pipeline({
    pipelineId: "interactive.package",
    label: "Build empacotado",
    summary: "Planeja build, pacote, lançamento e smoke do artefato materializado.",
    kinds: KINDS,
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: FIDELIDADES,
    capabilities: ["interactive.build.plan", "interactive.package.plan", "interactive.launch.observe"],
    stages: [
      etapa("build", "interactive.build.plan", [], ["build-artifact"], ["package.build"]),
      etapa("package", "interactive.package.plan", ["build"], ["package-artifact"], ["package.materialized"]),
      etapa("launch", "interactive.launch.observe", ["package"], ["launch-report"], ["package.launch", "runtime.smoke"]),
    ],
    requiredEvidence: ["package.build", "package.materialized", "package.launch", "runtime.smoke"],
    useWhen: ["gerar pacote testavel", "validar artefato fora do editor"],
    avoidWhen: ["o pedido e apenas modelagem conceitual"],
  }),
  pipeline({
    pipelineId: "interactive.release",
    label: "Release interativo",
    summary: "Fecha pacote, compatibilidade, rollback e evidência de distribuição sem publicar pela CLI.",
    kinds: KINDS,
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: FIDELIDADES,
    capabilities: ["interactive.release.plan", "interactive.compatibility.validate", "interactive.rollback.plan"],
    stages: [
      etapa("candidate", "interactive.release.plan", [], ["release-candidate"], ["release.candidate"]),
      etapa("compatibility", "interactive.compatibility.validate", ["candidate"], ["compatibility-report"], ["release.compatibility"]),
      etapa("rollback", "interactive.rollback.plan", ["compatibility"], ["rollback-plan"], ["release.rollback.plan"]),
      etapa("distribution", "interactive.release.plan", ["rollback"], ["distribution-plan"], ["release.distribution.plan"]),
    ],
    requiredEvidence: ["release.candidate", "release.compatibility", "release.rollback.plan", "release.distribution.plan"],
    useWhen: ["preparar release", "provar compatibilidade e rollback"],
    avoidWhen: ["nao existe build empacotado validado"],
  }),
  pipeline({
    pipelineId: "interactive.replay",
    label: "Replay determinístico",
    summary: "Compara seed, snapshot, eventos e digest final em execução externa reproduzível.",
    kinds: KINDS,
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: FIDELIDADES,
    capabilities: ["interactive.seed.bind", "interactive.snapshot.capture", "interactive.event.log", "interactive.replay.compare"],
    stages: [
      etapa("seed", "interactive.seed.bind", [], ["seed-binding"], ["determinism.seed"]),
      etapa("snapshot", "interactive.snapshot.capture", ["seed"], ["state-snapshot"], ["state.snapshot"]),
      etapa("events", "interactive.event.log", ["snapshot"], ["event-log"], ["event.log"]),
      etapa("compare", "interactive.replay.compare", ["events"], ["replay-comparison"], ["result.digest", "runtime.replay"]),
    ],
    requiredEvidence: ["determinism.seed", "state.snapshot", "event.log", "result.digest", "runtime.replay"],
    useWhen: ["reproduzir bug", "provar determinismo", "comparar execucoes"],
    avoidWhen: ["determinismo nao e requisito e nao ha snapshot"],
  }),
  pipeline({
    pipelineId: "game.balance",
    label: "Balanceamento de jogo",
    summary: "Transforma hipóteses de balanceamento em cenários, métricas e evidências comparáveis.",
    kinds: ["GAME", "HYBRID"],
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: FIDELIDADES,
    capabilities: ["game.balance.baseline", "game.balance.scenario", "game.balance.measure", "game.balance.review"],
    stages: [
      etapa("baseline", "game.balance.baseline", [], ["balance-baseline"], ["game.balance.baseline"]),
      etapa("scenarios", "game.balance.scenario", ["baseline"], ["balance-scenarios"], ["game.balance.scenarios"]),
      etapa("measure", "game.balance.measure", ["scenarios"], ["balance-metrics"], ["game.balance.metrics"]),
      etapa("review", "game.balance.review", ["measure"], ["balance-report"], ["game.balance.review"]),
    ],
    requiredEvidence: ["game.balance.baseline", "game.balance.scenarios", "game.balance.metrics", "game.balance.review"],
    useWhen: ["ajustar dano economia dificuldade", "detectar exploit numerico"],
    avoidWhen: ["nao existe loop ou metrica observavel"],
  }),
  pipeline({
    pipelineId: "game.progression",
    label: "Progressão de jogo",
    summary: "Valida curva, desbloqueios, ritmo e atalhos abusivos da progressão.",
    kinds: ["GAME", "HYBRID"],
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: FIDELIDADES,
    capabilities: ["game.progression.model", "game.progression.curve", "game.progression.exploit"],
    stages: [
      etapa("model", "game.progression.model", [], ["progression-model"], ["game.progression.model"]),
      etapa("curve", "game.progression.curve", ["model"], ["progression-curve"], ["game.progression.curve"]),
      etapa("exploit", "game.progression.exploit", ["curve"], ["progression-review"], ["game.progression.exploit.review"]),
    ],
    requiredEvidence: ["game.progression.model", "game.progression.curve", "game.progression.exploit.review"],
    useWhen: ["modelar desbloqueios", "revisar grind e pacing"],
    avoidWhen: ["jogo sem progressao persistente"],
  }),
  pipeline({
    pipelineId: "game.multiplayer",
    label: "Multiplayer",
    summary: "Planeja sessão, sincronização, conflito e reconexão com evidências observáveis.",
    kinds: ["GAME", "HYBRID"],
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: ["HUMAN", "SCRIPTED", "AI", "HYBRID"],
    fidelities: FIDELIDADES,
    capabilities: ["game.multiplayer.session", "game.multiplayer.sync", "game.multiplayer.recovery"],
    stages: [
      etapa("session", "game.multiplayer.session", [], ["session-model"], ["multiplayer.session"]),
      etapa("sync", "game.multiplayer.sync", ["session"], ["sync-report"], ["multiplayer.sync"]),
      etapa("conflict", "game.multiplayer.sync", ["sync"], ["conflict-report"], ["multiplayer.conflict"]),
      etapa("recovery", "game.multiplayer.recovery", ["conflict"], ["recovery-report"], ["multiplayer.reconnect"]),
    ],
    requiredEvidence: ["multiplayer.session", "multiplayer.sync", "multiplayer.conflict", "multiplayer.reconnect"],
    useWhen: ["implementar multiplayer", "validar sincronizacao e reconexao"],
    avoidWhen: ["experiencia exclusivamente single-player"],
  }),
  pipeline({
    pipelineId: "simulation.scenario",
    label: "Cenário de simulação",
    summary: "Declara modelo, condições iniciais, contorno e outputs de um cenário reproduzível.",
    kinds: ["SIMULATION", "HYBRID"],
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: FIDELIDADES,
    capabilities: ["simulation.model", "simulation.scenario.define", "simulation.outputs.observe"],
    stages: [
      etapa("model", "simulation.model", [], ["simulation-model"], ["simulation.model.valid"]),
      etapa("scenario", "simulation.scenario.define", ["model"], ["scenario-definition"], ["simulation.scenario.valid"]),
      etapa("outputs", "simulation.outputs.observe", ["scenario"], ["output-schema"], ["simulation.outputs.observable"]),
    ],
    requiredEvidence: ["simulation.model.valid", "simulation.scenario.valid", "simulation.outputs.observable"],
    useWhen: ["definir cenario", "separar modelo de condicoes iniciais"],
    avoidWhen: ["o objetivo e apenas um loop de jogo"],
  }),
  pipeline({
    pipelineId: "simulation.batch_run",
    label: "Lote de simulações",
    summary: "Planeja matriz de cenários, seeds e agregação sem executar o lote localmente.",
    kinds: ["SIMULATION", "HYBRID"],
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: ["SCRIPTED", "AI", "HYBRID", "AUTONOMOUS", "UNCONTROLLED"],
    fidelities: FIDELIDADES,
    capabilities: ["simulation.batch.plan", "simulation.batch.seed", "simulation.batch.aggregate"],
    stages: [
      etapa("matrix", "simulation.batch.plan", [], ["scenario-matrix"], ["simulation.batch.matrix"]),
      etapa("seeds", "simulation.batch.seed", ["matrix"], ["seed-set"], ["simulation.batch.seeds"]),
      etapa("aggregate", "simulation.batch.aggregate", ["seeds"], ["aggregate-plan"], ["simulation.batch.aggregate"]),
    ],
    requiredEvidence: ["simulation.batch.matrix", "simulation.batch.seeds", "simulation.batch.aggregate"],
    useWhen: ["rodar muitos cenarios", "comparar distribuicoes"],
    avoidWhen: ["uma unica execucao interativa humana"],
  }),
  pipeline({
    pipelineId: "simulation.calibrate",
    label: "Calibração de simulação",
    summary: "Liga dataset de referência, método, tolerâncias, incerteza e telemetria.",
    kinds: ["SIMULATION", "HYBRID"],
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: ["REALISTIC", "CALIBRATED"],
    capabilities: ["simulation.reference.bind", "simulation.calibrate", "simulation.uncertainty.measure", "simulation.telemetry.observe"],
    stages: [
      etapa("reference", "simulation.reference.bind", [], ["reference-binding"], ["simulation.reference.dataset"]),
      etapa("calibrate", "simulation.calibrate", ["reference"], ["calibration-report"], ["simulation.calibration"]),
      etapa("uncertainty", "simulation.uncertainty.measure", ["calibrate"], ["uncertainty-report"], ["simulation.tolerance", "simulation.uncertainty"]),
      etapa("telemetry", "simulation.telemetry.observe", ["uncertainty"], ["telemetry-schema"], ["simulation.telemetry"]),
    ],
    requiredEvidence: ["simulation.reference.dataset", "simulation.calibration", "simulation.tolerance", "simulation.uncertainty", "simulation.telemetry"],
    useWhen: ["alegar fidelidade calibrada", "comparar modelo com referencia"],
    avoidWhen: ["nao existe referencia rastreavel"],
  }),
  pipeline({
    pipelineId: "interactive.calibrate",
    label: "Calibração transversal",
    summary: "Liga qualquer sistema REALISTIC ou CALIBRATED a referência, tolerâncias, incerteza e telemetria.",
    kinds: KINDS,
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: ["REALISTIC", "CALIBRATED"],
    capabilities: ["simulation.reference.bind", "simulation.calibrate", "simulation.uncertainty.measure", "simulation.telemetry.observe"],
    stages: [
      etapa("reference", "simulation.reference.bind", [], ["reference-binding"], ["simulation.reference.dataset"]),
      etapa("calibrate", "simulation.calibrate", ["reference"], ["calibration-report"], ["simulation.calibration"]),
      etapa("uncertainty", "simulation.uncertainty.measure", ["calibrate"], ["uncertainty-report"], ["simulation.tolerance", "simulation.uncertainty"]),
      etapa("telemetry", "simulation.telemetry.observe", ["uncertainty"], ["telemetry-schema"], ["simulation.telemetry"]),
    ],
    requiredEvidence: ["simulation.reference.dataset", "simulation.calibration", "simulation.tolerance", "simulation.uncertainty", "simulation.telemetry"],
    useWhen: ["fidelity REALISTIC ou CALIBRATED em qualquer kind"],
    avoidWhen: ["realismo apenas visual com fidelity nao REALISTIC"],
  }),
  pipeline({
    pipelineId: "simulation.validate",
    label: "Validação de simulação",
    summary: "Valida invariantes, outputs e comparação com referência sem confundir aparência com validade.",
    kinds: ["SIMULATION", "HYBRID"],
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: CONTROLES,
    fidelities: FIDELIDADES,
    capabilities: ["simulation.invariants.validate", "simulation.outputs.compare", "simulation.validity.report"],
    stages: [
      etapa("invariants", "simulation.invariants.validate", [], ["invariant-report"], ["simulation.invariants"]),
      etapa("compare", "simulation.outputs.compare", ["invariants"], ["comparison-report"], ["simulation.output.comparison"]),
      etapa("report", "simulation.validity.report", ["compare"], ["validity-report"], ["simulation.validity.report"]),
    ],
    requiredEvidence: ["simulation.invariants", "simulation.output.comparison", "simulation.validity.report"],
    useWhen: ["validar modelo", "provar outputs dentro de tolerancias"],
    avoidWhen: ["nao existem outputs observaveis"],
  }),
  pipeline({
    pipelineId: "simulation.safety",
    label: "Segurança de simulação",
    summary: "Exige perigos, limites, parada e recuperação para sistemas autônomos ou emergentes.",
    kinds: ["SIMULATION", "HYBRID"],
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: ["AI", "HYBRID", "AUTONOMOUS", "UNCONTROLLED"],
    fidelities: FIDELIDADES,
    capabilities: ["simulation.hazard.model", "simulation.stop.validate", "simulation.recovery.plan"],
    stages: [
      etapa("hazards", "simulation.hazard.model", [], ["hazard-model"], ["simulation.hazards"]),
      etapa("stop", "simulation.stop.validate", ["hazards"], ["stop-policy"], ["simulation.stop.criteria"]),
      etapa("recovery", "simulation.recovery.plan", ["stop"], ["recovery-plan"], ["simulation.recovery.plan"]),
    ],
    requiredEvidence: ["simulation.hazards", "simulation.stop.criteria", "simulation.recovery.plan"],
    useWhen: ["simulacao autonoma", "comportamento emergente", "risco operacional"],
    avoidWhen: ["sistema passivo sem estado mutavel"],
  }),
  pipeline({
    pipelineId: "interactive.safety",
    label: "Segurança transversal",
    summary: "Exige perigos, parada e recuperação para qualquer sistema autônomo ou não controlado.",
    kinds: KINDS,
    spatialModels: MODELOS_ESPACIAIS,
    renderModes: MODOS_RENDER,
    visualProfiles: PERFIS_VISUAIS,
    controlModes: ["AUTONOMOUS", "UNCONTROLLED"],
    fidelities: FIDELIDADES,
    capabilities: ["simulation.hazard.model", "simulation.stop.validate", "simulation.recovery.plan"],
    stages: [
      etapa("hazards", "simulation.hazard.model", [], ["hazard-model"], ["simulation.hazards"]),
      etapa("stop", "simulation.stop.validate", ["hazards"], ["stop-policy"], ["simulation.stop.criteria"]),
      etapa("recovery", "simulation.recovery.plan", ["stop"], ["recovery-plan"], ["simulation.recovery.plan"]),
    ],
    requiredEvidence: ["simulation.hazards", "simulation.stop.criteria", "simulation.recovery.plan"],
    useWhen: ["jogo ou sistema autonomo", "comportamento nao controlado", "risco operacional"],
    avoidWhen: ["sistema sem AUTONOMOUS ou UNCONTROLLED"],
  }),
  ...CATALOGO_PIPELINES_INTERATIVOS_AVANCADOS,
]);

const PROTOCOLO_LEITURA = ["DETECT", "PROBE", "SNAPSHOT", "PLAN", "VALIDATE", "EVIDENCE"] as const;
const PROTOCOLO_MUTANTE = ["DETECT", "PROBE", "SNAPSHOT", "PLAN", "APPLY", "VALIDATE", "EVIDENCE", "ROLLBACK"] as const;

function adaptador(
  entrada: Omit<AdaptadorSistemaInterativo, "version" | "readOnlyProbe" | "supportsRollback" | "executionBoundary" | "protocol">,
): AdaptadorSistemaInterativo {
  return {
    version: "1.0.0",
    readOnlyProbe: true,
    supportsRollback: entrada.mutatesWorkspace,
    executionBoundary: "EXTERNAL",
    protocol: entrada.mutatesWorkspace ? PROTOCOLO_MUTANTE : PROTOCOLO_LEITURA,
    ...entrada,
  };
}

const BASE_ADAPTER = {
  kinds: KINDS,
  controlModes: CONTROLES,
  timeModels: TEMPOS,
  fidelities: FIDELIDADES,
} as const;

const CAPABILIDADES_PIPELINES = [...new Set(CATALOGO_PIPELINES_INTERATIVOS.flatMap((item) => item.capabilities))].sort();
const CAPABILIDADES_VALIDACAO = new Set([
  "interactive.compatibility.validate", "interactive.replay.compare", "game.balance.review",
  "game.progression.exploit", "game.multiplayer.sync", "simulation.invariants.validate",
  "simulation.outputs.compare", "simulation.stop.validate", "simulation.validity.report",
]);
const CAPABILIDADES_TELEMETRIA = new Set([
  "interactive.event.log", "interactive.failure.observe", "interactive.runtime.observe",
  "game.balance.measure", "simulation.batch.aggregate", "simulation.outputs.observe",
  "simulation.telemetry.observe", "simulation.uncertainty.measure",
]);
const CAPABILIDADES_EXECUCAO = CAPABILIDADES_PIPELINES.filter((item) => (
  !CAPABILIDADES_VALIDACAO.has(item) && !CAPABILIDADES_TELEMETRIA.has(item)
));
const CAPABILIDADES_RUNTIME = [
  "interactive.playtest.plan", "interactive.runtime.bind", "interactive.seed.bind",
  "interactive.smoke.observe", "interactive.snapshot.capture", "interactive.state.model",
  "interactive.world.model",
];
const CAPABILIDADES_PACOTE_ENGINE = [
  "interactive.build.plan", "interactive.launch.observe", "interactive.package.plan",
];
const CAPABILIDADES_GATES_TRANSVERSAIS = [
  "simulation.calibrate", "simulation.hazard.model", "simulation.recovery.plan", "simulation.reference.bind",
];
const CAPABILIDADES_GAME_ENGINE = [...new Set([
  ...CAPABILIDADES_RUNTIME,
  ...CAPABILIDADES_PACOTE_ENGINE,
  ...CAPABILIDADES_GATES_TRANSVERSAIS,
  ...CAPABILIDADES_EXECUCAO.filter((item) => item.startsWith("game.")),
])].sort();
const CAPABILIDADES_SIMULATION_RUNNER = [...new Set([
  ...CAPABILIDADES_RUNTIME,
  ...CAPABILIDADES_EXECUCAO.filter((item) => item.startsWith("simulation.")),
])].sort();
const CAPABILIDADES_ENGINE_COMPLETO = [...new Set([
  ...CAPABILIDADES_GAME_ENGINE,
  ...CAPABILIDADES_SIMULATION_RUNNER,
])].sort();

export const CATALOGO_ADAPTADORES_INTERATIVOS: readonly AdaptadorSistemaInterativo[] = congelarProfundo([
  adaptador({ ...BASE_ADAPTER, adapterId: "runtime.headless.generic", role: "RUNTIME", engine: "headless", spatialModels: MODELOS_ESPACIAIS, renderModes: ["HEADLESS"], visualProfiles: ["NONE"], capabilities: CAPABILIDADES_RUNTIME, mutatesWorkspace: false }),
  adaptador({ ...BASE_ADAPTER, adapterId: "runtime.text.generic", role: "RUNTIME", engine: "text", spatialModels: ["NON_SPATIAL"], renderModes: ["TEXT"], visualProfiles: ["NONE"], capabilities: CAPABILIDADES_RUNTIME, mutatesWorkspace: false }),
  adaptador({ ...BASE_ADAPTER, adapterId: "simulation.runner.generic", role: "RUNTIME", engine: "simulation-runner", kinds: ["SIMULATION", "HYBRID"], spatialModels: MODELOS_ESPACIAIS, renderModes: MODOS_RENDER, visualProfiles: PERFIS_VISUAIS, capabilities: CAPABILIDADES_SIMULATION_RUNNER, mutatesWorkspace: false }),
  adaptador({ ...BASE_ADAPTER, adapterId: "validator.replay.local", role: "VALIDATOR", engine: "custom", spatialModels: MODELOS_ESPACIAIS, renderModes: MODOS_RENDER, visualProfiles: PERFIS_VISUAIS, capabilities: [...CAPABILIDADES_VALIDACAO].sort(), mutatesWorkspace: false }),
  adaptador({ ...BASE_ADAPTER, adapterId: "telemetry.trace.local", role: "TELEMETRY", engine: "custom", spatialModels: MODELOS_ESPACIAIS, renderModes: MODOS_RENDER, visualProfiles: PERFIS_VISUAIS, capabilities: [...CAPABILIDADES_TELEMETRIA].sort(), mutatesWorkspace: false }),
  adaptador({ ...BASE_ADAPTER, adapterId: "engine.web.canvas2d", role: "ENGINE", engine: "web-canvas", spatialModels: ["TWO_D", "TWO_POINT_FIVE_D"], renderModes: ["VISUAL"], visualProfiles: ["PIXEL_8_BIT", "PIXEL_16_BIT", "RASTER", "VECTOR", "STYLIZED"], capabilities: CAPABILIDADES_GAME_ENGINE, mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "engine.web.webgl", role: "ENGINE", engine: "webgl", spatialModels: ["TWO_D", "TWO_POINT_FIVE_D", "THREE_D"], renderModes: ["VISUAL", "XR"], visualProfiles: ["RASTER", "VECTOR", "STYLIZED", "REALISTIC"], capabilities: CAPABILIDADES_GAME_ENGINE, mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "engine.love2d", role: "ENGINE", engine: "love2d", spatialModels: ["TWO_D"], renderModes: ["VISUAL"], visualProfiles: ["PIXEL_8_BIT", "PIXEL_16_BIT", "RASTER", "STYLIZED"], capabilities: CAPABILIDADES_GAME_ENGINE, mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "engine.pico8", role: "ENGINE", engine: "pico8", spatialModels: ["TWO_D"], renderModes: ["VISUAL"], visualProfiles: ["PIXEL_8_BIT"], capabilities: CAPABILIDADES_GAME_ENGINE, mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "engine.tic80", role: "ENGINE", engine: "tic80", spatialModels: ["TWO_D"], renderModes: ["VISUAL"], visualProfiles: ["PIXEL_8_BIT", "PIXEL_16_BIT"], capabilities: CAPABILIDADES_GAME_ENGINE, mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "engine.godot", role: "ENGINE", engine: "godot", spatialModels: ["TWO_D", "TWO_POINT_FIVE_D", "THREE_D"], renderModes: ["HEADLESS", "VISUAL", "XR"], visualProfiles: PERFIS_VISUAIS, capabilities: CAPABILIDADES_ENGINE_COMPLETO, mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "engine.unity", role: "ENGINE", engine: "unity", spatialModels: ["TWO_D", "TWO_POINT_FIVE_D", "THREE_D"], renderModes: ["HEADLESS", "VISUAL", "XR"], visualProfiles: PERFIS_VISUAIS, capabilities: CAPABILIDADES_ENGINE_COMPLETO, mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "engine.unreal", role: "ENGINE", engine: "unreal", spatialModels: ["TWO_D", "TWO_POINT_FIVE_D", "THREE_D"], renderModes: ["HEADLESS", "VISUAL", "XR"], visualProfiles: ["NONE", "RASTER", "STYLIZED", "REALISTIC"], capabilities: CAPABILIDADES_ENGINE_COMPLETO, mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "editor.generic.external", role: "EDITOR", engine: "custom", spatialModels: MODELOS_ESPACIAIS, renderModes: MODOS_RENDER, visualProfiles: PERFIS_VISUAIS, capabilities: ["interactive.editor.project", "interactive.runtime.bind", "interactive.state.model", "interactive.world.model"], mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "editor.blender", role: "EDITOR", engine: "blender", spatialModels: ["TWO_D", "TWO_POINT_FIVE_D", "THREE_D"], renderModes: ["HEADLESS", "VISUAL"], visualProfiles: PERFIS_VISUAIS, capabilities: ["interactive.asset.export", "interactive.asset.prepare", "interactive.scene.author"], mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "asset.pipeline.generic", role: "ASSET", engine: "custom", spatialModels: MODELOS_ESPACIAIS, renderModes: MODOS_RENDER, visualProfiles: PERFIS_VISUAIS, capabilities: ["interactive.asset.prepare"], mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "build.generic.external", role: "BUILD", engine: "custom", spatialModels: MODELOS_ESPACIAIS, renderModes: MODOS_RENDER, visualProfiles: PERFIS_VISUAIS, capabilities: ["interactive.build.plan", "interactive.launch.observe", "interactive.package.plan", "interactive.release.plan", "interactive.rollback.plan"], mutatesWorkspace: true }),
  adaptador({ ...BASE_ADAPTER, adapterId: "engine.custom", role: "CUSTOM", engine: "custom", spatialModels: MODELOS_ESPACIAIS, renderModes: MODOS_RENDER, visualProfiles: PERFIS_VISUAIS, capabilities: CAPABILIDADES_EXECUCAO, mutatesWorkspace: true }),
  ...CATALOGO_ADAPTADORES_INTERATIVOS_AVANCADOS,
]);

function derivarCatalogoCapabilities(): CapabilitySistemaInterativo[] {
  const kindsPorCapability = new Map<string, Set<KindSistemaInterativo>>();
  for (const pipelineItem of CATALOGO_PIPELINES_INTERATIVOS) {
    for (const capability of pipelineItem.capabilities) {
      const kinds = kindsPorCapability.get(capability) ?? new Set<KindSistemaInterativo>();
      pipelineItem.kinds.forEach((kind) => kinds.add(kind));
      kindsPorCapability.set(capability, kinds);
    }
  }
  for (const adapter of CATALOGO_ADAPTADORES_INTERATIVOS) {
    for (const capability of adapter.capabilities) {
      const kinds = kindsPorCapability.get(capability) ?? new Set<KindSistemaInterativo>();
      adapter.kinds.forEach((kind) => kinds.add(kind));
      kindsPorCapability.set(capability, kinds);
    }
  }
  return [...kindsPorCapability.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([capability, kinds]) => ({
    capability,
    label: capability.split(".").map((item) => item.replace(/_/g, " ")).join(" · "),
    summary: `Capability canônica declarada por pipeline ou adapter: ${capability}.`,
    kinds: KINDS.filter((kind) => kinds.has(kind)),
  }));
}

export const CATALOGO_CAPABILITIES_INTERATIVAS: readonly CapabilitySistemaInterativo[] = congelarProfundo(
  derivarCatalogoCapabilities(),
);

function copiarDescritor<T>(valor: T): T {
  if (Array.isArray(valor)) return valor.map((item) => copiarDescritor(item)) as T;
  if (typeof valor === "object" && valor !== null) {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([chave, item]) => (
      [chave, copiarDescritor(item)]
    ))) as T;
  }
  return valor;
}

export function obterPipelineSistemaInterativo(pipelineId: string): PipelineSistemaInterativo | undefined {
  const pipelineEncontrado = CATALOGO_PIPELINES_INTERATIVOS.find((item) => item.pipelineId === pipelineId);
  return pipelineEncontrado === undefined ? undefined : copiarDescritor(pipelineEncontrado);
}

export function obterAdaptadorSistemaInterativo(adapterId: string): AdaptadorSistemaInterativo | undefined {
  const adapterEncontrado = CATALOGO_ADAPTADORES_INTERATIVOS.find((item) => item.adapterId === adapterId);
  return adapterEncontrado === undefined ? undefined : copiarDescritor(adapterEncontrado);
}

export function listarAdaptadoresSistemasInterativos(
  filtros: FiltrosAdaptadoresSistemasInterativos = {},
): ResultadoListagemAdaptadoresSistemasInterativos {
  const adapters = CATALOGO_ADAPTADORES_INTERATIVOS.filter((adapter) => (
    (filtros.kind === undefined || adapter.kinds.includes(filtros.kind))
    && (filtros.spatialModel === undefined || adapter.spatialModels.includes(filtros.spatialModel))
    && (filtros.renderMode === undefined || adapter.renderModes.includes(filtros.renderMode))
    && (filtros.visualProfile === undefined || adapter.visualProfiles.includes(filtros.visualProfile))
    && (filtros.role === undefined || adapter.role === filtros.role)
    && (filtros.controlMode === undefined || adapter.controlModes.includes(filtros.controlMode))
    && (filtros.timeModel === undefined || adapter.timeModels.includes(filtros.timeModel))
    && (filtros.fidelity === undefined || adapter.fidelities.includes(filtros.fidelity))
  )).map((adapter) => copiarDescritor(adapter));
  return { adapters, filtrosAplicados: { ...filtros }, executed: false };
}

export const MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS = congelarProfundo({
  schemaVersion: "1.0",
  kinds: KINDS,
  spatialModels: MODELOS_ESPACIAIS,
  renderModes: MODOS_RENDER,
  visualProfiles: PERFIS_VISUAIS,
  controlModes: CONTROLES,
  timeModels: TEMPOS,
  determinisms: ["NONE", "BEST_EFFORT", "STOCHASTIC", "SEEDED", "STRICT"] as const,
  fidelities: FIDELIDADES,
  adapterRoles: ["ENGINE", "RUNTIME", "EDITOR", "ASSET", "BUILD", "TELEMETRY", "VALIDATOR", "CUSTOM"] as readonly PapelAdaptadorSistemaInterativo[],
});

export const SCHEMA_DEFINICAO_SISTEMA_INTERATIVO = congelarProfundo({
  schemaVersion: "sema.interativo.schema/v1",
  readOnly: true,
  definitionSchema: {
    schemaVersion: "1.0",
    requiredFields: [
      "schemaVersion", "systemId", "version", "kind", "spatialModel", "renderMode", "visualProfile",
      "fidelity", "controlModes", "timeModel", "determinism", "capabilities", "pipelines",
      "adapterTargets", "world", "acceptance",
    ],
    fields: {
      schemaVersion: { type: "string", const: "1.0" },
      systemId: { type: "string", format: "safe-opaque-id" },
      version: { type: "string", constraint: "fixed-not-floating" },
      kind: { type: "string", enum: KINDS },
      spatialModel: { type: "string", enum: MODELOS_ESPACIAIS },
      renderMode: { type: "string", enum: MODOS_RENDER },
      visualProfile: { type: "string", enum: PERFIS_VISUAIS },
      fidelity: { type: "string", enum: FIDELIDADES },
      controlModes: { type: "array", uniqueItems: true, minItems: 1, items: CONTROLES },
      timeModel: { type: "string", enum: TEMPOS },
      determinism: { type: "string", enum: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.determinisms },
      capabilities: { type: "array", uniqueItems: true, source: "sema interativo capabilities" },
      pipelines: { type: "array", uniqueItems: true, minItems: 1, source: "sema interativo pipelines" },
      adapterTargets: { type: "array", uniqueItems: true, source: "sema interativo adapters", emptyMeans: "blocked-plan-with-recommendations" },
      world: { type: "object" },
      budgets: { type: "object", optional: true },
      acceptance: { type: "object" },
    },
    constraints: [
      "renderMode HEADLESS ou TEXT exige visualProfile NONE",
      "renderMode VISUAL ou XR exige visualProfile diferente de NONE",
      "renderMode XR exige spatialModel THREE_D",
      "spatialModel THREE_D exige world.units, world.scale e world.coordinateSystem",
      "SIMULATION ou HYBRID exige world.model, assumptions, boundaryConditions, outputs e validation",
      "REALISTIC ou CALIBRATED exige acceptance.reference, calibration, tolerances, uncertainty, telemetry e pipeline calibrate compatível",
      "AUTONOMOUS ou UNCONTROLLED exige world.stopCriteria, safetyConstraints e pipeline safety compatível",
      "SEEDED ou STRICT exige world.seed, snapshot, replay, step e pipeline interactive.replay",
      "adapterTargets deve selecionar composição que cubra toda capability de stage",
    ],
  },
  matrix: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS,
  examplePaths: [
    "exemplos/sistemas-interativos/game-2d.json",
    "exemplos/sistemas-interativos/game-3d-human.json",
    "exemplos/sistemas-interativos/game-pixel-16-bit.json",
    "exemplos/sistemas-interativos/game-pixel-8-bit.json",
    "exemplos/sistemas-interativos/game-xr-human.json",
    "exemplos/sistemas-interativos/hybrid-2-5d.json",
    "exemplos/sistemas-interativos/simulation-2d-controlled.json",
    "exemplos/sistemas-interativos/simulation-3d-calibrated-autonomous.json",
    "exemplos/sistemas-interativos/simulation-headless-autonomous-batch.json",
    "exemplos/sistemas-interativos/simulation-pixel-16-bit.json",
    "exemplos/sistemas-interativos/simulation-text-controlled.json",
    "exemplos/sistemas-interativos/protocol-mutating-rollback-valid.json",
    "exemplos/sistemas-interativos/protocol-read-only-valid.json",
  ],
});
