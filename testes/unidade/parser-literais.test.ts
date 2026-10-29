// SEMA-GOVERNED: sema.produto.parser_integridade
// Descrição: reproduz o fechamento prematuro da sessão Ornith e a preservação dos valores no formatador.
import test from "node:test";
import assert from "node:assert/strict";
import { compilarCodigo, formatarCodigo } from "@sema/nucleo";
import { formatarLiteralTestePython } from "../../pacotes/gerador-python/src/index.part01.js";
import { spawnSync } from "node:child_process";

const nomes = ["filtrar", "cadastrar", "alternar", "excluir"];
const fonte = (valor: string) => `module exemplo.lista {
  task filtrar {
    input { valor: Json }
    output { valor: Json }
    guarantees { valor existe }
    tests { caso "filtra pendentes" {
      given { valor: ${valor} }
      expect { valor: ${valor} }
    } }
  }
  ${nomes.slice(1).map((nome) => `task ${nome} { input {} output { ok: Booleano } guarantees { ok existe } }`).join("\n")}
}`;
const compilar = (codigo: string) => compilarCodigo(codigo, "literais.sema");
const erros = (r: ReturnType<typeof compilar>) => r.diagnosticos.filter((d) => d.severidade === "erro");

test("listas e objetos aninhados em given/expect preservam as quatro tarefas", () => {
  for (const valor of ['[]', '{}', '[1, 2]', '[{ id: "t1", concluida: falso }]',
    '[\n // fixture em múltiplas linhas\n { id: "t1", meta: { tags: ["a", "b"] } },\n { id: "t2" }\n]',
    '{ dados: [{ texto: "} { ] [", estado: verdadeiro }], vazio: nulo }']) {
    const r = compilar(fonte(valor));
    assert.deepEqual(erros(r), [], valor);
    assert.deepEqual(r.modulo?.tasks.map((t) => t.nome), nomes);
    assert.ok(r.modulo?.tasks[0]?.tests?.blocos[0]);
    assert.ok(r.ir?.tasks[0]?.tests[0]?.expect.campos.length);
  }
});

test("formatar e recompilar preserva objetos, espaços, escapes e campos seguintes", () => {
  const dados = [{ id: "t1", titulo: 'a  b "c" \\ d\nlinha', meta: { valores: [1, -2, null, "}", "a,b:c"] } }];
  const entrada = fonte(JSON.stringify(dados)).replace('given { valor:', 'given { outro: "[1, 2]"\n valor:');
  const formatado = formatarCodigo(entrada);
  assert.deepEqual(formatado.diagnosticos, []);
  const r = compilar(formatado.codigoFormatado!);
  assert.deepEqual(erros(r), []);
  assert.deepEqual(r.modulo?.tasks.map((t) => t.nome), nomes);
  const campos = r.ir!.tasks[0]!.tests[0]!.given.campos;
  assert.deepEqual(JSON.parse(campos.find((c) => c.nome === "valor")!.tipo), dados);
  assert.equal(formatarCodigo(formatado.codigoFormatado!).codigoFormatado, formatado.codigoFormatado);
  assert.match(formatado.codigoFormatado!, /outro: "\[1, 2\]"/);
});

test("delimitador inválido aponta PAR009 no literal, sem alegar validade", () => {
  for (const valor of ['[{ id: "t1" ]', '[1, 2', '{ id: [1, 2 }']) {
    const r = compilar(fonte(valor));
    const d = erros(r).find((item) => item.codigo === "PAR009");
    assert.ok(d, JSON.stringify(erros(r)));
    assert.ok(d.intervalo?.inicio.linha);
    assert.match(d.dica ?? "", /literal/);
  }
});

test("valores compostos não substituem caminhos de arquivo entre aspas", () => {
  const r = compilar(fonte("[]").replace("input { valor: Json }", 'input { valor: Json } vinculos { arquivo: ["app.js"] }'));
  assert.ok(erros(r).some((d) => d.codigo === "PAR004"));
});

test("consumidor Python recebe os valores compostos sem perder textos e booleanos", (t) => {
  const r = compilar(fonte('[{ titulo: "a  b", concluida: falso, meta: { vazio: nulo, tags: ["}", "a,b:c"] } }]'));
  assert.deepEqual(erros(r), []);
  const literal = formatarLiteralTestePython(r.ir!.tasks[0]!.tests[0]!.given.campos[0]!.tipo);
  const python = spawnSync("python", ["-c", `import ast,json; print(json.dumps(ast.literal_eval(${JSON.stringify(literal)})))`], { encoding: "utf8" });
  if ((python.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") { t.skip("Python indisponível neste ambiente"); return; }
  assert.equal(python.status, 0, python.stderr);
  assert.deepEqual(JSON.parse(python.stdout), [{ titulo: "a  b", concluida: false, meta: { vazio: null, tags: ["}", "a,b:c"] } }]);
});
