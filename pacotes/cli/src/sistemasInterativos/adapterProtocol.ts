// SEMA-GOVERNED: sema.produto.sistemas_interativos.adaptadores
// Descricao: valida descriptors e registros detect-probe-snapshot-plan sem executar qualquer fase.

import { digestSha256Valido } from "./canonical.js";
import { MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS, obterAdaptadorSistemaInterativo } from "./catalog.js";
import type {
  AdaptadorSistemaInterativo,
  FaseProtocoloAdaptador,
  RegistroProtocoloAdapter,
  ResultadoValidacaoAdaptadorSistemaInterativo,
  ResultadoValidacaoProtocoloAdapter,
} from "./types.js";

const ORDEM_FASES: readonly FaseProtocoloAdaptador[] = [
  "DETECT", "PROBE", "SNAPSHOT", "PLAN", "APPLY", "VALIDATE", "EVIDENCE", "ROLLBACK",
];
const BASE_FASES: readonly FaseProtocoloAdaptador[] = [
  "DETECT", "PROBE", "SNAPSHOT", "PLAN", "VALIDATE", "EVIDENCE",
];
const VERSOES_FLUTUANTES = new Set(["latest", "next", "dev", "main", "master", "*"]);
const MARCADOR_CHAVE_SENSIVEL = /password|passwd|senha|secret|token|privatekey|apikey|credential|credencial|chaveprivada|chavesecreta/;
const VALOR_SENSIVEL = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/=-]+|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}/i;

function adicionar(bloqueios: string[], valor: string): void {
  if (!bloqueios.includes(valor)) bloqueios.push(valor);
}

function textoOpaco(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(valor);
}

function registroObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function listaUnicaNaoVazia(valor: unknown): valor is readonly string[] {
  return Array.isArray(valor)
    && valor.length > 0
    && valor.every(textoOpaco)
    && new Set(valor).size === valor.length;
}

function chaveSensivel(chave: string): boolean {
  const normalizada = chave
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]/giu, "")
    .toLowerCase();
  return MARCADOR_CHAVE_SENSIVEL.test(normalizada);
}

function contemDadoSensivel(valor: unknown, visitados = new Set<object>()): boolean {
  if (typeof valor === "string") return VALOR_SENSIVEL.test(valor);
  if (valor === null || typeof valor !== "object") return false;
  if (visitados.has(valor)) return true;
  visitados.add(valor);
  try {
    if (Array.isArray(valor)) return valor.some((item) => contemDadoSensivel(item, visitados));
    return Object.entries(valor).some(([chave, item]) => chaveSensivel(chave) || contemDadoSensivel(item, visitados));
  } finally {
    visitados.delete(valor);
  }
}

function fasesEmOrdem(protocol: readonly string[]): boolean {
  let ultima = -1;
  for (const fase of protocol) {
    const indice = ORDEM_FASES.indexOf(fase as FaseProtocoloAdaptador);
    if (indice < 0 || indice <= ultima) return false;
    ultima = indice;
  }
  return true;
}

