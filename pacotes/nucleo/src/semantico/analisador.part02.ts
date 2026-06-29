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

import { CAMPOS_EXECUCAO_SUPORTADOS, CRITICIDADES_OPERACIONAIS, SimboloSemantico, extrairPerfilCompatibilidade, localizarCampo, valorCampoCompleto } from "./analisador.part01.js";

export function validarCamposSuportadosPersistencia(
  bloco: BlocoGenericoAst,
  camposSuportados: Set<string>,
  diagnosticos: Diagnostico[],
  contexto: string,
  codigo: string,
  dica: string,
): void {
  for (const campo of bloco.campos) {
    if (camposSuportados.has(campo.nome)) {
      continue;
    }
    diagnosticos.push(
      criarDiagnostico(
        codigo,
        `Campo de persistencia "${campo.nome}" nao e suportado em ${contexto}.`,
        "erro",
        campo.intervalo,
        dica,
      ),
    );
  }
}

export function validarBooleanoPersistencia(
  valor: string | undefined,
  intervalo: CampoAst["intervalo"],
  diagnosticos: Diagnostico[],
  codigo: string,
  mensagem: string,
): void {
  if (!valor) {
    return;
  }
  if (parsearBooleanoPersistencia(valor) !== undefined) {
    return;
  }
  diagnosticos.push(
    criarDiagnostico(
      codigo,
      mensagem,
      "erro",
      intervalo,
      "Use verdadeiro/falso ou true/false.",
    ),
  );
}

export function validarRecursoPersistencia(
  database: BlocoGenericoAst,
  recurso: BlocoGenericoAst,
  diagnosticos: Diagnostico[],
): void {
  const engine = normalizarEngineBanco(valorCampoCompleto(localizarCampo(database, "engine")));
  if (!engine) {
    return;
  }

  validarCamposSuportadosPersistencia(
    recurso,
    CAMPOS_RECURSO_PERSISTENCIA_SUPORTADOS,
    diagnosticos,
    `resource "${recurso.nome ?? recurso.palavraChave}" do database "${database.nome ?? "database"}"`,
    "SEM106",
    "Use apenas entity, consistency, durability, transaction_model, query_model, portavel, mode, isolation, strategy, ttl, retention, path, from, to, surface, adapter, resource_kind, collection, table ou compatibilidade.",
  );

  const tipoRecurso = nomeTipoRecursoPersistencia(recurso);
  if (!tipoRecurso) {
    return;
  }

  const nomeRecurso = recurso.nome ?? tipoRecurso;
  const contexto = `resource "${nomeRecurso}" do database "${database.nome ?? "database"}"`;
  const consistency = valorCampoCompleto(localizarCampo(recurso, "consistency"));
  const durability = valorCampoCompleto(localizarCampo(recurso, "durability"));
  const transactionModel = valorCampoCompleto(localizarCampo(recurso, "transaction_model"));
  const queryModel = valorCampoCompleto(localizarCampo(recurso, "query_model"));
  const mode = valorCampoCompleto(localizarCampo(recurso, "mode"));
  const portavel = valorCampoCompleto(localizarCampo(recurso, "portavel"));
  const isolation = valorCampoCompleto(localizarCampo(recurso, "isolation"));

  if (consistency && !normalizarConsistenciaPersistencia(consistency)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM107",
        `${contexto} declarou consistency invalida: "${consistency}".`,
        "erro",
        localizarCampo(recurso, "consistency")?.intervalo,
        "Use eventual, forte, serializable, snapshot ou causal.",
      ),
    );
  }

  if (durability && !normalizarDurabilidadePersistencia(durability)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM108",
        `${contexto} declarou durability invalida: "${durability}".`,
        "erro",
        localizarCampo(recurso, "durability")?.intervalo,
        "Use baixa, media ou alta.",
      ),
    );
  }

  if (transactionModel && !normalizarModeloTransacaoPersistencia(transactionModel)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM109",
        `${contexto} declarou transaction_model invalido: "${transactionModel}".`,
        "erro",
        localizarCampo(recurso, "transaction_model")?.intervalo,
        "Use mvcc, bloqueio, documento, otimista ou single_thread.",
      ),
    );
  }

  if (queryModel && !normalizarModeloConsultaPersistencia(queryModel)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM110",
        `${contexto} declarou query_model invalido: "${queryModel}".`,
        "erro",
        localizarCampo(recurso, "query_model")?.intervalo,
        "Use sql, documento, chave_valor, pipeline ou stream.",
      ),
    );
  }

  if (mode && !normalizarModeloConsultaPersistencia(mode)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM111",
        `${contexto} declarou mode invalido: "${mode}".`,
        "erro",
        localizarCampo(recurso, "mode")?.intervalo,
        "Use sql, documento, chave_valor, pipeline ou stream.",
      ),
    );
  }

  const compatibilidade = classificarCompatibilidadePersistencia(tipoRecurso, engine, { mode, isolation });
  if (compatibilidade.status === "invalido") {
    diagnosticos.push(
      criarDiagnostico(
        "SEM112",
        `${contexto} nao e compativel com o engine ${engine}.`,
        "erro",
        recurso.intervalo,
        compatibilidade.motivo,
      ),
    );
  }

  validarBooleanoPersistencia(
    portavel,
    localizarCampo(recurso, "portavel")?.intervalo ?? recurso.intervalo,
    diagnosticos,
    "SEM113",
    `${contexto} declarou portavel com valor invalido: "${portavel}".`,
  );

  if (parsearBooleanoPersistencia(portavel) && !recursoPersistenciaPodeSerPortavel(tipoRecurso, { mode, isolation })) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM114",
        `${contexto} foi marcado como portavel, mas a compatibilidade entre os cinco bancos nao fecha sem perdas reais.`,
        "aviso",
        localizarCampo(recurso, "portavel")?.intervalo ?? recurso.intervalo,
        "Remova portavel ou reduza o recurso para um baseline comum entre postgres, mysql, sqlite, mongodb e redis.",
      ),
    );
  }
}

