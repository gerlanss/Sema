// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.resultados, sema.produto.cli_invocacao_publica.handlers
// Descrição: prova isoladamente a emissão result/v1 e a rejeição de envelopes públicos aninhados.

import assert from "node:assert/strict";
import test from "node:test";

import {
  criarEnvelopeControleJsonV1,
  emitirResultadoCliJsonV1,
  executarInvocacaoPublica,
} from "../../pacotes/cli/src/saidaCli.js";
import { extrairPayloadResultadoCliV1 } from "../helpers/resultado-cli-v1.ts";

async function capturarConsole<T>(acao: () => T | Promise<T>): Promise<{
  resultado: T;
  stdout: string[];
  stderr: string[];
}> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const logOriginal = console.log;
  const errorOriginal = console.error;
  console.log = (...itens: unknown[]) => stdout.push(itens.map(String).join(" "));
  console.error = (...itens: unknown[]) => stderr.push(itens.map(String).join(" "));
  try {
    return { resultado: await acao(), stdout, stderr };
  } finally {
    console.log = logOriginal;
    console.error = errorOriginal;
  }
}

test("construtor e emissores preservam controle v1 e resultado v1", async () => {
  const casos = [
    ["HELP", "CLI_HELP", 0, true],
    ["UNKNOWN_COMMAND", "CLI_UNKNOWN_COMMAND", 1, false],
    ["ARGUMENT_ERROR", "CLI_ARGUMENT_ERROR", 1, false],
    ["FATAL_ERROR", "CLI_FATAL_ERROR", 1, false],
  ] as const;
  for (const [categoria, codigoPublico, codigoSaida, ok] of casos) {
    const mensagemEsperada = categoria === "HELP"
      ? `mensagem ${categoria}`
      : {
          UNKNOWN_COMMAND: "Comando Sema desconhecido.",
          ARGUMENT_ERROR: "Argumentos inválidos. Consulte a ajuda do comando.",
          FATAL_ERROR: "Falha ao executar a CLI da Sema.",
        }[categoria];
    assert.deepEqual(
      criarEnvelopeControleJsonV1({
        categoria,
        codigoPublico,
        mensagemPublica: `mensagem ${categoria}`,
        codigoSaida,
      }),
      {
        schemaVersion: "sema.cli.control/v1",
        ok,
        kind: categoria,
        code: codigoPublico,
        message: mensagemEsperada,
        exitCode: codigoSaida,
      },
    );
  }

  const payloadHandler = { sucesso: true, forma: "handler", nested: { valor: 7 } };
  const sucesso = await capturarConsole(() => emitirResultadoCliJsonV1({
    comando: "validar",
    codigoSaida: 0,
    stdout: JSON.stringify(payloadHandler),
  }));
  assert.deepEqual(sucesso.resultado, {
    schemaVersion: "sema.cli.result/v1",
    ok: true,
    kind: "SUCCESS",
    command: "validar",
    code: "CLI_SUCCESS",
    message: null,
    exitCode: 0,
    payload: payloadHandler,
  });
  assert.deepEqual(
    extrairPayloadResultadoCliV1(
      sucesso.stdout.join("\n"),
      { command: "validar", exitCode: 0 },
    ),
    payloadHandler,
  );
  assert.deepEqual(sucesso.stderr, []);

  const envelopeHelp = criarEnvelopeControleJsonV1({
    categoria: "HELP",
    codigoPublico: "CLI_HELP",
    mensagemPublica: "ajuda pública",
    codigoSaida: 0,
  });
  const help = await capturarConsole(() => executarInvocacaoPublica({
    resultado: "HELP",
    modoJson: true,
    envelopeControle: envelopeHelp,
  }));
  assert.equal(help.resultado.codigoSaida, 0);
  assert.equal(help.resultado.envelopeControleEmitido, true);
  assert.equal(help.resultado.handlerExecutado, false);
  assert.equal(help.resultado.politicaControleJsonV1Respeitada, true);
  assert.equal(help.resultado.politicaHelpPuroRespeitada, true);
  assert.deepEqual(JSON.parse(help.stdout.join("\n")), envelopeHelp);
  assert.deepEqual(help.stderr, []);
});

test("helper de subprocesso rejeita envelope público aninhado no payload", () => {
  const payloadsAninhados = [
    {
      schemaVersion: "sema.cli.result/v1",
      ok: true,
      kind: "SUCCESS",
      command: "validar",
      code: "CLI_SUCCESS",
      message: null,
      exitCode: 0,
      payload: null,
    },
    {
      schemaVersion: "sema.cli.control/v1",
      ok: false,
      kind: "ARGUMENT_ERROR",
      code: "CLI_ARGUMENT_ERROR",
      message: "Argumentos inválidos. Consulte a ajuda do comando.",
      exitCode: 1,
    },
  ] as const;

  for (const payload of payloadsAninhados) {
    assert.throws(
      () => extrairPayloadResultadoCliV1(JSON.stringify({
        schemaVersion: "sema.cli.result/v1",
        ok: true,
        kind: "SUCCESS",
        command: "validar",
        code: "CLI_SUCCESS",
        message: null,
        exitCode: 0,
        payload,
      }), { command: "validar", exitCode: 0 }),
      /payload não pode conter envelope público aninhado/u,
    );
  }
});
