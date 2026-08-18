// SEMA-GOVERNED: sema.produto.geradores_nativos
// Descricao: normaliza geracao, escrita estruturada e execucao de testes gerados por alvo.

import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { compilarCodigo, formatarDiagnosticos, type IrModulo } from "@sema/nucleo";
import { descreverEstruturaModulo, type AlvoGeracao, type FrameworkGeracao } from "@sema/padroes";
import { gerarDart } from "@sema/gerador-dart";
import { gerarLua } from "@sema/gerador-lua";
import { gerarPython } from "@sema/gerador-python";
import { gerarTypeScript } from "@sema/gerador-typescript";
import { gerarJavaScript } from "@sema/gerador-javascript";
import { gerarHtml } from "@sema/gerador-html";
import { gerarCss } from "@sema/gerador-css";
import { gerarPhp } from "@sema/gerador-php";
import { gerarDotNet } from "@sema/gerador-dotnet";
import { gerarCpp } from "@sema/gerador-cpp";
import type { FonteImportacao } from "./importador.js";
import type { EstruturaSaida } from "./tipos.js";
import type { TemplateIniciar } from "./initTemplatesBase.js";
import { comandoDisponivel, resolverExecucaoPytest, TSX_EXECUTOR_CLI } from "./execucoesExternas.js";
import { compilarCpp, executarBinarioNativo, resolverToolchainCpp } from "./nativeToolchains.js";
import {
  carregarConfiguracaoProjeto,
  resolverEstruturaSaidaPadrao,
  resolverFrameworkPadrao,
} from "./projeto.js";

export interface ResultadoExecucaoTestes {
  codigoSaida: number;
  quantidadeTestes: number;
}

export interface ResumoAlvoVerificacao {
  alvo: AlvoGeracao;
  arquivosGerados: number;
  quantidadeTestes: number;
  pastaSaida: string;
  sucesso: boolean;
  framework: FrameworkGeracao;
  estrutura: EstruturaSaida;
  testesExecutados: boolean;
  origem?: "executado" | "cache";
}

export interface ResumoModuloVerificacao {
  modulo: string;
  arquivoFonte: string;
  alvos: ResumoAlvoVerificacao[];
}

export interface SaidaTesteCapturada {
  codigoSaida: number;
  quantidadeTestes: number;
  saidaPadrao: string;
  saidaErro: string;
}
export function validarCompatibilidadeFramework(alvo: AlvoGeracao, framework: FrameworkGeracao): string | undefined {
  if (framework === "base") {
    return undefined;
  }
  if (framework === "nestjs" && alvo !== "typescript") {
    return `Framework "${framework}" so pode ser usado com o alvo typescript.`;
  }
  if (framework === "fastapi" && alvo !== "python") {
    return `Framework "${framework}" so pode ser usado com o alvo python.`;
  }
  if (alvo === "dart" || alvo === "lua" || alvo === "javascript" || alvo === "html" || alvo === "css" || alvo === "php") {
    return `Framework "${framework}" nao e suportado para o alvo ${alvo}.`;
  }
  return undefined;
}

export function normalizarFonteImportacao(valor: string | undefined): FonteImportacao | undefined {
  if (!valor) {
    return undefined;
  }
  if (valor === "ts") {
    return "typescript";
  }
  if (valor === "py") {
    return "python";
  }
  if (valor === "nest") {
    return "nestjs";
  }
  if (valor === "api") {
    return "fastapi";
  }
  if (valor === "next") {
    return "nextjs";
  }
  if (valor === "next-consumer" || valor === "nextjs-consumer") {
    return "nextjs-consumer";
  }
  if (valor === "react-vite" || valor === "react-vite-consumer" || valor === "react-consumer") {
    return "react-vite-consumer";
  }
  if (valor === "angular" || valor === "angular-consumer") {
    return "angular-consumer";
  }
  if (valor === "flutter" || valor === "flutter-consumer") {
    return "flutter-consumer";
  }
  if (valor === "fb") {
    return "firebase";
  }
  if (valor === "csharp" || valor === "cs" || valor === "dotnet") {
    return "dotnet";
  }
  if (valor === "java") {
    return "java";
  }
  if (valor === "go" || valor === "golang") {
    return "go";
  }
  if (valor === "rust" || valor === "rs") {
    return "rust";
  }
  if (valor === "cpp" || valor === "cxx" || valor === "cc" || valor === "c++") {
    return "cpp";
  }
  if (valor === "php") {
    return "php";
  }
  if (
    valor === "nestjs"
    || valor === "express"
    || valor === "fastify"
    || valor === "koa"
    || valor === "fastapi"
    || valor === "flask"
    || valor === "nextjs"
    || valor === "nextjs-consumer"
    || valor === "react-vite-consumer"
    || valor === "angular-consumer"
    || valor === "flutter-consumer"
    || valor === "firebase"
    || valor === "dotnet"
    || valor === "java"
    || valor === "go"
    || valor === "rust"
    || valor === "cpp"
    || valor === "php"
    || valor === "typescript"
    || valor === "python"
    || valor === "dart"
  ) {
    return valor;
  }
  return undefined;
}

