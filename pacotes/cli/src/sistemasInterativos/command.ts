// SEMA-GOVERNED: sema.produto.sistemas_interativos.cli
// Descricao: handler local read-only para catalogar, validar, planejar e verificar evidencias.

import { readFile } from "node:fs/promises";
import { validarProtocoloAdapterSistemaInterativo } from "./adapterProtocol.js";
import {
  CATALOGO_ADAPTADORES_INTERATIVOS,
  CATALOGO_CAPABILITIES_INTERATIVAS,
  CATALOGO_PIPELINES_INTERATIVOS,
  MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS,
  SCHEMA_DEFINICAO_SISTEMA_INTERATIVO,
  listarAdaptadoresSistemasInterativos,
} from "./catalog.js";
import { derivarEstadoSistemaInterativo, validarBundleEvidenciasSistemaInterativo } from "./evidence.js";
import {
  CONTROL_RUN_SCHEMA_VERSION,
  validarControlRunInterativo,
} from "./controlRun.js";
import {
  SCHEMA_EXTENSOES_CLI_INTERATIVAS,
  executarExtensaoCliInterativa,
} from "./extensionCommand.js";
import { planejarSistemaInterativo } from "./planner.js";
import { renderizarResultadoSistemasInterativos } from "./render.js";
import type {
  BundleEvidenciasSistemaInterativo,
  DefinicaoSistemaInterativo,
  FiltrosAdaptadoresSistemasInterativos,
  PlanoSistemaInterativo,
  RegistroProtocoloAdapter,
} from "./types.js";
import { validarDefinicaoSistemaInterativo } from "./validator.js";

interface ResultadoComandoSistemasInterativos {
  readonly exitCode: number;
  readonly payload: Record<string, unknown>;
}

type SubcomandoInterativo =
  | "capabilities"
  | "schema"
  | "pipelines"
  | "adapters"
  | "validar"
  | "planejar"
  | "validar-evidencias"
  | "status"
  | "validar-protocolo"
  | "validar-control-run";

interface EspecificacaoArgumentos {
  readonly opcoes: Readonly<Record<string, string>>;
  readonly flags: readonly string[];
  readonly posicionais: number;
}

interface ArgumentosValidos {
  readonly subcomando: SubcomandoInterativo;
  readonly posicionais: readonly string[];
  readonly opcoes: Readonly<Record<string, string>>;
}

type ResultadoParseArgumentos =
  | { readonly valido: true; readonly argumentos: ArgumentosValidos }
  | { readonly valido: false; readonly subcomando: string; readonly errorCode: string };

const ALIASES_SUBCOMANDO: Readonly<Record<string, SubcomandoInterativo>> = Object.freeze({
  capabilities: "capabilities",
  capacidades: "capabilities",
  schema: "schema",
  esquema: "schema",
  pipelines: "pipelines",
  adapters: "adapters",
  adaptadores: "adapters",
  validar: "validar",
  planejar: "planejar",
  "validar-evidencias": "validar-evidencias",
  status: "status",
  "validar-protocolo": "validar-protocolo",
  "validar-control-run": "validar-control-run",
});

const FILTROS_PIPELINE = Object.freeze({
  "--kind": "kind",
  "--spatial-model": "spatialModel",
  "--render-mode": "renderMode",
  "--visual-profile": "visualProfile",
  "--control-mode": "controlMode",
  "--fidelity": "fidelity",
});

const ESPECIFICACOES: Readonly<Record<SubcomandoInterativo, EspecificacaoArgumentos>> = Object.freeze({
  capabilities: { opcoes: {}, flags: ["--json"], posicionais: 0 },
  schema: { opcoes: {}, flags: ["--json"], posicionais: 0 },
  pipelines: { opcoes: FILTROS_PIPELINE, flags: ["--json"], posicionais: 0 },
  adapters: {
    opcoes: {
      ...FILTROS_PIPELINE,
      "--role": "role",
      "--time-model": "timeModel",
    },
    flags: ["--json"],
    posicionais: 0,
  },
  validar: { opcoes: {}, flags: ["--json"], posicionais: 1 },
  planejar: { opcoes: {}, flags: ["--json"], posicionais: 1 },
  "validar-evidencias": {
    opcoes: {
      "--plano-arquivo": "planFile",
      "--bundle-arquivo": "bundleFile",
      "--evidencias-arquivo": "bundleFile",
    },
    flags: ["--json"],
    posicionais: 1,
  },
  status: {
    opcoes: {
      "--plano-arquivo": "planFile",
      "--bundle-arquivo": "bundleFile",
      "--evidencias-arquivo": "bundleFile",
    },
    flags: ["--json"],
    posicionais: 1,
  },
  "validar-protocolo": { opcoes: {}, flags: ["--json"], posicionais: 1 },
  "validar-control-run": {
    opcoes: {
      "--definition-arquivo": "definitionFile",
      "--plano-arquivo": "planFile",
      "--contrato-arquivo": "contractFile",
      "--entrada-arquivo": "inputFile",
      "--entrada-auxiliar-arquivo": "secondaryInputFile",
      "--evidencia-arquivo": "evidenceFile",
      "--resultado-arquivo": "resultFile",
    },
    flags: ["--json"],
    posicionais: 1,
  },
});

