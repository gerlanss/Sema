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
  extrairReferenciasDaExpressao,
  parsearEfeitoSemantico,
  parsearEtapaFlow,
  parsearExpressaoSemantica,
  parsearTransicaoEstado,
} from "./estruturas.js";

export interface SimboloSemantico {
  nome: string;
  categoria: "tipo" | "entity" | "enum" | "task" | "flow" | "route" | "state";
}

export interface ContextoSemantico {
  modulo: string;
  simbolos: Map<string, SimboloSemantico>;
  tiposConhecidos: Set<string>;
  tasksConhecidas: Set<string>;
  tarefasDetalhadas: Map<string, { input: Set<string>; output: Set<string>; errors: Set<string> }>;
  statesConhecidos: Map<string, { transicoes: Set<string> }>;
  modulosImportados: string[];
  enumsConhecidos: Map<string, Set<string>>;
}

export interface ResultadoSemantico {
  contexto: ContextoSemantico;
  diagnosticos: Diagnostico[];
}

export interface OpcoesAnaliseSemantica {
  contextosModulos?: Map<string, ContextoSemantico>;
}

const TIPOS_PRIMITIVOS = new Set([
  "Texto",
  "Numero",
  "Inteiro",
  "Decimal",
  "Booleano",
  "Data",
  "DataHora",
  "Id",
  "Email",
  "Url",
  "Json",
  "Vazio",
]);

function extrairReferenciasDeTipos(texto: string): string[] {
  const correspondencias = texto.match(/[A-Z][A-Za-z0-9_]*/g);
  return correspondencias ?? [];
}

function extrairRaiz(referencia: string): string {
  return referencia.split(".")[0] ?? referencia;
}

function ehMarcadorSemantico(referencia: string): boolean {
  return ["persistencia", "sucesso", "estado"].includes(extrairRaiz(referencia));
}

function diagnosticoDuplicado(nome: string, categoria: string, intervalo?: CampoAst["intervalo"]): Diagnostico {
  return criarDiagnostico(
    "SEM001",
    `${categoria} "${nome}" foi declarado mais de uma vez no mesmo modulo.`,
    "erro",
    intervalo,
    "Use nomes unicos para simbolos do modulo.",
  );
}

function validarCamposDeTipos(
  campos: CampoAst[],
  tiposConhecidos: Set<string>,
  diagnosticos: Diagnostico[],
  contexto: string,
): void {
  for (const campo of campos) {
    const referencias = extrairReferenciasDeTipos(campo.valor);
    for (const referencia of referencias) {
      if (!tiposConhecidos.has(referencia)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM002",
            `Tipo "${referencia}" nao foi encontrado em ${contexto}.`,
            "erro",
            campo.intervalo,
            "Declare o tipo, entidade ou enum antes de usa-lo.",
          ),
        );
      }
    }
  }
}

function localizarBloco(corpo: BlocoGenericoAst, nome: string): BlocoGenericoAst | undefined {
  return corpo.blocos.find((bloco): bloco is BlocoGenericoAst => bloco.tipo === "bloco_generico" && bloco.palavraChave === nome);
}

function serializarTransicao(origem: string, destino: string): string {
  return `${origem}->${destino}`;
}

function validarExpressoesDeclaradas(
  linhas: BlocoGenericoAst["linhas"],
  diagnosticos: Diagnostico[],
  contexto: {
    codigoErroSintaxe: string;
    codigoErroReferencia: string;
    nomeBloco: string;
    simbolosPermitidos: Set<string>;
    dicaSintaxe: string;
    dicaReferencia: string;
    aceitarMarcadoresSemanticos?: boolean;
  },
): void {
  for (const linha of linhas) {
    const expressao = parsearExpressaoSemantica(linha.conteudo);
    if (!expressao) {
      diagnosticos.push(
        criarDiagnostico(
          contexto.codigoErroSintaxe,
          `Declaracao invalida em ${contexto.nomeBloco}: "${linha.conteudo}".`,
          "erro",
          linha.intervalo,
          contexto.dicaSintaxe,
        ),
      );
      continue;
    }

    for (const referencia of extrairReferenciasDaExpressao(expressao)) {
      const raiz = extrairRaiz(referencia);
      const referenciaPermitida = contexto.simbolosPermitidos.has(raiz) || (contexto.aceitarMarcadoresSemanticos && ehMarcadorSemantico(raiz));
      if (!referenciaPermitida) {
        diagnosticos.push(
          criarDiagnostico(
            contexto.codigoErroReferencia,
            `Declaracao em ${contexto.nomeBloco} referencia "${raiz}", que nao pertence ao contexto permitido.`,
            "erro",
            linha.intervalo,
            contexto.dicaReferencia,
          ),
        );
      }
    }
  }
}

