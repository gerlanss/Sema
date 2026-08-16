// SEMA-GOVERNED: sema.produto.governanca_ia.drift, sema.produto.governanca_ia.drift.cache.store
// Descrição: planeja o escopo físico, cataloga uma vez e reutiliza extrações validadas sem escrever no workspace.

import path from "node:path";
import ts from "typescript";
import pacoteCli from "../package.json" with { type: "json" };
import type { ContextoProjetoCarregado } from "./projeto.js";
import {
  resolverDiretoriosIgnoradosAtivos,
  type ConfiguracaoEscopoDriftAplicada,
  type EstadoCacheDriftAplicado,
  type RegistroConsumerSurfaceDrift,
  type RegistroColunaPersistenciaDrift,
  type RegistroRepositorioPersistenciaDrift,
  type RecursoResolvido,
  type RotaResolvida,
  type SimboloResolvido,
} from "./drift.part01.js";
import {
  EXTENSOES_ARQUIVOS_RASTREAVEIS_DRIFT,
  chaveCaminhoCanonicoDrift,
} from "./drift.part04.js";
import { indexarTypeScript } from "./drift.part06.js";
import {
  indexarCpp,
  indexarDart,
  indexarDotnet,
  indexarGo,
  indexarJava,
  indexarLua,
  indexarPersistenciaDeclarativa,
  indexarPhp,
  indexarPython,
  indexarRust,
} from "./drift.part07.js";
import { indexarPersistenciaDetalhada } from "./drift.part08.js";
import { coletarVinculosIr, construirMapaRecursos } from "./drift.part10.js";
import {
  criarCatalogoDrift,
  type CatalogoDrift,
  type MetricasCatalogoDrift,
  type ObservadorOperacaoDrift,
} from "./driftCatalogo.js";
import {
  expandirDependenciasPlanoDrift,
  planejarEscopoDrift,
  type PlanoEscopoDrift,
} from "./driftEscopo.js";
import type { AvisoModoCacheDrift, ModoCacheDrift } from "./driftCacheModes.js";
import {
  criarStoreCacheDrift,
  digestJsonCanonicoCacheDrift,
  type EventoStoreCacheDrift,
  type StoreCacheDrift,
  type ValorJsonCacheDrift,
} from "./driftCacheStore.js";

export interface LeitorArquivosPlanejadosDrift {
  contem(caminho: string): boolean;
  lerTexto(caminho: string): Promise<string>;
}

export interface OpcoesPrepararIndicesDrift {
  observador?: ObservadorOperacaoDrift;
  modoCache?: ModoCacheDrift;
  avisosModoCache?: readonly AvisoModoCacheDrift[];
}

export interface IndicesDriftPreparados {
  detalhesPersistencia: Awaited<ReturnType<typeof indexarPersistenciaDetalhada>>;
  indexDart: Awaited<ReturnType<typeof indexarDart>>;
  indexTs: Awaited<ReturnType<typeof indexarTypeScript>>;
  mapaImpl: Map<string, SimboloResolvido>;
  mapaRecursos: Map<string, RecursoResolvido[]>;
  todasRotasIndexadas: RotaResolvida[];
  todosArquivosConhecidos: string[];
  todosRecursos: RecursoResolvido[];
  todosSimbolos: SimboloResolvido[];
  planoEscopo: PlanoEscopoDrift;
  cache: EstadoCacheDriftAplicado;
  catalogo: MetricasCatalogoDrift;
  leitorArquivosPlanejados: LeitorArquivosPlanejadosDrift;
}

type IndicesExtraidosDrift = Pick<
  IndicesDriftPreparados,
  | "detalhesPersistencia"
  | "indexDart"
  | "indexTs"
  | "todasRotasIndexadas"
  | "todosArquivosConhecidos"
  | "todosRecursos"
  | "todosSimbolos"
>;

type ChaveIndiceCacheDrift =
  | "indexTs"
  | "indexPy"
  | "indexDart"
  | "indexDotnet"
  | "indexJava"
  | "indexGo"
  | "indexRust"
  | "indexLua"
  | "indexCpp"
  | "indexPhp"
  | "indexPersistencia";

interface IndiceCanonicoDrift {
  simbolos: SimboloResolvido[];
  rotas: RotaResolvida[];
  recursos: RecursoResolvido[];
  consumerSurfaces: RegistroConsumerSurfaceDrift[];
}

interface ExtracoesCanonicasDrift {
  detalhesPersistencia: IndicesExtraidosDrift["detalhesPersistencia"];
  indices: Record<ChaveIndiceCacheDrift, IndiceCanonicoDrift>;
}

interface PayloadIndicesCacheDrift {
  [chave: string]: ValorJsonCacheDrift;
  schema: "sema.drift-index-payload/v4";
  detalhesPersistencia: ValorJsonCacheDrift;
  indices: ValorJsonCacheDrift;
  integridadeDerivada: ValorJsonCacheDrift;
}

