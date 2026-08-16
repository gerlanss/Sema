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

test("geradores carregam invariantes de entity e type para codigo gerado", () => {
  const codigo = `
module exemplo.operacao {
  enum StatusGate {
    ABERTO,
    FECHADO
  }

  type Janela {
    fields {
      semana: Data
      strategy_id: Id
    }
    invariants {
      semana existe
      strategy_id existe
    }
  }

  entity Slice {
    fields {
      id: Id
      gate: StatusGate
    }
    invariants {
      id existe
      gate em [ABERTO, FECHADO]
    }
  }

  task registrar {
    input {
      id: Id required
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
          id: "s1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`;

  const resultado = compilarCodigo(codigo, "operacao.sema");
  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivoTs = arquivosTs.find((arquivo) => arquivo.caminhoRelativo === "exemplo_operacao.ts");
  assert.ok(arquivoTs);
  assert.match(arquivoTs.conteudo, /Invariante: semana existe/);
  assert.match(arquivoTs.conteudo, /Invariante: gate em \[\s*ABERTO\s*,\s*FECHADO\s*\]/);

  const arquivosPy = gerarPython(resultado.ir!);
  const arquivoPy = arquivosPy.find((arquivo) => arquivo.caminhoRelativo === "exemplo_operacao.py");
  assert.ok(arquivoPy);
  assert.match(arquivoPy.conteudo, /Invariante: strategy_id existe/);
  assert.match(arquivoPy.conteudo, /Invariante: id existe/);
});

test("cli verifica o projeto inteiro em lote", () => {
  const execucao = spawnSync(
    process.execPath,
    ["pacotes/cli/dist/bin.js", "verificar", ".", "--saida", "./.tmp/verificacao-integracao"],
    { stdio: "pipe", encoding: "utf8" },
  );

  assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
  assert.match(execucao.stdout, /Resumo da verificacao:/);
  assert.match(execucao.stdout, /Totais: modulos=\d+ alvos=\d+ arquivos=\d+ testes=\d+/);
  assert.match(execucao.stdout, /Verificacao completa concluida com sucesso\./);
});