export function validarAdaptadorSistemaInterativo(
  adapter: AdaptadorSistemaInterativo,
): ResultadoValidacaoAdaptadorSistemaInterativo {
  const bloqueios: string[] = [];
  const entrada = registroObjeto(adapter) ? adapter : {} as AdaptadorSistemaInterativo;
  if (entrada !== adapter) adicionar(bloqueios, "adapter_invalido");
  if (!textoOpaco(entrada.adapterId)) adicionar(bloqueios, "adapter_id_invalido");
  if (!textoOpaco(entrada.version) || VERSOES_FLUTUANTES.has(entrada.version.toLowerCase())) adicionar(bloqueios, "adapter_version_nao_fixada");
  if (!textoOpaco(entrada.engine)) adicionar(bloqueios, "adapter_engine_invalida");
  if (!MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.adapterRoles.includes(entrada.role)) adicionar(bloqueios, "adapter_role_invalido");
  if (entrada.readOnlyProbe !== true) adicionar(bloqueios, "adapter_probe_deve_ser_read_only");
  if (typeof entrada.mutatesWorkspace !== "boolean") adicionar(bloqueios, "adapter_mutates_workspace_deve_ser_booleano");
  if (typeof entrada.supportsRollback !== "boolean") adicionar(bloqueios, "adapter_supports_rollback_deve_ser_booleano");
  if (entrada.executionBoundary !== "EXTERNAL") adicionar(bloqueios, "adapter_execution_boundary_deve_ser_external");

  for (const [campo, lista] of [
    ["kinds", entrada.kinds],
    ["spatial_models", entrada.spatialModels],
    ["render_modes", entrada.renderModes],
    ["visual_profiles", entrada.visualProfiles],
    ["control_modes", entrada.controlModes],
    ["time_models", entrada.timeModels],
    ["fidelities", entrada.fidelities],
    ["capabilities", entrada.capabilities],
    ["protocol", entrada.protocol],
  ] as const) {
    if (!listaUnicaNaoVazia(lista)) adicionar(bloqueios, `adapter_${campo}_invalidos`);
  }

  const vocabularios: readonly [unknown, readonly string[], string][] = [
    [entrada.kinds, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.kinds, "adapter_kind_fora_do_vocabulario"],
    [entrada.spatialModels, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.spatialModels, "adapter_spatial_model_fora_do_vocabulario"],
    [entrada.renderModes, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.renderModes, "adapter_render_mode_fora_do_vocabulario"],
    [entrada.visualProfiles, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.visualProfiles, "adapter_visual_profile_fora_do_vocabulario"],
    [entrada.controlModes, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.controlModes, "adapter_control_mode_fora_do_vocabulario"],
    [entrada.timeModels, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.timeModels, "adapter_time_model_fora_do_vocabulario"],
    [entrada.fidelities, MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.fidelities, "adapter_fidelity_fora_do_vocabulario"],
  ];
  for (const [valores, permitidos, codigo] of vocabularios) {
    if (Array.isArray(valores) && !valores.every((valor) => typeof valor === "string" && permitidos.includes(valor))) {
      adicionar(bloqueios, codigo);
    }
  }

  if (Array.isArray(entrada.protocol)) {
    if (!fasesEmOrdem(entrada.protocol)) adicionar(bloqueios, "adapter_protocol_ordem_invalida");
    for (const fase of BASE_FASES) {
      if (!entrada.protocol.includes(fase)) adicionar(bloqueios, `adapter_protocol_fase_ausente:${fase}`);
    }
    if (entrada.mutatesWorkspace === true) {
      if (!entrada.protocol.includes("APPLY")) adicionar(bloqueios, "adapter_mutante_sem_apply");
      if (!entrada.protocol.includes("ROLLBACK")) adicionar(bloqueios, "adapter_mutante_sem_rollback");
      if (!entrada.supportsRollback) adicionar(bloqueios, "adapter_mutante_sem_suporte_rollback");
    } else {
      if (entrada.protocol.includes("APPLY")) adicionar(bloqueios, "adapter_read_only_nao_pode_declarar_apply");
      if (entrada.protocol.includes("ROLLBACK")) adicionar(bloqueios, "adapter_read_only_nao_pode_declarar_rollback");
      if (entrada.supportsRollback) adicionar(bloqueios, "adapter_read_only_nao_deve_declarar_rollback");
    }
  }
  if (contemDadoSensivel(entrada)) adicionar(bloqueios, "adapter_contem_dado_sensivel");
  return { valido: bloqueios.length === 0, bloqueios: bloqueios.sort() };
}

