import { parsear } from "./parser/parser.js";
import { analisarSemantica } from "./semantico/analisador.js";
import { tokenizar } from "./lexer/lexer.js";
import { converterParaIr } from "./ir/conversor.js";
import { formatarDiagnostico, type Diagnostico } from "./diagnosticos/index.js";
import type { ModuloAst } from "./ast/tipos.js";
import type { IrModulo } from "./ir/modelos.js";

export * from "./diagnosticos/index.js";
export * from "./ast/tipos.js";
export * from "./lexer/tokens.js";
export * from "./lexer/lexer.js";
export * from "./parser/parser.js";
export * from "./semantico/analisador.js";
export * from "./ir/modelos.js";
export * from "./ir/conversor.js";
export * from "./util/arquivos.js";

export interface ResultadoCompilacao {
  modulo?: ModuloAst;
  ir?: IrModulo;
  diagnosticos: Diagnostico[];
}

export function compilarCodigo(codigo: string, arquivo?: string): ResultadoCompilacao {
  const resultadoLexer = tokenizar(codigo, arquivo);
  const resultadoParser = parsear(resultadoLexer.tokens);
  const diagnosticos = [...resultadoLexer.diagnosticos, ...resultadoParser.diagnosticos];

  if (!resultadoParser.modulo) {
    return { diagnosticos };
  }

  const resultadoSemantico = analisarSemantica(resultadoParser.modulo);
  diagnosticos.push(...resultadoSemantico.diagnosticos);

  const ir = converterParaIr(resultadoParser.modulo, diagnosticos);

  return {
    modulo: resultadoParser.modulo,
    ir,
    diagnosticos,
  };
}

export function temErros(diagnosticos: Diagnostico[]): boolean {
  return diagnosticos.some((diagnostico) => diagnostico.severidade === "erro");
}

export function formatarDiagnosticos(diagnosticos: Diagnostico[]): string {
  if (diagnosticos.length === 0) {
    return "Nenhum diagnostico encontrado.";
  }
  return diagnosticos.map(formatarDiagnostico).join("\n");
}
