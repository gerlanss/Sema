// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.governanca_ia.drift.cache.modos
// Descrição: tipa contexto e evidência de drift opcional sem fabricar métricas.

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
  LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO,
  LIMITE_AVISO_LINHAS_CONTRATO_SEMA,
  LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO,
  LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA,
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

import { ModoResumoIa, PacoteContextoModuloIa, ResumoSemanticoModuloIa, TamanhoResumoIa, VERSAO_CLI, calcularRiscoOperacionalResumo, formatarEfeitoSemanticoResumido, normalizarIdentificadorResumo, resumirCamposTask } from "./index.part01.js";

export function descreverFazModulo(ir: IrModulo | null, modulo: string): string {
  if (!ir) {
    return `governa o modulo ${normalizarIdentificadorResumo(modulo)}`;
  }

  const partes: string[] = [];
  if (ir.routes.length > 0) {
    partes.push(`${ir.routes.length} rota(s)`);
  }
  if (ir.superficies.length > 0) {
    partes.push(`${ir.superficies.length} superficie(s)`);
  }
  if (ir.tasks.length > 0) {
    partes.push(`${ir.tasks.length} task(s)`);
  }

  const foco = ir.routes[0]?.nome ?? ir.superficies[0]?.nome ?? ir.tasks[0]?.nome ?? modulo;
  return partes.length > 0
    ? `governa ${partes.join(", ")} com foco em ${normalizarIdentificadorResumo(foco)}`
    : `governa o modulo ${normalizarIdentificadorResumo(modulo)}`;
}

