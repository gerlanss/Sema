import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export interface SuperficieAngularStandaloneConsumer {
  rota: string;
  arquivo: string;
  tipoArquivo: "app" | "component";
}

interface ComponenteAngularStandaloneIndexado {
  arquivo: string;
  selector?: string;
  imports: string[];
  template: string;
  raiz: boolean;
}

function normalizarCaminhoConsumer(caminhoArquivo: string): string {
  return caminhoArquivo.replace(/\\/g, "/");
}

function arquivoEhComponenteAngularStandalone(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\.component\.(?:ts|js)$/i.test(relacao)
    || /(?:^|\/)(?:src\/)?app\/.+\.component\.(?:ts|js)$/i.test(relacao)
    || /(?:^|\/)(?:src\/)?components\/.+\.component\.(?:ts|js)$/i.test(relacao);
}

function arquivoEhRaizAngularStandalone(relacaoArquivo: string): boolean {
  const relacao = normalizarCaminhoConsumer(relacaoArquivo);
  return /(?:^|\/)(?:src\/)?app\.component\.(?:ts|js)$/i.test(relacao)
    || /(?:^|\/)(?:src\/)?app\/app\.component\.(?:ts|js)$/i.test(relacao);
}

function resolverImportRelativoAngular(relacaoArquivoBase: string, especificador: string): string | undefined {
  if (!especificador.startsWith(".")) {
    return undefined;
  }
  const baseDir = path.posix.dirname(normalizarCaminhoConsumer(relacaoArquivoBase));
  for (const sufixo of ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"]) {
    const candidato = path.posix.normalize(path.posix.join(baseDir, `${especificador}${sufixo}`));
    if (/\.(?:ts|tsx|js|jsx)$/i.test(candidato)) {
      return candidato;
    }
  }
  return undefined;
}

function resolverTemplateRelativoAngular(relacaoArquivoBase: string, especificador: string): string | undefined {
  if (!especificador.startsWith(".")) {
    return undefined;
  }
  const baseDir = path.posix.dirname(normalizarCaminhoConsumer(relacaoArquivoBase));
  const candidato = path.posix.normalize(path.posix.join(baseDir, especificador));
  return /\.(?:html)$/i.test(candidato) ? candidato : undefined;
}

function extrairImportsTypeScriptAngular(relacaoArquivo: string, codigo: string): Map<string, string> {
  const imports = new Map<string, string>();
  for (const match of codigo.matchAll(/import\s*\{\s*([^}]+)\s*\}\s*from\s*["']([^"']+)["']/g)) {
    const arquivoImportado = resolverImportRelativoAngular(relacaoArquivo, match[2]);
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
    const arquivoImportado = resolverImportRelativoAngular(relacaoArquivo, match[2]);
    const local = match[1]?.trim();
    if (arquivoImportado && local) {
      imports.set(local, arquivoImportado);
    }
  }
  return imports;
}

function nomePropriedadeObjeto(elemento: ts.ObjectLiteralElementLike): string | undefined {
  if (!ts.isPropertyAssignment(elemento) && !ts.isShorthandPropertyAssignment(elemento)) {
    return undefined;
  }
  const nome = elemento.name;
  if (ts.isIdentifier(nome) || ts.isStringLiteral(nome)) {
    return nome.text;
  }
  return undefined;
}

function obterDecorators(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
}

function obterObjetoDecoratorComponent(node: ts.ClassDeclaration): ts.ObjectLiteralExpression | undefined {
  for (const decorator of obterDecorators(node)) {
    const expr = decorator.expression;
    if (!ts.isCallExpression(expr) || !ts.isIdentifier(expr.expression) || expr.expression.text !== "Component") {
      continue;
    }
    const arg = expr.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) {
      return arg;
    }
  }
  return undefined;
}

function obterExpressaoPropriedade(objeto: ts.ObjectLiteralExpression, nome: string): ts.Expression | undefined {
  for (const propriedade of objeto.properties) {
    if (nomePropriedadeObjeto(propriedade) !== nome) {
      continue;
    }
    if (ts.isPropertyAssignment(propriedade)) {
      return propriedade.initializer;
    }
    if (ts.isShorthandPropertyAssignment(propriedade)) {
      return propriedade.name;
    }
  }
  return undefined;
}

function extrairTextoLiteral(expressao?: ts.Expression): string | undefined {
  if (!expressao) {
    return undefined;
  }
  if (ts.isStringLiteral(expressao) || ts.isNoSubstitutionTemplateLiteral(expressao)) {
    return expressao.text;
  }
  if (ts.isTemplateExpression(expressao)) {
    return expressao.getText().slice(1, -1);
  }
  return undefined;
}

function extrairIdentificadorImportado(expressao: ts.Expression): string | undefined {
  if (ts.isIdentifier(expressao)) {
    return expressao.text;
  }
  if (ts.isCallExpression(expressao)
    && ts.isIdentifier(expressao.expression)
    && expressao.expression.text === "forwardRef") {
    const callback = expressao.arguments[0];
    if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
      if (ts.isIdentifier(callback.body)) {
        return callback.body.text;
      }
      if (ts.isBlock(callback.body)) {
        for (const statement of callback.body.statements) {
          if (ts.isReturnStatement(statement) && statement.expression && ts.isIdentifier(statement.expression)) {
            return statement.expression.text;
          }
        }
      }
    }
  }
  return undefined;
}

