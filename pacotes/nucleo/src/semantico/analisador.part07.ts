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

import { campoStatusTexto, moduloTemStateComTransicao, validarVinculoEstadoDaTask } from "./analisador.part06.js";
import { ContextoSemantico, ResumoTaskSemantico, SimboloSemantico, TIPOS_PRIMITIVOS, coletarResumoTask, ehUseInterop, localizarBloco, validarCamposDeTipos, validarImplementacoesTask, validarVinculos } from "./analisador.part01.js";
import { emitirGuardrailsSeguranca, serializarTransicao, validarEfeitosDeclarados, validarErroOperacional, validarExpressoesDeclaradas } from "./analisador.part04.js";
import { taskEhSensivel, validarExecucao } from "./analisador.part02.js";
import { coletarPerfilSegurancaDeclarado } from "./analisador.part03.js";

export function validarStatusTextoComState(modulo: ModuloAst, diagnosticos: Diagnostico[]): void {
  if (!moduloTemStateComTransicao(modulo)) {
    return;
  }

  for (const entity of modulo.entities) {
    const fields = localizarBloco(entity.corpo, "fields");
    for (const campo of fields?.campos ?? []) {
      if (!campoStatusTexto(campo)) {
        continue;
      }
      diagnosticos.push(
        criarDiagnostico(
          "SEM100",
          `Entity "${entity.nome}" declara "${campo.nome}: Texto" enquanto o modulo tem state com transitions.`,
          "aviso",
          campo.intervalo,
          "Prefira enum/status de dominio para impedir que a IA invente estados fora do ciclo declarado.",
        ),
      );
    }
  }
}

export function criarContextoLocal(modulo: ModuloAst): ContextoSemantico {
  const simbolos = new Map<string, SimboloSemantico>();
  const tiposConhecidos = new Set(TIPOS_PRIMITIVOS);
  const tasksConhecidas = new Set<string>();
  const tarefasDetalhadas = new Map<string, ResumoTaskSemantico>();
  const statesConhecidos = new Map<string, { transicoes: Set<string> }>();
  const enumsConhecidos = new Map<string, Set<string>>();

  const registrar = (nome: string, categoria: SimboloSemantico["categoria"]): void => {
    if (simbolos.has(nome)) {
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
    registrar(type.nome, "tipo");
  }
  for (const entity of modulo.entities) {
    registrar(entity.nome, "entity");
  }
  for (const enumeracao of modulo.enums) {
    registrar(enumeracao.nome, "enum");
    enumsConhecidos.set(enumeracao.nome, new Set(enumeracao.valores));
  }
  for (const task of modulo.tasks) {
    registrar(task.nome, "task");
    tarefasDetalhadas.set(task.nome, coletarResumoTask(task));
  }
  for (const flow of modulo.flows) {
    registrar(flow.nome, "flow");
  }
  for (const route of modulo.routes) {
    registrar(route.nome, "route");
  }
  for (const worker of modulo.workers) {
    if (worker.nome) {
      registrar(worker.nome, "worker");
    }
  }
  for (const evento of modulo.eventos) {
    if (evento.nome) {
      registrar(evento.nome, "evento");
    }
  }
  for (const fila of modulo.filas) {
    if (fila.nome) {
      registrar(fila.nome, "fila");
    }
  }
  for (const cron of modulo.crons) {
    if (cron.nome) {
      registrar(cron.nome, "cron");
    }
  }
  for (const webhook of modulo.webhooks) {
    if (webhook.nome) {
      registrar(webhook.nome, "webhook");
    }
  }
  for (const cache of modulo.caches) {
    if (cache.nome) {
      registrar(cache.nome, "cache");
    }
  }
  for (const storage of modulo.storages) {
    if (storage.nome) {
      registrar(storage.nome, "storage");
    }
  }
  for (const policy of modulo.policies) {
    if (policy.nome) {
      registrar(policy.nome, "policy");
    }
  }
  for (const database of modulo.databases) {
    if (database.nome) {
      registrar(database.nome, "database");
    }
  }
  for (const state of modulo.states) {
    if (state.nome) {
      registrar(state.nome, "state");
      const transicoes = new Set(
        (localizarBloco(state.corpo, "transitions")?.linhas ?? [])
          .map((linha) => parsearTransicaoEstado(linha.conteudo))
          .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha))
          .map((linha) => serializarTransicao(linha.origem, linha.destino)),
      );
      statesConhecidos.set(state.nome, { transicoes });
    }
  }

  return {
    modulo: modulo.nome,
    simbolos,
    tiposConhecidos,
    tasksConhecidas,
    tarefasDetalhadas,
    statesConhecidos,
    modulosImportados: [],
    interoperabilidades: modulo.uses
      .filter(ehUseInterop)
      .map((use) => ({ origem: use.origem, caminho: use.caminho })),
    enumsConhecidos,
  };
}

