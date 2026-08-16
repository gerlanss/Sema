// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.governanca_ia.drift.cache.modos
// Descrição: expõe e valida os modos públicos de análise de drift da CLI.
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
import { criarAjudaRaiz, renderizarCaixaAscii, renderizarSecaoAscii } from './cliHelpTexto.js';
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
import { criarBriefingAgente, criarBriefingAgenteContratos, resumirDriftPorModulo } from "./index.part03.js";
import {
  resolverModoCacheComandoDrift,
  resolverModoCacheConsultaDrift,
  type ComandoConsultaDrift,
  type ModoCacheDrift,
  type ResolucaoModoCacheDrift,
} from "./driftCacheModes.js";
export type Comando =
  | "iniciar"
  | "init"
  | "dev"
  | "sync"
  | "author"
  | "profile"
  | "conteudo"
  | "interativo"
  | "descobrir"
  | "pipeline"
  | "capabilities"
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
  | "sync-codex"
  | "skill"
  | "instalar-exemplos"
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
    modo: ModoCacheDrift;
    executada: boolean;
    sucesso: boolean | null;
    aviso: string | null;
    resumo: ResumoModuloDrift | null;
    drift: ResultadoDriftIa | null;
  };
  briefing: ReturnType<typeof criarBriefingAgente> | ReturnType<typeof criarBriefingAgenteContratos>;
}
export interface ResumoSemanticoModuloIa {
  geradoEm: string;
  arquivo: string;
  modulo: string;
  modoVerificacaoCodigo: "codigo_completo" | "codigo_selecionado" | "contratos_apenas";
  avisoVerificacaoCodigo: string | null;
  fontesConclusao: string[];
  perfilCompatibilidade: string;
  scoreSemantico: number | null;
  confiancaGeral: string | null;
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
  appRoutes: string[] | null;
  consumerSurfaces: string[] | null;
  consumerBridges: string[] | null;
  ancoragensVinculo: string[] | null;
  arquivosProvaveisEditar: string[];
}
export const DIRETORIO_CLI_ATUAL = path.dirname(fileURLToPath(import.meta.url));
export const VERSAO_CLI = pacoteCli.version;
export { renderizarCaixaAscii, renderizarSecaoAscii };
export function obterArgumentos(): { comando?: Comando; resto: string[] } {
  const [, , comando, ...resto] = process.argv;
  return { comando: comando as Comando | undefined, resto };
}
export function ajuda(): string {
  return criarAjudaRaiz(VERSAO_CLI);
}
function criarOpcoesDriftCli(
  args: string[],
  resolucao: ResolucaoModoCacheDrift,
): OpcoesDriftLegado {
  const escopo = obterOpcao(args, "--escopo");
  return {
    escopo: escopo === "arquivo" || escopo === "modulo" || escopo === "projeto" ? escopo : undefined,
    ignorarWorktrees: !possuiFlag(args, "--incluir-worktrees"),
    ignorarConsumidoresLaterais: !possuiFlag(args, "--incluir-consumidores-laterais"),
    modoCache: resolucao.modo,
    avisosModoCache: resolucao.avisos,
  };
}
export function resolverOpcoesDriftCli(args: string[]): OpcoesDriftLegado {
  return criarOpcoesDriftCli(args, resolverModoCacheComandoDrift(args));
}
export function resolverAnaliseDriftConsultaCli(
  args: string[],
  comando: ComandoConsultaDrift,
): ResolucaoModoCacheDrift & { opcoes: OpcoesDriftLegado } {
  const resolucao = resolverModoCacheConsultaDrift(args, comando);
  return {
    ...resolucao,
    opcoes: criarOpcoesDriftCli(args, resolucao),
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
    "- Nao assuma monorepo, `node pacotes/cli/dist/bin.js`, `npm run project:check` ou uma pasta `exemplos` externa ao projeto atual.",
    "- Se a IA tiver contexto curto, comece por `sema resumo --drift none` e `sema prompt-curto`; implementação e score ficam não avaliados.",
    "- Se a IA aguentar mais contexto e precisar de evidência viva, suba para `sema drift --cache fresh --json` e `sema contexto-ia`.",
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
