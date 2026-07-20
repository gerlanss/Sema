// SEMA-GOVERNED: sema.produto.sistemas_interativos.control_run
// Descricao: valida a cadeia content-addressed definicao -> plano -> pipeline -> schemas -> evidencia -> resultado.

import { SUPERFICIES_CLI_PIPELINES_AVANCADOS } from "../discovery/catalog.js";
import {
  validarCicloReparoAutonomo,
  validarModeloAutoridadeMultiplayer,
  validarPlanoPlaytestFuzz,
} from "./autonomy.js";
import { digestJsonSistemaInterativo, digestSha256Valido } from "./canonical.js";
import { obterPipelineSistemaInterativo } from "./catalog.js";
import { validarExperienceIr } from "./experienceIr.js";
import { SCHEMA_EXTENSOES_CLI_INTERATIVAS } from "./extensionCommand.js";
import {
  planejarOrquestracaoJobs,
  validarAcceptanceLock,
  validarEstadoEditor,
  validarEvidenciaMultimodal,
  validarProvenienciaAsset,
  validarSnapshotEngine,
} from "./operations.js";
import { planejarSistemaInterativo } from "./planner.js";
import { analisarPlanoPortabilidadeInterativa, validarPlanoWorkersDistribuidos } from "./portability.js";
import { validarBundleVerificacaoTemporal, validarContratoTemporalInterativo } from "./temporal.js";
import type { DefinicaoSistemaInterativo, PlanoSistemaInterativo } from "./types.js";
import { validarDefinicaoSistemaInterativo } from "./validator.js";

export const CONTROL_RUN_SCHEMA_VERSION = "sema.interactive.control-run/v1" as const;

export interface ManifestoControlRunInterativo {
  readonly schemaVersion: typeof CONTROL_RUN_SCHEMA_VERSION;
  readonly runId: string;
  readonly systemId: string;
  readonly pipelineId: string;
  readonly validatorCommand: string;
  readonly definitionDigest: string;
  readonly planDigest: string;
  readonly pipelineContractDigest: string;
  readonly validationContractDigest: string;
  readonly producerId: string;
  readonly producerVersion: string;
  readonly producerConfigurationDigest: string;
  readonly verifierId: string;
  readonly verifierVersion: string;
  readonly verifierConfigurationDigest: string;
  readonly inputSchemaKeys: readonly string[];
  readonly inputDigests: readonly string[];
  readonly evidenceDigest: string;
  readonly resultDigest: string;
}

export interface ArtefatosControlRunInterativo {
  readonly definicao: unknown;
  readonly plano: unknown;
  readonly contrato: unknown;
  readonly entradas: readonly unknown[];
  readonly evidencia: unknown;
  readonly resultado: unknown;
}

export interface BindingControlRunInterativo {
  readonly kind: "DEFINITION" | "PLAN" | "PIPELINE_CONTRACT" | "VALIDATION_CONTRACT" | "INPUT" | "EVIDENCE" | "RESULT";
  readonly id: string;
  readonly digest: string;
  readonly matched: boolean;
}

export interface ResultadoControlRunInterativo {
  readonly valid: boolean;
  readonly controlRunDigest: string;
  readonly definitionDigest: string;
  readonly planDigest: string;
  readonly pipelineContractDigest: string;
  readonly validationContractDigest: string;
  readonly inputDigests: readonly string[];
  readonly evidenceDigest: string;
  readonly resultDigest: string;
  readonly bindings: readonly BindingControlRunInterativo[];
  readonly issues: readonly string[];
  readonly completed: false;
  readonly localCoverageComplete: boolean;
  readonly awaitingExternalAttestation: true;
  readonly executed: false;
  readonly workspaceMutated: false;
  readonly authoritative: false;
}

type Registro = Record<string, unknown>;

interface CommandSchemaDescriptor {
  readonly inputSchemaKeys: readonly string[];
}

interface DataSchemaShape {
  readonly schemaVersion: string;
  readonly requiredTopLevelFields: readonly string[];
}