const VOCABULARIOS_FILTRO: Readonly<Record<string, readonly string[]>> = Object.freeze({
  kind: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.kinds,
  spatialModel: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.spatialModels,
  renderMode: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.renderModes,
  visualProfile: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.visualProfiles,
  controlMode: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.controlModes,
  fidelity: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.fidelities,
  role: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.adapterRoles,
  timeModel: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS.timeModels,
});

function parsearArgumentos(args: readonly string[]): ResultadoParseArgumentos {
  const primeiro = args[0];
  const usaPadrao = primeiro === undefined || primeiro.startsWith("--");
  const nomeBruto = usaPadrao ? "capabilities" : primeiro.toLowerCase().replace(/_/g, "-");
  const subcomando = ALIASES_SUBCOMANDO[nomeBruto];
  if (!subcomando) return { valido: false, subcomando: "desconhecido", errorCode: "INTERATIVO_SUBCOMANDO_DESCONHECIDO" };

  const especificacao = ESPECIFICACOES[subcomando];
  const tokens = usaPadrao ? args : args.slice(1);
  const posicionais: string[] = [];
  const opcoes: Record<string, string> = {};
  const flags = new Set<string>();

  for (let indice = 0; indice < tokens.length; indice += 1) {
    const token = tokens[indice];
    if (!token.startsWith("--")) {
      posicionais.push(token);
      continue;
    }
    if (especificacao.flags.includes(token)) {
      if (flags.has(token)) return { valido: false, subcomando, errorCode: "INTERATIVO_ARGUMENTOS_INVALIDOS" };
      flags.add(token);
      continue;
    }
    const chave = especificacao.opcoes[token];
    if (!chave || opcoes[chave] !== undefined) {
      return { valido: false, subcomando, errorCode: "INTERATIVO_ARGUMENTOS_INVALIDOS" };
    }
    const valor = tokens[indice + 1];
    if (valor === undefined || valor.startsWith("--")) {
      return { valido: false, subcomando, errorCode: "INTERATIVO_ARGUMENTOS_INVALIDOS" };
    }
    opcoes[chave] = valor;
    indice += 1;
  }

  if (posicionais.length !== especificacao.posicionais) {
    return { valido: false, subcomando, errorCode: "INTERATIVO_ARGUMENTOS_INVALIDOS" };
  }
  for (const [chave, valor] of Object.entries(opcoes)) {
    const vocabulario = VOCABULARIOS_FILTRO[chave];
    if (vocabulario && !vocabulario.includes(valor)) {
      return { valido: false, subcomando, errorCode: "INTERATIVO_FILTRO_INVALIDO" };
    }
  }
  if ((subcomando === "validar-evidencias" || subcomando === "status") && !opcoes.bundleFile) {
    return { valido: false, subcomando, errorCode: "INTERATIVO_ARGUMENTOS_INVALIDOS" };
  }
  if (subcomando === "validar-control-run" && [
    "definitionFile", "planFile", "contractFile", "inputFile", "evidenceFile", "resultFile",
  ].some((chave) => opcoes[chave] === undefined)) {
    return { valido: false, subcomando, errorCode: "INTERATIVO_ARGUMENTOS_INVALIDOS" };
  }
  return { valido: true, argumentos: { subcomando, posicionais, opcoes } };
}

async function lerJson<T>(arquivo: string): Promise<T> {
  return JSON.parse(await readFile(arquivo, "utf8")) as T;
}

function basePayload(comando: string, sucesso: boolean): Record<string, unknown> {
  return {
    sucesso,
    comando,
    readOnly: true,
    executed: false,
    workspaceMutated: false,
    authoritative: false,
    externalExecutionRequired: true,
  };
}

