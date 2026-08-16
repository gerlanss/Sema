// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.governanca_ia.drift.cache.modos, sema.produto.cli_invocacao_publica, sema.produto.cli_invocacao_publica.argumentos
// Descrição: encaminha argumentos validados para as consultas e o comando de drift.

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import pacoteCli from "../package.json" with { type: "json" };
import {
  compilarCodigo,
  formatarCodigo,
  formatarDiagnosticos,
  gerarRespostaValidacao,
  lerArquivoTexto,
  temErros,
  type IrModulo,
} from "@sema/nucleo";
import { descreverEstruturaModulo, type AlvoGeracao, type FrameworkGeracao } from "@sema/padroes";
import { gerarDart } from "@sema/gerador-dart";
import { gerarLua } from "@sema/gerador-lua";
import { gerarPython } from "@sema/gerador-python";
import { gerarTypeScript } from "@sema/gerador-typescript";
import { gerarJavaScript } from "@sema/gerador-javascript";
import { gerarHtml } from "@sema/gerador-html";
import { gerarCss } from "@sema/gerador-css";
import {
  carregarConfiguracaoProjeto,
  carregarProjeto,
  resolverAlvoPadrao,
  resolverAlvosVerificacao,
  resolverEstruturaSaidaPadrao,
  resolverFrameworkPadrao,
  resolverSaidaPadrao,
  type ContextoProjetoCarregado,
} from "./projeto.js";
import type { EstruturaSaida } from "./tipos.js";
import { importarProjetoLegado, resumoImportacao, type FonteImportacao } from "./importador.js";
import {
  analisarDriftLegado,
  assistirRenomeacaoSemantica,
  gerarMapaImpactoSemantico,
  type OpcoesDriftLegado,
} from "./drift.js";
import {
  resolverDocumentacaoObrigatoria,
  verificarDocumentacaoMudanca,
} from "./docs.js";
import {
  avaliarOrcamentoArquivo,
  LIMITE_AVISO_LINHAS_ORCAMENTO_SEMANTICO,
  LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO,
} from "./driftOrcamento.js";
import { REGISTRO_COMANDOS } from "./comandos.js";
import {
  ARQUIVO_AGENT_CONTEXT_PACK,
  ARQUIVO_DOC_AGENTES_CAPACIDADE,
  ARQUIVO_SEMA_BOOT,
  ARQUIVO_SEMA_SMALL_MODEL,
  ARQUIVOS_CANONICOS_IA_RAIZ,
  CAPACIDADES_IA_OPERACIONAIS,
  type AgentContextPack,
  type CapacidadeIa,
  type GuiaCapacidadeIaMap,
} from './agentContextTipos.js';
import { criarAgentContextPack, criarGuiaCapacidadeIa } from './agentContextPack.js';
import { criarEntradaCanonicaProjeto } from './agentContext.js';
import {
  renderizarDocumentoAgentesPorCapacidade,
  renderizarSemaBoot,
  renderizarSemaSmallModel,
  sincronizarEntrypointCodex,
} from './agentEntryPoints.js';
import { escreverArquivos, caminhoExiste } from './fsGovernado.js';
import { localizarDiretorioExemplosOficiais, materializarExemplosOficiais } from './exemplosOficiais.js';
import { comandoIniciar, comandoInstalarExemplos } from './initCommand.js';
import type { TemplateIniciar } from './initTemplatesBase.js';
import { carregarModulos } from './carregarModulos.js';
import { obterOpcao, obterOpcoesRepetidas, obterPosicionais, possuiFlag } from './cliArgs.js';
import { limitarLista, resumirListaTexto, unicosOrdenados } from './textoListas.js';
import { comandoAuthor, comandoProfile, criarPayloadRulePacks, normalizarProfileGovernanca, renderizarRulePacksTexto } from './profileAuthorCommand.js';
import { EXEMPLOS_PROMPT_IA, PROMPT_BASE_IA, PROMPT_IA_REACT, PROMPT_IA_SEMA_PRIMEIRO, PROMPT_IA_UI, STARTER_IA } from './iaPrompts.js';
import {
  comandoDisponivel,
  resolverExecucaoPytest,
  TSX_EXECUTOR_CLI,
  type ExecucaoComandoExterno,
} from './execucoesExternas.js';
import { avaliarDependenciasVerificacao, comandoDoctor, imprimirFalhaDependenciasVerificacao } from './doctorCommand.js';
import { erroArgumentoInvalido, erroComandoDesconhecido } from './cliControlError.js';
import { validarSintaxeInvocacaoPublica } from './cliGrammar.js';
import {
  aplicarEstruturaSaida,
  contarCasosDeTesteGerados,
  executarTestesGerados,
  executarTestesParaVerificacao,
  gerarArquivosPorAlvo,
  garantirIr,
  nomeSubpastaModulo,
  normalizarFonteImportacao,
  normalizarTemplateIniciar,
  resolverConfiguracaoVerificacaoPorAlvo,
  validarCompatibilidadeFramework,
  type ResultadoExecucaoTestes,
  type ResumoAlvoVerificacao,
  type ResumoModuloVerificacao,
  type SaidaTesteCapturada,
} from './geracaoCore.js';

