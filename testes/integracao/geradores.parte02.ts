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

test("gerador Python emite tipos compostos validos para lista, mapa, opcional e uniao", async () => {
  const codigo = `
module exemplo.geracao.python_composto {
  entity Usuario {
    fields {
      id: Id
      nome: Texto
    }
  }

  task montar_payload {
    input {
      exemplos: Lista<Texto> optional
      metadata: Mapa<Texto, Decimal> optional
      dono: Opcional<Usuario>
      variacao: Texto | Inteiro
    }
    output {
      ok: Booleano
    }
    guarantees {
      ok existe
    }
    tests {
      caso "ok" {
        given {
          variacao: "a"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "python_composto.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosPy = gerarPython(resultado.ir!);
  const arquivoPy = arquivosPy.find((arquivo) => arquivo.caminhoRelativo === "exemplo_geracao_python_composto.py");
  assert.ok(arquivoPy);
  assert.match(arquivoPy.conteudo, /exemplos: list\[str\] \| None = None/);
  assert.match(arquivoPy.conteudo, /metadata: dict\[str, float\] \| None = None/);
  assert.match(arquivoPy.conteudo, /dono: Usuario \| None = None/);
  assert.match(arquivoPy.conteudo, /variacao: str \| int \| None = None/);
  assert.doesNotMatch(arquivoPy.conteudo, /class Lista<Texto>/);
  assert.doesNotMatch(arquivoPy.conteudo, /class Mapa<Texto, Decimal>/);

  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-gerador-python-composto-"));
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

test("gerador TypeScript emite tipos compostos validos para arrays, mapa, opcional e aliases externos", async () => {
  const codigoCompartilhado = `
module base.compartilhado {
  type PedidoResumo {
    fields {
      id: Id required
      status: Texto
    }
  }
}
`;

  const codigo = `
module exemplo.geracao.typescript_composto {
  use base.compartilhado

  type UsuarioRef {
    fields {
      id: Id required
      nome: Texto
    }
  }

  type PromocaoItem {
    fields {
      sku: Texto required
      quantidade: Inteiro required
    }
  }

  task montar_payload {
    input {
      titulos: Lista<Texto> optional
      codigos: Texto[] optional
      metadata: Mapa<Texto, Decimal> optional
      dono: Opcional<UsuarioRef>
      itens: PromocaoItem[] required
      externos: PedidoResumo[] optional
      variacao: Texto | Inteiro
    }
    output {
      ok: Booleano
    }
    guarantees {
      ok existe
    }
    tests {
      caso "ok" {
        given {
          itens: "sku-1"
          variacao: 1
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const projeto = compilarProjeto([
    { caminho: "base_compartilhado.sema", codigo: codigoCompartilhado },
    { caminho: "typescript_composto.sema", codigo },
  ]);
  const resultado = projeto.modulos.find((modulo) => modulo.caminho === "typescript_composto.sema");
  assert.ok(resultado);
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivoTs = arquivosTs.find((arquivo) => arquivo.caminhoRelativo === "exemplo_geracao_typescript_composto.ts");
  assert.ok(arquivoTs);
  assert.match(arquivoTs.conteudo, /titulos\?: string\[\];/);
  assert.match(arquivoTs.conteudo, /codigos\?: string\[\];/);
  assert.match(arquivoTs.conteudo, /metadata\?: Record<string, number>;/);
  assert.match(arquivoTs.conteudo, /dono\?: UsuarioRef \| null;/);
  assert.match(arquivoTs.conteudo, /itens: PromocaoItem\[\];/);
  assert.match(arquivoTs.conteudo, /externos\?: PedidoResumo\[\];/);
  assert.match(arquivoTs.conteudo, /variacao\?: string \| number;/);
  assert.match(arquivoTs.conteudo, /export type PedidoResumo = any;/);
  assert.doesNotMatch(arquivoTs.conteudo, /export type Texto\[\] = any;/);
  assert.doesNotMatch(arquivoTs.conteudo, /export type PromocaoItem\[\] = any;/);
  assert.doesNotMatch(arquivoTs.conteudo, /export type Lista<Texto> = any;/);
  assert.doesNotMatch(arquivoTs.conteudo, /export type Mapa<Texto, Decimal> = any;/);
  assert.doesNotMatch(arquivoTs.conteudo, /export type Opcional<UsuarioRef> = any;/);

  const compilacao = await compilarTypeScriptEstritoTemporario(arquivosTs);
  assert.equal(compilacao.status, 0, compilacao.stderr || compilacao.stdout);
});

test("gerador Python aceita sintaxe [] sem inventar classes invalidas", async () => {
  const codigo = `
module exemplo.geracao.python_array {
  type PromocaoItem {
    fields {
      sku: Texto required
    }
  }

  task listar {
    input {
      termo: Texto
    }
    output {
      itens: PromocaoItem[]
      rotulos: Texto[]
    }
    guarantees {
      itens existe
    }
    tests {
      caso "ok" {
        given { termo: "tv" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "python_array.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosPy = gerarPython(resultado.ir!);
  const arquivoPy = arquivosPy.find((arquivo) => arquivo.caminhoRelativo === "exemplo_geracao_python_array.py");
  assert.ok(arquivoPy);
  assert.match(arquivoPy.conteudo, /itens: list\[PromocaoItem\] \| None = None/);
  assert.match(arquivoPy.conteudo, /rotulos: list\[str\] \| None = None/);
  assert.doesNotMatch(arquivoPy.conteudo, /class PromocaoItem\[\]/);
  assert.doesNotMatch(arquivoPy.conteudo, /class Texto\[\]/);

  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-gerador-python-array-"));
  try {
    for (const arquivo of arquivosPy) {
      const caminhoArquivo = path.join(baseTemporaria, arquivo.caminhoRelativo);
      await mkdir(path.dirname(caminhoArquivo), { recursive: true });
      await writeFile(caminhoArquivo, arquivo.conteudo, "utf8");
    }

    const compilacao = spawnSync("python", ["-m", "py_compile", path.join(baseTemporaria, "exemplo_geracao_python_array.py")], {
      stdio: "pipe",
      encoding: "utf8",
    });
    assert.equal(compilacao.status, 0, compilacao.stderr || compilacao.stdout);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("gerador Python inicializa referencia de saida usada por garantia aninhada", async () => {
  const codigo = `
module exemplo.geracao.python_referencia_saida {
  entity Assinatura {
    fields {
      periodo_inicio: Data
      periodo_fim: Data
    }
  }

  entity Saldo {
    fields {
      periodo_inicio: Data
      periodo_fim: Data
    }
  }

  task criar_saldo {
    input {
      id: Id required
    }
    output {
      assinatura: Assinatura
      saldo: Saldo
      ok: Booleano
    }
    guarantees {
      saldo.periodo_inicio == assinatura.periodo_inicio
      saldo.periodo_fim == assinatura.periodo_fim
      ok == verdadeiro
    }
    tests {
      caso "ok" {
        given { id: "assinatura-1" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "python_referencia_saida.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosPy = gerarPython(resultado.ir!);
  const arquivoPy = arquivosPy.find((arquivo) => arquivo.caminhoRelativo === "exemplo_geracao_python_referencia_saida.py");
  assert.ok(arquivoPy);
  assert.match(arquivoPy.conteudo, /getattr\(saida\.assinatura, "periodo_inicio", None\)/);
  assert.match(arquivoPy.conteudo, /saida\.saldo\.periodo_inicio = saida\.assinatura\.periodo_inicio/);

  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-gerador-python-ref-saida-"));
  try {
    const caminhoArquivo = path.join(baseTemporaria, arquivoPy.caminhoRelativo);
    await mkdir(path.dirname(caminhoArquivo), { recursive: true });
    await writeFile(caminhoArquivo, arquivoPy.conteudo, "utf8");

    const execucao = spawnSync(
      "python",
      [
        "-c",
        `import sys; sys.path.insert(0, ${JSON.stringify(baseTemporaria)}); from exemplo_geracao_python_referencia_saida import criar_saldoEntrada, executar_criar_saldo; executar_criar_saldo(criar_saldoEntrada(id="assinatura-1"))`,
      ],
      { stdio: "pipe", encoding: "utf8" },
    );
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});