export function validarProtocoloAdapterSistemaInterativo(
  registro: RegistroProtocoloAdapter,
): ResultadoValidacaoProtocoloAdapter {
  const bloqueios: string[] = [];
  const entrada = registroObjeto(registro) ? registro : {} as RegistroProtocoloAdapter;
  if (entrada !== registro) adicionar(bloqueios, "registro_protocolo_invalido");
  if (!textoOpaco(entrada.runId)) adicionar(bloqueios, "run_id_invalido");
  if (!textoOpaco(entrada.adapterId)) adicionar(bloqueios, "adapter_id_invalido");
  if (!textoOpaco(entrada.adapterVersion) || VERSOES_FLUTUANTES.has(entrada.adapterVersion.toLowerCase())) adicionar(bloqueios, "adapter_version_invalida");
  if (!textoOpaco(entrada.semanticTargetId)) adicionar(bloqueios, "semantic_target_id_invalido");
  if (typeof entrada.mutated !== "boolean") adicionar(bloqueios, "mutated_deve_ser_booleano");
  if (typeof entrada.success !== "boolean") adicionar(bloqueios, "success_deve_ser_booleano");
  const phases = Array.isArray(entrada.phases) ? entrada.phases : [];
  if (phases.length === 0) adicionar(bloqueios, "phases_ausentes_ou_malformadas");
  const descriptor = textoOpaco(entrada.adapterId) ? obterAdaptadorSistemaInterativo(entrada.adapterId) : undefined;
  if (!descriptor) adicionar(bloqueios, "registro_adapter_desconhecido");
  else if (entrada.adapterVersion !== descriptor.version) adicionar(bloqueios, "registro_adapter_version_divergente");

  const ids = new Set<string>();
  const fases: FaseProtocoloAdaptador[] = [];
  for (const [indice, itemBruto] of phases.entries()) {
    if (!registroObjeto(itemBruto)) {
      adicionar(bloqueios, `phase_malformada_indice:${indice}`);
      continue;
    }
    const item = itemBruto as unknown as RegistroProtocoloAdapter["phases"][number];
    if (!textoOpaco(item.phaseId)) adicionar(bloqueios, "phase_id_invalido");
    else if (ids.has(item.phaseId)) adicionar(bloqueios, `phase_id_duplicado_indice:${indice}`);
    else ids.add(item.phaseId);
    if (!ORDEM_FASES.includes(item.phase)) adicionar(bloqueios, `phase_invalida_indice:${indice}`);
    else {
      fases.push(item.phase);
      if (descriptor && !descriptor.protocol.includes(item.phase)) {
        adicionar(bloqueios, `phase_nao_permitida_pelo_adapter_indice:${indice}`);
      }
    }
    if (item.semanticTargetId !== entrada.semanticTargetId) adicionar(bloqueios, `semantic_target_divergente_indice:${indice}`);
    if (!digestSha256Valido(item.inputDigest)) adicionar(bloqueios, `phase_input_digest_invalido_indice:${indice}`);
    if (!digestSha256Valido(item.outputDigest)) adicionar(bloqueios, `phase_output_digest_invalido_indice:${indice}`);
    if (typeof item.success !== "boolean") adicionar(bloqueios, `phase_success_deve_ser_booleano_indice:${indice}`);
  }
  if (fases[0] !== "DETECT") adicionar(bloqueios, "protocolo_deve_iniciar_em_detect");
  if (new Set(fases).size !== fases.length) adicionar(bloqueios, "phase_tipo_duplicado");
  if (!fasesEmOrdem(fases)) adicionar(bloqueios, "phases_fora_da_ordem_canonica");
  for (const fase of BASE_FASES) {
    if (!fases.includes(fase)) adicionar(bloqueios, `protocolo_fase_base_ausente:${fase}`);
  }
  if (descriptor && !descriptor.mutatesWorkspace && entrada.mutated === true) {
    adicionar(bloqueios, "adapter_read_only_nao_pode_mutar");
  }
  if (entrada.mutated === false && (fases.includes("APPLY") || fases.includes("ROLLBACK"))) {
    adicionar(bloqueios, "registro_nao_mutante_com_fase_mutante");
  }

  const faseSucesso = (fase: FaseProtocoloAdaptador): boolean => phases.some((item) => (
    registroObjeto(item) && item.phase === fase && item.success === true
  ));
  const exigeRollback = entrada.mutated === true && entrada.success === false && !faseSucesso("ROLLBACK");
  if (entrada.mutated === true && !faseSucesso("APPLY")) adicionar(bloqueios, "mutated_sem_apply_bem_sucedido");
  if (entrada.success === true) {
    if (!faseSucesso("VALIDATE")) adicionar(bloqueios, "sucesso_sem_validate");
    if (!faseSucesso("EVIDENCE")) adicionar(bloqueios, "sucesso_sem_evidence");
    if (phases.some((item) => !registroObjeto(item) || item.success !== true)) adicionar(bloqueios, "sucesso_global_com_fase_falha");
  }
  if (exigeRollback) adicionar(bloqueios, "falha_mutante_exige_rollback");
  if (entrada.mutated === true && entrada.success === false && faseSucesso("ROLLBACK") && !textoOpaco(entrada.rollbackEvidenceId)) {
    adicionar(bloqueios, "rollback_sem_evidence_id");
  }
  if (contemDadoSensivel(entrada)) adicionar(bloqueios, "registro_contem_dado_sensivel");

  return {
    valido: bloqueios.length === 0,
    faseAtual: fases.at(-1) ?? "NOT_STARTED",
    bloqueios: bloqueios.sort(),
    exigeRollback,
  };
}
