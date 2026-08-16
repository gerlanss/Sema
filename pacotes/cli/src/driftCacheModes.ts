// SEMA-GOVERNED: sema.produto.governanca_ia.drift.cache.modos
// Descrição: normaliza os modos públicos de cache do drift sem efeitos colaterais.

export type ModoCacheDrift = "none" | "cache" | "fresh";

export type FlagModoCacheDrift = "--cache" | "--drift";

export type AliasLegadoModoCacheDrift = "off" | "auto" | "refresh";

export type CodigoErroModoCacheDrift =
  | "flag_duplicada"
  | "flags_conflitantes"
  | "valor_ausente"
  | "valor_invalido"
  | "flag_nao_permitida_no_comando"
  | "com_drift_duplicado"
  | "com_drift_conflitante"
  | "com_drift_nao_permitido"
  | "consulta_nao_suportada";

export type ComandoConsultaDrift = "resumo" | "inspecionar";

export interface AvisoModoCacheDrift {
  codigo: "alias_modo_cache_drift_depreciado";
  flag: FlagModoCacheDrift;
  valorRecebido: AliasLegadoModoCacheDrift;
  valorNormalizado: ModoCacheDrift;
  vigencia: "uma_versao";
  mensagem: string;
}

export interface ResultadoParseModoCacheDrift {
  modo: ModoCacheDrift | null;
  flag: FlagModoCacheDrift | null;
  avisos: readonly AvisoModoCacheDrift[];
}

export interface ResolucaoModoCacheDrift {
  modo: ModoCacheDrift;
  executar: boolean;
  avisos: readonly AvisoModoCacheDrift[];
}

interface DetalhesErroModoCacheDrift {
  flag?: FlagModoCacheDrift | "--com-drift";
  valor?: string;
}

export class ErroModoCacheDrift extends Error {
  readonly name = "ErroModoCacheDrift";
  readonly flag?: FlagModoCacheDrift | "--com-drift";
  readonly valor?: string;

  constructor(
    readonly codigo: CodigoErroModoCacheDrift,
    mensagem: string,
    detalhes: DetalhesErroModoCacheDrift = {},
  ) {
    super(mensagem);
    this.flag = detalhes.flag;
    this.valor = detalhes.valor;
  }
}

interface OcorrenciaModoCacheDrift {
  flag: FlagModoCacheDrift;
  valor: string;
}

const FLAGS_MODO_CACHE_DRIFT = ["--cache", "--drift"] as const;
const MODOS_CACHE_DRIFT = new Set<ModoCacheDrift>(["none", "cache", "fresh"]);
const ALIASES_LEGADOS: Readonly<Record<AliasLegadoModoCacheDrift, ModoCacheDrift>> = {
  off: "none",
  auto: "cache",
  refresh: "fresh",
};
const COMANDOS_CONSULTA_DRIFT = new Set<string>(["resumo", "inspecionar"]);

function ehFlagModoCacheDrift(valor: string): valor is FlagModoCacheDrift {
  return (FLAGS_MODO_CACHE_DRIFT as readonly string[]).includes(valor);
}

function ehModoCacheDrift(valor: string): valor is ModoCacheDrift {
  return MODOS_CACHE_DRIFT.has(valor as ModoCacheDrift);
}

function ehAliasLegado(valor: string): valor is AliasLegadoModoCacheDrift {
  return Object.prototype.hasOwnProperty.call(ALIASES_LEGADOS, valor);
}

function lerOcorrencias(args: readonly string[]): OcorrenciaModoCacheDrift[] {
  const ocorrencias: OcorrenciaModoCacheDrift[] = [];

  for (let indice = 0; indice < args.length; indice += 1) {
    const argumento = args[indice] ?? "";
    const separador = argumento.indexOf("=");
    const flagInline = separador >= 0 ? argumento.slice(0, separador) : "";

    if (ehFlagModoCacheDrift(flagInline)) {
      const valor = argumento.slice(separador + 1);
      if (valor.length === 0) {
        throw new ErroModoCacheDrift(
          "valor_ausente",
          `A flag ${flagInline} exige um modo: none, cache ou fresh.`,
          { flag: flagInline },
        );
      }
      ocorrencias.push({ flag: flagInline, valor });
      continue;
    }

    if (!ehFlagModoCacheDrift(argumento)) {
      continue;
    }

    const valor = args[indice + 1];
    if (valor === undefined || valor.length === 0 || valor.startsWith("-")) {
      throw new ErroModoCacheDrift(
        "valor_ausente",
        `A flag ${argumento} exige um modo: none, cache ou fresh.`,
        { flag: argumento },
      );
    }

    ocorrencias.push({ flag: argumento, valor });
    indice += 1;
  }

  return ocorrencias;
}

