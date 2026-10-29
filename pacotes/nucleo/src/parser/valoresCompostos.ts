// SEMA-GOVERNED: sema.produto.parser_integridade
// Descrição: lê valores de listas e objetos sem consumir fechamentos de blocos do contrato.
import type { Parser } from "./parser.part02.js";
import type { Token } from "../lexer/tokens.js";
import { decodificarTextoLiteral } from "./parser.part01.js";

export function lerValorComposto(parser: Parser): string {
  const aberturas = new Map([["[", "]"], ["{", "}"]]);
  const pilha: Token[] = [];
  const partes: string[] = [];
  const inicio = parser.atual();
  const erro = (token: Token, mensagem: string) => parser.registrarErro("PAR009", mensagem, token.intervalo, undefined,
    "Feche cada objeto com } e cada lista com ]. As chaves do valor não fecham given, expect, task ou module; confira o literal indicado antes de remover outros blocos.");
  while (parser.atual().tipo !== "fim_arquivo") {
    const token = parser.atual();
    if (["nova_linha", "comentario"].includes(token.tipo)) { parser.avancar(); continue; }
    if (token.tipo !== "texto") {
      if (aberturas.has(token.valor)) pilha.push(token);
      else if (["]", "}"].includes(token.valor)) {
        const esperado = aberturas.get(pilha.at(-1)?.valor ?? "");
        if (token.valor !== esperado) {
          erro(token, `Delimitador ${token.valor} incompatível no valor composto; era esperado ${esperado ?? "um valor"}.`);
          // Uma chave de bloco não pode ser engolida por uma lista sem fechamento.
          if (token.valor !== "}") parser.avancar();
          return partes.join(" ");
        }
        pilha.pop();
      }
    }
    if (token.tipo === "texto") {
      let texto: string;
      try { texto = JSON.parse(`"${token.valor}"`) as string; }
      catch { texto = decodificarTextoLiteral(token.valor); }
      partes.push(JSON.stringify(texto));
    } else if (token.tipo === "numero" && partes.at(-1) === "-") partes[partes.length - 1] += token.valor;
    else partes.push(token.valor);
    parser.avancar();
    if (!pilha.length) return partes.join(" ");
  }
  erro(inicio, `Valor composto iniciado com ${inicio.valor} não foi fechado.`);
  return partes.join(" ");
}
