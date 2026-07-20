// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: handler da CLI de descoberta; consulta, renderiza e nunca executa templates.

import {
  montarCatalogoCapacidades,
  normalizarDiscoveryKind,
  obterEntradaDescoberta,
} from "./catalog.js";
import { recomendarCapacidadePorIntencao } from "./ranker.js";
import { renderizarResultadoDescoberta } from "./render.js";
import {
  DISCOVERY_SCHEMA_VERSION,
  type DiscoveryCommandResult,
  type DiscoveryErrorPayload,
  type DiscoveryExplainPayload,
  type DiscoveryPayload,
} from "./types.js";

const EXECUTION_BOUNDARY = {
  executed: false,
  workspaceMutated: false,
  externalCalls: false,
  requiresExplicitRun: true,
} as const;

const OPCOES_COM_VALOR = new Set([
  "--tipo",
  "--id",
  "--dominio",
  "--intencao",
  "--limite",
]);

interface PoliticaArgumentosDescoberta {
  readonly opcoesComValor: ReadonlySet<string>;
  readonly flags: ReadonlySet<string>;
  readonly maxPosicionais: number;
}

function argumentosValidos(
  args: readonly string[],
  politica: PoliticaArgumentosDescoberta,
): boolean {
  const vistos = new Set<string>();
  let posicionais = 0;
  for (let indice = 0; indice < args.length; indice += 1) {
    const atual = args[indice]!;
    if (!atual.startsWith("--")) {
      posicionais += 1;
      if (posicionais > politica.maxPosicionais) return false;
      continue;
    }
    if (vistos.has(atual)) return false;
    vistos.add(atual);
    if (politica.flags.has(atual)) continue;
    if (!politica.opcoesComValor.has(atual)) return false;
    const valor = args[indice + 1];
    if (!valor || valor.startsWith("--")) return false;
    indice += 1;
  }
  return true;
}

function politicaParaOperacao(operacao: string): PoliticaArgumentosDescoberta | null {
  const flags = new Set(["--json"]);
  if (operacao === "catalogo") {
    return { opcoesComValor: new Set(["--tipo", "--id", "--dominio"]), flags, maxPosicionais: 0 };
  }
  if (operacao === "recomendar") {
    return { opcoesComValor: new Set(["--intencao", "--limite"]), flags, maxPosicionais: 0 };
  }
  if (operacao === "explicar" || operacao === "pipeline descrever") {
    return { opcoesComValor: new Set(["--id"]), flags, maxPosicionais: 1 };
  }
  if (operacao === "pipeline listar") {
    return { opcoesComValor: new Set(), flags, maxPosicionais: 0 };
  }
  return null;
}

