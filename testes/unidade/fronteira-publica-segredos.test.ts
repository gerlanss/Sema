// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Descrição: prova que o scanner bloqueia segredos literais sem confundir tipos e fixtures sintéticas.

import assert from "node:assert/strict";
import test from "node:test";
import { detectarSegredoAparente } from "../../scripts/verificar-fronteira-publica.mjs";

const chave = (...partes: string[]) => partes.join("_");
const serializar = (nome: string, valor: string) => JSON.stringify({ [nome]: valor });

test("scanner bloqueia segredos literais em JSON e env", () => {
  assert.equal(
    detectarSegredoAparente(
      "config.json",
      serializar(chave("client", "secret"), "abcdefghijklmnop"),
    ),
    true,
  );
  assert.equal(
    detectarSegredoAparente(
      "config.json",
      serializar("password", `Sup3r${"Secret"}!Passw0rd`),
    ),
    true,
  );
  assert.equal(
    detectarSegredoAparente(
      ".env.example",
      `${chave("AUTH", "TOKEN")}=${"a".repeat(20)}1`,
    ),
    true,
  );
});

test("scanner não confunde anotações, chamadas e UUID sintético de fixture", () => {
  const codigo = [
    "token: TokenLockDistribuicaoGlobal;",
    "const token = contexto.getStore();",
    "const TOKEN = criarTokenLockDistribuicaoGlobal();",
  ].join("\n");
  assert.equal(detectarSegredoAparente("src/lock.ts", codigo), false);

  const uuidV4Sintetico = `${"1".repeat(8)}-${"1".repeat(4)}-4${"1".repeat(3)}-8${"1".repeat(3)}-${"1".repeat(12)}`;
  const uuidV7Sintetico = `${"7".repeat(8)}-${"7".repeat(4)}-7${"7".repeat(3)}-8${"7".repeat(3)}-${"7".repeat(12)}`;
  const nomeToken = "token";
  assert.equal(
    detectarSegredoAparente(
      "testes/unidade/fixture.test.ts",
      `${serializar(nomeToken, uuidV4Sintetico)}\n${serializar(nomeToken, uuidV7Sintetico)}`,
    ),
    false,
  );
});

test("UUID com aparência de token só é isento quando a fixture é obviamente sintética", () => {
  const nomeToken = "token";
  const uuidRealista = ["018f3a4b", "82c1", "7d2a", "9f10", "a1b2c3d4e5f6"].join("-");
  assert.equal(
    detectarSegredoAparente("testes/unidade/fixture.test.ts", serializar(nomeToken, uuidRealista)),
    true,
  );
  assert.equal(
    detectarSegredoAparente(
      "src/config.ts",
      serializar(nomeToken, `${"1".repeat(8)}-${"1".repeat(4)}-4${"1".repeat(3)}-8${"1".repeat(3)}-${"1".repeat(12)}`),
    ),
    true,
  );
});