export function normalizarTemplateIniciar(valor?: string): TemplateIniciar {
  if (
    valor === "nestjs"
    || valor === "fastapi"
    || valor === "nextjs-api"
    || valor === "nextjs-consumer"
    || valor === "react-vite-consumer"
    || valor === "angular-consumer"
    || valor === "flutter-consumer"
    || valor === "node-firebase-worker"
    || valor === "aspnet-api"
    || valor === "springboot-api"
    || valor === "go-http-api"
    || valor === "rust-axum-api"
    || valor === "cpp-service-bridge"
  ) {
    return valor;
  }
  return "base";
}

export function garantirIr(resultado: ReturnType<typeof compilarCodigo>, caminho: string): IrModulo {
  if (!resultado.ir) {
    throw new Error(`Nao foi possivel gerar IR para ${caminho}.\n${formatarDiagnosticos(resultado.diagnosticos)}`);
  }
  return resultado.ir;
}

export function gerarArquivosPorAlvo(ir: IrModulo, alvo: AlvoGeracao, framework: FrameworkGeracao) {
  if (alvo === "python") {
    return gerarPython(ir, { framework });
  }
  if (alvo === "dart") {
    return gerarDart(ir);
  }
  if (alvo === "lua") {
    return gerarLua(ir);
  }
  if (alvo === "javascript") {
    return gerarJavaScript(ir);
  }
  if (alvo === "html") {
    return gerarHtml(ir);
  }
  if (alvo === "css") {
    return gerarCss(ir);
  }
  if (alvo === "php") {
    return gerarPhp(ir);
  }
  if (alvo === "dotnet") {
    return gerarDotNet(ir);
  }
  if (alvo === "cpp") {
    return gerarCpp(ir);
  }
  return gerarTypeScript(ir, { framework });
}

export function aplicarEstruturaSaida(
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
  ir: IrModulo,
  estrutura: EstruturaSaida,
): Array<{ caminhoRelativo: string; conteudo: string }> {
  if (estrutura === "flat" || estrutura === "backend") {
    return arquivos;
  }

  const estruturaModulo = descreverEstruturaModulo(ir.nome);
  const pastaModulo = estruturaModulo.contextoSegmentos.join(path.sep);
  const nomeArquivo = estruturaModulo.nomeArquivo;
  const nomeBaseAntigo = estruturaModulo.nomeBase;

  return arquivos.map((arquivo) => {
    const basename = path.basename(arquivo.caminhoRelativo);
    let novoBasename = basename;
    let conteudo = arquivo.conteudo;

    if (basename === `${nomeBaseAntigo}.ts`) {
      novoBasename = `${nomeArquivo}.ts`;
    } else if (basename === `${nomeBaseAntigo}.test.ts`) {
      novoBasename = `${nomeArquivo}.test.ts`;
      conteudo = conteudo.replace(`./${nomeBaseAntigo}.ts`, `./${nomeArquivo}.ts`);
    } else if (basename === `${nomeBaseAntigo}.py`) {
      novoBasename = `${nomeArquivo}.py`;
    } else if (basename === `test_${nomeBaseAntigo}.py`) {
      novoBasename = `test_${nomeArquivo}.py`;
      conteudo = conteudo.replace(`from ${nomeBaseAntigo} import *`, `from ${nomeArquivo} import *`);
    } else if (basename === `${nomeBaseAntigo}.dart`) {
      novoBasename = `${nomeArquivo}.dart`;
    } else if (basename === `${nomeBaseAntigo}.lua`) {
      novoBasename = `${nomeArquivo}.lua`;
    } else if (basename === `test_${nomeBaseAntigo}.lua`) {
      novoBasename = `test_${nomeArquivo}.lua`;
      conteudo = conteudo.replace(`${nomeBaseAntigo}.lua`, `${nomeArquivo}.lua`);
    } else if (basename === `${nomeBaseAntigo}.js`) {
      novoBasename = `${nomeArquivo}.js`;
    } else if (basename === `${nomeBaseAntigo}.test.js`) {
      novoBasename = `${nomeArquivo}.test.js`;
      conteudo = conteudo.replace(`./${nomeBaseAntigo}.js`, `./${nomeArquivo}.js`);
    } else if (basename === `${nomeBaseAntigo}.html`) {
      novoBasename = `${nomeArquivo}.html`;
    } else if (basename === `${nomeBaseAntigo}.css`) {
      novoBasename = `${nomeArquivo}.css`;
    } else if (basename === `${nomeBaseAntigo}.php`) {
      novoBasename = `${nomeArquivo}.php`;
    } else if (basename === `test_${nomeBaseAntigo}.php`) {
      novoBasename = `test_${nomeArquivo}.php`;
      conteudo = conteudo.replace(`/${nomeBaseAntigo}.php`, `/${nomeArquivo}.php`);
    }

    return {
      caminhoRelativo: pastaModulo ? path.join(pastaModulo, novoBasename) : novoBasename,
      conteudo,
    };
  });
}

