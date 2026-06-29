// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
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
import { PacoteContextoModuloIa, ResumoSemanticoModuloIa } from "./index.part01.js";
import { coletarResumoSemanticoModulo, criarBriefingMinimo, criarPromptCurtoModulo, renderizarResumoModuloMarkdown, renderizarResumoModuloTexto } from "./index.part02.js";
export function renderizarResumoProjetoMarkdown(
  geradoEm: string,
  modulos: ResumoSemanticoModuloIa[],
  guiaPorCapacidade: GuiaCapacidadeIaMap,
): string {
  const entradaCanonica = criarEntradaCanonicaProjeto(guiaPorCapacidade);
  const agentContextPack = entradaCanonica.agentContextPack;
  const linhas = [
    "# SEMA_BRIEF",
    "",
    "Sema e IA-first. Este arquivo existe para IA achar o ponto de entrada do projeto sem varrer o repo inteiro no escuro.",
    "",
    `- Gerado em: \`${geradoEm}\``,
    `- Modulos: \`${modulos.length}\``,
    "",
    "## Entrada canonica para IA",
    "",
    `- Ordem minima: ${entradaCanonica.ordemLeitura.join(" -> ")}`,
    `- IA fraca: ${entradaCanonica.porCapacidade.fraca.join(" -> ")}`,
    `- IA média: ${entradaCanonica.porCapacidade.media.join(" -> ")}`,
    `- IA forte: ${entradaCanonica.porCapacidade.forte.join(" -> ")}`,
    `- Aliases: pequena -> fraca; grande -> forte`,
    "",
    "## Agent Context Pack",
    "",
    `- Arquivo: \`${ARQUIVO_AGENT_CONTEXT_PACK}\``,
    `- Objetivo: ${agentContextPack.objetivo}`,
    `- Regras: ${agentContextPack.regrasObrigatorias.slice(0, 4).join(" | ")}`,
    `- Fontes brutas sob demanda: ${agentContextPack.fontes.map((fonte) => fonte.caminho).slice(0, 7).join(", ")}`,
    "",
    "## Políticas da plataforma",
    "",
    `- Regra: ${agentContextPack.politicaPlataforma.regra}`,
    `- IA fraca: ${agentContextPack.politicaPlataforma.porCapacidade.fraca}`,
    `- IA média: ${agentContextPack.politicaPlataforma.porCapacidade.media}`,
    `- IA forte: ${agentContextPack.politicaPlataforma.porCapacidade.forte}`,
    `- Se houver alerta externo: ${agentContextPack.politicaPlataforma.quandoHouverBloqueio}`,
    "",
    "## Código governado",
    "",
    `- Marcador: \`${agentContextPack.politicaCodigoGovernado.marcador}\``,
    `- Regra: ${agentContextPack.politicaCodigoGovernado.regra}`,
    `- IA fraca: ${agentContextPack.politicaCodigoGovernado.porCapacidade.fraca}`,
    `- IA média: ${agentContextPack.politicaCodigoGovernado.porCapacidade.media}`,
    `- IA forte: ${agentContextPack.politicaCodigoGovernado.porCapacidade.forte}`,
    "",
    "## Design visual",
    "",
    `- Regra: ${agentContextPack.politicaDesignVisual.regra}`,
    `- Aplicar quando: ${agentContextPack.politicaDesignVisual.aplicarQuando}`,
    `- IA fraca: ${agentContextPack.politicaDesignVisual.porCapacidade.fraca}`,
    `- IA média: ${agentContextPack.politicaDesignVisual.porCapacidade.media}`,
    `- IA forte: ${agentContextPack.politicaDesignVisual.porCapacidade.forte}`,
    `- Proibido: ${agentContextPack.politicaDesignVisual.proibicoes.slice(0, 5).join(", ")}`,
    "",
    "## Timeout e retry",
    "",
    `- Regra: ${agentContextPack.politicaTimeoutResumo.regra}`,
    `- Timeout inicial para projeto inteiro: ${agentContextPack.politicaTimeoutResumo.timeoutInicialSegundos}s`,
    `- Escalonamento: ${agentContextPack.politicaTimeoutResumo.escalonamentoSegundos.map((segundos) => `${segundos}s`).join(" -> ")}`,
    `- Bloqueio: ${agentContextPack.politicaTimeoutResumo.ateQuandoTentar}`,
    "",
    "## Guia por capacidade",
    "",
  ];
  for (const capacidade of CAPACIDADES_IA_OPERACIONAIS) {
    const guia = guiaPorCapacidade[capacidade];
    linhas.push(`- ${capacidade}: ${guia.descricao} Artefatos: ${guia.artefatos.join(", ")}.`);
  }
  linhas.push("");
  linhas.push("## Modulos");
  linhas.push("");
  for (const modulo of modulos) {
    linhas.push(`### ${modulo.modulo}`);
    linhas.push(`- Faz: ${modulo.faz}`);
    linhas.push(`- Publico: ${resumirListaTexto(modulo.superficiesPublicas, 4)}`);
    linhas.push(`- Tocar: ${resumirListaTexto(modulo.arquivosProvaveis, 4)}`);
    linhas.push(`- Score: ${modulo.scoreSemantico} | Confianca: ${modulo.confiancaGeral} | Risco: ${modulo.riscoOperacional}`);
    linhas.push(`- Lacunas: ${resumirListaTexto(modulo.lacunas, 4)}`);
    linhas.push("");
  }
  return `${linhas.join("\n").trim()}\n`;
}
export function falharContextoIa(mensagem: string): never {
  throw new Error(mensagem);
}
export function garantirArquivoSema(caminhoArquivo: string): void {
  if (!caminhoArquivo.toLowerCase().endsWith(".sema")) {
    falharContextoIa("O caminho informado precisa apontar para um arquivo .sema.");
  }
}
export function resumirDriftPorModulo(
  modulo: string | null,
  caminho: string,
  resultadoDrift: Awaited<ReturnType<typeof analisarDriftLegado>>,
) {
  const tasks = modulo
    ? resultadoDrift.tasks.filter((task) => task.modulo === modulo)
    : [];
  const implsValidos = modulo
    ? resultadoDrift.impls_validos.filter((impl) => impl.modulo === modulo)
    : [];
  const implsQuebrados = modulo
    ? resultadoDrift.impls_quebrados.filter((impl) => impl.modulo === modulo)
    : [];
  const vinculosValidos = modulo
    ? resultadoDrift.vinculos_validos.filter((vinculo) => vinculo.modulo === modulo)
    : [];
  const vinculosQuebrados = modulo
    ? resultadoDrift.vinculos_quebrados.filter((vinculo) => vinculo.modulo === modulo)
    : [];
  const rotasDivergentes = modulo
    ? resultadoDrift.rotas_divergentes.filter((rota) => rota.modulo === modulo)
    : [];
  const recursosValidos = modulo
    ? resultadoDrift.recursos_validos.filter((recurso) => recurso.modulo === modulo)
    : [];
  const recursosDivergentes = modulo
    ? resultadoDrift.recursos_divergentes.filter((recurso) => recurso.modulo === modulo)
    : [];
  const vinculosModulo = modulo
    ? [
      ...resultadoDrift.vinculos_validos.filter((vinculo) => vinculo.modulo === modulo),
      ...resultadoDrift.vinculos_quebrados.filter((vinculo) => vinculo.modulo === modulo),
    ]
    : [];
  const rotasConsumerModulo = new Set(
    vinculosModulo
      .filter((vinculo) => vinculo.tipo === "superficie")
      .map((vinculo) => vinculo.valor),
  );
  const arquivosRelacionados = [...new Set([
    ...tasks.flatMap((task) => task.arquivosReferenciados),
    ...tasks.flatMap((task) => task.arquivosProvaveisEditar),
    ...implsValidos.map((impl) => impl.arquivo).filter((item): item is string => Boolean(item)),
    ...implsQuebrados.flatMap((impl) => impl.candidatos?.map((candidato) => candidato.arquivo) ?? []),
    ...vinculosValidos.map((vinculo) => vinculo.arquivo).filter((item): item is string => Boolean(item)),
    ...recursosValidos.map((recurso) => recurso.arquivo).filter(Boolean),
    ...recursosDivergentes.map((recurso) => recurso.arquivo).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const arquivosProvaveisEditar = [...new Set([
    ...arquivosRelacionados,
    ...tasks.flatMap((task) => task.arquivosProvaveisEditar),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const consumerSurfaces = resultadoDrift.consumerSurfaces
    .filter((surface) =>
      arquivosProvaveisEditar.includes(surface.arquivo)
      || rotasConsumerModulo.has(surface.rota))
    .map((surface) => `${surface.tipoArquivo}:${surface.rota} -> ${surface.arquivo}`)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const consumerBridges = resultadoDrift.consumerBridges
    .filter((bridge) => arquivosProvaveisEditar.includes(bridge.arquivo))
    .map((bridge) => bridge.caminho)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const appRoutes = [...new Set(resultadoDrift.consumerSurfaces
    .filter((surface) =>
      arquivosProvaveisEditar.includes(surface.arquivo)
      || rotasConsumerModulo.has(surface.rota))
    .map((surface) => surface.rota))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const consumerFramework = appRoutes.length > 0 || consumerBridges.length > 0
    ? resultadoDrift.consumerFramework
    : null;
  const ancoragensVinculo = tasks
    .filter((task) => task.ancoragemVinculo !== "propria")
    .map((task) => {
      if (task.ancoragemVinculo === "herdada_modulo" && task.arquivosAncoraHerdados.length > 0) {
        return `${task.task}:herdada_modulo -> ${task.arquivosAncoraHerdados.join(", ")}`;
      }
      return `${task.task}:${task.ancoragemVinculo}`;
    })
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    caminho,
    modulo,
    implsValidos: implsValidos.length,
    implsQuebrados: implsQuebrados.length,
    vinculosValidos: vinculosValidos.length,
    vinculosQuebrados: vinculosQuebrados.length,
    recursosValidos: recursosValidos.length,
    recursosDivergentesCount: recursosDivergentes.length,
    tasksSemImplementacao: tasks.filter((task) => task.semImplementacao).length,
    scoreMedio: tasks.length > 0 ? Math.round(tasks.reduce((total, task) => total + task.scoreSemantico, 0) / tasks.length) : 0,
    confiancaGeral: tasks.some((task) => task.confiancaVinculo === "alta")
      ? "alta"
      : tasks.some((task) => task.confiancaVinculo === "media")
        ? "media"
        : "baixa",
    arquivosRelacionados,
    arquivosProvaveisEditar,
    consumerFramework,
    appRoutes,
    consumerSurfaces,
    consumerBridges,
    ancoragensVinculo,
    checksSugeridos: [...new Set(tasks.flatMap((task) => task.checksSugeridos))],
    lacunas: [...new Set(tasks.flatMap((task) => task.lacunas))],
    tasks,
    rotasDivergentes,
    recursosDivergentes,
    vinculosQuebradosDetalhes: vinculosQuebrados,
  };
}
export function criarBriefingAgente(
  arquivo: string,
  modulo: string,
  ir: IrModulo | null,
  resumoDrift: ReturnType<typeof resumirDriftPorModulo>,
  resultadoDrift: Awaited<ReturnType<typeof analisarDriftLegado>>,
) {
  const tarefasModulo = resultadoDrift.tasks.filter((task) => task.modulo === modulo);
  return {
    arquivo,
    modulo,
    perfilCompatibilidade: ir?.perfilCompatibilidade ?? "interno",
    scoreSemantico: resumoDrift.scoreMedio,
    confiancaGeral: resumoDrift.confiancaGeral,
    riscosPrincipais: [...new Set([
      ...resultadoDrift.resumo_operacional.riscosPrincipais.filter((item) => item.startsWith(`${modulo}:`) || tarefasModulo.some((task) => item.startsWith(`${task.task}:`))),
      ...(ir?.resumoAgente.riscos ?? []),
    ])],
    oQueTocar: resumoDrift.arquivosRelacionados,
    arquivosProvaveisEditar: resumoDrift.arquivosProvaveisEditar,
    oQueValidar: [...new Set([
      ...resumoDrift.checksSugeridos,
      ...resultadoDrift.resumo_operacional.oQueValidar,
    ])],
    oQueEstaFrouxo: [...new Set([
      ...resumoDrift.lacunas,
      ...resultadoDrift.resumo_operacional.oQueEstaFrouxo,
    ])],
    oQueFoiInferido: [...new Set([
      ...resultadoDrift.impls_quebrados
        .filter((impl) => impl.modulo === modulo)
        .flatMap((impl) => impl.candidatos?.map((candidato) => candidato.caminho) ?? []),
      ...resultadoDrift.vinculos_validos
        .filter((vinculo) => vinculo.modulo === modulo && vinculo.status === "parcial")
        .map((vinculo) => `${vinculo.dono}:${vinculo.valor}`),
    ])],
    simbolosRelacionados: [...new Set([
      ...tarefasModulo.flatMap((task) => task.simbolosReferenciados),
      ...resultadoDrift.vinculos_validos
        .filter((vinculo) => vinculo.modulo === modulo)
        .map((vinculo) => vinculo.simbolo)
        .filter((item): item is string => Boolean(item)),
    ])],
    superficiesImpactadas: [
      ...(ir?.routes.map((route) => `${route.metodo ?? "?"} ${route.caminho ?? route.nome}`) ?? []),
      ...(ir?.superficies.map((superficie) => `${superficie.tipo}:${superficie.nome}`) ?? []),
    ],
    consumerFramework: resumoDrift.consumerFramework,
    appRoutes: resumoDrift.appRoutes,
    consumerSurfaces: resumoDrift.consumerSurfaces,
    consumerBridges: resumoDrift.consumerBridges,
    ancoragensVinculo: resumoDrift.ancoragensVinculo,
    testesMinimos: [
      "sema validar <arquivo> --json",
      "sema drift <arquivo> --json",
      "sema verificar <arquivo-ou-pasta> --json",
    ],
  };
}
export async function carregarContextoModuloIa(arquivoEntrada: string): Promise<PacoteContextoModuloIa> {
  const arquivo = path.resolve(arquivoEntrada);
  garantirArquivoSema(arquivo);
  const contextoProjeto = await carregarProjeto(arquivo, process.cwd());
  const resultadoModulo = contextoProjeto.modulosSelecionados.find((item) => path.resolve(item.caminho) === arquivo)?.resultado;
  if (!resultadoModulo) {
    falharContextoIa(`Nao foi possivel encontrar o modulo correspondente ao arquivo ${arquivo}.`);
  }
  const sucesso = !temErros(resultadoModulo.diagnosticos);
  const modulo = resultadoModulo.modulo?.nome ?? path.basename(arquivo, ".sema");
  const geradoEm = new Date().toISOString();
  const resultadoDrift = await analisarDriftLegado(contextoProjeto);
  const drift = {
    comando: "drift" as const,
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    sucesso: resultadoDrift.sucesso,
    resumo: resumirDriftPorModulo(resultadoModulo.modulo?.nome ?? null, arquivo, resultadoDrift),
    drift: resultadoDrift,
  };
  const validar = {
    comando: "validar" as const,
    sucesso,
    resultados: [
      {
        caminho: arquivo,
        modulo: resultadoModulo.modulo?.nome ?? null,
        sucesso,
        diagnosticos: resultadoModulo.diagnosticos,
      },
    ],
  };
  const diagnosticos = {
    comando: "diagnosticos" as const,
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    diagnosticos: resultadoModulo.diagnosticos,
  };
  const ast = {
    comando: "ast" as const,
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    sucesso,
    diagnosticos: resultadoModulo.diagnosticos,
    ast: resultadoModulo.modulo ?? null,
  };
  const ir = {
    comando: "ir" as const,
    caminho: arquivo,
    modulo: resultadoModulo.modulo?.nome ?? null,
    sucesso,
    diagnosticos: resultadoModulo.diagnosticos,
    ir: resultadoModulo.ir ?? null,
  };
  const briefing = criarBriefingAgente(
    arquivo,
    modulo,
    resultadoModulo.ir ?? null,
    drift.resumo,
    resultadoDrift,
  );
  return {
    arquivo,
    modulo,
    sucesso,
    geradoEm,
    diagnosticos: resultadoModulo.diagnosticos,
    ir: resultadoModulo.ir ?? null,
    validar,
    diagnosticosJson: diagnosticos,
    ast,
    irJson: ir,
    drift,
    briefing,
  };
}
export async function gerarArquivosResumoModuloIa(
  contexto: PacoteContextoModuloIa,
  pastaBase: string,
): Promise<{
  artefatosCompactos: string[];
  guiaPorCapacidade: GuiaCapacidadeIaMap;
}> {
  const guiaPorCapacidade = criarGuiaCapacidadeIa();
  const resumoSemantico = coletarResumoSemanticoModulo(contexto);
  const resumoMicro = renderizarResumoModuloTexto(resumoSemantico, "micro", "resumo");
  const resumoCurto = renderizarResumoModuloTexto(resumoSemantico, "curto", "resumo");
  const resumoMarkdown = renderizarResumoModuloMarkdown(resumoSemantico, "resumo", guiaPorCapacidade);
  const briefingMinimo = criarBriefingMinimo(resumoSemantico, "resumo", "curto");
  const promptCurto = criarPromptCurtoModulo(resumoSemantico, "mudanca", "curto", "fraca");
  const agentContextPack = criarAgentContextPack(guiaPorCapacidade);
  const semaBoot = renderizarSemaBoot(agentContextPack);
  const semaSmallModel = renderizarSemaSmallModel(agentContextPack);
  await writeFile(path.join(pastaBase, ARQUIVO_SEMA_BOOT), semaBoot, "utf8");
  await writeFile(path.join(pastaBase, ARQUIVO_SEMA_SMALL_MODEL), semaSmallModel, "utf8");
  await writeFile(path.join(pastaBase, "agent-context-pack.json"), `${JSON.stringify(agentContextPack, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "resumo.micro.txt"), resumoMicro, "utf8");
  await writeFile(path.join(pastaBase, "resumo.curto.txt"), resumoCurto, "utf8");
  await writeFile(path.join(pastaBase, "resumo.md"), resumoMarkdown, "utf8");
  await writeFile(path.join(pastaBase, "briefing.min.json"), `${JSON.stringify(briefingMinimo, null, 2)}\n`, "utf8");
  await writeFile(path.join(pastaBase, "prompt-curto.txt"), promptCurto, "utf8");
  return {
    artefatosCompactos: [ARQUIVO_SEMA_BOOT, ARQUIVO_SEMA_SMALL_MODEL, "agent-context-pack.json", "resumo.micro.txt", "resumo.curto.txt", "resumo.md", "briefing.min.json", "prompt-curto.txt"],
    guiaPorCapacidade,
  };
}
