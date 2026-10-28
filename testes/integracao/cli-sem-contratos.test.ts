// SEMA-GOVERNED: sema.validacao_resposta
// Descrição: impede aprovação vazia e alterações em código que não é contrato.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("../../pacotes/cli/dist/bin.js", import.meta.url));

function executar(base: string, args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: base, encoding: "utf8", timeout: 30_000, windowsHide: true,
  });
  assert.ifError(result.error);
  return result;
}

test("validar/formatar rejeitam app sem contratos sem adotar nem alterar arquivos", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sema-sem-contratos-"));
  const html = "<!doctype html><html lang=\"pt-BR\"><title>Tarefas</title></html>\n";
  try {
    await writeFile(path.join(base, "index.html"), html);
    for (const command of ["validar", "formatar"] as const) {
      for (const json of [false, true]) {
        const result = executar(base, [command, ".", ...(json ? ["--json"] : [])]);
        assert.equal(result.status, 1, `${command}: ${result.stdout}`);
        assert.match(result.stdout + result.stderr, /SEM_CLI_SEM_CONTRATOS/);
        if (json) {
          const envelope = JSON.parse(result.stdout);
          assert.equal(envelope.ok, false);
          assert.equal(envelope.kind, "DOMAIN_ERROR");
          if (command === "validar") {
            assert.equal(envelope.payload.valido, false);
            assert.equal(envelope.payload.bloqueia_acao, true);
          } else {
            assert.equal(envelope.payload.sucesso, false);
            assert.equal(envelope.payload.totais.arquivos, 0);
          }
        }
      }
    }
    assert.deepEqual(await readdir(base), ["index.html"]);
    assert.equal(await readFile(path.join(base, "index.html"), "utf8"), html);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("formatação explícita rejeita arquivo não .sema mesmo com sintaxe de contrato", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sema-extensao-contrato-"));
  const source = "module teste.app {entity Tarefa {fields {titulo: Texto}}}";
  try {
    await writeFile(path.join(base, "app.js"), source);
    const result = executar(base, ["formatar", "app.js", "--json"]);
    assert.equal(result.status, 1, result.stdout);
    assert.equal(JSON.parse(result.stdout).ok, false);
    assert.equal(await readFile(path.join(base, "app.js"), "utf8"), source);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("validar e formatar continuam operando sobre contrato real", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "sema-com-contrato-"));
  try {
    await writeFile(path.join(base, "app.sema"), "module teste.app {entity Tarefa {fields {titulo: Texto}}}");
    for (const command of ["formatar", "validar"] as const) {
      const result = executar(base, [command, "app.sema", "--json"]);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      const envelope = JSON.parse(result.stdout);
      assert.equal(envelope.ok, true);
      assert.equal(command === "validar" ? envelope.payload.valido : envelope.payload.sucesso, true);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
