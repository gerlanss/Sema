// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type {
  EngineBanco,
  IrBancoDados,
  IrFlow,
  IrModulo,
  IrRecursoPersistencia,
  IrRoute,
  IrSuperficie,
  IrTask,
  IrVinculo,
  NivelConfiancaSemantica,
  NivelRiscoSemantico,
  TipoRecursoPersistencia,
} from "@sema/nucleo";
import type { ContextoProjetoCarregado } from "./projeto.js";
import type { FonteLegado } from "./tipos.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { extrairSimbolosLua } from "./lua-symbols.js";
import { contarIndentacaoPython, extrairRotasFlaskDecoradas, normalizarCaminhoFlask } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import { extrairRotasTypeScriptHttp } from "./typescript-http.js";
import { emitirDiagnosticosArquivosOrcamento } from "./driftOrcamento.js";

import { ConfiguracaoEscopoDriftAplicada, DiagnosticoDrift, OpcoesDriftLegado, RegistroImplDrift, RegistroRecursoDrift, RegistroRotaDivergente, RegistroVinculoDrift, ResultadoDrift, SimboloCandidatoDrift, SimboloResolvido, definirDiretoriosIgnoradosAtivos, obterDiretoriosIgnoradosAtivos, extrairTermosEscopoDrift, resolverDiretoriosIgnoradosAtivos, resolverOpcoesDrift } from "./drift.part01.js";
import { construirContextoRelevanciaConsumer, filtrarConsumerSurfacesPorEscopo, resolverDiretoriosCodigoEscopoReal } from "./drift.part02.js";
import { indexarTypeScript, inferirConsumerFrameworkPrincipal } from "./drift.part06.js";
import { indexarCpp, indexarDart, indexarDotnet, indexarGo, indexarJava, indexarLua, indexarPersistenciaDeclarativa, indexarPython, indexarRust } from "./drift.part07.js";
import { indexarPersistenciaDetalhada, resolverPersistenciaLocalPorTask } from "./drift.part08.js";
import { calcularConfiancaTask, calcularRiscoOperacional, calcularScoreTask, encontrarAncoraSuperficie, indexarArquivosRastreaveis, resumirLacunasTask, resumirOperacional } from "./drift.part04.js";
import { coletarVinculosIr, construirMapaRecursos, extrairRecursosEsperados, resolverRecursoEsperado } from "./drift.part10.js";
import { analisarPersistenciaReal, escolherRotasEsperadas, normalizarCaminhoRota, ordenarCandidatos, sugerirCandidatosParaImpl, sugerirCandidatosParaTaskSemImpl } from "./drift.part09.js";
import { escolherArquivoPorVinculo, escolherSimboloPorVinculo } from "./drift.part03.js";
import { simboloEhBridgeConsumer } from "./drift.part05.js";
import { prepararIndicesDrift } from "./drift.part13.js";
import { analisarModulosSelecionadosDrift } from "./drift.part14.js";
import { resolverPoliticaPontuacaoSemantica } from "./driftScore.js";

