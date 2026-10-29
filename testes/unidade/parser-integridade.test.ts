// SEMA-GOVERNED: sema.produto.parser_integridade, sema.produto.dsl_impl
// Descrição: impede falso verde por tarefas descartadas e mapeamentos malformados.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { compilarCodigo } from "@sema/nucleo";

const nomes = ["cadastrar", "alternar", "excluir", "filtrar"];
const task = (nome = "cadastrar", extra = "") => `task ${nome} {
  input { titulo: Texto required }
  output { titulo: Texto }
  guarantees { titulo existe }
  ${extra}
}`;
const tasks = nomes.map((nome) => task(nome)).join("\n");
const modulo = (corpo: string) => `module app.lista {\n${corpo}\n}`;
const erros = (codigo: string) => compilarCodigo(codigo, "lista.sema").diagnosticos.filter((d) => d.severidade === "erro");

test("enum com valores aninhados falha e recupera as quatro tarefas seguintes", () => {
  const r = compilarCodigo(modulo(`enum Filtro { valores { todas pendentes concluidas } }\n${tasks}`), "lista.sema");
  const d = r.diagnosticos.find((d) => d.codigo === "PAR006");
  assert.ok(d, JSON.stringify(r.diagnosticos));
  assert.equal(d.severidade, "erro");
  assert.ok(d.intervalo?.inicio.linha);
  assert.match(d.dica ?? "", /enum Filtro/);
  assert.deepEqual(r.modulo?.tasks.map((t) => t.nome), nomes);
});

test("conteúdo depois do módulo nunca é silenciosamente descartado", () => {
  for (const resto of [task(), "module outra {}", "}", "texto esquecido"]) {
    assert.ok(erros(modulo(tasks) + "\n" + resto).some((d) => d.codigo === "PAR005"), resto);
  }
  assert.deepEqual(erros(modulo(tasks) + "\n// comentário final\n"), []);
});

test("enum direto, docs e delimitadores dentro de texto preservam tarefas", () => {
  for (const valor of ["}", "{", "[", "]", "task", "docs"]) {
    const codigo = modulo(`enum Filtro { todas, pendentes, concluidas\n docs { resumo: ${JSON.stringify(valor)} } }\n${tasks}`);
    const r = compilarCodigo(codigo);
    assert.deepEqual(r.diagnosticos.filter((d) => d.severidade === "erro"), []);
    assert.deepEqual(r.modulo?.tasks.map((t) => t.nome), nomes);
    assert.deepEqual(r.modulo?.enums[0]?.valores, ["todas", "pendentes", "concluidas"]);
  }
});

test("impl no módulo e declaração desconhecida dão erro com orientação", () => {
  assert.ok(erros(modulo(`impl { js: app.cadastrar }\n${tasks}`)).some((d) => d.codigo === "PAR007" && /task/.test(d.dica ?? "")));
  assert.ok(erros(modulo(`tarefas { ${tasks} }`)).some((d) => d.codigo === "PAR007"));
});

test("declarações conhecidas sem nome não desaparecem como extras válidos", () => {
  for (const declaracao of ["task", "entity", "enum", "type", "flow", "route", "worker", "evento", "fila", "cron", "webhook", "cache", "storage", "policy", "database"]) {
    const r = compilarCodigo(modulo(`${declaracao} {}\n${tasks}`));
    assert.ok(r.diagnosticos.some((d) => d.codigo === "PAR007"), declaracao);
    assert.deepEqual(r.modulo?.tasks.map((t) => t.nome), nomes, declaracao);
  }
});

test("vínculos com setas, subblocos ou valores vazios não viram uma lista vazia válida", () => {
  for (const vinculo of ["cadastrar -> app.js:cadastrar", 'arquivos { arquivo: "app.js" }', "", 'arquivo: ""']) {
    const ds = erros(modulo(task("cadastrar", `vinculos { ${vinculo} }`)));
    assert.ok(ds.some((d) => d.codigo === "SEM126"), `${vinculo}: ${JSON.stringify(ds)}`);
  }
  assert.ok(erros(modulo('vinculos { cadastrar -> app.js:cadastrar }')).some((d) => d.codigo === "SEM126"));
});

test("impl exige campos de símbolo e rejeita bloco vazio, setas e caminhos físicos", () => {
  for (const impl of ["", "js -> app.cadastrar", "js { cadastrar }", 'js: "src/app.js"', "js: app.cadastrar lixo"]) {
    assert.ok(erros(modulo(task("cadastrar", `impl { ${impl} }`))).some((d) => d.codigo === "SEM061"), impl);
  }
});

test("comentários e nomes de símbolo legítimos não são confundidos com caminhos", () => {
  assert.deepEqual(erros(modulo(task("cadastrar", 'impl { js: app.js // função chamada js\n }\n vinculos { arquivo: "app.js" // arquivo real\n }'))), []);
  assert.ok(erros(modulo('enum Filtro { "docs" }')).some((d) => d.codigo === "PAR006"));
  assert.ok(erros(modulo('enum Filtro { todas = 1 }')).some((d) => d.codigo === "PAR006"));
});

