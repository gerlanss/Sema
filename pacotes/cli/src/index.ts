#!/usr/bin/env node
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  compilarCodigo,
  compilarProjeto,
  formatarCodigo,
  formatarDiagnosticos,
  lerArquivoTexto,
  listarArquivosSema,
  temErros,
  type IrModulo,
  type ResultadoCompilacaoProjetoModulo,
} from "@sema/nucleo";
import { gerarPython } from "@sema/gerador-python";
import { gerarTypeScript } from "@sema/gerador-typescript";

type Comando =
  | "iniciar"
  | "validar"
  | "ast"
  | "ir"
  | "compilar"
  | "gerar"
  | "testar"
  | "diagnosticos"
  | "verificar"
  | "formatar";

interface ResultadoExecucaoTestes {
  codigoSaida: number;
  quantidadeTestes: number;
}

interface ResumoAlvoVerificacao {
  alvo: "typescript" | "python";
  arquivosGerados: number;
  quantidadeTestes: number;
  pastaSaida: string;
  sucesso: boolean;
}

interface ResumoModuloVerificacao {
  modulo: string;
  arquivoFonte: string;
  alvos: ResumoAlvoVerificacao[];
}

interface SaidaTesteCapturada {
  codigoSaida: number;
  quantidadeTestes: number;
  saidaPadrao: string;
  saidaErro: string;
}

interface ResultadoFormatacaoArquivo {
  caminho: string;
  alterado: boolean;
  sucesso: boolean;
  diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
}

function obterArgumentos(): { comando?: Comando; resto: string[] } {
  const [, , comando, ...resto] = process.argv;
  return { comando: comando as Comando | undefined, resto };
}

function ajuda(): string {
  return `Sema CLI

Comandos:
  sema iniciar
  sema validar <arquivo-ou-pasta>
  sema ast <arquivo.sema>
  sema ir <arquivo.sema>
  sema compilar <arquivo-ou-pasta> --alvo <python|typescript> --saida <diretorio>
  sema gerar <python|typescript> <arquivo-ou-pasta> --saida <diretorio>
  sema testar <arquivo.sema> --alvo <python|typescript> --saida <diretorio-temporario>
  sema diagnosticos <arquivo.sema> [--json]
  sema verificar <arquivo-ou-pasta> [--saida <diretorio-base>] [--json]
  sema formatar <arquivo-ou-pasta> [--check] [--json]
`;
}

async function carregarModulos(entrada: string): Promise<Array<{ caminho: string; codigo: string; resultado: ReturnType<typeof compilarCodigo> }>> {
  const entradaResolvida = path.resolve(entrada);
  const estatisticas = await stat(entradaResolvida);
  const baseProjeto = estatisticas.isFile() ? path.dirname(entradaResolvida) : entradaResolvida;
  const arquivosProjeto = await listarArquivosSema(baseProjeto);
  const arquivosSelecionados = estatisticas.isFile() ? new Set([entradaResolvida]) : new Set(arquivosProjeto.map((arquivo) => path.resolve(arquivo)));

  const fontes = [];
  for (const arquivo of arquivosProjeto) {
    const codigo = await lerArquivoTexto(arquivo);
    fontes.push({ caminho: arquivo, codigo });
  }

  const resultadoProjeto = compilarProjeto(fontes);
  const resultados = new Map<string, ResultadoCompilacaoProjetoModulo>(
    resultadoProjeto.modulos.map((modulo) => [path.resolve(modulo.caminho), modulo]),
  );

  return fontes
    .filter((fonte) => arquivosSelecionados.has(path.resolve(fonte.caminho)))
    .map((fonte) => ({
      caminho: fonte.caminho,
      codigo: fonte.codigo,
      resultado: resultados.get(path.resolve(fonte.caminho)) ?? compilarCodigo(fonte.codigo, fonte.caminho),
    }));
}

async function escreverArquivos(base: string, arquivos: Array<{ caminhoRelativo: string; conteudo: string }>): Promise<void> {
  await mkdir(base, { recursive: true });
  for (const arquivo of arquivos) {
    const destino = path.join(base, arquivo.caminhoRelativo);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, arquivo.conteudo, "utf8");
  }
}

