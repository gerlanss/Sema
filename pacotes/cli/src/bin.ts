#!/usr/bin/env node
// SEMA-GOVERNED: sema.produto.cli_invocacao_publica, sema.produto.cli_invocacao_publica.resultados, sema.produto.cli_invocacao_publica.handlers, sema.produto.distribuicao_global
// Descrição: bootstrap executável puro; ajuda e versão encerram antes do runtime operacional.

import pacoteCli from "../package.json" with { type: "json" };
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ehCliControlError } from "./cliControlError.js";
import { validarSintaxeInvocacaoPublica } from "./cliGrammar.js";
import { detectarHelpAntesDispatch } from "./cliHelp.js";
import { criarAjudaRaiz } from "./cliHelpTexto.js";
import { criarAjudaPipelineConteudo } from "./pipelineConteudo/help.js";
import {
  CODIGO_SAIDA_FATAL_RUNTIME_CLI,
  criarEnvelopeControleJsonV1,
  emitirResultadoCliJsonV1,
  executarInvocacaoPublica,
  type TipoControleCli,
} from "./saidaCli.js";

const FLAGS_VERSAO = new Set(["--versao", "--version", "-v"]);
const CAMINHO_RUNTIME_CLI = fileURLToPath(new URL("./cliRuntime.js", import.meta.url));
const LIMITE_BUFFER_RUNTIME_JSON = 16 * 1024 * 1024;

interface ExecucaoRuntimeJsonCapturada {
  readonly codigoSaida: number;
  readonly stdout: string;
}

function executarRuntimeJsonCapturado(
  argv: readonly string[],
): ExecucaoRuntimeJsonCapturada | null {
  const execucao = spawnSync(process.execPath, [CAMINHO_RUNTIME_CLI, ...argv], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    maxBuffer: LIMITE_BUFFER_RUNTIME_JSON,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  if (
    execucao.error
    || execucao.signal !== null
    || execucao.status === null
    || execucao.status === CODIGO_SAIDA_FATAL_RUNTIME_CLI
  ) {
    return null;
  }

  return {
    codigoSaida: execucao.status,
    stdout: execucao.stdout ?? "",
  };
}

function mensagemAjudaPublica(argv: readonly string[]): string {
  if (argv[0] === "conteudo") {
    const ajudaConteudo = criarAjudaPipelineConteudo();
    if (typeof ajudaConteudo.mensagem === "string") {
      return ajudaConteudo.mensagem;
    }
  }
  return criarAjudaRaiz(pacoteCli.version);
}

function emitirAjuda(argv: readonly string[], modoJson: boolean): number {
  const mensagemTexto = mensagemAjudaPublica(argv);
  const relatorio = executarInvocacaoPublica({
    resultado: "HELP",
    modoJson,
    mensagemTexto,
    envelopeControle: modoJson
      ? criarEnvelopeControleJsonV1({
          categoria: "HELP",
          codigoPublico: "CLI_HELP",
          mensagemPublica: argv[0] === "conteudo" ? mensagemTexto : "Sema CLI help",
          codigoSaida: 0,
        })
      : undefined,
  });
  return relatorio.codigoSaida;
}

function emitirFalhaControle(
  argv: readonly string[],
  categoria: TipoControleCli,
  codigoPublico: string,
  mensagemPublica: string,
  codigoSaida: number,
): number {
  const modoJson = argv.includes("--json");
  const relatorio = executarInvocacaoPublica({
    resultado: categoria,
    modoJson,
    mensagemTexto: mensagemPublica,
    envelopeControle: modoJson
      ? criarEnvelopeControleJsonV1({
          categoria,
          codigoPublico,
          mensagemPublica,
          codigoSaida,
        })
      : undefined,
  });
  if (!modoJson && categoria === "UNKNOWN_COMMAND") {
    console.log(criarAjudaRaiz(pacoteCli.version));
  }
  return relatorio.codigoSaida;
}

/**
 * Única entrada executável pública. O import do runtime ocorre somente depois
 * de ajuda, argv vazio e versão encerrarem sem resolver handlers.
 */
export async function executarCliPublica(
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> {
  if (argv.length === 0) {
    return emitirAjuda(argv, false);
  }

  const deteccaoHelp = detectarHelpAntesDispatch(argv);
  if (deteccaoHelp.ajudaSolicitada) {
    return emitirAjuda(argv, deteccaoHelp.modoJson);
  }

  if (FLAGS_VERSAO.has(argv[0]!)) {
    console.log(pacoteCli.version);
    return 0;
  }

  try {
    const sintaxe = validarSintaxeInvocacaoPublica(argv);
    if (!sintaxe.dispatchPermitido) return 0;

    if (argv.includes("--json")) {
      const execucao = executarRuntimeJsonCapturado(argv);
      if (!execucao) {
        return emitirFalhaControle(
          argv,
          "FATAL_ERROR",
          "CLI_FATAL_ERROR",
          "Falha ao executar a CLI da Sema.",
          1,
        );
      }
      if (execucao.stdout.trim().startsWith("{") && execucao.stdout.includes("sema.cli.control/v1")) {
        console.log(execucao.stdout);
        return execucao.codigoSaida;
      }
      return emitirResultadoCliJsonV1({
        comando: sintaxe.comando,
        codigoSaida: execucao.codigoSaida,
        stdout: execucao.stdout,
      }).exitCode;
    }

    const { principal } = await import("./index.part08.js");
    return await principal();
  } catch (erro) {
    if (ehCliControlError(erro)) {
      return emitirFalhaControle(
        argv,
        erro.categoria,
        erro.codigoPublico,
        erro.mensagemPublica,
        erro.codigoSaida,
      );
    }
    return emitirFalhaControle(
      argv,
      "FATAL_ERROR",
      "CLI_FATAL_ERROR",
      "Falha ao executar a CLI da Sema.",
      1,
    );
  }
}

void executarCliPublica().then(
  (codigoSaida) => {
    process.exitCode = codigoSaida;
  },
  () => {
    console.error("Falha ao executar a CLI da Sema.");
    process.exitCode = 1;
  },
);
