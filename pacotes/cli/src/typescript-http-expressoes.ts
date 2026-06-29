// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: inferencias de campos e expressoes TypeScript; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import ts from "typescript";
import {
  deduplicarCampos,
  desembrulharExpressao,
  type CampoInferidoTypeScriptHttp,
  type ValorLocalTypeScriptHttp,
} from "./typescript-http-modelos.js";

export function tipoInferidoPorNomeCampo(nome: string): string | undefined {
  return /(^|_)?id$/i.test(nome) || /Id$/.test(nome)
    ? "Id"
    : undefined;
}

export function normalizarTypeNode(typeNode: ts.TypeNode | undefined): ts.TypeNode | undefined {
  if (!typeNode) {
    return undefined;
  }
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return normalizarTypeNode(typeNode.type);
  }
  if (ts.isUnionTypeNode(typeNode)) {
    const uteis = typeNode.types
      .filter((item) => item.kind !== ts.SyntaxKind.NullKeyword && item.kind !== ts.SyntaxKind.UndefinedKeyword)
      .map((item) => normalizarTypeNode(item))
      .filter((item): item is ts.TypeNode => Boolean(item));
    if (uteis.length === 1) {
      return uteis[0];
    }
  }
  return typeNode;
}

export function extrairCamposTypeNode(typeNode: ts.TypeNode | undefined, sourceFile: ts.SourceFile): CampoInferidoTypeScriptHttp[] {
  const normalizado = normalizarTypeNode(typeNode);
  if (!normalizado || !ts.isTypeLiteralNode(normalizado)) {
    return [];
  }

  const campos: CampoInferidoTypeScriptHttp[] = [];
  for (const membro of normalizado.members) {
    if (!ts.isPropertySignature(membro) || !membro.name) {
      continue;
    }

    let nome: string | undefined;
    if (ts.isIdentifier(membro.name) || ts.isStringLiteralLike(membro.name) || ts.isNumericLiteral(membro.name)) {
      nome = membro.name.text;
    }

    if (!nome) {
      continue;
    }

    campos.push({
      nome,
      tipoTexto: membro.type?.getText(sourceFile) ?? tipoInferidoPorNomeCampo(nome),
      obrigatorio: !membro.questionToken,
    });
  }

  return deduplicarCampos(campos);
}

export function extrairMetadadosTipoExplicito(
  expr: ts.Expression,
  sourceFile: ts.SourceFile,
  typeNodeDeclarado?: ts.TypeNode,
): { tipoTexto?: string; campos: CampoInferidoTypeScriptHttp[] } {
  const typeNode =
    normalizarTypeNode(typeNodeDeclarado)
    ?? (() => {
      let atual: ts.Expression = expr;
      while (true) {
        if (ts.isParenthesizedExpression(atual)) {
          atual = atual.expression;
          continue;
        }
        if (ts.isAsExpression(atual) || ts.isSatisfiesExpression(atual) || ts.isTypeAssertionExpression(atual)) {
          return normalizarTypeNode(atual.type);
        }
        if (ts.isAwaitExpression(atual)) {
          atual = atual.expression;
          continue;
        }
        return undefined;
      }
    })();

  return {
    tipoTexto: typeNode?.getText(sourceFile),
    campos: extrairCamposTypeNode(typeNode, sourceFile),
  };
}

export function inferirTipoBasicoDeExpressao(expr: ts.Expression | undefined, nomeCampo?: string): string | undefined {
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

export function extrairCamposObjetoLiteral(objeto: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile): CampoInferidoTypeScriptHttp[] {
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

export function extrairStatusHttp(expr?: ts.Expression): number | undefined {
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

export function ehRequestUrl(expr: ts.Expression, requestNames: Set<string>): boolean {
  return ts.isPropertyAccessExpression(expr)
    && expr.name.text === "url"
    && ts.isIdentifier(expr.expression)
    && requestNames.has(expr.expression.text);
}

export function ehNewUrl(expr: ts.Expression, requestNames: Set<string>): boolean {
  return ts.isNewExpression(expr)
    && ts.isIdentifier(expr.expression)
    && expr.expression.text === "URL"
    && Boolean(expr.arguments?.some((argumento) => ehRequestUrl(argumento, requestNames)));
}

export function ehSearchParamsSource(expr: ts.Expression, requestNames: Set<string>, urlAliases: Set<string>, searchParamsAliases: Set<string>): boolean {
  const normalizado = desembrulharExpressao(expr);

  if (ts.isIdentifier(normalizado)) {
    return searchParamsAliases.has(normalizado.text);
  }

  if (ts.isPropertyAccessExpression(normalizado) && normalizado.name.text === "searchParams") {
    const alvo = normalizado.expression;
    if (ts.isPropertyAccessExpression(alvo) && alvo.name.text === "nextUrl" && ts.isIdentifier(alvo.expression) && requestNames.has(alvo.expression.text)) {
      return true;
    }
    if (ts.isIdentifier(alvo) && urlAliases.has(alvo.text)) {
      return true;
    }
  }

  return false;
}

export function ehCallRequest(expr: ts.Expression, requestNames: Set<string>, metodo: "json" | "formData"): boolean {
  const alvo = desembrulharExpressao(expr);
  return ts.isCallExpression(alvo)
    && ts.isPropertyAccessExpression(alvo.expression)
    && alvo.expression.name.text === metodo
    && ts.isIdentifier(alvo.expression.expression)
    && requestNames.has(alvo.expression.expression.text);
}

export function obterNomeSchema(call: ts.CallExpression): string | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) {
    return undefined;
  }
  const alvo = call.expression.expression;
  if (!ts.isIdentifier(alvo)) {
    return undefined;
  }
  return alvo.text;
}