const MANIFEST_KEYS = new Set([
  "schemaVersion", "runId", "systemId", "pipelineId", "validatorCommand",
  "definitionDigest", "planDigest", "pipelineContractDigest", "validationContractDigest",
  "producerId", "producerVersion", "producerConfigurationDigest",
  "verifierId", "verifierVersion", "verifierConfigurationDigest",
  "inputSchemaKeys", "inputDigests", "evidenceDigest", "resultDigest",
]);
const ID_SEGURO = /^[a-z0-9][a-z0-9._:/-]{0,127}$/u;
const CHAVE_SENSIVEL = /(?:password|passwd|senha|secret|token|api.?key|private.?key|credential|authorization|cookie)/iu;
const VALOR_SENSIVEL = /(?:\bBearer\s+[A-Za-z0-9._~+/-]{8,}|\b(?:sk|pk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|[?&](?:access_token|token|api_?key|signature|x-amz-signature)=)/iu;
const REFERENCIA_OPACA = /^(?:sha256:|opaque:sha256:)[a-f0-9]{64}$/u;
const EVIDENCE_INPUT_INDEX: Readonly<Record<string, number>> = Object.freeze({
  "validar-evidencia-temporal": 1,
  "validar-multimodal": 0,
});
const GENERIC_EVIDENCE_KEYS = new Set([
  "schemaVersion", "evidenceId", "runId", "systemId", "definitionDigest", "planDigest",
  "validationContractDigest", "inputDigests", "producerId", "producerVersion",
  "producerConfigurationDigest", "verifierId", "verifierVersion", "verifierConfigurationDigest",
]);

function registro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor.length <= 256;
}

function idSeguro(valor: unknown): valor is string {
  return typeof valor === "string" && ID_SEGURO.test(valor);
}

function adicionar(issues: string[], condicao: boolean, codigo: string): void {
  if (!condicao) issues.push(codigo);
}

function digestSeguro(valor: unknown, issues: string[], codigo: string): string {
  try {
    const serializado = JSON.stringify(valor);
    if (typeof serializado !== "string") throw new TypeError("json_nao_serializavel");
    return digestJsonSistemaInterativo(JSON.parse(serializado) as unknown);
  } catch {
    issues.push(codigo);
    return digestJsonSistemaInterativo({ invalidCanonicalInput: true, code: codigo });
  }
}

function contemMaterialSensivel(valor: unknown): boolean {
  const fila: Array<{ valor: unknown; profundidade: number }> = [{ valor, profundidade: 0 }];
  let visitados = 0;
  while (fila.length > 0) {
    const atual = fila.shift()!;
    visitados += 1;
    if (visitados > 20_000 || atual.profundidade > 64) return true;
    if (typeof atual.valor === "string" && VALOR_SENSIVEL.test(atual.valor)) return true;
    if (Array.isArray(atual.valor)) {
      for (const item of atual.valor) fila.push({ valor: item, profundidade: atual.profundidade + 1 });
      continue;
    }
    if (!registro(atual.valor)) continue;
    for (const [chave, item] of Object.entries(atual.valor)) {
      if (CHAVE_SENSIVEL.test(chave) && !(typeof item === "string" && REFERENCIA_OPACA.test(item))) return true;
      fila.push({ valor: item, profundidade: atual.profundidade + 1 });
    }
  }
  return false;
}

function arraysIguais(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, indice) => item === b[indice]);
}

function stringsUnicas(valor: unknown): valor is readonly string[] {
  return Array.isArray(valor)
    && valor.length > 0
    && valor.every((item) => typeof item === "string" && item.length > 0)
    && new Set(valor).size === valor.length;
}

function comandoDaSuperficie(template: string): string | undefined {
  const partes = template.trim().split(/\s+/u);
  return partes[0] === "sema" && partes[1] === "interativo" ? partes[2] : undefined;
}

function identidade(valor: Registro, papel: "producer" | "verifier", campo: "Id" | "Version" | "ConfigurationDigest"): unknown {
  const direto = valor[`${papel}${campo}`];
  if (direto !== undefined) return direto;
  const aninhado = valor[papel];
  if (!registro(aninhado)) return undefined;
  const candidatos = campo === "Id"
    ? ["id", `${papel}Id`, `${papel}IdDigest`]
    : campo === "Version"
      ? ["version", `${papel}Version`]
      : ["configurationDigest", `${papel}ConfigurationDigest`];
  return candidatos.map((chave) => aninhado[chave]).find((item) => item !== undefined);
}