export function validarTask(
  task: TaskAst,
  tiposConhecidos: Set<string>,
  statesConhecidos: Map<string, { transicoes: Set<string> }>,
  diagnosticos: Diagnostico[],
): void {
  if (!task.input) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM003",
        `Task "${task.nome}" precisa declarar input.`,
        "erro",
        task.intervalo,
        "Toda task precisa declarar as entradas de forma explicita.",
      ),
    );
  }

  if (!task.output) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM004",
        `Task "${task.nome}" precisa declarar output.`,
        "erro",
        task.intervalo,
        "Toda task precisa declarar a saida esperada.",
      ),
    );
  }

  if (!task.guarantees) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM005",
        `Task "${task.nome}" precisa declarar guarantees.`,
        "erro",
        task.intervalo,
        "A proposta da Sema e falhar cedo quando a pos-condicao nao esta explicita.",
      ),
    );
  }

  if (task.input) {
    validarCamposDeTipos(task.input.campos, tiposConhecidos, diagnosticos, `input da task ${task.nome}`);
  }
  if (task.output) {
    validarCamposDeTipos(task.output.campos, tiposConhecidos, diagnosticos, `output da task ${task.nome}`);
  }

  const entradasConhecidas = new Set(task.input?.campos.map((campo) => campo.nome) ?? []);
  const saidasConhecidas = new Set(task.output?.campos.map((campo) => campo.nome) ?? []);

  if (task.state) {
    for (const campo of task.output?.campos ?? []) {
      if (!campoStatusTexto(campo)) {
        continue;
      }
      diagnosticos.push(
        criarDiagnostico(
          "SEM100",
          `Task "${task.nome}" declara output "${campo.nome}: Texto" enquanto governa state.`,
          "aviso",
          campo.intervalo,
          "Use um enum/status de dominio no output para manter a transicao rastreavel para IA.",
        ),
      );
    }
  }

  if (task.rules) {
    validarExpressoesDeclaradas(task.rules.linhas, diagnosticos, {
      codigoErroSintaxe: "SEM021",
      codigoErroReferencia: "SEM022",
      nomeBloco: `rules da task ${task.nome}`,
      simbolosPermitidos: entradasConhecidas,
      dicaSintaxe: "Use expressoes como \"campo existe\", \"campo > 0\", \"campo em [A, B]\" ou \"campo deve_ser predicado\".",
      dicaReferencia: "No MVP atual, rules devem referenciar apenas campos do input.",
      dicaReferenciaPersonalizada: (raiz) => (
        saidasConhecidas.has(raiz)
          ? `\"${raiz}\" parece vir do output. Rules devem validar entrada; se a intencao era afirmar pos-condicao, mova isso para guarantees.`
          : undefined
      ),
    });
  }

  if (task.effects) {
    validarEfeitosDeclarados(task.effects.linhas, diagnosticos, `effects da task ${task.nome}`);
  }
  validarVinculos(task.vinculos, diagnosticos, `task ${task.nome}`);
  validarExecucao(task, diagnosticos);

  const perfilSeguranca = coletarPerfilSegurancaDeclarado(
    task.corpo,
    task.effects,
    diagnosticos,
    `task "${task.nome}"`,
  );
  emitirGuardrailsSeguranca(
    `Task "${task.nome}"`,
    task.intervalo,
    perfilSeguranca,
    diagnosticos,
    {
      publico: false,
      sensivel: taskEhSensivel(task) || perfilSeguranca.efeitoPrivilegiado || perfilSeguranca.dadosSensiveis || perfilSeguranca.exigeSegredos,
    },
  );

  validarImplementacoesTask(task, diagnosticos);

  if (task.tests) {
    for (const bloco of task.tests.blocos) {
      if (bloco.tipo !== "caso_teste") {
        continue;
      }
      validarCasoTeste(task, bloco, diagnosticos);
      validarTesteSemanticoForte(task, bloco, diagnosticos);
    }
  }

  if (task.guarantees && task.output) {
    validarExpressoesDeclaradas(task.guarantees.linhas, diagnosticos, {
      codigoErroSintaxe: "SEM030",
      codigoErroReferencia: "SEM031",
      nomeBloco: `guarantees da task ${task.nome}`,
      simbolosPermitidos: saidasConhecidas,
      dicaSintaxe: "Use expressoes como \"saida existe\", \"saida == valor\" ou \"saida em [A, B]\" nas guarantees.",
      dicaReferencia: "No MVP atual, guarantees devem referenciar campos do output ou marcadores semanticos permitidos.",
      aceitarMarcadoresSemanticos: true,
      dicaReferenciaPersonalizada: (raiz) => (
        entradasConhecidas.has(raiz)
          ? `\"${raiz}\" parece vir do input. Guarantees devem afirmar output, estado ou marcadores semanticos; se a intencao era validar entrada, mova isso para rules.`
          : undefined
      ),
    });
  }

  validarErroOperacional(task, diagnosticos);

  const blocoInternoTests = localizarBloco(task.corpo, "tests");
  if (blocoInternoTests && blocoInternoTests.blocos.length === 0) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM007",
        `Task "${task.nome}" declarou tests sem casos.`,
        "erro",
        blocoInternoTests.intervalo,
        "Adicione ao menos um bloco caso dentro de tests.",
      ),
    );
  }

  validarVinculoEstadoDaTask(task, statesConhecidos, diagnosticos);
}

