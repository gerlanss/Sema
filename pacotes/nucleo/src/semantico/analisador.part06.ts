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

import { ResumoTaskSemantico, extrairPerfilCompatibilidade, indiceErros, indicesCampos, localizarBloco, localizarCampo, validarVinculos } from "./analisador.part01.js";
import { emitirGuardrailsSeguranca, recomporCaminhoRoute, serializarTransicao, validarEfeitosDeclarados } from "./analisador.part04.js";
import { coletarPerfilSegurancaDeclarado } from "./analisador.part03.js";
import { PerfilSegurancaDeclarado, coletarSuperficiesModulo, routeEhMutante, superficieEhPublica, taskEhSensivel, taskTemRastreabilidade } from "./analisador.part02.js";

export function validarVinculoEstadoDaTask(
  task: TaskAst,
  statesConhecidos: Map<string, { transicoes: Set<string> }>,
  diagnosticos: Diagnostico[],
): void {
  if (!task.state) {
    return;
  }

  const nomeEstado = task.state.nome ?? task.state.campos.find((campo) => campo.nome === "state" || campo.nome === "estado")?.valor;
  if (!nomeEstado) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM037",
        `Task "${task.nome}" declarou state sem indicar qual estado ela governa.`,
        "erro",
        task.state.intervalo,
        "Use \"state nome_do_estado { ... }\" ou declare \"estado: nome_do_estado\" dentro do bloco state da task.",
      ),
    );
    return;
  }

  const blocoTransitions = localizarBloco(task.state, "transitions");
  const linhasTransicao = blocoTransitions?.linhas ?? task.state.linhas;
  const transicoesLocais = new Set(
    linhasTransicao
      .map((linha) => parsearTransicaoEstado(linha.conteudo))
      .filter((transicao): transicao is NonNullable<typeof transicao> => Boolean(transicao))
      .map((transicao) => serializarTransicao(transicao.origem, transicao.destino)),
  );

  const estadoConhecido = statesConhecidos.get(nomeEstado)
    ?? (transicoesLocais.size > 0 ? { transicoes: transicoesLocais } : undefined);
  if (!estadoConhecido) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM038",
        `Task "${task.nome}" referencia state "${nomeEstado}", mas esse state nao foi encontrado.`,
        "erro",
        task.state.intervalo,
        "Declare o state no mesmo modulo ou importe um modulo que exponha esse state.",
      ),
    );
    return;
  }

  if (linhasTransicao.length === 0) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM039",
        `Task "${task.nome}" referencia state "${nomeEstado}" sem declarar transicoes.`,
        "erro",
        task.state.intervalo,
        "Declare ao menos uma transicao para explicitar como a task altera o estado.",
      ),
    );
    return;
  }

  for (const linha of linhasTransicao) {
    const transicao = parsearTransicaoEstado(linha.conteudo);
    if (!transicao) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM040",
          `Task "${task.nome}" declarou uma transicao invalida no state "${nomeEstado}": "${linha.conteudo}".`,
          "erro",
          linha.intervalo,
          "Use o formato \"ORIGEM -> DESTINO\" dentro do bloco transitions da task.",
        ),
      );
      continue;
    }

    if (!estadoConhecido.transicoes.has(serializarTransicao(transicao.origem, transicao.destino))) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM041",
          `Task "${task.nome}" declarou a transicao "${transicao.origem} -> ${transicao.destino}" fora do contrato do state "${nomeEstado}".`,
          "erro",
          linha.intervalo,
          "Use apenas transicoes declaradas no state associado a task.",
        ),
      );
    }
  }
}