function validarOcorrenciaUnica(
  ocorrencias: readonly OcorrenciaModoCacheDrift[],
): OcorrenciaModoCacheDrift | null {
  if (ocorrencias.length === 0) {
    return null;
  }
  if (ocorrencias.length === 1) {
    return ocorrencias[0] ?? null;
  }

  const flags = new Set(ocorrencias.map((ocorrencia) => ocorrencia.flag));
  if (flags.size > 1) {
    throw new ErroModoCacheDrift(
      "flags_conflitantes",
      "Use somente uma das flags --cache ou --drift.",
    );
  }

  const flag = ocorrencias[0]?.flag;
  throw new ErroModoCacheDrift(
    "flag_duplicada",
    `A flag ${flag ?? "de modo de drift"} foi informada mais de uma vez.`,
    flag === undefined ? {} : { flag },
  );
}

function normalizarOcorrencia(ocorrencia: OcorrenciaModoCacheDrift): ResultadoParseModoCacheDrift {
  if (ehModoCacheDrift(ocorrencia.valor)) {
    return {
      modo: ocorrencia.valor,
      flag: ocorrencia.flag,
      avisos: [],
    };
  }

  if (ehAliasLegado(ocorrencia.valor)) {
    const valorNormalizado = ALIASES_LEGADOS[ocorrencia.valor];
    return {
      modo: valorNormalizado,
      flag: ocorrencia.flag,
      avisos: [{
        codigo: "alias_modo_cache_drift_depreciado",
        flag: ocorrencia.flag,
        valorRecebido: ocorrencia.valor,
        valorNormalizado,
        vigencia: "uma_versao",
        mensagem: `${ocorrencia.valor} é um alias temporário; use ${valorNormalizado}.`,
      }],
    };
  }

  throw new ErroModoCacheDrift(
    "valor_invalido",
    `Modo inválido para ${ocorrencia.flag}: ${ocorrencia.valor}. Use none, cache ou fresh.`,
    { flag: ocorrencia.flag, valor: ocorrencia.valor },
  );
}

function contarComDrift(args: readonly string[]): number {
  return args.reduce((total, argumento) => total + (argumento === "--com-drift" ? 1 : 0), 0);
}

function validarComDriftUnico(args: readonly string[]): boolean {
  const ocorrencias = contarComDrift(args);
  if (ocorrencias > 1) {
    throw new ErroModoCacheDrift(
      "com_drift_duplicado",
      "A flag --com-drift foi informada mais de uma vez.",
      { flag: "--com-drift" },
    );
  }
  return ocorrencias === 1;
}

export function parsearModoCacheDrift(args: readonly string[]): ResultadoParseModoCacheDrift {
  const ocorrencia = validarOcorrenciaUnica(lerOcorrencias(args));
  if (ocorrencia === null) {
    return { modo: null, flag: null, avisos: [] };
  }
  return normalizarOcorrencia(ocorrencia);
}

export function resolverModoCacheComandoDrift(
  args: readonly string[],
): ResolucaoModoCacheDrift {
  if (validarComDriftUnico(args)) {
    throw new ErroModoCacheDrift(
      "com_drift_nao_permitido",
      "--com-drift só pode ser usada nas consultas resumo e inspecionar.",
      { flag: "--com-drift" },
    );
  }

  const resultado = parsearModoCacheDrift(args);
  if (resultado.flag === "--drift") {
    throw new ErroModoCacheDrift(
      "flag_nao_permitida_no_comando",
      "O comando sema drift usa --cache; --drift pertence às consultas resumo e inspecionar.",
      { flag: resultado.flag },
    );
  }
  return {
    modo: resultado.modo ?? "fresh",
    executar: true,
    avisos: resultado.avisos,
  };
}

export function resolverModoCacheConsultaDrift(
  args: readonly string[],
  comando: ComandoConsultaDrift,
): ResolucaoModoCacheDrift {
  if (!COMANDOS_CONSULTA_DRIFT.has(comando)) {
    throw new ErroModoCacheDrift(
      "consulta_nao_suportada",
      "O modo de análise de drift em consulta só é válido para resumo e inspecionar.",
    );
  }

  const comDrift = validarComDriftUnico(args);
  const resultado = parsearModoCacheDrift(args);
  if (resultado.flag === "--cache") {
    throw new ErroModoCacheDrift(
      "flag_nao_permitida_no_comando",
      `${comando} usa --drift; --cache pertence ao comando sema drift.`,
      { flag: resultado.flag },
    );
  }
  if (comDrift && resultado.flag !== null) {
    throw new ErroModoCacheDrift(
      "com_drift_conflitante",
      `Não combine --com-drift com ${resultado.flag}.`,
      { flag: resultado.flag },
    );
  }

  const modo = comDrift ? "fresh" : (resultado.modo ?? "none");
  return {
    modo,
    executar: modo !== "none",
    avisos: resultado.avisos,
  };
}
