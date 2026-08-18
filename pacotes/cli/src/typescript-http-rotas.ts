// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: extracao de rotas HTTP em TypeScript; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import ts from "typescript";
import {
  METODOS_HTTP,
  deduplicarRotas,
  extrairMetodosHttpNext,
  extrairNomeExportado,
  normalizarSeparadores,
  type ParametroRotaTypeScript,
  type RotaTypeScriptExtraida,
} from "./typescript-http-modelos.js";

export function inferirCaminhoNext(relacaoArquivo: string): { caminho: string; parametros: ParametroRotaTypeScript[] } | undefined {
  const relacao = normalizarSeparadores(relacaoArquivo);
  const segmentos = relacao.split("/");
  const indiceSrcAppApi = segmentos.findIndex((segmento, indice) =>
    segmento === "src" && segmentos[indice + 1] === "app" && segmentos[indice + 2] === "api");
  const indiceAppApi = segmentos.findIndex((segmento, indice) => segmento === "app" && segmentos[indice + 1] === "api");

  const inicioApi = indiceSrcAppApi >= 0
    ? indiceSrcAppApi + 3
    : indiceAppApi >= 0
      ? indiceAppApi + 2
      : -1;
  if (inicioApi < 0) {
    return undefined;
  }

  const caminhoAteRoute = segmentos.slice(inicioApi, -1);
  if (segmentos.at(-1) !== "route.ts" && segmentos.at(-1) !== "route.js") {
    return undefined;
  }

  const parametros: ParametroRotaTypeScript[] = [];
  const partes = caminhoAteRoute
    .filter((segmento) => segmento && !/^\(.*\)$/.test(segmento) && !segmento.startsWith("@"))
    .map((segmento) => {
      const opcionalCatchAll = segmento.match(/^\[\[\.\.\.([A-Za-z_]\w*)\]\]$/);
      if (opcionalCatchAll) {
        parametros.push({ nome: opcionalCatchAll[1]!, tipoSema: "Texto" });
        return `{${opcionalCatchAll[1]}}`;
      }

      const catchAll = segmento.match(/^\[\.\.\.([A-Za-z_]\w*)\]$/);
      if (catchAll) {
        parametros.push({ nome: catchAll[1]!, tipoSema: "Texto" });
        return `{${catchAll[1]}}`;
      }

      const dinamico = segmento.match(/^\[([A-Za-z_]\w*)\]$/);
      if (dinamico) {
        const nome = dinamico[1]!;
        parametros.push({
          nome,
          tipoSema: /(^|_)id$/i.test(nome) ? "Id" : "Texto",
        });
        return `{${nome}}`;
      }

      return segmento;
    });

  return {
    caminho: (`/api/${partes.join("/")}`).replace(/\/+/g, "/"),
    parametros,
  };
}

export function identificarRotasNodeHttp(
  sourceFile: ts.SourceFile,
  nomeSimbolo: string,
  corpo: ts.Block,
): RotaTypeScriptExtraida[] {
  const rotas: Array<{ metodo: string; caminho: string }> = [];

  const visitar = (node: ts.Node): void => {
    if (ts.isIfStatement(node)) {
      const expressao = node.expression.getText(sourceFile);
      const caminho = expressao.match(/(?:req|request)\.url\s*===\s*["'`]([^"'`]+)["'`]/)?.[1];
      const metodo = expressao.match(/(?:req|request)\.method\s*===\s*["'`]([A-Z]+)["'`]/)?.[1]?.toUpperCase();
      if (caminho && metodo && METODOS_HTTP.has(metodo)) {
        rotas.push({ caminho, metodo });
      }
    }
    node.forEachChild(visitar);
  };

  visitar(corpo);
  return deduplicarRotas(rotas.map((rota) => ({
    origem: "firebase",
    metodo: rota.metodo,
    caminho: rota.caminho,
    simbolo: nomeSimbolo,
    parametros: [],
  })));
}

export function extrairRotasNodeWorker(sourceFile: ts.SourceFile, relacaoArquivo: string): RotaTypeScriptExtraida[] {
  const relacao = normalizarSeparadores(relacaoArquivo);
  const pareceWorkerHttp = /(?:^|\/)(?:apps\/worker\/|src\/services\/health-check|health-check\.ts$|sema_contract_bridge\.ts$)/.test(relacao);
  if (!pareceWorkerHttp) {
    return [];
  }

  const rotas: RotaTypeScriptExtraida[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body && statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) {
      rotas.push(...identificarRotasNodeHttp(sourceFile, statement.name.text, statement.body));
      continue;
    }

    if (ts.isVariableStatement(statement) && statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaracao of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaracao.name) || !declaracao.initializer) {
          continue;
        }
        if (ts.isArrowFunction(declaracao.initializer) || ts.isFunctionExpression(declaracao.initializer)) {
          const corpo = declaracao.initializer.body;
          if (ts.isBlock(corpo)) {
            rotas.push(...identificarRotasNodeHttp(sourceFile, declaracao.name.text, corpo));
          }
        }
      }
      continue;
    }

    if (!ts.isClassDeclaration(statement) || !statement.name) {
      continue;
    }

    for (const member of statement.members) {
      if (!ts.isMethodDeclaration(member) || !member.body || !member.name) {
        continue;
      }
      rotas.push(...identificarRotasNodeHttp(sourceFile, `${statement.name.text}.${member.name.getText(sourceFile)}`, member.body));
    }
  }

  return deduplicarRotas(rotas);
}

