// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: planeja o escopo fisico, cataloga uma vez e compartilha as leituras entre todos os indexadores.

import type { ContextoProjetoCarregado } from "./projeto.js";
import {
  resolverDiretoriosIgnoradosAtivos,
  type ConfiguracaoEscopoDriftAplicada,
  type RecursoResolvido,
  type RotaResolvida,
  type SimboloResolvido,
} from "./drift.part01.js";
import {
  EXTENSOES_ARQUIVOS_RASTREAVEIS_DRIFT,
  chaveCaminhoCanonicoDrift,
  indexarArquivosRastreaveis,
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

export interface LeitorArquivosPlanejadosDrift {
  contem(caminho: string): boolean;
  lerTexto(caminho: string): Promise<string>;
}

export interface OpcoesPrepararIndicesDrift {
  observador?: ObservadorOperacaoDrift;
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
  catalogo: MetricasCatalogoDrift;
  leitorArquivosPlanejados: LeitorArquivosPlanejadosDrift;
}

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

function indicesVazios(planoEscopo: PlanoEscopoDrift): IndicesDriftPreparados {
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

async function calcularIndices(
  diretorios: string[],
  catalogo: CatalogoDrift,
  arquivosPrioritarios: readonly string[],
): Promise<Omit<IndicesDriftPreparados, "planoEscopo" | "catalogo" | "leitorArquivosPlanejados">> {
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
    arquivosRastreaveis,
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
    indexarArquivosRastreaveis(diretorios, catalogo),
  ]);

  const todosSimbolos = [
    ...indexTs.simbolos,
    ...indexPy.simbolos,
    ...indexDart.simbolos,
    ...indexDotnet.simbolos,
    ...indexJava.simbolos,
    ...indexGo.simbolos,
    ...indexRust.simbolos,
    ...indexLua.simbolos,
    ...indexCpp.simbolos,
    ...indexPhp.simbolos,
    ...indexPersistencia.simbolos,
  ];
  const simbolosImpl = [
    ...indexTs.simbolos,
    ...indexPy.simbolos,
    ...indexDart.simbolos,
    ...indexDotnet.simbolos,
    ...indexJava.simbolos,
    ...indexGo.simbolos,
    ...indexRust.simbolos,
    ...indexLua.simbolos,
    ...indexCpp.simbolos,
    ...indexPhp.simbolos,
  ];
  const prioritarios = new Set(arquivosPrioritarios.map(chaveCaminhoCanonicoDrift));
  const mapaImpl = new Map<string, SimboloResolvido>();
  for (const simbolo of simbolosImpl) {
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
  const todosRecursos = [
    ...indexTs.recursos,
    ...indexPy.recursos,
    ...indexDart.recursos,
    ...indexDotnet.recursos,
    ...indexJava.recursos,
    ...indexGo.recursos,
    ...indexRust.recursos,
    ...indexLua.recursos,
    ...indexCpp.recursos,
    ...indexPhp.recursos,
    ...indexPersistencia.recursos,
  ];
  const todasRotasIndexadas = [
    ...indexTs.rotas,
    ...indexPy.rotas,
    ...indexDart.rotas,
    ...indexDotnet.rotas,
    ...indexJava.rotas,
    ...indexGo.rotas,
    ...indexRust.rotas,
    ...indexPhp.rotas,
  ];
  const todosArquivosConhecidos = [...new Set([
    ...catalogo.arquivosCatalogados(),
    ...arquivosRastreaveis,
    ...todosSimbolos.map((item) => item.arquivo),
    ...todasRotasIndexadas.map((item) => item.arquivo),
    ...todosRecursos.map((item) => item.arquivo),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    detalhesPersistencia,
    indexDart,
    indexTs,
    mapaImpl,
    mapaRecursos: construirMapaRecursos(todosRecursos),
    todasRotasIndexadas,
    todosArquivosConhecidos,
    todosRecursos,
    todosSimbolos,
  };
}

export async function prepararIndicesDrift(
  contexto: ContextoProjetoCarregado,
  configuracaoEscopo: ConfiguracaoEscopoDriftAplicada,
  opcoes: OpcoesPrepararIndicesDrift = {},
): Promise<IndicesDriftPreparados> {
  let planoEscopo = await planejarEscopoDrift(contexto, configuracaoEscopo);
  if (planoEscopo.bloqueios.length > 0) {
    return indicesVazios(planoEscopo);
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
  const indices = await calcularIndices(planoEscopo.diretorios, catalogo, arquivosPrioritarios);

  return {
    ...indices,
    planoEscopo,
    catalogo: catalogo.metricas(),
    leitorArquivosPlanejados: catalogo,
  };
}
