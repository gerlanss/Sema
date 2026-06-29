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

import { CampoImportado, ErroImportado, TipoDescoberto, normalizarNomeCampoImportado } from "./importador.part01.js";
import { expandirCamposTs } from "./importador.part02.js";

export function camposEstruturadosTypeScriptHttp(
  nomeParametro: string,
  tipoTexto: string | undefined,
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): CampoImportado[] {
  const campos = expandirCamposTs(nomeParametro, tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados, false);
  const nomeWrapper = normalizarNomeCampoImportado(nomeParametro);
  if (campos.length === 1 && campos[0]?.nome === nomeWrapper && campos[0]?.tipo === "Json") {
    return [];
  }
  return campos;
}

export function errosPorStatusHttp(statuses: number[]): ErroImportado[] {
  return [...new Set(statuses)].map((status) => {
    switch (status) {
      case 401:
        return { nome: "nao_autorizado", mensagem: "Falha HTTP importada automaticamente com status 401." };
      case 403:
        return { nome: "acesso_negado", mensagem: "Falha HTTP importada automaticamente com status 403." };
      case 404:
        return { nome: "nao_encontrado", mensagem: "Falha HTTP importada automaticamente com status 404." };
      case 409:
        return { nome: "conflito", mensagem: "Falha HTTP importada automaticamente com status 409." };
      case 422:
        return { nome: "entrada_invalida", mensagem: "Falha HTTP importada automaticamente com status 422." };
      case 500:
        return { nome: "erro_interno", mensagem: "Falha HTTP importada automaticamente com status 500." };
      default:
        return { nome: `erro_http_${status}`, mensagem: `Falha HTTP importada automaticamente com status ${status}.` };
    }
  });
}

export function resolverEscopoImportacaoNextJs(diretorioEntrada: string): { baseProjeto: string; diretorioEscopo: string } {
  const resolvido = path.resolve(diretorioEntrada);
  const partes = path.parse(resolvido);
  const relativoSemRaiz = resolvido.slice(partes.root.length);
  const segmentos = relativoSemRaiz.split(path.sep).filter(Boolean);
  const procurarSequencia = (sequencia: string[]): number =>
    segmentos.findIndex((segmento, indice) => sequencia.every((item, deslocamento) => segmentos[indice + deslocamento]?.toLowerCase() === item));
  const montarBase = (indice: number) =>
    indice <= 0
      ? partes.root
      : path.join(partes.root, ...segmentos.slice(0, indice));

  const indiceSrcAppApi = procurarSequencia(["src", "app", "api"]);
  if (indiceSrcAppApi >= 0) {
    return {
      baseProjeto: montarBase(indiceSrcAppApi),
      diretorioEscopo: resolvido,
    };
  }

  const indiceAppApi = procurarSequencia(["app", "api"]);
  if (indiceAppApi >= 0) {
    return {
      baseProjeto: montarBase(indiceAppApi),
      diretorioEscopo: resolvido,
    };
  }

  const indiceSrcApp = procurarSequencia(["src", "app"]);
  if (indiceSrcApp >= 0) {
    return {
      baseProjeto: montarBase(indiceSrcApp),
      diretorioEscopo: resolvido,
    };
  }

  const indiceApp = procurarSequencia(["app"]);
  if (indiceApp >= 0) {
    return {
      baseProjeto: montarBase(indiceApp),
      diretorioEscopo: resolvido,
    };
  }

  return {
    baseProjeto: resolvido,
    diretorioEscopo: resolvido,
  };
}

export interface SuperficieConsumerImportada {
  caminho: string;
  arquivo: string;
  tipoArquivo: string;
}

export function normalizarCaminhoImportado(caminhoArquivo: string): string {
  return caminhoArquivo.replace(/\\/g, "/");
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

export function montarCaminhoRotaConsumer(partes: string[]): string {
  const filtradas = partes
    .filter((segmento) => segmento && segmento !== "index" && !/^\(.*\)$/.test(segmento) && !segmento.startsWith("@"))
    .map(normalizarSegmentoRotaConsumer);
  return filtradas.length > 0 ? `/${filtradas.join("/")}`.replace(/\/+/g, "/") : "/";
}

export function resolverEscopoImportacaoFrontendConsumer(diretorioEntrada: string): { baseProjeto: string; diretorioEscopo: string } {
  const resolvido = path.resolve(diretorioEntrada);
  const partes = path.parse(resolvido);
  const segmentos = resolvido.slice(partes.root.length).split(path.sep).filter(Boolean);
  const procurarSequencia = (sequencia: string[]) =>
    segmentos.findIndex((segmento, indice) => sequencia.every((item, deslocamento) => segmentos[indice + deslocamento]?.toLowerCase() === item));
  const montarBase = (indice: number) =>
    indice <= 0
      ? partes.root
      : path.join(partes.root, ...segmentos.slice(0, indice));

  for (const sequencia of [
    ["src", "pages"],
    ["pages"],
    ["src", "app", "api"],
    ["app", "api"],
    ["src", "app"],
    ["app"],
    ["src", "lib"],
    ["lib"],
  ]) {
    const indice = procurarSequencia(sequencia);
    if (indice >= 0) {
      return {
        baseProjeto: montarBase(indice),
        diretorioEscopo: resolvido,
      };
    }
  }

  return {
    baseProjeto: resolvido,
    diretorioEscopo: resolvido,
  };
}

export function arquivoEhBridgeNextJsConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

export function arquivoEhBridgeReactViteConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

export function arquivoEhBridgeAngularConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|js)$/i.test(relacao);
}

export function arquivoEhSuperficieNextJsConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/(?:(?!api\/).)*?(?:page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

export function arquivoEhSuperficieReactViteConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /^(?:src\/)?pages\/.+\.(?:ts|tsx|js|jsx)$/i.test(relacao)
    || /^(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(relacao);
}

export function arquivoEhRotasReactViteConsumer(relacaoArquivo: string, codigo?: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?(?:app\/)?(?:router|routes)\.(?:ts|tsx|js|jsx)$/i.test(relacao)
    || /from\s+["']react-router-dom["']|createBrowserRouter|RouterProvider|useRoutes\s*\(|<Routes\b|<Route\b/.test(codigo ?? "");
}

export function arquivoEhRotasAngularConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app(?:\/.+)?\/[^/]+\.routes\.(?:ts|js)$/i.test(relacao);
}

export function arquivoEhRotasAngularConsumerRaiz(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\/[^/]+\.routes\.(?:ts|js)$/i.test(relacao);
}

export function arquivoEhBridgeFlutterConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:sema_consumer_bridge|api\/sema_contract_bridge|sema\/.+)\.dart$/i.test(relacao);
}

export function arquivoEhSuperficieFlutterConsumer(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:screens|pages)\/.+\.dart$/i.test(relacao)
    || /(?:^|\/)(?:lib\/)?main\.dart$/i.test(relacao);
}