export function validarDatabase(database: BlocoGenericoAst, diagnosticos: Diagnostico[]): void {
  validarCamposSuportadosPersistencia(
    database,
    CAMPOS_DATABASE_SUPORTADOS,
    diagnosticos,
    `database "${database.nome ?? "database"}"`,
    "SEM100",
    "Use apenas engine, schema, database, consistency, durability, transaction_model, query_model, portavel, adapter, perfil ou compatibilidade.",
  );

  const campoEngine = localizarCampo(database, "engine");
  const engineBruto = valorCampoCompleto(campoEngine);
  if (!engineBruto) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM101",
        `Database "${database.nome ?? "database"}" precisa declarar engine.`,
        "erro",
        database.intervalo,
        "Use postgres, mysql, sqlite, mongodb ou redis.",
      ),
    );
    return;
  }

  const engine = normalizarEngineBanco(engineBruto);
  if (!engine) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM102",
        `Database "${database.nome ?? "database"}" declarou engine invalido: "${engineBruto}".`,
        "erro",
        campoEngine?.intervalo ?? database.intervalo,
        "Use postgres, mysql, sqlite, mongodb ou redis.",
      ),
    );
    return;
  }

  const consistency = valorCampoCompleto(localizarCampo(database, "consistency"));
  const durability = valorCampoCompleto(localizarCampo(database, "durability"));
  const transactionModel = valorCampoCompleto(localizarCampo(database, "transaction_model"));
  const queryModel = valorCampoCompleto(localizarCampo(database, "query_model"));
  const portavel = valorCampoCompleto(localizarCampo(database, "portavel"));

  if (consistency && !normalizarConsistenciaPersistencia(consistency)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM103",
        `Database "${database.nome ?? "database"}" declarou consistency invalida: "${consistency}".`,
        "erro",
        localizarCampo(database, "consistency")?.intervalo,
        "Use eventual, forte, serializable, snapshot ou causal.",
      ),
    );
  }

  if (durability && !normalizarDurabilidadePersistencia(durability)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM104",
        `Database "${database.nome ?? "database"}" declarou durability invalida: "${durability}".`,
        "erro",
        localizarCampo(database, "durability")?.intervalo,
        "Use baixa, media ou alta.",
      ),
    );
  }

  if (transactionModel && !normalizarModeloTransacaoPersistencia(transactionModel)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM105",
        `Database "${database.nome ?? "database"}" declarou transaction_model invalido: "${transactionModel}".`,
        "erro",
        localizarCampo(database, "transaction_model")?.intervalo,
        "Use mvcc, bloqueio, documento, otimista ou single_thread.",
      ),
    );
  }

  if (queryModel && !normalizarModeloConsultaPersistencia(queryModel)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM115",
        `Database "${database.nome ?? "database"}" declarou query_model invalido: "${queryModel}".`,
        "erro",
        localizarCampo(database, "query_model")?.intervalo,
        "Use sql, documento, chave_valor, pipeline ou stream.",
      ),
    );
  }

  validarBooleanoPersistencia(
    portavel,
    localizarCampo(database, "portavel")?.intervalo ?? database.intervalo,
    diagnosticos,
    "SEM116",
    `Database "${database.nome ?? "database"}" declarou portavel com valor invalido: "${portavel}".`,
  );

  for (const recurso of database.blocos) {
    if (recurso.tipo !== "bloco_generico") {
      continue;
    }
    validarRecursoPersistencia(database, recurso, diagnosticos);
  }
}

