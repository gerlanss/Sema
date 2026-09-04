// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.governanca_ia.drift.cache.store
// Descrição: integra índices calculados ou reutilizados e sempre recalcula o resultado final do drift.

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
import { resolverAlvoPadrao, resolverEstruturaSaidaPadrao, resolverFrameworkPadrao } from "./projeto.js";
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
import {
  emitirDiagnosticosArquivosOrcamento,
  type LeitorArquivosOrcamento,
  workspaceExigeCabecalhoCodigoGovernado,
} from "./driftOrcamento.js";

import { ConfiguracaoEscopoDriftAplicada, DiagnosticoDrift, OpcoesDriftLegado, RegistroImplDrift, RegistroRecursoDrift, RegistroRotaDivergente, RegistroVinculoDrift, ResultadoDrift, SimboloCandidatoDrift, SimboloResolvido, definirDiretoriosIgnoradosAtivos, obterDiretoriosIgnoradosAtivos, extrairTermosEscopoDrift, resolverDiretoriosIgnoradosAtivos, resolverOpcoesDrift } from "./drift.part01.js";
import { construirContextoRelevanciaConsumer, filtrarConsumerSurfacesPorEscopo, resolverDiretoriosCodigoEscopoReal } from "./drift.part02.js";
import { indexarTypeScript, inferirConsumerFrameworkPrincipal } from "./drift.part06.js";
import { indexarCpp, indexarDart, indexarDotnet, indexarGo, indexarJava, indexarLua, indexarPersistenciaDeclarativa, indexarPython, indexarRust } from "./drift.part07.js";
import { indexarPersistenciaDetalhada, resolverPersistenciaLocalPorTask } from "./drift.part08.js";
import { calcularConfiancaTask, calcularRiscoOperacional, calcularScoreTask, carregarEvidenciaVerificacaoDrift, chaveCaminhoCanonicoDrift, encontrarAncoraSuperficie, encontrarCandidatosFisicosImplementacaoDrift, indexarArquivosRastreaveis, resumirLacunasTask, resumirOperacional } from "./drift.part04.js";
import { coletarVinculosIr, construirMapaRecursos, extrairRecursosEsperados, resolverRecursoEsperado } from "./drift.part10.js";
import { analisarPersistenciaReal, escolherRotasEsperadas, normalizarCaminhoRota, ordenarCandidatos, sugerirCandidatosParaImpl, sugerirCandidatosParaTaskSemImpl } from "./drift.part09.js";
import { escolherArquivoPorVinculo, escolherSimboloPorVinculo } from "./drift.part03.js";
import { simboloEhBridgeConsumer } from "./drift.part05.js";
import { prepararIndicesDrift } from "./drift.part13.js";
import { sondarCaminhosDeclaradosExistentes } from "./driftEscopo.js";
import { analisarModulosSelecionadosDrift, coletarCaminhosDeclaradosVinculosDrift } from "./drift.part14.js";
import { resolverPoliticaPontuacaoSemantica } from "./driftScore.js";

interface UsoImplementacaoDrift {
  modulo: string;
  task: string;
  origem: RegistroImplDrift["origem"];
  caminho: string;
  implementacao: IrTask["implementacoesExternas"][number];
  candidatos: SimboloResolvido[];
  resolvido?: SimboloResolvido;
  ambiguo: boolean;
}

interface SubstituicaoCaminhoImplementacaoDrift {
  implementacao: IrTask["implementacoesExternas"][number];
  original: string;
  temporario: string;
}

function arquivosVinculadosFisicamenteDrift(
  contexto: ContextoProjetoCarregado,
  modulo: IrModulo,
  task: IrTask,
): Set<string> {
  const arquivos = new Set<string>();
  for (const vinculo of [...modulo.vinculos, ...task.vinculos]) {
    const arquivo = vinculo.arquivo
      ?? (vinculo.tipo === "arquivo" ? vinculo.valor : undefined);
    if (arquivo) {
      arquivos.add(chaveCaminhoCanonicoDrift(path.resolve(contexto.baseProjeto, arquivo)));
    }
  }
  return arquivos;
}

