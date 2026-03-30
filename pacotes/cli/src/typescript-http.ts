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

export interface CampoInferidoTypeScriptHttp {
  nome: string;
  tipoTexto?: string;
  obrigatorio: boolean;
}

export interface ExportacaoTypeScriptHttp {
  corpo?: ts.Block;
  retorno?: string;
  parametros: readonly ts.ParameterDeclaration[];
  declaracao: ts.FunctionLikeDeclarationBase;
}

export interface SemanticaHandlerTypeScriptHttp {
  query: CampoInferidoTypeScriptHttp[];
  body: CampoInferidoTypeScriptHttp[];
  bodyTipoTexto?: string;
  response: CampoInferidoTypeScriptHttp[];
  responseTipoTexto?: string;
  statuses: number[];
  errorStatuses: number[];
}

interface ValorLocalTypeScriptHttp {
  tipoTexto?: string;
  campos: CampoInferidoTypeScriptHttp[];
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

function deduplicarCampos(campos: CampoInferidoTypeScriptHttp[]): CampoInferidoTypeScriptHttp[] {
  const mapa = new Map<string, CampoInferidoTypeScriptHttp>();
  for (const campo of campos) {
    const chave = campo.nome;
    const existente = mapa.get(chave);
    if (!existente) {
      mapa.set(chave, campo);
      continue;
    }
    mapa.set(chave, {
      nome: campo.nome,
      tipoTexto: existente.tipoTexto ?? campo.tipoTexto,
      obrigatorio: existente.obrigatorio || campo.obrigatorio,
    });
  }
  return [...mapa.values()];
}

function deduplicarNumeros(valores: number[]): number[] {
  return [...new Set(valores)].sort((a, b) => a - b);
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

function tipoInferidoPorNomeCampo(nome: string): string | undefined {
  return /(^|_)?id$/i.test(nome) || /Id$/.test(nome)
    ? "Id"
    : undefined;
}

function inferirTipoBasicoDeExpressao(expr: ts.Expression | undefined, nomeCampo?: string): string | undefined {
  if (!expr) {
    return nomeCampo ? tipoInferidoPorNomeCampo(nomeCampo) : undefined;
  }
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isTypeAssertionExpression(expr)) {
    return inferirTipoBasicoDeExpressao(expr.expression, nomeCampo);
  }
  if (ts.isAwaitExpression(expr)) {
    return inferirTipoBasicoDeExpressao(expr.expression, nomeCampo);
  }
  if (ts.isStringLiteralLike(expr) || ts.isNoSubstitutionTemplateLiteral(expr) || ts.isTemplateExpression(expr)) {
    return "string";
  }
  if (ts.isNumericLiteral(expr)) {
    return "number";
  }
  if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword) {
    return "boolean";
  }
  if (ts.isArrayLiteralExpression(expr) || ts.isObjectLiteralExpression(expr)) {
    return "Json";
  }
  if (expr.kind === ts.SyntaxKind.NullKeyword) {
    return "Json";
  }
  if (ts.isCallExpression(expr)) {
    const nome = expr.expression.getText().replace(/\s+/g, "");
    if (/^(Number|parseFloat)$/.test(nome)) {
      return "number";
    }
    if (/^parseInt$/.test(nome)) {
      return "int";
    }
    if (/^(Boolean)$/.test(nome)) {
      return "boolean";
    }
    if (/^(String)$/.test(nome)) {
      return "string";
    }
  }
  return nomeCampo ? tipoInferidoPorNomeCampo(nomeCampo) : undefined;
}

