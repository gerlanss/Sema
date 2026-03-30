import type { IntervaloFonte } from "../diagnosticos/index.js";

export type TipoToken =
  | "palavra_chave"
  | "identificador"
  | "texto"
  | "numero"
  | "pontuacao"
  | "operador"
  | "nova_linha"
  | "comentario"
  | "fim_arquivo";

export interface Token {
  tipo: TipoToken;
  valor: string;
  intervalo: IntervaloFonte;
}

export const PALAVRAS_CHAVE = new Set([
  "module",
  "use",
  "type",
  "entity",
  "enum",
  "task",
  "input",
  "output",
  "rules",
  "effects",
  "impl",
  "guarantees",
  "state",
  "flow",
  "route",
  "tests",
  "error",
  "docs",
  "comments",
  "fields",
  "invariants",
  "transitions",
  "given",
  "when",
  "expect",
  "caso",
  "required",
]);
