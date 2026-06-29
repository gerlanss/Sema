// SEMA-GOVERNED: sema.software
// Descricao: parser particionado; consulte contratos/sema/software.sema antes de editar.

import type { Token } from "../lexer/tokens.js";
import { ResultadoParser } from "./parser.part01.js";
import { Parser } from "./parser.part02.js";
export { normalizarOrigemUse } from "./parser.declaracoes.js";

export function parsear(tokens: Token[]): ResultadoParser {
  const parser = new Parser(tokens);
  return parser.analisar();
}
