// SEMA-GOVERNED: sema.software
// Descricao: nucleo semantico particionado; consulte contratos/sema/software.sema antes de editar.

import { criarDiagnostico, type Diagnostico } from "../diagnosticos/index.js";
import type {
  BlocoCasoTesteAst,
  BlocoGenericoAst,
  CampoAst,
  EntityAst,
  EnumAst,
  FlowAst,
  ModuloAst,
  RouteAst,
  StateAst,
  TaskAst,
  TypeAst,
} from "../ast/tipos.js";
import {
  CAMPOS_DATABASE_SUPORTADOS,
  CAMPOS_RECURSO_PERSISTENCIA_SUPORTADOS,
  classificarCompatibilidadePersistencia,
  nomeTipoRecursoPersistencia,
  normalizarConsistenciaPersistencia,
  normalizarDurabilidadePersistencia,
  normalizarEngineBanco,
  normalizarModeloConsultaPersistencia,
  normalizarModeloTransacaoPersistencia,
  parsearBooleanoPersistencia,
  recursoPersistenciaPodeSerPortavel,
} from "../persistencia/contratos.js";
import {
  ehCategoriaEfeitoSemantico,
  ehCriticidadeEfeitoSemantico,
  extrairReferenciasDaExpressao,
  parsearEfeitoSemantico,
  parsearEtapaFlow,
  parsearExpressaoSemantica,
  parsearTransicaoEstado,
} from "./estruturas.js";
import {
  CLASSIFICACOES_DADO_SUPORTADAS,
  MODOS_AUTH_SUPORTADOS,
  MOTIVOS_AUDIT_SUPORTADOS,
  ORIGENS_AUTH_SUPORTADAS,
  PRINCIPAIS_AUTH_SUPORTADOS,
  REDACOES_LOG_SUPORTADAS,
  TENANTS_AUTHZ_SUPORTADOS,
  contratoDadosTemSegredoOuCredencial,
  contratoDadosTemSensivel,
  extrairContratoAudit,
  extrairContratoAuth,
  extrairContratoAuthz,
  extrairContratoDados,
  extrairContratoForbidden,
  extrairContratoSegredos,
  efeitoEhPrivilegiado,
  efeitoRequerSegredo,
  forbiddenContemRegra,
} from "./seguranca.js";

import { InteropSemantico, OpcoesAnaliseSemantica, PADRAO_CAMINHO_INTEROP, ResultadoSemantico, ResumoTaskSemantico, SimboloSemantico, TIPOS_PRIMITIVOS, coletarResumoTask, diagnosticoDuplicado, localizarBloco, localizarCampo, validarCamposDeTipos, validarVinculos } from "./analisador.part01.js";
import { descreverSugestoes, recomporCaminhoRoute, resolverUseSema, serializarTransicao, validarSuperficie } from "./analisador.part04.js";
import { validarFlow, validarInvariantesDeCampos, validarState } from "./analisador.part05.js";
import { validarStatusTextoComState, validarTask } from "./analisador.part07.js";
import { validarGuardrailsSeguranca, validarRoute } from "./analisador.part06.js";
import { validarDatabase } from "./analisador.part02.js";

