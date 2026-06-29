import { criarDiagnostico, type Diagnostico, type PosicaoFonte } from "../diagnosticos/index.js";
import { PALAVRAS_CHAVE, type Token, type TipoToken } from "./tokens.js";

export interface ResultadoLexer {
  tokens: Token[];
  diagnosticos: Diagnostico[];
}

function avancar(posicao: PosicaoFonte, caractere: string): PosicaoFonte {
  if (caractere === "\n") {
    return { indice: posicao.indice + 1, linha: posicao.linha + 1, coluna: 1 };
  }
  return { indice: posicao.indice + 1, linha: posicao.linha, coluna: posicao.coluna + 1 };
}

function criarToken(tipo: TipoToken, valor: string, inicio: PosicaoFonte, fim: PosicaoFonte, arquivo?: string): Token {
  return {
    tipo,
    valor,
    intervalo: { inicio, fim, arquivo },
  };
}

export function tokenizar(codigo: string, arquivo?: string): ResultadoLexer {
  const tokens: Token[] = [];
  const diagnosticos: Diagnostico[] = [];
  let posicao: PosicaoFonte = { indice: 0, linha: 1, coluna: 1 };

  while (posicao.indice < codigo.length) {
    const inicio = { ...posicao };
    const atual = codigo[posicao.indice]!;

    if (atual === " " || atual === "\t" || atual === "\r") {
      posicao = avancar(posicao, atual);
      continue;
    }

    if (atual === "\n") {
      posicao = avancar(posicao, atual);
      tokens.push(criarToken("nova_linha", "\n", inicio, { ...posicao }, arquivo));
      continue;
    }

    if (atual === "/" && codigo[posicao.indice + 1] === "/") {
      let texto = "";
      let cursor = { ...posicao };
      while (cursor.indice < codigo.length && codigo[cursor.indice] !== "\n") {
        texto += codigo[cursor.indice];
        cursor = avancar(cursor, codigo[cursor.indice]!);
      }
      tokens.push(criarToken("comentario", texto, inicio, cursor, arquivo));
      posicao = cursor;
      continue;
    }

    if (atual === "\"") {
      let texto = "";
      let cursor = avancar(posicao, atual);
      let fechado = false;
      while (cursor.indice < codigo.length) {
        const caractere = codigo[cursor.indice]!;
        if (caractere === "\\") {
          const proximo = codigo[cursor.indice + 1];
          if (proximo) {
            texto += caractere + proximo;
            cursor = avancar(avancar(cursor, caractere), proximo);
            continue;
          }
        }
        if (caractere === "\"") {
          fechado = true;
          cursor = avancar(cursor, caractere);
          break;
        }
        texto += caractere;
        cursor = avancar(cursor, caractere);
      }
      if (!fechado) {
        diagnosticos.push(
          criarDiagnostico(
            "LEX001",
            "Texto nao foi fechado com aspas.",
            "erro",
            { inicio, fim: cursor, arquivo },
            "Feche a string com aspas duplas.",
          ),
        );
        posicao = cursor;
        continue;
      }
      tokens.push(criarToken("texto", texto, inicio, cursor, arquivo));
      posicao = cursor;
      continue;
    }

    if (/[0-9]/.test(atual)) {
      let texto = "";
      let cursor = { ...posicao };
      while (cursor.indice < codigo.length && /[0-9.]/.test(codigo[cursor.indice]!)) {
        texto += codigo[cursor.indice];
        cursor = avancar(cursor, codigo[cursor.indice]!);
      }
      tokens.push(criarToken("numero", texto, inicio, cursor, arquivo));
      posicao = cursor;
      continue;
    }

    if (/[A-Za-z_]/.test(atual)) {
      let texto = "";
      let cursor = { ...posicao };
      while (cursor.indice < codigo.length && /[A-Za-z0-9_.-]/.test(codigo[cursor.indice]!)) {
        texto += codigo[cursor.indice];
        cursor = avancar(cursor, codigo[cursor.indice]!);
      }
      const tipo: TipoToken = PALAVRAS_CHAVE.has(texto) ? "palavra_chave" : "identificador";
      tokens.push(criarToken(tipo, texto, inicio, cursor, arquivo));
      posicao = cursor;
      continue;
    }

    const doisCaracteres = codigo.slice(posicao.indice, posicao.indice + 2);
    if (["==", "!=", ">=", "<=", "->"].includes(doisCaracteres)) {
      const cursor = avancar(avancar(posicao, doisCaracteres[0]!), doisCaracteres[1]!);
      tokens.push(criarToken("operador", doisCaracteres, inicio, cursor, arquivo));
      posicao = cursor;
      continue;
    }

    if ("{}[]():,.".includes(atual)) {
      const cursor = avancar(posicao, atual);
      tokens.push(criarToken("pontuacao", atual, inicio, cursor, arquivo));
      posicao = cursor;
      continue;
    }

    if ("=><+-*/|?".includes(atual)) {
      const cursor = avancar(posicao, atual);
      tokens.push(criarToken("operador", atual, inicio, cursor, arquivo));
      posicao = cursor;
      continue;
    }

    diagnosticos.push(
      criarDiagnostico(
        "LEX002",
        `Caractere inesperado encontrado: "${atual}".`,
        "erro",
        { inicio, fim: avancar(posicao, atual), arquivo },
        "Remova o caractere ou adicione suporte no lexer.",
      ),
    );
    posicao = avancar(posicao, atual);
  }

  tokens.push(
    criarToken(
      "fim_arquivo",
      "",
      { ...posicao },
      { ...posicao },
      arquivo,
    ),
  );

  return { tokens, diagnosticos };
}
