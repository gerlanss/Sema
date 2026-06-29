// SEMA-GOVERNED: sema.software
// Descricao: nucleo semantico particionado; consulte contratos/sema/software.sema antes de editar.

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
import type { Diagnostico } from "../diagnosticos/index.js";
import { parsear } from "../parser/parser.js";
import { tokenizar } from "../lexer/lexer.js";

import { ORDEM_BLOCOS_MODULO, ResultadoFormatacao, ordenarPorMapa, renderizarBlocoAst, renderizarBlocoGenerico } from "./index.part01.js";

export function renderizarModulo(modulo: ModuloAst): string {
  const blocos: Array<{ chave: string; conteudo: string }> = [];

  if (modulo.docs) {
    blocos.push({ chave: "docs", conteudo: renderizarBlocoGenerico(modulo.docs, 1) });
  }
  if (modulo.comments) {
    blocos.push({ chave: "comments", conteudo: renderizarBlocoGenerico(modulo.comments, 1) });
  }
  for (const use of modulo.uses) {
    blocos.push({ chave: "use", conteudo: renderizarBlocoAst(use, 1) });
  }
  if (modulo.vinculos) {
    blocos.push({ chave: "vinculos", conteudo: renderizarBlocoGenerico(modulo.vinculos, 1) });
  }
  for (const database of modulo.databases) {
    blocos.push({ chave: "database", conteudo: renderizarBlocoGenerico(database, 1) });
  }
  for (const type of modulo.types) {
    blocos.push({ chave: "type", conteudo: renderizarBlocoAst(type, 1) });
  }
  for (const entity of modulo.entities) {
    blocos.push({ chave: "entity", conteudo: renderizarBlocoAst(entity, 1) });
  }
  for (const enumeracao of modulo.enums) {
    blocos.push({ chave: "enum", conteudo: renderizarBlocoAst(enumeracao, 1) });
  }
  for (const state of modulo.states) {
    blocos.push({ chave: "state", conteudo: renderizarBlocoAst(state, 1) });
  }
  for (const task of modulo.tasks) {
    blocos.push({ chave: "task", conteudo: renderizarBlocoAst(task, 1) });
  }
  for (const flow of modulo.flows) {
    blocos.push({ chave: "flow", conteudo: renderizarBlocoAst(flow, 1) });
  }
  for (const route of modulo.routes) {
    blocos.push({ chave: "route", conteudo: renderizarBlocoAst(route, 1) });
  }
  for (const worker of modulo.workers) {
    blocos.push({ chave: "worker", conteudo: renderizarBlocoGenerico(worker, 1) });
  }
  for (const evento of modulo.eventos) {
    blocos.push({ chave: "evento", conteudo: renderizarBlocoGenerico(evento, 1) });
  }
  for (const fila of modulo.filas) {
    blocos.push({ chave: "fila", conteudo: renderizarBlocoGenerico(fila, 1) });
  }
  for (const cron of modulo.crons) {
    blocos.push({ chave: "cron", conteudo: renderizarBlocoGenerico(cron, 1) });
  }
  for (const webhook of modulo.webhooks) {
    blocos.push({ chave: "webhook", conteudo: renderizarBlocoGenerico(webhook, 1) });
  }
  for (const cache of modulo.caches) {
    blocos.push({ chave: "cache", conteudo: renderizarBlocoGenerico(cache, 1) });
  }
  for (const storage of modulo.storages) {
    blocos.push({ chave: "storage", conteudo: renderizarBlocoGenerico(storage, 1) });
  }
  for (const policy of modulo.policies) {
    blocos.push({ chave: "policy", conteudo: renderizarBlocoGenerico(policy, 1) });
  }
  if (modulo.tests) {
    blocos.push({ chave: "tests", conteudo: renderizarBlocoGenerico(modulo.tests, 1) });
  }
  for (const extra of modulo.extras) {
    blocos.push({ chave: "desconhecido", conteudo: renderizarBlocoGenerico(extra, 1) });
  }

  const ordenados = ordenarPorMapa(blocos, (item) => item.chave, ORDEM_BLOCOS_MODULO);
  return `module ${modulo.nome} {\n${ordenados.map((item) => item.conteudo).join("\n\n")}\n}\n`;
}

export function formatarCodigo(codigo: string, arquivo?: string): ResultadoFormatacao {
  const resultadoLexer = tokenizar(codigo, arquivo);
  const resultadoParser = parsear(resultadoLexer.tokens);
  const diagnosticos = [...resultadoLexer.diagnosticos, ...resultadoParser.diagnosticos];

  if (!resultadoParser.modulo) {
    return { diagnosticos, alterado: false };
  }

  const codigoFormatado = renderizarModulo(resultadoParser.modulo).replace(/[ \t]+$/gm, "");
  return {
    modulo: resultadoParser.modulo,
    codigoFormatado,
    diagnosticos,
    alterado: codigoFormatado !== codigo,
  };
}
