// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { compilarCodigo, compilarProjeto, temErros } from "../../pacotes/nucleo/dist/index.js";
import { gerarDart } from "../../pacotes/gerador-dart/dist/index.js";
import { gerarLua } from "../../pacotes/gerador-lua/dist/index.js";
import { gerarTypeScript } from "../../pacotes/gerador-typescript/dist/index.js";
import { gerarPython } from "../../pacotes/gerador-python/dist/index.js";
import { gerarJavaScript } from "../../pacotes/gerador-javascript/dist/index.js";
import { gerarHtml } from "../../pacotes/gerador-html/dist/index.js";
import { gerarCss } from "../../pacotes/gerador-css/dist/index.js";
import { gerarPhp } from "../../pacotes/gerador-php/dist/index.js";
async function compilarTypeScriptEstritoTemporario(
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-strict-ts-"));

  try {
    for (const arquivo of arquivos) {
      const destino = path.join(base, arquivo.caminhoRelativo);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, arquivo.conteudo, "utf8");
    }

    await mkdir(path.join(base, "stubs"), { recursive: true });
    await writeFile(
      path.join(base, "stubs", "nest-common.d.ts"),
      `export declare function Controller(path?: string): ClassDecorator;
export declare function Injectable(): ClassDecorator;
export declare function Get(path?: string): MethodDecorator;
export declare function Post(path?: string): MethodDecorator;
export declare function Put(path?: string): MethodDecorator;
export declare function Patch(path?: string): MethodDecorator;
export declare function Delete(path?: string): MethodDecorator;
export declare function Body(): ParameterDecorator;
`,
      "utf8",
    );
    await writeFile(
      path.join(base, "stubs", "jest-globals.d.ts"),
      `export declare function describe(name: string, fn: () => void): void;
export declare function it(name: string, fn: () => void | Promise<void>): void;
`,
      "utf8",
    );
    await writeFile(
      path.join(base, "stubs", "node-test.d.ts"),
      `export default function test(name: string, fn: () => void | Promise<void>): void;
`,
      "utf8",
    );
    await writeFile(
      path.join(base, "stubs", "node-assert-strict.d.ts"),
      `declare const assert: {
  ok(value: unknown): void;
  rejects(fn: () => Promise<unknown>, error?: unknown): Promise<void>;
};
export default assert;
`,
      "utf8",
    );
    await writeFile(
      path.join(base, "globals.d.ts"),
      `declare function expect<T = unknown>(value: T): { toBeDefined(): void };
`,
      "utf8",
    );
    await writeFile(
      path.join(base, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          moduleResolution: "node",
          strict: true,
          allowImportingTsExtensions: true,
          skipLibCheck: true,
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: false,
          noEmit: true,
          baseUrl: ".",
          paths: {
            "@nestjs/common": ["./stubs/nest-common.d.ts"],
            "@jest/globals": ["./stubs/jest-globals.d.ts"],
            "node:test": ["./stubs/node-test.d.ts"],
            "node:assert/strict": ["./stubs/node-assert-strict.d.ts"],
          },
        },
        include: ["*.ts", "src/**/*.ts", "test/**/*.ts", "globals.d.ts"],
      }, null, 2),
      "utf8",
    );

    return spawnSync(
      process.execPath,
      [path.resolve("node_modules/typescript/bin/tsc"), "-p", path.join(base, "tsconfig.json")],
      { stdio: "pipe", encoding: "utf8", cwd: base },
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}
async function executarTestesTypeScriptGeradosTemporario(
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-run-ts-"));

  try {
    const testes: string[] = [];
    for (const arquivo of arquivos) {
      const destino = path.join(base, arquivo.caminhoRelativo);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, arquivo.conteudo, "utf8");
      if (arquivo.caminhoRelativo.endsWith(".test.ts")) {
        testes.push(destino);
      }
    }

    return spawnSync(
      process.execPath,
      ["--import", "tsx", "--test", ...testes],
      { stdio: "pipe", encoding: "utf8", cwd: path.resolve(".") },
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}
async function executarTestesPythonGeradosTemporario(
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-run-py-"));

  try {
    const testes: string[] = [];
    for (const arquivo of arquivos) {
      const destino = path.join(base, arquivo.caminhoRelativo);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, arquivo.conteudo, "utf8");
      if (arquivo.caminhoRelativo.startsWith("test_") && arquivo.caminhoRelativo.endsWith(".py")) {
        testes.push(arquivo.caminhoRelativo);
      }
    }

    return spawnSync(
      "python",
      ["-m", "pytest", ...testes],
      { stdio: "pipe", encoding: "utf8", cwd: base },
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}
async function executarTestesPhpGeradosTemporario(
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-run-php-"));

  try {
    let arquivoTeste = "";
    for (const arquivo of arquivos) {
      const destino = path.join(base, arquivo.caminhoRelativo);
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, arquivo.conteudo, "utf8");
      if (path.basename(arquivo.caminhoRelativo).startsWith("test_") && arquivo.caminhoRelativo.endsWith(".php")) {
        arquivoTeste = arquivo.caminhoRelativo;
      }
    }

    return spawnSync(
      "php",
      [arquivoTeste],
      { stdio: "pipe", encoding: "utf8", cwd: base, shell: process.platform === "win32" },
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

test("geradores produzem artefatos para o exemplo de calculadora", async () => {
  const caminho = path.resolve("exemplos/calculadora.sema");
  const codigo = await readFile(caminho, "utf8");
  const resultado = compilarCodigo(codigo, caminho);

  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);
  const arquivosDart = gerarDart(resultado.ir!);
  const arquivosLua = gerarLua(resultado.ir!);
  const arquivosJs = gerarJavaScript(resultado.ir!);
  const arquivosHtml = gerarHtml(resultado.ir!);
  const arquivosCss = gerarCss(resultado.ir!);
  const arquivosPhp = gerarPhp(resultado.ir!);

  assert.ok(arquivosTs.some((arquivo) => arquivo.caminhoRelativo.endsWith(".ts")));
  assert.ok(arquivosPy.some((arquivo) => arquivo.caminhoRelativo.endsWith(".py")));
  assert.ok(arquivosDart.some((arquivo) => arquivo.caminhoRelativo.endsWith(".dart")));
  assert.ok(arquivosLua.some((arquivo) => arquivo.caminhoRelativo.endsWith(".lua")));
  assert.ok(arquivosJs.some((arquivo) => arquivo.caminhoRelativo.endsWith(".js")));
  assert.ok(arquivosHtml.some((arquivo) => arquivo.caminhoRelativo.endsWith(".html")));
  assert.ok(arquivosCss.some((arquivo) => arquivo.caminhoRelativo.endsWith(".css")));
  assert.ok(arquivosPhp.some((arquivo) => arquivo.caminhoRelativo.endsWith(".php")));
  assert.ok(arquivosTs[0]?.conteudo.includes("executar_somar"));
  assert.ok(arquivosPy[0]?.conteudo.includes("def executar_somar"));
  assert.ok(arquivosPhp[0]?.conteudo.includes("function executar_somar"));
  for (const arquivo of [
    ...arquivosTs,
    ...arquivosPy,
    ...arquivosDart,
    ...arquivosLua,
    ...arquivosJs,
    ...arquivosHtml,
    ...arquivosCss,
    ...arquivosPhp,
  ]) {
    assert.ok(arquivo.conteudo.includes("SEMA-GOVERNED"), `${arquivo.caminhoRelativo} sem cabeçalho Sema`);
  }
});

test("gerador PHP produz teste executavel pelo runner PHP", async () => {
  const caminho = path.resolve("exemplos/calculadora.sema");
  const codigo = await readFile(caminho, "utf8");
  const resultado = compilarCodigo(codigo, caminho);

  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosPhp = gerarPhp(resultado.ir!);
  const execucao = await executarTestesPhpGeradosTemporario(arquivosPhp);

  assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
  assert.match(execucao.stdout, /ok 2 testes/);
});

test("geradores refletem interoperabilidade externa e alvo Dart", () => {
  const codigo = `
module exemplo.interop {
  use ts app.gateway.pagamentos
  use py servicos.conciliacao
  use dart app.mobile.pagamentos

  task consultar {
    input {
      pagamento_id: Id required
    }
    output {
      status: Texto
    }
    guarantees {
      status existe
    }
    tests {
      caso "consulta" {
        given {
          pagamento_id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);
  const arquivosDart = gerarDart(resultado.ir!);

  assert.ok(arquivosTs[0]?.conteudo.includes("Interop externo ts: app.gateway.pagamentos"));
  assert.ok(arquivosPy[0]?.conteudo.includes("Interop externo py: servicos.conciliacao"));
  assert.ok(arquivosDart[0]?.conteudo.includes("Interop externo dart: app.mobile.pagamentos"));
});

test("geradores refletem vinculacao explicita de implementacao externa", () => {
  const codigo = `
module exemplo.impl {
  task processar {
    input {
      pagamento_id: Id required
    }
    output {
      protocolo: Id
    }
    impl {
      ts: app.gateway.pagamentos.processar
      py: servicos.pagamentos.processar
      dart: app.mobile.pagamentos.processar
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given {
          pagamento_id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);
  const arquivosDart = gerarDart(resultado.ir!);

  assert.ok(arquivosTs[0]?.conteudo.includes("Implementacoes externas vinculadas"));
  assert.ok(arquivosTs[0]?.conteudo.includes('origem: "ts", caminho: "app.gateway.pagamentos.processar", resolucaoImpl: "app.gateway.pagamentos.processar", statusImpl: "nao_verificado"'));
  assert.ok(arquivosPy[0]?.conteudo.includes("Implementacao externa vinculada: origem=py caminho=servicos.pagamentos.processar status=nao_verificado"));
  assert.ok(arquivosPy[0]?.conteudo.includes('"impl": ['));
  assert.ok(arquivosDart[0]?.conteudo.includes("impl=ts:app.gateway.pagamentos.processar[nao_verificado], py:servicos.pagamentos.processar[nao_verificado], dart:app.mobile.pagamentos.processar[nao_verificado]"));
});

test("gerador typescript preserva payload de teste inline com multiplos campos", () => {
  const codigo = `
module exemplo.inline.payload {
  task salvar {
    input {
      cod_colaborador: Id required
      whatsapp_number: Texto required
      ativo: Booleano required
    }
    output {
      contato: Texto
    }
    guarantees {
      contato existe
    }
    tests {
      caso "ok" {
        given { cod_colaborador: "101" whatsapp_number: "+5592999999999" ativo: verdadeiro }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivoTeste = gerarTypeScript(resultado.ir!).find((arquivo) => arquivo.caminhoRelativo.endsWith(".test.ts"));
  assert.ok(arquivoTeste);
  assert.ok(arquivoTeste?.conteudo.includes('"cod_colaborador": "101"'));
  assert.ok(arquivoTeste?.conteudo.includes('"whatsapp_number": "+5592999999999"'));
  assert.ok(arquivoTeste?.conteudo.includes('"ativo": true'));
});

test("geradores refletem estruturas semanticas mais ricas no exemplo de pagamento", async () => {
  const caminho = path.resolve("exemplos/pagamento.sema");
  const codigo = await readFile(caminho, "utf8");
  const caminhoDominio = path.resolve("exemplos/pagamento_dominio.sema");
  const codigoDominio = await readFile(caminhoDominio, "utf8");
  const projeto = compilarProjeto([
    { caminho: caminhoDominio, codigo: codigoDominio },
    { caminho, codigo },
  ]);
  const resultado = projeto.modulos.find((modulo) => modulo.caminho === caminho)!;

  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);

  assert.ok(arquivosTs[0]?.conteudo.includes("Regra violada"));
  assert.ok(arquivosTs[0]?.conteudo.includes("Garantia violada"));
  assert.ok(arquivosTs[0]?.conteudo.includes("Vinculo de estado: ciclo_pagamento"));
  assert.ok(arquivosTs[0]?.conteudo.includes("categoria=consulta alvo=gateway_pagamento"));
  assert.ok(arquivosTs[0]?.conteudo.includes("Route processar_pagamento_publico: metodo=POST caminho=/pagamentos/processar task=processar_pagamento"));
  assert.ok(arquivosTs[0]?.conteudo.includes("erros_publicos=autorizacao_negada, saldo_insuficiente, timeout_gateway"));
  assert.ok(arquivosTs[0]?.conteudo.includes("effects_publicos=auditoria:pagamento_publico"));
  assert.ok(arquivosTs[0]?.conteudo.includes("export const contrato_processar_pagamento"));
  assert.ok(arquivosTs[0]?.conteudo.includes("export async function adaptar_processar_pagamento_publico"));
  assert.ok(arquivosTs[0]?.conteudo.includes("export function verificar_resposta_publica_processar_pagamento_publico"));
  assert.ok(arquivosTs[0]?.conteudo.includes("verificar_garantias_processar_pagamento"));
  assert.ok(arquivosTs[0]?.conteudo.includes("Transicoes declaradas pela task: PENDENTE->AUTORIZADO, AUTORIZADO->PROCESSADO"));
  assert.ok(arquivosPy[0]?.conteudo.includes("Efeito estruturado: categoria=consulta alvo=gateway_pagamento criticidade=alta"));
  assert.ok(arquivosPy[0]?.conteudo.includes("Route processar_pagamento_publico: metodo=POST caminho=/pagamentos/processar task=processar_pagamento"));
  assert.ok(arquivosPy[0]?.conteudo.includes("contrato_processar_pagamento = {"));
  assert.ok(arquivosPy[0]?.conteudo.includes("def adaptar_processar_pagamento_publico"));
  assert.ok(arquivosPy[0]?.conteudo.includes("def verificar_resposta_publica_processar_pagamento_publico"));
  assert.ok(arquivosPy[0]?.conteudo.includes("def verificar_garantias_processar_pagamento"));
  assert.ok(arquivosPy[0]?.conteudo.includes("Vinculo de estado: ciclo_pagamento"));
  assert.ok(arquivosPy[0]?.conteudo.includes("Garantia violada"));
});

test("geradores refletem contrato executavel de erro e fluxo estruturado", async () => {
  const caminhoErro = path.resolve("exemplos/tratamento_erro.sema");
  const codigoErro = await readFile(caminhoErro, "utf8");
  const resultadoErro = compilarCodigo(codigoErro, caminhoErro);

  assert.equal(temErros(resultadoErro.diagnosticos), false);
  const arquivosTsErro = gerarTypeScript(resultadoErro.ir!);
  const arquivosPyErro = gerarPython(resultadoErro.ir!);
  assert.ok(arquivosTsErro[0]?.conteudo.includes("acesso_negadoErro"));
  assert.ok(arquivosPyErro[0]?.conteudo.includes("acesso_negadoErro"));
  assert.ok(arquivosTsErro[1]?.conteudo.includes("assert.rejects"));
  assert.ok(arquivosPyErro[1]?.conteudo.includes("pytest.raises"));
  assert.ok(arquivosTsErro[0]?.conteudo.includes("rotas_erro=2"));
  assert.ok(arquivosPyErro[0]?.conteudo.includes("rotas_erro=2"));

  const caminhoFlow = path.resolve("exemplos/automacao.sema");
  const codigoFlow = await readFile(caminhoFlow, "utf8");
  const resultadoFlow = compilarCodigo(codigoFlow, caminhoFlow);
  assert.equal(temErros(resultadoFlow.diagnosticos), false);
  const arquivosTsFlow = gerarTypeScript(resultadoFlow.ir!);
  const arquivosPyFlow = gerarPython(resultadoFlow.ir!);
  assert.ok(arquivosTsFlow[0]?.conteudo.includes("estruturadas=3"));
  assert.ok(arquivosTsFlow[0]?.conteudo.includes("ramificacoes=1"));
  assert.ok(arquivosTsFlow[0]?.conteudo.includes("mapeamentos=4"));
  assert.ok(arquivosPyFlow[0]?.conteudo.includes("ramificacoes=1"));
});

test("geradores refletem negacao semantica em TypeScript e Python", () => {
  const codigo = `
module exemplo.geracao.negacao {
  task validar {
    input {
      ativo: Booleano required
      valor: Decimal required
    }
    output {
      aprovado: Booleano
    }
    rules {
      nao (ativo == falso ou valor <= 0)
    }
    guarantees {
      nao (aprovado == falso)
    }
    tests {
      caso "ok" {
        given {
          ativo: verdadeiro
          valor: 10
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);

  assert.ok(arquivosTs[0]?.conteudo.includes("!("));
  assert.ok(arquivosPy[0]?.conteudo.includes("not ("));
});