function validarEfeitosDeclarados(linhas: BlocoGenericoAst["linhas"], diagnosticos: Diagnostico[], contexto: string): void {
  for (const linha of linhas) {
    const efeito = parsearEfeitoSemantico(linha.conteudo);
    if (!efeito) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM023",
          `Declaracao invalida de efeito em ${contexto}: "${linha.conteudo}".`,
          "erro",
          linha.intervalo,
          "Use o formato \"acao alvo\" ou \"acao alvo complemento\" para declarar efeitos no MVP.",
        ),
      );
    }
  }
}

function validarState(
  state: StateAst,
  tiposConhecidos: Set<string>,
  enumsConhecidos: Map<string, Set<string>>,
  diagnosticos: Diagnostico[],
): void {
  const possuiConteudo = state.corpo.campos.length > 0 || state.corpo.linhas.length > 0 || state.corpo.blocos.length > 0;
  if (!possuiConteudo) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM011",
        `Bloco state${state.nome ? ` "${state.nome}"` : ""} precisa declarar campos, linhas ou subblocos.`,
        "erro",
        state.intervalo,
        "Use state para modelar informacao ou transicao observavel, nao como bloco vazio.",
      ),
    );
  }

  validarCamposDeTipos(state.corpo.campos, tiposConhecidos, diagnosticos, `state ${state.nome ?? "<anonimo>"}`);
  const fields = localizarBloco(state.corpo, "fields");
  if (fields) {
    validarCamposDeTipos(fields.campos, tiposConhecidos, diagnosticos, `fields do state ${state.nome ?? "<anonimo>"}`);
  }

  const nomesCampos = new Set([
    ...state.corpo.campos.map((campo) => campo.nome),
    ...(fields?.campos ?? []).map((campo) => campo.nome),
  ]);

  const invariants = localizarBloco(state.corpo, "invariants");
  if (invariants) {
    validarExpressoesDeclaradas(invariants.linhas, diagnosticos, {
      codigoErroSintaxe: "SEM024",
      codigoErroReferencia: "SEM025",
      nomeBloco: `invariants do state ${state.nome ?? "<anonimo>"}`,
      simbolosPermitidos: nomesCampos,
      dicaSintaxe: "Use expressoes como \"campo existe\", \"campo == valor\" ou \"campo em [A, B]\".",
      dicaReferencia: "Referencie apenas campos do proprio state nas invariantes.",
    });
  }

  const transitions = localizarBloco(state.corpo, "transitions");
  if (transitions) {
    const campoTransicao = (fields?.campos ?? []).find((campo) => campo.nome === "status" || campo.nome === "estado")
      ?? state.corpo.campos.find((campo) => campo.nome === "status" || campo.nome === "estado");

    if (!campoTransicao) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM026",
          `State ${state.nome ? `"${state.nome}" ` : ""}declarou transitions sem um campo status ou estado.`,
          "erro",
          transitions.intervalo,
          "Adicione um campo status ou estado para ancorar semanticamente as transicoes.",
        ),
      );
    }

    const enumValores = campoTransicao ? enumsConhecidos.get(campoTransicao.valor) : undefined;
    for (const linha of transitions.linhas) {
      const transicao = parsearTransicaoEstado(linha.conteudo);
      if (!transicao) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM027",
            `Transicao invalida em state ${state.nome ?? "<anonimo>"}: "${linha.conteudo}".`,
            "erro",
            linha.intervalo,
            "Use o formato \"ORIGEM -> DESTINO\" para declarar transicoes.",
          ),
        );
        continue;
      }

      if (enumValores) {
        if (!enumValores.has(transicao.origem)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM028",
              `Transicao do state ${state.nome ?? "<anonimo>"} usa origem "${transicao.origem}" fora do enum ${campoTransicao?.valor}.`,
              "erro",
              linha.intervalo,
              "Use apenas valores declarados no enum associado ao campo status/estado.",
            ),
          );
        }
        if (!enumValores.has(transicao.destino)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM029",
              `Transicao do state ${state.nome ?? "<anonimo>"} usa destino "${transicao.destino}" fora do enum ${campoTransicao?.valor}.`,
              "erro",
              linha.intervalo,
              "Use apenas valores declarados no enum associado ao campo status/estado.",
            ),
          );
        }
      }
    }
  }
}