export function analisarSemantica(modulo: ModuloAst, opcoes: OpcoesAnaliseSemantica = {}): ResultadoSemantico {
  const diagnosticos: Diagnostico[] = [];
  const simbolos = new Map<string, SimboloSemantico>();
  const tiposConhecidos = new Set(TIPOS_PRIMITIVOS);
  const tasksConhecidas = new Set<string>();
  const tarefasDetalhadas = new Map<string, ResumoTaskSemantico>();
  const statesConhecidos = new Map<string, { transicoes: Set<string> }>();
  const modulosImportados: string[] = [];
  const interoperabilidades: InteropSemantico[] = [];
  const enumsConhecidos = new Map<string, Set<string>>();

  for (const use of modulo.uses) {
    if (use.origem !== "sema") {
      if (!PADRAO_CAMINHO_INTEROP.test(use.caminho)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM058",
            `Interop externa "${use.origem} ${use.caminho}" e invalida no modulo "${modulo.nome}".`,
            "erro",
            use.intervalo,
            "Use um identificador de modulo externo como pacote.servico, app.modulo ou dominio.executor.",
          ),
        );
        continue;
      }
      interoperabilidades.push({ origem: use.origem, caminho: use.caminho });
      continue;
    }

    const resolucaoUse = resolverUseSema(modulo.nome, use.caminho, opcoes.contextosModulos);
    const contextoImportado = resolucaoUse.caminhoResolvido
      ? opcoes.contextosModulos?.get(resolucaoUse.caminhoResolvido)
      : undefined;
    if (!contextoImportado) {
      const candidatosEncontrados = resolucaoUse.candidatosRelativos
        .filter((candidato) => opcoes.contextosModulos?.has(candidato))
        .slice(0, 4);
      const sugestoesModulos = descreverSugestoes(opcoes.contextosModulos?.keys() ?? [], "Modulos disponiveis neste contexto");
      diagnosticos.push(
        criarDiagnostico(
          "SEM019",
          `Modulo "${modulo.nome}" usa "${use.caminho}", mas esse modulo nao foi encontrado no projeto atual.`,
          "erro",
          use.intervalo,
          candidatosEncontrados.length > 0
            ? `Se a intencao era um import relativo ao namespace atual, tente um caminho como ${candidatosEncontrados.join(", ")}.`
            : (sugestoesModulos ?? "Garanta que o arquivo .sema importado esteja presente no mesmo conjunto de compilacao."),
        ),
      );
      continue;
    }

    modulosImportados.push(resolucaoUse.caminhoResolvido ?? use.caminho);
    for (const tipo of contextoImportado.tiposConhecidos) {
      tiposConhecidos.add(tipo);
    }
    for (const task of contextoImportado.tasksConhecidas) {
      tasksConhecidas.add(task);
    }
    for (const [nomeTask, detalhesTask] of contextoImportado.tarefasDetalhadas) {
      tarefasDetalhadas.set(nomeTask, {
        input: detalhesTask.input.map((campo) => ({ ...campo, modificadores: [...campo.modificadores] })),
        output: detalhesTask.output.map((campo) => ({ ...campo, modificadores: [...campo.modificadores] })),
        errors: detalhesTask.errors.map((erro) => ({ ...erro })),
        guarantees: [...detalhesTask.guarantees],
        implementacoes: detalhesTask.implementacoes.map((impl) => ({ ...impl })),
      });
    }
    for (const [nomeState, metadadosState] of contextoImportado.statesConhecidos) {
      statesConhecidos.set(nomeState, { transicoes: new Set(metadadosState.transicoes) });
    }
    for (const [nomeEnum, valores] of contextoImportado.enumsConhecidos) {
      enumsConhecidos.set(nomeEnum, new Set(valores));
    }
    for (const interop of contextoImportado.interoperabilidades) {
      interoperabilidades.push({ ...interop });
    }
  }

  const registrar = (
    nome: string,
    categoria: SimboloSemantico["categoria"],
    intervalo?: TypeAst["intervalo"] | EntityAst["intervalo"] | EnumAst["intervalo"],
  ): void => {
    if (simbolos.has(nome)) {
      diagnosticos.push(diagnosticoDuplicado(nome, categoria, intervalo));
      return;
    }
    simbolos.set(nome, { nome, categoria });
    if (categoria === "task") {
      tasksConhecidas.add(nome);
      return;
    }
    if (categoria !== "database") {
      tiposConhecidos.add(nome);
    }
  };

  for (const type of modulo.types) {
    registrar(type.nome, "tipo", type.intervalo);
  }
  for (const entity of modulo.entities) {
    registrar(entity.nome, "entity", entity.intervalo);
  }
  for (const enumeracao of modulo.enums) {
    registrar(enumeracao.nome, "enum", enumeracao.intervalo);
    enumsConhecidos.set(enumeracao.nome, new Set(enumeracao.valores));
  }
  for (const task of modulo.tasks) {
    registrar(task.nome, "task", task.intervalo);
    tarefasDetalhadas.set(task.nome, coletarResumoTask(task));
  }
  for (const flow of modulo.flows) {
    registrar(flow.nome, "flow", flow.intervalo);
  }
  for (const route of modulo.routes) {
    registrar(route.nome, "route", route.intervalo);
  }
  for (const worker of modulo.workers) {
    if (worker.nome) {
      registrar(worker.nome, "worker", worker.intervalo);
    }
  }
  for (const evento of modulo.eventos) {
    if (evento.nome) {
      registrar(evento.nome, "evento", evento.intervalo);
    }
  }
  for (const fila of modulo.filas) {
    if (fila.nome) {
      registrar(fila.nome, "fila", fila.intervalo);
    }
  }
  for (const cron of modulo.crons) {
    if (cron.nome) {
      registrar(cron.nome, "cron", cron.intervalo);
    }
  }
  for (const webhook of modulo.webhooks) {
    if (webhook.nome) {
      registrar(webhook.nome, "webhook", webhook.intervalo);
    }
  }
  for (const cache of modulo.caches) {
    if (cache.nome) {
      registrar(cache.nome, "cache", cache.intervalo);
    }
  }
  for (const storage of modulo.storages) {
    if (storage.nome) {
      registrar(storage.nome, "storage", storage.intervalo);
    }
  }
  for (const policy of modulo.policies) {
    if (policy.nome) {
      registrar(policy.nome, "policy", policy.intervalo);
    }
  }
  for (const database of modulo.databases) {
    if (database.nome) {
      registrar(database.nome, "database", database.intervalo);
    }
  }
  for (const state of modulo.states) {
    if (state.nome) {
      registrar(state.nome, "state", state.intervalo);
      const transicoes = new Set(
        (localizarBloco(state.corpo, "transitions")?.linhas ?? [])
          .map((linha) => parsearTransicaoEstado(linha.conteudo))
          .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha))
          .map((linha) => serializarTransicao(linha.origem, linha.destino)),
      );
      statesConhecidos.set(state.nome, { transicoes });
    }
  }

  for (const type of modulo.types) {
    validarCamposDeTipos(type.corpo.campos, tiposConhecidos, diagnosticos, `type ${type.nome}`);
    const fields = localizarBloco(type.corpo, "fields");
    if (fields) {
      validarCamposDeTipos(fields.campos, tiposConhecidos, diagnosticos, `fields do type ${type.nome}`);
    }
    validarInvariantesDeCampos(type.corpo, `type ${type.nome}`, diagnosticos);
  }

  for (const entity of modulo.entities) {
    const fields = localizarBloco(entity.corpo, "fields");
    if (!fields || fields.campos.length === 0) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM010",
          `Entity "${entity.nome}" precisa declarar fields.`,
          "erro",
          entity.intervalo,
          "Adicione um bloco fields com os campos da entidade.",
        ),
      );
    } else {
      validarCamposDeTipos(fields.campos, tiposConhecidos, diagnosticos, `entity ${entity.nome}`);
    }
    validarInvariantesDeCampos(entity.corpo, `entity ${entity.nome}`, diagnosticos);
  }

  for (const task of modulo.tasks) {
    validarTask(task, tiposConhecidos, statesConhecidos, diagnosticos);
  }

  for (const flow of modulo.flows) {
    validarFlow(flow, tasksConhecidas, tarefasDetalhadas, diagnosticos);
  }

  for (const route of modulo.routes) {
    validarRoute(route, tasksConhecidas, tarefasDetalhadas, diagnosticos);
  }

  validarVinculos(modulo.vinculos, diagnosticos, `modulo ${modulo.nome}`);
  for (const worker of modulo.workers) {
    validarSuperficie(worker, "worker", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const evento of modulo.eventos) {
    validarSuperficie(evento, "evento", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const fila of modulo.filas) {
    validarSuperficie(fila, "fila", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const cron of modulo.crons) {
    validarSuperficie(cron, "cron", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const webhook of modulo.webhooks) {
    validarSuperficie(webhook, "webhook", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const cache of modulo.caches) {
    validarSuperficie(cache, "cache", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const storage of modulo.storages) {
    validarSuperficie(storage, "storage", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const policy of modulo.policies) {
    validarSuperficie(policy, "policy", tasksConhecidas, tiposConhecidos, diagnosticos);
  }
  for (const database of modulo.databases) {
    validarDatabase(database, diagnosticos);
  }
  validarGuardrailsSeguranca(modulo, diagnosticos);

  const assinaturasRoute = new Map<string, RouteAst>();
  for (const route of modulo.routes) {
    const metodo = (localizarCampo(route.corpo, "metodo")?.valor ?? "").toUpperCase();
    const caminho = recomporCaminhoRoute(localizarCampo(route.corpo, "caminho")) ?? "";
    if (!metodo || !caminho) {
      continue;
    }
    const chave = `${metodo} ${caminho}`;
    const existente = assinaturasRoute.get(chave);
    if (existente) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM055",
          `Route "${route.nome}" reutiliza a assinatura publica "${chave}", ja declarada por "${existente.nome}".`,
          "erro",
          route.intervalo,
          "Cada combinacao de metodo e caminho deve ser unica no mesmo modulo.",
        ),
      );
      continue;
    }
    assinaturasRoute.set(chave, route);
  }

  for (const state of modulo.states) {
    validarState(state, tiposConhecidos, enumsConhecidos, diagnosticos);
  }
  validarStatusTextoComState(modulo, diagnosticos);

  return {
    contexto: {
      modulo: modulo.nome,
      simbolos,
      tiposConhecidos,
      tasksConhecidas,
      tarefasDetalhadas,
      statesConhecidos,
      modulosImportados,
      interoperabilidades,
      enumsConhecidos,
    },
    diagnosticos,
  };
}