function erro(comando: string, errorCode: string): ResultadoComandoSistemasInterativos {
  return { exitCode: 1, payload: { ...basePayload(comando, false), errorCode } };
}

function filtrosAdapters(opcoes: Readonly<Record<string, string>>): FiltrosAdaptadoresSistemasInterativos {
  return {
    kind: opcoes.kind as FiltrosAdaptadoresSistemasInterativos["kind"],
    spatialModel: opcoes.spatialModel as FiltrosAdaptadoresSistemasInterativos["spatialModel"],
    renderMode: opcoes.renderMode as FiltrosAdaptadoresSistemasInterativos["renderMode"],
    visualProfile: opcoes.visualProfile as FiltrosAdaptadoresSistemasInterativos["visualProfile"],
    role: opcoes.role as FiltrosAdaptadoresSistemasInterativos["role"],
    controlMode: opcoes.controlMode as FiltrosAdaptadoresSistemasInterativos["controlMode"],
    timeModel: opcoes.timeModel as FiltrosAdaptadoresSistemasInterativos["timeModel"],
    fidelity: opcoes.fidelity as FiltrosAdaptadoresSistemasInterativos["fidelity"],
  };
}

function limparIndefinidos<T extends Record<string, unknown>>(entrada: T): T {
  return Object.fromEntries(Object.entries(entrada).filter(([, valor]) => valor !== undefined)) as T;
}

