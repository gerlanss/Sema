// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: prepara indices vivos para drift; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import type { ContextoProjetoCarregado } from "./projeto.js";
import type { ConfiguracaoEscopoDriftAplicada, RecursoResolvido, RotaResolvida, SimboloResolvido } from "./drift.part01.js";
import { resolverDiretoriosCodigoEscopoReal } from "./drift.part02.js";
import { indexarArquivosRastreaveis } from "./drift.part04.js";
import { indexarTypeScript } from "./drift.part06.js";
import { indexarCpp, indexarDart, indexarDotnet, indexarGo, indexarJava, indexarLua, indexarPersistenciaDeclarativa, indexarPython, indexarRust } from "./drift.part07.js";
import { indexarPersistenciaDetalhada } from "./drift.part08.js";
import { construirMapaRecursos } from "./drift.part10.js";

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
}

export async function prepararIndicesDrift(
  contexto: ContextoProjetoCarregado,
  configuracaoEscopo: ConfiguracaoEscopoDriftAplicada,
): Promise<IndicesDriftPreparados> {
  const diretoriosCodigoAtivos = resolverDiretoriosCodigoEscopoReal(contexto, configuracaoEscopo);
  const indexTs = await indexarTypeScript(diretoriosCodigoAtivos);
  const indexPy = await indexarPython(diretoriosCodigoAtivos);
  const indexDart = await indexarDart(diretoriosCodigoAtivos);
  const indexDotnet = await indexarDotnet(diretoriosCodigoAtivos);
  const indexJava = await indexarJava(diretoriosCodigoAtivos);
  const indexGo = await indexarGo(diretoriosCodigoAtivos);
  const indexRust = await indexarRust(diretoriosCodigoAtivos);
  const indexLua = await indexarLua(diretoriosCodigoAtivos);
  const indexPersistencia = await indexarPersistenciaDeclarativa(diretoriosCodigoAtivos);
  const detalhesPersistencia = await indexarPersistenciaDetalhada(diretoriosCodigoAtivos);
  const indexCpp = await indexarCpp(diretoriosCodigoAtivos);
  const arquivosRastreaveis = await indexarArquivosRastreaveis(diretoriosCodigoAtivos);
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
    ...indexPersistencia.simbolos,
  ];
  const mapaImpl = new Map<string, SimboloResolvido>([
    ...indexTs.simbolos.map((item) => [item.caminho, item] as const),
    ...indexPy.simbolos.map((item) => [item.caminho, item] as const),
    ...indexDart.simbolos.map((item) => [item.caminho, item] as const),
    ...indexDotnet.simbolos.map((item) => [item.caminho, item] as const),
    ...indexJava.simbolos.map((item) => [item.caminho, item] as const),
    ...indexGo.simbolos.map((item) => [item.caminho, item] as const),
    ...indexRust.simbolos.map((item) => [item.caminho, item] as const),
    ...indexLua.simbolos.map((item) => [item.caminho, item] as const),
    ...indexCpp.simbolos.map((item) => [item.caminho, item] as const),
  ]);
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
    ...indexPersistencia.recursos,
  ];
  const mapaRecursos = construirMapaRecursos(todosRecursos);
  const todasRotasIndexadas = [
    ...indexTs.rotas,
    ...indexPy.rotas,
    ...indexDart.rotas,
    ...indexDotnet.rotas,
    ...indexJava.rotas,
    ...indexGo.rotas,
    ...indexRust.rotas,
  ];
  const todosArquivosConhecidos = [...new Set([
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
    mapaRecursos,
    todasRotasIndexadas,
    todosArquivosConhecidos,
    todosRecursos,
    todosSimbolos,
  };
}