import { obterArgumentos } from "./index.part01.js";
import { comandoDocsImpacto, comandoFinalizarMudanca, comandoValidar, comandoValidarJson } from "./index.part04.js";
import { comandoAst, comandoAstJson, comandoDrift, comandoImpacto, comandoImportar, comandoInspecionar, comandoIr, comandoIrJson, comandoRenomearSemantico } from "./index.part05.js";
import { comandoAjudaIa, comandoCompilar, comandoDiagnosticos, comandoExemplosPromptIa, comandoFormatar, comandoPromptIa, comandoPromptIaReact, comandoPromptIaSemaPrimeiro, comandoPromptIaUi, comandoResumo, comandoStarterIa, comandoSyncCodex } from "./index.part06.js";
import { comandoContextoIa, comandoPromptCurto, comandoTestar, comandoVerificar, comandoVerificarJson } from "./index.part07.js";

export async function principal(): Promise<number> {
  const argvPublico = process.argv.slice(2);
  const sintaxe = validarSintaxeInvocacaoPublica(argvPublico);
  if (!sintaxe.dispatchPermitido) return 0;

  const { comando, resto } = obterArgumentos();
  if (!comando) return 0;

  const posicionais = obterPosicionais(resto);
  const modoJson = argvPublico.includes("--json");
  const cwd = process.cwd();

  // --- Comandos registrados via REGISTRO_COMANDOS (guard, init, dev, sync) ---
  const handlerRegistrado = REGISTRO_COMANDOS[comando];
  if (handlerRegistrado) {
    return handlerRegistrado(posicionais, resto, modoJson);
  }

  let codigoSaida = 0;

  switch (comando) {
    case "iniciar":
      codigoSaida = await comandoIniciar(
        cwd,
        normalizarTemplateIniciar(obterOpcao(resto, "--template")),
        { force: possuiFlag(resto, "--force") },
      );
      break;
    case "author":
      codigoSaida = await comandoAuthor(posicionais, resto, possuiFlag(resto, "--json"));
      break;
    case "profile":
      codigoSaida = await comandoProfile(posicionais, resto, possuiFlag(resto, "--json"));
      break;
    case "rule-packs":
      {
        const profileFiltro = normalizarProfileGovernanca(obterOpcao(resto, "--profile") ?? posicionais[0]);
        const payload = criarPayloadRulePacks(profileFiltro);
        console.log(possuiFlag(resto, "--json") ? JSON.stringify(payload, null, 2) : renderizarRulePacksTexto(payload));
        codigoSaida = 0;
      }
      break;
    case "validar":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoValidarJson(posicionais[0])
        : await comandoValidar(posicionais[0]);
      break;
    case "ast":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoAstJson(posicionais[0] ?? "")
        : await comandoAst(posicionais[0] ?? "");
      break;
    case "ir":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoIrJson(posicionais[0] ?? "")
        : await comandoIr(posicionais[0] ?? "");
      break;
    case "compilar":
      {
        const config = await carregarConfiguracaoProjeto(posicionais[0] ? path.resolve(cwd, posicionais[0]) : cwd);
        const alvo = resolverAlvoPadrao(obterOpcao(resto, "--alvo"), config);
        const framework = resolverFrameworkPadrao(obterOpcao(resto, "--framework"), config);
        const estrutura = resolverEstruturaSaidaPadrao(obterOpcao(resto, "--estrutura"), framework, config);
        const saida = resolverSaidaPadrao(obterOpcao(resto, "--saida"), alvo, config);
        codigoSaida = await comandoCompilar(posicionais[0], alvo, saida, estrutura, framework, cwd);
      }
      break;
    case "gerar":
      {
        const config = await carregarConfiguracaoProjeto(posicionais[1] ? path.resolve(cwd, posicionais[1]) : cwd);
        const alvo = resolverAlvoPadrao(posicionais[0] ?? obterOpcao(resto, "--alvo"), config);
        const framework = resolverFrameworkPadrao(obterOpcao(resto, "--framework"), config);
        const estrutura = resolverEstruturaSaidaPadrao(obterOpcao(resto, "--estrutura"), framework, config);
        const saida = resolverSaidaPadrao(obterOpcao(resto, "--saida"), alvo, config);
        codigoSaida = await comandoCompilar(posicionais[1], alvo, saida, estrutura, framework, cwd);
      }
      break;
    case "diagnosticos":
      codigoSaida = await comandoDiagnosticos(posicionais[0] ?? "", resto.includes("--json"));
      break;
    case "testar":
      {
        const config = await carregarConfiguracaoProjeto(posicionais[0] ? path.resolve(cwd, posicionais[0]) : cwd);
        const alvo = resolverAlvoPadrao(obterOpcao(resto, "--alvo"), config);
        const framework = resolverFrameworkPadrao(obterOpcao(resto, "--framework"), config);
        const estrutura = resolverEstruturaSaidaPadrao(obterOpcao(resto, "--estrutura"), framework, config);
        const saida = resolverSaidaPadrao(obterOpcao(resto, "--saida", "./.tmp/sema-testes"), alvo, config);
        codigoSaida = await comandoTestar(
          path.resolve(cwd, posicionais[0] ?? ""),
          alvo,
          saida,
          estrutura,
          framework,
        );
      }
      break;
    case "verificar":
      codigoSaida = possuiFlag(resto, "--json")
        ? await comandoVerificarJson(
          posicionais[0],
          resolverSaidaPadrao(obterOpcao(resto, "--saida", "./.tmp/sema-verificar"), "typescript", await carregarConfiguracaoProjeto(posicionais[0] ? path.resolve(cwd, posicionais[0]) : cwd)),
          cwd,
        )
        : await comandoVerificar(
          posicionais[0],
          resolverSaidaPadrao(obterOpcao(resto, "--saida", "./.tmp/sema-verificar"), "typescript", await carregarConfiguracaoProjeto(posicionais[0] ? path.resolve(cwd, posicionais[0]) : cwd)),
          cwd,
        );
      break;
    case "inspecionar":
      codigoSaida = await comandoInspecionar(posicionais[0], possuiFlag(resto, "--json"), cwd, resto);
      break;
    case "drift":
      codigoSaida = await comandoDrift(posicionais[0], resto, possuiFlag(resto, "--json"), cwd);
      break;
    case "impacto":
      codigoSaida = await comandoImpacto(posicionais[0], resto, possuiFlag(resto, "--json"), cwd);
      break;
    case "renomear-semantico":
      codigoSaida = await comandoRenomearSemantico(posicionais[0], resto, possuiFlag(resto, "--json"), cwd);
      break;
    case "importar":
      {
        const fonte = normalizarFonteImportacao(posicionais[0]);
        if (!fonte || !posicionais[1]) {
          throw erroArgumentoInvalido();
        }
        codigoSaida = await comandoImportar(
          fonte,
          path.resolve(cwd, posicionais[1]),
          path.resolve(cwd, obterOpcao(resto, "--saida", "./sema/importado")!),
          obterOpcao(resto, "--namespace"),
          possuiFlag(resto, "--json"),
        );
      }
      break;
    case "formatar":
      codigoSaida = await comandoFormatar(
        posicionais[0],
        possuiFlag(resto, "--check"),
        possuiFlag(resto, "--json"),
      );
      break;
    case "doctor":
      codigoSaida = await comandoDoctor();
      break;
    case "ajuda-ia":
      codigoSaida = await comandoAjudaIa();
      break;
    case "starter-ia":
      codigoSaida = await comandoStarterIa();
      break;
    case "sync-codex":
      codigoSaida = await comandoSyncCodex(possuiFlag(resto, "--json"));
      break;
    case "instalar-exemplos":
      codigoSaida = await comandoInstalarExemplos(possuiFlag(resto, "--json"));
      break;
    case "docs-impacto":
      codigoSaida = await comandoDocsImpacto(posicionais, resto, possuiFlag(resto, "--json"));
      break;
    case "finalizar-mudanca":
      codigoSaida = await comandoFinalizarMudanca(posicionais, resto, possuiFlag(resto, "--json"));
      break;
    case "resumo":
      codigoSaida = await comandoResumo(
        posicionais[0],
        resto,
        possuiFlag(resto, "--json"),
      );
      break;
    case "prompt-curto":
      codigoSaida = await comandoPromptCurto(
        posicionais[0],
        resto,
        possuiFlag(resto, "--json"),
      );
      break;
    case "prompt-ia":
      codigoSaida = await comandoPromptIa();
      break;
    case "prompt-ia-ui":
      codigoSaida = await comandoPromptIaUi();
      break;
    case "prompt-ia-react":
      codigoSaida = await comandoPromptIaReact();
      break;
    case "prompt-ia-sema-primeiro":
      codigoSaida = await comandoPromptIaSemaPrimeiro();
      break;
    case "exemplos-prompt-ia":
      codigoSaida = await comandoExemplosPromptIa();
      break;
    case "contexto-ia":
      codigoSaida = await comandoContextoIa(
        posicionais[0] ?? "",
        obterOpcao(resto, "--saida"),
        possuiFlag(resto, "--json"),
      );
      break;
    default:
      throw erroComandoDesconhecido();
  }

  return codigoSaida;
}
