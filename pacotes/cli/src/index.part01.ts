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
      "sema iniciar --template <base|nestjs|fastapi|nextjs-api|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer> [--force]",
      "Arquivos existentes sao preservados; use --force somente para sobrescrita explicita.",
      "sema validar contratos/<modulo>.sema --json",
      "sema compilar <arquivo-ou-pasta> --alvo <typescript|python|php|dart|lua|javascript|html|css|dotnet|cpp> --saida <diretorio>",
      "sema verificar <arquivo-ou-pasta> --json",
      "",
      "[2] Editar projeto que já usa Sema",
      "sema inspecionar . [--drift <none|cache|fresh>] --json",
      "sema resumo <arquivo-ou-pasta> --micro --para mudanca [--drift <none|cache|fresh>]",
      "sema drift <arquivo-ou-pasta> --escopo modulo [--cache <none|cache|fresh>] --json",
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
      "sema profile validar simulation contratos/sema/simulation.sema --maturidade production --preset calibration --artefato-arquivo calibration.md --json",
      "sema profile validar redacao contratos/sema/redator.sema --maturidade production --preset seo --artefato-arquivo materia.md --json",
      "sema profile validar propostas contratos/sema/propostas_comerciais.sema --maturidade production --preset score90 --artefato-arquivo proposta.md --json",
      "sema profile validar conversas contratos/sema/conversas.sema --maturidade production --preset vendas --artefato-arquivo conversa.md --json",
      "sema profile capabilities --json",
      "sema rule-packs --profile legal --json",
      "",
      "[5] Descobrir a capacidade ou pipeline certo",
      "sema descobrir catalogo --json",
      "sema descobrir recomendar --intencao \"validar simulador 3D autonomo calibrado\" --json",
      "sema descobrir explicar simulation.calibrate --json",
      "sema pipeline listar --json",
      "sema capabilities --json",
      "",
      "[6] Modelar jogos e simulações em qualquer combinação espacial, visual e de render",
      "sema interativo capabilities --json",
      "sema interativo schema --json",
      "sema interativo pipelines --json",
      "sema interativo adapters --spatial-model THREE_D --render-mode VISUAL --json",
      "sema interativo validar <definition.json> --json",
      "sema interativo planejar <definition.json> --json",
      "sema interativo validar-evidencias <definition.json> [--plano-arquivo <plan.json>] --bundle-arquivo <bundle.json> --json",
      "sema interativo validar-protocolo <adapter-run.json> --json",
      "sema interativo validar-ir <experience-ir.json> --json",
      "sema interativo consultar-ir <experience-ir.json> --semantic-id <id> --json",
      "sema interativo validar-engine-snapshot <snapshot.json> --json",
      "sema interativo validar-temporal <temporal.json> --json",
      "sema interativo validar-autonomia <cycle.json> --json",
      "sema interativo validar-playtest-fuzz <plan.json> --json",
      "sema interativo validar-multiplayer <model.json> --json",
      "sema interativo analisar-portabilidade <plan.json> --json",
      "sema interativo validar-workers <plan.json> --json",
      "",
      "[7] Orquestrar criação de conteúdo por IA",
      "sema conteudo capabilities --json",
      "sema conteudo validar <definition.json> --json",
      "sema conteudo planejar <definition.json> --alvos-arquivo <targets.json> --json",
      "sema conteudo registrar <ledger.ndjson> --envelope-arquivo <envelope.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-id <id> --expected-head <sha256:...> --json",
      "sema conteudo status <definition.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-arquivo <ledger.ndjson> --expected-head <sha256:...> --json",
      "",
      "[8] Adotar Sema em projeto que ainda não usa",
      "sema importar <fonte> <diretorio> --saida <diretorio> --json",
      "sema formatar <arquivo-ou-pasta>",
      "sema validar <arquivo-ou-pasta> --json",
      "sema drift <arquivo-ou-pasta> --escopo modulo --cache fresh --json",
    ]),
    "",
    renderizarSecaoAscii("IA por capacidade", [
      "fraca: sema resumo <arquivo> --micro --drift none --json (contrato compacto; implementação não avaliada)",
      "média: sema resumo <arquivo> --curto --drift none --json + sema drift <arquivo> --cache fresh --json",
      "forte: sema contexto-ia <arquivo.sema> --saida <diretorio> --json",
    ]),
    "",
    renderizarSecaoAscii("Comandos principais", [
      "descoberta: sema inspecionar [arquivo-ou-pasta] [--drift <none|cache|fresh>] [--json] (padrão: none)",
      "catálogo: sema descobrir <catalogo|recomendar|explicar> [id] [--intencao <objetivo>] [--json]",
      "pipelines: sema pipeline <listar|descrever> [id] [--json]",
      "todas as capacidades: sema capabilities [--json]",
      "distribuição global: sema skill <status|sync> [--json] (status é somente leitura; sync repara launcher e skill)",
      "auditoria: sema drift <arquivo-ou-pasta> [--escopo <arquivo|modulo|projeto>] [--cache <none|cache|fresh>] [--incluir-worktrees] [--incluir-consumidores-laterais] [--json]",
      "modos: drift direto usa fresh por padrão; --cache none ainda executa sem cache persistente; resumo/inspecionar usam --drift none por padrão e não fabricam evidência",
      "impacto: sema impacto <arquivo-ou-pasta> --alvo <token> [--mudanca <descricao>] [--escopo <arquivo|modulo|projeto>] [--json]",
      "renomeação: sema renomear-semantico <arquivo-ou-pasta> --de <nome-atual> --para <nome-novo> [--escopo <arquivo|modulo|projeto>] [--json]",
      "importação: sema importar <nestjs|fastapi|flask|nextjs|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer|firebase|dotnet|java|go|rust|cpp|php|typescript|python|dart> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]",
      "validação: sema validar <arquivo-ou-pasta> [--json]",
      "diagnóstico: sema diagnosticos <arquivo.sema> [--json]",
      "geração: sema compilar <arquivo-ou-pasta> --alvo <typescript|python|php|dart|lua|javascript|html|css|dotnet|cpp> --saida <diretorio> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]",
      "teste local: sema testar <arquivo.sema> --alvo <typescript|python|php|dart|lua|javascript|html|css|dotnet|cpp> --saida <diretorio-temporario> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]",
      "aliases nativos: cs|csharp -> dotnet; c++|cxx|cc -> cpp (CLI e sema.config.json)",
      "verificação final: sema verificar <arquivo-ou-pasta> [--saida <diretorio-base>] [--json]",
      "formatação: sema formatar <arquivo-ou-pasta> [--check] [--json]",
      "author: sema author <iniciar|validar|briefing|revisar-cliches|validar-narrativa|validar-proibicoes> [arquivo] [--tema-sensivel] [--preset conto|romance|roteiro|lore|campanha] [--saida <arquivo>] [--texto <texto>] [--json]",
      "profile: sema profile validar <software|workflow|ops|game|simulation|legal|research|redacao|propostas|conversas> <arquivo-ou-pasta> [--maturidade draft|prototype|production|critical] [--preset <preset>] [--artefato <texto>|--artefato-arquivo <arquivo>] [--json]",
      "capabilities: sema profile capabilities [--json]",
      "conteúdo: sema conteudo <capabilities|validar|planejar|validar-envelope|registrar|status|projetar> [--trust-root-digest <sha256:...>] [--revocation-digest <sha256:...>] [--expected-head <sha256:...>] [opções] [--json]",
      "interativo: sema interativo <capabilities|schema|pipelines|adapters|validar|planejar|validar-evidencias|status|validar-protocolo|extensões-P0-P2> [opções] [--json]",
      "rule packs: sema rule-packs [--profile <author|software|workflow|ops|game|simulation|legal|research|redacao|propostas|conversas>] [--json]",
    ]),
    "",
    renderizarSecaoAscii("Ajuda IA-first", [
      "sema ajuda-ia",
      "sema starter-ia",
      "sema resumo <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>] [--drift <none|cache|fresh>] [--saida <diretorio>] [--raiz] [--json]",
      "sema prompt-curto <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>] [--json]",
      "sema prompt-ia",
      "sema prompt-ia-ui",
      "sema prompt-ia-react",
      "sema prompt-ia-sema-primeiro",
      "sema exemplos-prompt-ia",
      "sema contexto-ia <arquivo.sema> [--saida <diretorio>] [--json]",
      "sema sync-codex [--json]",
      "sema instalar-exemplos [--json]",
      "sema docs-impacto --intencao <acao> [--arquivo <caminho>] [--criar-ausentes] [--json]",
      "sema finalizar-mudanca --intencao <acao> [--arquivo <caminho>] [--doc-lida <caminho>] [--json]",
      "sema author briefing <arquivo.sema> [--json]",
      "sema author revisar-cliches <arquivo.sema> [--texto <texto>|--texto-arquivo <arquivo>] [--texto-anterior <texto>|--texto-anterior-arquivo <arquivo>] [--json]",
      "sema author validar-narrativa <arquivo.sema> [--texto <texto>|--texto-arquivo <arquivo>] [--json]",
      "sema author validar-proibicoes <arquivo.sema> [--texto <texto>|--texto-arquivo <arquivo>] [--json]",
      "sema profile validar <profile> <arquivo.sema> [--maturidade draft|prototype|production|critical] [--preset <preset>] [--artefato <texto>|--artefato-arquivo <arquivo>] [--json]",
      "sema profile capabilities [--json]",
      "sema descobrir <catalogo|recomendar|explicar> [id] [--intencao <objetivo>] [--json]",
      "sema pipeline <listar|descrever> [id] [--json]",
      "sema capabilities [--json]",
      "sema interativo <capabilities|schema|pipelines|adapters|validar|planejar|validar-evidencias|status|validar-protocolo|extensões-P0-P2> [opções] [--json]",
      "sema conteudo <capabilities|validar|planejar|validar-envelope|registrar|status|projetar> [--trust-root-digest <sha256:...>] [--revocation-digest <sha256:...>] [--expected-head <sha256:...>] [opções] [--json]",
      "sema rule-packs [--profile <profile>] [--json]",
    ]),
    "",
    renderizarSecaoAscii("Operacional", [
      "sema doctor",
      "sema --versao | --version | -v",
    ]),
  ].join("\n");
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
    "- Nao assuma monorepo, `node pacotes/cli/dist/index.js`, `npm run project:check` ou uma pasta `exemplos` externa ao projeto atual.",
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
