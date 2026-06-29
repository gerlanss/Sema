// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type {
  EngineBanco,
  IrBancoDados,
  IrFlow,
  IrModulo,
  IrRecursoPersistencia,
  IrRoute,
  IrSuperficie,
  IrTask,
  IrVinculo,
  NivelConfiancaSemantica,
  NivelRiscoSemantico,
  TipoRecursoPersistencia,
} from "@sema/nucleo";
import type { ContextoProjetoCarregado } from "./projeto.js";
import type { FonteLegado } from "./tipos.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { extrairSimbolosLua } from "./lua-symbols.js";
import { contarIndentacaoPython, extrairRotasFlaskDecoradas, normalizarCaminhoFlask } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import { extrairRotasTypeScriptHttp } from "./typescript-http.js";
import { emitirDiagnosticosArquivosOrcamento } from "./driftOrcamento.js";

import { OpcoesDriftLegado, OrigemCodigoDrift, OrigemRecursoDrift, RecursoResolvido, RegistroPersistenciaRealDrift, SimboloCandidatoDrift, SimboloResolvido, TipoRecursoDrift, categorizarPersistenciaPorOrigem, resolverOpcoesDrift } from "./drift.part01.js";
import { arquivoCombinaDeclaradoDrift, coletarArquivosPreferidosPersistenciaTask, deduplicarRecursosResolvidos, detalhePersistenciaCombinaOrigem, indexarPersistenciaDetalhada, localizarCompatibilidadePersistencia, recursoDetalhadoCombina, resolverPersistenciaLocalPorTask } from "./drift.part08.js";
import { resolverDiretoriosCodigoEscopoReal } from "./drift.part02.js";
import { construirMapaRecursos, extrairRecursosEsperados, recursoResolvidoCombinaEsperado } from "./drift.part10.js";
import { indexarPersistenciaDeclarativa } from "./drift.part07.js";
import { variantesNomeRecursoDrift } from "./drift.part03.js";
import { paraIdentificadorModulo } from "./drift.part04.js";