function obterOpcao(args: string[], nome: string, padrao?: string): string | undefined {
  const indice = args.findIndex((arg) => arg === nome);
  if (indice === -1) {
    return padrao;
  }
  return args[indice + 1] ?? padrao;
}

function possuiFlag(args: string[], nome: string): boolean {
  return args.includes(nome);
}

function garantirIr(resultado: ReturnType<typeof compilarCodigo>, caminho: string): IrModulo {
  if (!resultado.ir) {
    throw new Error(`Nao foi possivel gerar IR para ${caminho}.\n${formatarDiagnosticos(resultado.diagnosticos)}`);
  }
  return resultado.ir;
}

function gerarArquivosPorAlvo(ir: IrModulo, alvo: string) {
  return alvo === "python" ? gerarPython(ir) : gerarTypeScript(ir);
}

function contarCasosDeTesteGerados(alvo: string, arquivos: Array<{ caminhoRelativo: string; conteudo: string }>): number {
  if (alvo === "typescript") {
    const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".test.ts"));
    if (!arquivoTeste) {
      return 0;
    }
    return (arquivoTeste.conteudo.match(/\btest\(/g) ?? []).length;
  }

  const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.startsWith("test_"));
  if (!arquivoTeste) {
    return 0;
  }
  return (arquivoTeste.conteudo.match(/\bdef test_/g) ?? []).length;
}