function combinarCaminhoPrefixo(base: string | undefined, sufixo: string): string {
  const prefixo = (base ?? "").replace(/\/+$/u, "");
  const caminho = sufixo.startsWith("/") ? sufixo : `/${sufixo}`;
  const combinado = `${prefixo}${caminho}`.replace(/\/{2,}/gu, "/");
  return combinado.length > 1 && combinado.endsWith("/") ? combinado.slice(0, -1) : combinado;
}

function extrairPrefixoRegister(node: ts.CallExpression): string | undefined {
  const opcoes = node.arguments[1];
  if (!opcoes || !ts.isObjectLiteralExpression(opcoes)) {
    return undefined;
  }
  for (const propriedade of opcoes.properties) {
    if (ts.isPropertyAssignment(propriedade)
      && ts.isIdentifier(propriedade.name)
      && propriedade.name.text === "prefix"
      && propriedade.initializer
      && ts.isStringLiteralLike(propriedade.initializer)) {
      return propriedade.initializer.text;
    }
  }
  return undefined;
}

export function extrairRotasExpressFastify(sourceFile: ts.SourceFile): RotaTypeScriptExtraida[] {
  const textoArquivo = sourceFile.getFullText();
  const importouExpress = /(?:from\s+["']express["']|require\(\s*["']express["']\s*\))/.test(textoArquivo);
  const importouFastify = /(?:from\s+["']fastify["']|require\(\s*["']fastify["']\s*\))/.test(textoArquivo);
  const importouKoa = /(?:from\s+["'](?:@koa\/router|koa-router|koa)["']|require\(\s*["'](?:@koa\/router|koa-router|koa)["']\s*\))/.test(textoArquivo);
  if (!importouExpress && !importouFastify && !importouKoa) {
    return [];
  }

  const arestasMontagem: Array<{ pai: string; filho: string; prefixo: string }> = [];
  const prefixoDireto = new Map<string, string>();
  const prefixoPorParametro = new Map<string, string>();
  const prefixoResolvido = new Map<string, string>();

  const resolverPrefixo = (receptor: string, profundidade = 0): string => {
    if (prefixoResolvido.has(receptor)) {
      return prefixoResolvido.get(receptor)!;
    }
    if (profundidade > 8) {
      return "";
    }
    let prefixo = prefixoDireto.get(receptor) ?? "";
    const aresta = arestasMontagem.find((item) => item.filho === receptor);
    if (aresta) {
      prefixo = combinarCaminhoPrefixo(resolverPrefixo(aresta.pai, profundidade + 1), aresta.prefixo);
    }
    prefixoResolvido.set(receptor, prefixo);
    return prefixo;
  };

  const visitarMontagens = (node: ts.Node): void => {
    if (ts.isVariableStatement(node)) {
      for (const declaracao of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaracao.name) || !declaracao.initializer) {
          continue;
        }
        const init = declaracao.initializer;
        const argumentoFastify = ts.isCallExpression(init)
          && ts.isIdentifier(init.expression)
          && /fastify/i.test(init.expression.text)
          && init.arguments[0]
          && ts.isObjectLiteralExpression(init.arguments[0])
          ? init.arguments[0]
          : undefined;
        if (argumentoFastify) {
          for (const propriedade of argumentoFastify.properties) {
            if (ts.isPropertyAssignment(propriedade)
              && ts.isIdentifier(propriedade.name)
              && propriedade.name.text === "prefix"
              && propriedade.initializer
              && ts.isStringLiteralLike(propriedade.initializer)) {
              prefixoDireto.set(declaracao.name.text, propriedade.initializer.text);
            }
          }
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
      const receptor = node.expression.expression.text;
      const nomeMetodo = node.expression.name.text.toLowerCase();

      if (nomeMetodo === "use"
        && node.arguments[0]
        && ts.isStringLiteralLike(node.arguments[0])
        && node.arguments[0].text.startsWith("/")
        && node.arguments[1]
        && ts.isIdentifier(node.arguments[1])) {
        arestasMontagem.push({ pai: receptor, filho: node.arguments[1].text, prefixo: node.arguments[0].text });
      } else if (nomeMetodo === "prefix"
        && node.arguments[0]
        && ts.isStringLiteralLike(node.arguments[0])
        && node.arguments[0].text.startsWith("/")) {
        prefixoDireto.set(receptor, combinarCaminhoPrefixo(node.arguments[0].text, prefixoDireto.get(receptor) ?? ""));
      } else if (nomeMetodo === "register" && importouFastify) {
        const prefixo = extrairPrefixoRegister(node);
        const alvo = node.arguments[0];
        if (prefixo && alvo) {
          const funcao = ts.isFunctionExpression(alvo) || ts.isArrowFunction(alvo) ? alvo : undefined;
          const parametro = funcao?.parameters[0];
          if (parametro && ts.isIdentifier(parametro.name)) {
            prefixoPorParametro.set(parametro.name.text, prefixo);
          }
        }
      }
    }
    node.forEachChild(visitarMontagens);
  };
  visitarMontagens(sourceFile);

  const rotas: RotaTypeScriptExtraida[] = [];

  const escolherOrigemChamada = (receptor: string): "express" | "fastify" | "koa" | undefined => {
    if (/fastify/i.test(receptor)) {
      return "fastify";
    }
    if (importouExpress) {
      return "express";
    }
    if (importouKoa) {
      return "koa";
    }
    if (importouFastify || prefixoPorParametro.has(receptor)) {
      return "fastify";
    }
    return undefined;
  };

  const visitar = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
      const receptor = node.expression.expression.text;
      const nomeMetodo = node.expression.name.text.toLowerCase();
      const prefixoReceptor = prefixoPorParametro.get(receptor) ?? resolverPrefixo(receptor);

      if (nomeMetodo === "route" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0]) && importouFastify) {
        let metodo: string | undefined;
        let caminho: string | undefined;
        for (const propriedade of node.arguments[0].properties) {
          if (!ts.isPropertyAssignment(propriedade) || !ts.isIdentifier(propriedade.name)) {
            continue;
          }
          const valor = propriedade.initializer && ts.isStringLiteralLike(propriedade.initializer)
            ? propriedade.initializer.text
            : undefined;
          if (propriedade.name.text === "method" && valor) {
            metodo = valor.toUpperCase();
          }
          if (propriedade.name.text === "url" && valor) {
            caminho = valor;
          }
        }
        if (metodo && caminho?.startsWith("/") && METODOS_HTTP.has(metodo)) {
          rotas.push({
            origem: "fastify",
            metodo,
            caminho: converterCaminhoParametros(combinarCaminhoPrefixo(prefixoReceptor, caminho)),
            simbolo: receptor,
            parametros: extrairParametrosCaminhoDoisPontos(caminho),
          });
        }
      } else if (nomeMetodo === "all" || nomeMetodo === "del" || METODOS_HTTP.has(nomeMetodo.toUpperCase())) {
        const caminho = node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])
          ? node.arguments[0].text
          : undefined;
        const origem = escolherOrigemChamada(receptor);
        const handler = node.arguments[1] && ts.isIdentifier(node.arguments[1]) ? node.arguments[1].text : undefined;
        if (caminho?.startsWith("/") && origem) {
          const metodos = nomeMetodo === "all"
            ? ["GET", "POST", "PUT", "PATCH", "DELETE"]
            : [nomeMetodo === "del" ? "DELETE" : nomeMetodo.toUpperCase()];
          for (const metodo of metodos) {
            rotas.push({
              origem,
              metodo,
              caminho: converterCaminhoParametros(combinarCaminhoPrefixo(prefixoReceptor, caminho)),
              simbolo: handler ?? receptor,
              parametros: extrairParametrosCaminhoDoisPontos(combinarCaminhoPrefixo(prefixoReceptor, caminho)),
            });
          }
        }
      }
    }
    node.forEachChild(visitar);
  };

  visitar(sourceFile);
  return deduplicarRotas(rotas);
}

