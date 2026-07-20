// SEMA-GOVERNED: sema.produto.sistemas_interativos
// Descricao: validacao deterministica de definicoes sem executar engine, editor, runner ou adapter.

import { digestJsonSistemaInterativo } from "./canonical.js";
import {
  MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS,
  obterAdaptadorSistemaInterativo,
  obterPipelineSistemaInterativo,
} from "./catalog.js";
import type {
  DefinicaoSistemaInterativo,
  JsonObjetoSistemaInterativo,
  JsonValorSistemaInterativo,
  ResultadoValidacaoDefinicaoSistemaInterativo,
} from "./types.js";

const VERSOES_FLUTUANTES = new Set(["latest", "next", "dev", "main", "master", "*"]);
const VALOR_SENSIVEL = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/=-]+|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}/i;

function adicionar(bloqueios: string[], valor: string): void {
  if (!bloqueios.includes(valor)) bloqueios.push(valor);
}

function textoOpaco(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(valor);
}

function identificadorSeguro(valor: unknown): valor is string {
  return textoOpaco(valor)
    && valor.length <= 128
    && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(valor)
    && !VALOR_SENSIVEL.test(valor);
}

function objeto(valor: unknown): valor is JsonObjetoSistemaInterativo {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function valorDeclarado(valor: JsonValorSistemaInterativo | undefined): boolean {
  if (typeof valor === "string") return valor.trim().length > 0;
  if (Array.isArray(valor)) return valor.length > 0;
  if (objeto(valor)) return Object.keys(valor).length > 0;
  return valor !== undefined && valor !== null;
}

function campoDeclarado(alvo: JsonObjetoSistemaInterativo, campo: string): boolean {
  return valorDeclarado(alvo[campo]);
}

function inteiroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0;
}

function dimensaoPixelValida(valor: unknown): boolean {
  if (inteiroPositivo(valor)) return true;
  if (typeof valor === "string") {
    return /^[1-9]\d{0,4}x[1-9]\d{0,4}(?:\s+(?:and|to)\s+[1-9]\d{0,4}x[1-9]\d{0,4})?$/i.test(valor);
  }
  if (Array.isArray(valor)) return valor.length === 2 && valor.every(inteiroPositivo);
  if (objeto(valor)) return inteiroPositivo(valor.width) && inteiroPositivo(valor.height);
  return false;
}

function listaTextosUnicos(valor: unknown, permiteVazia = true): valor is readonly string[] {
  if (!Array.isArray(valor) || (!permiteVazia && valor.length === 0)) return false;
  if (!valor.every(textoOpaco)) return false;
  return new Set(valor).size === valor.length;
}

function slugCapability(valor: string): string {
  return valor.toLowerCase().replace(/two_point_five/g, "2_5").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function capabilitiesEstruturais(definicao: DefinicaoSistemaInterativo): string[] {
  const capabilities = ["interactive.world.model", "interactive.state.model"];
  const eixos: readonly [string, unknown, readonly string[]][] = [
    ["kind", definicao.kind, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.kinds],
    ["spatial", definicao.spatialModel, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.spatialModels],
    ["render", definicao.renderMode, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.renderModes],
    ["visual", definicao.visualProfile, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.visualProfiles],
    ["fidelity", definicao.fidelity, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.fidelities],
    ["time", definicao.timeModel, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.timeModels],
    ["determinism", definicao.determinism, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.determinisms],
  ];
  for (const [eixo, valor, permitidos] of eixos) {
    if (typeof valor === "string" && permitidos.includes(valor)) capabilities.push(`interactive.${eixo}.${slugCapability(valor)}`);
  }
  for (const modo of Array.isArray(definicao.controlModes) ? definicao.controlModes : []) {
    if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.controlModes.includes(modo)) continue;
    capabilities.push(`interactive.control.${slugCapability(modo)}`);
  }
  for (const pipelineId of Array.isArray(definicao.pipelines) ? definicao.pipelines : []) {
    const pipeline = obterPipelineSistemaInterativo(pipelineId);
    if (pipeline) capabilities.push(...pipeline.capabilities);
  }
  return [...new Set(capabilities)].sort();
}

