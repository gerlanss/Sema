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
  extrairRotasExpressFastify,
  extrairRotasTypeScriptHttp,
  inferirSemanticaHandlerTypeScriptHttp,
  localizarExportacaoTypeScriptHttp,
  type CampoInferidoTypeScriptHttp,
} from "./typescript-http.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";

import { CampoImportado, ModuloImportado, RotaImportada, TarefaImportada, TipoDescoberto, extrairTextoLiteral, inferirContextoPorArquivo, juntarCaminhoHttp, lerDecorator, listarArquivosRecursivos, mapearTipoPrimitivo, paraSnakeCase } from "./importador.part01.js";
import { deduplicarCampos, extrairChamadaServiceTs } from "./importador.part04.js";
import { caminhoImplTs, camposDeSemanticaTypeScriptHttp, criarEntidadesReferenciadas, descreverEfeitosPorHeuristica, expandirCamposTs, extrairErrosTs } from "./importador.part02.js";
import { consolidarTiposTs, deduplicarEntidades, deduplicarEnums, deduplicarErros, deduplicarRotas, deduplicarTarefas, sincronizarRotasComTasks } from "./importador.part05.js";
import { camposEstruturadosTypeScriptHttp, errosPorStatusHttp, resolverEscopoImportacaoNextJs } from "./importador.part03.js";

export function importarNestJsDeArquivo(
  diretorioBase: string,
  arquivo: string,
  namespaceBase: string,
  tiposGlobais: Map<string, TipoDescoberto>,
): ModuloImportado[] {
  const relacao = path.relative(diretorioBase, arquivo);
  const codigo = ts.sys.readFile(arquivo, "utf8") ?? "";
  const sourceFile = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const contextoSegmentos = inferirContextoPorArquivo(relacao);
  const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
  const entitiesRef = new Set<string>();
  const enumsRef = new Set<string>();
  const tasks: TarefaImportada[] = [];
  const routes: RotaImportada[] = [];

  for (const node of sourceFile.statements) {
    if (!ts.isClassDeclaration(node)) {
      continue;
    }

    const controllerDecorator = lerDecorator(node, ["Controller"]);
    if (controllerDecorator) {
      const basePath = extrairTextoLiteral(controllerDecorator.argumentos[0]);
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !member.body) {
          continue;
        }
        const httpDecorator = lerDecorator(member, ["Get", "Post", "Put", "Patch", "Delete"]);
        if (!httpDecorator) {
          continue;
        }
        const taskOriginal = extrairChamadaServiceTs(member.body) ?? member.name.getText(sourceFile);
        const taskNome = paraSnakeCase(taskOriginal);
        const routeInput = member.parameters.flatMap((parametro) =>
          expandirCamposTs(
            parametro.name.getText(sourceFile),
            parametro.type?.getText(sourceFile),
            tiposGlobais,
            entitiesRef,
            enumsRef,
            !parametro.questionToken,
          ));
        const routeOutputTipo = member.type?.getText(sourceFile);
        const routeOutput = !routeOutputTipo || mapearTipoPrimitivo(routeOutputTipo) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", routeOutputTipo, tiposGlobais, entitiesRef, enumsRef, false));

        routes.push({
          nome: `${taskNome}_publico`,
          resumo: `Rota importada automaticamente de ${relacao}#${member.name.getText(sourceFile)}.`,
          metodo: httpDecorator.nome.toUpperCase(),
          caminho: juntarCaminhoHttp(basePath, extrairTextoLiteral(httpDecorator.argumentos[0])),
          task: taskNome,
          input: deduplicarCampos(routeInput),
          output: routeOutput,
          errors: [],
        });
      }
    }

    if (!node.name?.text.endsWith("Service")) {
      continue;
    }
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !member.body || !member.name) {
        continue;
      }
      if (member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
        continue;
      }
      const nomeMetodo = member.name.getText(sourceFile);
      if (nomeMetodo === "constructor") {
        continue;
      }
      const input = member.parameters.flatMap((parametro) =>
        expandirCamposTs(
          parametro.name.getText(sourceFile),
          parametro.type?.getText(sourceFile),
          tiposGlobais,
          entitiesRef,
          enumsRef,
          !parametro.questionToken,
        ));
      const output = member.type?.getText(sourceFile) && mapearTipoPrimitivo(member.type.getText(sourceFile)) === "Vazio"
        ? []
        : deduplicarCampos(expandirCamposTs("resultado", member.type?.getText(sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
      tasks.push({
        nome: paraSnakeCase(nomeMetodo),
        resumo: `Task importada automaticamente de ${relacao}#${nomeMetodo}.`,
        input: deduplicarCampos(input),
        output,
        errors: extrairErrosTs(member.body, sourceFile),
        effects: descreverEfeitosPorHeuristica(member.body.getText(sourceFile)),
        impl: { ts: caminhoImplTs(diretorioBase, arquivo, nomeMetodo) },
        origemArquivo: relacao,
        origemSimbolo: nomeMetodo,
      });
    }
  }

  if (!tasks.length && !routes.length) {
    return [];
  }

  const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
  sincronizarRotasComTasks(routes, tasks);

  return [{
    nome: nomeModulo,
    resumo: `Rascunho Sema importado de um contexto NestJS legado em ${contextoSegmentos.join("/")}.`,
    entities,
    enums,
    tasks: deduplicarTarefas(tasks),
    routes: deduplicarRotas(routes),
  }];
}

