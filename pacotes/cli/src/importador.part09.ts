// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { compilarProjeto, formatarCodigo, temErros, type Diagnostico } from "@sema/nucleo";
import { normalizarSegmentoModulo } from "@sema/padroes";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { extrairRotasPhp, extrairSimbolosPhp } from "./php-http.js";
import { extrairParametrosCaminhoFlask, extrairRotasFlaskDecoradas } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import {
  extrairRotasTypeScriptHttp,
  inferirSemanticaHandlerTypeScriptHttp,
  localizarExportacaoTypeScriptHttp,
  type CampoInferidoTypeScriptHttp,
} from "./typescript-http.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";

import { ArquivoImportado, FonteImportacao, ModuloImportado, ResultadoImportacao, RotaImportada, TarefaImportada, inferirContextoPorArquivo, inferirNamespaceBase, listarArquivosRecursivos, paraSnakeCase } from "./importador.part01.js";
import { camposDeParametrosRotaBackend, criarCampoResultadoBackend, descreverEfeitosPorHeuristica, inferirDatabasesPorHeuristica, mapearTipoBackendParaSema } from "./importador.part02.js";
import { caminhoImplGenerico, importarFirebaseBase } from "./importador.part07.js";
import { acumularModuloImportado, criarModuloImportadoSimples, importarDartBase, importarDotnetBase, importarPythonBase, resolverArquivoRustParaSimbolo, selecionarSimbolosPreferidos } from "./importador.part08.js";
import { importarNextJsBase, importarTypeScriptBase } from "./importador.part06.js";
import { importarAngularConsumerBase, importarFlutterConsumerBase, importarNextJsConsumerBase, importarReactViteConsumerBase } from "./importador.part04.js";
import { formatarModuloImportado, moduloParaCodigo, montarArquivoImportado } from "./importador.part05.js";

