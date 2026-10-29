// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.drift_pack
// Descrição: reproduz a leitura do Ornith com e sem --pacote, sem perder compatibilidade nem o veredicto.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const cli = path.resolve("pacotes/cli/dist/bin.js");
const contrato = (simbolo = "adicionar") => `module app.lista {
  task adicionar {
    input { nome: Texto required }
    output { nome: Texto }
    guarantees { nome existe }
    impl { js: logic.${simbolo} }
    vinculos { arquivo: "src/logic.js" simbolo: logic.${simbolo} }
  }
}`;
function rodar(base: string, args: string[]) {
  const p = spawnSync(process.execPath, [cli, ...args, "--json"], { cwd: base, encoding: "utf8", timeout: 30000 });
  assert.equal(p.stderr, "", p.stderr);
  return { exitCode: p.status, json: JSON.parse(p.stdout) };
}
async function fixture() {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-json-estavel-"));
  await mkdir(path.join(base, "contratos"));
  await mkdir(path.join(base, "src"));
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({ origens: ["contratos"], diretoriosCodigo: ["src"] }));
  await writeFile(path.join(base, "contratos/lista.sema"), contrato());
  await writeFile(path.join(base, "src/logic.js"), "// SEMA-GOVERNED: app.lista\n// Descrição: lógica da fixture de lista.\nfunction adicionar(nome) { return nome; }\n");
  return base;
}

test("mesmo leitor de status/counts funciona nos dois formatos, em sucesso e falha", async () => {
  const base = await fixture();
  try {
    // Esse é o acesso que falhava na sessão, mesmo após JSON.parse ter sucesso.
    const ler = (j: any) => ({ score: j.payload.status.score, success: j.payload.status.success, tasks: j.payload.counts.tasks });
    for (const quebrado of [false, true]) {
      await writeFile(path.join(base, "contratos/lista.sema"), contrato(quebrado ? "ausente" : "adicionar"));
      const completo = rodar(base, ["drift", "contratos/lista.sema", "--cache", "fresh"]);
      const compacto = rodar(base, ["drift", "contratos/lista.sema", "--cache", "fresh", "--pacote"]);
      assert.equal(completo.exitCode, quebrado ? 1 : 0, JSON.stringify(completo.json));
      assert.equal(compacto.exitCode, completo.exitCode);
      assert.equal(completo.json.schemaVersion, "sema.cli.result/v1");
      assert.equal(completo.json.payload.schema, "sema.drift/v1");
      assert.equal(compacto.json.payload.schema, "sema.ai.drift-pack/v1");
      assert.deepEqual(ler(completo.json), ler(compacto.json));
      assert.deepEqual(completo.json.payload.status, compacto.json.payload.status);
      assert.deepEqual(completo.json.payload.counts, compacto.json.payload.counts);
      assert.equal(ler(completo.json).success, !quebrado);
      assert.equal(ler(completo.json).tasks, 1);
      // Os leitores anteriores continuam funcionando no JSON completo.
      const p = completo.json.payload;
      assert.equal(p.sucesso, p.status.success);
      assert.equal(p.resumo_operacional.scoreMedio, p.status.score);
      assert.equal(p.impls_validos.length, p.counts.validImplementations);
      assert.equal(p.impls_quebrados.length, p.counts.brokenImplementations);
      assert.equal(p.vinculos_quebrados.length, p.counts.brokenLinks);
      assert.equal(p.tasks.length, p.counts.tasks);
      assert.equal(p.status.completeBehaviorProof, false);
      assert.equal(p.status.behaviorEvidence, "pending");
      assert.equal(p.counts.brokenImplementations, quebrado ? 1 : 0);
    }
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("perfil da sessão e ajuda expõem os caminhos corretos, sem aliases presumidos", async () => {
  const base = await fixture();
  try {
    assert.equal(rodar(base, ["sync-codex"]).exitCode, 0);
    const sessao = rodar(base, ["sessao", "Consultar lista", "--arquivo", "contratos/lista.sema", "--janela-contexto", "32768"]);
    assert.equal(sessao.exitCode, 0, JSON.stringify(sessao.json));
    assert.equal(sessao.json.payload.perfil.janelaTokens, 32768);
    assert.equal(sessao.json.payload.perfil.orcamentoTokens, 4096);
    assert.equal(sessao.json.payload.perfil.reservaSaidaTokens, 4096);
    const ajuda = rodar(base, ["ajuda-ia"]).json.payload;
    assert.match(ajuda, /payload\.status\.score/);
    assert.match(ajuda, /payload\.counts/);
    assert.match(ajuda, /payload\.perfil\.janelaTokens/);
    assert.match(ajuda, /TypeError/);
    const ajudaSessao = rodar(base, ["sessao", "--help"]).json.message;
    assert.match(ajudaSessao, /sem_correspondencia/);
    assert.match(ajudaSessao, /não documentação finalizada/);
  } finally { await rm(base, { recursive: true, force: true }); }
});
