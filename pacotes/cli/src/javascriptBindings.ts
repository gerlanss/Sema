// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descrição: reconhece declarações em IIFEs e exports CommonJS/browser sem executar código nem exigir ES modules.
import ts from "typescript";

export function simbolosJavaScriptLocais(source: ts.SourceFile): string[] {
  const nomes = new Set<string>();
  const unwrap = (node: ts.Expression): ts.Expression => ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
  function bloco(statements: readonly ts.Statement[], prefixo = "") {
    const objetos = new Map<string, ts.ObjectLiteralExpression>();
    const funcoes = new Set<string>();
    for (const s of statements) {
      if (ts.isFunctionDeclaration(s) && s.name) funcoes.add(s.name.text);
      if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue;
        const value = unwrap(d.initializer);
        if (ts.isObjectLiteralExpression(value)) objetos.set(d.name.text, value);
        if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) funcoes.add(d.name.text);
      }
    }
    for (const f of funcoes) nomes.add(prefixo + f);
    function publicacao(expr: ts.Expression) {
      expr = unwrap(expr);
      if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const left = expr.left.getText(source);
        const publico = /^(?:(?:window|globalThis)\.([\w$]+)|module\.exports|exports)(?:\.([\w$]+))?$/.exec(left);
        if (publico) {
          const value = unwrap(expr.right);
          const nome = [publico[1], publico[2]].filter(Boolean).join(".");
          if (nome && (ts.isFunctionExpression(value) || ts.isArrowFunction(value) || (ts.isIdentifier(value) && funcoes.has(value.text)))) nomes.add(nome);
          const obj = ts.isObjectLiteralExpression(value) ? value : ts.isIdentifier(value) ? objetos.get(value.text) : undefined;
          for (const prop of obj?.properties ?? []) {
            if (!prop.name || !(ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) continue;
            const key = prop.name.text;
            const callable = ts.isMethodDeclaration(prop)
              || (ts.isShorthandPropertyAssignment(prop) && funcoes.has(key))
              || (ts.isPropertyAssignment(prop) && (ts.isArrowFunction(unwrap(prop.initializer)) || ts.isFunctionExpression(unwrap(prop.initializer))
                || (ts.isIdentifier(prop.initializer) && funcoes.has(prop.initializer.text))));
            if (callable) nomes.add([nome, key].filter(Boolean).join("."));
          }
        }
      }
      if (ts.isCallExpression(expr)) {
        const fn = unwrap(expr.expression);
        if ((ts.isFunctionExpression(fn) || ts.isArrowFunction(fn)) && ts.isBlock(fn.body)) bloco(fn.body.statements);
      }
    }
    function visitar(s: ts.Statement): void {
      if (ts.isExpressionStatement(s)) publicacao(s.expression);
      // Exports condicionais comuns (typeof module) continuam sendo referências, não prova de execução.
      if (ts.isIfStatement(s)) { visitar(s.thenStatement); if (s.elseStatement) visitar(s.elseStatement); }
      if (ts.isBlock(s)) for (const child of s.statements) visitar(child);
    }
    for (const s of statements) visitar(s);
  }
  bloco(source.statements);
  return [...nomes];
}