async function extrairTemplateAngularStandalone(
  baseProjeto: string,
  relacaoArquivo: string,
  metadata: ts.ObjectLiteralExpression,
): Promise<string> {
  const templateInline = extrairTextoLiteral(obterExpressaoPropriedade(metadata, "template"));
  if (templateInline) {
    return templateInline;
  }
  const templateUrl = extrairTextoLiteral(obterExpressaoPropriedade(metadata, "templateUrl"));
  if (!templateUrl) {
    return "";
  }
  const templateRelativo = resolverTemplateRelativoAngular(relacaoArquivo, templateUrl);
  if (!templateRelativo) {
    return "";
  }
  try {
    return await readFile(path.join(baseProjeto, templateRelativo), "utf8");
  } catch {
    return "";
  }
}

async function indexarComponenteAngularStandalone(
  baseProjeto: string,
  arquivo: string,
): Promise<ComponenteAngularStandaloneIndexado | undefined> {
  const relacaoArquivo = normalizarCaminhoConsumer(path.relative(baseProjeto, arquivo));
  if (!arquivoEhComponenteAngularStandalone(relacaoArquivo)) {
    return undefined;
  }
  const codigo = await readFile(arquivo, "utf8");
  const sourceFile = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports = extrairImportsTypeScriptAngular(relacaoArquivo, codigo);

  for (const statement of sourceFile.statements) {
    if (!ts.isClassDeclaration(statement)) {
      continue;
    }
    const metadata = obterObjetoDecoratorComponent(statement);
    if (!metadata) {
      continue;
    }
    const standalone = obterExpressaoPropriedade(metadata, "standalone");
    if (!standalone || standalone.kind !== ts.SyntaxKind.TrueKeyword) {
      continue;
    }
    const importsExpr = obterExpressaoPropriedade(metadata, "imports");
    const importsArquivos = new Set<string>();
    if (importsExpr && ts.isArrayLiteralExpression(importsExpr)) {
      for (const elemento of importsExpr.elements) {
        const nomeImportado = extrairIdentificadorImportado(elemento);
        if (!nomeImportado) {
          continue;
        }
        const arquivoImportado = imports.get(nomeImportado);
        if (arquivoImportado) {
          importsArquivos.add(arquivoImportado);
        }
      }
    }

    return {
      arquivo: relacaoArquivo,
      selector: extrairTextoLiteral(obterExpressaoPropriedade(metadata, "selector")),
      imports: [...importsArquivos],
      template: await extrairTemplateAngularStandalone(baseProjeto, relacaoArquivo, metadata),
      raiz: arquivoEhRaizAngularStandalone(relacaoArquivo),
    };
  }

  return undefined;
}

function templateReferenciaSelector(template: string, selector: string): boolean {
  if (!template || !selector) {
    return false;
  }
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<${escapado}(?:\\s|>)`, "i").test(template);
}

export async function coletarSuperficiesAngularStandaloneConsumer(
  baseProjeto: string,
  arquivos: string[],
): Promise<SuperficieAngularStandaloneConsumer[]> {
  const componentes = new Map<string, ComponenteAngularStandaloneIndexado>();
  for (const arquivo of arquivos) {
    const componente = await indexarComponenteAngularStandalone(baseProjeto, arquivo);
    if (componente) {
      componentes.set(componente.arquivo, componente);
    }
  }

  const raizes = [...componentes.values()].filter((componente) => componente.raiz);
  if (raizes.length === 0) {
    return [];
  }

  const seletores = new Map<string, string[]>();
  for (const componente of componentes.values()) {
    if (!componente.selector) {
      continue;
    }
    const existentes = seletores.get(componente.selector) ?? [];
    existentes.push(componente.arquivo);
    seletores.set(componente.selector, existentes);
  }

  const visitados = new Set<string>();
  const fila = [...raizes];
  while (fila.length > 0) {
    const atual = fila.shift();
    if (!atual || visitados.has(atual.arquivo)) {
      continue;
    }
    visitados.add(atual.arquivo);

    for (const arquivoImportado of atual.imports) {
      const componenteImportado = componentes.get(arquivoImportado);
      if (componenteImportado && !visitados.has(componenteImportado.arquivo)) {
        fila.push(componenteImportado);
      }
    }

    for (const [selector, arquivosSelector] of seletores.entries()) {
      if (!templateReferenciaSelector(atual.template, selector)) {
        continue;
      }
      for (const arquivoSelector of arquivosSelector) {
        const componenteSelector = componentes.get(arquivoSelector);
        if (componenteSelector && !visitados.has(componenteSelector.arquivo)) {
          fila.push(componenteSelector);
        }
      }
    }
  }

  return [...visitados]
    .map<SuperficieAngularStandaloneConsumer>((arquivo) => ({
      rota: "/",
      arquivo,
      tipoArquivo: raizes.some((raiz) => raiz.arquivo === arquivo) ? "app" : "component",
    }))
    .sort((a, b) =>
      a.tipoArquivo.localeCompare(b.tipoArquivo, "pt-BR")
      || a.arquivo.localeCompare(b.arquivo, "pt-BR"));
}
