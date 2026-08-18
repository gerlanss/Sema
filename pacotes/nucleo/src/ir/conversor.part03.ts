// SEMA-GOVERNED: sema.software
// Descricao: nucleo semantico particionado; consulte contratos/sema/software.sema antes de editar.

import type { BlocoCasoTesteAst, BlocoGenericoAst, CampoAst, ModuloAst } from "../ast/tipos.js";
import type { Diagnostico } from "../diagnosticos/index.js";
import {
  localizarCampoPersistencia,
  matrizCompatibilidadePersistencia,
  nomeTipoRecursoPersistencia,
  normalizarConsistenciaPersistencia,
  normalizarDurabilidadePersistencia,
  normalizarEngineBanco,
  normalizarModeloConsultaPersistencia,
  normalizarModeloTransacaoPersistencia,
  parsearBooleanoPersistencia,
  TIPOS_RECURSO_PERSISTENCIA,
  type TipoRecursoPersistencia,
} from "../persistencia/contratos.js";
import type { ContextoSemantico, ErroSemanticoTask } from "../semantico/analisador.js";
import {
  contratoDadosTemSensivel,
  extrairContratoAudit,
  extrairContratoAuth,
  extrairContratoAuthz,
  extrairContratoDados,
  extrairContratoForbidden,
  extrairContratoSegredos,
  efeitoEhPrivilegiado,
} from "../semantico/seguranca.js";
import { parsearEfeitoSemantico, parsearEtapaFlow, parsearExpressaoSemantica, parsearTransicaoEstado } from "../semantico/estruturas.js";
import type {
  IrBlocoDeclarativo,
  IrCampo,
  IrCasoTeste,
  IrAudit,
  IrAuth,
  IrAuthz,
  IrDados,
  IrEntity,
  IrErroOperacional,
  IrExecucao,
  IrForbidden,
  IrFlow,
  IrImplementacaoTask,
  IrBancoDados,
  IrCompatibilidadePersistencia,
  IrModulo,
  IrRecursoPersistencia,
  IrResumoAgente,
  IrRoute,
  IrRoutePublica,
  IrSegredos,
  IrState,
  IrSuperficie,
  IrTask,
  IrType,
  IrVinculo,
  NivelConfiancaSemantica,
  NivelRiscoSemantico,
  PerfilCompatibilidade,
  TipoSuperficieIr,
} from "./modelos.js";

import { calcularConfiancaPublica, calcularRiscoPublico, converterErroPublico, converterSuperficie, deduplicarTexto, ehUseInterop, extrairPerfil, recomporCaminho, resumirAgente } from "./conversor.part02.js";
import { converterAudit, converterAuth, converterAuthz, converterBloco, converterCampos, converterCaso, converterDados, converterDatabase, converterErrosTask, converterExecucao, converterForbidden, converterImplementacoes, converterSegredos, converterVinculos, encontrarSubBloco } from "./conversor.part01.js";

