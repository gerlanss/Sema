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
import { extrairParametrosCaminhoFlask, extrairRotasFlaskDecoradas } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import {
  extrairRotasTypeScriptHttp,
  inferirSemanticaHandlerTypeScriptHttp,
  localizarExportacaoTypeScriptHttp,
  type CampoInferidoTypeScriptHttp,
} from "./typescript-http.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";

import { ModoHttpPython, caminhoImplDart, caminhoImplGenerico, caminhoImplPython, criarEntidadesPython, criarInputRotaFlask, expandirCamposPython, extrairErrosPython, extrairTiposPython } from "./importador.part07.js";
import { DatabaseImportado, ModuloImportado, RotaImportada, TarefaImportada, TipoPythonDescoberto, VinculoImportado, inferirContextoPorArquivo, juntarCaminhoHttp, listarArquivosRecursivos, mapearTipoPrimitivo, paraSnakeCase } from "./importador.part01.js";
import { deduplicarCampos } from "./importador.part04.js";
import { camposDeParametrosRotaBackend, criarCampoResultadoBackend, deduplicarDatabases, descreverEfeitosPorHeuristica, inferirDatabasesPorHeuristica, mapearTipoBackendParaSema } from "./importador.part02.js";
import { deduplicarEntidades, deduplicarEnums, deduplicarRotas, deduplicarTarefas, deduplicarVinculos, sincronizarRotasComTasks } from "./importador.part05.js";

export async function importarPythonBase(
  diretorio: string,
  namespaceBase: string,
  modoHttp: ModoHttpPython = "nenhum",
): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".py"]))
    .filter((arquivo) => !arquivo.endsWith("__init__.py") && !/tests?[\\/]/i.test(arquivo));

  const textos = new Map<string, string>();
  const tiposGlobais = new Map<string, TipoPythonDescoberto>();
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    textos.set(arquivo, texto);
    for (const [nome, tipo] of extrairTiposPython(texto)) {
      if (!tiposGlobais.has(nome)) {
        tiposGlobais.set(nome, tipo);
      }
    }
  }

  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = textos.get(arquivo)!;
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    if (modoHttp === "fastapi") {
      const prefixo = texto.match(/APIRouter\s*\(\s*prefix\s*=\s*["']([^"']+)["']/)?.[1];
      const routeRegex = /@(?:router|app)\.(get|post|put|patch|delete)\(([^)]*)\)\s*\n(?:async\s+)?def\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/g;
      for (const match of texto.matchAll(routeRegex)) {
        const metodo = match[1]!.toUpperCase();
        const argumentoDecorator = match[2] ?? "";
        const sufixo = argumentoDecorator.match(/["']([^"']+)["']/)?.[1];
        const nomeFuncao = match[3]!;
        const parametros = match[4]!;
        const retorno = match[5]?.trim();
        const routeInput = parametros
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item) => !item.startsWith("self") && !item.startsWith("cls"))
          .flatMap((item) => {
            const [nome, tipo] = item.split(":").map((parte) => parte.trim());
            const obrigatorio = !item.includes("=");
            return expandirCamposPython(nome, tipo, tiposGlobais, entitiesRef, enumsRef, obrigatorio);
          });
        const routeOutput = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposPython("resultado", retorno, tiposGlobais, entitiesRef, enumsRef, false));
        const taskNome = paraSnakeCase(nomeFuncao);
        routes.push({
          nome: `${taskNome}_publico`,
          resumo: `Rota FastAPI importada automaticamente de ${relacao}#${nomeFuncao}.`,
          metodo,
          caminho: juntarCaminhoHttp(prefixo, sufixo),
          task: taskNome,
          input: deduplicarCampos(routeInput),
          output: routeOutput,
          errors: [],
        });
      }
    } else if (modoHttp === "flask") {
      for (const rota of extrairRotasFlaskDecoradas(texto)) {
        const taskNome = paraSnakeCase(rota.nomeFuncao);
        const nomeBase = `${taskNome}_publico`;
        const nome = routes.some((route) => route.nome === nomeBase)
          ? `${taskNome}_${rota.metodo.toLowerCase()}_publico`
          : nomeBase;
        routes.push({
          nome,
          resumo: `Rota Flask importada automaticamente de ${relacao}#${rota.nomeFuncao}.`,
          metodo: rota.metodo,
          caminho: rota.caminho,
          task: taskNome,
          input: deduplicarCampos(criarInputRotaFlask(rota.caminho, rota.parametros, tiposGlobais, entitiesRef, enumsRef)),
          output: [],
          errors: [],
        });
      }
    }

    const funcRegex = /^(async\s+def|def)\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm;
    for (const match of texto.matchAll(funcRegex)) {
      const nomeFuncao = match[2]!;
      if (nomeFuncao.startsWith("_")) {
        continue;
      }
      const parametros = match[3]!;
      const retorno = match[4]?.trim();
      const inicioCorpo = match.index ?? 0;
      const trecho = texto.slice(inicioCorpo, Math.min(texto.length, inicioCorpo + 1500));
      const input = parametros
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => !item.startsWith("self") && !item.startsWith("cls"))
        .flatMap((item) => {
          const [nome, tipo] = item.split(":").map((parte) => parte.trim());
          const obrigatorio = !item.includes("=");
          return expandirCamposPython(nome, tipo, tiposGlobais, entitiesRef, enumsRef, obrigatorio);
        });
      const output = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
        ? []
        : deduplicarCampos(expandirCamposPython("resultado", retorno, tiposGlobais, entitiesRef, enumsRef, false));
      tasks.push({
        nome: paraSnakeCase(nomeFuncao),
        resumo: `Task importada automaticamente de ${relacao}#${nomeFuncao}.`,
        input: deduplicarCampos(input),
        output,
        errors: extrairErrosPython(trecho),
        effects: descreverEfeitosPorHeuristica(trecho),
        impl: { py: caminhoImplPython(diretorio, arquivo, nomeFuncao) },
        origemArquivo: relacao,
        origemSimbolo: nomeFuncao,
      });
    }

    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm;
    for (const match of texto.matchAll(classRegex)) {
      const nomeClasse = match[1]!;
      const bases = match[2] ?? "";
      const corpo = match[3]!;
      if (/(BaseModel|Enum|StrEnum)/.test(bases)) {
        continue;
      }
      for (const metodo of corpo.matchAll(/^\s{4}(?:async\s+def|def)\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm)) {
        const nomeMetodo = metodo[1]!;
        if (nomeMetodo.startsWith("_")) {
          continue;
        }
        const parametros = metodo[2]!;
        const retorno = metodo[3]?.trim();
        const input = parametros
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item) => !item.startsWith("self") && !item.startsWith("cls"))
          .flatMap((item) => {
            const [nome, tipo] = item.split(":").map((parte) => parte.trim());
            const obrigatorio = !item.includes("=");
            return expandirCamposPython(nome, tipo, tiposGlobais, entitiesRef, enumsRef, obrigatorio);
          });
        const output = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposPython("resultado", retorno, tiposGlobais, entitiesRef, enumsRef, false));
        tasks.push({
          nome: paraSnakeCase(nomeMetodo),
          resumo: `Task importada automaticamente de ${relacao}#${nomeClasse}.${nomeMetodo}.`,
          input: deduplicarCampos(input),
          output,
          errors: extrairErrosPython(corpo),
          effects: descreverEfeitosPorHeuristica(corpo),
          impl: { py: caminhoImplPython(diretorio, arquivo, `${nomeClasse}.${nomeMetodo}`) },
          origemArquivo: relacao,
          origemSimbolo: `${nomeClasse}.${nomeMetodo}`,
        });
      }
    }

    if (!tasks.length && !routes.length) {
      continue;
    }

    const { entities, enums } = criarEntidadesPython(tiposGlobais, entitiesRef, enumsRef);
    sincronizarRotasComTasks(routes, tasks);
    modulos.set(nomeModulo, {
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: deduplicarRotas(routes),
      entities,
      enums,
    });
  }

  return [...modulos.values()];
}

