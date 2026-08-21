// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.resultados
// Descricao: prova que contrato ausente devolve CONTRACT_NOT_FOUND tipado com sugestoes.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../pacotes/cli/dist/bin.js");

test("resumo de contrato inexistente devolve CONTRACT_NOT_FOUND com sugeridos em --json", () => {
  const resultado = spawnSync(process.execPath, [BIN, "resumo", "contratos/inexistente.sema", "--json"], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
    encoding: "utf8",
  });
  assert.equal(resultado.status, 2, );
  const envelope = JSON.parse(resultado.stdout);
  assert.equal(envelope.schemaVersion, "sema.cli.control/v1");
  assert.equal(envelope.kind, "CONTRACT_NOT_FOUND");
  assert.equal(envelope.code, "CLI_CONTRACT_NOT_FOUND");
  assert.equal(envelope.exitCode, 2);
  assert.ok(envelope.details, "esperava details");
  assert.ok(typeof envelope.details.caminhoTentado === "string");
  assert.ok(Array.isArray(envelope.details.sugeridos));
  assert.ok(envelope.details.sugeridos.length > 0, "esperava sugestoes de contratos");
  assert.ok(envelope.details.sugeridos.length <= 5, "sugestoes devem ser limitadas a 5");
});

test("drift de contrato inexistente tambem devolve CONTRACT_NOT_FOUND", () => {
  const resultado = spawnSync(process.execPath, [BIN, "drift", "contratos/nao-existe.sema", "--json"], {
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
    encoding: "utf8",
  });
  const envelope = JSON.parse(resultado.stdout ?? "{}");
  assert.equal(envelope.kind, "CONTRACT_NOT_FOUND");
});

test("categoria deploy reconhece edge function e runtime", async () => {
  const { inferirCategorias } = await import("../../pacotes/cli/src/docs.part01.js");
  const categoriasEdge = inferirCategorias("corrigir edge function que falha no deploy", []);
  assert.ok(categoriasEdge.includes("deploy"), `esperava deploy: ${categoriasEdge.join(",")}`);
  const categoriasRuntime = inferirCategorias("atualizar runtime do worker serverless", []);
  assert.ok(categoriasRuntime.includes("deploy"), `esperava deploy: ${categoriasRuntime.join(",")}`);
});