export function validarContratoRoute(
  route: RouteAst,
  taskNome: string,
  tarefasDetalhadas: Map<string, ResumoTaskSemantico>,
  diagnosticos: Diagnostico[],
): void {
  const inputPublico = localizarBloco(route.corpo, "input");
  const outputPublico = localizarBloco(route.corpo, "output");
  const errorPublico = localizarBloco(route.corpo, "error");
  const detalhesTask = tarefasDetalhadas.get(taskNome);

  if (!detalhesTask) {
    return;
  }

  const indiceInputTask = indicesCampos(detalhesTask.input);
  const indiceOutputTask = indicesCampos(detalhesTask.output);
  const indiceErrorsTask = indiceErros(detalhesTask.errors);

  if (inputPublico) {
    for (const campo of inputPublico.campos) {
      const campoTask = indiceInputTask.get(campo.nome);
      if (!campoTask) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM049",
            `Route "${route.nome}" expoe o campo de input "${campo.nome}", mas ele nao existe na task "${taskNome}".`,
            "erro",
            campo.intervalo,
            "Use apenas campos declarados no input da task associada a route.",
          ),
        );
        continue;
      }

      if (campoTask.tipo !== campo.valor) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM053",
            `Route "${route.nome}" declara o campo publico "${campo.nome}" com tipo "${campo.valor}", mas a task "${taskNome}" usa "${campoTask.tipo}".`,
            "erro",
            campo.intervalo,
            "Mantenha o tipo publico coerente com o contrato interno da task.",
          ),
        );
      }
    }
  }

  if (outputPublico) {
    for (const campo of outputPublico.campos) {
      const campoTask = indiceOutputTask.get(campo.nome);
      if (!campoTask) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM050",
            `Route "${route.nome}" expoe o campo de output "${campo.nome}", mas ele nao existe na task "${taskNome}".`,
            "erro",
            campo.intervalo,
            "Use apenas campos declarados no output da task associada a route.",
          ),
        );
        continue;
      }

      if (campoTask.tipo !== campo.valor) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM054",
            `Route "${route.nome}" declara o campo publico de saida "${campo.nome}" com tipo "${campo.valor}", mas a task "${taskNome}" usa "${campoTask.tipo}".`,
            "erro",
            campo.intervalo,
            "Mantenha o output publico coerente com o contrato interno da task.",
          ),
        );
      }
    }
  }

  if (errorPublico) {
    for (const campo of errorPublico.campos) {
      if (!indiceErrorsTask.has(campo.nome)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM051",
            `Route "${route.nome}" expoe o erro "${campo.nome}", mas ele nao pertence ao contrato da task "${taskNome}".`,
            "erro",
            campo.intervalo,
            "Exponha apenas erros declarados pela task associada a route.",
          ),
        );
      }
    }
  }
}