function validarBase(definicao: DefinicaoSistemaInterativo, bloqueios: string[]): void {
  if (definicao.schemaVersion !== "1.0") adicionar(bloqueios, "schema_version_nao_suportada");
  if (!identificadorSeguro(definicao.systemId)) adicionar(bloqueios, "system_id_invalido");
  if (!textoOpaco(definicao.version) || VERSOES_FLUTUANTES.has(definicao.version.toLowerCase())) {
    adicionar(bloqueios, "version_nao_fixada");
  }
  if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.kinds.includes(definicao.kind)) adicionar(bloqueios, "kind_invalido");
  if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.spatialModels.includes(definicao.spatialModel)) adicionar(bloqueios, "spatial_model_invalido");
  if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.renderModes.includes(definicao.renderMode)) adicionar(bloqueios, "render_mode_invalido");
  if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.visualProfiles.includes(definicao.visualProfile)) adicionar(bloqueios, "visual_profile_invalido");
  if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.fidelities.includes(definicao.fidelity)) adicionar(bloqueios, "fidelity_invalida");
  if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.timeModels.includes(definicao.timeModel)) adicionar(bloqueios, "time_model_invalido");
  if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.determinisms.includes(definicao.determinism)) adicionar(bloqueios, "determinism_invalido");
  if (!listaTextosUnicos(definicao.controlModes, false)) adicionar(bloqueios, "control_modes_invalidos");
  else if (!definicao.controlModes.every((modo) => MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.controlModes.includes(modo))) {
    adicionar(bloqueios, "control_mode_fora_do_vocabulario");
  }
  if (!listaTextosUnicos(definicao.capabilities)) adicionar(bloqueios, "capabilities_invalidas");
  if (!listaTextosUnicos(definicao.pipelines, false)) adicionar(bloqueios, "pipelines_invalidos_ou_ausentes");
  if (!listaTextosUnicos(definicao.adapterTargets)) adicionar(bloqueios, "adapter_targets_invalidos");
  if (!objeto(definicao.world)) adicionar(bloqueios, "world_invalido");
  if (!objeto(definicao.acceptance)) adicionar(bloqueios, "acceptance_invalida");
  if (definicao.budgets !== undefined && !objeto(definicao.budgets)) adicionar(bloqueios, "budgets_invalidos");
}

function validarEixos(definicao: DefinicaoSistemaInterativo, bloqueios: string[]): void {
  const visual = definicao.visualProfile;
  if ((definicao.renderMode === "HEADLESS" || definicao.renderMode === "TEXT") && visual !== "NONE") {
    adicionar(bloqueios, "render_nao_visual_exige_visual_profile_none");
  }
  if ((definicao.renderMode === "VISUAL" || definicao.renderMode === "XR") && visual === "NONE") {
    adicionar(bloqueios, "render_visual_exige_visual_profile");
  }
  if (definicao.renderMode === "XR" && definicao.spatialModel !== "THREE_D") {
    adicionar(bloqueios, "render_xr_exige_spatial_model_three_d");
  }

  if (visual === "PIXEL_8_BIT" || visual === "PIXEL_16_BIT") {
    const budgets = definicao.budgets;
    if (!objeto(budgets)) {
      adicionar(bloqueios, "pixel_profile_exige_budgets");
      return;
    }
    for (const campo of ["paletteColors", "baseResolution", "tileSize", "spriteSize", "memoryBudgetBytes", "audioProfile"]) {
      if (!campoDeclarado(budgets, campo)) adicionar(bloqueios, `pixel_budget_ausente:${campo}`);
    }
    const paletteColors = budgets.paletteColors;
    if (typeof paletteColors !== "number" || !Number.isInteger(paletteColors) || paletteColors <= 0) {
      adicionar(bloqueios, "pixel_palette_invalida");
    } else if (visual === "PIXEL_8_BIT" && paletteColors > 256) {
      adicionar(bloqueios, "pixel_8_bit_palette_excede_256");
    } else if (visual === "PIXEL_16_BIT" && paletteColors > 65_536) {
      adicionar(bloqueios, "pixel_16_bit_palette_excede_65536");
    }
    if (!dimensaoPixelValida(budgets.baseResolution)) adicionar(bloqueios, "pixel_base_resolution_invalida");
    if (!dimensaoPixelValida(budgets.tileSize)) adicionar(bloqueios, "pixel_tile_size_invalido");
    if (!dimensaoPixelValida(budgets.spriteSize)) adicionar(bloqueios, "pixel_sprite_size_invalido");
    if (!inteiroPositivo(budgets.memoryBudgetBytes)) adicionar(bloqueios, "pixel_memory_budget_invalido");
    if (!textoOpaco(budgets.audioProfile)) adicionar(bloqueios, "pixel_audio_profile_invalido");
  }

  if (objeto(definicao.world) && definicao.spatialModel === "THREE_D") {
    for (const campo of ["units", "scale", "coordinateSystem"]) {
      if (!campoDeclarado(definicao.world, campo)) adicionar(bloqueios, `world_3d_ausente:${campo}`);
    }
  }
  if (objeto(definicao.world) && (definicao.spatialModel === "TWO_D" || definicao.spatialModel === "TWO_POINT_FIVE_D")) {
    if (!campoDeclarado(definicao.world, "grid") && !campoDeclarado(definicao.world, "coordinateSystem")) {
      adicionar(bloqueios, "world_2d_exige_grid_ou_coordinate_system");
    }
  }
}