function validarFlow(
  flow: FlowAst,
  tasksConhecidas: Set<string>,
  tarefasDetalhadas: Map<string, { input: Set<string>; output: Set<string>; errors: Set<string> }>,
  diagnosticos: Diagnostico[],
): void {
  const possuiEtapas = flow.corpo.linhas.length > 0 || flow.corpo.campos.length > 0 || flow.corpo.blocos.length > 0;
  if (!possuiEtapas) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM012",
        `Flow "${flow.nome}" precisa declarar ao menos uma etapa.`,
        "erro",
        flow.intervalo,
        "Adicione linhas declarativas, campos ou subblocos dentro de flow.",
      ),
    );
  }

  const tarefasReferenciadas = flow.corpo.campos
    .filter((campo) => campo.nome === "task" || campo.nome === "tarefa")
    .map((campo) => campo.valor);

  for (const tarefa of tarefasReferenciadas) {
    if (!tasksConhecidas.has(tarefa)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM013",
          `Flow "${flow.nome}" referencia task "${tarefa}" que nao existe.`,
          "erro",
          flow.intervalo,
          "Declare a task no mesmo modulo ou ajuste a referencia do flow.",
        ),
      );
    }
  }

  const etapas = flow.corpo.linhas
    .map((linha) => ({ linha, etapa: parsearEtapaFlow(linha.conteudo) }))
    .filter((item) => item.linha.conteudo.trim().startsWith("etapa "));

  const nomesEtapas = new Set<string>();
  const contextoFlow = new Set(flow.corpo.campos.map((campo) => campo.nome));
  const etapasValidas = new Map<string, NonNullable<(typeof etapas)[number]["etapa"]>>();
  for (const item of etapas) {
    if (!item.etapa) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM032",
          `Linha de etapa invalida em flow "${flow.nome}": "${item.linha.conteudo}".`,
          "erro",
          item.linha.intervalo,
          "Use o formato \"etapa nome usa task quando expressao depende_de etapa_a, etapa_b\".",
        ),
      );
      continue;
    }

    if (nomesEtapas.has(item.etapa.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM033",
          `Flow "${flow.nome}" declarou a etapa "${item.etapa.nome}" mais de uma vez.`,
          "erro",
          item.linha.intervalo,
          "Use nomes unicos para cada etapa estruturada do flow.",
        ),
      );
      continue;
    }

    nomesEtapas.add(item.etapa.nome);
    etapasValidas.set(item.etapa.nome, item.etapa);

    if (item.etapa.task && !tasksConhecidas.has(item.etapa.task)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM034",
          `Etapa "${item.etapa.nome}" do flow "${flow.nome}" usa task "${item.etapa.task}" que nao existe.`,
          "erro",
          item.linha.intervalo,
          "Ajuste a task da etapa para apontar para uma task declarada ou importada.",
        ),
      );
    }

    if (item.etapa.task) {
      const detalhesTask = tarefasDetalhadas.get(item.etapa.task);
      if (detalhesTask) {
        for (const mapeamento of item.etapa.mapeamentos) {
          if (!detalhesTask.input.has(mapeamento.campo)) {
            diagnosticos.push(
              criarDiagnostico(
                "SEM042",
                `Etapa "${item.etapa.nome}" do flow "${flow.nome}" mapeia o campo "${mapeamento.campo}", que nao existe no input da task "${item.etapa.task}".`,
                "erro",
                item.linha.intervalo,
                "Use apenas campos declarados no input da task associada a etapa.",
              ),
            );
          }

          const raizValor = extrairRaiz(mapeamento.valor);
          const ehLiteral = ["verdadeiro", "falso", "nulo"].includes(mapeamento.valor)
            || /^-?\d+(?:\.\d+)?$/.test(mapeamento.valor)
            || /^".*"$/.test(mapeamento.valor);
          if (!ehLiteral && !contextoFlow.has(raizValor) && !nomesEtapas.has(raizValor)) {
            diagnosticos.push(
              criarDiagnostico(
                "SEM043",
                `Etapa "${item.etapa.nome}" do flow "${flow.nome}" referencia "${mapeamento.valor}" fora do contexto conhecido.`,
                "erro",
                item.linha.intervalo,
                "Mapeie usando campos do proprio flow, saidas de etapas anteriores ou literais simples.",
              ),
            );
          }

          if (mapeamento.valor.includes(".")) {
            const [etapaOrigem, campoSaida] = mapeamento.valor.split(".", 2);
            const etapaReferenciada = etapaOrigem ? etapasValidas.get(etapaOrigem) : undefined;
            const taskReferenciada = etapaReferenciada?.task ? tarefasDetalhadas.get(etapaReferenciada.task) : undefined;
            if (etapaOrigem && campoSaida && etapaReferenciada && taskReferenciada && !taskReferenciada.output.has(campoSaida)) {
              diagnosticos.push(
                criarDiagnostico(
                  "SEM044",
                  `Etapa "${item.etapa.nome}" do flow "${flow.nome}" referencia a saida "${campoSaida}" da etapa "${etapaOrigem}", mas essa saida nao existe na task associada.`,
                  "erro",
                  item.linha.intervalo,
                  "Use apenas campos declarados no output da task da etapa de origem.",
                ),
              );
            }
          }
        }
      }
    }

    if (item.etapa.condicao) {
      const referencias = extrairReferenciasDaExpressao(item.etapa.condicao).map((referencia) => extrairRaiz(referencia));
      for (const referencia of referencias) {
        if (!ehMarcadorSemantico(referencia) && !tasksConhecidas.has(referencia) && !nomesEtapas.has(referencia)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM035",
              `Condicao da etapa "${item.etapa.nome}" em flow "${flow.nome}" referencia "${referencia}" fora do contexto atual.`,
              "erro",
              item.linha.intervalo,
              "No MVP atual, condicoes de flow devem apontar para marcadores semanticos, tasks conhecidas ou etapas anteriores.",
            ),
          );
        }
      }
    }
  }

  for (const item of etapas) {
    if (!item.etapa) {
      continue;
    }
    for (const dependencia of item.etapa.dependencias) {
      if (!nomesEtapas.has(dependencia)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM036",
            `Etapa "${item.etapa.nome}" do flow "${flow.nome}" depende de "${dependencia}", que nao foi declarada.`,
            "erro",
            item.linha.intervalo,
            "Declare a etapa dependente no mesmo flow antes de referencia-la.",
          ),
        );
      }
    }

    for (const destino of [item.etapa.emSucesso, item.etapa.emErro].filter(Boolean)) {
      if (destino && !nomesEtapas.has(destino)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM045",
            `Etapa "${item.etapa.nome}" do flow "${flow.nome}" aponta para "${destino}" em ramificacao, mas essa etapa nao foi declarada.`,
            "erro",
            item.linha.intervalo,
            "Declare a etapa de destino no mesmo flow antes de usa-la em em_sucesso ou em_erro.",
          ),
        );
      }
    }

    if (item.etapa.task) {
      const detalhesTask = tarefasDetalhadas.get(item.etapa.task);
      for (const rotaErro of item.etapa.porErro) {
        if (!detalhesTask?.errors.has(rotaErro.tipo)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM046",
              `Etapa "${item.etapa.nome}" do flow "${flow.nome}" roteia o erro "${rotaErro.tipo}", mas esse erro nao pertence ao contrato da task "${item.etapa.task}".`,
              "erro",
              item.linha.intervalo,
              "Use apenas erros declarados pela task ou cobertos por testes de erro do contrato atual.",
            ),
          );
        }

        if (!nomesEtapas.has(rotaErro.destino)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM047",
              `Etapa "${item.etapa.nome}" do flow "${flow.nome}" aponta o erro "${rotaErro.tipo}" para "${rotaErro.destino}", mas essa etapa nao foi declarada.`,
              "erro",
              item.linha.intervalo,
              "Declare a etapa de destino no mesmo flow antes de usa-la em por_erro.",
            ),
          );
        }
      }
    }
  }
}

