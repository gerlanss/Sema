import ts from "typescript";

export interface ParametroRotaTypeScript {
  nome: string;
  tipoSema: "Texto" | "Inteiro" | "Decimal" | "Id";
}

export interface RotaTypeScriptExtraida {
  origem: "nextjs" | "firebase";
  metodo: string;
  caminho: string;
  simbolo: string;
  parametros: ParametroRotaTypeScript[];
}

const METODOS_HTTP = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function normalizarSeparadores(relacao: string): string {
  return relacao.replace(/\\/g, "/");
}

function deduplicarRotas(rotas: RotaTypeScriptExtraida[]): RotaTypeScriptExtraida[] {
  const mapa = new Map<string, RotaTypeScriptExtraida>();
  for (const rota of rotas) {
    const chave = `${rota.origem}:${rota.metodo}:${rota.caminho}:${rota.simbolo}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, rota);
    }
  }
  return [...mapa.values()];
}

function extrairNomeExportado(statement: ts.Statement, sourceFile: ts.SourceFile): string[] {
  if (ts.isFunctionDeclaration(statement) && statement.name && statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) {
    return [statement.name.text];
  }

  if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) {
    return [];
  }

  const nomes: string[] = [];
  for (const declaracao of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaracao.name) || !declaracao.initializer) {
      continue;
    }
    if (ts.isArrowFunction(declaracao.initializer) || ts.isFunctionExpression(declaracao.initializer)) {
      nomes.push(declaracao.name.getText(sourceFile));
    }
  }
  return nomes;
}

function extrairMetodosHttpNext(sourceFile: ts.SourceFile): string[] {
  const encontrados = new Set<string>();
  for (const statement of sourceFile.statements) {
    for (const nome of extrairNomeExportado(statement, sourceFile)) {
      const metodo = nome.toUpperCase();
      if (METODOS_HTTP.has(metodo)) {
        encontrados.add(metodo);
      }
    }
  }
  return [...encontrados];
}

function inferirCaminhoNext(relacaoArquivo: string): { caminho: string; parametros: ParametroRotaTypeScript[] } | undefined {
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

function identificarRotasNodeHttp(
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

function extrairRotasNodeWorker(sourceFile: ts.SourceFile, relacaoArquivo: string): RotaTypeScriptExtraida[] {
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
  return deduplicarRotas(rotas);
}