function validarWorld(definicao: DefinicaoSistemaInterativo, bloqueios: string[]): void {
  if (!objeto(definicao.world)) return;
  for (const campo of ["identity", "state", "time", "events", "initialConditions"]) {
    if (!campoDeclarado(definicao.world, campo)) adicionar(bloqueios, `world_campo_ausente:${campo}`);
  }

  if (definicao.kind === "GAME" || definicao.kind === "HYBRID") {
    for (const campo of ["loop", "objective", "successConditions", "failureConditions", "rules"]) {
      if (!campoDeclarado(definicao.world, campo)) adicionar(bloqueios, `game_world_ausente:${campo}`);
    }
  }
  if (definicao.kind === "SIMULATION" || definicao.kind === "HYBRID") {
    for (const campo of ["model", "assumptions", "boundaryConditions", "outputs", "validation"]) {
      if (!campoDeclarado(definicao.world, campo)) adicionar(bloqueios, `simulation_world_ausente:${campo}`);
    }
  }
  if (definicao.determinism === "SEEDED" || definicao.determinism === "STRICT") {
    for (const campo of ["seed", "snapshot", "replay", "step"]) {
      if (!campoDeclarado(definicao.world, campo)) adicionar(bloqueios, `determinism_world_ausente:${campo}`);
    }
  }
  if (Array.isArray(definicao.controlModes) && definicao.controlModes.some((modo) => modo === "AUTONOMOUS" || modo === "UNCONTROLLED")) {
    for (const campo of ["stopCriteria", "safetyConstraints"]) {
      if (!campoDeclarado(definicao.world, campo)) adicionar(bloqueios, `autonomia_world_ausente:${campo}`);
    }
  }
}

function validarAceitacao(definicao: DefinicaoSistemaInterativo, bloqueios: string[]): void {
  if (!objeto(definicao.acceptance)) return;
  if (definicao.fidelity === "REALISTIC" || definicao.fidelity === "CALIBRATED") {
    for (const campo of ["reference", "calibration", "tolerances", "uncertainty", "telemetry"]) {
      if (!campoDeclarado(definicao.acceptance, campo)) adicionar(bloqueios, `realistic_acceptance_ausente:${campo}`);
    }
  }
}

