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

import { RotaAngularConsumerImportada, RotaFlutterConsumerImportada, SuperficieConsumerImportada, arquivoEhBridgeAngularConsumer, arquivoEhBridgeFlutterConsumer, arquivoEhBridgeNextJsConsumer, arquivoEhBridgeReactViteConsumer, arquivoEhRotasAngularConsumer, arquivoEhRotasAngularConsumerRaiz, arquivoEhRotasFlutterConsumer, arquivoEhRotasReactViteConsumer, extrairRotasAngularConsumerDiretas, extrairRotasReactViteConsumer, inferirCaminhoFlutterConsumer, inferirCaminhoNextJsConsumer, inferirCaminhoReactViteConsumer, montarCaminhoRotaConsumer, normalizarCaminhoImportado, resolverEscopoImportacaoFrontendConsumer } from "./importador.part03.js";
import { CampoImportado, ContextoTsArquivo, EntidadeImportada, EnumImportado, ModuloImportado, TarefaImportada, VinculoImportado, listarArquivosRecursivos, mapearTipoPrimitivo, paraSnakeCase } from "./importador.part01.js";
import { consolidarTiposTs, deduplicarTarefas, deduplicarVinculos } from "./importador.part05.js";
import { caminhoImplTs, criarEntidadesReferenciadas, descreverEfeitosPorHeuristica, expandirCamposTs, extrairErrosTs } from "./importador.part02.js";
import { caminhoImplDart } from "./importador.part07.js";

export async function extrairRotasAngularConsumer(
  baseProjeto: string,
  relacaoArquivo: string,
  prefixo = "/",
  visitados = new Set<string>(),
): Promise<RotaAngularConsumerImportada[]> {
  const relacaoNormalizada = normalizarCaminhoImportado(relacaoArquivo);
  if (visitados.has(relacaoNormalizada)) {
    return [];
  }
  visitados.add(relacaoNormalizada);

  const caminhoAbsoluto = path.join(baseProjeto, relacaoNormalizada);
  let codigo = "";
  try {
    codigo = await readFile(caminhoAbsoluto, "utf8");
  } catch {
    return [];
  }

  const diretas = extrairRotasAngularConsumerDiretas(relacaoNormalizada, codigo, prefixo);
  const agregadas = [...diretas];
  for (const rota of diretas) {
    if (!rota.arquivoRotasFilhas) {
      continue;
    }
    agregadas.push(...await extrairRotasAngularConsumer(baseProjeto, rota.arquivoRotasFilhas, rota.caminho, visitados));
  }
  return agregadas;
}