function nomearTarefaRotaChamada(metodo: string, caminho: string): string {
  const ultimoSegmento = caminho.replace(/\{[^}]+\}/g, "").split("/").filter(Boolean).pop() ?? "recurso";
  const singular = ultimoSegmento.length > 3 && /es$/.test(ultimoSegmento)
    ? ultimoSegmento.replace(/es$/, "")
    : ultimoSegmento.replace(/s$/, "");
  switch (metodo) {
    case "POST":
      return `criar_${singular}`;
    case "PUT":
    case "PATCH":
      return `atualizar_${singular}`;
    case "DELETE":
      return `remover_${singular}`;
    case "GET":
      return caminho.includes("{") ? `obter_${singular}` : `listar_${ultimoSegmento}`;
    default:
      return `${metodo.toLowerCase()}_${ultimoSegmento}`;
  }
}

export function importarExpressFastifyDeArquivo(
  diretorioBase: string,
  arquivo: string,
  namespaceBase: string,
  origemDesejada: "express" | "fastify" | "koa",
): ModuloImportado[] {
  const relacao = path.relative(diretorioBase, arquivo);
  const codigo = ts.sys.readFile(arquivo, "utf8") ?? "";
  const sourceFile = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const contextoSegmentos = inferirContextoPorArquivo(relacao);
  const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
  const rotasArquivo = extrairRotasExpressFastify(sourceFile).filter((rota) => rota.origem === origemDesejada);
  if (rotasArquivo.length === 0) {
    return [];
  }

  const tasks: TarefaImportada[] = [];
  const routes: RotaImportada[] = [];
  for (const rota of rotasArquivo) {
    const taskNome = nomearTarefaRotaChamada(rota.metodo, rota.caminho);
    const implSimbolo = /^[A-Za-z_]\w*$/.test(rota.simbolo) ? rota.simbolo : undefined;
    const semantica = implSimbolo
      ? inferirSemanticaHandlerTypeScriptHttp(sourceFile, implSimbolo, true)
      : undefined;
    const converterCampoInferido = (campo: { nome: string; tipoTexto?: string; obrigatorio: boolean }) => ({
      nome: campo.nome,
      tipo: mapearTipoPrimitivo(campo.tipoTexto ?? "string") === "Vazio" ? "Texto" : mapearTipoPrimitivo(campo.tipoTexto ?? "string"),
      obrigatorio: campo.obrigatorio,
    });
    const camposInferidos = deduplicarCampos([
      ...rota.parametros.map((parametro) => ({
        nome: parametro.nome,
        tipo: parametro.tipoSema,
        obrigatorio: true,
      })),
      ...(semantica?.query ?? []).map(converterCampoInferido),
      ...(semantica?.body ?? []).map(converterCampoInferido),
    ]);
    const camposResposta = deduplicarCampos((semantica?.response ?? []).map(converterCampoInferido));
    tasks.push({
      nome: taskNome,
      resumo: `Task importada automaticamente da rota ${rota.metodo} ${rota.caminho} em ${relacao}.`,
      input: camposInferidos,
      output: camposResposta,
      errors: [],
      effects: [],
      impl: implSimbolo ? { ts: caminhoImplTs(diretorioBase, arquivo, implSimbolo) } : undefined,
      origemArquivo: relacao,
      origemSimbolo: rota.simbolo,
    });
    routes.push({
      nome: `${taskNome}_publico`,
      resumo: `Rota ${origemDesejada} importada automaticamente de ${relacao}.`,
      metodo: rota.metodo,
      caminho: rota.caminho,
      task: taskNome,
      input: camposInferidos,
      output: camposResposta,
      errors: [],
    });
  }

  const { entities, enums } = criarEntidadesReferenciadas(new Map(), new Set(), new Set());
  sincronizarRotasComTasks(routes, tasks);

  return [{
    nome: nomeModulo,
    resumo: `Rascunho Sema importado de um contexto ${origemDesejada === "express" ? "Express" : origemDesejada === "koa" ? "Koa" : "Fastify"} legado em ${contextoSegmentos.join("/")}.`,
    entities,
    enums,
    tasks: deduplicarTarefas(tasks),
    routes: deduplicarRotas(routes),
  }];
}