const SCHEMA_PAYLOAD_INDICES_CACHE_DRIFT = "sema.drift-index-payload/v4" as const;
const SCHEMA_IDENTIDADE_INDICES_CACHE_DRIFT = "sema.drift-index-identity/v3" as const;
const SCHEMA_ESTADO_CACHE_DRIFT = "sema.drift-cache/v3" as const;
const EXTRATOR_INDICES_CACHE_DRIFT = "drift-index-v4-2026-08-16" as const;
const CHAVES_INDICES_CACHE_DRIFT: readonly ChaveIndiceCacheDrift[] = [
  "indexTs", "indexPy", "indexDart", "indexDotnet", "indexJava", "indexGo",
  "indexRust", "indexLua", "indexCpp", "indexPhp", "indexPersistencia",
];
const ORIGENS_SIMBOLO_POR_INDICE: Record<ChaveIndiceCacheDrift, readonly string[]> = {
  indexTs: ["ts", "js"],
  indexPy: ["py"],
  indexDart: ["dart"],
  indexDotnet: ["cs"],
  indexJava: ["java"],
  indexGo: ["go"],
  indexRust: ["rust"],
  indexLua: ["lua"],
  indexCpp: ["cpp"],
  indexPhp: ["php"],
  indexPersistencia: ["sql"],
};
const EXTENSOES_POR_INDICE: Record<ChaveIndiceCacheDrift, readonly string[]> = {
  indexTs: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  indexPy: [".py"],
  indexDart: [".dart"],
  indexDotnet: [".cs"],
  indexJava: [".java"],
  indexGo: [".go"],
  indexRust: [".rs"],
  indexLua: [".lua"],
  indexCpp: [".cpp", ".cc", ".cxx", ".hpp", ".h"],
  indexPhp: [".php"],
  indexPersistencia: [
    ".sql", ".psql", ".ddl", ".prisma", ".ts", ".tsx", ".js", ".jsx",
    ".mjs", ".cjs", ".py", ".dart", ".lua", ".cs", ".java", ".go",
    ".rs", ".cpp", ".cc", ".cxx", ".hpp", ".h", ".php",
  ],
};

const METRICAS_CATALOGO_VAZIO: MetricasCatalogoDrift = {
  diretoriosVisitados: 0,
  arquivosCatalogados: 0,
  leiturasConteudo: 0,
  bytesLidos: 0,
  acertosMemoriaConteudo: 0,
  origem: "plano_explicito",
};

const LEITOR_VAZIO: LeitorArquivosPlanejadosDrift = {
  contem: () => false,
  lerTexto: async (caminho) => {
    throw new Error(`Arquivo fora do plano explicito do drift: ${caminho}`);
  },
};

function estadoCacheInicial(
  modo: ModoCacheDrift,
  origem: EstadoCacheDriftAplicado["origem"],
  avisos: readonly AvisoModoCacheDrift[],
): EstadoCacheDriftAplicado {
  return {
    modo,
    origem,
    schema: SCHEMA_ESTADO_CACHE_DRIFT,
    metricas: {
      hits: 0,
      misses: 0,
      corruptos: 0,
      gravacoes: 0,
      errosGravacao: 0,
    },
    avisos,
  };
}

function indicesVazios(
  planoEscopo: PlanoEscopoDrift,
  modoCache: ModoCacheDrift,
  avisosModoCache: readonly AvisoModoCacheDrift[],
): IndicesDriftPreparados {
  return {
    detalhesPersistencia: { colunas: [], repositorios: [] },
    indexDart: { simbolos: [], rotas: [], recursos: [], consumerSurfaces: [] },
    indexTs: { simbolos: [], rotas: [], recursos: [], consumerSurfaces: [] },
    mapaImpl: new Map(),
    mapaRecursos: new Map(),
    todasRotasIndexadas: [],
    todosArquivosConhecidos: [],
    todosRecursos: [],
    todosSimbolos: [],
    planoEscopo,
    cache: estadoCacheInicial(modoCache, "nao_aplicavel", avisosModoCache),
    catalogo: { ...METRICAS_CATALOGO_VAZIO },
    leitorArquivosPlanejados: LEITOR_VAZIO,
  };
}