export function normalizarRotaDeclaradaFlutter(caminhoCru: string): string {
  return montarCaminhoRotaConsumer((caminhoCru ?? "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean));
}

export function extrairRotasFlutterConsumer(relacaoArquivo: string, codigo: string): RotaFlutterConsumerImportada[] {
  const rotas = new Map<string, RotaFlutterConsumerImportada>();
  const registrar = (caminhoCru: string) => {
    const caminho = normalizarRotaDeclaradaFlutter(caminhoCru);
    rotas.set(`${caminho}:${normalizarCaminhoImportado(relacaoArquivo)}`, {
      caminho,
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
    });
  };

  for (const match of codigo.matchAll(/GoRoute\s*\([\s\S]{0,220}?path\s*:\s*["'`]([^"'`]+)["'`]/g)) {
    registrar(match[1] ?? "");
  }

  for (const match of codigo.matchAll(/["'`]([^"'`]+)["'`]\s*:\s*\([^)]*\)\s*=>/g)) {
    registrar(match[1] ?? "");
  }

  if (/home\s*:\s*(?:const\s+)?[A-Za-z_]\w*\(/.test(codigo)) {
    registrar("/");
  }

  return [...rotas.values()];
}

export async function carregarContextosBridgeConsumer(baseProjeto: string, arquivosBridge: string[]): Promise<ContextoTsArquivo[]> {
  return Promise.all(arquivosBridge.map(async (arquivo) => {
    const texto = await readFile(arquivo, "utf8");
    const scriptKind = arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return {
      sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, scriptKind),
      texto,
      relacao: path.relative(baseProjeto, arquivo),
    };
  }));
}

export function extrairTasksBridgeConsumer(
  baseProjeto: string,
  contextosBridge: ContextoTsArquivo[],
): { tasks: TarefaImportada[]; entities: EntidadeImportada[]; enums: EnumImportado[] } {
  const tiposGlobais = consolidarTiposTs(contextosBridge);
  const entitiesRef = new Set<string>();
  const enumsRef = new Set<string>();
  const tasks: TarefaImportada[] = [];

  for (const contexto of contextosBridge) {
    contexto.sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nome = node.name.text;
        const input = node.parameters.flatMap((parametro) =>
          expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
        const output = node.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(node.type.getText(contexto.sourceFile)) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", node.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
        tasks.push({
          nome: nomeTaskBridgeConsumer(nome),
          resumo: `Task consumer importada automaticamente de ${contexto.relacao}#${nome}.`,
          input: deduplicarCampos(input),
          output,
          errors: node.body ? extrairErrosTs(node.body, contexto.sourceFile) : [],
          effects: node.body ? descreverEfeitosPorHeuristica(node.body.getText(contexto.sourceFile)) : [],
          impl: { ts: caminhoImplTs(baseProjeto, path.join(baseProjeto, contexto.relacao), nome) },
          vinculos: deduplicarVinculos([
            { tipo: "arquivo", valor: normalizarCaminhoImportado(contexto.relacao) },
            { tipo: "simbolo", valor: caminhoImplTs(baseProjeto, path.join(baseProjeto, contexto.relacao), nome) },
          ]),
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
          const caminhoSimbolo = caminhoImplTs(baseProjeto, path.join(baseProjeto, contexto.relacao), `${nomeClasse}.${nomeMetodo}`);
          tasks.push({
            nome: nomeTaskBridgeConsumer(nomeMetodo),
            resumo: `Task consumer importada automaticamente de ${contexto.relacao}#${nomeClasse}.${nomeMetodo}.`,
            input: deduplicarCampos(input),
            output,
            errors: extrairErrosTs(member.body, contexto.sourceFile),
            effects: descreverEfeitosPorHeuristica(member.body.getText(contexto.sourceFile)),
            impl: { ts: caminhoSimbolo },
            vinculos: deduplicarVinculos([
              { tipo: "arquivo", valor: normalizarCaminhoImportado(contexto.relacao) },
              { tipo: "simbolo", valor: caminhoSimbolo },
            ]),
            origemArquivo: contexto.relacao,
            origemSimbolo: `${nomeClasse}.${nomeMetodo}`,
          });
        }
      }
    });
  }

  const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
  return {
    tasks,
    entities,
    enums,
  };
}

export function montarVinculosSuperficiesConsumer(superficies: SuperficieConsumerImportada[]): VinculoImportado[] {
  return deduplicarVinculos(superficies.flatMap((superficie) => [
    { tipo: "superficie", valor: superficie.caminho },
    { tipo: "arquivo", valor: normalizarCaminhoImportado(superficie.arquivo) },
  ]));
}

export async function importarConsumerBase(
  diretorio: string,
  namespaceBase: string,
  descricaoFramework: string,
  ehBridge: (relacaoArquivo: string) => boolean,
  coletarSuperficies: (baseProjeto: string, arquivos: string[]) => Promise<SuperficieConsumerImportada[]>,
  extensoes: readonly string[] = [".ts", ".tsx", ".js", ".jsx"],
): Promise<ModuloImportado[]> {
  const escopo = resolverEscopoImportacaoFrontendConsumer(diretorio);
  const arquivos = await listarArquivosRecursivos(escopo.baseProjeto, [...extensoes]);
  const arquivosBridge = arquivos.filter((arquivo) => ehBridge(path.relative(escopo.baseProjeto, arquivo)));
  const contextosBridge = await carregarContextosBridgeConsumer(escopo.baseProjeto, arquivosBridge);
  const { tasks, entities, enums } = extrairTasksBridgeConsumer(escopo.baseProjeto, contextosBridge);
  const superficiesImportadas = await coletarSuperficies(escopo.baseProjeto, arquivos);
  const superficies = montarVinculosSuperficiesConsumer(superficiesImportadas);

  if (tasks.length === 0 && superficies.length === 0) {
    return [];
  }

  const nomeModulo = namespaceBase.endsWith(".consumer")
    ? namespaceBase
    : `${namespaceBase}.consumer`;

  return [{
    nome: nomeModulo,
    resumo: `Rascunho Sema importado automaticamente do consumer ${descricaoFramework} em ${escopo.baseProjeto}.`,
    tasks: deduplicarTarefas(tasks),
    routes: [],
    entities,
    enums,
    vinculos: superficies,
  }];
}

export async function coletarSuperficiesNextJsConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  return arquivos
    .map((arquivo) => inferirCaminhoNextJsConsumer(path.relative(baseProjeto, arquivo)))
    .filter((item): item is SuperficieConsumerImportada => Boolean(item));
}

export async function coletarSuperficiesSvelteKitConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  const { arquivoEhSuperficieSvelteKitConsumer, inferirRotaSvelteKitConsumer } = await import("./drift.part05.js");
  return arquivos
    .map((arquivo) => {
      const relacao = path.relative(baseProjeto, arquivo);
      if (!arquivoEhSuperficieSvelteKitConsumer(relacao)) {
        return undefined;
      }
      const superficie = inferirRotaSvelteKitConsumer(relacao);
      return superficie
        ? { caminho: superficie.rota, arquivo: relacao, tipoArquivo: superficie.tipoArquivo }
        : undefined;
    })
    .filter((item): item is SuperficieConsumerImportada => Boolean(item));
}

export async function coletarSuperficiesNuxtConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  const { arquivoEhSuperficieNuxtConsumer, inferirRotaNuxtConsumer } = await import("./drift.part05.js");
  return arquivos
    .map((arquivo) => {
      const relacao = path.relative(baseProjeto, arquivo);
      if (!arquivoEhSuperficieNuxtConsumer(relacao)) {
        return undefined;
      }
      const superficie = inferirRotaNuxtConsumer(relacao);
      return superficie
        ? { caminho: superficie.rota, arquivo: relacao, tipoArquivo: superficie.tipoArquivo }
        : undefined;
    })
    .filter((item): item is SuperficieConsumerImportada => Boolean(item));
}

export async function importarSvelteKitConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const { arquivoEhBridgeSvelteKitConsumer } = await import("./drift.part05.js");
  return importarConsumerBase(
    diretorio,
    namespaceBase,
    "SvelteKit",
    arquivoEhBridgeSvelteKitConsumer,
    coletarSuperficiesSvelteKitConsumer,
    [".ts", ".js", ".svelte"],
  );
}

export async function importarNuxtConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const { arquivoEhBridgeNuxtConsumer } = await import("./drift.part05.js");
  return importarConsumerBase(
    diretorio,
    namespaceBase,
    "Nuxt",
    arquivoEhBridgeNuxtConsumer,
    coletarSuperficiesNuxtConsumer,
    [".ts", ".js", ".vue"],
  );
}

export async function coletarSuperficiesReactViteConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  const superficies: SuperficieConsumerImportada[] = [];

  for (const arquivo of arquivos) {
    const relacao = path.relative(baseProjeto, arquivo);
    const codigo = await readFile(arquivo, "utf8");
    if (arquivoEhRotasReactViteConsumer(relacao, codigo)) {
      for (const rota of extrairRotasReactViteConsumer(relacao, codigo)) {
        superficies.push({
          caminho: rota.caminho,
          arquivo: rota.arquivoRotas,
          tipoArquivo: "router",
        });
        if (rota.arquivoComponente) {
          superficies.push({
            caminho: rota.caminho,
            arquivo: rota.arquivoComponente,
            tipoArquivo: "page",
          });
        }
      }
    }
  }

  for (const arquivo of arquivos) {
    const superficie = inferirCaminhoReactViteConsumer(path.relative(baseProjeto, arquivo));
    if (superficie) {
      superficies.push(superficie);
    }
  }

  return superficies;
}

export async function coletarSuperficiesAngularConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  const superficies: SuperficieConsumerImportada[] = [];
  const arquivosRotas = arquivos.filter((arquivo) => arquivoEhRotasAngularConsumer(path.relative(baseProjeto, arquivo)));
  const arquivosRaiz = arquivosRotas.filter((arquivo) => arquivoEhRotasAngularConsumerRaiz(path.relative(baseProjeto, arquivo)));
  const pontosEntrada = arquivosRaiz.length > 0 ? arquivosRaiz : arquivosRotas;
  for (const arquivoRotas of pontosEntrada) {
    const relacao = path.relative(baseProjeto, arquivoRotas);
    for (const rota of await extrairRotasAngularConsumer(baseProjeto, relacao)) {
      superficies.push({
        caminho: rota.caminho,
        arquivo: rota.arquivoRotas,
        tipoArquivo: "routes",
      });
      if (rota.arquivoComponente) {
        superficies.push({
          caminho: rota.caminho,
          arquivo: rota.arquivoComponente,
          tipoArquivo: "component",
        });
      }
    }
  }
  if (superficies.length > 0) {
    return superficies;
  }
  return (await coletarSuperficiesAngularStandaloneConsumer(baseProjeto, arquivos)).map((superficie) => ({
    caminho: superficie.rota,
    arquivo: superficie.arquivo,
    tipoArquivo: superficie.tipoArquivo,
  }));
}

