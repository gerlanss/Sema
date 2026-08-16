// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.resultados, sema.produto.fronteira_repositorios.empacotamento.smoke
// Descrição: valida o envelope público result/v1 antes de expor seu payload aos testes de subprocesso.

import assert from "node:assert/strict";

const CHAVES_RESULTADO_CLI_V1 = [
  "code",
  "command",
  "exitCode",
  "kind",
  "message",
  "ok",
  "payload",
  "schemaVersion",
] as const;

type ObjetoJson = Record<string, unknown>;

export interface ExpectativaResultadoCliV1 {
  readonly command: string;
  readonly exitCode: number | null;
}

function exigirObjeto(valor: unknown, contexto: string): asserts valor is ObjetoJson {
  assert.equal(
    typeof valor === "object" && valor !== null && !Array.isArray(valor),
    true,
    `${contexto}: a saída deve ser um objeto JSON`,
  );
}

/**
 * Aceita somente `sema.cli.result/v1`. Envelopes de controle são deliberadamente
 * rejeitados para que cada teste preserve a fronteira entre controle e resultado.
 */
export function extrairPayloadResultadoCliV1<T = any>(
  stdout: string,
  esperado: ExpectativaResultadoCliV1,
  contexto = "resultado da CLI",
): T {
  const envelope = JSON.parse(stdout) as unknown;
  exigirObjeto(envelope, contexto);

  assert.notEqual(
    envelope.schemaVersion,
    "sema.cli.control/v1",
    `${contexto}: envelope control/v1 não pode ser desembrulhado como resultado`,
  );
  assert.deepEqual(
    Object.keys(envelope).sort(),
    [...CHAVES_RESULTADO_CLI_V1],
    `${contexto}: o envelope result/v1 deve ter exatamente oito chaves`,
  );
  assert.equal(envelope.schemaVersion, "sema.cli.result/v1", `${contexto}: schemaVersion`);
  assert.equal(typeof envelope.command, "string", `${contexto}: command`);
  assert.match(envelope.command as string, /^[a-z][a-z0-9-]{0,63}$/u, `${contexto}: command`);
  assert.equal(Number.isSafeInteger(envelope.exitCode), true, `${contexto}: exitCode`);
  assert.equal((envelope.exitCode as number) >= 0 && (envelope.exitCode as number) <= 255, true, `${contexto}: exitCode`);
  assert.equal(Number.isSafeInteger(esperado.exitCode), true, `${contexto}: exit code observado`);
  assert.equal(envelope.command, esperado.command, `${contexto}: comando observado`);
  assert.equal(envelope.exitCode, esperado.exitCode, `${contexto}: exit code observado`);

  if (envelope.exitCode === 0) {
    assert.equal(envelope.ok, true, `${contexto}: ok de sucesso`);
    assert.equal(envelope.kind, "SUCCESS", `${contexto}: kind de sucesso`);
    assert.equal(envelope.code, "CLI_SUCCESS", `${contexto}: code de sucesso`);
    assert.equal(envelope.message, null, `${contexto}: message de sucesso`);
  } else {
    assert.equal(envelope.ok, false, `${contexto}: ok de erro de domínio`);
    assert.equal(envelope.kind, "DOMAIN_ERROR", `${contexto}: kind de erro de domínio`);
    assert.equal(envelope.code, "CLI_DOMAIN_ERROR", `${contexto}: code de erro de domínio`);
    assert.equal(typeof envelope.message, "string", `${contexto}: message de erro de domínio`);
    assert.notEqual((envelope.message as string).trim(), "", `${contexto}: message de erro de domínio`);
  }

  const payload = envelope.payload;
  if (
    typeof payload === "object"
    && payload !== null
    && !Array.isArray(payload)
    && (
      (payload as ObjetoJson).schemaVersion === "sema.cli.result/v1"
      || (payload as ObjetoJson).schemaVersion === "sema.cli.control/v1"
    )
  ) {
    assert.fail(`${contexto}: payload não pode conter envelope público aninhado`);
  }

  return payload as T;
}
