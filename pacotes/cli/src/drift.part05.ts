// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: extrai rotas e superficies consumidoras dentro do escopo fisico planejado.

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

import { RegistroConsumerSurfaceDrift, SimboloResolvido } from "./drift.part01.js";
import {
  desembrulharExpressaoTypeScript,
  extrairNomePropriedadeTypeScript,
  registrarSimboloTypeScript,
  type AdaptadorLeituraCompartilhadaDrift,
} from "./drift.part04.js";

export function registrarMetodoTypeScriptProtoOuObjeto(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  nomeMetodo: string,
  nomeClasse?: string,
  origem: "ts" | "js" = "ts",
): void {
  if (!nomeMetodo) {
    return;
  }
  if (nomeClasse) {
    registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, nomeMetodo, nomeClasse, origem);
  }
  registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, nomeMetodo, undefined, origem);
}

export function registrarMetodosObjectAssignTypeScript(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  objeto: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  nomeClasse?: string,
  origem: "ts" | "js" = "ts",
): void {
  for (const propriedade of objeto.properties) {
    if (ts.isMethodDeclaration(propriedade) && propriedade.name) {
      const nomeMetodo = extrairNomePropriedadeTypeScript(propriedade.name, sourceFile);
      if (nomeMetodo) {
        registrarMetodoTypeScriptProtoOuObjeto(simbolos, basesSimbolicas, arquivo, nomeMetodo, nomeClasse, origem);
      }
      continue;
    }

    if (!ts.isPropertyAssignment(propriedade)) {
      continue;
    }

    const nomeMetodo = extrairNomePropriedadeTypeScript(propriedade.name, sourceFile);
    const valor = desembrulharExpressaoTypeScript(propriedade.initializer);
    if (nomeMetodo && (ts.isFunctionExpression(valor) || ts.isArrowFunction(valor))) {
      registrarMetodoTypeScriptProtoOuObjeto(simbolos, basesSimbolicas, arquivo, nomeMetodo, nomeClasse, origem);
    }
  }
}

export function registrarAtribuicaoPrototypeTypeScript(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  sourceFile: ts.SourceFile,
  esquerda: ts.Expression,
  direita: ts.Expression,
  origem: "ts" | "js" = "ts",
): void {
  const alvo = desembrulharExpressaoTypeScript(esquerda);
  const valor = desembrulharExpressaoTypeScript(direita);
  if (!ts.isPropertyAccessExpression(alvo) || !ts.isPropertyAccessExpression(alvo.expression)) {
    return;
  }
  if (alvo.expression.name.text !== "prototype") {
    return;
  }
  if (!ts.isFunctionExpression(valor) && !ts.isArrowFunction(valor)) {
    return;
  }

  const nomeClasse = alvo.expression.expression.getText(sourceFile).trim();
  const nomeMetodo = alvo.name.getText(sourceFile).trim();
  registrarMetodoTypeScriptProtoOuObjeto(simbolos, basesSimbolicas, arquivo, nomeMetodo, nomeClasse || undefined, origem);
}

export function normalizarRelacaoConsumer(relacaoArquivo: string): string {
  return relacaoArquivo.replace(/\\/g, "/");
}

export function normalizarSegmentoRotaConsumer(segmento: string): string {
  const opcionalCatchAll = segmento.match(/^\[\[\.\.\.([A-Za-z_]\w*)\]\]$/);
  if (opcionalCatchAll) {
    return `{${opcionalCatchAll[1]}}`;
  }
  const catchAll = segmento.match(/^\[\.\.\.([A-Za-z_]\w*)\]$/);
  if (catchAll) {
    return `{${catchAll[1]}}`;
  }
  const dinamico = segmento.match(/^\[([A-Za-z_]\w*)\]$/);
  if (dinamico) {
    return `{${dinamico[1]}}`;
  }
  return segmento;
}

export function montarRotaConsumer(partes: string[]): string {
  const filtradas = partes
    .filter((segmento) => segmento && segmento !== "index" && !/^\(.*\)$/.test(segmento) && !segmento.startsWith("@"))
    .map(normalizarSegmentoRotaConsumer);
  return filtradas.length > 0 ? `/${filtradas.join("/")}`.replace(/\/+/g, "/") : "/";
}

export function arquivoEhBridgeNextJsConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

export function arquivoEhBridgeReactViteConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

export function arquivoEhBridgeAngularConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|js)$/i.test(relacao);
}

export function arquivoEhSuperficieNextJsConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/(?:(?!api\/).)*?(?:page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

export function arquivoEhSuperficieReactViteConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /^(?:src\/)?pages\/.+\.(?:ts|tsx|js|jsx)$/i.test(relacao)
    || /^(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

export function arquivoEhRotasReactViteConsumer(relacaoArquivo: string, codigo?: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?(?:app\/)?(?:router|routes)\.(?:ts|tsx|js|jsx)$/i.test(relacao)
    || /from\s+["']react-router-dom["']|createBrowserRouter|RouterProvider|useRoutes\s*\(|<Routes\b|<Route\b/.test(codigo ?? "");
}

export function arquivoEhRotasAngularConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app(?:\/.+)?\/[^/]+\.routes\.(?:ts|js)$/i.test(relacao);
}

export function arquivoEhRotasAngularConsumerRaiz(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/[^/]+\.routes\.(?:ts|js)$/i.test(relacao);
}

export function arquivoEhBridgeFlutterConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:sema_consumer_bridge|api\/sema_contract_bridge|sema\/.+)\.dart$/i.test(relacao);
}

export function arquivoEhSuperficieFlutterConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:screens|pages)\/.+\.dart$/i.test(relacao)
    || /(?:^|\/)(?:lib\/)?main\.dart$/i.test(relacao);
}