function coletarArquivosFisicosDeclarados(contexto: ContextoProjetoCarregado): string[] {
  const arquivos = new Set<string>();
  for (const modulo of contexto.modulosSelecionados) {
    const ir = modulo.resultado.ir;
    if (!ir) {
      continue;
    }
    for (const { vinculo } of coletarVinculosIr(ir)) {
      const arquivo = vinculo.arquivo ?? (vinculo.tipo === "arquivo" ? vinculo.valor : undefined);
      if (arquivo) {
        arquivos.add(arquivo);
      }
    }
  }
  return [...arquivos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function caminhoContidoCache(baseProjeto: string, arquivo: string): boolean {
  const relativo = path.relative(path.resolve(baseProjeto), path.resolve(arquivo));
  return relativo === "" || (
    relativo !== ".."
    && !relativo.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativo)
  );
}

function resolverArquivoCache(baseProjeto: string, arquivo: string): string {
  if (!path.isAbsolute(arquivo) && arquivo.includes(":")) {
    throw new Error("cache_indice_arquivo_fora_workspace");
  }
  const absoluto = path.isAbsolute(arquivo)
    ? path.resolve(arquivo)
    : path.resolve(baseProjeto, arquivo);
  if (!caminhoContidoCache(baseProjeto, absoluto)) {
    throw new Error("cache_indice_arquivo_fora_workspace");
  }
  return absoluto;
}

function caminhoRelativoSeguroCache(baseProjeto: string, arquivo: string): string {
  const relativo = path.relative(
    path.resolve(baseProjeto),
    resolverArquivoCache(baseProjeto, arquivo),
  ).replace(/\\/g, "/");
  if (!caminhoRelativoValidoCache(relativo)) {
    throw new Error("cache_indice_arquivo_fora_workspace");
  }
  return relativo;
}

function caminhoRelativoValidoCache(valor: unknown): valor is string {
  return typeof valor === "string"
    && valor.length > 0
    && valor !== "."
    && valor !== ".."
    && !valor.startsWith("../")
    && !valor.includes("\\")
    && !valor.includes(":")
    && !valor.includes("\0")
    && !path.posix.isAbsolute(valor)
    && valor.split("/").every((segmento) => segmento.length > 0 && segmento !== "." && segmento !== "..");
}

function resolverCaminhoRelativoCache(baseProjeto: string, relativo: string): string {
  if (!caminhoRelativoValidoCache(relativo)) {
    throw new Error("cache_indice_arquivo_fora_workspace");
  }
  const absoluto = path.resolve(baseProjeto, ...relativo.split("/"));
  if (!caminhoContidoCache(baseProjeto, absoluto)) {
    throw new Error("cache_indice_arquivo_fora_workspace");
  }
  return absoluto;
}

function registroJson(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function textoNaoVazio(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0;
}

function normalizarJsonCache<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

function serializarSimboloCache(
  baseProjeto: string,
  registro: SimboloResolvido,
): Record<string, ValorJsonCacheDrift> {
  return {
    origem: registro.origem,
    caminho: registro.caminho,
    arquivo: caminhoRelativoSeguroCache(baseProjeto, registro.arquivo),
    simbolo: registro.simbolo,
  };
}

function serializarRotaCache(
  baseProjeto: string,
  registro: RotaResolvida,
): Record<string, ValorJsonCacheDrift> {
  return {
    origem: registro.origem,
    metodo: registro.metodo,
    caminho: registro.caminho,
    arquivo: caminhoRelativoSeguroCache(baseProjeto, registro.arquivo),
    simbolo: registro.simbolo,
  };
}

function serializarRecursoCache(
  baseProjeto: string,
  registro: RecursoResolvido,
): Record<string, ValorJsonCacheDrift> {
  const serializado: Record<string, ValorJsonCacheDrift> = {
    origem: registro.origem,
    nome: registro.nome,
    arquivo: caminhoRelativoSeguroCache(baseProjeto, registro.arquivo),
    tipo: registro.tipo,
  };
  if (registro.simbolo !== undefined) {
    serializado.simbolo = registro.simbolo;
  }
  return serializado;
}

function serializarConsumerSurfaceCache(
  baseProjeto: string,
  registro: RegistroConsumerSurfaceDrift,
): Record<string, ValorJsonCacheDrift> {
  return {
    rota: registro.rota,
    arquivo: caminhoRelativoSeguroCache(baseProjeto, registro.arquivo),
    tipoArquivo: registro.tipoArquivo,
  };
}

function serializarColunaPersistenciaCache(
  baseProjeto: string,
  registro: RegistroColunaPersistenciaDrift,
): Record<string, ValorJsonCacheDrift> {
  return {
    origem: registro.origem,
    categoriaPersistencia: registro.categoriaPersistencia,
    recurso: registro.recurso,
    coluna: registro.coluna,
    arquivo: caminhoRelativoSeguroCache(baseProjeto, registro.arquivo),
  };
}

function serializarRepositorioPersistenciaCache(
  baseProjeto: string,
  registro: RegistroRepositorioPersistenciaDrift,
): Record<string, ValorJsonCacheDrift> {
  return {
    origem: registro.origem,
    categoriaPersistencia: registro.categoriaPersistencia,
    recurso: registro.recurso,
    arquivo: caminhoRelativoSeguroCache(baseProjeto, registro.arquivo),
  };
}

function serializarIndiceCache(
  baseProjeto: string,
  indice: IndiceCanonicoDrift,
): Record<string, ValorJsonCacheDrift> {
  return {
    simbolos: indice.simbolos.map((item) => serializarSimboloCache(baseProjeto, item)),
    rotas: indice.rotas.map((item) => serializarRotaCache(baseProjeto, item)),
    recursos: indice.recursos.map((item) => serializarRecursoCache(baseProjeto, item)),
    consumerSurfaces: indice.consumerSurfaces
      .map((item) => serializarConsumerSurfaceCache(baseProjeto, item)),
  };
}

function derivarIntegridadePayloadCache(
  indices: Record<string, unknown>,
  detalhesPersistencia: unknown,
): Record<string, ValorJsonCacheDrift> {
  const agregar = (campo: keyof IndiceCanonicoDrift): unknown[] => CHAVES_INDICES_CACHE_DRIFT
    .flatMap((chave) => {
      const indice = indices[chave] as Record<string, unknown>;
      return indice[campo] as unknown[];
    });
  return {
    simbolosDigest: digestJsonCanonicoCacheDrift(agregar("simbolos")),
    rotasDigest: digestJsonCanonicoCacheDrift(agregar("rotas")),
    recursosDigest: digestJsonCanonicoCacheDrift(agregar("recursos")),
    consumerSurfacesDigest: digestJsonCanonicoCacheDrift(agregar("consumerSurfaces")),
    persistenciaDigest: digestJsonCanonicoCacheDrift(detalhesPersistencia),
  };
}

function serializarIndicesCache(
  baseProjeto: string,
  extracoes: ExtracoesCanonicasDrift,
): PayloadIndicesCacheDrift {
  const indices = Object.fromEntries(CHAVES_INDICES_CACHE_DRIFT.map((chave) => [
    chave,
    serializarIndiceCache(baseProjeto, extracoes.indices[chave]),
  ])) as Record<ChaveIndiceCacheDrift, Record<string, ValorJsonCacheDrift>>;
  const detalhesPersistencia = {
    colunas: extracoes.detalhesPersistencia.colunas
      .map((item) => serializarColunaPersistenciaCache(baseProjeto, item)),
    repositorios: extracoes.detalhesPersistencia.repositorios
      .map((item) => serializarRepositorioPersistenciaCache(baseProjeto, item)),
  };
  return normalizarJsonCache({
    schema: SCHEMA_PAYLOAD_INDICES_CACHE_DRIFT,
    detalhesPersistencia,
    indices,
    integridadeDerivada: derivarIntegridadePayloadCache(indices, detalhesPersistencia),
  }) as PayloadIndicesCacheDrift;
}

function possuiCamposExatos(
  valor: Record<string, unknown>,
  obrigatorios: readonly string[],
  opcionais: readonly string[] = [],
): boolean {
  const permitidos = new Set([...obrigatorios, ...opcionais]);
  return obrigatorios.every((campo) => Object.prototype.hasOwnProperty.call(valor, campo))
    && Object.keys(valor).every((campo) => permitidos.has(campo));
}

function validarRegistroArquivoCache(
  valor: unknown,
  camposTexto: readonly string[],
  camposOpcionais: readonly string[] = [],
): valor is Record<string, unknown> & { arquivo: string } {
  return registroJson(valor)
    && possuiCamposExatos(valor, ["arquivo", ...camposTexto], camposOpcionais)
    && caminhoRelativoValidoCache(valor.arquivo)
    && camposTexto.every((campo) => textoNaoVazio(valor[campo]))
    && camposOpcionais.every((campo) => valor[campo] === undefined || textoNaoVazio(valor[campo]));
}

function validarListaRegistrosCache(
  valor: unknown,
  camposTexto: readonly string[],
  camposOpcionais: readonly string[] = [],
): valor is Array<Record<string, unknown> & { arquivo: string }> {
  return Array.isArray(valor)
    && valor.every((item) => validarRegistroArquivoCache(item, camposTexto, camposOpcionais));
}

function arquivoCompativelComIndiceCache(chave: ChaveIndiceCacheDrift, arquivo: string): boolean {
  const extensao = path.posix.extname(arquivo).toLowerCase();
  return EXTENSOES_POR_INDICE[chave].includes(extensao);
}

function validarIndiceLinguagemCache(valor: unknown, chave: ChaveIndiceCacheDrift): boolean {
  if (!(registroJson(valor)
    && possuiCamposExatos(valor, ["simbolos", "rotas", "recursos", "consumerSurfaces"])
    && validarListaRegistrosCache(valor.simbolos, ["origem", "caminho", "simbolo"])
    && validarListaRegistrosCache(valor.rotas, ["origem", "metodo", "caminho", "simbolo"])
    && validarListaRegistrosCache(valor.recursos, ["origem", "nome", "tipo"], ["simbolo"])
    && validarListaRegistrosCache(valor.consumerSurfaces, ["rota", "tipoArquivo"]))) {
    return false;
  }
  const registros = [valor.simbolos, valor.rotas, valor.recursos, valor.consumerSurfaces]
    .flat() as Array<Record<string, unknown> & { arquivo: string }>;
  if (!registros.every((item) => arquivoCompativelComIndiceCache(chave, item.arquivo))) return false;
  if (!(valor.simbolos as Array<Record<string, unknown>>)
    .every((item) => ORIGENS_SIMBOLO_POR_INDICE[chave].includes(item.origem as string))) return false;
  if (["indexLua", "indexCpp", "indexPersistencia"].includes(chave)
    && (valor.rotas.length > 0 || valor.consumerSurfaces.length > 0)) return false;
  if (!["indexTs", "indexDart"].includes(chave) && valor.consumerSurfaces.length > 0) return false;
  const caminhosRotas = new Set((valor.rotas as Array<Record<string, unknown>>)
    .map((rota) => rota.caminho as string));
  return (valor.consumerSurfaces as Array<Record<string, unknown>>)
    .every((surface) => caminhosRotas.has(surface.rota as string));
}

function validarPayloadIndicesCache(valor: unknown): valor is PayloadIndicesCacheDrift {
  if (!registroJson(valor)
    || !possuiCamposExatos(valor, [
      "schema",
      "detalhesPersistencia",
      "indices",
      "integridadeDerivada",
    ])
    || valor.schema !== SCHEMA_PAYLOAD_INDICES_CACHE_DRIFT
    || !registroJson(valor.detalhesPersistencia)
    || !possuiCamposExatos(valor.detalhesPersistencia, ["colunas", "repositorios"])
    || !registroJson(valor.indices)
    || !possuiCamposExatos(valor.indices, CHAVES_INDICES_CACHE_DRIFT)
    || !CHAVES_INDICES_CACHE_DRIFT.every((chave) => validarIndiceLinguagemCache(
      (valor.indices as Record<string, unknown>)[chave],
      chave,
    ))
    || !registroJson(valor.integridadeDerivada)
    || !possuiCamposExatos(valor.integridadeDerivada, [
      "simbolosDigest",
      "rotasDigest",
      "recursosDigest",
      "consumerSurfacesDigest",
      "persistenciaDigest",
    ])) {
    return false;
  }
  const estruturaValida = validarListaRegistrosCache(
    valor.detalhesPersistencia.colunas,
    ["origem", "categoriaPersistencia", "recurso", "coluna"],
  ) && validarListaRegistrosCache(
    valor.detalhesPersistencia.repositorios,
    ["origem", "categoriaPersistencia", "recurso"],
  );
  if (!estruturaValida) return false;
  const integridadeEsperada = derivarIntegridadePayloadCache(valor.indices, valor.detalhesPersistencia);
  return Object.entries(integridadeEsperada).every(([campo, esperado]) => (
    (valor.integridadeDerivada as Record<string, unknown>)[campo] === esperado
  ));
}

function restaurarRegistroArquivoCache<T extends { arquivo: string }>(
  baseProjeto: string,
  catalogo: CatalogoDrift,
  registro: Record<string, unknown> & { arquivo: string },
): T {
  const arquivo = resolverCaminhoRelativoCache(baseProjeto, registro.arquivo);
  if (!catalogo.contem(arquivo)) {
    throw new Error("cache_indice_arquivo_fora_catalogo");
  }
  return { ...registro, arquivo } as T;
}

function restaurarIndicesCache(
  baseProjeto: string,
  catalogo: CatalogoDrift,
  payload: PayloadIndicesCacheDrift,
): IndicesExtraidosDrift | null {
  if (!validarPayloadIndicesCache(payload)) return null;
  const restaurar = <T extends { arquivo: string }>(valor: unknown): T[] => (
    valor as Array<Record<string, unknown> & { arquivo: string }>
  ).map((item) => restaurarRegistroArquivoCache<T>(baseProjeto, catalogo, item));
  try {
    const detalhes = payload.detalhesPersistencia as Record<string, unknown>;
    const indicesPayload = payload.indices as Record<ChaveIndiceCacheDrift, Record<string, unknown>>;
    const indices = Object.fromEntries(CHAVES_INDICES_CACHE_DRIFT.map((chave) => {
      const indice = indicesPayload[chave];
      return [chave, {
        simbolos: restaurar<SimboloResolvido>(indice.simbolos),
        rotas: restaurar<RotaResolvida>(indice.rotas),
        recursos: restaurar<RecursoResolvido>(indice.recursos),
        consumerSurfaces: restaurar<RegistroConsumerSurfaceDrift>(indice.consumerSurfaces),
      }];
    })) as Record<ChaveIndiceCacheDrift, IndiceCanonicoDrift>;
    return derivarIndicesExtraidos({
      detalhesPersistencia: {
        colunas: restaurar<IndicesExtraidosDrift["detalhesPersistencia"]["colunas"][number]>(detalhes.colunas),
        repositorios: restaurar<IndicesExtraidosDrift["detalhesPersistencia"]["repositorios"][number]>(detalhes.repositorios),
      },
      indices,
    }, catalogo);
  } catch {
    return null;
  }
}

function criarMapaImplDrift(
  todosSimbolos: readonly SimboloResolvido[],
  arquivosPrioritarios: readonly string[],
): Map<string, SimboloResolvido> {
  const prioritarios = new Set(arquivosPrioritarios.map(chaveCaminhoCanonicoDrift));
  const mapaImpl = new Map<string, SimboloResolvido>();
  for (const simbolo of todosSimbolos.filter((item) => item.origem !== "sql")) {
    const existente = mapaImpl.get(simbolo.caminho);
    if (!existente) {
      mapaImpl.set(simbolo.caminho, simbolo);
      continue;
    }
    const prioridadeExistente = prioritarios.has(chaveCaminhoCanonicoDrift(existente.arquivo));
    const prioridadeNova = prioritarios.has(chaveCaminhoCanonicoDrift(simbolo.arquivo));
    if ((prioridadeNova && !prioridadeExistente)
      || (prioridadeNova === prioridadeExistente
        && simbolo.arquivo.localeCompare(existente.arquivo, "pt-BR") < 0)) {
      mapaImpl.set(simbolo.caminho, simbolo);
    }
  }
  return mapaImpl;
}

function montarIndicesPreparados(
  extraidos: IndicesExtraidosDrift,
  arquivosPrioritarios: readonly string[],
  planoEscopo: PlanoEscopoDrift,
  cache: EstadoCacheDriftAplicado,
  catalogo: CatalogoDrift,
): IndicesDriftPreparados {
  return {
    ...extraidos,
    mapaImpl: criarMapaImplDrift(extraidos.todosSimbolos, arquivosPrioritarios),
    mapaRecursos: construirMapaRecursos(extraidos.todosRecursos),
    planoEscopo,
    cache,
    catalogo: catalogo.metricas(),
    leitorArquivosPlanejados: catalogo,
  };
}

function derivarIndicesExtraidos(
  extracoes: ExtracoesCanonicasDrift,
  catalogo: CatalogoDrift,
): IndicesExtraidosDrift {
  const agregar = <T>(campo: keyof IndiceCanonicoDrift): T[] => CHAVES_INDICES_CACHE_DRIFT
    .flatMap((chave) => extracoes.indices[chave][campo] as T[]);
  const todosSimbolos = agregar<SimboloResolvido>("simbolos");
  const todasRotasIndexadas = agregar<RotaResolvida>("rotas");
  const todosRecursos = agregar<RecursoResolvido>("recursos");
  const todosArquivosConhecidos = [...new Set([
    ...catalogo.arquivosCatalogados(),
    ...todosSimbolos.map((item) => item.arquivo),
    ...todasRotasIndexadas.map((item) => item.arquivo),
    ...todosRecursos.map((item) => item.arquivo),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    detalhesPersistencia: extracoes.detalhesPersistencia,
    indexDart: extracoes.indices.indexDart,
    indexTs: extracoes.indices.indexTs,
    todasRotasIndexadas,
    todosArquivosConhecidos,
    todosRecursos,
    todosSimbolos,
  };
}

async function calcularIndices(
  diretorios: string[],
  catalogo: CatalogoDrift,
): Promise<[ExtracoesCanonicasDrift, IndicesExtraidosDrift]> {
  const [
    indexTs,
    indexPy,
    indexDart,
    indexDotnet,
    indexJava,
    indexGo,
    indexRust,
    indexLua,
    indexPhp,
    indexPersistencia,
    detalhesPersistencia,
    indexCpp,
  ] = await Promise.all([
    indexarTypeScript(diretorios, catalogo),
    indexarPython(diretorios, catalogo),
    indexarDart(diretorios, catalogo),
    indexarDotnet(diretorios, catalogo),
    indexarJava(diretorios, catalogo),
    indexarGo(diretorios, catalogo),
    indexarRust(diretorios, catalogo),
    indexarLua(diretorios, catalogo),
    indexarPhp(diretorios, catalogo),
    indexarPersistenciaDeclarativa(diretorios, catalogo),
    indexarPersistenciaDetalhada(diretorios, catalogo),
    indexarCpp(diretorios, catalogo),
  ]);

  const extracoes: ExtracoesCanonicasDrift = {
    detalhesPersistencia,
    indices: {
      indexTs,
      indexPy: { ...indexPy, consumerSurfaces: [] },
      indexDart,
      indexDotnet: { ...indexDotnet, consumerSurfaces: [] },
      indexJava: { ...indexJava, consumerSurfaces: [] },
      indexGo: { ...indexGo, consumerSurfaces: [] },
      indexRust: { ...indexRust, consumerSurfaces: [] },
      indexLua: { ...indexLua, rotas: [], consumerSurfaces: [] },
      indexCpp: { ...indexCpp, rotas: [], consumerSurfaces: [] },
      indexPhp: { ...indexPhp, consumerSurfaces: [] },
      indexPersistencia: { ...indexPersistencia, rotas: [], consumerSurfaces: [] },
    },
  };
  return [extracoes, derivarIndicesExtraidos(extracoes, catalogo)];
}

function relativoIdentidade(baseProjeto: string, alvo: string): string {
  const absoluto = resolverArquivoCache(baseProjeto, alvo);
  const relativo = path.relative(path.resolve(baseProjeto), absoluto).replace(/\\/g, "/");
  if (relativo === "") return ".";
  if (
    relativo === ".."
    || relativo.startsWith("../")
    || relativo.includes(":")
    || relativo.includes("\0")
    || path.posix.isAbsolute(relativo)
  ) {
    throw new Error("cache_identidade_fora_workspace");
  }
  return relativo;
}

function digestValorCache(valor: unknown): string {
  return digestJsonCanonicoCacheDrift(normalizarJsonCache(valor));
}

function representarPlanoCache(
  contexto: ContextoProjetoCarregado,
  configuracao: ConfiguracaoEscopoDriftAplicada,
  plano: PlanoEscopoDrift,
): ValorJsonCacheDrift {
  const relativo = (alvo: string) => relativoIdentidade(contexto.baseProjeto, alvo);
  const ordenar = (itens: readonly string[]) => [...new Set(itens.map(relativo))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const dependencias = Object.entries(plano.dependencias)
    .map(([arquivo, destinos]) => [
      relativo(arquivo),
      ordenar(destinos),
    ] as const)
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  return normalizarJsonCache({
    escopo: configuracao.escopo,
    estrategia: plano.estrategia,
    cobertura: plano.cobertura,
    termos: [...configuracao.termosEscopo].sort((a, b) => a.localeCompare(b, "pt-BR")),
    modulos: [...plano.modulos].sort((a, b) => a.localeCompare(b, "pt-BR")),
    arquivos: ordenar(plano.arquivos),
    arquivosDeclarados: ordenar(plano.arquivosDeclarados),
    arquivosInferidos: ordenar(plano.arquivosInferidos),
    arquivosAusentes: ordenar(plano.arquivosAusentes),
    diretorios: ordenar(plano.diretorios),
    diretoriosCodigo: ordenar(contexto.diretoriosCodigo),
    ignorarWorktrees: configuracao.ignorarWorktrees,
    ignorarConsumidoresLaterais: configuracao.ignorarConsumidoresLaterais,
    dependencias,
  }) as ValorJsonCacheDrift;
}

async function criarChaveIndicesCache(
  contexto: ContextoProjetoCarregado,
  configuracao: ConfiguracaoEscopoDriftAplicada,
  plano: PlanoEscopoDrift,
  catalogo: CatalogoDrift,
  store: StoreCacheDrift,
  arquivosExplicitos: readonly string[],
): Promise<string> {
  const candidatos = new Map<string, string>();
  const adicionarCandidato = (arquivo: string): void => {
    const absoluto = resolverArquivoCache(contexto.baseProjeto, arquivo);
    candidatos.set(chaveCaminhoCanonicoDrift(absoluto), absoluto);
  };
  for (const entrada of catalogo.listarEntradas().filter(
    (item) => configuracao.escopo === "projeto" || item.explicito,
  )) {
    adicionarCandidato(entrada.caminho);
  }
  for (const arquivo of [
    ...arquivosExplicitos,
    ...plano.arquivos,
    ...plano.arquivosDeclarados,
    ...plano.arquivosInferidos,
    ...plano.arquivosAusentes,
  ]) {
    adicionarCandidato(arquivo);
  }
  const membros = await Promise.all([...candidatos.values()].map(async (arquivo) => {
    const relativo = caminhoRelativoSeguroCache(contexto.baseProjeto, arquivo);
    if (!catalogo.contem(arquivo)) {
      return { arquivo: relativo, estado: "ausente" as const };
    }
    return {
      arquivo: relativo,
      estado: "presente" as const,
      digest: await catalogo.digest(arquivo),
    };
  }));
  membros.sort((a, b) => a.arquivo.localeCompare(b.arquivo, "pt-BR"));
  const contratos = contexto.modulosSelecionados
    .map((modulo) => ({
      arquivo: caminhoRelativoSeguroCache(contexto.baseProjeto, modulo.caminho),
      modulo: modulo.resultado.ir ?? null,
      diagnosticos: modulo.resultado.diagnosticos,
    }))
    .sort((a, b) => a.arquivo.localeCompare(b.arquivo, "pt-BR"));
  return digestJsonCanonicoCacheDrift({
    schema: SCHEMA_IDENTIDADE_INDICES_CACHE_DRIFT,
    cliVersion: pacoteCli.version,
    typescriptVersion: ts.version,
    extrator: EXTRATOR_INDICES_CACHE_DRIFT,
    workspaceId: store.workspaceId,
    gitHead: store.gitHead,
    planoDigest: digestValorCache(representarPlanoCache(contexto, configuracao, plano)),
    contratosDigest: digestValorCache(contratos),
    configuracaoDigest: digestValorCache(contexto.configCarregada?.config ?? null),
    membros,
  });
}

function adaptarEventoStoreCache(
  observador: ObservadorOperacaoDrift | undefined,
): ((evento: EventoStoreCacheDrift) => void) | undefined {
  if (!observador) return undefined;
  return (evento) => {
    const tipo = evento.tipo === "cache.read.hit"
      ? "cache.hit"
      : evento.tipo === "cache.read.miss"
        ? "cache.miss"
        : evento.tipo === "cache.read.corrupt"
          ? "cache.corrupt"
          : evento.tipo === "cache.write.published" || evento.tipo === "cache.write.reused"
            ? "cache.write"
            : evento.tipo === "cache.store.unavailable" || evento.tipo === "cache.write.error"
              ? "cache.unavailable"
              : null;
    if (!tipo) return;
    try {
      observador({
        tipo,
        ...(evento.caminhoVirtual ? { caminho: evento.caminhoVirtual } : {}),
        ...(evento.chave ? { chave: evento.chave } : {}),
        ...(evento.codigo ? { motivo: evento.codigo } : {}),
      });
    } catch {
      // Observabilidade não altera o resultado funcional do drift.
    }
  };
}

function estadoCacheDoStore(
  modo: ModoCacheDrift,
  origem: EstadoCacheDriftAplicado["origem"],
  avisos: readonly AvisoModoCacheDrift[],
  store: StoreCacheDrift,
): EstadoCacheDriftAplicado {
  const metricas = store.metricas();
  return {
    modo,
    origem,
    schema: SCHEMA_ESTADO_CACHE_DRIFT,
    ...(store.workspaceId ? { workspaceId: store.workspaceId } : {}),
    metricas: {
      hits: metricas.hits,
      misses: metricas.misses,
      corruptos: metricas.corruptos,
      gravacoes: metricas.publicacoes,
      errosGravacao: metricas.erros,
    },
    avisos,
  };
}

async function resolverIndicesComCache(
  contexto: ContextoProjetoCarregado,
  configuracaoEscopo: ConfiguracaoEscopoDriftAplicada,
  planoEscopo: PlanoEscopoDrift,
  catalogo: CatalogoDrift,
  arquivosPrioritarios: readonly string[],
  arquivosExplicitos: readonly string[],
  modoCache: Exclude<ModoCacheDrift, "none">,
  avisosModoCache: readonly AvisoModoCacheDrift[],
  observador?: ObservadorOperacaoDrift,
): Promise<IndicesDriftPreparados> {
  const store = await criarStoreCacheDrift({
    baseProjeto: contexto.baseProjeto,
    observador: adaptarEventoStoreCache(observador),
  });
  if (!store.disponivel) {
    const [, extraidos] = await calcularIndices(planoEscopo.diretorios, catalogo);
    return montarIndicesPreparados(
      extraidos,
      arquivosPrioritarios,
      planoEscopo,
      estadoCacheDoStore(modoCache, "indisponivel", avisosModoCache, store),
      catalogo,
    );
  }

  let chave: string;
  try {
    chave = await criarChaveIndicesCache(
      contexto,
      configuracaoEscopo,
      planoEscopo,
      catalogo,
      store,
      arquivosExplicitos,
    );
  } catch {
    const [, extraidos] = await calcularIndices(planoEscopo.diretorios, catalogo);
    return montarIndicesPreparados(
      extraidos,
      arquivosPrioritarios,
      planoEscopo,
      estadoCacheDoStore(modoCache, "indisponivel", avisosModoCache, store),
      catalogo,
    );
  }
  const validarPayloadAplicavel = (valor: unknown): valor is PayloadIndicesCacheDrift => {
    if (!validarPayloadIndicesCache(valor)) return false;
    return restaurarIndicesCache(contexto.baseProjeto, catalogo, valor) !== null;
  };

  if (modoCache === "cache") {
    const leitura = await store.ler(chave, validarPayloadAplicavel);
    if (leitura.estado === "hit") {
      const restaurados = restaurarIndicesCache(contexto.baseProjeto, catalogo, leitura.valor);
      if (restaurados) {
        return montarIndicesPreparados(
          restaurados,
          arquivosPrioritarios,
          planoEscopo,
          estadoCacheDoStore(modoCache, "cache", avisosModoCache, store),
          catalogo,
        );
      }
    }
  }

  const [extracoes, extraidos] = await calcularIndices(planoEscopo.diretorios, catalogo);
  try {
    const payload = serializarIndicesCache(contexto.baseProjeto, extracoes);
    await store.publicar(chave, payload, validarPayloadAplicavel);
  } catch {
    // Cache é aceleração descartável; a extração recém-calculada continua autoritativa.
  }
  return montarIndicesPreparados(
    extraidos,
    arquivosPrioritarios,
    planoEscopo,
    estadoCacheDoStore(modoCache, "calculado", avisosModoCache, store),
    catalogo,
  );
}

export async function prepararIndicesDrift(
  contexto: ContextoProjetoCarregado,
  configuracaoEscopo: ConfiguracaoEscopoDriftAplicada,
  opcoes: OpcoesPrepararIndicesDrift = {},
): Promise<IndicesDriftPreparados> {
  const modoCache = opcoes.modoCache ?? "none";
  const avisosModoCache = opcoes.avisosModoCache ?? [];
  let planoEscopo = await planejarEscopoDrift(contexto, configuracaoEscopo);
  if (planoEscopo.bloqueios.length > 0) {
    return indicesVazios(planoEscopo, modoCache, avisosModoCache);
  }

  const arquivosExplicitos = planoEscopo.estrategia === "arquivos_vinculados"
    ? planoEscopo.arquivos
    : coletarArquivosFisicosDeclarados(contexto);
  const catalogo = await criarCatalogoDrift({
    baseDiretorio: contexto.baseProjeto,
    arquivos: arquivosExplicitos,
    raizes: planoEscopo.estrategia === "projeto" ? planoEscopo.diretorios : [],
    extensoes: EXTENSOES_ARQUIVOS_RASTREAVEIS_DRIFT,
    diretoriosIgnorados: resolverDiretoriosIgnoradosAtivos(configuracaoEscopo),
    observador: opcoes.observador,
  });
  const arquivosPrioritarios = [...planoEscopo.arquivos];
  planoEscopo = await expandirDependenciasPlanoDrift(contexto, planoEscopo, catalogo);
  if (modoCache === "none") {
    const [, extraidos] = await calcularIndices(planoEscopo.diretorios, catalogo);
    return montarIndicesPreparados(
      extraidos,
      arquivosPrioritarios,
      planoEscopo,
      estadoCacheInicial(modoCache, "calculado", avisosModoCache),
      catalogo,
    );
  }

  return resolverIndicesComCache(
    contexto,
    configuracaoEscopo,
    planoEscopo,
    catalogo,
    arquivosPrioritarios,
    arquivosExplicitos,
    modoCache,
    avisosModoCache,
    opcoes.observador,
  );
}