export function converterParaIr(modulo: ModuloAst, diagnosticos: Diagnostico[], contexto?: ContextoSemantico): IrModulo {
  const perfilModulo = extrairPerfil(modulo.vinculos, modulo.routes.length > 0 || modulo.webhooks.length > 0 ? "publico" : "interno");

  const types: IrType[] = modulo.types.map((type) => ({
    nome: type.nome,
    definicao: converterBloco(encontrarSubBloco(type.corpo, "fields") ?? type.corpo),
    invariantes: (encontrarSubBloco(type.corpo, "invariants")?.linhas ?? [])
      .map((linha) => parsearExpressaoSemantica(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
  }));

  const entities: IrEntity[] = modulo.entities.map((entity) => ({
    nome: entity.nome,
    campos: converterCampos(encontrarSubBloco(entity.corpo, "fields")),
    invariantes: (encontrarSubBloco(entity.corpo, "invariants")?.linhas ?? [])
      .map((linha) => parsearExpressaoSemantica(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
  }));

  const tarefasSemanticas = contexto?.tarefasDetalhadas ?? new Map();
  const tasks: IrTask[] = modulo.tasks.map((task) => {
    const input = converterCampos(task.input);
    const output = converterCampos(task.output);
    const effects = (task.effects?.linhas ?? [])
      .map((linha) => parsearEfeitoSemantico(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
    const vinculos = converterVinculos(task.vinculos);
    const execucao = converterExecucao(task.execucao);
    const auth = converterAuth(encontrarSubBloco(task.corpo, "auth"));
    const authz = converterAuthz(encontrarSubBloco(task.corpo, "authz"));
    const dados = converterDados(encontrarSubBloco(task.corpo, "dados"));
    const audit = converterAudit(encontrarSubBloco(task.corpo, "audit"));
    const segredos = converterSegredos(encontrarSubBloco(task.corpo, "segredos"));
    const forbidden = converterForbidden(encontrarSubBloco(task.corpo, "forbidden"));
    const errosDetalhados = converterErrosTask(task.error, tarefasSemanticas.get(task.nome)?.errors);
    const perfilCompatibilidade = extrairPerfil(task.corpo, "interno");
    const resumoAgente = resumirAgente({
      input,
      output,
      efeitos: effects,
      vinculos,
      execucao,
      auth,
      authz,
      dados,
      audit,
      segredos,
      forbidden,
    });

    return {
      nome: task.nome,
      input,
      output,
      rules: task.rules?.linhas.map((linha) => linha.conteudo) ?? [],
      regrasEstruturadas: (task.rules?.linhas ?? [])
        .map((linha) => parsearExpressaoSemantica(linha.conteudo))
        .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
      effects: task.effects?.linhas.map((linha) => linha.conteudo) ?? [],
      efeitosEstruturados: effects,
      implementacoesExternas: converterImplementacoes(task.impl),
      vinculos,
      execucao,
      auth,
      authz,
      dados,
      audit,
      segredos,
      forbidden,
      guarantees: task.guarantees?.linhas.map((linha) => linha.conteudo) ?? [],
      garantiasEstruturadas: (task.guarantees?.linhas ?? [])
        .map((linha) => parsearExpressaoSemantica(linha.conteudo))
        .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
      errors: Object.fromEntries(errosDetalhados.map((erro) => [erro.codigo, erro.mensagem])),
      errosDetalhados,
      perfilCompatibilidade,
      stateContract: task.state ? {
        nomeEstado: task.state.nome ?? task.state.campos.find((campo) => campo.nome === "state" || campo.nome === "estado")?.valor,
        campos: converterCampos(task.state),
        linhas: task.state.linhas.map((linha) => linha.conteudo),
        transicoes: (encontrarSubBloco(task.state, "transitions")?.linhas ?? task.state.linhas)
          .map((linha) => parsearTransicaoEstado(linha.conteudo))
          .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
      } : undefined,
      resumoAgente,
      tests: (task.tests?.blocos.filter((bloco): bloco is BlocoCasoTesteAst => bloco.tipo === "caso_teste") ?? []).map(converterCaso),
    };
  });

  const tarefasPorNome = new Map(tasks.map((task) => [task.nome, task] as const));

  const flows: IrFlow[] = modulo.flows.map((flow) => {
    const campos = converterCampos(flow.corpo);
    const effects = (encontrarSubBloco(flow.corpo, "effects")?.linhas ?? [])
      .map((linha) => parsearEfeitoSemantico(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
    const vinculos = converterVinculos(flow.vinculos);
    const perfilCompatibilidade = extrairPerfil(flow.corpo, "interno");
    return {
      nome: flow.nome,
      campos,
      linhas: flow.corpo.linhas.map((linha) => linha.conteudo),
      tasksReferenciadas: flow.corpo.campos
        .filter((campo) => campo.nome === "task" || campo.nome === "tarefa")
        .map((campo) => campo.valor),
      etapasEstruturadas: flow.corpo.linhas
        .map((linha) => parsearEtapaFlow(linha.conteudo))
        .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
      effects: (encontrarSubBloco(flow.corpo, "effects")?.linhas ?? []).map((linha) => linha.conteudo),
      efeitosEstruturados: effects,
      vinculos,
      perfilCompatibilidade,
      resumoAgente: resumirAgente({
        input: campos,
        efeitos: effects,
        vinculos,
      }),
    };
  });

  const routes: IrRoute[] = modulo.routes.map((route) => ({
    nome: route.nome,
    campos: converterCampos(route.corpo),
    linhas: route.corpo.linhas.map((linha) => linha.conteudo),
    metodo: route.corpo.campos.find((campo) => campo.nome === "metodo")?.valor,
    caminho: recomporCaminho(route.corpo.campos.find((campo) => campo.nome === "caminho")),
    task: route.corpo.campos.find((campo) => campo.nome === "task" || campo.nome === "tarefa")?.valor,
    inputPublico: [],
    outputPublico: [],
    errosPublicos: [],
    efeitosPublicos: [],
    vinculos: converterVinculos(route.vinculos),
    auth: converterAuth(encontrarSubBloco(route.corpo, "auth")),
    authz: converterAuthz(encontrarSubBloco(route.corpo, "authz")),
    dados: converterDados(encontrarSubBloco(route.corpo, "dados")),
    audit: converterAudit(encontrarSubBloco(route.corpo, "audit")),
    segredos: converterSegredos(encontrarSubBloco(route.corpo, "segredos")),
    forbidden: converterForbidden(encontrarSubBloco(route.corpo, "forbidden")),
    perfilCompatibilidade: extrairPerfil(route.corpo, "publico"),
    garantiasPublicasMinimas: [],
    resumoAgente: {
      riscos: [],
      checks: [],
      entidadesAfetadas: [],
      superficiesPublicas: [],
      mutacoesPrevistas: [],
    },
    publico: {
      metodo: undefined,
      caminho: undefined,
      task: undefined,
      input: [],
      output: [],
      errors: [],
      effects: [],
      garantiasMinimas: [],
    },
  })).map((route) => {
    const routeAst = modulo.routes.find((item) => item.nome === route.nome)!;
    const tarefaAssociada = route.task ? tarefasPorNome.get(route.task) : undefined;
    const tarefaSemantica = route.task ? tarefasSemanticas.get(route.task) : undefined;
    const inputPublicoDeclarado = converterCampos(encontrarSubBloco(routeAst.corpo, "input"));
    const outputPublicoDeclarado = converterCampos(encontrarSubBloco(routeAst.corpo, "output"));
    const errosDeclarados = converterErrosTask(encontrarSubBloco(routeAst.corpo, "error"), tarefaSemantica?.errors);
    const efeitosPublicosDeclarados = (encontrarSubBloco(routeAst.corpo, "effects")?.linhas ?? [])
      .map((linha) => parsearEfeitoSemantico(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
    const inputPublicoResolvido = inputPublicoDeclarado.length > 0
      ? inputPublicoDeclarado
      : (tarefaAssociada?.input ?? tarefaSemantica?.input?.map((campo: { nome: string; tipo: string; modificadores: string[] }) => ({
        nome: campo.nome,
        tipo: campo.tipo,
        modificadores: campo.modificadores,
        tipoOriginal: campo.tipo,
        tipoBase: campo.tipo,
        cardinalidade: "unitario" as const,
        opcional: false,
        tiposAlternativos: [],
        refinamentos: [],
      })) ?? []);
    const outputPublicoResolvido = outputPublicoDeclarado.length > 0
      ? outputPublicoDeclarado
      : (tarefaAssociada?.output ?? tarefaSemantica?.output?.map((campo: { nome: string; tipo: string; modificadores: string[] }) => ({
        nome: campo.nome,
        tipo: campo.tipo,
        modificadores: campo.modificadores,
        tipoOriginal: campo.tipo,
        tipoBase: campo.tipo,
        cardinalidade: "unitario" as const,
        opcional: false,
        tiposAlternativos: [],
        refinamentos: [],
      })) ?? []);
    const errosPublicosResolvidos = errosDeclarados.length > 0
      ? errosDeclarados.map((erro) => converterErroPublico(erro, route.task))
      : (tarefaAssociada?.errosDetalhados ?? (tarefaSemantica?.errors ?? []).map((erro: { codigo: string; mensagem: string }) => ({ codigo: erro.codigo, mensagem: erro.mensagem }))).map((erro: IrErroOperacional) =>
        converterErroPublico(erro, route.task));
    const garantiasPublicasMinimas = (tarefaAssociada?.guarantees ?? tarefaSemantica?.guarantees ?? []).filter((garantia: string) => {
      const referencia = garantia.trim().split(/\s+/)[0] ?? "";
      return outputPublicoResolvido.some((campo: IrCampo) => campo.nome === referencia || garantia.includes(`${campo.nome}.`));
    });

    const routeResolvida: IrRoute = {
      ...route,
      inputPublico: inputPublicoResolvido,
      outputPublico: outputPublicoResolvido,
      errosPublicos: errosPublicosResolvidos,
      efeitosPublicos: efeitosPublicosDeclarados,
      garantiasPublicasMinimas,
      resumoAgente: resumirAgente({
        input: inputPublicoResolvido,
        output: outputPublicoResolvido,
        efeitos: efeitosPublicosDeclarados,
        vinculos: route.vinculos,
        auth: route.auth,
        authz: route.authz,
        dados: route.dados,
        audit: route.audit,
        segredos: route.segredos,
        forbidden: route.forbidden,
        superficiePublica: `${route.metodo ?? "?"} ${route.caminho ?? "?"}`,
      }),
      publico: {
        metodo: route.metodo,
        caminho: route.caminho,
        task: route.task,
        input: inputPublicoResolvido,
        output: outputPublicoResolvido,
        errors: errosPublicosResolvidos,
        effects: efeitosPublicosDeclarados,
        garantiasMinimas: garantiasPublicasMinimas,
        confiancaContrato: "media",
        riscoRegressao: "medio",
        divergenciasPublicas: [],
      },
    };

    routeResolvida.publico.confiancaContrato = calcularConfiancaPublica(routeResolvida);
    routeResolvida.publico.riscoRegressao = calcularRiscoPublico(routeResolvida);
    return routeResolvida;
  });

  const superficies: IrSuperficie[] = [
    ...modulo.workers.map((item) => converterSuperficie("worker", item)),
    ...modulo.eventos.map((item) => converterSuperficie("evento", item)),
    ...modulo.filas.map((item) => converterSuperficie("fila", item)),
    ...modulo.crons.map((item) => converterSuperficie("cron", item)),
    ...modulo.webhooks.map((item) => converterSuperficie("webhook", item)),
    ...modulo.caches.map((item) => converterSuperficie("cache", item)),
    ...modulo.storages.map((item) => converterSuperficie("storage", item)),
    ...modulo.policies.map((item) => converterSuperficie("policy", item)),
  ];

  const states: IrState[] = modulo.states.map((state) => ({
    nome: state.nome,
    campos: converterCampos(encontrarSubBloco(state.corpo, "fields") ?? state.corpo),
    linhas: state.corpo.linhas.map((linha) => linha.conteudo),
    invariantes: (encontrarSubBloco(state.corpo, "invariants")?.linhas ?? [])
      .map((linha) => parsearExpressaoSemantica(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
    transicoes: (encontrarSubBloco(state.corpo, "transitions")?.linhas ?? [])
      .map((linha) => parsearTransicaoEstado(linha.conteudo))
      .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha)),
  }));

  const databases = modulo.databases.map(converterDatabase);

  const resumoAgenteModulo = resumirAgente({
    input: [],
    output: [],
    efeitos: [
      ...tasks.flatMap((task) => task.efeitosEstruturados),
      ...routes.flatMap((route) => route.efeitosPublicos),
      ...superficies.flatMap((superficie) => superficie.effects),
    ],
    vinculos: [
      ...converterVinculos(modulo.vinculos),
      ...tasks.flatMap((task) => task.vinculos),
      ...routes.flatMap((route) => route.vinculos),
      ...superficies.flatMap((superficie) => superficie.vinculos),
    ],
  });

  const designBloco = modulo.design;
  const tokensDesign = designBloco?.blocos.find((bloco): bloco is import("../ast/tipos.js").BlocoGenericoAst =>
    bloco.tipo === "bloco_generico" && bloco.palavraChave === "tokens");
  const design = designBloco
    ? {
        dominio: designBloco.campos.find((campo) => campo.nome === "dominio")?.valor,
        identidade: designBloco.campos.find((campo) => campo.nome === "identidade")?.valor,
        tokens: {
          ...Object.fromEntries(
            (tokensDesign?.campos ?? [])
              .filter((campo) => ["paleta", "tipografia", "densidade", "forma", "movimento"].includes(campo.nome))
              .map((campo) => [campo.nome, campo.valor]),
          ),
          overrides: Object.fromEntries(
            (tokensDesign?.campos ?? [])
              .filter((campo) => !["paleta", "tipografia", "densidade", "forma", "movimento"].includes(campo.nome))
              .map((campo) => [campo.nome, campo.valor]),
          ),
        },
      }
    : undefined;

  return {
    nome: modulo.nome,
    design,
    uses: contexto?.modulosImportados.length
      ? [...contexto.modulosImportados]
      : modulo.uses.filter((use) => use.origem === "sema").map((use) => use.caminho),
    imports: modulo.uses.map((use) => ({
      origem: use.origem,
      caminho: use.caminho,
      externo: use.origem !== "sema",
    })),
    interoperabilidades: contexto?.interoperabilidades.map((interop) => ({ ...interop })) ?? modulo.uses
      .filter(ehUseInterop)
      .map((use) => ({ origem: use.origem, caminho: use.caminho })),
    vinculos: converterVinculos(modulo.vinculos),
    perfilCompatibilidade: perfilModulo,
    types,
    entities,
    enums: modulo.enums.map((enumeracao) => ({ nome: enumeracao.nome, valores: enumeracao.valores })),
    tasks,
    flows,
    routes,
    superficies,
    states,
    databases,
    resumoAgente: {
      ...resumoAgenteModulo,
      superficiesPublicas: deduplicarTexto([
        ...routes.map((route) => `${route.metodo ?? "?"} ${route.caminho ?? route.nome}`),
        ...superficies
          .filter((superficie) => superficie.perfilCompatibilidade === "publico")
          .map((superficie) => `${superficie.tipo}:${superficie.nome}`),
      ]),
    },
    diagnosticos,
  };
}
