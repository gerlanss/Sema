// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.resultados, sema.produto.cli_invocacao_publica.handlers, sema.produto.cli_invocacao_publica.argumentos
// Descrição: prova o envelope result/v1, a fronteira fatal interna e o recorte JSON de dev.

import assert from "node:assert/strict";
import test from "node:test";
import { CliControlError } from "../../pacotes/cli/src/cliControlError.js";
import { validarSintaxeInvocacaoPublica } from "../../pacotes/cli/src/cliGrammar.js";
import { executarCliRuntimeInterno } from "../../pacotes/cli/src/cliRuntime.js";
import {
  CODIGO_SAIDA_FATAL_RUNTIME_CLI,
  criarEnvelopeControleJsonV1,
  criarEnvelopeResultadoCliV1,
  emitirResultadoCliJsonV1,
  executarInvocacaoPublica,
} from "../../pacotes/cli/src/saidaCli.js";

const CAMPOS_RESULTADO_V1 = [
  "schemaVersion",
  "ok",
  "kind",
  "command",
  "code",
  "message",
  "exitCode",
  "payload",
] as const;

test("result/v1 mantém oito campos exatos e parseia JSON estruturalmente", () => {
  const envelope = criarEnvelopeResultadoCliV1({
    comando: "validar",
    codigoSaida: 0,
    stdout: '{"valido":true,"erros":[]}\n',
  });

  assert.deepEqual(Object.keys(envelope), CAMPOS_RESULTADO_V1);
  assert.deepEqual(envelope, {
    schemaVersion: "sema.cli.result/v1",
    ok: true,
    kind: "SUCCESS",
    command: "validar",
    code: "CLI_SUCCESS",
    message: null,
    exitCode: 0,
    payload: { valido: true, erros: [] },
  });

  assert.equal(criarEnvelopeResultadoCliV1({
    comando: "resumo",
    codigoSaida: 0,
    stdout: "42",
  }).payload, 42);
});

test("result/v1 preserva stdout textual, usa null vazio e redige erro de domínio", () => {
  const texto = "saída textual\ncom duas linhas\n";
  const falha = criarEnvelopeResultadoCliV1({
    comando: "doctor",
    codigoSaida: 2,
    stdout: texto,
  });
  assert.equal(falha.ok, false);
  assert.equal(falha.kind, "DOMAIN_ERROR");
  assert.equal(falha.code, "CLI_DOMAIN_ERROR");
  assert.equal(falha.message, "O comando Sema não foi concluído.");
  assert.equal(falha.payload, texto);

  const vazio = criarEnvelopeResultadoCliV1({
    comando: "guard",
    codigoSaida: 1,
    stdout: " \r\n",
  });
  assert.equal(vazio.payload, null);
});

test("result/v1 rejeita envelope público aninhado no payload", () => {
  for (const schemaVersion of ["sema.cli.result/v1", "sema.cli.control/v1"]) {
    assert.throws(
      () => criarEnvelopeResultadoCliV1({
        comando: "validar",
        codigoSaida: 0,
        stdout: JSON.stringify({ schemaVersion, payload: null }),
      }),
      /outro envelope público/u,
    );
  }
});

test("emissor result/v1 realiza uma única escrita lógica", () => {
  const linhas: string[] = [];
  const logOriginal = console.log;
  console.log = (...valores: unknown[]) => linhas.push(valores.map(String).join(" "));
  try {
    const envelope = emitirResultadoCliJsonV1({
      comando: "diagnosticos",
      codigoSaida: 0,
      stdout: "[]",
    });
    assert.equal(envelope.exitCode, 0);
  } finally {
    console.log = logOriginal;
  }

  assert.equal(linhas.length, 1);
  const emitido = JSON.parse(linhas[0]!) as Record<string, unknown>;
  assert.deepEqual(Object.keys(emitido), CAMPOS_RESULTADO_V1);
  assert.deepEqual(emitido.payload, []);
});

test("executarInvocacaoPublica permanece exclusivo de control/v1", () => {
  const linhas: string[] = [];
  const logOriginal = console.log;
  console.log = (...valores: unknown[]) => linhas.push(valores.map(String).join(" "));
  let relatorio: ReturnType<typeof executarInvocacaoPublica>;
  try {
    relatorio = executarInvocacaoPublica({
      resultado: "HELP",
      modoJson: true,
      envelopeControle: criarEnvelopeControleJsonV1({
        categoria: "HELP",
        codigoPublico: "CLI_HELP",
        mensagemPublica: "Sema CLI help",
        codigoSaida: 0,
      }),
    });
  } finally {
    console.log = logOriginal;
  }

  assert.equal(linhas.length, 1);
  assert.equal(JSON.parse(linhas[0]!).schemaVersion, "sema.cli.control/v1");
  assert.deepEqual(Object.keys(relatorio!), [
    "codigoSaida",
    "envelopeControleEmitido",
    "stderrVazio",
    "handlerExecutado",
    "politicaControleJsonV1Respeitada",
    "politicaHelpPuroRespeitada",
  ]);
});

test("runtime interno reserva exit 70 para exceção sem expor a causa", async () => {
  assert.equal(await executarCliRuntimeInterno(async () => 3), 3);
  assert.equal(
    await executarCliRuntimeInterno(async () => {
      throw new Error("causa privada que não pode chegar ao envelope");
    }),
    CODIGO_SAIDA_FATAL_RUNTIME_CLI,
  );
});

test("gramática rejeita dev watch em JSON e permite promoção finita", () => {
  assert.throws(
    () => validarSintaxeInvocacaoPublica(["dev", "--json"]),
    (erro) => erro instanceof CliControlError && erro.categoria === "ARGUMENT_ERROR",
  );
  const promocao = validarSintaxeInvocacaoPublica([
    "dev",
    "--promover",
    "contratos/sema/software.sema",
    "--json",
  ]);
  assert.equal(promocao.comando, "dev");
  assert.equal(promocao.dispatchPermitido, true);
});