function prepararMapaImplementacoesHonestoDrift(
  contexto: ContextoProjetoCarregado,
  mapaImpl: Map<string, SimboloResolvido>,
  todosSimbolos: SimboloResolvido[],
): {
  mapaImplHonesto: Map<string, SimboloResolvido>;
  ambiguidades: UsoImplementacaoDrift[];
  substituicoesCaminho: SubstituicaoCaminhoImplementacaoDrift[];
} {
  const mapaImplHonesto = new Map(mapaImpl);
  const usosPorOrigemECaminho = new Map<string, UsoImplementacaoDrift[]>();

  for (const item of contexto.modulosSelecionados) {
    const ir = item.resultado.ir;
    if (!ir) {
      continue;
    }
    for (const task of ir.tasks) {
      const arquivosVinculados = arquivosVinculadosFisicamenteDrift(contexto, ir, task);
      for (const impl of task.implementacoesExternas) {
        const candidatos = encontrarCandidatosFisicosImplementacaoDrift(
          todosSimbolos,
          impl.origem,
          impl.caminho,
        );
        const candidatosVinculados = candidatos.filter((candidato) =>
          arquivosVinculados.has(chaveCaminhoCanonicoDrift(candidato.arquivo)));
        const resolvido = candidatos.length === 1
          ? candidatos[0]
          : candidatosVinculados.length === 1
            ? candidatosVinculados[0]
            : undefined;
        const uso: UsoImplementacaoDrift = {
          modulo: ir.nome,
          task: task.nome,
          origem: impl.origem,
          caminho: impl.caminho,
          implementacao: impl,
          candidatos,
          resolvido,
          ambiguo: candidatos.length > 1 && candidatosVinculados.length !== 1,
        };
        const chaveGrupo = `${impl.origem}\u0000${impl.caminho}`;
        const usos = usosPorOrigemECaminho.get(chaveGrupo) ?? [];
        usos.push(uso);
        usosPorOrigemECaminho.set(chaveGrupo, usos);
      }
    }
  }

  const ambiguidades: UsoImplementacaoDrift[] = [];
  const gruposPorCaminho = new Map<string, Array<{
    usos: UsoImplementacaoDrift[];
    resolvido?: SimboloResolvido;
  }>>();
  for (const usos of usosPorOrigemECaminho.values()) {
    const caminho = usos[0]!.caminho;
    const resolvidos = new Map<string, SimboloResolvido>();
    for (const uso of usos) {
      if (uso.resolvido) {
        resolvidos.set(chaveCaminhoCanonicoDrift(uso.resolvido.arquivo), uso.resolvido);
      }
    }
    const conflitoEntreUsos = resolvidos.size > 1;
    const deveFalharFechado = usos.some((uso) => uso.ambiguo || !uso.resolvido)
      || conflitoEntreUsos;
    if (deveFalharFechado && (usos.some((uso) => uso.ambiguo) || conflitoEntreUsos)) {
      const candidatosDoGrupo = [...new Map(
        usos.flatMap((uso) => uso.candidatos).map((candidato) => [
          chaveCaminhoCanonicoDrift(candidato.arquivo),
          candidato,
        ] as const),
      ).values()];
      for (const uso of usos) {
        ambiguidades.push({
          ...uso,
          candidatos: uso.candidatos.length > 1 ? uso.candidatos : candidatosDoGrupo,
          ambiguo: true,
        });
      }
    }
    const grupos = gruposPorCaminho.get(caminho) ?? [];
    grupos.push({
      usos,
      resolvido: deveFalharFechado ? undefined : resolvidos.values().next().value,
    });
    gruposPorCaminho.set(caminho, grupos);
  }

  const substituicoesCaminho: SubstituicaoCaminhoImplementacaoDrift[] = [];
  let sequenciaCaminhoTemporario = 0;
  for (const [caminho, grupos] of gruposPorCaminho) {
    mapaImplHonesto.delete(caminho);
    const gruposResolvidos = grupos.filter((grupo) => grupo.resolvido);
    const resolucoesDistintas = new Map<string, SimboloResolvido>();
    for (const grupo of gruposResolvidos) {
      const resolvido = grupo.resolvido!;
      resolucoesDistintas.set(
        `${resolvido.origem}:${chaveCaminhoCanonicoDrift(resolvido.arquivo)}:${resolvido.caminho}`,
        resolvido,
      );
    }
    if (gruposResolvidos.length === grupos.length && resolucoesDistintas.size === 1) {
      mapaImplHonesto.set(caminho, resolucoesDistintas.values().next().value!);
      continue;
    }
    for (const grupo of gruposResolvidos) {
      for (const uso of grupo.usos) {
        const temporario = `__sema_impl_${sequenciaCaminhoTemporario++}`;
        mapaImplHonesto.set(temporario, uso.resolvido!);
        substituicoesCaminho.push({
          implementacao: uso.implementacao,
          original: uso.caminho,
          temporario,
        });
      }
    }
  }

  return { mapaImplHonesto, ambiguidades, substituicoesCaminho };
}

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
  const indicesPreparados = await prepararIndicesDrift(contexto, configuracaoEscopo, {
    observador: opcoesResolvidas.observador,
    modoCache: opcoesResolvidas.modoCache,
    avisosModoCache: opcoesResolvidas.avisosModoCache,
  });
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
    planoEscopo,
    cache: estadoCache,
    catalogo: metricasCatalogo,
    leitorArquivosPlanejados,
  } = indicesPreparados;
  const relativoEscopo = (arquivo: string): string => {
    const relativo = path.relative(contexto.baseProjeto, arquivo).replace(/\\/g, "/");
    return relativo && !relativo.startsWith("../")
      ? relativo
      : arquivo.replace(/\\/g, "/");
  };
  configuracaoEscopo.estrategia = planoEscopo.estrategia;
  configuracaoEscopo.cobertura = planoEscopo.cobertura;
  configuracaoEscopo.arquivosPlanejados = planoEscopo.arquivos.map(relativoEscopo);
  configuracaoEscopo.arquivosDeclarados = planoEscopo.arquivosDeclarados.map(relativoEscopo);
  configuracaoEscopo.arquivosInferidos = planoEscopo.arquivosInferidos.map(relativoEscopo);
  configuracaoEscopo.arquivosAusentes = planoEscopo.arquivosAusentes.map(relativoEscopo);
  configuracaoEscopo.arquivosAusentesInferidos = planoEscopo.arquivosAusentesInferidos.map(relativoEscopo);
  const bloqueiosAnalise = new Set(planoEscopo.bloqueios);
  configuracaoEscopo.bloqueios = [...bloqueiosAnalise];
  configuracaoEscopo.catalogo = metricasCatalogo;
  configuracaoEscopo.cache = estadoCache;

  const { mapaImplHonesto, ambiguidades, substituicoesCaminho } = prepararMapaImplementacoesHonestoDrift(
    contexto,
    mapaImpl,
    todosSimbolos,
  );


  const implsValidos: RegistroImplDrift[] = [];
  const implsQuebrados: RegistroImplDrift[] = [];
  const vinculosValidos: RegistroVinculoDrift[] = [];
  const vinculosQuebrados: RegistroVinculoDrift[] = [];
  const vinculosForaDoEscopo: RegistroVinculoDrift[] = [];
  const rotasDivergentes: RegistroRotaDivergente[] = [];
  const recursosValidos: RegistroRecursoDrift[] = [];
  const recursosDivergentes: RegistroRecursoDrift[] = [];
  const diagnosticos: DiagnosticoDrift[] = [];
  const moduloDiagnostico = contexto.modulosSelecionados[0]?.resultado.ir?.nome
    ?? contexto.modulosSelecionados[0]?.resultado.modulo?.nome
    ?? "projeto";
  for (const arquivoAusente of planoEscopo.arquivosAusentes) {
    const arquivo = relativoEscopo(arquivoAusente);
    diagnosticos.push({
      tipo: "vinculo_quebrado",
      modulo: moduloDiagnostico,
      arquivo,
      severidade: "erro",
      mensagem: `O arquivo planejado "${arquivo}" não existe no workspace; a cobertura do drift ficou parcial.`,
    });
  }
  if (planoEscopo.cobertura === "parcial" && planoEscopo.arquivosAusentes.length === 0) {
    diagnosticos.push({
      tipo: "vinculo_quebrado",
      modulo: moduloDiagnostico,
      severidade: "erro",
      mensagem: "A cobertura do drift ficou parcial e não permite declarar a análise como bem-sucedida.",
    });
  }
  if (planoEscopo.bloqueios.includes("escopo_estreito_sem_vinculos")) {
    diagnosticos.push({
      tipo: "escopo_estreito_sem_vinculos",
      modulo: moduloDiagnostico,
      severidade: "erro",
      mensagem: "Escopo de arquivo ou módulo sem arquivo vinculado nem implementação resolvível. Declare `vinculos { arquivo: ... }` ou execute explicitamente com `--escopo projeto`.",
    });
  }
  if (planoEscopo.bloqueios.includes("escopo_estreito_ambiguo")) {
    diagnosticos.push({
      tipo: "escopo_estreito_ambiguo",
      modulo: moduloDiagnostico,
      severidade: "erro",
      mensagem: "Mais de um arquivo pode implementar o mesmo símbolo. Declare um vínculo de arquivo inequívoco antes do drift.",
    });
  }
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
  // O analisador legado consulta implementações apenas pelo caminho. Chaves efêmeras
  // mantêm resoluções de origens distintas isoladas durante essa chamada e são restauradas logo depois.
  for (const substituicao of substituicoesCaminho) {
    substituicao.implementacao.caminho = substituicao.temporario;
  }
  // Sonda previa: distingue vinculo apontando para arquivo inexistente de
  // arquivo existente fora dos diretoriosCodigo (informativo, nao bloqueante).
  const caminhosDeclaradosVinculos = coletarCaminhosDeclaradosVinculosDrift(contexto);
  const arquivosDeclaradosExistentes = caminhosDeclaradosVinculos.length > 0
    ? await sondarCaminhosDeclaradosExistentes(caminhosDeclaradosVinculos, contexto.baseProjeto)
    : new Map<string, boolean>();
  try {
    analisarModulosSelecionadosDrift({
      contexto,
      mapaImpl: mapaImplHonesto,
      todosSimbolos,
      mapaRecursos,
      todosRecursos,
      todasRotasIndexadas,
      todosArquivosConhecidos,
      implsValidos,
      implsQuebrados,
      vinculosValidos,
      vinculosQuebrados,
      vinculosForaDoEscopo,
      arquivosDeclaradosExistentes,
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
  } finally {
    for (const substituicao of substituicoesCaminho) {
      substituicao.implementacao.caminho = substituicao.original;
    }
  }
  const caminhoOriginalPorTemporario = new Map(
    substituicoesCaminho.map((substituicao) => [substituicao.temporario, substituicao.original] as const),
  );
  for (const registro of [...implsValidos, ...implsQuebrados]) {
    registro.caminho = caminhoOriginalPorTemporario.get(registro.caminho) ?? registro.caminho;
  }

  for (const ambiguidade of ambiguidades) {
    const candidatos: SimboloCandidatoDrift[] = ambiguidade.candidatos.map((candidato) => ({
      origem: candidato.origem as RegistroImplDrift["origem"],
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: `Arquivo físico candidato à implementação ambígua "${ambiguidade.origem}:${ambiguidade.caminho}".`,
    }));
    const registro = implsQuebrados.find((impl) =>
      impl.modulo === ambiguidade.modulo
      && impl.task === ambiguidade.task
      && impl.origem === ambiguidade.origem
      && impl.caminho === ambiguidade.caminho);
    if (registro) {
      registro.candidatos = candidatos;
    }
    const resumo = tasksResumo.find((task) =>
      task.modulo === ambiguidade.modulo && task.task === ambiguidade.task);
    if (resumo) {
      const arquivosCandidatos = new Set(candidatos.map((candidato) =>
        chaveCaminhoCanonicoDrift(candidato.arquivo)));
      const candidatosRestantes = resumo.candidatosImpl.filter((candidato) =>
        !arquivosCandidatos.has(chaveCaminhoCanonicoDrift(candidato.arquivo)));
      resumo.candidatosImpl = [
        ...candidatos,
        ...ordenarCandidatos(candidatosRestantes),
      ].slice(0, 5);
    }
    diagnosticos.push({
      tipo: "escopo_estreito_ambiguo",
      modulo: ambiguidade.modulo,
      task: ambiguidade.task,
      severidade: "erro",
      mensagem: `A implementação "${ambiguidade.origem}:${ambiguidade.caminho}" é ambígua: ${candidatos.length} arquivos físicos correspondem ao mesmo caminho semântico. Declare um vínculo de arquivo inequívoco.`,
    });
    bloqueiosAnalise.add("escopo_estreito_ambiguo");
  }
  configuracaoEscopo.bloqueios = [...bloqueiosAnalise];

  const evidenciaPorModulo = new Map<string, Awaited<ReturnType<typeof carregarEvidenciaVerificacaoDrift>>>();
  for (const item of contexto.modulosSelecionados) {
    const nomeModulo = item.resultado.ir?.nome;
    if (!nomeModulo) {
      continue;
    }
    const frameworkVerificacao = resolverFrameworkPadrao(undefined, contexto.configCarregada);
    const evidencia = await carregarEvidenciaVerificacaoDrift({
      caminhoContrato: item.caminho,
      nomeModulo,
      alvo: resolverAlvoPadrao(undefined, contexto.configCarregada),
      framework: frameworkVerificacao,
      estrutura: resolverEstruturaSaidaPadrao(undefined, frameworkVerificacao, contexto.configCarregada),
    });
    if (evidencia) {
      evidenciaPorModulo.set(nomeModulo, evidencia);
    }
  }

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
    const evidenciaVerificada = evidenciaPorModulo.get(resumo.modulo);
    resumo.lacunas = resumirLacunasTask(task, resumo.semImplementacao, resumo.implsQuebrados, resumoVinculos.quebrados, guardrails, evidenciaVerificada);
    resumo.scoreSemantico = calcularScoreTask(task, resumo.implsValidos, resumo.implsQuebrados, resumoVinculos.validos, resumoVinculos.quebrados, resumo.semImplementacao, evidenciaVerificada);
    resumo.evidenciaVerificacao = evidenciaVerificada;
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
  const persistenciaReal = await analisarPersistenciaReal(contexto, mapaRecursos, detalhesPersistencia, opcoesResolvidas, mapaImplHonesto);
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
  const exigeCabecalhoCodigoGovernado = await workspaceExigeCabecalhoCodigoGovernado(
    contexto.baseProjeto,
    contexto.configCarregada?.config.modoEstrito === true,
  );
  const chaveArquivoOrcamento = (arquivo: string): string => {
    const absoluto = path.resolve(contexto.baseProjeto, arquivo);
    return process.platform === "win32" ? absoluto.toLowerCase() : absoluto;
  };
  const contratosJaCarregados = new Map(
    contexto.modulosCarregados.map((modulo) => [
      chaveArquivoOrcamento(modulo.caminho),
      modulo.codigo,
    ] as const),
  );
  const leitorArquivosOrcamento: LeitorArquivosOrcamento = {
    contem: (arquivo) => {
      const chave = chaveArquivoOrcamento(arquivo);
      return contratosJaCarregados.has(chave)
        || leitorArquivosPlanejados.contem(arquivo);
    },
    lerTexto: async (arquivo) => {
      const contrato = contratosJaCarregados.get(chaveArquivoOrcamento(arquivo));
      if (contrato !== undefined) {
        return contrato;
      }
      if (!leitorArquivosPlanejados.contem(arquivo)) {
        throw new Error(`Arquivo fora do catálogo planejado do drift: ${arquivo}`);
      }
      return leitorArquivosPlanejados.lerTexto(arquivo);
    },
  };
  const arquivosOrcamentoPlanejados = [...arquivosOrcamento]
    .filter((arquivo) => leitorArquivosOrcamento.contem(arquivo));
  const diagnosticosOrcamento = await emitirDiagnosticosArquivosOrcamento({
    baseProjeto: contexto.baseProjeto,
    arquivos: arquivosOrcamentoPlanejados,
    exigirCabecalhoCodigoGovernado: exigeCabecalhoCodigoGovernado,
    leitorArquivos: leitorArquivosOrcamento,
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
    && planoEscopo.cobertura === "completa"
    && planoEscopo.arquivosAusentes.length === 0
    && bloqueiosAnalise.size === 0
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
    vinculos_fora_do_escopo: vinculosForaDoEscopo,
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
