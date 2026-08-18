// SEMA-GOVERNED: sema.software
// Descricao: parser particionado; consulte contratos/sema/software.sema antes de editar.

import {
  criarDiagnostico,
  type Diagnostico,
  type IntervaloFonte,
} from "../diagnosticos/index.js";
import type {
  BlocoAst,
  BlocoCasoTesteAst,
  BlocoGenericoAst,
  CampoAst,
  EntityAst,
  EnumAst,
  FlowAst,
  ModuloAst,
  RouteAst,
  StateAst,
  TaskAst,
  TypeAst,
  UseAst,
} from "../ast/tipos.js";
import type { Token } from "../lexer/tokens.js";

export interface ResultadoParser {
  modulo?: ModuloAst;
  diagnosticos: Diagnostico[];
}

export type PalavraBloco =
  | "database"
  | "docs"
  | "comments"
  | "design"
  | "tokens"
  | "table"
  | "view"
  | "query"
  | "transaction"
  | "index"
  | "constraint"
  | "relationship"
  | "collection"
  | "document"
  | "keyspace"
  | "stream"
  | "lock"
  | "retention"
  | "replication"
  | "fields"
  | "invariants"
  | "transitions"
  | "input"
  | "output"
  | "rules"
  | "effects"
  | "impl"
  | "vinculos"
  | "execucao"
  | "auth"
  | "authz"
  | "dados"
  | "audit"
  | "segredos"
  | "forbidden"
  | "guarantees"
  | "state"
  | "tests"
  | "error"
  | "flow"
  | "route"
  | "worker"
  | "evento"
  | "fila"
  | "cron"
  | "webhook"
  | "cache"
  | "storage"
  | "policy"
  | "when"
  | "given"
  | "expect";

export const PALAVRAS_BLOCO_NOMEADO_LIVRE = new Set<PalavraBloco>([
  "table",
  "view",
  "query",
  "transaction",
  "index",
  "constraint",
  "relationship",
  "collection",
  "document",
  "keyspace",
  "stream",
  "lock",
  "retention",
  "replication",
]);

export function decodificarTextoLiteral(valor: string): string {
  let resultado = "";

  for (let indice = 0; indice < valor.length; indice += 1) {
    const atual = valor[indice];
    if (atual !== "\\") {
      resultado += atual;
      continue;
    }

    const proximo = valor[indice + 1];
    if (!proximo) {
      resultado += atual;
      continue;
    }

    switch (proximo) {
      case "\"":
        resultado += "\"";
        indice += 1;
        break;
      case "\\":
        resultado += "\\";
        indice += 1;
        break;
      case "n":
        resultado += "\n";
        indice += 1;
        break;
      case "r":
        resultado += "\r";
        indice += 1;
        break;
      case "t":
        resultado += "\t";
        indice += 1;
        break;
      default:
        resultado += `${atual}${proximo}`;
        indice += 1;
        break;
    }
  }

  return resultado;
}