export function coletarSuperficiesModulo(modulo: ModuloAst): Array<{ tipo: SimboloSemantico["categoria"]; superficie: BlocoGenericoAst }> {
  return [
    ...modulo.workers.map((superficie) => ({ tipo: "worker" as const, superficie })),
    ...modulo.eventos.map((superficie) => ({ tipo: "evento" as const, superficie })),
    ...modulo.filas.map((superficie) => ({ tipo: "fila" as const, superficie })),
    ...modulo.crons.map((superficie) => ({ tipo: "cron" as const, superficie })),
    ...modulo.webhooks.map((superficie) => ({ tipo: "webhook" as const, superficie })),
    ...modulo.caches.map((superficie) => ({ tipo: "cache" as const, superficie })),
    ...modulo.storages.map((superficie) => ({ tipo: "storage" as const, superficie })),
    ...modulo.policies.map((superficie) => ({ tipo: "policy" as const, superficie })),
  ];
}

export function superficieEhPublica(
  superficie: BlocoGenericoAst,
  tipoSuperficie: SimboloSemantico["categoria"],
): boolean {
  return extrairPerfilCompatibilidade(superficie, tipoSuperficie === "webhook" ? "publico" : "interno") === "publico";
}

export function taskEhSensivel(task: TaskAst): boolean {
  const criticidadeOperacional = task.execucao
    ? valorCampoCompleto(localizarCampo(task.execucao, "criticidade_operacional"))
    : undefined;
  if (criticidadeOperacional === "alta" || criticidadeOperacional === "critica") {
    return true;
  }

  return (task.effects?.linhas ?? []).some((linha) => {
    const efeito = parsearEfeitoSemantico(linha.conteudo);
    if (!efeito) {
      return false;
    }
    return efeito.categoria === "persistencia" || efeito.criticidade === "alta" || efeito.criticidade === "critica" || efeitoEhPrivilegiado(efeito);
  });
}

export function taskTemRastreabilidade(task: TaskAst): boolean {
  return Boolean(task.impl || task.vinculos);
}

export function routeEhMutante(route: RouteAst): boolean {
  const metodo = (localizarCampo(route.corpo, "metodo")?.valor ?? "").toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(metodo);
}

export function validarExecucaoBloco(
  execucao: BlocoGenericoAst | undefined,
  diagnosticos: Diagnostico[],
  contexto: string,
): void {
  if (!execucao) {
    return;
  }

  for (const campo of execucao.campos) {
    if (!CAMPOS_EXECUCAO_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM065",
          `Campo de execucao "${campo.nome}" nao e suportado em ${contexto}.`,
          "erro",
          campo.intervalo,
          "Use apenas idempotencia, timeout, retry, compensacao ou criticidade_operacional.",
        ),
      );
      continue;
    }

    if (campo.nome === "criticidade_operacional") {
      const criticidade = valorCampoCompleto(campo);
      if (criticidade && !CRITICIDADES_OPERACIONAIS.has(criticidade)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM066",
            `Execucao de ${contexto} declarou criticidade_operacional invalida: "${criticidade}".`,
            "erro",
            campo.intervalo,
            "Use apenas baixa, media, alta ou critica em execucao.",
          ),
        );
      }
    }
  }

  const criticidade = valorCampoCompleto(localizarCampo(execucao, "criticidade_operacional"));
  const idempotencia = localizarCampo(execucao, "idempotencia");
  if ((criticidade === "alta" || criticidade === "critica") && !idempotencia) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM101",
        `Execucao critica em ${contexto} deveria declarar idempotencia explicita.`,
        "aviso",
        execucao.intervalo,
        "Declare idempotencia: verdadeiro ou idempotencia: falso para a IA nao assumir retry seguro no escuro.",
      ),
    );
  }
}

export function validarExecucao(task: TaskAst, diagnosticos: Diagnostico[]): void {
  validarExecucaoBloco(task.execucao, diagnosticos, `task "${task.nome}"`);
}

export interface PerfilSegurancaDeclarado {
  auth: ReturnType<typeof extrairContratoAuth>;
  authz: ReturnType<typeof extrairContratoAuthz>;
  dados: ReturnType<typeof extrairContratoDados>;
  audit: ReturnType<typeof extrairContratoAudit>;
  segredos: ReturnType<typeof extrairContratoSegredos>;
  forbidden: ReturnType<typeof extrairContratoForbidden>;
  efeitoPrivilegiado: boolean;
  dadosSensiveis: boolean;
  exigeSegredos: boolean;
}