function validarIdentidades(
  valor: unknown,
  manifesto: ManifestoControlRunInterativo,
  issues: string[],
  prefixo: string,
): void {
  if (!registro(valor)) {
    issues.push(`${prefixo}_nao_objeto`);
    return;
  }
  adicionar(issues, identidade(valor, "producer", "Id") === manifesto.producerId, `${prefixo}_producer_id_divergente`);
  adicionar(issues, identidade(valor, "producer", "Version") === manifesto.producerVersion, `${prefixo}_producer_version_divergente`);
  adicionar(issues, identidade(valor, "producer", "ConfigurationDigest") === manifesto.producerConfigurationDigest, `${prefixo}_producer_configuration_digest_divergente`);
  adicionar(issues, identidade(valor, "verifier", "Id") === manifesto.verifierId, `${prefixo}_verifier_id_divergente`);
  adicionar(issues, identidade(valor, "verifier", "Version") === manifesto.verifierVersion, `${prefixo}_verifier_version_divergente`);
  adicionar(issues, identidade(valor, "verifier", "ConfigurationDigest") === manifesto.verifierConfigurationDigest, `${prefixo}_verifier_configuration_digest_divergente`);
}

function reexecutarValidadorLocal(comando: string, entradas: readonly unknown[]): unknown {
  switch (comando) {
    case "validar-ir": return validarExperienceIr(entradas[0]);
    case "validar-engine-snapshot": return validarSnapshotEngine(entradas[0]);
    case "validar-asset-provenance": return validarProvenienciaAsset(entradas[0]);
    case "validar-editor-state": return validarEstadoEditor(entradas[0]);
    case "planejar-jobs": return planejarOrquestracaoJobs(entradas[0]);
    case "validar-acceptance": return validarAcceptanceLock(entradas[0]);
    case "validar-multimodal": return validarEvidenciaMultimodal(entradas[0]);
    case "validar-temporal": return validarContratoTemporalInterativo(entradas[0]);
    case "validar-evidencia-temporal": return validarBundleVerificacaoTemporal(entradas[0], entradas[1]);
    case "validar-autonomia": return validarCicloReparoAutonomo(entradas[0]);
    case "validar-playtest-fuzz": return validarPlanoPlaytestFuzz(entradas[0]);
    case "validar-multiplayer": return validarModeloAutoridadeMultiplayer(entradas[0]);
    case "analisar-portabilidade": return analisarPlanoPortabilidadeInterativa(entradas[0]);
    case "validar-workers": return validarPlanoWorkersDistribuidos(entradas[0]);
    default: return undefined;
  }
}

function validarVinculosContextuais(
  valor: unknown,
  manifesto: ManifestoControlRunInterativo,
  issues: string[],
  prefixo: string,
): void {
  if (!registro(valor)) return;
  if (valor.systemId !== undefined) adicionar(issues, valor.systemId === manifesto.systemId, `${prefixo}_system_id_divergente`);
  if (valor.runId !== undefined) adicionar(issues, valor.runId === manifesto.runId, `${prefixo}_run_id_divergente`);
  if (valor.definitionDigest !== undefined) adicionar(issues, valor.definitionDigest === manifesto.definitionDigest, `${prefixo}_definition_digest_divergente`);
  if (valor.planDigest !== undefined) adicionar(issues, valor.planDigest === manifesto.planDigest, `${prefixo}_plan_digest_divergente`);
}

function validarEnvelopeEvidenciaGenerico(
  valor: unknown,
  manifesto: ManifestoControlRunInterativo,
  inputDigests: readonly string[],
  validationContractDigest: string,
  issues: string[],
): void {
  if (!registro(valor)) {
    issues.push("evidencia_generica_nao_objeto");
    return;
  }
  adicionar(issues, Object.keys(valor).every((chave) => GENERIC_EVIDENCE_KEYS.has(chave)), "evidencia_generica_campo_desconhecido");
  adicionar(issues, valor.schemaVersion === "sema.interactive.control-evidence/v1", "evidencia_generica_schema_version_invalida");
  adicionar(issues, idSeguro(valor.evidenceId), "evidencia_generica_id_invalido");
  adicionar(issues, valor.runId === manifesto.runId, "evidencia_generica_run_id_divergente");
  adicionar(issues, valor.systemId === manifesto.systemId, "evidencia_generica_system_id_divergente");
  adicionar(issues, valor.definitionDigest === manifesto.definitionDigest, "evidencia_generica_definition_digest_divergente");
  adicionar(issues, valor.planDigest === manifesto.planDigest, "evidencia_generica_plan_digest_divergente");
  adicionar(issues, valor.validationContractDigest === validationContractDigest, "evidencia_generica_contract_digest_divergente");
  adicionar(issues, Array.isArray(valor.inputDigests) && arraysIguais(valor.inputDigests as string[], inputDigests), "evidencia_generica_input_digests_divergentes");
}