export async function importarExpressFastifyBase(
  diretorio: string,
  namespaceBase: string,
  origem: "express" | "fastify" | "koa",
): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".ts"]);
  const uteis = arquivos.filter((arquivo) =>
    !arquivo.endsWith(".spec.ts")
    && !arquivo.endsWith(".test.ts")
    && !arquivo.endsWith(".d.ts"));

  const modulos: ModuloImportado[] = [];
  for (const arquivo of uteis) {
    modulos.push(...importarExpressFastifyDeArquivo(diretorio, arquivo, namespaceBase, origem));
  }
  return modulos;
}

export async function importarTypeScriptBase(
  diretorio: string,
  namespaceBase: string,
  modoNestjs = false,
): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".ts"]);
  const uteis = arquivos.filter((arquivo) =>
    !arquivo.endsWith(".spec.ts")
    && !arquivo.endsWith(".test.ts")
    && !arquivo.endsWith(".d.ts")
    && !(modoNestjs && !arquivo.endsWith(".controller.ts") && !arquivo.endsWith(".service.ts")),
  );
  const contextosTodos = await Promise.all(arquivos
    .filter((arquivo) => !arquivo.endsWith(".spec.ts") && !arquivo.endsWith(".test.ts") && !arquivo.endsWith(".d.ts"))
    .map(async (arquivo) => {
      const texto = await readFile(arquivo, "utf8");
      return {
        sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
        texto,
        relacao: path.relative(diretorio, arquivo),
      };
    }));
  const contextos = await Promise.all(uteis.map(async (arquivo) => {
    const texto = await readFile(arquivo, "utf8");
    return {
      sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
      texto,
      relacao: path.relative(diretorio, arquivo),
    };
  }));
  const tiposGlobais = consolidarTiposTs(contextosTodos);
  const modulos = new Map<string, ModuloImportado>();

  if (modoNestjs) {
    for (const contexto of contextos) {
      for (const modulo of importarNestJsDeArquivo(diretorio, path.join(diretorio, contexto.relacao), namespaceBase, tiposGlobais)) {
        const existente = modulos.get(modulo.nome);
        if (!existente) {
          modulos.set(modulo.nome, modulo);
          continue;
        }
        existente.tasks = deduplicarTarefas([...existente.tasks, ...modulo.tasks]);
        existente.routes = deduplicarRotas([...existente.routes, ...modulo.routes]);
        existente.entities = deduplicarEntidades([...existente.entities, ...modulo.entities]);
        existente.enums = deduplicarEnums([...existente.enums, ...modulo.enums]);
      }
    }
    return [...modulos.values()];
  }

  for (const contexto of contextos) {
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const contextoSegmentos = inferirContextoPorArquivo(contexto.relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];

    contexto.sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nome = node.name.text;
        const input = node.parameters.flatMap((parametro) =>
          expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
        const output = node.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(node.type.getText(contexto.sourceFile)) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", node.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
        const errors = node.body ? extrairErrosTs(node.body, contexto.sourceFile) : [];
        const effects = node.body ? descreverEfeitosPorHeuristica(node.body.getText(contexto.sourceFile)) : [];
        tasks.push({
          nome: paraSnakeCase(nome),
          resumo: `Task importada automaticamente de ${contexto.relacao}#${nome}.`,
          input: deduplicarCampos(input),
          output,
          errors,
          effects,
          impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), nome) },
          origemArquivo: contexto.relacao,
          origemSimbolo: nome,
        });
      }

      if (ts.isClassDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nomeClasse = node.name.text;
        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member) || !member.name || !member.body) {
            continue;
          }
          if (member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
            continue;
          }
          const nomeMetodo = member.name.getText(contexto.sourceFile);
          if (nomeMetodo === "constructor") {
            continue;
          }
          const input = member.parameters.flatMap((parametro) =>
            expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
          const output = member.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(member.type.getText(contexto.sourceFile)) === "Vazio"
            ? []
            : deduplicarCampos(expandirCamposTs("resultado", member.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
          tasks.push({
            nome: paraSnakeCase(nomeMetodo),
            resumo: `Task importada automaticamente de ${contexto.relacao}#${nomeClasse}.${nomeMetodo}.`,
            input: deduplicarCampos(input),
            output,
            errors: extrairErrosTs(member.body, contexto.sourceFile),
            effects: descreverEfeitosPorHeuristica(member.body.getText(contexto.sourceFile)),
            impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), `${nomeClasse}.${nomeMetodo}`) },
            origemArquivo: contexto.relacao,
            origemSimbolo: `${nomeClasse}.${nomeMetodo}`,
          });
        }
      }
    });

    if (tasks.length === 0) {
      continue;
    }

    const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
    modulos.set(nomeModulo, {
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${contexto.relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: [],
      entities,
      enums,
    });
  }

  return [...modulos.values()];
}

