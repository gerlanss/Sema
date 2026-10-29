// SEMA-GOVERNED: sema.produto.parser_integridade
// Descrição: entrada do parser governado por contratos/sema/parser_integridade.sema.

import type { Token } from "../lexer/tokens.js";
import { ResultadoParser } from "./parser.part01.js";
import { Parser } from "./parser.part02.js";
export { normalizarOrigemUse } from "./parser.declaracoes.js";

export function parsear(tokens: Token[]): ResultadoParser {
  const parser = new Parser(tokens);
  return parser.analisar();
}