export async function executarComandoSistemasInterativos(
  args: readonly string[],
): Promise<ResultadoComandoSistemasInterativos> {
  const extensao = await executarExtensaoCliInterativa(args);
  if (extensao !== null) return extensao;
  const parse = parsearArgumentos(args);
  if (!parse.valido) return erro(parse.subcomando, parse.errorCode);
  const { subcomando, posicionais, opcoes } = parse.argumentos;

  try {
    if (subcomando === "capabilities") {
      return {
        exitCode: 0,
        payload: {
          ...basePayload("capabilities", true),
          matrix: MATRIZ_DOMINIO_SISTEMAS_INTERATIVOS,
          capabilities: CATALOGO_CAPABILITIES_INTERATIVAS,
          pipelineIds: CATALOGO_PIPELINES_INTERATIVOS.map((item) => item.pipelineId),
          adapterIds: CATALOGO_ADAPTADORES_INTERATIVOS.map((item) => item.adapterId),
          extensionCommands: Object.keys(SCHEMA_EXTENSOES_CLI_INTERATIVAS.commands),
          extensionSchemaVersion: SCHEMA_EXTENSOES_CLI_INTERATIVAS.schemaVersion,
          runner: "external",
        },
      };
    }
    if (subcomando === "schema") {
      return {
        exitCode: 0,
        payload: {
          ...basePayload("schema", true),
          ...SCHEMA_DEFINICAO_SISTEMA_INTERATIVO,
          interactiveExtensions: SCHEMA_EXTENSOES_CLI_INTERATIVAS,
          controlRun: {
            schemaVersion: CONTROL_RUN_SCHEMA_VERSION,
            command: "sema interativo validar-control-run <control-run.json> --definition-arquivo <definition.json> --plano-arquivo <plan.json> --contrato-arquivo <validation-contract.json> --entrada-arquivo <input.json> [--entrada-auxiliar-arquivo <supporting-input.json>] --evidencia-arquivo <evidence.json> --resultado-arquivo <result.json> --json",
            requiredTopLevelFields: [
              "schemaVersion", "runId", "systemId", "pipelineId", "validatorCommand",
              "definitionDigest", "planDigest", "pipelineContractDigest", "validationContractDigest",
              "producerId", "producerVersion", "producerConfigurationDigest",
              "verifierId", "verifierVersion", "verifierConfigurationDigest",
              "inputSchemaKeys", "inputDigests", "evidenceDigest", "resultDigest",
            ],
            readOnly: true,
            executed: false,
            authoritative: false,
          },
        },
      };
    }
    if (subcomando === "pipelines") {
      const pipelines = CATALOGO_PIPELINES_INTERATIVOS.filter((item) => (
        (opcoes.kind === undefined || item.kinds.includes(opcoes.kind as never))
        && (opcoes.spatialModel === undefined || item.spatialModels.includes(opcoes.spatialModel as never))
        && (opcoes.renderMode === undefined || item.renderModes.includes(opcoes.renderMode as never))
        && (opcoes.visualProfile === undefined || item.visualProfiles.includes(opcoes.visualProfile as never))
        && (opcoes.controlMode === undefined || item.controlModes.includes(opcoes.controlMode as never))
        && (opcoes.fidelity === undefined || item.fidelities.includes(opcoes.fidelity as never))
      ));
      return { exitCode: 0, payload: { ...basePayload("pipelines", true), pipelines } };
    }
    if (subcomando === "adapters") {
      const filtros = limparIndefinidos(filtrosAdapters(opcoes) as Record<string, unknown>) as FiltrosAdaptadoresSistemasInterativos;
      const resultado = listarAdaptadoresSistemasInterativos(filtros);
      return { exitCode: 0, payload: { ...basePayload("adapters", true), ...resultado } };
    }
    if (subcomando === "validar") {
      const definicao = await lerJson<DefinicaoSistemaInterativo>(posicionais[0]);
      const resultado = validarDefinicaoSistemaInterativo(definicao);
      return { exitCode: resultado.valida ? 0 : 1, payload: { ...basePayload("validar", resultado.valida), ...resultado } };
    }
    if (subcomando === "planejar") {
      const definicao = await lerJson<DefinicaoSistemaInterativo>(posicionais[0]);
      const resultado = planejarSistemaInterativo(definicao);
      const sucesso = resultado.bloqueios.length === 0;
      return { exitCode: sucesso ? 0 : 1, payload: { ...basePayload("planejar", sucesso), ...resultado } };
    }
    if (subcomando === "validar-evidencias" || subcomando === "status") {
      const definicao = await lerJson<DefinicaoSistemaInterativo>(posicionais[0]);
      const [plano, bundle] = await Promise.all([
        opcoes.planFile === undefined
          ? Promise.resolve(planejarSistemaInterativo(definicao).plano)
          : lerJson<PlanoSistemaInterativo>(opcoes.planFile),
        lerJson<BundleEvidenciasSistemaInterativo>(opcoes.bundleFile),
      ]);
      if (subcomando === "validar-evidencias") {
        const resultado = validarBundleEvidenciasSistemaInterativo(definicao, plano, bundle);
        return { exitCode: resultado.valido ? 0 : 1, payload: { ...basePayload("validar-evidencias", resultado.valido), ...resultado } };
      }
      const estado = derivarEstadoSistemaInterativo(definicao, plano, bundle);
      const sucesso = estado.bloqueios.length === 0;
      return { exitCode: sucesso ? 0 : 1, payload: { ...basePayload("status", sucesso), estado } };
    }
    if (subcomando === "validar-control-run") {
      const [manifesto, definicao, plano, contrato, entrada, entradaAuxiliar, evidencia, resultado] = await Promise.all([
        lerJson<unknown>(posicionais[0]),
        lerJson<unknown>(opcoes.definitionFile),
        lerJson<unknown>(opcoes.planFile),
        lerJson<unknown>(opcoes.contractFile),
        lerJson<unknown>(opcoes.inputFile),
        opcoes.secondaryInputFile === undefined ? Promise.resolve(undefined) : lerJson<unknown>(opcoes.secondaryInputFile),
        lerJson<unknown>(opcoes.evidenceFile),
        lerJson<unknown>(opcoes.resultFile),
      ]);
      const controlRun = validarControlRunInterativo(manifesto, {
        definicao,
        plano,
        contrato,
        entradas: entradaAuxiliar === undefined ? [entrada] : [entrada, entradaAuxiliar],
        evidencia,
        resultado,
      });
      return {
        exitCode: controlRun.valid ? 0 : 1,
        payload: { ...basePayload("validar-control-run", controlRun.valid), resultado: controlRun },
      };
    }
    const registro = await lerJson<RegistroProtocoloAdapter>(posicionais[0]);
    const resultado = validarProtocoloAdapterSistemaInterativo(registro);
    return { exitCode: resultado.valido ? 0 : 1, payload: { ...basePayload("validar-protocolo", resultado.valido), ...resultado } };
  } catch {
    return erro(subcomando, "INTERATIVO_ENTRADA_INVALIDA");
  }
}

export async function comandoSistemasInterativos(
  _posicionaisGlobais: string[],
  args: string[],
  emJson: boolean,
): Promise<number> {
  const resultado = await executarComandoSistemasInterativos(args);
  const saidaJson = emJson || args.includes("--json");
  if (saidaJson) console.log(JSON.stringify(resultado.payload, null, 2));
  else if (resultado.exitCode === 0) console.log(renderizarResultadoSistemasInterativos(resultado.payload));
  else console.error(renderizarResultadoSistemasInterativos(resultado.payload));
  return resultado.exitCode;
}