export function arquivoEhRotasFlutterConsumer(relacaoArquivo: string, codigo?: string): boolean {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  return /(?:^|\/)(?:lib\/)?(?:router|app_router|routes)\.dart$/i.test(relacao)
    || /MaterialApp(?:\.router)?\s*\(|CupertinoApp(?:\.router)?\s*\(|GoRouter\s*\(/.test(codigo ?? "");
}

export function inferirCaminhoNextJsConsumer(relacaoArquivo: string): SuperficieConsumerImportada | undefined {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  const segmentos = relacao.split("/");
  const indiceSrcApp = segmentos.findIndex((segmento, indice) =>
    segmento === "src" && segmentos[indice + 1] === "app");
  const indiceApp = segmentos.findIndex((segmento) => segmento === "app");
  const inicioApp = indiceSrcApp >= 0 ? indiceSrcApp + 2 : indiceApp >= 0 ? indiceApp + 1 : -1;
  if (inicioApp < 0) {
    return undefined;
  }

  const arquivoFinal = segmentos.at(-1) ?? "";
  const tipoArquivo = arquivoFinal.match(/^(page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/)?.[1];
  if (!tipoArquivo) {
    return undefined;
  }

  const caminhoAteArquivo = segmentos.slice(inicioApp, -1);
  if (caminhoAteArquivo[0] === "api") {
    return undefined;
  }

  const partes = caminhoAteArquivo
    .filter((segmento) => segmento);

  const caminho = montarCaminhoRotaConsumer(partes);
  return {
    caminho,
    arquivo: relacao,
    tipoArquivo,
  };
}

export function inferirCaminhoReactViteConsumer(relacaoArquivo: string): SuperficieConsumerImportada | undefined {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  if (!arquivoEhSuperficieReactViteConsumer(relacao)) {
    return undefined;
  }

  if (/(?:^|\/)(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(relacao)) {
    return {
      caminho: "/",
      arquivo: relacao,
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
  const caminho = montarCaminhoRotaConsumer([...segmentos.slice(inicioPages, -1), nomeBase]);
  return {
    caminho,
    arquivo: relacao,
    tipoArquivo: "page",
  };
}

export function inferirCaminhoFlutterConsumer(relacaoArquivo: string): SuperficieConsumerImportada | undefined {
  const relacao = normalizarCaminhoImportado(relacaoArquivo);
  if (!arquivoEhSuperficieFlutterConsumer(relacao)) {
    return undefined;
  }

  if (/(?:^|\/)(?:lib\/)?main\.dart$/i.test(relacao)) {
    return {
      caminho: "/",
      arquivo: relacao,
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
    caminho: montarCaminhoRotaConsumer([...segmentos.slice(inicio, -1), nomeBase]),
    arquivo: relacao,
    tipoArquivo: "screen",
  };
}

export interface RotaReactViteConsumerImportada {
  caminho: string;
  arquivoRotas: string;
  arquivoComponente?: string;
}

export interface RotaFlutterConsumerImportada {
  caminho: string;
  arquivoRotas: string;
}

export interface RotaAngularConsumerImportada {
  caminho: string;
  arquivoRotas: string;
  arquivoComponente?: string;
  arquivoRotasFilhas?: string;
}

export function normalizarRotaDeclaradaConsumer(caminhoCru: string, prefixo = "/"): string {
  const partesPrefixo = prefixo.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const partesCaminho = (caminhoCru ?? "").trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  return montarCaminhoRotaConsumer([...partesPrefixo, ...partesCaminho]);
}

export function resolverImportRelativoTypeScript(relacaoArquivoBase: string, especificador: string): string | undefined {
  if (!especificador.startsWith(".")) {
    return undefined;
  }
  const baseDir = path.posix.dirname(normalizarCaminhoImportado(relacaoArquivoBase));
  for (const sufixo of ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]) {
    const candidato = path.posix.normalize(path.posix.join(baseDir, `${especificador}${sufixo}`));
    if (!/\.(?:ts|tsx|js|jsx)$/i.test(candidato)) {
      continue;
    }
    return candidato;
  }
  return undefined;
}

export function extrairImportsTypeScriptConsumer(relacaoArquivo: string, codigo: string): Map<string, string> {
  const imports = new Map<string, string>();
  for (const match of codigo.matchAll(/import\s*\{\s*([^}]+)\s*\}\s*from\s*["']([^"']+)["']/g)) {
    const moduloImportado = match[2];
    const relacaoImportada = resolverImportRelativoTypeScript(relacaoArquivo, moduloImportado);
    if (!relacaoImportada) {
      continue;
    }
    for (const bruto of match[1].split(",")) {
      const normalizado = bruto.trim();
      if (!normalizado) {
        continue;
      }
      const local = normalizado.split(/\s+as\s+/i).at(-1)?.trim();
      if (local) {
        imports.set(local, relacaoImportada);
      }
    }
  }
  for (const match of codigo.matchAll(/import\s+([A-Za-z_]\w*)\s+from\s*["']([^"']+)["']/g)) {
    const relacaoImportada = resolverImportRelativoTypeScript(relacaoArquivo, match[2]);
    const local = match[1]?.trim();
    if (relacaoImportada && local) {
      imports.set(local, relacaoImportada);
    }
  }
  return imports;
}

export function extrairRotasReactViteConsumer(relacaoArquivo: string, codigo: string): RotaReactViteConsumerImportada[] {
  const imports = extrairImportsTypeScriptConsumer(relacaoArquivo, codigo);
  const rotas = new Map<string, RotaReactViteConsumerImportada>();
  const registrar = (caminhoCru: string, componente?: string) => {
    const caminho = normalizarRotaDeclaradaConsumer(caminhoCru);
    const chave = `${caminho}:${normalizarCaminhoImportado(relacaoArquivo)}:${componente ?? "router"}`;
    rotas.set(chave, {
      caminho,
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
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

export function extrairRotasAngularConsumerDiretas(
  relacaoArquivo: string,
  codigo: string,
  prefixo = "/",
): RotaAngularConsumerImportada[] {
  const imports = extrairImportsTypeScriptConsumer(relacaoArquivo, codigo);
  const rotas: RotaAngularConsumerImportada[] = [];

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,320}?component\s*:\s*([A-Za-z_]\w*)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const componente = match[2];
    rotas.push({
      caminho: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
      arquivoComponente: imports.get(componente),
    });
  }

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,320}?loadComponent\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const relacaoImportada = resolverImportRelativoTypeScript(relacaoArquivo, match[2] ?? "");
    rotas.push({
      caminho: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
      arquivoComponente: relacaoImportada,
    });
  }

  for (const match of codigo.matchAll(/path\s*:\s*["'`]([^"'`]*)["'`][\s\S]{0,360}?loadChildren\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const caminhoCru = (match[1] ?? "").trim();
    const relacaoImportada = resolverImportRelativoTypeScript(relacaoArquivo, match[2] ?? "");
    rotas.push({
      caminho: normalizarRotaDeclaradaConsumer(caminhoCru, prefixo),
      arquivoRotas: normalizarCaminhoImportado(relacaoArquivo),
      arquivoRotasFilhas: relacaoImportada,
    });
  }

  return rotas;
}