export function validarRoute(
  route: RouteAst,
  tasksConhecidas: Set<string>,
  tarefasDetalhadas: Map<string, ResumoTaskSemantico>,
  diagnosticos: Diagnostico[],
): void {
  const metodo = localizarCampo(route.corpo, "metodo");
  const caminho = localizarCampo(route.corpo, "caminho");
  const caminhoResolvido = recomporCaminhoRoute(caminho);
  const task = localizarCampo(route.corpo, "task", "tarefa");
  const effects = localizarBloco(route.corpo, "effects");

  if (!metodo) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM014",
        `Route "${route.nome}" precisa declarar o campo metodo.`,
        "erro",
        route.intervalo,
        "Use um campo como metodo: GET, POST, PUT, PATCH ou DELETE.",
      ),
    );
  }

  if (!caminho) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM015",
        `Route "${route.nome}" precisa declarar o campo caminho.`,
        "erro",
        route.intervalo,
        "Use um campo como caminho: \"/recurso\".",
      ),
    );
  }

  if (metodo) {
    const metodosValidos = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
    if (!metodosValidos.has(metodo.valor.toUpperCase())) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM016",
          `Route "${route.nome}" usa metodo invalido "${metodo.valor}".`,
          "erro",
          metodo.intervalo,
          "Use apenas GET, POST, PUT, PATCH ou DELETE no MVP.",
        ),
      );
    }
  }

  if (caminho && (!caminhoResolvido || !caminhoResolvido.startsWith("/"))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM017",
          `Route "${route.nome}" precisa usar um caminho iniciando com '/'.`,
          "erro",
          caminho.intervalo,
          "Exemplo valido: caminho: \"/produtos\".",
      ),
    );
  }

  if (effects) {
    validarEfeitosDeclarados(effects.linhas, diagnosticos, `effects da route ${route.nome}`);
  }
  validarVinculos(route.vinculos, diagnosticos, `route ${route.nome}`);

  const perfilSeguranca = coletarPerfilSegurancaDeclarado(
    route.corpo,
    effects,
    diagnosticos,
    `route "${route.nome}"`,
  );
  emitirGuardrailsSeguranca(
    `Route "${route.nome}"`,
    route.intervalo,
    perfilSeguranca,
    diagnosticos,
    {
      publico: extrairPerfilCompatibilidade(route.corpo, "publico") === "publico",
      sensivel: routeEhMutante(route) || perfilSeguranca.efeitoPrivilegiado || perfilSeguranca.dadosSensiveis,
    },
  );

  if (task && !tasksConhecidas.has(task.valor)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM018",
        `Route "${route.nome}" referencia task "${task.valor}" que nao existe.`,
        "erro",
        task.intervalo,
        "Ajuste o campo task da route para apontar para uma task declarada no modulo.",
      ),
    );
    return;
  }

  if (task) {
    validarContratoRoute(route, task.valor, tarefasDetalhadas, diagnosticos);
  }
}