function validarPipelinesEAdapters(definicao: DefinicaoSistemaInterativo, bloqueios: string[]): void {
  const pipelines = Array.isArray(definicao.pipelines) ? definicao.pipelines : [];
  for (const [indice, pipelineId] of pipelines.entries()) {
    const pipeline = obterPipelineSistemaInterativo(pipelineId);
    if (!pipeline) {
      adicionar(bloqueios, `pipeline_desconhecido_indice:${indice}`);
      continue;
    }
    if (!pipeline.kinds.includes(definicao.kind)) adicionar(bloqueios, `pipeline_kind_incompativel_indice:${indice}`);
    if (!pipeline.spatialModels.includes(definicao.spatialModel)) adicionar(bloqueios, `pipeline_spatial_model_incompativel_indice:${indice}`);
    if (!pipeline.renderModes.includes(definicao.renderMode)) adicionar(bloqueios, `pipeline_render_mode_incompativel_indice:${indice}`);
    if (!pipeline.visualProfiles.includes(definicao.visualProfile)) adicionar(bloqueios, `pipeline_visual_profile_incompativel_indice:${indice}`);
    const modos = Array.isArray(definicao.controlModes) ? definicao.controlModes : [];
    if (!modos.some((modo) => pipeline.controlModes.includes(modo))) adicionar(bloqueios, `pipeline_control_mode_incompativel_indice:${indice}`);
    if (!pipeline.fidelities.includes(definicao.fidelity)) adicionar(bloqueios, `pipeline_fidelity_incompativel_indice:${indice}`);
  }
  for (const [indice, adapterId] of (Array.isArray(definicao.adapterTargets) ? definicao.adapterTargets : []).entries()) {
    if (!obterAdaptadorSistemaInterativo(adapterId)) adicionar(bloqueios, `adapter_target_desconhecido_indice:${indice}`);
  }
  const exigeSafety = Array.isArray(definicao.controlModes)
    && definicao.controlModes.some((modo) => modo === "AUTONOMOUS" || modo === "UNCONTROLLED");
  const pipelinesSafety = definicao.kind === "GAME"
    ? ["interactive.safety"]
    : ["interactive.safety", "simulation.safety"];
  if (exigeSafety && !pipelinesSafety.some((pipelineId) => pipelines.includes(pipelineId))) {
    adicionar(bloqueios, "autonomia_exige_pipeline_safety_compativel");
  }
  const exigeCalibracao = definicao.fidelity === "REALISTIC" || definicao.fidelity === "CALIBRATED";
  const pipelinesCalibracao = definicao.kind === "GAME"
    ? ["interactive.calibrate"]
    : ["interactive.calibrate", "simulation.calibrate"];
  if (exigeCalibracao && !pipelinesCalibracao.some((pipelineId) => pipelines.includes(pipelineId))) {
    adicionar(bloqueios, "fidelity_exige_pipeline_calibrate_compativel");
  }
  if ((definicao.determinism === "SEEDED" || definicao.determinism === "STRICT")
    && !pipelines.includes("interactive.replay")) {
    adicionar(bloqueios, "determinism_exige_pipeline_interactive_replay");
  }
}

function validarCapabilitiesControle(definicao: DefinicaoSistemaInterativo, bloqueios: string[]): void {
  const declaradas = new Set(Array.isArray(definicao.capabilities) ? definicao.capabilities : []);
  for (const modo of Array.isArray(definicao.controlModes) ? definicao.controlModes : []) {
    if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.controlModes.includes(modo)) continue;
    const capability = `interactive.control.${slugCapability(modo)}`;
    if (!declaradas.has(capability)) adicionar(bloqueios, "capability_controle_ausente");
  }
}

export function validarDefinicaoSistemaInterativo(
  definicao: DefinicaoSistemaInterativo,
): ResultadoValidacaoDefinicaoSistemaInterativo {
  const bloqueios: string[] = [];
  let definitionDigest: string;
  try {
    definitionDigest = digestJsonSistemaInterativo(definicao);
  } catch {
    definitionDigest = digestJsonSistemaInterativo({ definicaoInvalida: true });
    adicionar(bloqueios, "definicao_nao_canonica");
  }

  const entrada = objeto(definicao) ? definicao : {} as DefinicaoSistemaInterativo;
  if (entrada !== definicao) adicionar(bloqueios, "definicao_invalida");
  validarBase(entrada, bloqueios);
  validarEixos(entrada, bloqueios);
  validarWorld(entrada, bloqueios);
  validarAceitacao(entrada, bloqueios);
  validarPipelinesEAdapters(entrada, bloqueios);
  validarCapabilitiesControle(entrada, bloqueios);

  return {
    valida: bloqueios.length === 0,
    definitionDigest,
    capabilitiesRequeridas: capabilitiesEstruturais(entrada),
    bloqueios: [...bloqueios].sort(),
  };
}