function validarEntradaContraShape(
  entrada: unknown,
  schemaKey: string,
  shapes: Readonly<Record<string, DataSchemaShape>>,
  issues: string[],
  indice: number,
): void {
  const shape = shapes[schemaKey];
  if (!shape) {
    issues.push(`input_schema_key_desconhecida:${indice}`);
    return;
  }
  if (!registro(entrada)) {
    issues.push(`input_nao_objeto:${indice}`);
    return;
  }
  adicionar(issues, entrada.schemaVersion === shape.schemaVersion, `input_schema_version_divergente:${indice}`);
  for (const campo of shape.requiredTopLevelFields) {
    adicionar(issues, Object.hasOwn(entrada, campo), `input_campo_obrigatorio_ausente:${indice}:${campo}`);
  }
}

function resultadoValido(
  valor: unknown,
  manifesto: ManifestoControlRunInterativo,
  inputDigests: readonly string[],
  evidenceDigest: string,
  validationContractDigest: string,
  resultadoRecalculado: unknown,
  issues: string[],
): void {
  if (!registro(valor)) {
    issues.push("resultado_nao_objeto");
    return;
  }
  adicionar(issues, valor.sucesso === true, "resultado_sem_sucesso");
  adicionar(issues, valor.comando === manifesto.validatorCommand, "resultado_comando_divergente");
  adicionar(issues, valor.readOnly === true, "resultado_nao_read_only");
  adicionar(issues, valor.executed === false, "resultado_executed_divergente");
  adicionar(issues, valor.workspaceMutated === false, "resultado_workspace_mutated_divergente");
  adicionar(issues, valor.authoritative === false, "resultado_authoritative_divergente");
  adicionar(issues, valor.externalExecutionRequired === true, "resultado_boundary_externa_ausente");
  adicionar(issues, registro(valor.resultado), "resultado_payload_ausente");
  const payload = registro(valor.resultado) ? valor.resultado : {};
  adicionar(issues, payload.valid === true || payload.valido === true, "resultado_payload_nao_valido");
  if (payload.valid !== undefined) adicionar(issues, payload.valid === true, "resultado_valid_false");
  if (payload.valido !== undefined) adicionar(issues, payload.valido === true, "resultado_valido_false");
  if (payload.completed !== undefined) adicionar(issues, payload.completed === false, "resultado_completed_true");
  if (payload.definitionDigest !== undefined) adicionar(issues, payload.definitionDigest === manifesto.definitionDigest, "resultado_definition_digest_divergente");
  if (payload.contractDigest !== undefined) adicionar(issues, payload.contractDigest === validationContractDigest, "resultado_contract_digest_divergente");
  if (payload.bundleDigest !== undefined) adicionar(issues, payload.bundleDigest === evidenceDigest || inputDigests.includes(payload.bundleDigest as string), "resultado_bundle_digest_divergente");
  adicionar(issues, resultadoRecalculado !== undefined, "validator_local_nao_suportado");
  if (resultadoRecalculado !== undefined) {
    const digestRecalculado = digestSeguro(resultadoRecalculado, issues, "resultado_recalculado_nao_canonicalizavel");
    const digestPayload = digestSeguro(payload, issues, "resultado_payload_nao_canonicalizavel");
    adicionar(issues, digestRecalculado === digestPayload, "resultado_diverge_do_validator_local");
  }
  validarVinculosContextuais(payload, manifesto, issues, "resultado");
}