export function validarGuardrailsSeguranca(modulo: ModuloAst, diagnosticos: Diagnostico[]): void {
  const superficies = coletarSuperficiesModulo(modulo);

  for (const task of modulo.tasks) {
    const motivos = new Set<string>();
    const rotasPublicasAssociadas = modulo.routes.filter((route) =>
      localizarCampo(route.corpo, "task", "tarefa")?.valor === task.nome
      && extrairPerfilCompatibilidade(route.corpo, "publico") === "publico");
    const superficiesPublicasAssociadas = superficies.filter((item) =>
      localizarCampo(item.superficie, "task", "tarefa")?.valor === task.nome
      && superficieEhPublica(item.superficie, item.tipo));
    const perfilTask = coletarPerfilSegurancaDeclarado(task.corpo, task.effects, undefined, `task "${task.nome}"`);

    if (taskEhSensivel(task)) {
      motivos.add("criticidade operacional alta/critica ou efeito sensivel");
    }

    for (const route of rotasPublicasAssociadas) {
      motivos.add(`route publica "${route.nome}"`);
    }

    for (const item of superficiesPublicasAssociadas) {
      motivos.add(`superficie publica ${item.tipo} "${item.superficie.nome ?? item.tipo}"`);
    }

    const motivosOrdenados = [...motivos];
    if (motivosOrdenados.length === 0) {
      continue;
    }

    const perfisPublicos = [
      ...rotasPublicasAssociadas.map((route) => coletarPerfilSegurancaDeclarado(route.corpo, localizarBloco(route.corpo, "effects"), undefined, `route "${route.nome}"`)),
      ...superficiesPublicasAssociadas.map((item) => coletarPerfilSegurancaDeclarado(item.superficie, localizarBloco(item.superficie, "effects"), undefined, `superficie ${item.tipo} "${item.superficie.nome ?? item.tipo}"`)),
    ];
    const perfilPublico: PerfilSegurancaDeclarado = {
      auth: { ...perfilTask.auth, explicita: perfilTask.auth.explicita || perfisPublicos.some((perfil) => perfil.auth.explicita) },
      authz: {
        ...perfilTask.authz,
        explicita: perfilTask.authz.explicita || perfisPublicos.some((perfil) => perfil.authz.explicita),
        papeis: [...new Set([perfilTask.authz.papeis, ...perfisPublicos.map((perfil) => perfil.authz.papeis)].flat())],
        escopos: [...new Set([perfilTask.authz.escopos, ...perfisPublicos.map((perfil) => perfil.authz.escopos)].flat())],
      },
      dados: {
        ...perfilTask.dados,
        explicita: perfilTask.dados.explicita || perfisPublicos.some((perfil) => perfil.dados.explicita),
        campos: [...perfilTask.dados.campos, ...perfisPublicos.flatMap((perfil) => perfil.dados.campos)],
      },
      audit: { ...perfilTask.audit, explicita: perfilTask.audit.explicita || perfisPublicos.some((perfil) => perfil.audit.explicita) },
      segredos: {
        ...perfilTask.segredos,
        explicita: perfilTask.segredos.explicita || perfisPublicos.some((perfil) => perfil.segredos.explicita),
        itens: [...perfilTask.segredos.itens, ...perfisPublicos.flatMap((perfil) => perfil.segredos.itens)],
      },
      forbidden: {
        ...perfilTask.forbidden,
        explicita: perfilTask.forbidden.explicita || perfisPublicos.some((perfil) => perfil.forbidden.explicita),
        regras: [...new Set([perfilTask.forbidden.regras, ...perfisPublicos.map((perfil) => perfil.forbidden.regras)].flat())],
      },
      efeitoPrivilegiado: perfilTask.efeitoPrivilegiado || perfisPublicos.some((perfil) => perfil.efeitoPrivilegiado),
      dadosSensiveis: perfilTask.dadosSensiveis || perfisPublicos.some((perfil) => perfil.dadosSensiveis),
      exigeSegredos: perfilTask.exigeSegredos || perfisPublicos.some((perfil) => perfil.exigeSegredos),
    };

    if (rotasPublicasAssociadas.length > 0 || superficiesPublicasAssociadas.length > 0) {
      emitirGuardrailsSeguranca(
        `Task "${task.nome}" exposta publicamente`,
        task.intervalo,
        perfilPublico,
        diagnosticos,
        { publico: true, sensivel: false },
      );
    }

    const resumoMotivos = motivosOrdenados.join(", ");
    if (!task.execucao) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM071",
          `Task "${task.nome}" exige execucao explicita para producao por causa de ${resumoMotivos}, mas ainda opera com execucao implicita.`,
          "aviso",
          task.intervalo,
          "Declare timeout, retry, compensacao, idempotencia e criticidade_operacional no bloco execucao da task.",
        ),
      );
    }

    if (!taskTemRastreabilidade(task)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM072",
          `Task "${task.nome}" exige rastreabilidade forte por causa de ${resumoMotivos}, mas ainda nao declara impl nem vinculos.`,
          "aviso",
          task.intervalo,
          "Adicione impl e/ou vinculos para apontar arquivo, simbolo, recurso ou superficie real do codigo vivo.",
        ),
      );
    }
  }

  for (const item of superficies) {
    if (!superficieEhPublica(item.superficie, item.tipo)) {
      continue;
    }

    const execucao = localizarBloco(item.superficie, "execucao");
    if (!execucao) {
      const nomeSuperficie = item.superficie.nome ?? item.tipo;
      diagnosticos.push(
        criarDiagnostico(
          "SEM073",
          `Superficie publica ${item.tipo} "${nomeSuperficie}" deveria declarar execucao explicita para producao, mas ainda depende do padrao implicito.`,
          "aviso",
          item.superficie.intervalo,
          `Declare timeout, retry, compensacao e criticidade_operacional no proprio bloco ${item.tipo}.`,
        ),
      );
    }
  }
}

export function campoStatusTexto(campo: CampoAst): boolean {
  return (campo.nome === "status" || campo.nome === "estado") && campo.valor === "Texto";
}

export function moduloTemStateComTransicao(modulo: ModuloAst): boolean {
  return modulo.states.some((state) => (localizarBloco(state.corpo, "transitions")?.linhas.length ?? 0) > 0);
}