export function contarCasosDeTesteGerados(alvo: AlvoGeracao, arquivos: Array<{ caminhoRelativo: string; conteudo: string }>): number {
  if (alvo === "dart" || alvo === "html" || alvo === "css") {
    return 0;
  }
  if (alvo === "php") {
    const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_") && item.caminhoRelativo.endsWith(".php"));
    if (!arquivoTeste) {
      return 0;
    }
    return (arquivoTeste.conteudo.match(/\bfunction test_/g) ?? []).length;
  }
  if (alvo === "lua") {
    const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_") && item.caminhoRelativo.endsWith(".lua"));
    if (!arquivoTeste) {
      return 0;
    }
    return (arquivoTeste.conteudo.match(/\blocal function test_/g) ?? []).length;
  }

  if (alvo === "typescript") {
    const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".test.ts"));
    if (!arquivoTeste) {
      return 0;
    }
    return (arquivoTeste.conteudo.match(/\btest\(/g) ?? []).length;
  }

  if (alvo === "javascript") {
    const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".test.js"));
    if (!arquivoTeste) {
      return 0;
    }
    return (arquivoTeste.conteudo.match(/\btest\(/g) ?? []).length;
  }

  if (alvo === "dotnet" || alvo === "cpp") {
    return arquivos.reduce((total, arquivo) => total + (arquivo.conteudo.match(/SEMA-TEST:/g) ?? []).length, 0);
  }

  const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_"));
  if (!arquivoTeste) {
    return 0;
  }
  return (arquivoTeste.conteudo.match(/\bdef test_/g) ?? []).length;
}