function converterCaminhoParametros(caminho: string): string {
  return caminho.replace(/:([A-Za-z_]\w*)/g, "{$1}");
}

function extrairParametrosCaminhoDoisPontos(caminho: string): ParametroRotaTypeScript[] {
  const parametros: ParametroRotaTypeScript[] = [];
  for (const correspondencia of caminho.matchAll(/:([A-Za-z_]\w*)/g)) {
    const nome = correspondencia[1]!;
    parametros.push({
      nome,
      tipoSema: /(^|_)id$/i.test(nome) ? "Id" : "Texto",
    });
  }
  return parametros;
}

export function extrairRotasTypeScriptHttp(
  sourceFile: ts.SourceFile,
  relacaoArquivo: string,
): RotaTypeScriptExtraida[] {
  const rotas: RotaTypeScriptExtraida[] = [];
  const caminhoNext = inferirCaminhoNext(relacaoArquivo);
  if (caminhoNext) {
    for (const metodo of extrairMetodosHttpNext(sourceFile)) {
      rotas.push({
        origem: "nextjs",
        metodo,
        caminho: caminhoNext.caminho,
        simbolo: metodo,
        parametros: caminhoNext.parametros,
      });
    }
  }

  rotas.push(...extrairRotasNodeWorker(sourceFile, relacaoArquivo));
  rotas.push(...extrairRotasExpressFastify(sourceFile));
  return deduplicarRotas(rotas);
}
