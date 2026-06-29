// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: modelos e utilitarios base de HTTP TypeScript; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

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

export interface ValorLocalTypeScriptHttp {
  tipoTexto?: string;
  campos: CampoInferidoTypeScriptHttp[];
  status?: number;
}

export const METODOS_HTTP = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

export function normalizarSeparadores(relacao: string): string {
  return relacao.replace(/\\/g, "/");
}

export function deduplicarRotas(rotas: RotaTypeScriptExtraida[]): RotaTypeScriptExtraida[] {
  const mapa = new Map<string, RotaTypeScriptExtraida>();
  for (const rota of rotas) {
    const chave = `${rota.origem}:${rota.metodo}:${rota.caminho}:${rota.simbolo}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, rota);
    }
  }
  return [...mapa.values()];
}

export function deduplicarCampos(campos: CampoInferidoTypeScriptHttp[]): CampoInferidoTypeScriptHttp[] {
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

export function deduplicarNumeros(valores: number[]): number[] {
  return [...new Set(valores)].sort((a, b) => a - b);
}

export function desembrulharExpressao(expr: ts.Expression): ts.Expression {
  let atual = expr;

  while (true) {
    if (ts.isParenthesizedExpression(atual) || ts.isAsExpression(atual) || ts.isSatisfiesExpression(atual) || ts.isTypeAssertionExpression(atual)) {
      atual = atual.expression;
      continue;
    }
    if (ts.isAwaitExpression(atual)) {
      atual = atual.expression;
      continue;
    }
    return atual;
  }
}

export function extrairNomeExportado(statement: ts.Statement, sourceFile: ts.SourceFile): string[] {
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
    if (ts.isArrowFunction(declaracao.initializer) || ts.isFunctionExpression(declaracao.initializer) || ts.isCallExpression(declaracao.initializer) || ts.isIdentifier(declaracao.initializer)) {
      nomes.push(declaracao.name.getText(sourceFile));
    }
  }
  return nomes;
}

export function extrairMetodosHttpNext(sourceFile: ts.SourceFile): string[] {
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