export async function analisarPersistenciaReal(
  contexto: ContextoProjetoCarregado,
  mapaRecursos?: Map<string, RecursoResolvido[]>,
  detalhesPersistencia?: Awaited<ReturnType<typeof indexarPersistenciaDetalhada>>,
  opcoes?: OpcoesDriftLegado,
  mapaImpl?: Map<string, SimboloResolvido>,
): Promise<RegistroPersistenciaRealDrift[]> {
  const opcoesResolvidas = resolverOpcoesDrift(opcoes);
  const diretoriosCodigoAtivos = resolverDiretoriosCodigoEscopoReal(contexto, opcoesResolvidas);
  const mapa = mapaRecursos ?? construirMapaRecursos((await indexarPersistenciaDeclarativa(diretoriosCodigoAtivos)).recursos);
  const detalhes = detalhesPersistencia ?? await indexarPersistenciaDetalhada(diretoriosCodigoAtivos);
  const registros: RegistroPersistenciaRealDrift[] = [];

  for (const item of contexto.modulosSelecionados) {
    const ir = item.resultado.ir;
    if (!ir) {
      continue;
    }

    for (const task of ir.tasks) {
      for (const esperado of extrairRecursosEsperados(task, ir, mapa, mapaImpl)) {
        const correspondencias = esperado.nomes.flatMap((nome) =>
          variantesNomeRecursoDrift(nome).flatMap((variante) =>
            (mapa.get(variante) ?? []).filter((recurso) => recursoResolvidoCombinaEsperado(recurso, esperado))));
        let recursosReais = deduplicarRecursosResolvidos(correspondencias);
        const arquivosPreferidos = [...coletarArquivosPreferidosPersistenciaTask(task, mapaImpl)];
        if (recursosReais.length === 0) {
          recursosReais = resolverPersistenciaLocalPorTask(mapa, task, ir, esperado, mapaImpl);
        }
        const compatibilidade = localizarCompatibilidadePersistencia(ir.databases, esperado, recursosReais[0]);
        let colunas = [...new Set(detalhes.colunas
          .filter((coluna) =>
            detalhePersistenciaCombinaOrigem(coluna.origem, recursosReais[0])
            && recursoDetalhadoCombina(coluna.recurso, esperado))
          .map((coluna) => coluna.coluna))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        let repositorios = [...new Set(detalhes.repositorios
          .filter((repositorio) =>
            detalhePersistenciaCombinaOrigem(repositorio.origem, recursosReais[0])
            && recursoDetalhadoCombina(repositorio.recurso, esperado))
          .map((repositorio) => repositorio.arquivo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
        if (recursosReais.some((recurso) => recurso.origem === "arquivo") && arquivosPreferidos.length > 0) {
          if (colunas.length === 0) {
            colunas = [...new Set(detalhes.colunas
              .filter((coluna) =>
                coluna.origem === "arquivo"
                && arquivosPreferidos.some((arquivo) => arquivoCombinaDeclaradoDrift(coluna.arquivo, arquivo)))
              .map((coluna) => coluna.coluna))].sort((a, b) => a.localeCompare(b, "pt-BR"));
          }
          if (repositorios.length === 0) {
            repositorios = [...new Set(detalhes.repositorios
              .filter((repositorio) =>
                repositorio.origem === "arquivo"
                && arquivosPreferidos.some((arquivo) => arquivoCombinaDeclaradoDrift(repositorio.arquivo, arquivo)))
              .map((repositorio) => repositorio.arquivo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
          }
        }
        const arquivos = [...new Set(recursosReais.map((recurso) => recurso.arquivo))].sort((a, b) => a.localeCompare(b, "pt-BR"));

        registros.push({
          modulo: ir.nome,
          task: task.nome,
          alvo: esperado.alvo,
          engine: compatibilidade.engine,
          categoriaPersistencia: categorizarPersistenciaPorOrigem((compatibilidade.engine === "desconhecido" ? undefined : compatibilidade.engine) as OrigemRecursoDrift | undefined),
          tipo: compatibilidade.tipo,
          status: recursosReais.length === 0
            ? "divergente"
            : colunas.length > 0 || repositorios.length > 0
              ? "materializado"
              : "parcial",
          arquivos,
          colunas,
          repositorios,
          compatibilidade: compatibilidade.compatibilidade,
          motivoCompatibilidade: compatibilidade.motivoCompatibilidade,
        });
      }
    }
  }

  return registros.sort((a, b) =>
    a.modulo.localeCompare(b.modulo, "pt-BR")
    || a.task.localeCompare(b.task, "pt-BR")
    || a.alvo.localeCompare(b.alvo, "pt-BR"));
}

export function normalizarCaminhoRota(caminho?: string): string {
  if (!caminho) {
    return "/";
  }
  const limpo = normalizarCaminhoFlask(caminho.trim().replace(/\s*\/\s*/g, "/"));
  const comBarra = limpo.startsWith("/") ? limpo : `/${limpo}`;
  const normalizado = comBarra.replace(/\/+/g, "/");
  return normalizado.endsWith("/") && normalizado !== "/" ? normalizado.slice(0, -1) : normalizado;
}

export function extrairFontesHttpTypeScript(fontesLegado: FonteLegado[]): Array<"nestjs" | "nextjs" | "firebase"> {
  return fontesLegado.filter((fonte): fonte is "nestjs" | "nextjs" | "firebase" =>
    fonte === "nestjs" || fonte === "nextjs" || fonte === "firebase");
}

export function extrairFontesHttpBackend(fontesLegado: FonteLegado[]): Array<"dotnet" | "java" | "go" | "rust"> {
  return fontesLegado.filter((fonte): fonte is "dotnet" | "java" | "go" | "rust" =>
    fonte === "dotnet" || fonte === "java" || fonte === "go" || fonte === "rust");
}

export function ultimoSegmentoSimbolico(caminho: string): string {
  const partes = caminho.split(".").filter(Boolean);
  return paraIdentificadorModulo(partes[partes.length - 1] ?? caminho);
}

export function pontuarCandidatoDeclarado(candidato: SimboloResolvido, origem: OrigemCodigoDrift, caminhoDeclarado: string): SimboloCandidatoDrift | undefined {
  if (candidato.origem === "sql") {
    return undefined;
  }
  const mesmaFamiliaTsJs = (origem === "ts" || origem === "js") && (candidato.origem === "ts" || candidato.origem === "js");
  if (candidato.origem !== origem && !mesmaFamiliaTsJs) {
    return undefined;
  }

  const caminhoNormalizado = paraIdentificadorModulo(caminhoDeclarado.replace(/\./g, "_"));
  const candidatoNormalizado = paraIdentificadorModulo(candidato.caminho.replace(/\./g, "_"));
  const ultimoDeclarado = ultimoSegmentoSimbolico(caminhoDeclarado);
  const ultimoCandidato = ultimoSegmentoSimbolico(candidato.caminho);
  const prefixoDeclarado = caminhoDeclarado.split(".").slice(0, -1).join(".");
  const prefixoCandidato = candidato.caminho.split(".").slice(0, -1).join(".");

  if (candidato.caminho === caminhoDeclarado) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: "Caminho simbolico bate exatamente com o declarado.",
    };
  }

  if (ultimoDeclarado && ultimoDeclarado === ultimoCandidato) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: "Ultimo simbolo bate com a implementacao declarada.",
    };
  }

  if (ultimoDeclarado && (candidatoNormalizado.includes(ultimoDeclarado) || caminhoNormalizado.includes(ultimoCandidato))) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "media",
      motivo: "Trecho relevante do caminho simbolico parece compativel com o declarado.",
    };
  }

  if (prefixoDeclarado && prefixoDeclarado === prefixoCandidato) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "media",
      motivo: "Prefixo do caminho simbolico bate com a implementacao declarada; o simbolo final pode ter mudado.",
    };
  }

  return undefined;
}