export async function importarNextJsConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  return importarConsumerBase(
    diretorio,
    namespaceBase,
    "Next.js",
    arquivoEhBridgeNextJsConsumer,
    coletarSuperficiesNextJsConsumer,
  );
}

export async function importarReactViteConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  return importarConsumerBase(
    diretorio,
    namespaceBase,
    "React/Vite",
    arquivoEhBridgeReactViteConsumer,
    coletarSuperficiesReactViteConsumer,
  );
}

export async function importarAngularConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  return importarConsumerBase(
    diretorio,
    namespaceBase,
    "Angular",
    arquivoEhBridgeAngularConsumer,
    coletarSuperficiesAngularConsumer,
  );
}

export async function extrairTasksBridgeFlutterConsumer(baseProjeto: string, arquivosBridge: string[]): Promise<TarefaImportada[]> {
  const tasks: TarefaImportada[] = [];

  for (const arquivo of arquivosBridge) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(baseProjeto, arquivo);

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
          const partes = item.split(/\s+/).filter(Boolean);
          const nomeParametro = partes.at(-1) ?? "arg";
          const tipoParametro = partes.slice(0, -1).join(" ");
          return {
            nome: paraSnakeCase(nomeParametro),
            tipo: mapearTipoPrimitivo(tipoParametro || "Json"),
            obrigatorio: !/\?/.test(tipoParametro),
          };
        });
      const caminhoSimbolo = caminhoImplDart(baseProjeto, arquivo, nome);
      tasks.push({
        nome: nomeTaskBridgeConsumer(nome),
        resumo: `Task consumer importada automaticamente de ${relacao}#${nome}.`,
        input,
        output: retorno && mapearTipoPrimitivo(retorno) === "Vazio"
          ? []
          : [{ nome: "resultado", tipo: mapearTipoPrimitivo(retorno || "Json"), obrigatorio: false }],
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { dart: caminhoSimbolo },
        vinculos: deduplicarVinculos([
          { tipo: "arquivo", valor: normalizarCaminhoImportado(relacao) },
          { tipo: "simbolo", valor: caminhoSimbolo },
        ]),
        origemArquivo: relacao,
        origemSimbolo: nome,
      });
    }
  }

  return tasks;
}