export async function analisarDriftLegado(
  contexto: ContextoProjetoCarregado,
  opcoes?: OpcoesDriftLegado,
): Promise<ResultadoDrift> {
  const opcoesResolvidas = resolverOpcoesDrift(opcoes);
  const configuracaoEscopo: ConfiguracaoEscopoDriftAplicada = {
    escopo: opcoesResolvidas.escopo,
    ignorarWorktrees: opcoesResolvidas.ignorarWorktrees,
    ignorarConsumidoresLaterais: opcoesResolvidas.ignorarConsumidoresLaterais,
    termosEscopo: extrairTermosEscopoDrift(contexto, opcoesResolvidas.escopo),
  };
  const diretoriosIgnoradosAnteriores = obterDiretoriosIgnoradosAtivos();
  definirDiretoriosIgnoradosAtivos(resolverDiretoriosIgnoradosAtivos(opcoesResolvidas));

  try {
  const {
    detalhesPersistencia,
    indexDart,
    indexTs,
    mapaImpl,
    mapaRecursos,
    todasRotasIndexadas,
    todosArquivosConhecidos,
    todosRecursos,
    todosSimbolos,
  } = await prepararIndicesDrift(contexto, configuracaoEscopo);


  const implsValidos: RegistroImplDrift[] = [];
  const implsQuebrados: RegistroImplDrift[] = [];
  const vinculosValidos: RegistroVinculoDrift[] = [];
  const vinculosQuebrados: RegistroVinculoDrift[] = [];
  const rotasDivergentes: RegistroRotaDivergente[] = [];
  const recursosValidos: RegistroRecursoDrift[] = [];
  const recursosDivergentes: RegistroRecursoDrift[] = [];
  const diagnosticos: DiagnosticoDrift[] = [];
  const tasksResumo: ResultadoDrift["tasks"] = [];
  const taskPorChave = new Map<string, IrTask>();
  const guardrailsPorTask = new Map<string, {
    publica: boolean;
    sensivel: boolean;
    auth: boolean;
    authz: boolean;
    dados: boolean;
    audit: boolean;
    segredos: boolean;
    forbidden: boolean;
    dadosSensiveis: boolean;
    efeitoPrivilegiado: boolean;
    exigeSegredos: boolean;
  }>();
  const resumoVinculosPorTask = new Map<string, { validos: number; quebrados: number; arquivos: Set<string> }>();
  const arquivosAncoraHerdadosPorTask = new Map<string, Set<string>>();
  analisarModulosSelecionadosDrift({
    contexto,
    mapaImpl,
    todosSimbolos,
    mapaRecursos,
    todosRecursos,
    todasRotasIndexadas,
    todosArquivosConhecidos,
    implsValidos,
    implsQuebrados,
    vinculosValidos,
    vinculosQuebrados,
    rotasDivergentes,
    recursosValidos,
    recursosDivergentes,
    diagnosticos,
    tasksResumo,
    taskPorChave,
    guardrailsPorTask,
    resumoVinculosPorTask,
    arquivosAncoraHerdadosPorTask,
  });


  for (const resumo of tasksResumo) {
    const chaveTask = `${resumo.modulo}:${resumo.task}`;
    const task = taskPorChave.get(chaveTask);
    const guardrails = guardrailsPorTask.get(chaveTask) ?? {
      publica: false,
      sensivel: false,
      auth: false,
      authz: false,
      dados: false,
      audit: false,
      segredos: false,
      forbidden: false,
      dadosSensiveis: false,
      efeitoPrivilegiado: false,
      exigeSegredos: false,
    };
    const resumoVinculos = resumoVinculosPorTask.get(chaveTask) ?? {
      validos: 0,
      quebrados: 0,
      arquivos: new Set<string>(),
    };
    const arquivosAncoraHerdados = [...(arquivosAncoraHerdadosPorTask.get(chaveTask) ?? new Set<string>())]
      .filter((arquivo) => !resumoVinculos.arquivos.has(arquivo))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (!task) {
      continue;
    }

    resumo.confiancaVinculo = calcularConfiancaTask(task, resumo.implsValidos, resumo.implsQuebrados, resumoVinculos.validos, resumoVinculos.quebrados);
    resumo.riscoOperacional = calcularRiscoOperacional(task);
    resumo.lacunas = resumirLacunasTask(task, resumo.semImplementacao, resumo.implsQuebrados, resumoVinculos.quebrados, guardrails);
    resumo.scoreSemantico = calcularScoreTask(task, resumo.implsValidos, resumo.implsQuebrados, resumoVinculos.validos, resumoVinculos.quebrados, resumo.semImplementacao);
    resumo.ancoragemVinculo = task.vinculos.length > 0
      ? "propria"
      : arquivosAncoraHerdados.length > 0
        ? "herdada_modulo"
        : "ausente";
    resumo.arquivosAncoraHerdados = arquivosAncoraHerdados;
    resumo.arquivosProvaveisEditar = [...new Set([
      ...resumo.arquivosReferenciados,
      ...arquivosAncoraHerdados,
      ...resumo.candidatosImpl.map((candidato) => candidato.arquivo),
      ...resumoVinculos.arquivos,
    ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
    resumo.checksSugeridos = [...new Set([
      ...task.resumoAgente.checks,
      resumo.riscoOperacional !== "baixo" ? "revisar efeitos operacionais" : "",
      resumo.lacunas.includes("vinculo_quebrado") ? "corrigir vinculos rastreaveis" : "",
      resumo.lacunas.some((lacuna) => ["superficie_publica_sem_execucao", "execucao_critica_sem_bloco", "rastreabilidade_fraca"].includes(lacuna))
        ? "endurecer execucao e rastreabilidade para producao"
        : "",
      resumo.lacunas.some((lacuna) => ["auth_ausente", "authz_frouxa", "dados_nao_classificados", "audit_ausente", "segredo_sem_governanca", "proibicoes_ausentes"].includes(lacuna))
        ? "explicitar contratos de seguranca semantica"
        : "",
    ].filter(Boolean))];

    if (resumo.lacunas.includes("superficie_publica_sem_execucao")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" alimenta superficie publica, mas ainda depende de execucao implicita.`,
      });
    }
    if (resumo.lacunas.includes("execucao_critica_sem_bloco")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" opera com risco alto, mas ainda nao declarou execucao explicita.`,
      });
    }
    if (resumo.lacunas.includes("rastreabilidade_fraca")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" exige producao mais rastreavel, mas ainda nao declara impl nem vinculos.`,
      });
    }
    if (resumo.lacunas.includes("auth_ausente")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" chega em superficie publica sem auth explicita em task, route ou superficie associada.`,
      });
    }
    if (resumo.lacunas.includes("authz_frouxa")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" opera com risco ou exposicao, mas ainda nao explicita authz suficiente.`,
      });
    }
    if (resumo.lacunas.includes("dados_nao_classificados")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" ainda nao classifica dados de entrada/saida de forma semantica.`,
      });
    }
    if (resumo.lacunas.includes("audit_ausente")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" ainda nao declara audit explicita para operacao sensivel ou publica.`,
      });
    }
    if (resumo.lacunas.includes("segredo_sem_governanca")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" toca segredo ou credencial sem bloco segredos governando origem, escopo e rotacao.`,
      });
    }
    if (resumo.lacunas.includes("proibicoes_ausentes")) {
      diagnosticos.push({
        tipo: "seguranca_frouxa",
        modulo: resumo.modulo,
        task: resumo.task,
        mensagem: `Task "${resumo.task}" opera com efeito privilegiado ou dado sensivel sem forbidden explicito para conter abuso e vazamento.`,
      });
    }
  }

  const relevanciaConsumer = construirContextoRelevanciaConsumer(contexto, tasksResumo, vinculosValidos);
  const consumersFiltrados = filtrarConsumerSurfacesPorEscopo(
    [...indexTs.consumerSurfaces, ...indexDart.consumerSurfaces].sort((a, b) =>
      a.rota.localeCompare(b.rota, "pt-BR")
      || a.tipoArquivo.localeCompare(b.tipoArquivo, "pt-BR")
      || a.arquivo.localeCompare(b.arquivo, "pt-BR")),
    [...new Map(
      [...indexTs.simbolos, ...indexDart.simbolos]
        .filter((simbolo) => simboloEhBridgeConsumer(simbolo.caminho, simbolo.arquivo))
        .map((simbolo) => [
          `${simbolo.caminho}:${simbolo.arquivo}:${simbolo.simbolo}`,
          {
            caminho: simbolo.caminho,
            arquivo: simbolo.arquivo,
            simbolo: simbolo.simbolo,
          },
        ] as const),
    ).values()].sort((a, b) =>
      a.caminho.localeCompare(b.caminho, "pt-BR")
      || a.arquivo.localeCompare(b.arquivo, "pt-BR")),
    contexto,
    configuracaoEscopo,
    relevanciaConsumer,
  );
  const consumerSurfaces = consumersFiltrados.consumerSurfaces;
  const consumerBridges = consumersFiltrados.consumerBridges;
  const appRoutes = [...new Set(consumerSurfaces.map((surface) => surface.rota))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const consumerFramework = inferirConsumerFrameworkPrincipal(contexto.fontesLegado, consumerSurfaces, consumerBridges);
  const persistenciaReal = await analisarPersistenciaReal(contexto, mapaRecursos, detalhesPersistencia, opcoesResolvidas, mapaImpl);
  for (const item of persistenciaReal) {
    if (item.status === "divergente") {
      diagnosticos.push({
        tipo: "recurso_divergente",
        modulo: item.modulo,
        task: item.task,
        mensagem: `Persistencia real para "${item.alvo}" ainda nao foi materializada no codigo vivo.`,
      });
    } else if (item.compatibilidade === "invalido") {
      diagnosticos.push({
        tipo: "recurso_divergente",
        modulo: item.modulo,
        task: item.task,
        mensagem: `Persistencia real para "${item.alvo}" conflita com a compatibilidade declarada do engine ${item.engine}.`,
      });
    }
  }

  const arquivosOrcamento = new Set<string>();
  const adicionarArquivoOrcamento = (arquivo?: string) => {
    if (arquivo) {
      arquivosOrcamento.add(arquivo);
    }
  };
  for (const item of contexto.modulosSelecionados) {
    adicionarArquivoOrcamento(item.caminho);
  }
  for (const impl of implsValidos) {
    adicionarArquivoOrcamento(impl.arquivo);
  }
  for (const vinculo of vinculosValidos) {
    adicionarArquivoOrcamento(vinculo.arquivo);
  }
  for (const recurso of recursosValidos) {
    adicionarArquivoOrcamento(recurso.arquivo);
  }
  for (const task of tasksResumo) {
    for (const arquivo of task.arquivosProvaveisEditar) {
      adicionarArquivoOrcamento(arquivo);
    }
  }

  const moduloOrcamento = contexto.modulosSelecionados[0]?.resultado.ir?.nome
    ?? contexto.modulosSelecionados[0]?.resultado.modulo?.nome
    ?? "projeto";
  const exigeCabecalhoCodigoGovernado = contexto.configCarregada?.config.modoEstrito === true
    && contexto.arquivosProjeto.some((arquivo) => path.basename(arquivo).toLowerCase() === "agents.md");
  const diagnosticosOrcamento = await emitirDiagnosticosArquivosOrcamento({
    baseProjeto: contexto.baseProjeto,
    arquivos: [...arquivosOrcamento],
    exigirCabecalhoCodigoGovernado: exigeCabecalhoCodigoGovernado,
  });
  for (const diagnostico of diagnosticosOrcamento) {
    diagnosticos.push({
      tipo: diagnostico.tipo,
      modulo: moduloOrcamento,
      arquivo: diagnostico.arquivo,
      linhas: diagnostico.linhas,
      severidade: diagnostico.severidade,
      limite_bloqueio_linhas: diagnostico.limite_bloqueio_linhas,
      mensagem: diagnostico.mensagem,
    });
  }

  const possuiBloqueioOrcamento = diagnosticos.some((diagnostico) =>
    ["contrato_monolitico", "codigo_monolitico", "codigo_governado_sem_cabecalho"].includes(diagnostico.tipo)
    && diagnostico.severidade === "erro");
  const sucessoSemPontuacao = implsQuebrados.length === 0
    && rotasDivergentes.length === 0
    && recursosDivergentes.length === 0
    && vinculosQuebrados.length === 0
    && persistenciaReal.every((item) => item.status !== "divergente" && item.compatibilidade !== "invalido")
    && !possuiBloqueioOrcamento;

  const payloadBase: ResultadoDrift = {
    comando: "drift",
    sucesso: sucessoSemPontuacao,
    escopo_aplicado: configuracaoEscopo,
    consumerFramework,
    appRoutes,
    consumerSurfaces,
    consumerBridges,
    modulos: contexto.modulosSelecionados.map((item) => ({
      caminho: item.caminho,
      modulo: item.resultado.ir?.nome ?? item.resultado.modulo?.nome ?? null,
      tasks: item.resultado.ir?.tasks.length ?? 0,
      routes: item.resultado.ir?.routes.length ?? 0,
    })),
    tasks: tasksResumo,
    impls_validos: implsValidos,
    impls_quebrados: implsQuebrados,
    vinculos_validos: vinculosValidos,
    vinculos_quebrados: vinculosQuebrados,
    rotas_divergentes: rotasDivergentes,
    recursos_validos: recursosValidos,
    recursos_divergentes: recursosDivergentes,
    persistencia_real: persistenciaReal,
    diagnosticos,
    resumo_operacional: {
      scoreMedio: 0,
      confiancaGeral: "baixa" as const,
      pontuacaoMinimaOperacional: 80,
      pontuacaoAlvoAtual: 80,
      pontuacaoAlvoFinal: 100,
      passoEvolucaoPontuacao: 0.5,
      proximaPontuacaoAlvo: 80,
      pontuacaoAbaixoDoPiso: true,
      pontuacaoAbaixoDoAlvo: true,
      travasPontuacao: [],
      riscosPrincipais: [],
      oQueTocar: [],
      oQueValidar: [],
      oQueEstaFrouxo: [],
      oQueFoiInferido: [],
    },
  };
  const resumoOperacional = resumirOperacional(
    payloadBase,
    resolverPoliticaPontuacaoSemantica(contexto.configCarregada?.config),
  );
  const diagnosticosPontuacao: DiagnosticoDrift[] = resumoOperacional.travasPontuacao.map((trava) => ({
    tipo: "pontuacao_semantica_insuficiente",
    modulo: moduloOrcamento,
    severidade: "erro",
    mensagem: `Pontuacao semantica ${resumoOperacional.scoreMedio} abaixo do alvo ${resumoOperacional.pontuacaoAlvoAtual}. Piso operacional: ${resumoOperacional.pontuacaoMinimaOperacional}. Trava: ${trava}.`,
  }));

  return {
    ...payloadBase,
    sucesso: sucessoSemPontuacao && resumoOperacional.travasPontuacao.length === 0,
    diagnosticos: [
      ...payloadBase.diagnosticos,
      ...diagnosticosPontuacao,
    ],
    resumo_operacional: resumoOperacional,
  };
  } finally {
    definirDiretoriosIgnoradosAtivos(diretoriosIgnoradosAnteriores);
  }
}
