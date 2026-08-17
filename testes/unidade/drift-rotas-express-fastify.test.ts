// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: prova extracao e matching de rotas Express e Fastify no drift.

import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { extrairRotasExpressFastify } from "../../pacotes/cli/src/typescript-http-rotas.js";
import { escolherRotasEsperadas } from "../../pacotes/cli/src/drift.part09.js";
import type { FonteLegado } from "../../pacotes/cli/src/tipos.js";

function compilar(codigo: string): ts.SourceFile {
  return ts.createSourceFile("rotas.ts", codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

test("extrai rotas express a partir de chamadas app e router", () => {
  const sourceFile = compilar([
    'import express from "express";',
    "const app = express();",
    'app.post("/produtos", criarProduto);',
    'app.get("/produtos", listarProdutos);',
    'app.delete("/produtos/:id", removerProduto);',
    'const router = express.Router();',
    'router.put("/produtos/:id", atualizarProduto);',
  ].join("\n"));

  const rotas = extrairRotasExpressFastify(sourceFile);

  assert.deepEqual(
    rotas.map((rota) => `${rota.origem} ${rota.metodo} ${rota.caminho}`).sort(),
    [
      "express DELETE /produtos/{id}",
      "express GET /produtos",
      "express POST /produtos",
      "express PUT /produtos/{id}",
    ],
  );
  const rotaParametro = rotas.find((rota) => rota.metodo === "DELETE");
  assert.equal(rotaParametro?.parametros[0]?.nome, "id");
  assert.equal(rotaParametro?.parametros[0]?.tipoSema, "Id");
  const rotaComHandler = rotas.find((rota) => rota.metodo === "POST");
  assert.equal(rotaComHandler?.simbolo, "criarProduto");
});

test("extrai rotas fastify com verbos encadeados e objeto route", () => {
  const sourceFile = compilar([
    'import Fastify from "fastify";',
    "const fastify = Fastify({ logger: true });",
    'fastify.get("/pedidos/:id", obterPedido);',
    'fastify.route({ method: "POST", url: "/pedidos", handler: criarPedido });',
  ].join("\n"));

  const rotas = extrairRotasExpressFastify(sourceFile);

  assert.deepEqual(
    rotas.map((rota) => `${rota.origem} ${rota.metodo} ${rota.caminho}`).sort(),
    ["fastify GET /pedidos/{id}", "fastify POST /pedidos"],
  );
});

test("expande verbo all em metodos concretos e ignora arquivos sem import", () => {
  const comAll = compilar([
    'import express from "express";',
    "const app = express();",
    'app.all("/status", statusHandler);',
  ].join("\n"));
  assert.deepEqual(
    extrairRotasExpressFastify(comAll).map((rota) => rota.metodo).sort(),
    ["DELETE", "GET", "PATCH", "POST", "PUT"],
  );

  const semImport = compilar([
    "const app = { get: () => {} };",
    'app.get("/nao-e-rota", handler);',
  ].join("\n"));
  assert.deepEqual(extrairRotasExpressFastify(semImport), []);
});

test("escolherRotasEsperadas considera fontes express e fastify", () => {
  const task = {
    nome: "criar_produto",
    implementacoesExternas: [{ origem: "ts" as const, caminho: "server.routes.criarProduto" }],
  } as Parameters<typeof escolherRotasEsperadas>[0];

  const comExpress = escolherRotasEsperadas(task, ["typescript", "express"] as FonteLegado[]);
  assert.ok(comExpress.includes("express"));

  const taskFastify = {
    nome: "criar_pedido",
    implementacoesExternas: [{ origem: "ts" as const, caminho: "app.fastify.criarPedido" }],
  } as Parameters<typeof escolherRotasEsperadas>[0];
  const comFastify = escolherRotasEsperadas(taskFastify, ["typescript", "fastify"] as FonteLegado[]);
  assert.ok(comFastify.includes("fastify"));
});

test("normalizarFonteLegado aceita express e fastify declarados no config", async () => {
  const { normalizarFonteLegado } = await import("../../pacotes/cli/src/projetoConfig.js");
  assert.equal(normalizarFonteLegado("express"), "express");
  assert.equal(normalizarFonteLegado("fastify"), "fastify");
  assert.equal(normalizarFonteLegado("gin"), undefined);
});
