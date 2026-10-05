// SEMA-GOVERNED: sema.produto.cli_verificacao
// Contrato: contratos/sema/cli_verificacao.sema
// Descrição: prova preservação byte a byte, testes regenerados e reexecução sem cache.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, readdir, rm, link } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const contrato = `module teste.release_local {
  task conferir {
    input { id: Texto required }
    output { versao: Texto }
    guarantees { versao existe }
    tests { caso "release" {
      given { id: "release" }
      expect { sucesso: verdadeiro versao: "2.0.0+20" }
    } }
  }
}`;

function executar(base: string, extras: string[] = [], json = true) {
  const r = spawnSync(process.execPath, ["pacotes/cli/dist/bin.js", "verificar", path.join(base, "release.sema"), ...(extras.includes("--alvo") ? [] : ["--alvo", "python"]), "--saida", path.join(base, "saida"), ...(json ? ["--json"] : []), ...extras], { encoding: "utf8" });
  assert.ifError(r.error);
  return { ...r, resultado: json ? JSON.parse(r.stdout) : undefined };
}

async function preparar(base: string) {
  await writeFile(path.join(base, "release.sema"), contrato);
  const inicial = executar(base, ["--sem-cache"]);
  assert.equal(inicial.status, 1); // Expect real não pode ser fabricado pelo andaime.
  const pasta = inicial.resultado.payload.modulos[0].alvos[0].pastaSaida;
  const arquivos = await readdir(pasta, { recursive: true });
  const relativo = arquivos.find(item => item.endsWith(".py") && !path.basename(item).startsWith("test_"))!;
  const impl = path.join(pasta, relativo);
  const texto = `${await readFile(impl, "utf8")}\n# Implementação local explícita para o release.\ndef executar_conferir(entrada):\n    return conferirSaida(versao="2.0.0+20")\n`;
  await writeFile(impl, texto);
  return { impl, texto, teste: path.join(pasta, arquivos.find(item => path.basename(item).startsWith("test_") && item.endsWith(".py"))!) };
}

async function temporario(fn: (base: string) => Promise<void>) {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-preservar-python-"));
  try { await fn(base); } finally { await rm(base, { recursive: true, force: true }); }
}

test("modo explícito preserva implementação, regenera testes editados e nunca usa cache", () => temporario(async base => {
  const { impl, texto, teste } = await preparar(base);
  await writeFile(teste, "# teste adulterado: nenhum assert\n");
  for (let i = 0; i < 2; i++) {
    const r = executar(base, ["--preservar-implementacao"]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const alvo = r.resultado.payload.modulos[0].alvos[0];
    assert.equal(alvo.origem, "executado");
    assert.equal(alvo.testesExecutados, true);
    assert.equal(alvo.tipoEvidencia, "implementacao_local_preservada");
    assert.equal(alvo.implementacaoExternaExecutada, false);
    assert.equal(await readFile(impl, "utf8"), texto);
    assert.match(await readFile(teste, "utf8"), /2\.0\.0\+20/);
  }
}));

test("implementação alterada reprova mesmo após resultado verde, sem sobrescrever", () => temporario(async base => {
  const { impl, texto } = await preparar(base);
  assert.equal(executar(base, ["--preservar-implementacao"]).status, 0);
  const errado = texto.replace('versao="2.0.0+20"', 'versao="release_errado"');
  await writeFile(impl, errado);
  const r = executar(base, ["--preservar-implementacao"]);
  assert.equal(r.status, 1);
  assert.equal(r.resultado.payload.sucesso, false);
  assert.equal(await readFile(impl, "utf8"), errado);
}));

test("expect atualizado é regenerado e rejeita implementação antiga", () => temporario(async base => {
  const { impl, texto } = await preparar(base);
  await writeFile(path.join(base, "release.sema"), contrato.replace("2.0.0+20", "3.0.0+30"));
  const r = executar(base, ["--preservar-implementacao"]);
  assert.equal(r.status, 1);
  assert.equal(await readFile(impl, "utf8"), texto);
}));

test("modo texto também preserva e executa a implementação local", () => temporario(async base => {
  const { impl, texto } = await preparar(base);
  const r = executar(base, ["--preservar-implementacao"], false);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(await readFile(impl, "utf8"), texto);
  assert.match(r.stdout, /implementacao_local_preservada/);
}));

test("ausência de implementação falha antes de criar saída ou novo andaime", () => temporario(async base => {
  await writeFile(path.join(base, "release.sema"), contrato);
  const r = executar(base, ["--preservar-implementacao"]);
  assert.equal(r.status, 1);
  assert.equal(r.resultado.kind, "DOMAIN_ERROR");
  assert.match(r.resultado.payload.erro, /ausente/);
  await assert.rejects(readdir(path.join(base, "saida")), { code: "ENOENT" });
}));

test("preservação não aceita outros alvos", () => temporario(async base => {
  await writeFile(path.join(base, "release.sema"), contrato);
  const r = executar(base, ["--preservar-implementacao", "--alvo", "typescript"]);
  assert.equal(r.status, 1);
  assert.match(r.resultado.payload.erro, /python/);
}));

test("implementação por hardlink é rejeitada sem escrever testes", () => temporario(async base => {
  const { impl, teste } = await preparar(base);
  await link(impl, path.join(base, "copia.py"));
  const antes = await readFile(teste, "utf8");
  const r = executar(base, ["--preservar-implementacao"]);
  assert.equal(r.status, 1);
  assert.match(r.resultado.payload.erro, /seguro/);
  assert.equal(await readFile(teste, "utf8"), antes);
}));
