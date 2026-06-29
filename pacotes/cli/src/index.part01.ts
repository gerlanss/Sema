// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import pacoteCli from "../package.json" with { type: "json" };
import { compilarCodigo, formatarCodigo, formatarDiagnosticos, gerarRespostaValidacao, lerArquivoTexto, temErros, type IrModulo } from "@sema/nucleo";
import { descreverEstruturaModulo, type AlvoGeracao, type FrameworkGeracao } from "@sema/padroes";
import { gerarDart } from "@sema/gerador-dart";
import { gerarLua } from "@sema/gerador-lua";
import { gerarPython } from "@sema/gerador-python";
import { gerarTypeScript } from "@sema/gerador-typescript";
import { gerarJavaScript } from "@sema/gerador-javascript";
import { gerarHtml } from "@sema/gerador-html";
import { gerarCss } from "@sema/gerador-css";
import { carregarConfiguracaoProjeto, carregarProjeto, resolverAlvoPadrao, resolverAlvosVerificacao, resolverEstruturaSaidaPadrao, resolverFrameworkPadrao, resolverSaidaPadrao, type ContextoProjetoCarregado } from "./projeto.js";
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
import * as billing from "./billing/index.js";
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
  sincronizarEntryPointsAgentes,
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
import { avaliarPreflightVerificacao, comandoDoctor, imprimirPreflightVerificacao } from './doctorCommand.js';
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
import { criarBriefingAgente, resumirDriftPorModulo } from "./index.part03.js";
export type Comando =
  | "iniciar"
  | "init"
  | "dev"
  | "sync"
  | "author"
  | "profile"
  | "validar"
  | "ast"
  | "ir"
  | "compilar"
  | "gerar"
  | "testar"
  | "diagnosticos"
  | "verificar"
  | "inspecionar"
  | "drift"
  | "impacto"
  | "renomear-semantico"
  | "importar"
  | "doctor"
  | "formatar"
  | "ajuda-ia"
  | "starter-ia"
  | "sync-ai-entrypoints"
  | "instalar-exemplos"
  | "preflight"
  | "rule-packs"
  | "docs-impacto"
  | "finalizar-mudanca"
  | "resumo"
  | "prompt-curto"
  | "prompt-ia"
  | "prompt-ia-ui"
  | "prompt-ia-react"
  | "prompt-ia-sema-primeiro"
  | "exemplos-prompt-ia"
  | "contexto-ia";