function executarTestesGerados(
  alvo: string,
  baseSaida: string,
  arquivos: Array<{ caminhoRelativo: string; conteudo: string }>,
  silencioso = false,
): SaidaTesteCapturada {
  const quantidadeTestes = contarCasosDeTesteGerados(alvo, arquivos);
  if (quantidadeTestes === 0) {
    if (!silencioso) {
      console.log(`Nenhum teste ${alvo === "typescript" ? "TypeScript" : "Python"} foi gerado.`);
    }
    return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
  }

  if (alvo === "typescript") {
    const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.endsWith(".test.ts"))?.caminhoRelativo;
    if (!arquivoTeste) {
      if (!silencioso) {
        console.log("Nenhum teste TypeScript foi gerado.");
      }
      return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
    }
    const execucao = spawnSync("node", ["--import", "tsx", path.join(baseSaida, arquivoTeste)], {
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

  const arquivoTeste = arquivos.find((item) => item.caminhoRelativo.startsWith("test_"))?.caminhoRelativo;
  if (!arquivoTeste) {
    if (!silencioso) {
      console.log("Nenhum teste Python foi gerado.");
    }
    return { codigoSaida: 0, quantidadeTestes, saidaPadrao: "", saidaErro: "" };
  }
  const execucao = spawnSync("pytest", [arquivoTeste], {
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

function nomeSubpastaModulo(caminhoArquivo: string): string {
  return path.basename(caminhoArquivo, ".sema");
}

async function comandoIniciar(cwd: string): Promise<number> {
  const arquivos = [
    { caminhoRelativo: "sema.config.json", conteudo: '{\n  "origem": "./exemplos",\n  "saida": "./saida",\n  "alvos": ["typescript", "python"],\n  "modoEstrito": true\n}\n' },
    { caminhoRelativo: "exemplos/exemplo_minimo.sema", conteudo: 'module exemplo.minimo {\n  task eco {\n    input {\n      mensagem: Texto required\n    }\n    output {\n      mensagem: Texto\n    }\n    guarantees {\n      mensagem existe\n    }\n    tests {\n      caso "eco simples" {\n        given {\n          mensagem: "oi"\n        }\n        expect {\n          sucesso: verdadeiro\n        }\n      }\n    }\n  }\n}\n' },
  ];
  await escreverArquivos(cwd, arquivos);
  console.log("Projeto Sema inicializado.");
  return 0;
}

async function comandoValidar(entrada: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  console.log(formatarDiagnosticos(diagnosticos));
  return temErros(diagnosticos) ? 1 : 0;
}

async function comandoValidarJson(entrada: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const resultados = modulos.map((item) => ({
    caminho: item.caminho,
    modulo: item.resultado.modulo?.nome ?? null,
    sucesso: !temErros(item.resultado.diagnosticos),
    diagnosticos: item.resultado.diagnosticos,
  }));
  console.log(JSON.stringify({
    comando: "validar",
    sucesso: resultados.every((resultado) => resultado.sucesso),
    resultados,
  }, null, 2));
  return resultados.every((resultado) => resultado.sucesso) ? 0 : 1;
}

async function comandoAst(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify(resultado.modulo ?? null, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoAstJson(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify({
    comando: "ast",
    caminho: path.resolve(arquivo),
    modulo: resultado.modulo?.nome ?? null,
    sucesso: !temErros(resultado.diagnosticos),
    diagnosticos: resultado.diagnosticos,
    ast: resultado.modulo ?? null,
  }, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoIr(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify(resultado.ir ?? null, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoIrJson(arquivo: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  console.log(JSON.stringify({
    comando: "ir",
    caminho: path.resolve(arquivo),
    modulo: resultado.modulo?.nome ?? null,
    sucesso: !temErros(resultado.diagnosticos),
    diagnosticos: resultado.diagnosticos,
    ir: resultado.ir ?? null,
  }, null, 2));
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoCompilar(entrada: string, alvo: string, saida: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  if (temErros(diagnosticos)) {
    console.error(formatarDiagnosticos(diagnosticos));
    return 1;
  }

  for (const modulo of modulos) {
    const ir = garantirIr(modulo.resultado, modulo.caminho);
    const arquivos = gerarArquivosPorAlvo(ir, alvo);
    await escreverArquivos(saida, arquivos);
  }
  console.log(`Compilacao concluida para o alvo ${alvo}.`);
  return 0;
}

async function comandoDiagnosticos(arquivo: string, emJson: boolean): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  if (emJson) {
    console.log(JSON.stringify(resultado.diagnosticos, null, 2));
  } else {
    console.log(formatarDiagnosticos(resultado.diagnosticos));
  }
  return temErros(resultado.diagnosticos) ? 1 : 0;
}

async function comandoFormatar(entrada: string, verificarApenas: boolean, emJson: boolean): Promise<number> {
  const entradaResolvida = path.resolve(entrada);
  const estatisticas = await stat(entradaResolvida);
  const arquivos = estatisticas.isFile() ? [entradaResolvida] : await listarArquivosSema(entradaResolvida);
  const resultados: ResultadoFormatacaoArquivo[] = [];

  for (const arquivo of arquivos) {
    const codigo = await lerArquivoTexto(arquivo);
    const resultado = formatarCodigo(codigo, arquivo);
    const sucesso = !temErros(resultado.diagnosticos) && Boolean(resultado.codigoFormatado);
    resultados.push({
      caminho: arquivo,
      alterado: resultado.alterado,
      sucesso,
      diagnosticos: resultado.diagnosticos,
    });

    if (sucesso && !verificarApenas && resultado.alterado && resultado.codigoFormatado) {
      await writeFile(arquivo, resultado.codigoFormatado, "utf8");
    }
  }

  const possuiErros = resultados.some((resultado) => !resultado.sucesso);
  const possuiDiferencas = resultados.some((resultado) => resultado.alterado);
  const codigoSaida = possuiErros ? 1 : verificarApenas && possuiDiferencas ? 1 : 0;

  if (emJson) {
    console.log(JSON.stringify({
      comando: "formatar",
      sucesso: codigoSaida === 0,
      modo: verificarApenas ? "check" : "write",
      arquivos: resultados,
      totais: {
        arquivos: resultados.length,
        alterados: resultados.filter((resultado) => resultado.alterado).length,
        erros: resultados.filter((resultado) => !resultado.sucesso).length,
      },
    }, null, 2));
    return codigoSaida;
  }

  if (possuiErros) {
    console.error(formatarDiagnosticos(resultados.flatMap((resultado) => resultado.diagnosticos)));
    return 1;
  }

  if (verificarApenas) {
    if (possuiDiferencas) {
      console.error("Arquivos fora do formato canonico:");
      for (const resultado of resultados.filter((item) => item.alterado)) {
        console.error(`- ${resultado.caminho}`);
      }
      return 1;
    }
    console.log("Todos os arquivos ja estao no formato canonico.");
    return 0;
  }

  console.log(`Formatacao concluida. Arquivos verificados=${resultados.length} alterados=${resultados.filter((resultado) => resultado.alterado).length}`);
  return 0;
}

async function comandoTestar(arquivo: string, alvo: string, saida: string): Promise<number> {
  const codigo = await lerArquivoTexto(arquivo);
  const resultado = compilarCodigo(codigo, arquivo);
  if (temErros(resultado.diagnosticos)) {
    console.error(formatarDiagnosticos(resultado.diagnosticos));
    return 1;
  }
  const ir = garantirIr(resultado, arquivo);
  const arquivos = gerarArquivosPorAlvo(ir, alvo);
  await escreverArquivos(saida, arquivos);
  return executarTestesGerados(alvo, saida, arquivos).codigoSaida;
}

function imprimirResumoVerificacao(resumos: ResumoModuloVerificacao[]): void {
  console.log("\nResumo da verificacao:");
  let totalArquivos = 0;
  let totalTestes = 0;
  let totalAlvos = 0;

  for (const resumo of resumos) {
    console.log(`- Modulo ${resumo.modulo} (${resumo.arquivoFonte})`);
    for (const alvo of resumo.alvos) {
      totalArquivos += alvo.arquivosGerados;
      totalTestes += alvo.quantidadeTestes;
      totalAlvos += 1;
      console.log(
        `  alvo=${alvo.alvo} status=${alvo.sucesso ? "ok" : "falhou"} arquivos=${alvo.arquivosGerados} testes=${alvo.quantidadeTestes} saida=${alvo.pastaSaida}`,
      );
    }
  }

  console.log(`Totais: modulos=${resumos.length} alvos=${totalAlvos} arquivos=${totalArquivos} testes=${totalTestes}`);
}

async function comandoVerificar(entrada: string, baseSaida: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  if (temErros(diagnosticos)) {
    console.error(formatarDiagnosticos(diagnosticos));
    return 1;
  }

  const alvos = ["typescript", "python"] as const;
  const resumos: ResumoModuloVerificacao[] = [];
  for (const modulo of modulos) {
    const ir = garantirIr(modulo.resultado, modulo.caminho);
    console.log(`Verificando modulo ${modulo.caminho}`);
    const resumoModulo: ResumoModuloVerificacao = {
      modulo: ir.nome,
      arquivoFonte: modulo.caminho,
      alvos: [],
    };
    for (const alvo of alvos) {
      const pastaAlvo = path.join(baseSaida, alvo, nomeSubpastaModulo(modulo.caminho));
      const arquivos = gerarArquivosPorAlvo(ir, alvo);
      await escreverArquivos(pastaAlvo, arquivos);
      const execucao = executarTestesGerados(alvo, pastaAlvo, arquivos);
      resumoModulo.alvos.push({
        alvo,
        arquivosGerados: arquivos.length,
        quantidadeTestes: execucao.quantidadeTestes,
        pastaSaida: pastaAlvo,
        sucesso: execucao.codigoSaida === 0,
      });
      if (execucao.codigoSaida !== 0) {
        imprimirResumoVerificacao([...resumos, resumoModulo]);
        console.error(`Falha na verificacao do modulo ${modulo.caminho} para o alvo ${alvo}.`);
        return execucao.codigoSaida;
      }
    }
    resumos.push(resumoModulo);
  }

  imprimirResumoVerificacao(resumos);
  console.log("Verificacao completa concluida com sucesso.");
  return 0;
}

async function comandoVerificarJson(entrada: string, baseSaida: string): Promise<number> {
  const modulos = await carregarModulos(entrada);
  const diagnosticos = modulos.flatMap((item) => item.resultado.diagnosticos);
  if (temErros(diagnosticos)) {
    console.log(JSON.stringify({
      comando: "verificar",
      sucesso: false,
      diagnosticos,
      modulos: [],
      totais: { modulos: 0, alvos: 0, arquivos: 0, testes: 0 },
    }, null, 2));
    return 1;
  }

  const alvos = ["typescript", "python"] as const;
  const resumos: Array<ResumoModuloVerificacao & { saidaTestes?: Array<{ alvo: string; stdout: string; stderr: string }> }> = [];
  let codigoSaida = 0;

  for (const modulo of modulos) {
    const ir = garantirIr(modulo.resultado, modulo.caminho);
    const resumoModulo: ResumoModuloVerificacao & { saidaTestes: Array<{ alvo: string; stdout: string; stderr: string }> } = {
      modulo: ir.nome,
      arquivoFonte: modulo.caminho,
      alvos: [],
      saidaTestes: [],
    };

    for (const alvo of alvos) {
      const pastaAlvo = path.join(baseSaida, alvo, nomeSubpastaModulo(modulo.caminho));
      const arquivos = gerarArquivosPorAlvo(ir, alvo);
      await escreverArquivos(pastaAlvo, arquivos);
      const execucao = executarTestesGerados(alvo, pastaAlvo, arquivos, true);
      resumoModulo.alvos.push({
        alvo,
        arquivosGerados: arquivos.length,
        quantidadeTestes: execucao.quantidadeTestes,
        pastaSaida: pastaAlvo,
        sucesso: execucao.codigoSaida === 0,
      });
      resumoModulo.saidaTestes.push({ alvo, stdout: execucao.saidaPadrao, stderr: execucao.saidaErro });
      if (execucao.codigoSaida !== 0) {
        codigoSaida = execucao.codigoSaida;
      }
    }

    resumos.push(resumoModulo);
  }

  const totais = {
    modulos: resumos.length,
    alvos: resumos.reduce((total, resumo) => total + resumo.alvos.length, 0),
    arquivos: resumos.reduce((total, resumo) => total + resumo.alvos.reduce((subTotal, alvo) => subTotal + alvo.arquivosGerados, 0), 0),
    testes: resumos.reduce((total, resumo) => total + resumo.alvos.reduce((subTotal, alvo) => subTotal + alvo.quantidadeTestes, 0), 0),
  };

  console.log(JSON.stringify({
    comando: "verificar",
    sucesso: codigoSaida === 0,
    modulos: resumos,
    totais,
  }, null, 2));

  return codigoSaida;
}

async function principal(): Promise<void> {
  const { comando, resto } = obterArgumentos();
  if (!comando) {
    console.log(ajuda());
    process.exit(0);
  }

  const cwd = process.cwd();
  let codigoSaida = 0;
  switch (comando) {
    case "iniciar":
      codigoSaida = await comandoIniciar(cwd);
      break;
    case "validar":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoValidarJson(resto[0] ?? "exemplos")
        : await comandoValidar(resto[0] ?? "exemplos");
      break;
    case "ast":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoAstJson(resto[0] ?? "")
        : await comandoAst(resto[0] ?? "");
      break;
    case "ir":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoIrJson(resto[0] ?? "")
        : await comandoIr(resto[0] ?? "");
      break;
    case "compilar":
      codigoSaida = await comandoCompilar(
        resto[0] ?? "exemplos",
        obterOpcao(resto, "--alvo", "typescript") ?? "typescript",
        obterOpcao(resto, "--saida", "./saida") ?? "./saida",
      );
      break;
    case "gerar":
      codigoSaida = await comandoCompilar(
        resto[1] ?? "exemplos",
        resto[0] ?? "typescript",
        obterOpcao(resto, "--saida", "./saida") ?? "./saida",
      );
      break;
    case "diagnosticos":
      codigoSaida = await comandoDiagnosticos(resto[0] ?? "", resto.includes("--json"));
      break;
    case "testar":
      codigoSaida = await comandoTestar(
        resto[0] ?? "",
        obterOpcao(resto, "--alvo", "typescript") ?? "typescript",
        obterOpcao(resto, "--saida", "./.tmp/sema-testes") ?? "./.tmp/sema-testes",
      );
      break;
    case "verificar":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoVerificarJson(
          resto[0] ?? "exemplos",
          obterOpcao(resto, "--saida", "./.tmp/sema-verificar") ?? "./.tmp/sema-verificar",
        )
        : await comandoVerificar(
          resto[0] ?? "exemplos",
          obterOpcao(resto, "--saida", "./.tmp/sema-verificar") ?? "./.tmp/sema-verificar",
        );
      break;
    case "formatar":
      codigoSaida = await comandoFormatar(
        resto[0] ?? "exemplos",
        possuiFlag(resto, "--check"),
        possuiFlag(resto, "--json"),
      );
      break;
    default:
      console.log(ajuda());
      codigoSaida = 1;
      break;
  }

  process.exit(codigoSaida);
}

principal().catch((erro) => {
  console.error("Falha ao executar a CLI da Sema.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