export function validarTesteSemanticoForte(task: TaskAst, caso: BlocoCasoTesteAst, diagnosticos: Diagnostico[]): void {
  if (!taskEhSensivel(task) || !caso.expect) {
    return;
  }

  const possuiErroEsperado = Boolean(
    caso.error
    && (caso.error.campos.length > 0 || caso.error.linhas.length > 0 || caso.error.blocos.length > 0),
  );
  if (possuiErroEsperado) {
    return;
  }

  const camposExpect = caso.expect.campos.filter((campo) => campo.nome !== "");
  const somenteSucesso = camposExpect.length === 1
    && camposExpect[0]?.nome === "sucesso"
    && caso.expect.linhas.length === 0
    && caso.expect.blocos.length === 0;

  if (!somenteSucesso) {
    return;
  }

  diagnosticos.push(
    criarDiagnostico(
      "SEM102",
      `Caso de teste "${caso.nome}" da task sensivel "${task.nome}" valida apenas sucesso.`,
      "aviso",
      caso.expect.intervalo,
      "Inclua algum output, erro esperado ou garantia observavel para a IA nao tratar 'sucesso' como contrato completo.",
    ),
  );
}

export function emitirDiagnosticosContratoFrouxo(task: TaskAst, diagnosticos: Diagnostico[]): void {
  for (const bloco of task.tests?.blocos ?? []) {
    if (bloco.tipo === "caso_teste") {
      validarTesteSemanticoForte(task, bloco, diagnosticos);
    }
  }
}

export function validarCasoTeste(task: TaskAst, caso: BlocoCasoTesteAst, diagnosticos: Diagnostico[]): void {
  if (!caso.given) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM008",
        `Caso de teste "${caso.nome}" da task "${task.nome}" precisa declarar given.`,
        "erro",
        caso.intervalo,
      ),
    );
  }
  if (!caso.expect) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM009",
        `Caso de teste "${caso.nome}" da task "${task.nome}" precisa declarar expect.`,
        "erro",
        caso.intervalo,
      ),
    );
  }
}