test("arquivo no vínculo exige literal completo, inclusive quando não tem barra", () => {
  for (const valor of ["app.js", "src/app.js", '"app.js" lixo', '"app.js" + ".css"']) {
    assert.ok(erros(modulo(task("cadastrar", `vinculos { arquivo: ${valor} }`))).some((d) => d.codigo === "PAR004"), valor);
  }
});

test("blocos de mapeamento duplicados não descartam a segunda declaração", () => {
  for (const extra of [
    'impl { js: app.cadastrar } impl { js: app.alternar }',
    'vinculos { arquivo: "app.js" } vinculos { arquivo: "outro.js" }',
  ]) assert.ok(erros(modulo(task("cadastrar", extra))).some((d) => d.codigo === "PAR008"), extra);
  assert.ok(erros(modulo('vinculos { arquivo: "app.js" } vinculos { arquivo: "style.css" }')).some((d) => d.codigo === "PAR008"));
});

test("mapeamento correto mantém símbolos por tarefa e assets no módulo", () => {
  const codigo = modulo(`vinculos { arquivo: "index.html"\n arquivo: "style.css" }\n` + nomes.map((nome) => task(nome,
    `impl { js: app.${nome} }\n vinculos { arquivo: "app.js"\n simbolo: app.${nome} }`)).join("\n"));
  const r = compilarCodigo(codigo);
  assert.deepEqual(r.diagnosticos.filter((d) => d.severidade === "erro"), []);
  assert.equal(r.ir?.tasks.length, 4);
  assert.deepEqual(r.ir?.tasks.map((t) => t.implementacoesExternas[0]?.caminho), nomes.map((nome) => `app.${nome}`));
  assert.equal(r.ir?.vinculos.length, 2);
});

test("CLI validar e drift bloqueiam o enum inválido da sessão, com erro visível no pacote", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-parser-integridade-"));
  try {
    const ligadas = nomes.map((nome) => task(nome, `impl { js: app.${nome} } vinculos { arquivo: "app.js" }`)).join("\n");
    await writeFile(path.join(base, "app.js"), "// SEMA-GOVERNED: app.lista\n// Descrição: fixture local de tarefas ligadas.\n" + nomes.map((nome) => `function ${nome}(titulo) { return titulo; }`).join("\n"));
    await writeFile(path.join(base, "lista.sema"), modulo(`enum Filtro { valores { todas pendentes concluidas } }\n${ligadas}`));
    for (const args of [["validar", "lista.sema"], ["drift", "lista.sema", "--cache", "fresh", "--pacote"], ["drift", "lista.sema", "--cache", "fresh"]]) {
      const p = spawnSync(process.execPath, [path.resolve("pacotes/cli/dist/bin.js"), ...args, "--json"], { cwd: base, encoding: "utf8", timeout: 30000 });
      assert.equal(p.status, 1, p.stdout + p.stderr);
      const r = JSON.parse(p.stdout);
      assert.ok(p.stdout.includes("PAR006"), `${args[0]} precisa expor PAR006`);
      if (args[0] === "validar") {
        assert.equal(r.payload.valido, false);
        assert.ok(r.payload.erros.find((d: { codigo: string; linha: number; coluna: number }) => d.codigo === "PAR006" && d.linha > 0 && d.coluna > 0));
      }
      else if (args.includes("--pacote")) {
        assert.equal(r.payload.status.success, false);
        assert.equal(r.payload.counts.validImplementations, 4);
        assert.ok(r.payload.status.blocks.includes("contrato_invalido"));
        const d = r.payload.blockers.diagnostics.find((d: { codigo?: string }) => d.codigo === "PAR006");
        assert.equal(d.arquivo, "lista.sema");
        assert.ok(d.linha && d.coluna && d.dica);
      } else assert.equal(r.payload.sucesso, false);
    }
    const antes = await readFile(path.join(base, "lista.sema"), "utf8");
    const formatar = spawnSync(process.execPath, [path.resolve("pacotes/cli/dist/bin.js"), "formatar", "lista.sema", "--json"], { cwd: base, encoding: "utf8", timeout: 30000 });
    assert.equal(formatar.status, 1, formatar.stdout);
    assert.equal(await readFile(path.join(base, "lista.sema"), "utf8"), antes, "formatar não pode salvar uma AST parcial");

    // Mesmo com todos os símbolos resolvidos, erros semânticos também bloqueiam.
    await writeFile(path.join(base, "lista.sema"), modulo(ligadas.replaceAll("input { titulo: Texto required }", "")));
    const semantico = spawnSync(process.execPath, [path.resolve("pacotes/cli/dist/bin.js"), "drift", "lista.sema", "--cache", "fresh", "--pacote", "--json"], { cwd: base, encoding: "utf8", timeout: 30000 });
    assert.equal(semantico.status, 1);
    const rejeitado = JSON.parse(semantico.stdout).payload;
    assert.equal(rejeitado.counts.validImplementations, 4);
    assert.equal(rejeitado.status.success, false);
    assert.ok(rejeitado.blockers.diagnostics.some((d: { codigo?: string }) => d.codigo === "SEM003"));
  } finally { await rm(base, { recursive: true, force: true }); }
});