export async function importarDartBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".dart"]))
    .filter((arquivo) => !arquivo.endsWith(".g.dart") && !arquivo.endsWith(".freezed.dart"));
  const modulos: ModuloImportado[] = [];

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];

    for (const match of texto.matchAll(/(?:Future<([^\n]+)>|([\w?<>.,\s]+))\s+(\w+)\(([^)]*)\)\s*(?:async\s*)?\{/g)) {
      const retorno = (match[1] ?? match[2] ?? "").trim();
      const nome = match[3]!;
      if (["build", "toString", "hashCode"].includes(nome)) {
        continue;
      }
      const parametros = match[4]!;
      const input = parametros
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.replace(/^(required|final)\s+/g, ""))
        .map((item) => {
          const partes = item.split(/\s+/);
          const nomeParametro = partes.at(-1) ?? "param";
          const tipoParametro = partes.length > 1 ? partes.slice(0, -1).join(" ") : undefined;
          return {
            nome: paraSnakeCase(nomeParametro),
            tipo: mapearTipoPrimitivo(tipoParametro ?? "Json"),
            obrigatorio: item.includes("required"),
          };
        });
      const output = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
        ? []
        : [{ nome: "resultado", tipo: mapearTipoPrimitivo(retorno || "Json"), obrigatorio: false }];
      tasks.push({
        nome: paraSnakeCase(nome),
        resumo: `Task importada automaticamente de ${relacao}#${nome}.`,
        input,
        output,
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { dart: caminhoImplDart(diretorio, arquivo, nome) },
        origemArquivo: relacao,
        origemSimbolo: nome,
      });
    }

    if (tasks.length === 0) {
      continue;
    }

    modulos.push({
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: [],
      entities: [],
      enums: [],
    });
  }

  return modulos;
}