export interface ResultadoFormatacaoArquivo {
  caminho: string;
  alterado: boolean;
  sucesso: boolean;
  diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
}
export interface ContextoIaGerado {
  sucesso: boolean;
  arquivo: string;
  modulo: string;
  pastaSaida: string;
  artefatos: string[];
  artefatosCompactos: string[];
  geradoEm: string;
  guiaPorCapacidade: GuiaCapacidadeIaMap;
}
export interface DescobertaDocsIa {
  origemInstalacao: string;
  baseDetectada: string | null;
  documentos: Array<{ nome: string; caminho: string }>;
}
export type TamanhoResumoIa = "micro" | "curto" | "medio";
export type ModoResumoIa = "resumo" | "onboarding" | "review" | "mudanca" | "bug" | "arquitetura";
export type ResultadoDriftIa = Awaited<ReturnType<typeof analisarDriftLegado>>;
export type ResumoModuloDrift = ReturnType<typeof resumirDriftPorModulo>;
export interface PacoteContextoModuloIa {
  arquivo: string;
  modulo: string;
  sucesso: boolean;
  geradoEm: string;
  diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
  ir: IrModulo | null;
  validar: {
    comando: "validar";
    sucesso: boolean;
    resultados: Array<{
      caminho: string;
      modulo: string | null;
      sucesso: boolean;
      diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
    }>;
  };
  diagnosticosJson: {
    comando: "diagnosticos";
    caminho: string;
    modulo: string | null;
    diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
  };
  ast: {
    comando: "ast";
    caminho: string;
    modulo: string | null;
    sucesso: boolean;
    diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
    ast: unknown;
  };
  irJson: {
    comando: "ir";
    caminho: string;
    modulo: string | null;
    sucesso: boolean;
    diagnosticos: ReturnType<typeof compilarCodigo>["diagnosticos"];
    ir: IrModulo | null;
  };
  drift: {
    comando: "drift";
    caminho: string;
    modulo: string | null;
    sucesso: boolean;
    resumo: ResumoModuloDrift;
    drift: ResultadoDriftIa;
  };
  briefing: ReturnType<typeof criarBriefingAgente>;
}
export interface ResumoSemanticoModuloIa {
  geradoEm: string;
  arquivo: string;
  modulo: string;
  modoVerificacaoCodigo: "codigo_completo" | "codigo_selecionado" | "contratos_apenas";
  avisoVerificacaoCodigo: string | null;
  fontesConclusao: string[];
  perfilCompatibilidade: string;
  scoreSemantico: number;
  confiancaGeral: string;
  riscoOperacional: string;
  faz: string;
  tarefasPrincipais: string[];
  entradasChave: string[];
  saidasChave: string[];
  superficiesPublicas: string[];
  regrasCriticas: string[];
  efeitos: string[];
  erros: string[];
  entidadesAfetadas: string[];
  arquivosProvaveis: string[];
  simbolosRelacionados: string[];
  riscosPrincipais: string[];
  lacunas: string[];
  inferido: string[];
  checksSugeridos: string[];
  testesMinimos: string[];
  consumerFramework: string | null;
  appRoutes: string[];
  consumerSurfaces: string[];
  consumerBridges: string[];
  ancoragensVinculo: string[];
  arquivosProvaveisEditar: string[];
}
export const DIRETORIO_CLI_ATUAL = path.dirname(fileURLToPath(import.meta.url));
export const VERSAO_CLI = pacoteCli.version;
export function obterArgumentos(): { comando?: Comando; resto: string[] } {
  const [, , comando, ...resto] = process.argv;
  return { comando: comando as Comando | undefined, resto };
}
export function renderizarCaixaAscii(linhas: string[]): string {
  const largura = Math.max(...linhas.map((linha) => linha.length), 12);
  const borda = `+${"-".repeat(largura + 2)}+`;
  return [
    borda,
    ...linhas.map((linha) => `| ${linha.padEnd(largura, " ")} |`),
    borda,
  ].join("\n");
}
export function renderizarSecaoAscii(titulo: string, linhas: string[]): string {
  return [
    titulo,
    ...linhas.map((linha) => `  ${linha}`),
  ].join("\n");
}
export function ajuda(): string {
  return [
    renderizarCaixaAscii([
      `Sema CLI v${VERSAO_CLI}`,
      "IA-first para contrato, geração e adoção incremental",
      "novo projeto, edição guiada e legado sem contrato inicial",
    ]),
    "",
    renderizarSecaoAscii("Fluxos rápidos", [
      "[1] Projeto novo / produção inicial",
      "sema iniciar --template <base|nestjs|fastapi|nextjs-api|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer>",
      "sema validar contratos/<modulo>.sema --json",
      "sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart|lua|javascript|html|css> --saida <diretorio>",
      "sema verificar <arquivo-ou-pasta> --json",
      "",
      "[2] Editar projeto que já usa Sema",
      "sema inspecionar . --json",
      "sema resumo <arquivo-ou-pasta> --micro --para mudanca",
      "sema drift <arquivo-ou-pasta> --escopo modulo --json",
      "sema impacto <arquivo-ou-pasta> --alvo <token> --mudanca <descricao> --json",
      "sema docs-impacto --intencao \"fazer deploy\" --criar-ausentes --json",
      "sema contexto-ia <arquivo.sema> --saida ./.tmp/contexto --json",
      "",
      "[3] Governar escrita autoral com Sema Author",
      "sema author iniciar [--tema-sensivel] [--saida contratos/author.sema]",
      "sema author validar contratos/author.sema --json",
      "sema author briefing contratos/author.sema --json",
      "sema author revisar-cliches contratos/author.sema --texto <texto> --json  # reprova se houver bloqueio",
      "sema author validar-narrativa contratos/author.sema --texto <texto> --texto-anterior <texto> --json",
      "sema author validar-proibicoes contratos/author.sema --texto <texto> --json",
      "",
      "[4] Validar profiles semânticos",
      "sema profile validar workflow contratos/sema/workflow_ops.sema --maturidade production --preset webhook --artefato-arquivo workflow.md --json",
      "sema profile validar ops contratos/sema/workflow_ops.sema --maturidade critical --preset deploy --artefato-arquivo runbook.md --json",
      "sema profile validar game contratos/sema/game.sema --maturidade prototype --preset playtest --artefato-arquivo playtest.md --json",
      "sema profile validar redacao contratos/sema/redator.sema --maturidade production --preset seo --artefato-arquivo materia.md --json",
      "sema profile validar propostas contratos/sema/propostas_comerciais.sema --maturidade production --preset score90 --artefato-arquivo proposta.md --json",
      "sema profile validar conversas contratos/sema/conversas.sema --maturidade production --preset vendas --artefato-arquivo conversa.md --json",
      "sema profile capabilities --json",
      "sema rule-packs --profile legal --json",
      "",
      "[5] Adotar Sema em projeto que ainda não usa",
      "sema importar <fonte> <diretorio> --saida <diretorio> --json",
      "sema formatar <arquivo-ou-pasta>",
      "sema validar <arquivo-ou-pasta> --json",
      "sema drift <arquivo-ou-pasta> --escopo modulo --json",
    ]),
    "",
    renderizarSecaoAscii("IA por capacidade", [
      "fraca: sema resumo --micro + briefing.min.json + prompt-curto.txt",
      "média: sema resumo --curto + drift.json + briefing.min.json",
      "forte: sema contexto-ia + briefing.json + ir.json + ast.json",
    ]),
    "",
    renderizarSecaoAscii("Comandos principais", [
      "descoberta: sema inspecionar [arquivo-ou-pasta] [--json]",
      "auditoria: sema drift <arquivo-ou-pasta> [--escopo <arquivo|modulo|projeto>] [--incluir-worktrees] [--incluir-consumidores-laterais] [--json]",
      "impacto: sema impacto <arquivo-ou-pasta> --alvo <token> [--mudanca <descricao>] [--escopo <arquivo|modulo|projeto>] [--json]",
      "renomeação: sema renomear-semantico <arquivo-ou-pasta> --de <nome-atual> --para <nome-novo> [--escopo <arquivo|modulo|projeto>] [--json]",
      "importação: sema importar <nestjs|fastapi|flask|nextjs|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer|firebase|dotnet|java|go|rust|cpp|typescript|python|dart> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]",
      "validação: sema validar <arquivo-ou-pasta> [--json]",
      "diagnóstico: sema diagnosticos <arquivo.sema> [--json]",
      "geração: sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart|lua|javascript|html|css> --saida <diretorio> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]",
      "teste local: sema testar <arquivo.sema> --alvo <typescript|python|dart|lua|javascript|html|css> --saida <diretorio-temporario> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]",
      "verificação final: sema verificar <arquivo-ou-pasta> [--saida <diretorio-base>] [--json]",
      "formatação: sema formatar <arquivo-ou-pasta> [--check] [--json]",
      "author: sema author <iniciar|validar|briefing|revisar-cliches|validar-narrativa|validar-proibicoes> [arquivo] [--tema-sensivel] [--preset conto|romance|roteiro|lore|campanha] [--saida <arquivo>] [--texto <texto>] [--json]",
      "profile: sema profile validar <software|workflow|ops|game|legal|research|redacao|propostas|conversas> <arquivo-ou-pasta> [--maturidade draft|prototype|production|critical] [--preset <preset>] [--artefato <texto>|--artefato-arquivo <arquivo>] [--json]",
      "capabilities: sema profile capabilities [--json]",
      "rule packs: sema rule-packs [--profile <author|software|workflow|ops|game|legal|research|redacao|propostas|conversas>] [--json]",
    ]),
    "",
    renderizarSecaoAscii("Ajuda IA-first", [
      "sema ajuda-ia",
      "sema starter-ia",
      "sema resumo <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>] [--saida <diretorio>] [--raiz] [--json]",
      "sema prompt-curto <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>] [--json]",
      "sema prompt-ia",
      "sema prompt-ia-ui",
      "sema prompt-ia-react",
      "sema prompt-ia-sema-primeiro",
      "sema exemplos-prompt-ia",
      "sema contexto-ia <arquivo.sema> [--saida <diretorio>] [--json]",
      "sema sync-ai-entrypoints [--json]",
      "sema instalar-exemplos [--json]",
      "sema preflight [comando] [--operation-code <codigo>] [--json]",
      "sema docs-impacto --intencao <acao> [--arquivo <caminho>] [--criar-ausentes] [--json]",
      "sema finalizar-mudanca --intencao <acao> [--arquivo <caminho>] [--doc-lida <caminho>] [--json]",
      "sema author briefing <arquivo.sema> [--json]",
      "sema author revisar-cliches <arquivo.sema> [--texto <texto>|--texto-arquivo <arquivo>] [--texto-anterior <texto>|--texto-anterior-arquivo <arquivo>] [--json]",
      "sema author validar-narrativa <arquivo.sema> [--texto <texto>|--texto-arquivo <arquivo>] [--json]",
      "sema author validar-proibicoes <arquivo.sema> [--texto <texto>|--texto-arquivo <arquivo>] [--json]",
      "sema profile validar <profile> <arquivo.sema> [--maturidade draft|prototype|production|critical] [--preset <preset>] [--artefato <texto>|--artefato-arquivo <arquivo>] [--json]",
      "sema profile capabilities [--json]",
      "sema rule-packs [--profile <profile>] [--json]",
    ]),
    "",
    renderizarSecaoAscii("Operacional", [
      "sema doctor",
      "sema --versao | --version | -v",
    ]),
  ].join("\n");
}
export function resolverOpcoesDriftCli(args: string[]): OpcoesDriftLegado {
  const escopo = obterOpcao(args, "--escopo");
  return {
    escopo: escopo === "arquivo" || escopo === "modulo" || escopo === "projeto" ? escopo : undefined,
    ignorarWorktrees: !possuiFlag(args, "--incluir-worktrees"),
    ignorarConsumidoresLaterais: !possuiFlag(args, "--incluir-consumidores-laterais"),
  };
}
export function normalizarTamanhoResumo(args: string[]): TamanhoResumoIa {
  const escolhas = [
    possuiFlag(args, "--micro") ? "micro" : null,
    possuiFlag(args, "--curto") ? "curto" : null,
    possuiFlag(args, "--medio") ? "medio" : null,
  ].filter((item): item is TamanhoResumoIa => item !== null);
  if (escolhas.length > 1) {
    throw new Error("Use apenas uma entre as flags --micro, --curto ou --medio.");
  }
  return escolhas[0] ?? "curto";
}
export function normalizarModoResumo(valor?: string): ModoResumoIa {
  if (
    valor === "resumo"
    || valor === "onboarding"
    || valor === "review"
    || valor === "mudanca"
    || valor === "bug"
    || valor === "arquitetura"
  ) {
    return valor;
  }
  return "resumo";
}
export async function descobrirDocsIa(): Promise<DescobertaDocsIa> {
  const candidatosBase = [];
  let atual = DIRETORIO_CLI_ATUAL;
  for (let tentativas = 0; tentativas < 8; tentativas += 1) {
    candidatosBase.push(atual);
    const proximo = path.dirname(atual);
    if (proximo === atual) {
      break;
    }
    atual = proximo;
  }
  const nomesDocs = [
    "AGENT_STARTER.md",
    "como-ensinar-a-sema-para-ia.md",
    "prompt-base-ia-sema.md",
    "fluxo-pratico-ia-sema.md",
    "persistencia-vendor-first.md",
  ];
  for (const base of candidatosBase) {
    const documentos = [];
    let encontrouTodos = true;
    for (const nome of nomesDocs) {
      const caminhoDoc = path.join(base, "docs", nome);
      if (!(await caminhoExiste(caminhoDoc))) {
        encontrouTodos = false;
        break;
      }
      documentos.push({ nome, caminho: caminhoDoc });
    }
    if (encontrouTodos) {
      return {
        origemInstalacao: DIRETORIO_CLI_ATUAL,
        baseDetectada: base,
        documentos,
      };
    }
  }
  return {
    origemInstalacao: DIRETORIO_CLI_ATUAL,
    baseDetectada: null,
    documentos: [],
  };
}
export function renderizarCabecalhoDocsIa(descoberta: DescobertaDocsIa): string {
  const documentos = descoberta.documentos.map((documento) => `\`${documento.nome}\``);
  const linhas = [
    "Modo IA-first da instalacao atual",
    "- Use `sema` como interface publica principal.",
    "- A Sema entra em projeto novo, projeto ja semantizado e adocao incremental em legado sem contrato inicial.",
    "- Nao assuma monorepo, `node pacotes/cli/dist/index.js`, `npm run project:check` ou uma pasta `exemplos` externa ao projeto atual.",
    "- Se a IA tiver contexto curto, comece por `sema resumo` e `sema prompt-curto`.",
    "- Se a IA aguentar mais contexto, suba para `sema drift --json` e `sema contexto-ia`.",
    "- So leia `ast.json` e `ir.json` completos quando a capacidade da IA realmente aguentar esse volume.",
  ];
  if (documentos.length > 0) {
    linhas.push(`- Documentos locais empacotados: ${documentos.join(", ")}.`);
  } else {
    linhas.push("- Documentos locais empacotados: nenhum extra detectado. Siga a CLI, o contrato atual e os artefatos JSON.");
  }
  return linhas.join("\n");
}
export function normalizarIdentificadorResumo(valor: string): string {
  return valor.replace(/[._]/g, " ").replace(/\s+/g, " ").trim();
}
export function resumirCamposTask(
  task: { nome: string; input?: Array<{ nome: string }>; output?: Array<{ nome: string }> },
  campo: "input" | "output",
  limiteCampos: number,
): string {
  const campos = (task[campo] ?? []).map((item) => item.nome).slice(0, limiteCampos);
  if (campos.length === 0) {
    return `${task.nome}(-)`;
  }
  return `${task.nome}(${campos.join(", ")})`;
}
export function formatarEfeitoSemanticoResumido(
  efeito: { categoria: string; alvo: string; criticidade?: string; detalhe?: string; textoOriginal?: string },
): string {
  if (efeito.textoOriginal) {
    return efeito.textoOriginal;
  }
  const partes = [`${efeito.categoria} ${efeito.alvo}`];
  if (efeito.criticidade) {
    partes.push(`criticidade=${efeito.criticidade}`);
  }
  if (efeito.detalhe) {
    partes.push(efeito.detalhe);
  }
  return partes.join(" ");
}
export function calcularRiscoOperacionalResumo(resumoDrift: ResumoModuloDrift): string {
  if (resumoDrift.tasks.some((task) => task.riscoOperacional === "alto")) {
    return "alto";
  }
  if (resumoDrift.tasks.some((task) => task.riscoOperacional === "medio")) {
    return "medio";
  }
  return "baixo";
}