export function coletarResumoSemanticoModulo(
  contexto: Pick<PacoteContextoModuloIa, "arquivo" | "modulo" | "geradoEm" | "ir" | "briefing" | "drift"> & {
    modoVerificacaoCodigo?: ResumoSemanticoModuloIa["modoVerificacaoCodigo"];
    fontesConclusao?: string[];
  },
): ResumoSemanticoModuloIa {
  const { arquivo, modulo, geradoEm, ir, briefing, drift } = contexto;
  const driftExecutado = drift.executada && drift.resumo !== null && drift.drift !== null;
  const modoVerificacaoCodigo = driftExecutado
    ? (contexto.modoVerificacaoCodigo ?? "codigo_completo")
    : "contratos_apenas";
  const fontesConclusao = driftExecutado
    ? (contexto.fontesConclusao ?? ["contrato", "codigo"])
    : ["contrato"];
  const tarefas = ir?.tasks ?? [];
  const rotas = ir?.routes ?? [];
  const superficies = ir?.superficies ?? [];
  const regrasCriticas = unicosOrdenados([
    ...tarefas.flatMap((task) => task.rules),
    ...tarefas.flatMap((task) => task.guarantees),
  ]);
  const efeitos = unicosOrdenados([
    ...tarefas.flatMap((task) => task.effects),
    ...rotas.flatMap((route) => route.efeitosPublicos.map((efeito) => formatarEfeitoSemanticoResumido(efeito))),
    ...superficies.flatMap((superficie) => superficie.effects.map((efeito) => formatarEfeitoSemanticoResumido(efeito))),
  ]);
  const erros = unicosOrdenados([
    ...tarefas.flatMap((task) => Object.keys(task.errors)),
    ...tarefas.flatMap((task) => task.errosDetalhados.map((erro) => erro.codigo)),
    ...rotas.flatMap((route) => route.errosPublicos.map((erro) => erro.codigo)),
  ]);
  const entidadesAfetadas = unicosOrdenados([
    ...(ir?.resumoAgente.entidadesAfetadas ?? []),
    ...tarefas.flatMap((task) => task.resumoAgente.entidadesAfetadas),
    ...rotas.flatMap((route) => route.resumoAgente.entidadesAfetadas),
    ...superficies.flatMap((superficie) => superficie.resumoAgente.entidadesAfetadas),
  ]);

  const resumo: ResumoSemanticoModuloIa = {
    geradoEm,
    arquivo,
    modulo,
    modoVerificacaoCodigo,
    avisoVerificacaoCodigo: modoVerificacaoCodigo === "contratos_apenas"
      ? "Somente contratos foram analisados; a implementação não foi verificada neste modo."
      : modoVerificacaoCodigo === "codigo_selecionado"
        ? "Codigo selecionado foi enviado; conclusoes de implementacao valem apenas para os arquivos do snapshot."
        : null,
    fontesConclusao,
    perfilCompatibilidade: ir?.perfilCompatibilidade ?? briefing.perfilCompatibilidade,
    scoreSemantico: briefing.scoreSemantico,
    confiancaGeral: briefing.confiancaGeral,
    riscoOperacional: drift.resumo ? calcularRiscoOperacionalResumo(drift.resumo) : "nao_avaliado",
    faz: descreverFazModulo(ir, modulo),
    tarefasPrincipais: limitarLista(tarefas.map((task) => task.nome), 6),
    entradasChave: limitarLista(tarefas.map((task) => resumirCamposTask(task, "input", 4)), 4),
    saidasChave: limitarLista(tarefas.map((task) => resumirCamposTask(task, "output", 4)), 4),
    superficiesPublicas: limitarLista(unicosOrdenados([
      ...briefing.superficiesImpactadas,
      ...rotas.map((route) => `${route.metodo ?? "?"} ${route.caminho ?? route.nome}`),
    ]), 8),
    regrasCriticas: limitarLista(regrasCriticas, 8),
    efeitos: limitarLista(efeitos, 8),
    erros: limitarLista(erros, 8),
    entidadesAfetadas: limitarLista(entidadesAfetadas, 8),
    arquivosProvaveis: limitarLista(unicosOrdenados(briefing.oQueTocar), 8),
    simbolosRelacionados: limitarLista(unicosOrdenados(briefing.simbolosRelacionados), 8),
    riscosPrincipais: limitarLista(unicosOrdenados(briefing.riscosPrincipais), 6),
    lacunas: limitarLista(unicosOrdenados(briefing.oQueEstaFrouxo), 6),
    inferido: limitarLista(unicosOrdenados(briefing.oQueFoiInferido), 6),
    checksSugeridos: limitarLista(unicosOrdenados(briefing.oQueValidar), 6),
    testesMinimos: limitarLista(unicosOrdenados(briefing.testesMinimos), 6),
    consumerFramework: briefing.consumerFramework ?? drift.drift?.consumerFramework ?? null,
    appRoutes: limitarLista(unicosOrdenados(briefing.appRoutes ?? drift.drift?.appRoutes ?? []), 8),
    consumerSurfaces: limitarLista(unicosOrdenados(briefing.consumerSurfaces ?? []), 8),
    consumerBridges: limitarLista(unicosOrdenados(briefing.consumerBridges ?? []), 8),
    ancoragensVinculo: limitarLista(unicosOrdenados(briefing.ancoragensVinculo ?? []), 8),
    arquivosProvaveisEditar: limitarLista(unicosOrdenados(briefing.arquivosProvaveisEditar ?? briefing.oQueTocar), 8),
  };
  return modoVerificacaoCodigo === "codigo_completo"
    ? resumo
    : normalizarResumoModoContratosApenas(resumo);
}

export const LACUNAS_DEPENDENTES_DE_CODIGO = new Set([
  "sem_impl",
  "impl_quebrado",
  "sem_vinculos",
  "vinculo_quebrado",
  "rastreabilidade_fraca",
]);