export function pontuarCandidatoPorTask(candidato: SimboloResolvido, task: string): SimboloCandidatoDrift | undefined {
  if (candidato.origem === "sql") {
    return undefined;
  }

  const taskNormalizada = paraIdentificadorModulo(task);
  const simboloNormalizado = paraIdentificadorModulo(candidato.simbolo.replace(/\./g, "_"));
  const caminhoNormalizado = paraIdentificadorModulo(candidato.caminho.replace(/\./g, "_"));

  if (!taskNormalizada) {
    return undefined;
  }

  if (simboloNormalizado === taskNormalizada || ultimoSegmentoSimbolico(candidato.caminho) === taskNormalizada) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: "Nome da task bate com o simbolo encontrado no codigo vivo.",
    };
  }

  if (simboloNormalizado.includes(taskNormalizada) || taskNormalizada.includes(simboloNormalizado) || caminhoNormalizado.includes(taskNormalizada)) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "media",
      motivo: "Nome da task parece compativel com o simbolo encontrado no codigo vivo.",
    };
  }

  return undefined;
}

export function deduplicarCandidatos(candidatos: SimboloCandidatoDrift[]): SimboloCandidatoDrift[] {
  const mapa = new Map<string, SimboloCandidatoDrift>();
  for (const candidato of candidatos) {
    const chave = `${candidato.origem}:${candidato.caminho}:${candidato.arquivo}:${candidato.simbolo}`;
    const anterior = mapa.get(chave);
    if (!anterior || (anterior.confianca === "media" && candidato.confianca === "alta")) {
      mapa.set(chave, candidato);
    }
  }
  return [...mapa.values()];
}

export function ordenarCandidatos(candidatos: SimboloCandidatoDrift[]): SimboloCandidatoDrift[] {
  return [...candidatos].sort((a, b) => {
    if (a.confianca !== b.confianca) {
      return a.confianca === "alta" ? -1 : 1;
    }
    return a.caminho.localeCompare(b.caminho, "pt-BR");
  });
}

export function sugerirCandidatosParaImpl(
  simbolos: SimboloResolvido[],
  origem: OrigemCodigoDrift,
  caminhoDeclarado: string,
): SimboloCandidatoDrift[] {
  return ordenarCandidatos(deduplicarCandidatos(
    simbolos
      .map((candidato) => pontuarCandidatoDeclarado(candidato, origem, caminhoDeclarado))
      .filter((item): item is SimboloCandidatoDrift => Boolean(item)),
  )).slice(0, 5);
}

export function sugerirCandidatosParaTaskSemImpl(simbolos: SimboloResolvido[], nomeTask: string): SimboloCandidatoDrift[] {
  return ordenarCandidatos(deduplicarCandidatos(
    simbolos
      .map((candidato) => pontuarCandidatoPorTask(candidato, nomeTask))
      .filter((item): item is SimboloCandidatoDrift => Boolean(item)),
  )).slice(0, 5);
}