function normalizarSubcomando(valor: string | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[_-]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function obterOpcao(args: readonly string[], nome: string): string | null {
  const indice = args.indexOf(nome);
  if (indice < 0) return null;
  const valor = args[indice + 1];
  return valor && !valor.startsWith("--") ? valor : null;
}

function obterPosicionais(args: readonly string[]): string[] {
  const posicionais: string[] = [];
  for (let indice = 0; indice < args.length; indice += 1) {
    const atual = args[indice]!;
    if (OPCOES_COM_VALOR.has(atual)) {
      indice += 1;
      continue;
    }
    if (atual.startsWith("--")) continue;
    posicionais.push(atual);
  }
  return posicionais;
}

function erro(code: string, message: string, emJson: boolean): DiscoveryCommandResult {
  const payload: DiscoveryErrorPayload = {
    schemaVersion: DISCOVERY_SCHEMA_VERSION,
    command: "descobrir",
    success: false,
    mode: "error",
    ...EXECUTION_BOUNDARY,
    error: { code, message },
  };
  return {
    exitCode: 2,
    payload,
    text: renderizarResultadoDescoberta(payload),
    outputFormat: emJson ? "json" : "text",
    executed: false,
  };
}

function sucesso(payload: DiscoveryPayload, emJson: boolean): DiscoveryCommandResult {
  return {
    exitCode: 0,
    payload,
    text: renderizarResultadoDescoberta(payload),
    outputFormat: emJson ? "json" : "text",
    executed: false,
  };
}

function explicar(id: string | null, somentePipeline: boolean, emJson: boolean): DiscoveryCommandResult {
  if (!id) return erro("DISCOVERY_ID_OBRIGATORIO", "Informe um id de capacidade explícito.", emJson);
  const entry = obterEntradaDescoberta(id);
  if (!entry || (somentePipeline && entry.kind !== "ORCHESTRATION_PIPELINE")) {
    return erro(
      somentePipeline ? "DISCOVERY_PIPELINE_NAO_ENCONTRADO" : "DISCOVERY_ID_NAO_ENCONTRADO",
      somentePipeline ? "Pipeline não encontrado no catálogo público." : "Capacidade não encontrada no catálogo público.",
      emJson,
    );
  }
  const payload: DiscoveryExplainPayload = {
    schemaVersion: DISCOVERY_SCHEMA_VERSION,
    command: somentePipeline ? "descobrir pipeline descrever" : "descobrir explicar",
    success: true,
    mode: "explain",
    ...EXECUTION_BOUNDARY,
    entry,
  };
  return sucesso(payload, emJson);
}

export function comandoDescobertaCapacidades(
  subcomando: string | undefined,
  argumentos: readonly string[] = [],
): DiscoveryCommandResult {
  const emJson = argumentos.includes("--json");
  let operacao = normalizarSubcomando(subcomando);
  let args = [...argumentos];

  if (operacao === "pipeline") {
    const posicionais = obterPosicionais(args);
    const alias = normalizarSubcomando(posicionais[0]);
    if (alias !== "listar" && alias !== "descrever") {
      return erro("DISCOVERY_PIPELINE_SUBCOMANDO_INVALIDO", "Use `pipeline listar` ou `pipeline descrever <id>`.", emJson);
    }
    operacao = `pipeline ${alias}`;
    const indiceAlias = args.indexOf(posicionais[0]!);
    if (indiceAlias >= 0) args.splice(indiceAlias, 1);
  }

  if (operacao === "capabilities") operacao = "catalogo";

  const politica = politicaParaOperacao(operacao);
  if (politica && !argumentosValidos(args, politica)) {
    return erro(
      "DISCOVERY_ARGUMENTOS_INVALIDOS",
      "Use apenas opções conhecidas, uma vez cada e com os valores obrigatórios.",
      emJson,
    );
  }

  try {
    if (operacao === "catalogo" || operacao === "pipeline listar") {
      const tipoCru = operacao === "pipeline listar" ? "ORCHESTRATION_PIPELINE" : obterOpcao(args, "--tipo");
      const kind = tipoCru ? normalizarDiscoveryKind(tipoCru) : null;
      if (tipoCru && !kind) {
        return erro("DISCOVERY_KIND_INVALIDO", "Tipo de capacidade inválido.", emJson);
      }
      const payloadBase = montarCatalogoCapacidades({
        kind,
        id: obterOpcao(args, "--id"),
        domain: obterOpcao(args, "--dominio"),
      });
      const payload = operacao === "pipeline listar"
        ? { ...payloadBase, command: "descobrir pipeline listar" as const }
        : payloadBase;
      return sucesso(payload, emJson);
    }

    if (operacao === "recomendar") {
      const intencao = obterOpcao(args, "--intencao");
      if (!intencao) {
        return erro("DISCOVERY_INTENCAO_OBRIGATORIA", "Use `--intencao <texto>` para recomendar uma capacidade.", emJson);
      }
      const limiteCru = obterOpcao(args, "--limite");
      const limite = limiteCru === null ? 5 : Number(limiteCru);
      if (!Number.isInteger(limite) || limite < 1 || limite > 10) {
        return erro("DISCOVERY_LIMITE_INVALIDO", "O limite deve ser um inteiro entre 1 e 10.", emJson);
      }
      return sucesso(recomendarCapacidadePorIntencao(intencao, limite), emJson);
    }

    if (operacao === "explicar" || operacao === "pipeline descrever") {
      const id = obterOpcao(args, "--id") ?? obterPosicionais(args)[0] ?? null;
      return explicar(id, operacao === "pipeline descrever", emJson);
    }

    if (!operacao) {
      return erro(
        "DISCOVERY_SUBCOMANDO_OBRIGATORIO",
        "Use `catalogo`, `recomendar`, `explicar`, `pipeline listar` ou `pipeline descrever`.",
        emJson,
      );
    }
    return erro("DISCOVERY_SUBCOMANDO_INVALIDO", "Subcomando de descoberta inválido.", emJson);
  } catch {
    return erro("DISCOVERY_ARGUMENTOS_INVALIDOS", "Não foi possível aplicar os argumentos de descoberta.", emJson);
  }
}

export type DiscoveryCliHandler = (
  posicionais: string[],
  args: string[],
  emJson: boolean,
) => Promise<number>;

function imprimirResultado(resultado: DiscoveryCommandResult, emJson: boolean): void {
  const saida = emJson ? JSON.stringify(resultado.payload, null, 2) : resultado.text;
  if (resultado.exitCode === 0 || emJson) console.log(saida);
  else console.error(saida);
}

export const comandoDescobrirHandler: DiscoveryCliHandler = async (posicionais, args, emJson) => {
  const subcomando = posicionais[0];
  const argsSemSubcomando = args[0] === subcomando ? args.slice(1) : args;
  const resultado = comandoDescobertaCapacidades(subcomando, argsSemSubcomando);
  imprimirResultado(resultado, emJson);
  return resultado.exitCode;
};

export const comandoPipelineDescobertaHandler: DiscoveryCliHandler = async (_posicionais, args, emJson) => {
  const resultado = comandoDescobertaCapacidades("pipeline", args);
  imprimirResultado(resultado, emJson);
  return resultado.exitCode;
};

export const comandoCapabilitiesDescobertaHandler: DiscoveryCliHandler = async (_posicionais, args, emJson) => {
  const resultado = comandoDescobertaCapacidades("catalogo", args);
  imprimirResultado(resultado, emJson);
  return resultado.exitCode;
};

export const REGISTRO_HANDLERS_DESCOBERTA = {
  descobrir: comandoDescobrirHandler,
  pipeline: comandoPipelineDescobertaHandler,
  capabilities: comandoCapabilitiesDescobertaHandler,
} as const satisfies Record<"descobrir" | "pipeline" | "capabilities", DiscoveryCliHandler>;