export async function importarJavaBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".java"]))
    .filter((arquivo) => !/(^|[\\/])(target|build|out|Test[s]?)([\\/]|$)/i.test(arquivo));
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao, { preservarUltimo: true, snakeCaseUltimo: true });
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const simbolo of extrairSimbolosJava(texto)) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: criarCampoResultadoBackend(simbolo.retorno),
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { java: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    for (const rota of extrairRotasJava(texto)) {
      const taskNome = paraSnakeCase(rota.simbolo.split(".").at(-1) ?? rota.simbolo);
      const output = criarCampoResultadoBackend(rota.retorno);
      tasks.push({
        nome: taskNome,
        resumo: `Task HTTP Spring Boot importada automaticamente de ${relacao}#${rota.simbolo}.`,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output,
        errors: [],
        effects: [{ categoria: "consulta", alvo: "http", criticidade: "media" }],
        impl: { java: caminhoImplGenerico(diretorio, arquivo, rota.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: rota.simbolo,
      });
      routes.push({
        nome: `${taskNome}_publico`,
        resumo: `Rota Spring Boot importada automaticamente de ${relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output,
        errors: [],
      });
    }

    if (tasks.length === 0 && routes.length === 0) {
      continue;
    }

    acumularModuloImportado(modulos, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      routes,
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));
  }

  return [...modulos.values()];
}

export async function importarGoBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".go"]);
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const simbolo of extrairSimbolosGo(texto)) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: criarCampoResultadoBackend(simbolo.retorno),
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { go: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    for (const rota of extrairRotasGo(texto)) {
      const taskNome = paraSnakeCase(rota.simbolo.split(".").at(-1) ?? rota.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task HTTP Go importada automaticamente de ${relacao}#${rota.simbolo}.`,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
        effects: [{ categoria: "consulta", alvo: "http", criticidade: "media" }],
        impl: { go: caminhoImplGenerico(diretorio, arquivo, rota.simbolo) },
        origemArquivo: relacao,
        origemSimbolo: rota.simbolo,
      });
      routes.push({
        nome: `${taskNome}_publico`,
        resumo: `Rota Go importada automaticamente de ${relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
      });
    }

    if (tasks.length === 0 && routes.length === 0) {
      continue;
    }

    modulos.set(nomeModulo, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      routes,
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));
  }

  return [...modulos.values()];
}

export async function importarRustBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".rs"]);
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const simbolo of extrairSimbolosRust(texto)) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: criarCampoResultadoBackend(simbolo.retorno),
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { rust: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    acumularModuloImportado(modulos, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      routes,
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));

    for (const rota of extrairRotasRust(texto)) {
      const simboloLimpo = rota.simbolo.replace(/::/g, ".");
      const nomeSimbolo = simboloLimpo.split(".").at(-1) ?? simboloLimpo;
      const arquivoAlvo = await resolverArquivoRustParaSimbolo(diretorio, relacao, simboloLimpo);
      const relacaoAlvo = path.relative(diretorio, arquivoAlvo);
      const moduloAlvo = [namespaceBase, ...inferirContextoPorArquivo(relacaoAlvo)].join(".");
      const taskNome = paraSnakeCase(rota.simbolo.split(".").at(-1) ?? rota.simbolo);
      const task: TarefaImportada = {
        nome: taskNome,
        resumo: `Task HTTP Axum importada automaticamente de ${relacao}#${rota.simbolo}.`,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
        effects: [{ categoria: "consulta", alvo: "http", criticidade: "media" }],
        impl: { rust: caminhoImplGenerico(diretorio, arquivoAlvo, nomeSimbolo) },
        origemArquivo: relacaoAlvo,
        origemSimbolo: nomeSimbolo,
      };
      const route: RotaImportada = {
        nome: `${taskNome}_publico`,
        resumo: `Rota Axum importada automaticamente de ${relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
      };
      acumularModuloImportado(modulos, criarModuloImportadoSimples(
        moduloAlvo,
        `Rascunho Sema importado automaticamente de ${relacaoAlvo}.`,
        [task],
        [route],
        [],
        inferirDatabasesPorHeuristica(texto, relacao),
      ));
    }
  }

  return [...modulos.values()];
}

export async function importarCppBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".cpp", ".cc", ".cxx", ".hpp", ".h"]))
    .filter((arquivo) => !/(^|[\\/])(windows|linux|macos|runner|flutter|ephemeral|build|vendor)([\\/]|$)/i.test(arquivo));
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];

    for (const simbolo of selecionarSimbolosPreferidos(extrairSimbolosCpp(texto))) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { cpp: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    if (tasks.length === 0) {
      continue;
    }

    acumularModuloImportado(modulos, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      [],
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));
  }

  return [...modulos.values()];
}

export async function importarPhpBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".php"]))
    .filter((arquivo) => !/(^|[\\/])(vendor|storage|bootstrap[\\/]cache|cache|tests?)([\\/]|$)/i.test(arquivo));
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao, { preservarUltimo: true, snakeCaseUltimo: true });
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const simbolo of extrairSimbolosPhp(texto)) {
      const taskNome = paraSnakeCase(simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo);
      tasks.push({
        nome: taskNome,
        resumo: `Task PHP importada automaticamente de ${relacao}#${simbolo.simbolo}.`,
        input: simbolo.parametros.map((parametro) => ({
          nome: paraSnakeCase(parametro.nome),
          tipo: mapearTipoBackendParaSema(parametro.tipoTexto),
          obrigatorio: parametro.obrigatorio,
        })),
        output: criarCampoResultadoBackend(simbolo.retorno),
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { php: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    for (const rota of extrairRotasPhp(texto)) {
      const taskNome = paraSnakeCase(rota.simbolo.split(".").at(-1) ?? rota.simbolo);
      const output = criarCampoResultadoBackend(rota.retorno);
      tasks.push({
        nome: taskNome,
        resumo: `Task HTTP PHP importada automaticamente de ${relacao}#${rota.simbolo}.`,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output,
        errors: [],
        effects: [{ categoria: "consulta", alvo: "http", criticidade: "media" }],
        impl: { php: caminhoImplGenerico(diretorio, arquivo, rota.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: rota.simbolo,
      });
      routes.push({
        nome: `${taskNome}_publico`,
        resumo: `Rota PHP importada automaticamente de ${relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output,
        errors: [],
      });
    }

    if (tasks.length === 0 && routes.length === 0) {
      continue;
    }

    acumularModuloImportado(modulos, criarModuloImportadoSimples(
      nomeModulo,
      `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks,
      routes,
      [],
      inferirDatabasesPorHeuristica(texto, relacao),
    ));
  }

  return [...modulos.values()];
}

export async function importarProjetoLegado(
  fonte: FonteImportacao,
  diretorio: string,
  namespaceBase?: string,
): Promise<ResultadoImportacao> {
  const base = path.resolve(diretorio);
  const namespace = inferirNamespaceBase(base, namespaceBase);

  let modulos: ModuloImportado[] = [];
  if (fonte === "nestjs") {
    modulos = await importarTypeScriptBase(base, namespace, true);
  } else if (fonte === "nextjs") {
    modulos = await importarNextJsBase(base, namespace);
  } else if (fonte === "nextjs-consumer") {
    modulos = await importarNextJsConsumerBase(base, namespace);
  } else if (fonte === "react-vite-consumer") {
    modulos = await importarReactViteConsumerBase(base, namespace);
  } else if (fonte === "angular-consumer") {
    modulos = await importarAngularConsumerBase(base, namespace);
  } else if (fonte === "flutter-consumer") {
    modulos = await importarFlutterConsumerBase(base, namespace);
  } else if (fonte === "firebase") {
    modulos = await importarFirebaseBase(base, namespace);
  } else if (fonte === "typescript") {
    modulos = await importarTypeScriptBase(base, namespace, false);
  } else if (fonte === "fastapi") {
    modulos = await importarPythonBase(base, namespace, "fastapi");
  } else if (fonte === "flask") {
    modulos = await importarPythonBase(base, namespace, "flask");
  } else if (fonte === "python") {
    modulos = await importarPythonBase(base, namespace, "nenhum");
  } else if (fonte === "dart") {
    modulos = await importarDartBase(base, namespace);
  } else if (fonte === "dotnet") {
    modulos = await importarDotnetBase(base, namespace);
  } else if (fonte === "java") {
    modulos = await importarJavaBase(base, namespace);
  } else if (fonte === "go") {
    modulos = await importarGoBase(base, namespace);
  } else if (fonte === "rust") {
    modulos = await importarRustBase(base, namespace);
  } else if (fonte === "cpp") {
    modulos = await importarCppBase(base, namespace);
  } else if (fonte === "php") {
    modulos = await importarPhpBase(base, namespace);
  }

  const arquivos: ArquivoImportado[] = [];
  for (const modulo of modulos) {
    const bruto = moduloParaCodigo(modulo);
    const formatado = await formatarModuloImportado(bruto, `${modulo.nome}.sema`);
    arquivos.push(montarArquivoImportado(modulo, namespace, formatado));
  }

  const diagnosticos = compilarProjeto(
    arquivos.map((arquivo) => ({
      caminho: path.join(base, ".tmp", "importado", arquivo.caminhoRelativo),
      codigo: arquivo.conteudo,
    })),
  ).diagnosticos;

  return {
    fonte,
    diretorio: base,
    namespaceBase: namespace,
    arquivos,
    diagnosticos,
  };
}

export function resumoImportacao(resultado: ResultadoImportacao): {
  modulos: number;
  tarefas: number;
  rotas: number;
  entidades: number;
  enums: number;
  databases: number;
  diagnosticos: number;
  sucesso: boolean;
} {
  return {
    modulos: resultado.arquivos.length,
    tarefas: resultado.arquivos.reduce((total, arquivo) => total + arquivo.tarefas, 0),
    rotas: resultado.arquivos.reduce((total, arquivo) => total + arquivo.rotas, 0),
    entidades: resultado.arquivos.reduce((total, arquivo) => total + arquivo.entidades, 0),
    enums: resultado.arquivos.reduce((total, arquivo) => total + arquivo.enums, 0),
    databases: resultado.arquivos.reduce((total, arquivo) => total + arquivo.databases, 0),
    diagnosticos: resultado.diagnosticos.length,
    sucesso: !temErros(resultado.diagnosticos),
  };
}
