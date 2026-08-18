// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: inferencias de body e schemas Zod em TypeScript; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import ts from "typescript";
import {
  deduplicarCampos,
  desembrulharExpressao,
  type CampoInferidoTypeScriptHttp,
  type ValorLocalTypeScriptHttp,
} from "./typescript-http-modelos.js";
import {
  ehCallRequest,
  extrairCamposTypeNode,
  extrairMetadadosTipoExplicito,
  inferirTipoBasicoDeExpressao,
  obterNomeSchema,
  tipoInferidoPorNomeCampo,
} from "./typescript-http-expressoes.js";

export function resolverMetadadosOrigemBody(
  expr: ts.Expression,
  sourceFile: ts.SourceFile,
  requestNames: Set<string>,
  bodyAliases: Map<string, { tipoTexto?: string; campos: CampoInferidoTypeScriptHttp[] }>,
  jsonAliases: Set<string>,
  safeParseAliases: Map<string, CampoInferidoTypeScriptHttp[]>,
  schemasZod: Map<string, CampoInferidoTypeScriptHttp[]>,
  typeNodeDeclarado?: ts.TypeNode,
): { tipoTexto?: string; campos: CampoInferidoTypeScriptHttp[] } | undefined {
  const normalizado = desembrulharExpressao(expr);

  if (ts.isIdentifier(normalizado) && bodyAliases.has(normalizado.text)) {
    return bodyAliases.get(normalizado.text);
  }

  if (
    ts.isPropertyAccessExpression(normalizado)
    && normalizado.name.text === "body"
    && ts.isIdentifier(normalizado.expression)
    && requestNames.has(normalizado.expression.text)
  ) {
    return {
      tipoTexto: typeNodeDeclarado?.getText(sourceFile),
      campos: [],
    };
  }

  if (ehCallRequest(expr, requestNames, "json")) {
    return extrairMetadadosTipoExplicito(expr, sourceFile, typeNodeDeclarado);
  }

  if (
    ts.isCallExpression(normalizado)
    && ts.isPropertyAccessExpression(normalizado.expression)
    && ["parse", "safeParse"].includes(normalizado.expression.name.text)
  ) {
    const schemaNome = obterNomeSchema(normalizado);
    const schemaCampos = schemaNome ? schemasZod.get(schemaNome) : undefined;
    const argumento = normalizado.arguments[0];
    const argumentoNormalizado = argumento ? desembrulharExpressao(argumento) : undefined;
    if (
      schemaCampos
      && argumento
      && (
        ehCallRequest(argumento, requestNames, "json")
        || (argumentoNormalizado && ts.isIdentifier(argumentoNormalizado) && jsonAliases.has(argumentoNormalizado.text))
      )
    ) {
      return {
        tipoTexto: undefined,
        campos: schemaCampos,
      };
    }
  }

  if (
    ts.isPropertyAccessExpression(normalizado)
    && normalizado.name.text === "data"
    && ts.isIdentifier(normalizado.expression)
    && safeParseAliases.has(normalizado.expression.text)
  ) {
    return {
      tipoTexto: undefined,
      campos: safeParseAliases.get(normalizado.expression.text) ?? [],
    };
  }

  return undefined;
}

export function extrairCamposBindingPattern(
  pattern: ts.ObjectBindingPattern,
  sourceFile: ts.SourceFile,
  camposConhecidos: CampoInferidoTypeScriptHttp[],
): CampoInferidoTypeScriptHttp[] {
  const conhecidos = new Map(camposConhecidos.map((campo) => [campo.nome, campo]));
  const campos: CampoInferidoTypeScriptHttp[] = [];

  for (const elemento of pattern.elements) {
    if (!ts.isIdentifier(elemento.name)) {
      continue;
    }

    const nomeCampo = elemento.propertyName?.getText(sourceFile) ?? elemento.name.text;
    const conhecido = conhecidos.get(nomeCampo);
    campos.push({
      nome: nomeCampo,
      tipoTexto: conhecido?.tipoTexto ?? inferirTipoBasicoDeExpressao(elemento.initializer, nomeCampo) ?? tipoInferidoPorNomeCampo(nomeCampo),
      obrigatorio: conhecido?.obrigatorio ?? false,
    });
  }

  return deduplicarCampos(campos);
}

export function extrairCampoZod(expr: ts.Expression, nome: string): CampoInferidoTypeScriptHttp {
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

export function extrairSchemasZodLocais(sourceFile: ts.SourceFile): Map<string, CampoInferidoTypeScriptHttp[]> {
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