export function executarTestesGerados(
  alvo: AlvoGeracao,
  baseSaida: string,
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
  silencioso = false,
): SaidaTesteCapturada {
  const quantidadeTestes = contarCasosDeTesteGerados(alvo, arquivos);
  if (quantidadeTestes === 0 && (alvo === "dotnet" || alvo === "cpp")) {
    return {
      codigoSaida: 1,
      quantidadeTestes,
      saidaPadrao: "",
      saidaErro: `O alvo ${alvo} nao gerou casos SEMA-TEST; a execucao nativa foi bloqueada.`,
    };
  }
  if (quantidadeTestes === 0) {
    if (!silencioso) {
      const nomesAlvo: Record<AlvoGeracao, string> = { typescript: "TypeScript", python: "Python", lua: "Lua", dart: "Dart", javascript: "JavaScript", html: "HTML", css: "CSS", php: "PHP", dotnet: ".NET", cpp: "C++" };
      console.log(`Nenhum teste ${nomesAlvo[alvo] ?? alvo} foi gerado.`);
    }
    return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
  }

  if (alvo === "html" || alvo === "css") {
    return { codigoSaida: 0, quantidadeTestes: 0, saidaPadrao: "", saidaErro: "" };
  }

  if (alvo === "typescript") {
    const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".test.ts"))?.caminhoRelativo;
    if (!arquivoTeste) {
      if (!silencioso) {
        console.log("Nenhum teste TypeScript foi gerado.");
      }
      return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
    }
    if (!TSX_EXECUTOR_CLI) {
      return {
        codigoSaida: 1,
        quantidadeTestes,
        saidaPadrao: "",
        saidaErro: "Nao foi possivel localizar o runner tsx junto da CLI para executar testes TypeScript.",
      };
    }
    const execucao = spawnSync(process.execPath, [TSX_EXECUTOR_CLI, arquivoTeste], {
      stdio: silencioso ? "pipe" : "inherit",
      cwd: baseSaida,
      encoding: silencioso ? "utf8" : undefined,
    });
    return {
      codigoSaida: execucao.status ?? 1,
      quantidadeTestes,
      saidaPadrao: typeof execucao.stdout === "string" ? execucao.stdout : "",
      saidaErro: typeof execucao.stderr === "string" ? execucao.stderr : "",
    };
  }

  if (alvo === "javascript") {
    const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".test.js"))?.caminhoRelativo;
    if (!arquivoTeste) {
      if (!silencioso) {
        console.log("Nenhum teste JavaScript foi gerado.");
      }
      return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
    }
    const execucao = spawnSync(process.execPath, ["--test", path.join(baseSaida, arquivoTeste)], {
      stdio: silencioso ? "pipe" : "inherit",
      encoding: silencioso ? "utf8" : undefined,
    });
    return {
      codigoSaida: execucao.status ?? 1,
      quantidadeTestes,
      saidaPadrao: typeof execucao.stdout === "string" ? execucao.stdout : "",
      saidaErro: typeof execucao.stderr === "string" ? execucao.stderr : "",
    };
  }

  if (alvo === "lua") {
    const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_") && item.caminhoRelativo.endsWith(".lua"))?.caminhoRelativo;
    if (!arquivoTeste) {
      if (!silencioso) {
        console.log("Nenhum teste Lua foi gerado.");
      }
      return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
    }
    if (!comandoDisponivel("lua", ["-v"])) {
      return {
        codigoSaida: 1,
        quantidadeTestes,
        saidaPadrao: "",
        saidaErro: "Nao foi possivel localizar o runner lua para executar os testes gerados.",
      };
    }
    const execucao = spawnSync("lua", [arquivoTeste], {
      stdio: silencioso ? "pipe" : "inherit",
      cwd: baseSaida,
      encoding: silencioso ? "utf8" : undefined,
      shell: process.platform === "win32",
    });
    return {
      codigoSaida: execucao.status ?? 1,
      quantidadeTestes,
      saidaPadrao: typeof execucao.stdout === "string" ? execucao.stdout : "",
      saidaErro: typeof execucao.stderr === "string" ? execucao.stderr : "",
    };
  }

  if (alvo === "php") {
    const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_") && item.caminhoRelativo.endsWith(".php"))?.caminhoRelativo;
    if (!arquivoTeste) {
      if (!silencioso) {
        console.log("Nenhum teste PHP foi gerado.");
      }
      return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
    }
    if (!comandoDisponivel("php", ["-v"])) {
      return {
        codigoSaida: 1,
        quantidadeTestes,
        saidaPadrao: "",
        saidaErro: "Nao foi possivel localizar o runner php para executar os testes gerados.",
      };
    }
    const execucao = spawnSync("php", [arquivoTeste], {
      stdio: silencioso ? "pipe" : "inherit",
      cwd: baseSaida,
      encoding: silencioso ? "utf8" : undefined,
      shell: process.platform === "win32",
    });
    return {
      codigoSaida: execucao.status ?? 1,
      quantidadeTestes,
      saidaPadrao: typeof execucao.stdout === "string" ? execucao.stdout : "",
      saidaErro: typeof execucao.stderr === "string" ? execucao.stderr : "",
    };
  }

  if (alvo === "dotnet") {
    const projetoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".Tests.csproj"))?.caminhoRelativo;
    if (!projetoTeste) {
      return {
        codigoSaida: 1,
        quantidadeTestes,
        saidaPadrao: "",
        saidaErro: "O gerador .NET nao produziu um projeto de testes *.Tests.csproj.",
      };
    }
    if (!comandoDisponivel("dotnet")) {
      return {
        codigoSaida: 1,
        quantidadeTestes,
        saidaPadrao: "",
        saidaErro: "Nao foi possivel localizar o dotnet SDK para executar os testes C# gerados.",
      };
    }
    const execucao = spawnSync("dotnet", [
      "run",
      "--project",
      path.join(baseSaida, projetoTeste),
      "--configuration",
      "Release",
      "--nologo",
      "--property:RestoreIgnoreFailedSources=true",
    ], {
      stdio: silencioso ? "pipe" : "inherit",
      cwd: baseSaida,
      encoding: silencioso ? "utf8" : undefined,
      timeout: 120_000,
      windowsHide: true,
    });
    return {
      codigoSaida: execucao.status ?? 1,
      quantidadeTestes,
      saidaPadrao: typeof execucao.stdout === "string" ? execucao.stdout : "",
      saidaErro: typeof execucao.stderr === "string" ? execucao.stderr : execucao.error?.message ?? "",
    };
  }

  if (alvo === "cpp") {
    const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".test.cpp") || (item.caminhoRelativo.endsWith(".cpp") && item.conteudo.includes("SEMA-TEST:")));
    const fontes = arquivos
      .filter((item) => item.caminhoRelativo.endsWith(".cpp"))
      .map((item) => path.join(baseSaida, item.caminhoRelativo));
    if (!arquivoTeste || fontes.length === 0) {
      return {
        codigoSaida: 1,
        quantidadeTestes,
        saidaPadrao: "",
        saidaErro: "O gerador C++ nao produziu fontes e um arquivo *.test.cpp executavel.",
      };
    }
    const toolchain = resolverToolchainCpp();
    if (!toolchain) {
      return {
        codigoSaida: 1,
        quantidadeTestes,
        saidaPadrao: "",
        saidaErro: "Nao foi possivel localizar GCC, Clang ou MSVC para compilar os testes C++ gerados.",
      };
    }
    const diretorioTeste = path.dirname(path.join(baseSaida, arquivoTeste.caminhoRelativo));
    const executavel = path.join(diretorioTeste, process.platform === "win32" ? ".sema-cpp-tests.exe" : ".sema-cpp-tests");
    const compilacao = compilarCpp(toolchain, fontes, diretorioTeste, executavel, silencioso);
    if (compilacao.codigoSaida !== 0) {
      return { ...compilacao, quantidadeTestes };
    }
    const execucao = executarBinarioNativo(executavel, silencioso);
    return {
      codigoSaida: execucao.codigoSaida,
      quantidadeTestes,
      saidaPadrao: `${compilacao.saidaPadrao}${execucao.saidaPadrao}`,
      saidaErro: `${compilacao.saidaErro}${execucao.saidaErro}`,
    };
  }

  const arquivoTeste = arquivos.find((item) => path.basename(item.caminhoRelativo).startsWith("test_"))?.caminhoRelativo;
  if (!arquivoTeste) {
    if (!silencioso) {
      console.log("Nenhum teste Python foi gerado.");
    }
    return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
  }
  const pytest = resolverExecucaoPytest();
  if (!pytest) {
    return {
      codigoSaida: 1,
      quantidadeTestes,
      saidaPadrao: "",
      saidaErro: "Nao foi possivel localizar pytest. Instale pytest ou exponha python -m pytest.",
    };
  }
  const execucao = spawnSync(pytest.comando, [...pytest.argumentosBase, arquivoTeste], {
    stdio: silencioso ? "pipe" : "inherit",
    cwd: baseSaida,
    encoding: silencioso ? "utf8" : undefined,
    shell: process.platform === "win32" && pytest.comando === "pytest",
  });
  return {
    codigoSaida: execucao.status ?? 1,
    quantidadeTestes,
    saidaPadrao: typeof execucao.stdout === "string" ? execucao.stdout : "",
    saidaErro: typeof execucao.stderr === "string" ? execucao.stderr : "",
  };
}

