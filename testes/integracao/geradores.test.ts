import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { compilarCodigo, compilarProjeto, temErros } from "../../pacotes/nucleo/dist/index.js";
import { gerarDart } from "../../pacotes/gerador-dart/dist/index.js";
import { gerarTypeScript } from "../../pacotes/gerador-typescript/dist/index.js";
import { gerarPython } from "../../pacotes/gerador-python/dist/index.js";

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
        include: ["src/**/*.ts", "test/**/*.ts", "globals.d.ts"],
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

test("geradores produzem artefatos para o exemplo de calculadora", async () => {
  const caminho = path.resolve("exemplos/calculadora.sema");
  const codigo = await readFile(caminho, "utf8");
  const resultado = compilarCodigo(codigo, caminho);

  assert.equal(temErros(resultado.diagnosticos), false);
  assert.ok(resultado.ir);

  const arquivosTs = gerarTypeScript(resultado.ir!);
  const arquivosPy = gerarPython(resultado.ir!);
  const arquivosDart = gerarDart(resultado.ir!);

  assert.ok(arquivosTs.some((arquivo) => arquivo.caminhoRelativo.endsWith(".ts")));
  assert.ok(arquivosPy.some((arquivo) => arquivo.caminhoRelativo.endsWith(".py")));
  assert.ok(arquivosDart.some((arquivo) => arquivo.caminhoRelativo.endsWith(".dart")));
  assert.ok(arquivosTs[0]?.conteudo.includes("executar_somar"));
  assert.ok(arquivosPy[0]?.conteudo.includes("def executar_somar"));
  assert.ok(arquivosDart[0]?.conteudo.includes("Arquivo gerado automaticamente pela Sema"));
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
  assert.ok(arquivosTs[0]?.conteudo.includes('origem: "ts", caminho: "app.gateway.pagamentos.processar"'));
  assert.ok(arquivosPy[0]?.conteudo.includes("Implementacao externa vinculada: origem=py caminho=servicos.pagamentos.processar"));
  assert.ok(arquivosPy[0]?.conteudo.includes('"impl": ['));
  assert.ok(arquivosDart[0]?.conteudo.includes("impl=ts:app.gateway.pagamentos.processar, py:servicos.pagamentos.processar, dart:app.mobile.pagamentos.processar"));
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

test("cli verifica todos os exemplos em lote", () => {
  const execucao = spawnSync(
    "node",
    ["pacotes/cli/dist/index.js", "verificar", "exemplos", "--saida", "./.tmp/verificacao-integracao"],
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
    "node",
    ["pacotes/cli/dist/index.js", "compilar", path.join(pastaProjeto, "app.sema"), "--alvo", "typescript", "--saida", pastaSaida],
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
    "node",
    [
      "pacotes/cli/dist/index.js",
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
