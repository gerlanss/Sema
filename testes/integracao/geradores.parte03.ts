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

test("gerador Python emite pass quando validacao da task tem apenas comentarios", () => {
  const codigo = `
module exemplo.geracao.python_predicado {
  task consultar {
    input {
      worker_name: Texto
    }
    output {
      status: Texto
    }
    rules {
      worker_name deve_ser preenchido
    }
    guarantees {
      status existe
    }
    tests {
      caso "ok" {
        given { worker_name: "main" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "memoria.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivoPy = gerarPython(resultado.ir!).find((arquivo) => arquivo.caminhoRelativo.endsWith(".py"));
  assert.ok(arquivoPy);
  assert.match(
    arquivoPy!.conteudo,
    /def validar_consultar\(entrada: consultarEntrada\) -> None:\n    # Predicado declarado em Sema: worker_name deve_ser preenchido\n    pass/,
  );
});

test("gerador Python ordena campos obrigatorios antes dos opcionais em dataclass de entrada", async () => {
  const codigo = `
module exemplo.geracao.python_ordem {
  task criar_campanha {
    input {
      nome: Texto required
      janela_inicio: Texto
      janela_fim: Texto
      dias_semana: Lista<Texto> required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "ok" {
        given { nome: "Resumo" dias_semana: "[MON]" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "python_ordem.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivoPy = gerarPython(resultado.ir!).find((arquivo) => arquivo.caminhoRelativo === "exemplo_geracao_python_ordem.py");
  assert.ok(arquivoPy);
  assert.match(
    arquivoPy.conteudo,
    /class criar_campanhaEntrada:\n    nome: str\n    dias_semana: list\[str\]\n    janela_inicio: str \| None = None\n    janela_fim: str \| None = None/,
  );

  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-gerador-python-ordem-"));
  try {
    const caminhoArquivo = path.join(baseTemporaria, arquivoPy.caminhoRelativo);
    await mkdir(path.dirname(caminhoArquivo), { recursive: true });
    await writeFile(caminhoArquivo, arquivoPy.conteudo, "utf8");

    const compilacao = spawnSync("python", ["-m", "py_compile", caminhoArquivo], {
      stdio: "pipe",
      encoding: "utf8",
    });
    assert.equal(compilacao.status, 0, compilacao.stderr || compilacao.stdout);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("geradores sintetizam given aninhado para tipos compostos", () => {
  const codigo = `
module exemplo.geracao.aninhado {
  type DocumentoEntrada {
    fields {
      texto_extraido: Texto required
      paginas: Inteiro required
      metadata: Json required
    }
  }

  task processar_checkout {
    input {
      documento: DocumentoEntrada required
      origem: Texto
    }
    output {
      ok: Booleano
    }
    guarantees {
      ok existe
    }
    tests {
      caso "checkout composto" {
        given {
          documento {
            texto_extraido: "trecho principal"
            paginas: 3
            metadata {
              cliente {
                nome: "Ana"
                vip: verdadeiro
              }
              total: 19.9
            }
          }
          origem: "web"
        }
        error {
          tipo: "checkout_invalido"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "aninhado.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);
  assert.equal(resultado.ir.tasks[0]?.tests[0]?.given.blocos[0]?.nome, "documento");
  assert.equal(resultado.ir.tasks[0]?.tests[0]?.given.blocos[0]?.conteudo.blocos[0]?.nome, "metadata");

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const testesTs = arquivosTs.find((arquivo) => arquivo.caminhoRelativo === "exemplo_geracao_aninhado.test.ts")?.conteudo ?? "";
  assert.match(testesTs, /"documento": \{/);
  assert.match(testesTs, /"cliente": \{/);
  assert.match(testesTs, /"vip": true/);
  assert.match(testesTs, /"total": 19\.9/);

  const arquivosPy = gerarPython(resultado.ir!);
  const codigoPy = arquivosPy.find((arquivo) => arquivo.caminhoRelativo === "exemplo_geracao_aninhado.py")?.conteudo ?? "";
  const testesPy = arquivosPy.find((arquivo) => arquivo.caminhoRelativo === "test_exemplo_geracao_aninhado.py")?.conteudo ?? "";
  assert.match(codigoPy, /def normalizar_contexto_processar_checkout/);
  assert.match(codigoPy, /def criar_erro_processar_checkout/);
  assert.match(testesPy, /contexto = \{ "erro_esperado": "checkout_invalido" \}/);
  assert.match(testesPy, /documento=DocumentoEntrada\(/);
  assert.match(testesPy, /"cliente": \{/);
  assert.match(testesPy, /"vip": True/);
  assert.match(testesPy, /"total": 19\.9/);
});

test("geradores executam testes tipados com auth e listas em TypeScript e Python", async () => {
  const codigo = `
module exemplo.geracao.execucao_tipada {
  task verificar_execucao {
    input {
      loja: Inteiro required
      produtos: Texto[] required
    }
    output {
      protocolo: Id
    }
    auth {
      modo: obrigatorio
    }
    rules {
      loja em [1, 2, 3]
    }
    guarantees {
      protocolo existe
    }
    error {
      autenticacao_obrigatoria: "Autenticacao obrigatoria."
      loja_invalida: "Loja invalida."
    }
    tests {
      caso "ok" {
        given {
          loja: 1
          produtos: "[AA34626]"
        }
        expect {
          sucesso: verdadeiro
        }
      }
      caso "loja invalida" {
        given {
          loja: 9
          produtos: "[AA34626]"
        }
        error {
          tipo: "loja_invalida"
        }
        expect {
          sucesso: falso
        }
      }
      caso "auth obrigatoria" {
        given {
          loja: 1
          produtos: "[AA34626]"
        }
        error {
          tipo: "autenticacao_obrigatoria"
        }
        expect {
          sucesso: falso
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "execucao_tipada.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);
  const testeTs = arquivosTs.find((arquivo) => arquivo.caminhoRelativo.endsWith(".test.ts"));
  const testePy = arquivosPy.find((arquivo) => arquivo.caminhoRelativo.startsWith("test_"));
  assert.ok(testeTs);
  assert.ok(testePy);
  assert.match(testeTs!.conteudo, /"produtos": \[\s*"AA34626"\s*\]/);
  assert.match(testePy!.conteudo, /produtos=\["AA34626"\]/);
  assert.match(testeTs!.conteudo, /erroEsperado: "loja_invalida"/);
  assert.match(testePy!.conteudo, /"erro_esperado": "autenticacao_obrigatoria"/);

  const execucaoTs = await executarTestesTypeScriptGeradosTemporario(arquivosTs);
  assert.equal(execucaoTs.status, 0, execucaoTs.stderr || execucaoTs.stdout);

  const execucaoPy = await executarTestesPythonGeradosTemporario(arquivosPy);
  assert.equal(execucaoPy.status, 0, execucaoPy.stderr || execucaoPy.stdout);
});