export function criarModuloImportadoSimples(
  nome: string,
  resumo: string,
  tasks: TarefaImportada[],
  routes: RotaImportada[] = [],
  vinculos: VinculoImportado[] = [],
  databases: DatabaseImportado[] = [],
): ModuloImportado {
  sincronizarRotasComTasks(routes, tasks);
  return {
    nome,
    resumo,
    tasks: deduplicarTarefas(tasks),
    routes: deduplicarRotas(routes),
    entities: [],
    enums: [],
    databases: deduplicarDatabases(databases),
    vinculos: deduplicarVinculos(vinculos),
  };
}

export function acumularModuloImportado(
  modulos: Map<string, ModuloImportado>,
  modulo: ModuloImportado,
): void {
  const existente = modulos.get(modulo.nome);
  if (!existente) {
    modulos.set(modulo.nome, modulo);
    return;
  }

  existente.tasks = deduplicarTarefas([...existente.tasks, ...modulo.tasks]);
  existente.routes = deduplicarRotas([...existente.routes, ...modulo.routes]);
  existente.entities = deduplicarEntidades([...existente.entities, ...modulo.entities]);
  existente.enums = deduplicarEnums([...existente.enums, ...modulo.enums]);
  existente.databases = deduplicarDatabases([...(existente.databases ?? []), ...(modulo.databases ?? [])]);
  existente.vinculos = deduplicarVinculos([...(existente.vinculos ?? []), ...(modulo.vinculos ?? [])]);
}

export function selecionarSimbolosPreferidos<T extends { simbolo: string }>(simbolos: T[]): T[] {
  const mapa = new Map<string, T>();
  for (const simbolo of simbolos) {
    const chave = simbolo.simbolo.split(".").at(-1) ?? simbolo.simbolo;
    const existente = mapa.get(chave);
    if (!existente) {
      mapa.set(chave, simbolo);
      continue;
    }
    const pontuacaoAtual = simbolo.simbolo.split(".").length;
    const pontuacaoExistente = existente.simbolo.split(".").length;
    if (pontuacaoAtual > pontuacaoExistente) {
      mapa.set(chave, simbolo);
    }
  }
  return [...mapa.values()];
}

export async function existeArquivo(caminho: string): Promise<boolean> {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

export async function resolverArquivoRustParaSimbolo(
  diretorio: string,
  relacaoFonte: string,
  simbolo: string,
): Promise<string> {
  const partes = simbolo.split(".").filter(Boolean);
  if (partes.length <= 1) {
    return path.join(diretorio, relacaoFonte);
  }

  const moduloPartes = partes.slice(0, -1);
  const baseAtual = path.dirname(relacaoFonte);
  const candidatos = [
    path.join(baseAtual, ...moduloPartes) + ".rs",
    path.join(baseAtual, ...moduloPartes, "mod.rs"),
    path.join("src", ...moduloPartes) + ".rs",
    path.join("src", ...moduloPartes, "mod.rs"),
  ];

  for (const candidato of candidatos) {
    const absoluto = path.join(diretorio, candidato);
    if (await existeArquivo(absoluto)) {
      return absoluto;
    }
  }

  return path.join(diretorio, relacaoFonte);
}

export async function importarDotnetBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".cs"]))
    .filter((arquivo) => !/(^|[\\/])(bin|obj|Test[s]?)([\\/]|$)/i.test(arquivo));
  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao, { preservarUltimo: true, snakeCaseUltimo: true });
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const simbolo of extrairSimbolosDotnet(texto)) {
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
        impl: { cs: caminhoImplGenerico(diretorio, arquivo, simbolo.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: simbolo.simbolo,
      });
    }

    for (const rota of extrairRotasDotnet(texto)) {
      const taskNome = paraSnakeCase(rota.simbolo.split(".").at(-1) ?? rota.simbolo);
      const output = criarCampoResultadoBackend(rota.retorno);
      tasks.push({
        nome: taskNome,
        resumo: `Task HTTP ASP.NET Core importada automaticamente de ${relacao}#${rota.simbolo}.`,
        input: camposDeParametrosRotaBackend(rota.parametros),
        output,
        errors: [],
        effects: [{ categoria: "consulta", alvo: "http", criticidade: "media" }],
        impl: { cs: caminhoImplGenerico(diretorio, arquivo, rota.simbolo, { snakeCaseUltimoArquivo: true }) },
        origemArquivo: relacao,
        origemSimbolo: rota.simbolo,
      });
      routes.push({
        nome: `${taskNome}_publico`,
        resumo: `Rota ASP.NET Core importada automaticamente de ${relacao}#${rota.simbolo}.`,
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
