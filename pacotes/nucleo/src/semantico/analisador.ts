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

export interface SimboloSemantico {
  nome: string;
  categoria: "tipo" | "entity" | "enum" | "task" | "flow" | "route" | "state";
}

export interface ContextoSemantico {
  modulo: string;
  simbolos: Map<string, SimboloSemantico>;
  tiposConhecidos: Set<string>;
}

export interface ResultadoSemantico {
  contexto: ContextoSemantico;
  diagnosticos: Diagnostico[];
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

function validarState(state: StateAst, tiposConhecidos: Set<string>, diagnosticos: Diagnostico[]): void {
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
}

function validarFlow(flow: FlowAst, tasksConhecidas: Set<string>, diagnosticos: Diagnostico[]): void {
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

function validarTask(task: TaskAst, tiposConhecidos: Set<string>, diagnosticos: Diagnostico[]): void {
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

  if (task.tests) {
    for (const bloco of task.tests.blocos) {
      if (bloco.tipo !== "caso_teste") {
        continue;
      }
      validarCasoTeste(task, bloco, diagnosticos);
    }
  }

  if (task.guarantees && task.output) {
    const saidas = new Set(task.output.campos.map((campo) => campo.nome));
    for (const linha of task.guarantees.linhas) {
      const referenciaSaida = linha.conteudo.split(/[.\s]/)[0];
      if (
        referenciaSaida &&
        !["persistencia", "sucesso", "estado"].includes(referenciaSaida) &&
        !saidas.has(referenciaSaida)
      ) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM006",
            `Garantia "${linha.conteudo}" referencia "${referenciaSaida}", que nao pertence ao output da task "${task.nome}".`,
            "erro",
            linha.intervalo,
            "Garanta que cada linha de guarantees aponte para uma saida declarada ou para um marcador semantico valido.",
          ),
        );
      }
    }
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

export function analisarSemantica(modulo: ModuloAst): ResultadoSemantico {
  const diagnosticos: Diagnostico[] = [];
  const simbolos = new Map<string, SimboloSemantico>();
  const tiposConhecidos = new Set(TIPOS_PRIMITIVOS);

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
    if (categoria !== "task") {
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
  }
  for (const task of modulo.tasks) {
    if (simbolos.has(task.nome)) {
      diagnosticos.push(diagnosticoDuplicado(task.nome, "Task", task.intervalo));
    } else {
      simbolos.set(task.nome, { nome: task.nome, categoria: "task" });
    }
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
    validarTask(task, tiposConhecidos, diagnosticos);
  }

  const tasksConhecidas = new Set(modulo.tasks.map((task) => task.nome));

  for (const flow of modulo.flows) {
    validarFlow(flow, tasksConhecidas, diagnosticos);
  }

  for (const route of modulo.routes) {
    validarRoute(route, tasksConhecidas, diagnosticos);
  }

  for (const state of modulo.states) {
    validarState(state, tiposConhecidos, diagnosticos);
  }

  return {
    contexto: {
      modulo: modulo.nome,
      simbolos,
      tiposConhecidos,
    },
    diagnosticos,
  };
}