test("cli compila arquivo com use usando modulos vizinhos como contexto do projeto", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-use-"));
  const pastaProjeto = path.join(baseTemporaria, "projeto");
  const pastaSaida = path.join(baseTemporaria, "saida");
  await mkdir(pastaProjeto, { recursive: true });
  await writeFile(
    path.join(pastaProjeto, "base.sema"),
    `module base.tipos {
  entity Usuario {
    fields {
      id: Id
      nome: Texto
    }
  }

  task buscar_usuario {
    input {
      id: Id required
    }
    output {
      usuario: Usuario
    }
    guarantees {
      usuario existe
    }
    tests {
      caso "busca" {
        given {
          id: "1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`,
    "utf8",
  );
  await writeFile(
    path.join(pastaProjeto, "app.sema"),
    `module app.cadastro {
  use base.tipos

  task registrar_acesso {
    input {
      usuario: Usuario required
    }
    output {
      protocolo: Id
    }
    guarantees {
      protocolo existe
    }
    tests {
      caso "registra" {
        given {
          usuario: "u-1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  flow consulta {
    task: buscar_usuario
    task: registrar_acesso
  }
}
`,
    "utf8",
  );

  const execucao = spawnSync(
    process.execPath,
    ["pacotes/cli/dist/bin.js", "compilar", path.join(pastaProjeto, "app.sema"), "--alvo", "typescript", "--saida", pastaSaida],
    { stdio: "pipe", encoding: "utf8" },
  );

  try {
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    assert.match(execucao.stdout, /Compilacao concluida para o alvo typescript com estrutura flat e framework base\./);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli compila com estrutura por modulos quando solicitado", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-estrutura-"));
  const pastaSaida = path.join(baseTemporaria, "generated");

  const execucao = spawnSync(
    process.execPath,
    [
      "pacotes/cli/dist/bin.js",
      "compilar",
      "exemplos/calculadora.sema",
      "--alvo",
      "typescript",
      "--saida",
      pastaSaida,
      "--estrutura",
      "modulos",
    ],
    { stdio: "pipe", encoding: "utf8" },
  );

  try {
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
    assert.match(execucao.stdout, /estrutura modulos/);
    const caminhoCodigo = path.join(pastaSaida, "exemplos", "calculadora.ts");
    const caminhoTeste = path.join(pastaSaida, "exemplos", "calculadora.test.ts");
    const codigo = await readFile(caminhoCodigo, "utf8");
    const testes = await readFile(caminhoTeste, "utf8");
    assert.match(codigo, /executar_somar/);
    assert.match(testes, /\.\/calculadora\.ts/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("cli compila geradores web como alvos publicos", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-web-targets-"));
  const alvos = [
    { alvo: "javascript", arquivos: ["exemplos/calculadora.js", "exemplos/calculadora.test.js"] },
    { alvo: "html", arquivos: ["exemplos/calculadora.html"] },
    { alvo: "css", arquivos: ["exemplos/calculadora.css"] },
    { alvo: "php", arquivos: ["exemplos/calculadora.php", "exemplos/test_calculadora.php"] },
  ];

  try {
    for (const item of alvos) {
      const pastaSaida = path.join(baseTemporaria, item.alvo);
      const execucao = spawnSync(
        process.execPath,
        [
          "pacotes/cli/dist/bin.js",
          "compilar",
          "exemplos/calculadora.sema",
          "--alvo",
          item.alvo,
          "--saida",
          pastaSaida,
          "--estrutura",
          "modulos",
        ],
        { stdio: "pipe", encoding: "utf8" },
      );

      assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);
      assert.match(execucao.stdout, new RegExp(`alvo ${item.alvo}`));
      for (const arquivo of item.arquivos) {
        const conteudo = await readFile(path.join(pastaSaida, arquivo), "utf8");
        assert.match(conteudo, /SEMA-GOVERNED/);
      }
    }
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("geradores produzem scaffold backend para NestJS", async () => {
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
  const arquivos = gerarTypeScript(resultado.ir!, { framework: "nestjs" });

  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "src/exemplos/pagamento.contract.ts"));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "src/exemplos/dto/pagamento.dto.ts"));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "src/exemplos/pagamento.service.ts"));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "src/exemplos/pagamento.controller.ts"));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "test/exemplos/pagamento.controller.spec.ts"));
  assert.ok(arquivos.find((arquivo) => arquivo.caminhoRelativo.endsWith("pagamento.service.ts"))?.conteudo.includes("@Injectable()"));
  assert.ok(arquivos.find((arquivo) => arquivo.caminhoRelativo.endsWith("pagamento.controller.ts"))?.conteudo.includes("@Controller()"));
  assert.ok(arquivos.find((arquivo) => arquivo.caminhoRelativo.endsWith("pagamento.dto.ts"))?.conteudo.includes("export class ProcessarPagamentoPublicoEntradaPublicaDto"));
  assert.ok(!arquivos.find((arquivo) => arquivo.caminhoRelativo.endsWith("pagamento.dto.ts"))?.conteudo.includes(".contract.contract"));
});

test("scaffold NestJS gerado compila em modo strict com stubs minimos do framework", async () => {
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
  const arquivos = gerarTypeScript(resultado.ir!, { framework: "nestjs" });
  const compilacao = await compilarTypeScriptEstritoTemporario(arquivos);

  assert.equal(compilacao.status, 0, compilacao.stderr || compilacao.stdout);
});

test("geradores produzem scaffold backend para FastAPI", async () => {
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
  const arquivos = gerarPython(resultado.ir!, { framework: "fastapi" });

  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "app/exemplos/pagamento_contract.py"));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "app/exemplos/pagamento_schemas.py"));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "app/exemplos/pagamento_service.py"));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "app/exemplos/pagamento_router.py"));
  assert.ok(arquivos.some((arquivo) => arquivo.caminhoRelativo === "tests/exemplos/test_pagamento_router.py"));
  assert.ok(arquivos.find((arquivo) => arquivo.caminhoRelativo.endsWith("pagamento_router.py"))?.conteudo.includes("APIRouter"));
  assert.ok(arquivos.find((arquivo) => arquivo.caminhoRelativo.endsWith("pagamento_schemas.py"))?.conteudo.includes("BaseModel"));
});