export function escolherRotasEsperadas(task: IrTask, fontesLegado: FonteLegado[]): Array<"nestjs" | "fastapi" | "flask" | "nextjs" | "firebase" | "dotnet" | "java" | "go" | "rust"> {
  const fontesTs = extrairFontesHttpTypeScript(fontesLegado);
  const fontesBackend = extrairFontesHttpBackend(fontesLegado);
  const implTsOuJs = task.implementacoesExternas.find((impl) => impl.origem === "ts" || impl.origem === "js");
  if (implTsOuJs) {
    const esperadas = new Set<"nestjs" | "nextjs" | "firebase">();
    if (/\.route\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(implTsOuJs.caminho) || /\.route\./i.test(implTsOuJs.caminho)) {
      esperadas.add("nextjs");
    }
    if (/\bcontroller\b/i.test(implTsOuJs.caminho) && fontesTs.includes("nestjs")) {
      esperadas.add("nestjs");
    }
    if (fontesTs.includes("firebase") && /(apps\.worker|worker|sema_contract_bridge|health)/i.test(implTsOuJs.caminho)) {
      esperadas.add("firebase");
    }
    if (esperadas.size > 0) {
      return [...esperadas];
    }
    if (fontesTs.length > 0) {
      return fontesTs;
    }
    return ["nestjs", "nextjs", "firebase"];
  }
  if (task.implementacoesExternas.some((impl) => impl.origem === "py")) {
    const fontesPython = fontesLegado.filter((fonte): fonte is "fastapi" | "flask" => fonte === "fastapi" || fonte === "flask");
    if (fontesPython.length > 0) {
      return fontesPython;
    }
    return ["fastapi", "flask"];
  }
  const implCs = task.implementacoesExternas.find((impl) => impl.origem === "cs");
  if (implCs) {
    return fontesBackend.includes("dotnet") ? ["dotnet"] : ["dotnet"];
  }
  const implJava = task.implementacoesExternas.find((impl) => impl.origem === "java");
  if (implJava) {
    return fontesBackend.includes("java") ? ["java"] : ["java"];
  }
  const implGo = task.implementacoesExternas.find((impl) => impl.origem === "go");
  if (implGo) {
    return fontesBackend.includes("go") ? ["go"] : ["go"];
  }
  const implRust = task.implementacoesExternas.find((impl) => impl.origem === "rust");
  if (implRust) {
    return fontesBackend.includes("rust") ? ["rust"] : ["rust"];
  }
  if (fontesTs.length > 0) {
    return fontesTs;
  }
  const fontesPython = fontesLegado.filter((fonte): fonte is "fastapi" | "flask" => fonte === "fastapi" || fonte === "flask");
  if (fontesPython.length > 0) {
    return fontesPython;
  }
  if (fontesBackend.length > 0) {
    return fontesBackend;
  }
  return [];
}

export function taskEhBridgeFirebase(task: IrTask): boolean {
  return task.implementacoesExternas.some((impl) =>
    (impl.origem === "ts" || impl.origem === "js") && /sema_contract_bridge|collections?|apps\.worker/i.test(impl.caminho));
}

export function tiposAceitosParaRecursoPersistencia(recurso: IrRecursoPersistencia): TipoRecursoDrift[] {
  switch (recurso.resourceKind) {
    case "table":
    case "view":
    case "query":
    case "index":
    case "collection":
    case "document":
    case "keyspace":
    case "stream":
      return [recurso.resourceKind];
    default:
      return [];
  }
}

export function nomesRecursoPersistencia(recurso: IrRecursoPersistencia): string[] {
  return [...new Set([
    recurso.nome,
    recurso.table,
    recurso.collection,
    recurso.entity,
    recurso.path,
    recurso.surface,
  ].filter((item): item is string => Boolean(item)))];
}

export function recursoPersistenciaCombinaAlvo(recurso: IrRecursoPersistencia, alvo: string): boolean {
  const alvoVariantes = new Set(variantesNomeRecursoDrift(alvo));
  if (alvoVariantes.size === 0) {
    return false;
  }

  return nomesRecursoPersistencia(recurso).some((nome) =>
    variantesNomeRecursoDrift(nome).some((variacao) => alvoVariantes.has(variacao)));
}

export function taskSugerePersistenciaSemBanco(
  task: IrTask,
  mapaRecursos?: Map<string, RecursoResolvido[]>,
  mapaImpl?: Map<string, SimboloResolvido>,
): boolean {
  if (task.vinculos.some((vinculo) =>
    /(?:repository|repositories|repositorio|repo|store|storage|persist|cache)/i.test(
      `${vinculo.valor} ${vinculo.arquivo ?? ""} ${vinculo.simbolo ?? ""}`,
    ))) {
    return true;
  }
  if (task.implementacoesExternas.some((impl) =>
    /(?:repository|repositories|repositorio|repo|store|storage|persist|cache)/i.test(impl.caminho))) {
    return true;
  }
  if (!mapaRecursos || !mapaImpl) {
    return false;
  }
  const arquivosPreferidos = [...coletarArquivosPreferidosPersistenciaTask(task, mapaImpl)];
  if (arquivosPreferidos.length === 0) {
    return false;
  }
  const recursos = deduplicarRecursosResolvidos([...mapaRecursos.values()].flat());
  return recursos.some((recurso) =>
    recurso.origem === "arquivo"
    && arquivosPreferidos.some((arquivo) => arquivoCombinaDeclaradoDrift(recurso.arquivo, arquivo)));
}