export function resolverConfiguracaoVerificacaoPorAlvo(
  alvo: AlvoGeracao,
  configCarregada?: Awaited<ReturnType<typeof carregarConfiguracaoProjeto>>,
): {
  framework: FrameworkGeracao;
  estrutura: EstruturaSaida;
  incompatibilidade?: string;
} {
  const framework = resolverFrameworkPadrao(undefined, configCarregada);
  const incompatibilidade = validarCompatibilidadeFramework(alvo, framework);
  const estrutura = resolverEstruturaSaidaPadrao(undefined, framework, configCarregada);

  return {
    framework,
    estrutura,
    incompatibilidade,
  };
}

export function executarTestesParaVerificacao(
  alvo: AlvoGeracao,
  baseSaida: string,
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
  framework: FrameworkGeracao,
  silencioso = false,
): {
  execucao: SaidaTesteCapturada;
  testesExecutados: boolean;
} {
  if (framework !== "base") {
    return {
      execucao: {
        codigoSaida: 0,
        quantidadeTestes: 0,
        saidaPadrao: "",
        saidaErro: "",
      },
      testesExecutados: false,
    };
  }

  return {
    execucao: executarTestesGerados(alvo, baseSaida, arquivos, silencioso),
    testesExecutados: true,
  };
}

export function nomeSubpastaModulo(caminhoArquivo: string): string {
  return path.basename(caminhoArquivo, ".sema");
}