export function normalizarResumoModoContratosApenas(resumo: ResumoSemanticoModuloIa): ResumoSemanticoModuloIa {
  const lacunasCodigo = resumo.lacunas.some((lacuna) => LACUNAS_DEPENDENTES_DE_CODIGO.has(lacuna));
  const riscosCodigo = resumo.riscosPrincipais.some((risco) =>
    /vinculo_fraco|sem_impl|impl_quebrado|vinculo_quebrado|rastreabilidade_fraca/i.test(risco));
  const modoContratosApenas = resumo.modoVerificacaoCodigo === "contratos_apenas";

  const lacunas = resumo.lacunas
    .filter((lacuna) => !LACUNAS_DEPENDENTES_DE_CODIGO.has(lacuna));
  const riscosPrincipais = resumo.riscosPrincipais
    .filter((risco) => !/vinculo_fraco|sem_impl|impl_quebrado|vinculo_quebrado|rastreabilidade_fraca/i.test(risco));
  const checksSugeridos = resumo.checksSugeridos
    .filter((check) => !/drift|vinculo/i.test(check));

  return {
    ...resumo,
    appRoutes: modoContratosApenas ? null : resumo.appRoutes,
    consumerSurfaces: modoContratosApenas ? null : resumo.consumerSurfaces,
    consumerBridges: modoContratosApenas ? null : resumo.consumerBridges,
    ancoragensVinculo: modoContratosApenas ? null : resumo.ancoragensVinculo,
    riscosPrincipais: limitarLista(unicosOrdenados([
      ...riscosPrincipais,
      ...(riscosCodigo || lacunasCodigo ? ["codigo_nao_verificado_neste_modo"] : []),
    ]), 6),
    lacunas: limitarLista(unicosOrdenados([
      ...lacunas,
      ...(lacunasCodigo ? [modoContratosApenas ? "implementacao_nao_enviada" : "implementacao_nao_presente_no_snapshot"] : []),
      ...(lacunasCodigo ? ["codigo_nao_verificado_neste_modo"] : []),
    ]), 6),
    inferido: limitarLista(unicosOrdenados([
      ...resumo.inferido,
      modoContratosApenas ? "modo_contratos_apenas" : "modo_codigo_selecionado",
      modoContratosApenas ? "codigo_nao_verificado_neste_modo" : "codigo_parcial_verificado_neste_modo",
    ]), 6),
    checksSugeridos: limitarLista(unicosOrdenados([
      ...checksSugeridos,
      modoContratosApenas
        ? "sincronizar codigo selecionado para verificar implementacao"
        : "ampliar snapshot se precisar verificar outro codigo",
    ]), 6),
  };
}

export async function detectarModoVerificacaoCodigo(
  baseProjeto: string,
  diretoriosCodigo: string[],
): Promise<ResumoSemanticoModuloIa["modoVerificacaoCodigo"]> {
  try {
    const snapshot = JSON.parse(await readFile(path.join(baseProjeto, "SEMA_SNAPSHOT.json"), "utf8"));
    if (snapshot?.modo === "contratos_apenas") return "contratos_apenas";
    if (snapshot?.modo === "codigo_selecionado") return "codigo_selecionado";
  } catch {}
  return diretoriosCodigo.length === 0 ? "contratos_apenas" : "codigo_completo";
}

export async function detectarFontesConclusaoSnapshot(baseProjeto: string): Promise<string[]> {
  try {
    const snapshot = JSON.parse(await readFile(path.join(baseProjeto, "SEMA_SNAPSHOT.json"), "utf8"));
    if (Array.isArray(snapshot?.fontesConclusao) && snapshot.fontesConclusao.length > 0) {
      return snapshot.fontesConclusao.map(String);
    }
  } catch {}
  return ["contrato", "codigo"];
}

export function descreverFontesConclusao(fontes: string[], modo: ResumoSemanticoModuloIa["modoVerificacaoCodigo"]): string[] {
  return fontes.map((fonte) => {
    if (fonte === "contrato") return "contrato: intencao oficial e regra normativa";
    if (fonte === "codigo") {
      return modo === "codigo_selecionado"
        ? "codigo: evidencia restrita ao snapshot selecionado"
        : "codigo: evidencia da implementacao disponivel";
    }
    if (fonte === "documentacao") return "documentacao: regra de negocio, operacao ou runbook contextual";
    if (fonte === "indice") return "indice: mapa de arquivos, hashes, timestamps e escopo recebido";
    return `${fonte}: fonte complementar`;
  });
}