export function nomeTaskParaRotaTypeScript(caminho: string, metodo: string): string {
  const segmentos = caminho
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .map((segmento) => segmento.replace(/[{}]/g, ""));
  return paraSnakeCase([...segmentos, metodo.toLowerCase()].join("_")) || `rota_${metodo.toLowerCase()}`;
}

export function camposDeParametrosRotaTypeScript(
  parametros: ReturnType<typeof extrairRotasTypeScriptHttp>[number]["parametros"],
): CampoImportado[] {
  return parametros.map((parametro) => ({
    nome: paraSnakeCase(parametro.nome),
    tipo: parametro.tipoSema,
    obrigatorio: true,
  }));
}

export function extrairColecoesFirebaseImportacao(texto: string): string[] {
  const encontrados = new Set<string>();

  for (const match of texto.matchAll(/\b(?:export\s+)?const\s+\w*COLLECTIONS?\w*\s*=\s*\{([\s\S]*?)\n\}/g)) {
    const corpo = match[1] ?? "";
    for (const valor of corpo.matchAll(/:\s*["'`]([^"'`]+)["'`]/g)) {
      encontrados.add(valor[1]!);
    }
  }

  return [...encontrados];
}

export async function importarNextJsBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const escopo = resolverEscopoImportacaoNextJs(diretorio);
  const arquivos = await listarArquivosRecursivos(escopo.diretorioEscopo, [".ts", ".tsx", ".js", ".jsx"]);
  const uteis = arquivos.filter((arquivo) =>
    !arquivo.endsWith(".spec.ts")
    && !arquivo.endsWith(".test.ts")
    && !arquivo.endsWith(".d.ts")
    && /(\\|\/)(?:src\\|src\/)?app(\\|\/)api(\\|\/).+(\\|\/)route\.(ts|tsx|js|jsx)$/i.test(arquivo));

  const contextos = await Promise.all(uteis.map(async (arquivo) => {
    const texto = await readFile(arquivo, "utf8");
    const scriptKind = arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return {
      sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, scriptKind),
      texto,
      relacao: path.relative(escopo.baseProjeto, arquivo),
    };
  }));
  const tiposGlobais = consolidarTiposTs(contextos);
  const modulos = new Map<string, ModuloImportado>();

  for (const contexto of contextos) {
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const contextoSegmentos = inferirContextoPorArquivo(
      contexto.relacao.replace(/[\\/]route\.(?:ts|tsx|js|jsx)$/i, ""),
    ).filter((segmento, indice) => !(indice === 0 && segmento === "app"));
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

      for (const rota of extrairRotasTypeScriptHttp(contexto.sourceFile, contexto.relacao).filter((item) => item.origem === "nextjs")) {
        const taskNome = nomeTaskParaRotaTypeScript(rota.caminho, rota.metodo);
        const exportacao = localizarExportacaoTypeScriptHttp(contexto.sourceFile, rota.simbolo);
        const semantica = inferirSemanticaHandlerTypeScriptHttp(contexto.sourceFile, rota.simbolo);
        const input = deduplicarCampos([
          ...camposDeParametrosRotaTypeScript(rota.parametros),
          ...camposDeSemanticaTypeScriptHttp(semantica?.query ?? [], tiposGlobais, entitiesRef, enumsRef),
          ...camposEstruturadosTypeScriptHttp("body", semantica?.bodyTipoTexto, tiposGlobais, entitiesRef, enumsRef),
          ...camposDeSemanticaTypeScriptHttp(semantica?.body ?? [], tiposGlobais, entitiesRef, enumsRef),
        ]);
        const output = semantica && semantica.response.length > 0
          ? deduplicarCampos(camposDeSemanticaTypeScriptHttp(semantica.response, tiposGlobais, entitiesRef, enumsRef))
          : semantica?.responseTipoTexto
            ? deduplicarCampos(expandirCamposTs("resultado", semantica.responseTipoTexto, tiposGlobais, entitiesRef, enumsRef, false))
            : exportacao?.retorno && mapearTipoPrimitivo(exportacao.retorno) === "Vazio"
              ? []
              : deduplicarCampos(expandirCamposTs("resultado", exportacao?.retorno, tiposGlobais, entitiesRef, enumsRef, false));
        const taskOutput = output.length > 0 ? output : [{ nome: "resultado", tipo: "Json", obrigatorio: false }];
        const resumoBase = `Rota Next.js App Router importada automaticamente de ${contexto.relacao}#${rota.simbolo}.`;
        const errors = deduplicarErros([
          ...(exportacao?.corpo ? extrairErrosTs(exportacao.corpo, contexto.sourceFile) : []),
          ...errosPorStatusHttp(semantica?.errorStatuses ?? []),
        ]);

        tasks.push({
          nome: taskNome,
          resumo: `Task derivada automaticamente de ${contexto.relacao}#${rota.simbolo}.`,
          input,
          output: taskOutput,
          errors,
          effects: exportacao?.corpo ? descreverEfeitosPorHeuristica(exportacao.corpo.getText(contexto.sourceFile)) : descreverEfeitosPorHeuristica(contexto.texto),
          impl: { ts: caminhoImplTs(escopo.baseProjeto, path.join(escopo.baseProjeto, contexto.relacao), rota.simbolo) },
          origemArquivo: contexto.relacao,
          origemSimbolo: rota.simbolo,
        });

      routes.push({
        nome: `${taskNome}_publico`,
        resumo: resumoBase,
        metodo: rota.metodo,
          caminho: rota.caminho,
          task: taskNome,
          input,
          output: taskOutput,
          errors,
        });
      }

    if (!tasks.length && !routes.length) {
      continue;
    }

    sincronizarRotasComTasks(routes, tasks);
    const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
    modulos.set(nomeModulo, {
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${contexto.relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: deduplicarRotas(routes),
      entities,
      enums,
    });
  }

  return [...modulos.values()];
}