export async function coletarSuperficiesFlutterConsumer(baseProjeto: string, arquivos: string[]): Promise<SuperficieConsumerImportada[]> {
  const superficies: SuperficieConsumerImportada[] = [];

  for (const arquivo of arquivos) {
    const relacao = path.relative(baseProjeto, arquivo);
    const codigo = await readFile(arquivo, "utf8");
    if (arquivoEhRotasFlutterConsumer(relacao, codigo)) {
      for (const rota of extrairRotasFlutterConsumer(relacao, codigo)) {
        superficies.push({
          caminho: rota.caminho,
          arquivo: rota.arquivoRotas,
          tipoArquivo: "router",
        });
      }
    }
  }

  for (const arquivo of arquivos) {
    const superficie = inferirCaminhoFlutterConsumer(path.relative(baseProjeto, arquivo));
    if (superficie) {
      superficies.push(superficie);
    }
  }

  return superficies;
}

export async function importarFlutterConsumerBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const escopo = resolverEscopoImportacaoFrontendConsumer(diretorio);
  const arquivos = (await listarArquivosRecursivos(escopo.baseProjeto, [".dart"]))
    .filter((arquivo) => !arquivo.endsWith(".g.dart") && !arquivo.endsWith(".freezed.dart"));
  const arquivosBridge = arquivos.filter((arquivo) => arquivoEhBridgeFlutterConsumer(path.relative(escopo.baseProjeto, arquivo)));
  const tasks = await extrairTasksBridgeFlutterConsumer(escopo.baseProjeto, arquivosBridge);
  const superficiesImportadas = await coletarSuperficiesFlutterConsumer(escopo.baseProjeto, arquivos);
  const superficies = montarVinculosSuperficiesConsumer(superficiesImportadas);

  if (tasks.length === 0 && superficies.length === 0) {
    return [];
  }

  const nomeModulo = namespaceBase.endsWith(".consumer")
    ? namespaceBase
    : `${namespaceBase}.consumer`;

  return [{
    nome: nomeModulo,
    resumo: `Rascunho Sema importado automaticamente do consumer Flutter em ${escopo.baseProjeto}.`,
    tasks: deduplicarTarefas(tasks),
    routes: [],
    entities: [],
    enums: [],
    vinculos: superficies,
  }];
}

export function nomeTaskBridgeConsumer(nome: string): string {
  return paraSnakeCase(nome.replace(/^sema/, "")) || paraSnakeCase(nome) || "task_consumer";
}

export function extrairChamadaServiceTs(node: ts.Node): string | undefined {
  let encontrado: string | undefined;
  const visitar = (atual: ts.Node): void => {
    if (encontrado) {
      return;
    }
    if (ts.isCallExpression(atual) && ts.isPropertyAccessExpression(atual.expression)) {
      const alvo = atual.expression.expression;
      if (ts.isPropertyAccessExpression(alvo) && alvo.expression.kind === ts.SyntaxKind.ThisKeyword && alvo.name.text.endsWith("Service")) {
        encontrado = atual.expression.name.text;
        return;
      }
    }
    atual.forEachChild(visitar);
  };
  node.forEachChild(visitar);
  return encontrado;
}

export function deduplicarCampos(campos: CampoImportado[]): CampoImportado[] {
  const mapa = new Map<string, CampoImportado>();
  for (const campo of campos) {
    if (!mapa.has(campo.nome)) {
      mapa.set(campo.nome, campo);
    }
  }
  return [...mapa.values()];
}