function extrairCamposObjetoLiteral(objeto: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile): CampoInferidoTypeScriptHttp[] {
  const campos: CampoInferidoTypeScriptHttp[] = [];
  for (const propriedade of objeto.properties) {
    if (!ts.isPropertyAssignment(propriedade) && !ts.isShorthandPropertyAssignment(propriedade)) {
      continue;
    }
    const nome = propriedade.name.getText(sourceFile).replace(/^["']|["']$/g, "");
    campos.push({
      nome,
      tipoTexto: inferirTipoBasicoDeExpressao(
        ts.isPropertyAssignment(propriedade) ? propriedade.initializer : propriedade.name,
        nome,
      ),
      obrigatorio: true,
    });
  }
  return deduplicarCampos(campos);
}

function extrairStatusHttp(expr?: ts.Expression): number | undefined {
  if (!expr || !ts.isObjectLiteralExpression(expr)) {
    return undefined;
  }
  for (const propriedade of expr.properties) {
    if (!ts.isPropertyAssignment(propriedade) || propriedade.name.getText().replace(/^["']|["']$/g, "") !== "status") {
      continue;
    }
    if (ts.isNumericLiteral(propriedade.initializer)) {
      return Number(propriedade.initializer.text);
    }
  }
  return undefined;
}

function ehRequestUrl(expr: ts.Expression, requestNames: Set<string>): boolean {
  return ts.isPropertyAccessExpression(expr)
    && expr.name.text === "url"
    && ts.isIdentifier(expr.expression)
    && requestNames.has(expr.expression.text);
}

function ehNewUrl(expr: ts.Expression, requestNames: Set<string>): boolean {
  return ts.isNewExpression(expr)
    && ts.isIdentifier(expr.expression)
    && expr.expression.text === "URL"
    && Boolean(expr.arguments?.some((argumento) => ehRequestUrl(argumento, requestNames)));
}

function ehSearchParamsSource(expr: ts.Expression, requestNames: Set<string>, urlAliases: Set<string>, searchParamsAliases: Set<string>): boolean {
  if (ts.isIdentifier(expr)) {
    return searchParamsAliases.has(expr.text);
  }

  if (ts.isPropertyAccessExpression(expr) && expr.name.text === "searchParams") {
    const alvo = expr.expression;
    if (ts.isPropertyAccessExpression(alvo) && alvo.name.text === "nextUrl" && ts.isIdentifier(alvo.expression) && requestNames.has(alvo.expression.text)) {
      return true;
    }
    if (ts.isIdentifier(alvo) && urlAliases.has(alvo.text)) {
      return true;
    }
  }

  return false;
}

function ehCallRequest(expr: ts.Expression, requestNames: Set<string>, metodo: "json" | "formData"): boolean {
  const alvo = ts.isAwaitExpression(expr) ? expr.expression : expr;
  return ts.isCallExpression(alvo)
    && ts.isPropertyAccessExpression(alvo.expression)
    && alvo.expression.name.text === metodo
    && ts.isIdentifier(alvo.expression.expression)
    && requestNames.has(alvo.expression.expression.text);
}

function obterNomeSchema(call: ts.CallExpression): string | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    return undefined;
  }
  const alvo = call.expression.expression;
  if (!ts.isIdentifier(alvo)) {
    return undefined;
  }
  return alvo.text;
}

function extrairCampoZod(expr: ts.Expression, nome: string): CampoInferidoTypeScriptHttp {
  const texto = expr.getText().replace(/\s+/g, "");
  let tipoTexto = tipoInferidoPorNomeCampo(nome);
  if (/\.uuid\(/i.test(texto)) {
    tipoTexto = "Id";
  } else if (/\.string\(/i.test(texto)) {
    tipoTexto = "string";
  } else if (/\.number\(/i.test(texto) || /\.int\(/i.test(texto)) {
    tipoTexto = /\.int\(/i.test(texto) ? "int" : "number";
  } else if (/\.boolean\(/i.test(texto)) {
    tipoTexto = "boolean";
  } else if (/\.date\(/i.test(texto)) {
    tipoTexto = "date";
  } else if (/\.array\(/i.test(texto) || /\.object\(/i.test(texto) || /\.record\(/i.test(texto)) {
    tipoTexto = "Json";
  }

  return {
    nome,
    tipoTexto,
    obrigatorio: !/\.optional\(/i.test(texto),
  };
}

function extrairSchemasZodLocais(sourceFile: ts.SourceFile): Map<string, CampoInferidoTypeScriptHttp[]> {
  const schemas = new Map<string, CampoInferidoTypeScriptHttp[]>();

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) {
      return;
    }

    for (const declaracao of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaracao.name) || !declaracao.initializer) {
        continue;
      }

      let chamada: ts.CallExpression | undefined;
      if (ts.isCallExpression(declaracao.initializer)) {
        chamada = declaracao.initializer;
      } else if (
        ts.isCallExpression(declaracao.initializer)
        && ts.isPropertyAccessExpression(declaracao.initializer.expression)
      ) {
        chamada = declaracao.initializer;
      } else if (
        ts.isCallExpression(declaracao.initializer)
        && ts.isPropertyAccessExpression(declaracao.initializer.expression)
      ) {
        chamada = declaracao.initializer;
      }

      const chamadaInicial = chamada ?? (ts.isCallExpression(declaracao.initializer) ? declaracao.initializer : undefined);
      if (!chamadaInicial) {
        continue;
      }

      let chamadaObjeto: ts.CallExpression | undefined;
      if (
        ts.isPropertyAccessExpression(chamadaInicial.expression)
        && chamadaInicial.expression.name.text === "object"
      ) {
        chamadaObjeto = chamadaInicial;
      } else if (
        ts.isPropertyAccessExpression(chamadaInicial.expression)
        && ts.isCallExpression(chamadaInicial.expression.expression)
        && ts.isPropertyAccessExpression(chamadaInicial.expression.expression.expression)
        && chamadaInicial.expression.expression.expression.name.text === "object"
      ) {
        chamadaObjeto = chamadaInicial.expression.expression;
      }

      if (!chamadaObjeto) {
        continue;
      }

      const objeto = chamadaObjeto.arguments[0];
      if (!objeto || !ts.isObjectLiteralExpression(objeto)) {
        continue;
      }

      const campos: CampoInferidoTypeScriptHttp[] = [];
      for (const propriedade of objeto.properties) {
        if (!ts.isPropertyAssignment(propriedade)) {
          continue;
        }
        const nomeCampo = propriedade.name.getText(sourceFile).replace(/^["']|["']$/g, "");
        campos.push(extrairCampoZod(propriedade.initializer, nomeCampo));
      }
      if (campos.length > 0) {
        schemas.set(declaracao.name.text, deduplicarCampos(campos));
      }
    }
  });

  return schemas;
}

function localizarExportacaoEmStatement(
  statement: ts.Statement,
  nomeExportado: string,
  sourceFile: ts.SourceFile,
): ExportacaoTypeScriptHttp | undefined {
  if (ts.isFunctionDeclaration(statement) && statement.name?.text === nomeExportado && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
    return {
      corpo: statement.body,
      retorno: statement.type?.getText(sourceFile),
      parametros: statement.parameters,
      declaracao: statement,
    };
  }

  if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
    return undefined;
  }

  for (const declaracao of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaracao.name) || declaracao.name.text !== nomeExportado || !declaracao.initializer) {
      continue;
    }
    if (ts.isArrowFunction(declaracao.initializer) || ts.isFunctionExpression(declaracao.initializer)) {
      return {
        corpo: ts.isBlock(declaracao.initializer.body) ? declaracao.initializer.body : undefined,
        retorno: declaracao.initializer.type?.getText(sourceFile),
        parametros: declaracao.initializer.parameters,
        declaracao: declaracao.initializer,
      };
    }
  }

  return undefined;
}

function inferirTipoPorContexto(node: ts.Node, nomeCampo: string): string | undefined {
  let atual: ts.Node | undefined = node;
  let profundidade = 0;

  while (atual && profundidade < 4) {
    atual = atual.parent;
    profundidade += 1;
    if (!atual) {
      break;
    }
    if (ts.isCallExpression(atual)) {
      const nome = atual.expression.getText().replace(/\s+/g, "");
      if (/^(Number|parseFloat)$/.test(nome)) {
        return "number";
      }
      if (/^parseInt$/.test(nome)) {
        return "int";
      }
      if (/^(Boolean)$/.test(nome)) {
        return "boolean";
      }
      if (/^(String)$/.test(nome)) {
        return "string";
      }
    }
  }

  return tipoInferidoPorNomeCampo(nomeCampo);
}

function extrairRetornoHttp(
  expr: ts.Expression,
  sourceFile: ts.SourceFile,
  valoresLocais: Map<string, ValorLocalTypeScriptHttp>,
): { campos: CampoInferidoTypeScriptHttp[]; tipoTexto?: string; status?: number } | undefined {
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isTypeAssertionExpression(expr)) {
    return extrairRetornoHttp(expr.expression, sourceFile, valoresLocais);
  }

  if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)) {
    const alvo = expr.expression.expression.getText(sourceFile);
    const metodo = expr.expression.name.text;
    if ((alvo === "NextResponse" || alvo === "Response") && metodo === "json") {
      const primeiro = expr.arguments[0];
      const segundo = expr.arguments[1];
      let campos: CampoInferidoTypeScriptHttp[] = [];
      let tipoTexto = expr.typeArguments?.[0]?.getText(sourceFile);

      if (primeiro && ts.isObjectLiteralExpression(primeiro)) {
        campos = extrairCamposObjetoLiteral(primeiro, sourceFile);
      } else if (primeiro && ts.isIdentifier(primeiro)) {
        const valorLocal = valoresLocais.get(primeiro.text);
        if (valorLocal) {
          campos = valorLocal.campos;
          tipoTexto ??= valorLocal.tipoTexto;
        }
      }

      return {
        campos,
        tipoTexto,
        status: extrairStatusHttp(segundo),
      };
    }
  }

  if (ts.isNewExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === "Response") {
    const tipoTexto = expr.typeArguments?.[0]?.getText(sourceFile);
    return {
      campos: [],
      tipoTexto,
      status: extrairStatusHttp(expr.arguments?.[1]),
    };
  }

  if (ts.isObjectLiteralExpression(expr)) {
    return {
      campos: extrairCamposObjetoLiteral(expr, sourceFile),
    };
  }

  if (ts.isIdentifier(expr)) {
    const valorLocal = valoresLocais.get(expr.text);
    if (valorLocal) {
      return {
        campos: valorLocal.campos,
        tipoTexto: valorLocal.tipoTexto,
      };
    }
  }

  return undefined;
}

export function localizarExportacaoTypeScriptHttp(
  sourceFile: ts.SourceFile,
  nomeExportado: string,
): ExportacaoTypeScriptHttp | undefined {
  for (const node of sourceFile.statements) {
    const localizada = localizarExportacaoEmStatement(node, nomeExportado, sourceFile);
    if (localizada) {
      return localizada;
    }
  }
  return undefined;
}

export function inferirSemanticaHandlerTypeScriptHttp(
  sourceFile: ts.SourceFile,
  nomeExportado: string,
): SemanticaHandlerTypeScriptHttp | undefined {
  const exportacao = localizarExportacaoTypeScriptHttp(sourceFile, nomeExportado);
  if (!exportacao?.corpo) {
    return undefined;
  }

  const requestNames = new Set<string>();
  const urlAliases = new Set<string>();
  const searchParamsAliases = new Set<string>();
  const jsonAliases = new Set<string>();
  const formAliases = new Set<string>();
  const bodyAliases = new Map<string, { tipoTexto?: string; campos: CampoInferidoTypeScriptHttp[] }>();
  const safeParseAliases = new Map<string, CampoInferidoTypeScriptHttp[]>();
  const valoresLocais = new Map<string, ValorLocalTypeScriptHttp>();
  const schemasZod = extrairSchemasZodLocais(sourceFile);

  for (const parametro of exportacao.parametros) {
    if (ts.isIdentifier(parametro.name)) {
      requestNames.add(parametro.name.text);
    }
  }

  const visitarDeclaracoes = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name)) {
        const nome = node.name.text;

        if (ehNewUrl(node.initializer, requestNames)) {
          urlAliases.add(nome);
        }

        if (ehSearchParamsSource(node.initializer, requestNames, urlAliases, searchParamsAliases)) {
          searchParamsAliases.add(nome);
        }

        if (ehCallRequest(node.initializer, requestNames, "json")) {
          jsonAliases.add(nome);
          bodyAliases.set(nome, {
            tipoTexto: node.type?.getText(sourceFile),
            campos: [],
          });
        }

        if (ehCallRequest(node.initializer, requestNames, "formData")) {
          formAliases.add(nome);
        }

        if (
          ts.isCallExpression(node.initializer)
          && ts.isPropertyAccessExpression(node.initializer.expression)
          && ["parse", "safeParse"].includes(node.initializer.expression.name.text)
        ) {
          const schemaNome = obterNomeSchema(node.initializer);
          const arg = node.initializer.arguments[0];
          const schemaCampos = schemaNome ? schemasZod.get(schemaNome) : undefined;
          if (schemaCampos && arg && (ehCallRequest(arg, requestNames, "json") || (ts.isIdentifier(arg) && jsonAliases.has(arg.text)))) {
            if (node.initializer.expression.name.text === "parse") {
              bodyAliases.set(nome, { campos: schemaCampos, tipoTexto: undefined });
            } else {
              safeParseAliases.set(nome, schemaCampos);
            }
          }
        }

        if (
          ts.isPropertyAccessExpression(node.initializer)
          && node.initializer.name.text === "data"
          && ts.isIdentifier(node.initializer.expression)
          && safeParseAliases.has(node.initializer.expression.text)
        ) {
          bodyAliases.set(nome, {
            campos: safeParseAliases.get(node.initializer.expression.text) ?? [],
            tipoTexto: undefined,
          });
        }

        if (ts.isObjectLiteralExpression(node.initializer)) {
          valoresLocais.set(nome, {
            tipoTexto: node.type?.getText(sourceFile),
            campos: extrairCamposObjetoLiteral(node.initializer, sourceFile),
          });
        } else if (ts.isIdentifier(node.initializer) && valoresLocais.has(node.initializer.text)) {
          valoresLocais.set(nome, valoresLocais.get(node.initializer.text)!);
        }
      }

      if (
        ts.isObjectBindingPattern(node.name)
        && ts.isIdentifier(node.initializer)
        && bodyAliases.has(node.initializer.text)
      ) {
        const campos = bodyAliases.get(node.initializer.text)?.campos ?? [];
        for (const elemento of node.name.elements) {
          if (!ts.isIdentifier(elemento.name)) {
            continue;
          }
          const nomeCampo = elemento.propertyName?.getText(sourceFile) ?? elemento.name.text;
          campos.push({
            nome: nomeCampo,
            tipoTexto: tipoInferidoPorNomeCampo(nomeCampo),
            obrigatorio: false,
          });
        }
        bodyAliases.set(node.initializer.text, {
          tipoTexto: bodyAliases.get(node.initializer.text)?.tipoTexto,
          campos: deduplicarCampos(campos),
        });
      }

      if (
        ts.isObjectBindingPattern(node.name)
        && ehNewUrl(node.initializer, requestNames)
      ) {
        for (const elemento of node.name.elements) {
          if (!ts.isIdentifier(elemento.name)) {
            continue;
          }
          const nomeCampo = elemento.propertyName?.getText(sourceFile) ?? elemento.name.text;
          if (nomeCampo === "searchParams") {
            searchParamsAliases.add(elemento.name.text);
          }
        }
      }
    }

    node.forEachChild(visitarDeclaracoes);
  };

  visitarDeclaracoes(exportacao.corpo);

  const query: CampoInferidoTypeScriptHttp[] = [];
  const body: CampoInferidoTypeScriptHttp[] = [];
  const response: CampoInferidoTypeScriptHttp[] = [];
  const statuses: number[] = [];
  let bodyTipoTexto: string | undefined;
  let responseTipoTexto: string | undefined;

  const adicionarBodyCampos = (campos: CampoInferidoTypeScriptHttp[], tipoTexto?: string) => {
    if (campos.length > 0) {
      body.push(...campos);
    }
    bodyTipoTexto ??= tipoTexto;
  };

  const visitarSemantica = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const alvo = node.expression.expression;
      const metodo = node.expression.name.text;

      if (["get", "getAll", "has"].includes(metodo)) {
        const argumento = node.arguments[0];
        if (argumento && ts.isStringLiteralLike(argumento) && ehSearchParamsSource(alvo, requestNames, urlAliases, searchParamsAliases)) {
          query.push({
            nome: argumento.text,
            tipoTexto: inferirTipoPorContexto(node, argumento.text) ?? "string",
            obrigatorio: false,
          });
        }
        if (argumento && ts.isStringLiteralLike(argumento) && ts.isIdentifier(alvo) && formAliases.has(alvo.text)) {
          body.push({
            nome: argumento.text,
            tipoTexto: inferirTipoPorContexto(node, argumento.text) ?? "string",
            obrigatorio: false,
          });
        }
      }

      if (["parse", "safeParse"].includes(metodo)) {
        const schemaNome = obterNomeSchema(node);
        const schemaCampos = schemaNome ? schemasZod.get(schemaNome) : undefined;
        const argumento = node.arguments[0];
        if (schemaCampos && argumento && (ehCallRequest(argumento, requestNames, "json") || (ts.isIdentifier(argumento) && jsonAliases.has(argumento.text)))) {
          adicionarBodyCampos(schemaCampos);
        }
      }
    }

      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && bodyAliases.has(node.expression.text)) {
        const bodyAlias = bodyAliases.get(node.expression.text)!;
        body.push({
          nome: node.name.text,
          tipoTexto: inferirTipoPorContexto(node, node.name.text) ?? "string",
          obrigatorio: false,
        });
        if (bodyAlias.campos.length > 0) {
          body.push(...bodyAlias.campos);
      }
      bodyTipoTexto ??= bodyAlias.tipoTexto;
    }

      if (ts.isReturnStatement(node) && node.expression) {
        const retorno = extrairRetornoHttp(node.expression, sourceFile, valoresLocais);
        if (retorno) {
          if (typeof retorno.status === "number") {
            statuses.push(retorno.status);
          }
          if (retorno.status === undefined || retorno.status < 400) {
            response.push(...retorno.campos);
            responseTipoTexto ??= retorno.tipoTexto;
          }
        }
      }

    node.forEachChild(visitarSemantica);
  };

  visitarSemantica(exportacao.corpo);

  for (const bodyAlias of bodyAliases.values()) {
    adicionarBodyCampos(bodyAlias.campos, bodyAlias.tipoTexto);
  }

  const statusesDeduplicados = deduplicarNumeros(statuses);
  return {
    query: deduplicarCampos(query),
    body: deduplicarCampos(body),
    bodyTipoTexto,
    response: deduplicarCampos(response),
    responseTipoTexto,
    statuses: statusesDeduplicados,
    errorStatuses: statusesDeduplicados.filter((status) => status >= 400),
  };
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