export function renderizarResumoModuloTexto(
  resumo: ResumoSemanticoModuloIa,
  tamanho: TamanhoResumoIa,
  modo: ModoResumoIa,
): string {
  const limite = tamanho === "micro" ? 2 : tamanho === "curto" ? 4 : 6;
  const consumerAvaliado = resumo.modoVerificacaoCodigo !== "contratos_apenas";
  const resumirEvidenciaLista = (itens: string[] | null): string =>
    itens === null ? "não avaliado" : resumirListaTexto(itens, limite);
  const linhas = [
    `MODO: ${modo}`,
    `MODULO: ${resumo.modulo}`,
    `FAZ: ${resumo.faz}`,
    `PERFIL: ${resumo.perfilCompatibilidade}`,
    `MODO_CODIGO: ${resumo.modoVerificacaoCodigo}`,
    ...(resumo.avisoVerificacaoCodigo ? [`AVISO_CODIGO: ${resumo.avisoVerificacaoCodigo}`] : []),
    `FONTES_CONCLUSAO: ${resumirListaTexto(resumo.fontesConclusao, limite)}`,
    `CONSUMER_FRAMEWORK: ${resumo.consumerFramework ?? (consumerAvaliado ? "nenhum" : "não avaliado")}`,
    `APP_ROUTES: ${resumirEvidenciaLista(resumo.appRoutes)}`,
    `CONSUMER_SURFACES: ${resumirEvidenciaLista(resumo.consumerSurfaces)}`,
    `CONSUMER_BRIDGES: ${resumirEvidenciaLista(resumo.consumerBridges)}`,
    `ANCORAGEM_VINCULO: ${resumirEvidenciaLista(resumo.ancoragensVinculo)}`,
    `PUBLICO: ${resumirListaTexto(resumo.superficiesPublicas, limite)}`,
    `TAREFAS: ${resumirListaTexto(resumo.tarefasPrincipais, limite)}`,
    `ENTRADAS: ${resumirListaTexto(resumo.entradasChave, limite)}`,
    `SAIDAS: ${resumirListaTexto(resumo.saidasChave, limite)}`,
    `REGRAS: ${resumirListaTexto(resumo.regrasCriticas, limite)}`,
    `EFEITOS: ${resumirListaTexto(resumo.efeitos, limite)}`,
    `ERROS: ${resumirListaTexto(resumo.erros, limite)}`,
    `TOCAR: ${resumirListaTexto(resumo.arquivosProvaveis, limite)}`,
    `VALIDAR: ${resumirListaTexto(resumo.checksSugeridos, limite)}`,
    `TESTES: ${resumirListaTexto(resumo.testesMinimos, limite)}`,
    `RISCOS: ${resumirListaTexto(resumo.riscosPrincipais, limite)}`,
    `LACUNAS: ${resumirListaTexto(resumo.lacunas, limite)}`,
    `INFERIDO: ${resumirListaTexto(resumo.inferido, limite)}`,
    `CONFIANCA: ${resumo.confiancaGeral ?? "não avaliada"}`,
    `RISCO_OPERACIONAL: ${resumo.riscoOperacional}`,
    `SCORE: ${resumo.scoreSemantico ?? "não avaliado"}`,
    `GERADO_EM: ${resumo.geradoEm}`,
  ];

  if (tamanho === "micro") {
    return `${linhas.slice(0, 12).join("\n")}\n`;
  }

  return `${linhas.join("\n")}\n`;
}

