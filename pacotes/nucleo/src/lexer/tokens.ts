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
  "database",
  "type",
  "entity",
  "enum",
  "task",
  "worker",
  "evento",
  "fila",
  "cron",
  "webhook",
  "cache",
  "storage",
  "policy",
  "input",
  "output",
  "rules",
  "effects",
  "impl",
  "vinculos",
  "execucao",
  "auth",
  "authz",
  "dados",
  "audit",
  "segredos",
  "forbidden",
  "guarantees",
  "state",
  "flow",
  "route",
  "tests",
  "error",
  "docs",
  "comments",
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
  "fields",
  "invariants",
  "transitions",
  "given",
  "when",
  "expect",
  "caso",
  "required",
]);