export function arquivoEhRotasFlutterConsumer(relacaoArquivo: string, codigo?: string): boolean {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:router|app_router|routes)\.dart$/i.test(relacao)
    || /MaterialApp(?:\.router)?\s*\(|CupertinoApp(?:\.router)?\s*\(|GoRouter\s*\(/.test(codigo ?? "");
}

export function inferirRotaNextJsConsumer(relacaoArquivo: string): RegistroConsumerSurfaceDrift | undefined {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  const segmentos = relacao.split("/");
  const indiceSrcApp = segmentos.findIndex((segmento, indice) => segmento === "src" && segmentos[indice + 1] === "app");
  const indiceApp = segmentos.findIndex((segmento) => segmento === "app");
  const inicioApp = indiceSrcApp >= 0 ? indiceSrcApp + 2 : indiceApp >= 0 ? indiceApp + 1 : -1;
  if (inicioApp < 0) {
    return undefined;
  }

  const arquivoFinal = segmentos.at(-1) ?? "";
  const tipoArquivo = arquivoFinal.match(/^(page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/)?.[1] as RegistroConsumerSurfaceDrift["tipoArquivo"] | undefined;
  if (!tipoArquivo) {
    return undefined;
  }

  const caminhoAteArquivo = segmentos.slice(inicioApp, -1);
  if (caminhoAteArquivo[0] === "api") {
    return undefined;
  }

  return {
    rota: montarRotaConsumer(caminhoAteArquivo),
    arquivo: relacaoArquivo,
    tipoArquivo,
  };
}

export function inferirRotaReactViteConsumer(relacaoArquivo: string): RegistroConsumerSurfaceDrift | undefined {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  if (/(?:^|\/)(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(relacao)) {
    return {
      rota: "/",
      arquivo: relacaoArquivo,
      tipoArquivo: "app",
    };
  }

  const segmentos = relacao.split("/");
  const indiceSrcPages = segmentos.findIndex((segmento, indice) => segmento === "src" && segmentos[indice + 1] === "pages");
  const indicePages = segmentos.findIndex((segmento) => segmento === "pages");
  const inicioPages = indiceSrcPages >= 0 ? indiceSrcPages + 2 : indicePages >= 0 ? indicePages + 1 : -1;
  if (inicioPages < 0) {
    return undefined;
  }

  const arquivoFinal = segmentos.at(-1) ?? "";
  const nomeBase = arquivoFinal.replace(/\.(?:ts|tsx|js|jsx)$/i, "");
  return {
    rota: montarRotaConsumer([...segmentos.slice(inicioPages, -1), nomeBase]),
    arquivo: relacaoArquivo,
    tipoArquivo: "page",
  };
}

export function inferirRotaFlutterConsumer(relacaoArquivo: string): RegistroConsumerSurfaceDrift | undefined {
  const relacao = normalizarRelacaoConsumer(relacaoArquivo);
  if (!arquivoEhSuperficieFlutterConsumer(relacao)) {
    return undefined;
  }
  if (/(?:^|\/)(?:lib\/)?main\.dart$/i.test(relacao)) {
    return {
      rota: "/",
      arquivo: relacaoArquivo,
      tipoArquivo: "app",
    };
  }

  const segmentos = relacao.split("/");
  const indiceLibScreens = segmentos.findIndex((segmento, indice) => segmento === "lib" && ["screens", "pages"].includes(segmentos[indice + 1] ?? ""));
  const indiceScreens = segmentos.findIndex((segmento) => segmento === "screens" || segmento === "pages");
  const inicio = indiceLibScreens >= 0 ? indiceLibScreens + 2 : indiceScreens >= 0 ? indiceScreens + 1 : -1;
  if (inicio < 0) {
    return undefined;
  }

  const arquivoFinal = segmentos.at(-1) ?? "";
  const nomeBase = arquivoFinal
    .replace(/\.(?:dart)$/i, "")
    .replace(/_(screen|page)$/i, "");
  return {
    rota: montarRotaConsumer([...segmentos.slice(inicio, -1), nomeBase]),
    arquivo: relacaoArquivo,
    tipoArquivo: "screen",
  };
}

export interface RotaReactViteConsumerDrift {
  rota: string;
  arquivoRotas: string;
  arquivoComponente?: string;
}

export interface RotaFlutterConsumerDrift {
  rota: string;
  arquivoRotas: string;
}

export interface RotaAngularConsumerDrift {
  rota: string;
  arquivoRotas: string;
  componente?: string;
  arquivoComponente?: string;
  arquivoRotasFilhas?: string;
}

export function normalizarRotaDeclaradaConsumer(caminhoCru: string, prefixo = "/"): string {
  const partesPrefixo = prefixo.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const partesCaminho = (caminhoCru ?? "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  return montarRotaConsumer([...partesPrefixo, ...partesCaminho]);
}

export function resolverImportRelativoConsumer(relacaoArquivoBase: string, especificador: string): string | undefined {
  if (!especificador.startsWith(".")) {
    return undefined;
  }
  const baseDir = path.posix.dirname(normalizarRelacaoConsumer(relacaoArquivoBase));
  for (const sufixo of ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"]) {
    const candidato = path.posix.normalize(path.posix.join(baseDir, `${especificador}${sufixo}`));
    if (/\.(?:ts|tsx|js|jsx)$/i.test(candidato)) {
      return candidato;
    }
  }
  return undefined;
}

export function extrairImportsTypeScriptConsumer(relacaoArquivo: string, codigo: string): Map<string, string> {
  const imports = new Map<string, string>();
  for (const match of codigo.matchAll(/import\s*\{\s*([^}]+)\s*\}\s*from\s*["']([^"']+)["']/g)) {
    const arquivoImportado = resolverImportRelativoConsumer(relacaoArquivo, match[2]);
    if (!arquivoImportado) {
      continue;
    }
    for (const bruto of match[1].split(",")) {
      const local = bruto.trim().split(/\s+as\s+/i).at(-1)?.trim();
      if (local) {
        imports.set(local, arquivoImportado);
      }
    }
  }
  for (const match of codigo.matchAll(/import\s+([A-Za-z_]\w*)\s+from\s*["']([^"']+)["']/g)) {
    const arquivoImportado = resolverImportRelativoConsumer(relacaoArquivo, match[2]);
    const local = match[1]?.trim();
    if (arquivoImportado && local) {
      imports.set(local, arquivoImportado);
    }
  }
  return imports;
}

export function extrairRotasReactViteConsumer(relacaoArquivo: string, codigo: string): RotaReactViteConsumerDrift[] {
  const imports = extrairImportsTypeScriptConsumer(relacaoArquivo, codigo);
  const rotas = new Map<string, RotaReactViteConsumerDrift>();
  const registrar = (caminhoCru: string, componente?: string) => {
    const rota = normalizarRotaDeclaradaConsumer(caminhoCru);
    const chave = `${rota}:${normalizarRelacaoConsumer(relacaoArquivo)}:${componente ?? "router"}`;
    rotas.set(chave, {
      rota,
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
      arquivoComponente: componente ? imports.get(componente) : undefined,
    });
  };

  for (const match of codigo.matchAll(/(?:path\s*:\s*["'`]([^"'`]*)["'`]|index\s*:\s*true)[\s\S]{0,260}?(?:element\s*:\s*<\s*([A-Za-z_]\w*)|Component\s*:\s*([A-Za-z_]\w*))/g)) {
    const caminhoCru = match[1] ?? "";
    const componente = match[2] ?? match[3];
    registrar(caminhoCru, componente);
  }

  for (const match of codigo.matchAll(/<Route\b[^>]*?(?:path=["'`]([^"'`]*)["'`][^>]*?)?(index\b)?[^>]*?(?:element=\{\s*<\s*([A-Za-z_]\w*)|Component=\{\s*([A-Za-z_]\w*))/g)) {
    const caminhoCru = match[2] ? "" : (match[1] ?? "");
    const componente = match[3] ?? match[4];
    registrar(caminhoCru, componente);
  }

  return [...rotas.values()];
}

export function normalizarRotaDeclaradaFlutter(caminhoCru: string): string {
  return montarRotaConsumer((caminhoCru ?? "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean));
}

export function extrairRotasFlutterConsumer(relacaoArquivo: string, codigo: string): RotaFlutterConsumerDrift[] {
  const rotas = new Map<string, RotaFlutterConsumerDrift>();
  const registrar = (caminhoCru: string) => {
    const rota = normalizarRotaDeclaradaFlutter(caminhoCru);
    rotas.set(`${rota}:${normalizarRelacaoConsumer(relacaoArquivo)}`, {
      rota,
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
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

export function extrairRotasAngularConsumerDiretas(relacaoArquivo: string, codigo: string, prefixo = "/"): RotaAngularConsumerDrift[] {
  const imports = extrairImportsTypeScriptConsumer(relacaoArquivo, codigo);

  const rotas: RotaAngularConsumerDrift[] = [];
  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,320}?component\s*:\s*([A-Za-z_]\w*)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const componente = match[2];
    rotas.push({
      rota: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
      componente,
      arquivoComponente: imports.get(componente),
    });
  }

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,320}?loadComponent\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const arquivoComponente = resolverImportRelativoConsumer(relacaoArquivo, match[2] ?? "");
    rotas.push({
      rota: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
      arquivoComponente,
    });
  }

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,360}?loadChildren\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const arquivoRotasFilhas = resolverImportRelativoConsumer(relacaoArquivo, match[2] ?? "");
    rotas.push({
      rota: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarRelacaoConsumer(relacaoArquivo),
      arquivoRotasFilhas,
    });
  }

  return rotas;
}

export async function extrairRotasAngularConsumer(
  diretorioBase: string,
  relacaoArquivo: string,
  prefixo = "/",
  visitados = new Set<string>(),
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<RotaAngularConsumerDrift[]> {
  const relacaoNormalizada = normalizarRelacaoConsumer(relacaoArquivo);
  if (visitados.has(relacaoNormalizada)) {
    return [];
  }
  visitados.add(relacaoNormalizada);

  let codigo = "";
  try {
    const arquivo = path.join(diretorioBase, relacaoNormalizada);
    codigo = adaptadorLeitura
      ? await adaptadorLeitura.lerTexto(arquivo)
      : await readFile(arquivo, "utf8");
  } catch {
    return [];
  }

  const rotas = extrairRotasAngularConsumerDiretas(relacaoNormalizada, codigo, prefixo);
  const filhas: RotaAngularConsumerDrift[] = [];
  for (const rota of rotas) {
    if (!rota.arquivoRotasFilhas) {
      continue;
    }
    filhas.push(...await extrairRotasAngularConsumer(
      diretorioBase,
      rota.arquivoRotasFilhas,
      rota.rota,
      visitados,
      adaptadorLeitura,
    ));
  }
  return [...rotas, ...filhas];
}

export function simboloEhBridgeConsumer(caminho: string, arquivo: string): boolean {
  return arquivoEhBridgeNextJsConsumer(arquivo)
    || arquivoEhBridgeReactViteConsumer(arquivo)
    || arquivoEhBridgeAngularConsumer(arquivo)
    || arquivoEhBridgeFlutterConsumer(arquivo)
    || /(?:^|\.)(?:src\.)?lib\.(?:sema_consumer_bridge|sema\.)/i.test(caminho)
    || /(?:^|\.)(?:src\.)?app\.(?:sema_consumer_bridge|sema\.)/i.test(caminho)
    || /(?:^|\.)(?:lib\.)?(?:sema_consumer_bridge|api\.sema_contract_bridge|sema\.)/i.test(caminho);
}
