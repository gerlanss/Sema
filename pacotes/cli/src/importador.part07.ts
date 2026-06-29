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

import { CampoImportado, EntidadeImportada, EnumImportado, ErroImportado, ModuloImportado, RotaImportada, TarefaImportada, TipoPythonDescoberto, inferirContextoPorArquivo, listarArquivosRecursivos, mapearTipoPrimitivo, paraIdentificadorModulo, paraSnakeCase } from "./importador.part01.js";
import { consolidarTiposTs, deduplicarEntidades, deduplicarEnums, deduplicarRotas, deduplicarTarefas, sincronizarRotasComTasks } from "./importador.part05.js";
import { caminhoImplTs, criarEntidadesReferenciadas, descreverEfeitosPorHeuristica, expandirCamposTs, extrairErrosTs, normalizarNomeErroBruto, pareceWrapperTipo } from "./importador.part02.js";
import { deduplicarCampos } from "./importador.part04.js";
import { camposDeParametrosRotaTypeScript, extrairColecoesFirebaseImportacao, nomeTaskParaRotaTypeScript } from "./importador.part06.js";

export async function importarFirebaseBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".ts", ".tsx", ".js", ".jsx"]);
  const uteis = arquivos.filter((arquivo) =>
    !arquivo.endsWith(".spec.ts")
    && !arquivo.endsWith(".test.ts")
    && !arquivo.endsWith(".d.ts")
    && /(sema_contract_bridge|health-check|collections?|firestore)/i.test(arquivo));

  const contextos = await Promise.all(uteis.map(async (arquivo) => {
    const texto = await readFile(arquivo, "utf8");
    const scriptKind = arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    return {
      sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, scriptKind),
      texto,
      relacao: path.relative(diretorio, arquivo),
    };
  }));
  const tiposGlobais = consolidarTiposTs(contextos);
  const modulos = new Map<string, ModuloImportado>();

  for (const contexto of contextos) {
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const contextoSegmentos = inferirContextoPorArquivo(contexto.relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    for (const node of contexto.sourceFile.statements) {
      if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nome = node.name.text;
        const input = node.parameters.flatMap((parametro) =>
          expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
        const output = node.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(node.type.getText(contexto.sourceFile)) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", node.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
        tasks.push({
          nome: paraSnakeCase(nome.replace(/^sema/, "")) || paraSnakeCase(nome),
          resumo: `Task Firebase/worker importada automaticamente de ${contexto.relacao}#${nome}.`,
          input: deduplicarCampos(input),
          output: output.length > 0 ? output : [{ nome: "resultado", tipo: "Json", obrigatorio: false }],
          errors: node.body ? extrairErrosTs(node.body, contexto.sourceFile) : [],
          effects: node.body ? descreverEfeitosPorHeuristica(node.body.getText(contexto.sourceFile)) : descreverEfeitosPorHeuristica(contexto.texto),
          impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), nome) },
          origemArquivo: contexto.relacao,
          origemSimbolo: nome,
        });
      }
    }

    for (const rota of extrairRotasTypeScriptHttp(contexto.sourceFile, contexto.relacao).filter((item) => item.origem === "firebase")) {
      const taskNome = nomeTaskParaRotaTypeScript(rota.caminho, rota.metodo);
      const exportacao = localizarExportacaoTypeScriptHttp(contexto.sourceFile, rota.simbolo);
      const input = deduplicarCampos(camposDeParametrosRotaTypeScript(rota.parametros));
      const output = exportacao?.retorno && mapearTipoPrimitivo(exportacao.retorno) === "Vazio"
        ? []
        : deduplicarCampos(expandirCamposTs("resultado", exportacao?.retorno, tiposGlobais, entitiesRef, enumsRef, false));
      const taskOutput = output.length > 0 ? output : [{ nome: "resultado", tipo: "Json", obrigatorio: false }];

      tasks.push({
        nome: taskNome,
        resumo: `Task HTTP do worker importada automaticamente de ${contexto.relacao}#${rota.simbolo}.`,
        input,
        output: taskOutput,
        errors: exportacao?.corpo ? extrairErrosTs(exportacao.corpo, contexto.sourceFile) : [],
        effects: exportacao?.corpo ? descreverEfeitosPorHeuristica(exportacao.corpo.getText(contexto.sourceFile)) : descreverEfeitosPorHeuristica(contexto.texto),
        impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), rota.simbolo) },
        origemArquivo: contexto.relacao,
        origemSimbolo: rota.simbolo,
      });

      routes.push({
        nome: `${taskNome}_publico`,
        resumo: `Rota do worker importada automaticamente de ${contexto.relacao}#${rota.simbolo}.`,
        metodo: rota.metodo,
        caminho: rota.caminho,
        task: taskNome,
        input,
        output: taskOutput,
        errors: exportacao?.corpo ? extrairErrosTs(exportacao.corpo, contexto.sourceFile) : [],
      });
    }

    for (const colecao of extrairColecoesFirebaseImportacao(contexto.texto)) {
      tasks.push({
        nome: paraSnakeCase(`inventariar_${colecao}`),
        resumo: `Task sintetica para registrar o recurso persistido ${colecao} descoberto em ${contexto.relacao}.`,
        input: [],
        output: [{ nome: "colecao", tipo: "Texto", obrigatorio: false }],
        errors: [],
        effects: [{ categoria: "persistencia", alvo: colecao, criticidade: "media" }],
        origemArquivo: contexto.relacao,
        origemSimbolo: colecao,
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

export function extrairTiposPython(texto: string): Map<string, TipoPythonDescoberto> {
  const encontrados = new Map<string, TipoPythonDescoberto>();

  const regexBaseModel = /^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm;
  for (const match of texto.matchAll(regexBaseModel)) {
    const [, nome, bases = "", corpo] = match;
    if (!bases.includes("BaseModel")) {
      continue;
    }
    const campos = [...corpo.matchAll(/^\s{4}(\w+)\s*:\s*([^\n=]+)(?:\s*=.+)?$/gm)].map((campo) => ({
      nome: campo[1]!,
      tipoTexto: campo[2]!.trim(),
      obrigatorio: !/=/.test(campo[0]!),
    }));
    encontrados.set(nome!, { tipo: "objeto", nome: nome!, campos });
  }

  const regexEnum = /^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm;
  for (const match of texto.matchAll(regexEnum)) {
    const [, nome, bases = "", corpo] = match;
    if (!/(Enum|StrEnum)/.test(bases)) {
      continue;
    }
    const valores = [...corpo.matchAll(/^\s{4}(\w+)\s*=\s*["']([^"']+)["']$/gm)].map((valor) => valor[1]!).filter(Boolean);
    if (valores.length) {
      encontrados.set(nome!, { tipo: "enum", nome: nome!, valores });
    }
  }

  return encontrados;
}

export function mapearTipoPythonParaSema(
  tipoTexto: string | undefined,
  tipos: Map<string, TipoPythonDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): string {
  if (!tipoTexto) {
    return "Json";
  }

  const limpo = tipoTexto.replace(/\s+/g, "");
  const basico = mapearTipoPrimitivo(limpo);
  if (basico !== limpo) {
    return basico;
  }

  const simples = limpo.replace(/Optional\[(.+)\]/, "$1").replace(/list\[(.+)\]/i, "Json").replace(/dict\[(.+)\]/i, "Json");
  if (tipos.has(simples)) {
    const encontrado = tipos.get(simples)!;
    if (encontrado.tipo === "enum") {
      enumsReferenciados.add(encontrado.nome);
      return encontrado.nome;
    }
    if (!pareceWrapperTipo(encontrado.nome)) {
      entidadesReferenciadas.add(encontrado.nome);
      return encontrado.nome;
    }
  }

  return "Json";
}

export function expandirCamposPython(
  nomeParametro: string,
  tipoTexto: string | undefined,
  tipos: Map<string, TipoPythonDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
  obrigatorio: boolean,
): CampoImportado[] {
  if (!tipoTexto) {
    return [{ nome: paraSnakeCase(nomeParametro), tipo: "Json", obrigatorio }];
  }
  const limpo = tipoTexto.replace(/\s+/g, "").replace(/Optional\[(.+)\]/, "$1");
  const descoberto = tipos.get(limpo);
  if (descoberto?.tipo === "objeto" && pareceWrapperTipo(descoberto.nome) && descoberto.campos) {
    return descoberto.campos.map((campo) => ({
      nome: paraSnakeCase(campo.nome),
      tipo: mapearTipoPythonParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
      obrigatorio: campo.obrigatorio,
    }));
  }
  return [{
    nome: paraSnakeCase(nomeParametro),
    tipo: mapearTipoPythonParaSema(tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
    obrigatorio,
  }];
}

export function criarEntidadesPython(
  tipos: Map<string, TipoPythonDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): { entities: EntidadeImportada[]; enums: EnumImportado[] } {
  const entities = [...entidadesReferenciadas]
    .map((nome) => tipos.get(nome))
    .filter((item): item is TipoPythonDescoberto => Boolean(item?.tipo === "objeto" && item.campos))
    .map((item) => ({
      nome: item.nome,
      campos: item.campos!.map((campo) => ({
        nome: paraSnakeCase(campo.nome),
        tipo: mapearTipoPythonParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
        obrigatorio: campo.obrigatorio,
      })),
    }));

  const enums = [...enumsReferenciados]
    .map((nome) => tipos.get(nome))
    .filter((item): item is TipoPythonDescoberto => Boolean(item?.tipo === "enum" && item.valores))
    .map((item) => ({
      nome: item.nome,
      valores: item.valores!,
    }));

  return { entities: deduplicarEntidades(entities), enums: deduplicarEnums(enums) };
}

export function extrairErrosPython(texto: string): ErroImportado[] {
  const erros = new Map<string, string>();
  for (const match of texto.matchAll(/raise\s+(\w+)(?:\(([^)]*)\))?/g)) {
    const nomeBruto = match[1]!;
    const mensagem = (match[2] ?? "").match(/["']([^"']+)["']/)?.[1] ?? `Erro importado automaticamente de ${nomeBruto}.`;
    erros.set(normalizarNomeErroBruto(nomeBruto), mensagem);
  }
  return [...erros.entries()].map(([nome, mensagem]) => ({ nome, mensagem }));
}

export function caminhoImplGenerico(
  diretorioBase: string,
  arquivo: string,
  simbolo: string,
  opcoes?: { snakeCaseUltimoArquivo?: boolean },
): string {
  const relativo = path.relative(diretorioBase, arquivo).replace(/\.[^.]+$/, "");
  const segmentos = relativo.split(path.sep).map((segmento, indice, lista) =>
    opcoes?.snakeCaseUltimoArquivo && indice === lista.length - 1
      ? paraSnakeCase(segmento)
      : paraIdentificadorModulo(segmento))
    .filter(Boolean);
  return [...segmentos, simbolo].join(".");
}

export function caminhoImplPython(diretorioBase: string, arquivo: string, simbolo: string): string {
  return caminhoImplGenerico(diretorioBase, arquivo, simbolo);
}

export function caminhoImplDart(diretorioBase: string, arquivo: string, simbolo: string): string {
  return caminhoImplGenerico(diretorioBase, arquivo, simbolo);
}

export type ModoHttpPython = "nenhum" | "fastapi" | "flask";

export function dividirParametrosPython(parametros: string): string[] {
  const partes: string[] = [];
  let atual = "";
  let profundidade = 0;

  for (const caractere of parametros) {
    if (caractere === "," && profundidade === 0) {
      if (atual.trim()) {
        partes.push(atual.trim());
      }
      atual = "";
      continue;
    }

    if (["[", "(", "{", "<"].includes(caractere)) {
      profundidade += 1;
    } else if (["]", ")", "}", ">"].includes(caractere) && profundidade > 0) {
      profundidade -= 1;
    }

    atual += caractere;
  }

  if (atual.trim()) {
    partes.push(atual.trim());
  }

  return partes;
}

export function extrairAssinaturaParametrosPython(parametros: string): Map<string, { tipoTexto?: string; obrigatorio: boolean }> {
  const assinatura = new Map<string, { tipoTexto?: string; obrigatorio: boolean }>();

  for (const item of dividirParametrosPython(parametros)) {
    if (!item || item.startsWith("self") || item.startsWith("cls") || item.startsWith("*")) {
      continue;
    }

    const obrigatorio = !item.includes("=");
    const semValorPadrao = item.split("=")[0]?.trim() ?? item.trim();
    const [nomeBruto, tipo] = semValorPadrao.split(":").map((parte) => parte.trim());
    const nome = nomeBruto?.replace(/^\*{1,2}/, "").trim();
    if (!nome) {
      continue;
    }

    assinatura.set(nome, {
      tipoTexto: tipo || undefined,
      obrigatorio,
    });
  }

  return assinatura;
}

export function mapearConversorFlaskParaSema(conversor?: string): string {
  switch ((conversor ?? "").toLowerCase()) {
    case "int":
      return "Inteiro";
    case "float":
      return "Decimal";
    case "uuid":
      return "Id";
    case "path":
    default:
      return "Texto";
  }
}

export function criarInputRotaFlask(
  caminho: string,
  parametros: string,
  tiposGlobais: Map<string, TipoPythonDescoberto>,
  entitiesRef: Set<string>,
  enumsRef: Set<string>,
): CampoImportado[] {
  const assinatura = extrairAssinaturaParametrosPython(parametros);
  return extrairParametrosCaminhoFlask(caminho).map((parametro) => {
    const correspondente = assinatura.get(parametro.nome);
    return {
      nome: paraSnakeCase(parametro.nome),
      tipo: correspondente?.tipoTexto
        ? mapearTipoPythonParaSema(correspondente.tipoTexto, tiposGlobais, entitiesRef, enumsRef)
        : mapearConversorFlaskParaSema(parametro.conversor),
      obrigatorio: correspondente?.obrigatorio ?? true,
    };
  });
}
