import test from "node:test";
import assert from "node:assert/strict";
import { tokenizar } from "../../pacotes/nucleo/dist/lexer/lexer.js";

test("lexer reconhece palavras-chave, identificadores e strings", () => {
  const codigo = 'module exemplo { task eco { input { mensagem: Texto required } } }';
  const resultado = tokenizar(codigo, "memoria.sema");

  assert.equal(resultado.diagnosticos.length, 0);
  assert.equal(resultado.tokens[0]?.valor, "module");
  assert.ok(resultado.tokens.some((token) => token.valor === "task"));
  assert.ok(resultado.tokens.some((token) => token.valor === "required"));
});
