// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: prova que importar express/fastify/koa infere body, query e response dos handlers.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { importarExpressFastifyDeArquivo } from "../../pacotes/cli/src/importador.part06.js";

const CODIGO_HANDLER = `import express from "express";
const app = express();

app.post("/produtos", criarProduto);
app.get("/produtos/:id", obterProduto);

function criarProduto(req: any, res: any) {
  const { nome, preco } = req.body;
  const ativo = req.query.ativo;
  res.status(201).json({ id: "1", nome });
}

function obterProduto(req: any, res: any) {
  const id = req.params.id;
  res.json({ id });
}

export { app };
`;

test("importar express infere body, query e response do handler nao exportado", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "sema-import-sem-"));
  try {
    const arquivo = path.join(dir, "server.ts");
    await writeFile(arquivo, CODIGO_HANDLER, "utf8");

    const modulos = importarExpressFastifyDeArquivo(dir, arquivo, "demo", "express");
    assert.equal(modulos.length, 1);

    const criar = modulos[0]!.tasks.find((task) => task.nome === "criar_produto");
    assert.ok(criar, "esperava task criar_produto");
    const nomesEntrada = criar!.input.map((campo) => campo.nome);
    assert.ok(nomesEntrada.includes("nome"), `body nome ausente: ${nomesEntrada.join(",")}`);
    assert.ok(nomesEntrada.includes("preco"), `body preco ausente: ${nomesEntrada.join(",")}`);
    assert.ok(nomesEntrada.includes("ativo"), `query ativo ausente: ${nomesEntrada.join(",")}`);
    const nomesSaida = criar!.output.map((campo) => campo.nome);
    assert.ok(nomesSaida.includes("id") || nomesSaida.includes("nome"), `response ausente: ${nomesSaida.join(",")}`);

    const obter = modulos[0]!.tasks.find((task) => task.nome === "obter_produto");
    assert.ok(obter, "esperava task obter_produto");
    assert.ok(obter!.input.some((campo) => campo.nome === "id"), "parametro de caminho id ausente");

    const rotaCriar = modulos[0]!.routes.find((rota) => rota.task === "criar_produto");
    assert.ok(rotaCriar?.input.some((campo) => campo.nome === "nome"), "rota sem input inferido");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