export function validarControlRunInterativo(
  manifestoEntrada: unknown,
  artefatos: ArtefatosControlRunInterativo,
): ResultadoControlRunInterativo {
  const issues: string[] = [];
  const manifestoValido = registro(manifestoEntrada);
  if (!manifestoValido) issues.push("manifesto_invalido");
  const manifesto = (manifestoValido ? manifestoEntrada : {}) as unknown as ManifestoControlRunInterativo;
  if (manifestoValido) {
    for (const chave of Object.keys(manifestoEntrada)) {
      if (!MANIFEST_KEYS.has(chave)) issues.push("manifesto_campo_desconhecido");
    }
  }
  adicionar(issues, manifesto.schemaVersion === CONTROL_RUN_SCHEMA_VERSION, "manifesto_schema_version_nao_suportada");
  adicionar(issues, idSeguro(manifesto.runId), "manifesto_run_id_invalido");
  adicionar(issues, idSeguro(manifesto.systemId), "manifesto_system_id_invalido");
  adicionar(issues, idSeguro(manifesto.pipelineId), "manifesto_pipeline_id_invalido");
  adicionar(issues, idSeguro(manifesto.validatorCommand), "manifesto_validator_command_invalido");
  adicionar(issues, idSeguro(manifesto.producerId), "manifesto_producer_id_invalido");
  adicionar(issues, texto(manifesto.producerVersion), "manifesto_producer_version_invalida");
  adicionar(issues, digestSha256Valido(manifesto.producerConfigurationDigest), "manifesto_producer_configuration_digest_invalido");
  adicionar(issues, idSeguro(manifesto.verifierId), "manifesto_verifier_id_invalido");
  adicionar(issues, texto(manifesto.verifierVersion), "manifesto_verifier_version_invalida");
  adicionar(issues, digestSha256Valido(manifesto.verifierConfigurationDigest), "manifesto_verifier_configuration_digest_invalido");
  adicionar(issues, manifesto.producerId !== manifesto.verifierId, "manifesto_produtor_verificador_devem_ser_distintos");
  for (const [campo, digest] of [
    ["definition", manifesto.definitionDigest], ["plan", manifesto.planDigest],
    ["pipeline_contract", manifesto.pipelineContractDigest], ["validation_contract", manifesto.validationContractDigest],
    ["evidence", manifesto.evidenceDigest],
    ["result", manifesto.resultDigest],
  ] as const) adicionar(issues, digestSha256Valido(digest), `manifesto_${campo}_digest_invalido`);
  adicionar(issues, stringsUnicas(manifesto.inputSchemaKeys), "manifesto_input_schema_keys_invalidas");
  adicionar(issues, Array.isArray(manifesto.inputDigests) && manifesto.inputDigests.length > 0
    && manifesto.inputDigests.every(digestSha256Valido), "manifesto_input_digests_invalidos");
  adicionar(issues, Array.isArray(manifesto.inputSchemaKeys) && Array.isArray(manifesto.inputDigests)
    && manifesto.inputSchemaKeys.length === manifesto.inputDigests.length, "manifesto_input_bindings_divergentes");

  const definitionDigest = digestSeguro(artefatos.definicao, issues, "definicao_nao_canonicalizavel");
  let planDigest = digestSeguro(artefatos.plano, issues, "plano_nao_canonicalizavel");
  let planoCanonico: PlanoSistemaInterativo | undefined;
  if (registro(artefatos.definicao)) {
    const definicao = artefatos.definicao as unknown as DefinicaoSistemaInterativo;
    const validacao = validarDefinicaoSistemaInterativo(definicao);
    adicionar(issues, validacao.valida, "definicao_invalida");
    adicionar(issues, validacao.definitionDigest === definitionDigest, "definicao_digest_interno_divergente");
    adicionar(issues, definicao.systemId === manifesto.systemId, "definicao_system_id_divergente");
    adicionar(issues, Array.isArray(definicao.pipelines) && definicao.pipelines.includes(manifesto.pipelineId), "definicao_pipeline_ausente");
    if (validacao.valida) {
      const planejamento = planejarSistemaInterativo(definicao);
      adicionar(issues, planejamento.bloqueios.length === 0, "plano_canonico_bloqueado");
      planoCanonico = planejamento.plano;
    }
  } else {
    issues.push("definicao_nao_objeto");
  }
  adicionar(issues, definitionDigest === manifesto.definitionDigest, "manifesto_definition_digest_divergente");

  if (registro(artefatos.plano)) {
    const digestDeclarado = artefatos.plano.planDigest;
    const { planDigest: _removido, ...semDigest } = artefatos.plano;
    planDigest = digestSeguro(semDigest, issues, "plano_conteudo_nao_canonicalizavel");
    adicionar(issues, digestDeclarado === planDigest, "plano_digest_proprio_divergente");
    adicionar(issues, artefatos.plano.definitionDigest === manifesto.definitionDigest, "plano_definition_digest_divergente");
    adicionar(issues, artefatos.plano.systemId === manifesto.systemId, "plano_system_id_divergente");
    const pipelines = Array.isArray(artefatos.plano.pipelines) ? artefatos.plano.pipelines : [];
    adicionar(issues, pipelines.some((item) => registro(item) && item.pipelineId === manifesto.pipelineId), "plano_pipeline_ausente");
  } else {
    issues.push("plano_nao_objeto");
  }
  adicionar(issues, planDigest === manifesto.planDigest, "manifesto_plan_digest_divergente");
  if (planoCanonico) {
    adicionar(issues, planoCanonico.planDigest === manifesto.planDigest, "plano_recalculado_digest_divergente");
    adicionar(issues, planoCanonico.definitionDigest === manifesto.definitionDigest, "plano_recalculado_definition_digest_divergente");
  }

  const pipeline = obterPipelineSistemaInterativo(manifesto.pipelineId);
  adicionar(issues, pipeline !== undefined, "pipeline_desconhecido");
  const pipelineContractDigest = digestSeguro(pipeline ?? { pipeline: "unknown" }, issues, "pipeline_nao_canonicalizavel");
  adicionar(issues, pipelineContractDigest === manifesto.pipelineContractDigest, "manifesto_pipeline_contract_digest_divergente");
  const validationContractDigest = digestSeguro(artefatos.contrato, issues, "contrato_validacao_nao_canonicalizavel");
  adicionar(issues, validationContractDigest === manifesto.validationContractDigest, "manifesto_validation_contract_digest_divergente");
  const superficie = SUPERFICIES_CLI_PIPELINES_AVANCADOS[manifesto.pipelineId];
  adicionar(issues, superficie !== undefined, "pipeline_sem_superficie_cli_especifica");
  const comandoEsperado = superficie ? comandoDaSuperficie(superficie.command) : undefined;
  adicionar(issues, comandoEsperado === manifesto.validatorCommand, "manifesto_validator_command_divergente");

  const commands = SCHEMA_EXTENSOES_CLI_INTERATIVAS.commands as unknown as Readonly<Record<string, CommandSchemaDescriptor>>;
  const shapes = SCHEMA_EXTENSOES_CLI_INTERATIVAS.dataSchemaShapes as unknown as Readonly<Record<string, DataSchemaShape>>;
  const commandDescriptor = commands[manifesto.validatorCommand];
  adicionar(issues, commandDescriptor !== undefined, "validator_command_sem_schema");
  if (commandDescriptor && Array.isArray(manifesto.inputSchemaKeys)) {
    adicionar(issues, arraysIguais(manifesto.inputSchemaKeys, commandDescriptor.inputSchemaKeys), "manifesto_input_schema_keys_divergentes");
  }
  const entradas = Array.isArray(artefatos.entradas) ? artefatos.entradas : [];
  adicionar(issues, entradas.length > 0, "entradas_ausentes");
  adicionar(issues, entradas.length === (manifesto.inputSchemaKeys?.length ?? -1), "entradas_quantidade_divergente");
  const inputDigests = entradas.map((entrada, indice) => {
    const digest = digestSeguro(entrada, issues, `input_nao_canonicalizavel:${indice}`);
    const schemaKey = manifesto.inputSchemaKeys?.[indice];
    if (schemaKey) validarEntradaContraShape(entrada, schemaKey, shapes, issues, indice);
    adicionar(issues, digest === manifesto.inputDigests?.[indice], `input_digest_divergente:${indice}`);
    validarVinculosContextuais(entrada, manifesto, issues, `input:${indice}`);
    return digest;
  });

  const evidenceDigest = digestSeguro(artefatos.evidencia, issues, "evidencia_nao_canonicalizavel");
  adicionar(issues, evidenceDigest === manifesto.evidenceDigest, "manifesto_evidence_digest_divergente");
  validarIdentidades(artefatos.evidencia, manifesto, issues, "evidencia");
  const evidenceInputIndex = EVIDENCE_INPUT_INDEX[manifesto.validatorCommand];
  if (evidenceInputIndex !== undefined) {
    adicionar(issues, evidenceDigest === inputDigests[evidenceInputIndex], "evidencia_nao_corresponde_ao_input_evidencial");
    validarIdentidades(entradas[evidenceInputIndex], manifesto, issues, "input_evidencial");
  } else {
    validarEnvelopeEvidenciaGenerico(artefatos.evidencia, manifesto, inputDigests, validationContractDigest, issues);
  }
  if (manifesto.validatorCommand !== "validar-multimodal") {
    adicionar(issues, validationContractDigest === inputDigests[0], "contrato_validacao_nao_corresponde_ao_input");
  }
  if (registro(artefatos.evidencia) && artefatos.evidencia.contractDigest !== undefined) {
    adicionar(issues, artefatos.evidencia.contractDigest === validationContractDigest, "evidencia_contract_digest_divergente");
  }
  validarVinculosContextuais(artefatos.evidencia, manifesto, issues, "evidencia");

  const resultDigest = digestSeguro(artefatos.resultado, issues, "resultado_nao_canonicalizavel");
  adicionar(issues, resultDigest === manifesto.resultDigest, "manifesto_result_digest_divergente");
  let resultadoRecalculado: unknown;
  try {
    resultadoRecalculado = reexecutarValidadorLocal(manifesto.validatorCommand, entradas);
  } catch {
    issues.push("validator_local_falhou");
  }
  resultadoValido(
    artefatos.resultado,
    manifesto,
    inputDigests,
    evidenceDigest,
    validationContractDigest,
    resultadoRecalculado,
    issues,
  );
  if (contemMaterialSensivel({ manifesto: manifestoEntrada, artefatos })) issues.push("control_run_contem_material_sensivel");

  const bindings: BindingControlRunInterativo[] = [
    { kind: "DEFINITION", id: manifesto.systemId ?? "invalid", digest: definitionDigest, matched: definitionDigest === manifesto.definitionDigest },
    { kind: "PLAN", id: manifesto.systemId ?? "invalid", digest: planDigest, matched: planDigest === manifesto.planDigest },
    { kind: "PIPELINE_CONTRACT", id: manifesto.pipelineId ?? "invalid", digest: pipelineContractDigest, matched: pipelineContractDigest === manifesto.pipelineContractDigest },
    { kind: "VALIDATION_CONTRACT", id: manifesto.validatorCommand ?? "invalid", digest: validationContractDigest, matched: validationContractDigest === manifesto.validationContractDigest },
    ...inputDigests.map((digest, indice): BindingControlRunInterativo => ({
      kind: "INPUT", id: manifesto.inputSchemaKeys?.[indice] ?? `input:${indice}`, digest,
      matched: digest === manifesto.inputDigests?.[indice],
    })),
    { kind: "EVIDENCE", id: manifesto.runId ?? "invalid", digest: evidenceDigest, matched: evidenceDigest === manifesto.evidenceDigest },
    { kind: "RESULT", id: manifesto.validatorCommand ?? "invalid", digest: resultDigest, matched: resultDigest === manifesto.resultDigest },
  ];
  const issuesUnicos = [...new Set(issues)].sort();
  const controlRunDigest = digestSeguro({
    manifesto: manifestoEntrada,
    artifacts: { definitionDigest, planDigest, pipelineContractDigest, validationContractDigest, inputDigests, evidenceDigest, resultDigest },
  }, issuesUnicos, "control_run_nao_canonicalizavel");
  const valid = issuesUnicos.length === 0 && bindings.every((binding) => binding.matched);
  return {
    valid,
    controlRunDigest,
    definitionDigest,
    planDigest,
    pipelineContractDigest,
    validationContractDigest,
    inputDigests,
    evidenceDigest,
    resultDigest,
    bindings,
    issues: issuesUnicos,
    completed: false,
    localCoverageComplete: valid,
    awaitingExternalAttestation: true,
    executed: false,
    workspaceMutated: false,
    authoritative: false,
  };
}
