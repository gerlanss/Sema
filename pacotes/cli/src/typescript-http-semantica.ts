// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: semantica de handlers HTTP TypeScript; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import ts from "typescript";
import {
  deduplicarCampos,
  deduplicarNumeros,
  desembrulharExpressao,
  extrairNomeExportado,
  type CampoInferidoTypeScriptHttp,
  type ExportacaoTypeScriptHttp,
  type SemanticaHandlerTypeScriptHttp,
  type ValorLocalTypeScriptHttp,
} from "./typescript-http-modelos.js";
import {
  ehCallRequest,
  ehNewUrl,
  ehRequestUrl,
  ehSearchParamsSource,
  extrairCamposObjetoLiteral,
  extrairMetadadosTipoExplicito,
  extrairStatusHttp,
  inferirTipoBasicoDeExpressao,
  obterNomeSchema,
  tipoInferidoPorNomeCampo,
} from "./typescript-http-expressoes.js";
import {
  extrairCamposBindingPattern,
  extrairSchemasZodLocais,
  resolverMetadadosOrigemBody,
} from "./typescript-http-body.js";

export function localizarExportacaoEmStatement(
  statement: ts.Statement,
  nomeExportado: string,
  sourceFile: ts.SourceFile,
  permitirNaoExportada = false,
): ExportacaoTypeScriptHttp | undefined {
  const declarada = (statement: ts.FunctionDeclaration | ts.VariableStatement): boolean =>
    permitirNaoExportada
      || statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
  if (ts.isFunctionDeclaration(statement) && statement.name?.text === nomeExportado && declarada(statement)) {
    return {
      corpo: statement.body,
      retorno: statement.type?.getText(sourceFile),
      parametros: statement.parameters,
      declaracao: statement,
    };
  }

  if (!ts.isVariableStatement(statement) || !declarada(statement)) {
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

export function inferirTipoPorContexto(node: ts.Node, nomeCampo: string): string | undefined {
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

export function extrairRetornoHttp(
  expr: ts.Expression,
  sourceFile: ts.SourceFile,
  valoresLocais: Map<string, ValorLocalTypeScriptHttp>,
): { campos: CampoInferidoTypeScriptHttp[]; tipoTexto?: string; status?: number } | undefined {
  const normalizado = desembrulharExpressao(expr);

  if (ts.isCallExpression(normalizado) && ts.isPropertyAccessExpression(normalizado.expression)) {
    const alvo = normalizado.expression.expression.getText(sourceFile);
    const metodo = normalizado.expression.name.text;
    if ((alvo === "NextResponse" || alvo === "Response") && metodo === "json") {
      const primeiro = normalizado.arguments[0];
      const segundo = normalizado.arguments[1];
      let campos: CampoInferidoTypeScriptHttp[] = [];
      let tipoTexto = normalizado.typeArguments?.[0]?.getText(sourceFile);

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

  if (ts.isNewExpression(normalizado) && ts.isIdentifier(normalizado.expression) && normalizado.expression.text === "Response") {
    const tipoTexto = normalizado.typeArguments?.[0]?.getText(sourceFile);
    return {
      campos: [],
      tipoTexto,
      status: extrairStatusHttp(normalizado.arguments?.[1]),
    };
  }

  if (ts.isObjectLiteralExpression(normalizado)) {
    return {
      campos: extrairCamposObjetoLiteral(normalizado, sourceFile),
    };
  }

  if (ts.isIdentifier(normalizado)) {
    const valorLocal = valoresLocais.get(normalizado.text);
    if (valorLocal) {
      return {
        campos: valorLocal.campos,
        tipoTexto: valorLocal.tipoTexto,
        status: valorLocal.status,
      };
    }
  }

  return undefined;
}

export function localizarExportacaoTypeScriptHttp(
  sourceFile: ts.SourceFile,
  nomeExportado: string,
  permitirNaoExportada = false,
): ExportacaoTypeScriptHttp | undefined {
  for (const node of sourceFile.statements) {
    const localizada = localizarExportacaoEmStatement(node, nomeExportado, sourceFile, permitirNaoExportada);
    if (localizada) {
      return localizada;
    }
  }
  return undefined;
}

export function inferirSemanticaHandlerTypeScriptHttp(
  sourceFile: ts.SourceFile,
  nomeExportado: string,
  permitirNaoExportada = false,
): SemanticaHandlerTypeScriptHttp | undefined {
  const exportacao = localizarExportacaoTypeScriptHttp(sourceFile, nomeExportado, permitirNaoExportada);
  if (!exportacao?.corpo) {
    return undefined;
  }

  const requestNames = new Set<string>();
  const urlAliases = new Set<string>();
  const searchParamsAliases = new Set<string>();
  const jsonAliases = new Set<string>();
  const formAliases = new Set<string>();
  const bodyAliases = new Map<string, { tipoTexto?: string; campos: CampoInferidoTypeScriptHttp[] }>();
  const bodyDeclaracoesDiretas: CampoInferidoTypeScriptHttp[] = [];
  const safeParseAliases = new Map<string, CampoInferidoTypeScriptHttp[]>();
  const valoresLocais = new Map<string, ValorLocalTypeScriptHttp>();
  const schemasZod = extrairSchemasZodLocais(sourceFile);

  for (const parametro of exportacao.parametros) {
    if (ts.isIdentifier(parametro.name)) {
      requestNames.add(parametro.name.text);
    }
  }
  const responseNames = new Set<string>();
  for (const [indice, parametro] of exportacao.parametros.entries()) {
    if (indice > 0 && ts.isIdentifier(parametro.name)) {
      responseNames.add(parametro.name.text);
    }
  }

  const visitarDeclaracoes = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const inicializadorNormalizado = desembrulharExpressao(node.initializer);

      if (ts.isIdentifier(node.name)) {
        const nome = node.name.text;

        if (ehNewUrl(node.initializer, requestNames)) {
          urlAliases.add(nome);
        }

        if (ehSearchParamsSource(node.initializer, requestNames, urlAliases, searchParamsAliases)) {
          searchParamsAliases.add(nome);
        }

        if (ehCallRequest(node.initializer, requestNames, "json")) {
          const metadadosBody = extrairMetadadosTipoExplicito(node.initializer, sourceFile, node.type);
          jsonAliases.add(nome);
          bodyAliases.set(nome, {
            tipoTexto: metadadosBody.tipoTexto,
            campos: metadadosBody.campos,
          });
        }

        if (ehCallRequest(node.initializer, requestNames, "formData")) {
          formAliases.add(nome);
        }

        if (
          ts.isCallExpression(inicializadorNormalizado)
          && ts.isPropertyAccessExpression(inicializadorNormalizado.expression)
          && ["parse", "safeParse"].includes(inicializadorNormalizado.expression.name.text)
        ) {
          const chamada = inicializadorNormalizado;
          const acessoChamada = chamada.expression as ts.PropertyAccessExpression;
          const schemaNome = obterNomeSchema(chamada);
          const arg = chamada.arguments[0];
          const schemaCampos = schemaNome ? schemasZod.get(schemaNome) : undefined;
          const argNormalizado = arg ? desembrulharExpressao(arg) : undefined;
          if (schemaCampos && arg && (ehCallRequest(arg, requestNames, "json") || (argNormalizado && ts.isIdentifier(argNormalizado) && jsonAliases.has(argNormalizado.text)))) {
            if (acessoChamada.name.text === "parse") {
              bodyAliases.set(nome, { campos: schemaCampos, tipoTexto: undefined });
            } else {
              safeParseAliases.set(nome, schemaCampos);
            }
          }
        }

        if (
          ts.isPropertyAccessExpression(inicializadorNormalizado)
          && inicializadorNormalizado.name.text === "data"
          && ts.isIdentifier(inicializadorNormalizado.expression)
          && safeParseAliases.has(inicializadorNormalizado.expression.text)
        ) {
          const acesso = inicializadorNormalizado;
          const alvoAcesso = acesso.expression as ts.Identifier;
          bodyAliases.set(nome, {
            campos: safeParseAliases.get(alvoAcesso.text) ?? [],
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
        } else {
          const retornoHttp = extrairRetornoHttp(node.initializer, sourceFile, valoresLocais);
          if (retornoHttp) {
            valoresLocais.set(nome, {
              tipoTexto: retornoHttp.tipoTexto,
              campos: retornoHttp.campos,
              status: retornoHttp.status,
            });
          }
        }
      }

      if (ts.isObjectBindingPattern(node.name)) {
        const metadadosBody = resolverMetadadosOrigemBody(
          node.initializer,
          sourceFile,
          requestNames,
          bodyAliases,
          jsonAliases,
          safeParseAliases,
          schemasZod,
          node.type,
        );

        if (metadadosBody) {
          const camposBinding = extrairCamposBindingPattern(node.name, sourceFile, metadadosBody.campos);
          bodyDeclaracoesDiretas.push(...camposBinding);

          const inicializadorNormalizado = desembrulharExpressao(node.initializer);
          if (ts.isIdentifier(inicializadorNormalizado) && bodyAliases.has(inicializadorNormalizado.text)) {
            bodyAliases.set(inicializadorNormalizado.text, {
              tipoTexto: bodyAliases.get(inicializadorNormalizado.text)?.tipoTexto ?? metadadosBody.tipoTexto,
              campos: deduplicarCampos([
                ...(bodyAliases.get(inicializadorNormalizado.text)?.campos ?? []),
                ...camposBinding,
              ]),
            });
          }
        }
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
    if (ts.isPropertyAccessExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && requestNames.has(node.expression.expression.text)) {
      const origemAcesso = node.expression.name.text;
      const nomeCampo = node.name.text;
      const ehQuery = origemAcesso === "query" || origemAcesso === "params"
        || (origemAcesso === "request" && (nomeCampo === "query" || nomeCampo === "searchParams"));
      const ehBody = origemAcesso === "body" || (origemAcesso === "request" && nomeCampo === "body");
      if (ehQuery && origemAcesso !== "params") {
        query.push({
          nome: nomeCampo,
          tipoTexto: inferirTipoPorContexto(node, nomeCampo) ?? "string",
          obrigatorio: false,
        });
      } else if (ehBody) {
        body.push({
          nome: nomeCampo,
          tipoTexto: inferirTipoPorContexto(node, nomeCampo) ?? "string",
          obrigatorio: false,
        });
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "json") {
      let alvo = node.expression.expression;
      let status: number | undefined;
      if (ts.isCallExpression(alvo)
        && ts.isPropertyAccessExpression(alvo.expression)
        && alvo.expression.name.text === "status"
        && alvo.arguments[0]
        && ts.isNumericLiteral(alvo.arguments[0])) {
        status = Number(alvo.arguments[0].text);
        alvo = alvo.expression.expression;
      }
      if (ts.isIdentifier(alvo) && responseNames.has(alvo.text)) {
        const argumento = node.arguments[0];
        const campos = argumento && ts.isObjectLiteralExpression(argumento)
          ? extrairCamposObjetoLiteral(argumento, sourceFile)
          : argumento && ts.isIdentifier(argumento) && valoresLocais.has(argumento.text)
            ? valoresLocais.get(argumento.text)!.campos
            : [];
        if (typeof status === "number") {
          statuses.push(status);
        }
        if (status === undefined || status < 400) {
          response.push(...campos);
        }
      }
    }

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
        if (!bodyAlias.campos.some((campo) => campo.nome === node.name.text)) {
          body.push({
            nome: node.name.text,
            tipoTexto: inferirTipoPorContexto(node, node.name.text) ?? "string",
            obrigatorio: false,
          });
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

  adicionarBodyCampos(bodyDeclaracoesDiretas);
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