function validarVinculoEstadoDaTask(
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

  const estadoConhecido = statesConhecidos.get(nomeEstado);
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

  const blocoTransitions = localizarBloco(task.state, "transitions");
  const linhasTransicao = blocoTransitions?.linhas ?? task.state.linhas;
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

function validarRoute(route: RouteAst, tasksConhecidas: Set<string>, diagnosticos: Diagnostico[]): void {
  const metodo = route.corpo.campos.find((campo) => campo.nome === "metodo");
  const caminho = route.corpo.campos.find((campo) => campo.nome === "caminho");
  const task = route.corpo.campos.find((campo) => campo.nome === "task" || campo.nome === "tarefa");

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

  if (caminho && !caminho.valor.startsWith("/")) {
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
  }
}

export function criarContextoLocal(modulo: ModuloAst): ContextoSemantico {
  const simbolos = new Map<string, SimboloSemantico>();
  const tiposConhecidos = new Set(TIPOS_PRIMITIVOS);
  const tasksConhecidas = new Set<string>();
  const tarefasDetalhadas = new Map<string, { input: Set<string>; output: Set<string>; errors: Set<string> }>();
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
    tiposConhecidos.add(nome);
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
    tarefasDetalhadas.set(task.nome, {
      input: new Set((task.input?.campos ?? []).map((campo) => campo.nome)),
      output: new Set((task.output?.campos ?? []).map((campo) => campo.nome)),
      errors: new Set([
        ...(task.error?.campos ?? []).map((campo) => campo.nome),
        ...(task.tests?.blocos
          .filter((bloco): bloco is BlocoCasoTesteAst => bloco.tipo === "caso_teste")
          .flatMap((bloco) => bloco.error?.campos.find((campo) => campo.nome === "tipo")?.valor ? [bloco.error.campos.find((campo) => campo.nome === "tipo")!.valor] : [])
          ?? []),
      ]),
    });
  }
  for (const flow of modulo.flows) {
    registrar(flow.nome, "flow");
  }
  for (const route of modulo.routes) {
    registrar(route.nome, "route");
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
    enumsConhecidos,
  };
}