export function renderizarResumoModuloMarkdown(
  resumo: ResumoSemanticoModuloIa,
  modo: ModoResumoIa,
  guiaPorCapacidade: GuiaCapacidadeIaMap,
): string {
  const consumerAvaliado = resumo.modoVerificacaoCodigo !== "contratos_apenas";
  const resumirEvidenciaLista = (itens: string[] | null): string =>
    itens === null ? "não avaliado" : resumirListaTexto(itens, 6);
  const exibirConsumer = resumo.consumerFramework !== null || resumo.appRoutes === null;
  const linhas = [
    `# Resumo Sema para ${resumo.modulo}`,
    "",
    `- Modo: \`${modo}\``,
    `- Gerado em: \`${resumo.geradoEm}\``,
    `- Arquivo: \`${resumo.arquivo}\``,
    `- Perfil: \`${resumo.perfilCompatibilidade}\``,
    `- Modo de codigo: \`${resumo.modoVerificacaoCodigo}\``,
    ...(resumo.avisoVerificacaoCodigo ? [`- Aviso de codigo: ${resumo.avisoVerificacaoCodigo}`] : []),
    `- Fontes de conclusao: ${resumirListaTexto(resumo.fontesConclusao, 6)}`,
    `- Score: \`${resumo.scoreSemantico ?? "não avaliado"}\``,
    `- Confiança: \`${resumo.confiancaGeral ?? "não avaliada"}\``,
    `- Risco operacional: \`${resumo.riscoOperacional}\``,
    "",
    "## O que este modulo faz",
    "",
    `- ${resumo.faz}`,
    `- Superficies publicas: ${resumirListaTexto(resumo.superficiesPublicas, 8)}`,
    `- Tarefas principais: ${resumirListaTexto(resumo.tarefasPrincipais, 8)}`,
    "",
    "## Contrato util para IA",
    "",
    `- Entradas chave: ${resumirListaTexto(resumo.entradasChave, 6)}`,
    `- Saidas chave: ${resumirListaTexto(resumo.saidasChave, 6)}`,
    `- Regras criticas: ${resumirListaTexto(resumo.regrasCriticas, 6)}`,
    `- Efeitos: ${resumirListaTexto(resumo.efeitos, 6)}`,
    `- Erros: ${resumirListaTexto(resumo.erros, 6)}`,
    `- Entidades afetadas: ${resumirListaTexto(resumo.entidadesAfetadas, 6)}`,
    "",
    ...(exibirConsumer
      ? [
        "## Consumer IA-first",
        "",
        `- Framework consumer: ${resumo.consumerFramework ?? (consumerAvaliado ? "nenhum" : "não avaliado")}`,
        `- Rotas de app: ${resumirEvidenciaLista(resumo.appRoutes)}`,
        `- Superficies consumer: ${resumirEvidenciaLista(resumo.consumerSurfaces)}`,
        `- Bridges consumer: ${resumirEvidenciaLista(resumo.consumerBridges)}`,
        "",
      ]
      : []),
    "## Intervencao segura",
    "",
    `- Arquivos provaveis: ${resumirListaTexto(resumo.arquivosProvaveis, 6)}`,
    `- Simbolos relacionados: ${resumirListaTexto(resumo.simbolosRelacionados, 6)}`,
    `- Riscos principais: ${resumirListaTexto(resumo.riscosPrincipais, 6)}`,
    `- Lacunas: ${resumirListaTexto(resumo.lacunas, 6)}`,
    `- O que foi inferido: ${resumirListaTexto(resumo.inferido, 6)}`,
    `- Checks sugeridos: ${resumirListaTexto(resumo.checksSugeridos, 6)}`,
    `- Testes minimos: ${resumirListaTexto(resumo.testesMinimos, 6)}`,
    "",
    "## Guia por capacidade de IA",
    "",
  ];

  for (const capacidade of CAPACIDADES_IA_OPERACIONAIS) {
    const guia = guiaPorCapacidade[capacidade];
    linhas.push(`### ${capacidade}`);
    linhas.push("");
    linhas.push(`- ${guia.descricao}`);
    linhas.push(`- Artefatos: ${guia.artefatos.map((item) => `\`${item}\``).join(", ")}`);
    linhas.push(`- Ordem de leitura: ${guia.ordemLeitura.map((item) => `\`${item}\``).join(" -> ")}`);
    linhas.push(`- Evitar: ${guia.evitar.length > 0 ? guia.evitar.map((item) => `\`${item}\``).join(", ") : "nada obrigatorio"}`);
    linhas.push("");
  }

  return `${linhas.join("\n").trim()}\n`;
}

export function criarBriefingMinimo(
  resumo: ResumoSemanticoModuloIa,
  modo: ModoResumoIa,
  tamanho: TamanhoResumoIa,
): Record<string, unknown> {
  return {
    comando: "briefing-minimo",
    geradoEm: resumo.geradoEm,
    cliVersao: VERSAO_CLI,
    modo,
    tamanho,
    arquivo: resumo.arquivo,
    modulo: resumo.modulo,
    modoVerificacaoCodigo: resumo.modoVerificacaoCodigo,
    avisoVerificacaoCodigo: resumo.avisoVerificacaoCodigo,
    fontesConclusao: resumo.fontesConclusao,
    perfilCompatibilidade: resumo.perfilCompatibilidade,
    scoreSemantico: resumo.scoreSemantico,
    confiancaGeral: resumo.confiancaGeral,
    riscoOperacional: resumo.riscoOperacional,
    faz: resumo.faz,
    publico: resumo.superficiesPublicas,
    tarefasPrincipais: resumo.tarefasPrincipais,
    entradasChave: resumo.entradasChave,
    saidasChave: resumo.saidasChave,
    regrasCriticas: resumo.regrasCriticas,
    efeitos: resumo.efeitos,
    erros: resumo.erros,
    arquivosProvaveis: resumo.arquivosProvaveis,
    arquivosProvaveisEditar: resumo.arquivosProvaveisEditar,
    simbolosRelacionados: resumo.simbolosRelacionados,
    riscosPrincipais: resumo.riscosPrincipais,
    lacunas: resumo.lacunas,
    inferido: resumo.inferido,
    checksSugeridos: resumo.checksSugeridos,
    testesMinimos: resumo.testesMinimos,
    consumerFramework: resumo.consumerFramework,
    appRoutes: resumo.appRoutes,
    consumerSurfaces: resumo.consumerSurfaces,
    consumerBridges: resumo.consumerBridges,
    ancoragensVinculo: resumo.ancoragensVinculo,
  };
}

export function criarPromptCurtoModulo(
  resumo: ResumoSemanticoModuloIa,
  modo: ModoResumoIa,
  tamanho: TamanhoResumoIa,
  capacidade: CapacidadeIa,
): string {
  const resumoTexto = renderizarResumoModuloTexto(resumo, tamanho, modo).trim();
  return `Você está operando Sema em modo IA-first.

Esta linguagem existe para traduzir intenção operacional em contrato consumível por IA. Humanos aprovam; agentes operam.

Capacidade alvo: ${capacidade}
Modo da tarefa: ${modo}

Regras:
- não invente sintaxe nem bloco fora da gramática oficial
- preserve a intenção do contrato
- use este resumo como fonte compacta inicial
- se a tarefa pedir mais contexto, rode \`sema contexto-ia <arquivo.sema> --saida <diretorio> --json\` e então abra \`briefing.min.json\`, \`drift.json\` e \`ir.json\` nessa saída
- não saia editando software vivo sem olhar risco, lacuna e checks sugeridos
- se abrir código com \`SEMA-GOVERNED\`, volte ao contrato e chame Sema antes de editar
- não crie nem conclua código governado acima de ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO} linhas; acima de ${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO}, planeje divisão; documentação Markdown não entra nesse limite de código
- não crie nem edite contrato .sema acima de ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA} linhas; acima de ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA}, planeje split por domínio/capacidade, nunca parte_1/parte_2
- vários contratos .sema podem governar o mesmo arquivo por vinculos; Sema Código deve preservar essa rastreabilidade
${resumo.consumerFramework ? "- se for tarefa visual consumer, priorize `appRoutes`, `consumerSurfaces` e `consumerBridges` antes de abrir arquivos aleatórios" : ""}

Contexto compacto:
${resumoTexto}
`;
}