function validarTask(
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

  if (task.rules) {
    validarExpressoesDeclaradas(task.rules.linhas, diagnosticos, {
      codigoErroSintaxe: "SEM021",
      codigoErroReferencia: "SEM022",
      nomeBloco: `rules da task ${task.nome}`,
      simbolosPermitidos: entradasConhecidas,
      dicaSintaxe: "Use expressoes como \"campo existe\", \"campo > 0\", \"campo em [A, B]\" ou \"campo deve_ser predicado\".",
      dicaReferencia: "No MVP atual, rules devem referenciar apenas campos do input.",
    });
  }

  if (task.effects) {
    validarEfeitosDeclarados(task.effects.linhas, diagnosticos, `effects da task ${task.nome}`);
  }

  if (task.tests) {
    for (const bloco of task.tests.blocos) {
      if (bloco.tipo !== "caso_teste") {
        continue;
      }
      validarCasoTeste(task, bloco, diagnosticos);
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
    });
  }

  if (task.error) {
    const nomes = new Set<string>();
    for (const campo of task.error.campos) {
      if (nomes.has(campo.nome)) {
        diagnosticos.push(diagnosticoDuplicado(campo.nome, "Erro", campo.intervalo));
      }
      nomes.add(campo.nome);
    }
  }

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

function validarCasoTeste(task: TaskAst, caso: BlocoCasoTesteAst, diagnosticos: Diagnostico[]): void {
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

export function analisarSemantica(modulo: ModuloAst, opcoes: OpcoesAnaliseSemantica = {}): ResultadoSemantico {
  const diagnosticos: Diagnostico[] = [];
  const simbolos = new Map<string, SimboloSemantico>();
  const tiposConhecidos = new Set(TIPOS_PRIMITIVOS);
  const tasksConhecidas = new Set<string>();
  const tarefasDetalhadas = new Map<string, { input: Set<string>; output: Set<string>; errors: Set<string> }>();
  const statesConhecidos = new Map<string, { transicoes: Set<string> }>();
  const modulosImportados: string[] = [];
  const enumsConhecidos = new Map<string, Set<string>>();

  for (const use of modulo.uses) {
    const contextoImportado = opcoes.contextosModulos?.get(use.caminho);
    if (!contextoImportado) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM019",
          `Modulo "${modulo.nome}" usa "${use.caminho}", mas esse modulo nao foi encontrado no projeto atual.`,
          "erro",
          use.intervalo,
          "Garanta que o arquivo .sema importado esteja presente no mesmo conjunto de compilacao.",
        ),
      );
      continue;
    }

    modulosImportados.push(use.caminho);
    for (const tipo of contextoImportado.tiposConhecidos) {
      tiposConhecidos.add(tipo);
    }
    for (const task of contextoImportado.tasksConhecidas) {
      tasksConhecidas.add(task);
    }
    for (const [nomeTask, detalhesTask] of contextoImportado.tarefasDetalhadas) {
      tarefasDetalhadas.set(nomeTask, {
        input: new Set(detalhesTask.input),
        output: new Set(detalhesTask.output),
        errors: new Set(detalhesTask.errors),
      });
    }
    for (const [nomeState, metadadosState] of contextoImportado.statesConhecidos) {
      statesConhecidos.set(nomeState, { transicoes: new Set(metadadosState.transicoes) });
    }
    for (const [nomeEnum, valores] of contextoImportado.enumsConhecidos) {
      enumsConhecidos.set(nomeEnum, new Set(valores));
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
    tiposConhecidos.add(nome);
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
    tarefasDetalhadas.set(task.nome, {
      input: new Set((task.input?.campos ?? []).map((campo) => campo.nome)),
      output: new Set((task.output?.campos ?? []).map((campo) => campo.nome)),
      errors: new Set([
        ...(task.error?.campos ?? []).map((campo) => campo.nome),
        ...(task.tests?.blocos
          .filter((bloco): bloco is BlocoCasoTesteAst => bloco.tipo === "caso_teste")
          .flatMap((bloco) => bloco.error?.campos.find((campo) => campo.nome === "tipo")?.valor ? [bloco.error.campos.find((campo) => campo.nome === "tipo")!.valor] : [])
          ?? []),
      ]),
    });
  }
  for (const flow of modulo.flows) {
    registrar(flow.nome, "flow", flow.intervalo);
  }
  for (const route of modulo.routes) {
    registrar(route.nome, "route", route.intervalo);
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
  }

  for (const task of modulo.tasks) {
    validarTask(task, tiposConhecidos, statesConhecidos, diagnosticos);
  }

  for (const flow of modulo.flows) {
    validarFlow(flow, tasksConhecidas, tarefasDetalhadas, diagnosticos);
  }

  for (const route of modulo.routes) {
    validarRoute(route, tasksConhecidas, diagnosticos);
  }

  for (const state of modulo.states) {
    validarState(state, tiposConhecidos, enumsConhecidos, diagnosticos);
  }

  return {
    contexto: {
      modulo: modulo.nome,
      simbolos,
      tiposConhecidos,
      tasksConhecidas,
      tarefasDetalhadas,
      statesConhecidos,
      modulosImportados,
      enumsConhecidos,
    },
    diagnosticos,
  };
}
