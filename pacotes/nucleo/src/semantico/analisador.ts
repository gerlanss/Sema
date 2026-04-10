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

export interface SimboloSemantico {
  nome: string;
  categoria: "tipo" | "entity" | "enum" | "task" | "flow" | "route" | "state" | "worker" | "evento" | "fila" | "cron" | "webhook" | "cache" | "storage" | "policy" | "database";
}

export interface CampoSemantico {
  nome: string;
  tipo: string;
  modificadores: string[];
}

export interface ErroSemanticoTask {
  codigo: string;
  mensagem: string;
  categoria?: string;
  recuperabilidade?: string;
  acaoChamador?: string;
  impactaEstado?: boolean;
  requerCompensacao?: boolean;
}

export interface ResumoTaskSemantico {
  input: CampoSemantico[];
  output: CampoSemantico[];
  errors: ErroSemanticoTask[];
  guarantees: string[];
  implementacoes: ImplementacaoTaskSemantica[];
}

export interface InteropSemantico {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
}

export interface ImplementacaoTaskSemantica {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
}

export interface ContextoSemantico {
  modulo: string;
  simbolos: Map<string, SimboloSemantico>;
  tiposConhecidos: Set<string>;
  tasksConhecidas: Set<string>;
  tarefasDetalhadas: Map<string, ResumoTaskSemantico>;
  statesConhecidos: Map<string, { transicoes: Set<string> }>;
  modulosImportados: string[];
  interoperabilidades: InteropSemantico[];
  enumsConhecidos: Map<string, Set<string>>;
}

export interface ResultadoSemantico {
  contexto: ContextoSemantico;
  diagnosticos: Diagnostico[];
}

export interface OpcoesAnaliseSemantica {
  contextosModulos?: Map<string, ContextoSemantico>;
}

function ehUseInterop(
  use: ModuloAst["uses"][number],
): use is ModuloAst["uses"][number] & { origem: InteropSemantico["origem"] } {
  return use.origem !== "sema";
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
const TIPOS_COMPOSTOS_SUPORTADOS = new Set(["Lista", "Mapa", "Opcional", "Ou"]);
const CAMPOS_VINCULO_SUPORTADOS = new Set([
  "arquivo",
  "simbolo",
  "recurso",
  "superficie",
  "rota",
  "teste",
  "tabela",
  "fila",
  "job",
  "policy",
  "artefato",
  "evento",
  "cache",
  "storage",
  "worker",
  "cron",
  "webhook",
]);
const CAMPOS_EXECUCAO_SUPORTADOS = new Set([
  "idempotencia",
  "timeout",
  "retry",
  "compensacao",
  "criticidade_operacional",
]);
const CAMPOS_AUTH_SUPORTADOS = new Set([
  "modo",
  "estrategia",
  "principal",
  "origem",
]);
const CAMPOS_AUTHZ_SUPORTADOS = new Set([
  "papel",
  "papeis",
  "escopo",
  "escopos",
  "politica",
  "tenant",
]);
const CAMPOS_DADOS_SUPORTADOS = new Set([
  "classificacao_padrao",
  "redacao_log",
  "retencao",
]);
const CAMPOS_AUDIT_SUPORTADOS = new Set([
  "evento",
  "ator",
  "correlacao",
  "retencao",
  "motivo",
]);
const CAMPOS_SEGREDO_SUPORTADOS = new Set([
  "origem",
  "escopo",
  "acesso",
  "rotacao",
  "nao_logar",
  "nao_retornar",
  "mascarar",
]);
const CAMPOS_ERRO_OPERACIONAL = new Set([
  "mensagem",
  "categoria",
  "recuperabilidade",
  "acao_chamador",
  "impacta_estado",
  "requer_compensacao",
]);
const CRITICIDADES_OPERACIONAIS = new Set(["baixa", "media", "alta", "critica"]);
type PerfilCompatibilidadeSemantica = "publico" | "interno" | "experimental" | "legado" | "deprecado";

const PADRAO_CAMINHO_INTEROP = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/;

function normalizarOrigemImplementacao(valor: string): ImplementacaoTaskSemantica["origem"] | undefined {
  switch (valor.toLowerCase()) {
    case "ts":
    case "typescript":
      return "ts";
    case "py":
    case "python":
      return "py";
    case "dart":
      return "dart";
    case "cs":
    case "csharp":
    case "dotnet":
      return "cs";
    case "java":
      return "java";
    case "go":
    case "golang":
      return "go";
    case "rust":
    case "rs":
      return "rust";
    case "cpp":
    case "cxx":
    case "cc":
    case "c++":
      return "cpp";
    default:
      return undefined;
  }
}

function extrairReferenciasDeTipos(texto: string): string[] {
  const correspondencias = texto.match(/[A-Z][A-Za-z0-9_]*/g);
  return (correspondencias ?? []).filter((referencia) => !TIPOS_COMPOSTOS_SUPORTADOS.has(referencia));
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

function localizarBloco(corpo: BlocoGenericoAst | undefined, nome: string): BlocoGenericoAst | undefined {
  if (!corpo) {
    return undefined;
  }
  return corpo.blocos.find((bloco): bloco is BlocoGenericoAst =>
    bloco.tipo === "bloco_generico" && (bloco.palavraChave === nome || bloco.nome === nome));
}

function localizarCampo(bloco: BlocoGenericoAst | undefined, ...nomes: string[]): CampoAst | undefined {
  if (!bloco) {
    return undefined;
  }
  return bloco.campos.find((campo) => nomes.includes(campo.nome));
}

function valorCampoCompleto(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }
  return [campo.valor, ...campo.modificadores].join(" ").trim() || undefined;
}

function parsearBooleanoSemantico(valor?: string): boolean | undefined {
  if (!valor) {
    return undefined;
  }
  if (valor === "verdadeiro" || valor === "true") {
    return true;
  }
  if (valor === "falso" || valor === "false") {
    return false;
  }
  return undefined;
}

function converterCampoSemantico(campo: CampoAst): CampoSemantico {
  return {
    nome: campo.nome,
    tipo: campo.valor,
    modificadores: [...campo.modificadores],
  };
}

function indicesCampos(campos: CampoSemantico[]): Map<string, CampoSemantico> {
  return new Map(campos.map((campo) => [campo.nome, campo]));
}

function indiceErros(erros: ErroSemanticoTask[]): Map<string, ErroSemanticoTask> {
  return new Map(erros.map((erro) => [erro.codigo, erro]));
}

function coletarErrosTask(task: TaskAst): ErroSemanticoTask[] {
  const erros = new Map<string, ErroSemanticoTask>();
  for (const campo of task.error?.campos ?? []) {
    erros.set(campo.nome, {
      codigo: campo.nome,
      mensagem: [campo.valor, ...campo.modificadores].join(" ").trim(),
    });
  }

  for (const bloco of task.error?.blocos ?? []) {
    if (bloco.tipo !== "bloco_generico") {
      continue;
    }
    const codigo = bloco.nome ?? bloco.palavraChave;
    if (!codigo || codigo === "desconhecido") {
      continue;
    }

    erros.set(codigo, {
      codigo,
      mensagem: valorCampoCompleto(localizarCampo(bloco, "mensagem")) ?? `Erro estruturado "${codigo}".`,
      categoria: valorCampoCompleto(localizarCampo(bloco, "categoria")),
      recuperabilidade: valorCampoCompleto(localizarCampo(bloco, "recuperabilidade")),
      acaoChamador: valorCampoCompleto(localizarCampo(bloco, "acao_chamador")),
      impactaEstado: parsearBooleanoSemantico(valorCampoCompleto(localizarCampo(bloco, "impacta_estado"))),
      requerCompensacao: parsearBooleanoSemantico(valorCampoCompleto(localizarCampo(bloco, "requer_compensacao"))),
    });
  }

  for (const bloco of task.tests?.blocos ?? []) {
    if (bloco.tipo !== "caso_teste") {
      continue;
    }
    const codigoErro = bloco.error?.campos.find((campo) => campo.nome === "tipo")?.valor;
    if (codigoErro && !erros.has(codigoErro)) {
      erros.set(codigoErro, {
        codigo: codigoErro,
        mensagem: `Erro sintetico derivado do caso de teste "${bloco.nome}".`,
      });
    }
  }

  return [...erros.values()];
}

function coletarResumoTask(task: TaskAst): ResumoTaskSemantico {
  return {
    input: (task.input?.campos ?? []).map(converterCampoSemantico),
    output: (task.output?.campos ?? []).map(converterCampoSemantico),
    errors: coletarErrosTask(task),
    guarantees: (task.guarantees?.linhas ?? []).map((linha) => linha.conteudo),
    implementacoes: (task.impl?.campos ?? [])
      .map((campo) => {
        const origem = normalizarOrigemImplementacao(campo.nome);
        return origem ? { origem, caminho: campo.valor } : undefined;
      })
      .filter((item): item is ImplementacaoTaskSemantica => Boolean(item)),
  };
}

function validarImplementacoesTask(task: TaskAst, diagnosticos: Diagnostico[]): void {
  if (!task.impl) {
    return;
  }

  const origens = new Set<string>();
  for (const campo of task.impl.campos) {
    const origem = normalizarOrigemImplementacao(campo.nome);
    if (!origem) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM059",
          `Task "${task.nome}" declarou implementacao externa invalida em impl: "${campo.nome}".`,
          "erro",
          campo.intervalo,
          "Use apenas ts, py, dart, cs, java, go, rust ou cpp dentro do bloco impl.",
        ),
      );
      continue;
    }

    if (origens.has(origem)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM060",
          `Task "${task.nome}" declarou mais de uma implementacao ${origem} no bloco impl.`,
          "erro",
          campo.intervalo,
          "Cada origem externa deve aparecer no maximo uma vez dentro de impl.",
        ),
      );
      continue;
    }
    origens.add(origem);

    if (!PADRAO_CAMINHO_INTEROP.test(campo.valor)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM061",
          `Task "${task.nome}" declarou caminho invalido para impl ${origem}: "${campo.valor}".`,
          "erro",
          campo.intervalo,
          "Use um identificador de implementacao como pacote.modulo.funcao ou app.servico.metodo.",
        ),
      );
    }
  }
}

function validarVinculos(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    if (!CAMPOS_VINCULO_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM064",
          `Campo de vinculo "${campo.nome}" nao e suportado em ${contexto}.`,
          "erro",
          campo.intervalo,
          "Use arquivo, simbolo, recurso, superficie, rota, teste, tabela, fila, job, policy, artefato, evento, cache, storage, worker, cron ou webhook.",
        ),
      );
    }
  }
}

function extrairPerfilCompatibilidade(
  bloco: BlocoGenericoAst | undefined,
  padrao: PerfilCompatibilidadeSemantica = "interno",
): PerfilCompatibilidadeSemantica {
  const perfil = bloco
    ? valorCampoCompleto(localizarCampo(bloco, "perfil", "compatibilidade"))?.toLowerCase()
    : undefined;
  if (
    perfil === "publico"
    || perfil === "interno"
    || perfil === "experimental"
    || perfil === "legado"
    || perfil === "deprecado"
  ) {
    return perfil;
  }
  return padrao;
}

function validarCamposSuportadosPersistencia(
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

function validarBooleanoPersistencia(
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

function validarRecursoPersistencia(
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

function validarDatabase(database: BlocoGenericoAst, diagnosticos: Diagnostico[]): void {
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

function coletarSuperficiesModulo(modulo: ModuloAst): Array<{ tipo: SimboloSemantico["categoria"]; superficie: BlocoGenericoAst }> {
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

function superficieEhPublica(
  superficie: BlocoGenericoAst,
  tipoSuperficie: SimboloSemantico["categoria"],
): boolean {
  return extrairPerfilCompatibilidade(superficie, tipoSuperficie === "webhook" ? "publico" : "interno") === "publico";
}

function taskEhSensivel(task: TaskAst): boolean {
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

function taskTemRastreabilidade(task: TaskAst): boolean {
  return Boolean(task.impl || task.vinculos);
}

function routeEhMutante(route: RouteAst): boolean {
  const metodo = (localizarCampo(route.corpo, "metodo")?.valor ?? "").toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(metodo);
}

function validarExecucaoBloco(
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
}

function validarExecucao(task: TaskAst, diagnosticos: Diagnostico[]): void {
  validarExecucaoBloco(task.execucao, diagnosticos, `task "${task.nome}"`);
}

interface PerfilSegurancaDeclarado {
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

function validarAuthBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    if (!CAMPOS_AUTH_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM074",
          `Campo de auth "${campo.nome}" nao e suportado em ${contexto}.`,
          "erro",
          campo.intervalo,
          "Use apenas modo, estrategia, principal ou origem em auth.",
        ),
      );
    }
  }

  const auth = extrairContratoAuth(bloco);
  if (auth.modo && !MODOS_AUTH_SUPORTADOS.has(auth.modo as (typeof MODOS_AUTH_SUPORTADOS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM075",
        `Auth em ${contexto} declarou modo invalido: "${auth.modo}".`,
        "erro",
        bloco.intervalo,
        "Use obrigatorio, opcional, anonimo, interno ou m2m.",
      ),
    );
  }
  if (auth.principal && !PRINCIPAIS_AUTH_SUPORTADOS.has(auth.principal as (typeof PRINCIPAIS_AUTH_SUPORTADOS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM076",
        `Auth em ${contexto} declarou principal invalido: "${auth.principal}".`,
        "erro",
        bloco.intervalo,
        "Use usuario, servico, sistema ou anonimo.",
      ),
    );
  }
  if (auth.origem && !ORIGENS_AUTH_SUPORTADAS.has(auth.origem as (typeof ORIGENS_AUTH_SUPORTADAS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM077",
        `Auth em ${contexto} declarou origem invalida: "${auth.origem}".`,
        "erro",
        bloco.intervalo,
        "Use publica, interna, worker, webhook, fila ou cron.",
      ),
    );
  }
}

function validarAuthzBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    if (!CAMPOS_AUTHZ_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM078",
          `Campo de authz "${campo.nome}" nao e suportado em ${contexto}.`,
          "erro",
          campo.intervalo,
          "Use papel, papeis, escopo, escopos, politica ou tenant em authz.",
        ),
      );
    }
  }

  const authz = extrairContratoAuthz(bloco);
  if (authz.tenant && !TENANTS_AUTHZ_SUPORTADOS.has(authz.tenant as (typeof TENANTS_AUTHZ_SUPORTADOS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM079",
        `Authz em ${contexto} declarou tenant invalido: "${authz.tenant}".`,
        "erro",
        bloco.intervalo,
        "Use obrigatorio, opcional ou isolado.",
      ),
    );
  }
  if (authz.papeis.length === 0 && authz.escopos.length === 0 && !authz.politica) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM080",
        `Authz em ${contexto} precisa declarar papeis, escopos ou politica.`,
        "erro",
        bloco.intervalo,
        "Explicite ao menos um papel, escopo ou politica para a autorizacao nao virar enfeite.",
      ),
    );
  }
}

function validarDadosBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    const valor = valorCampoCompleto(campo);
    if (CAMPOS_DADOS_SUPORTADOS.has(campo.nome)) {
      continue;
    }
    if (valor && !CLASSIFICACOES_DADO_SUPORTADAS.has(valor as (typeof CLASSIFICACOES_DADO_SUPORTADAS extends Set<infer T> ? T : never))) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM081",
          `Dados em ${contexto} declarou classificacao invalida para "${campo.nome}": "${valor}".`,
          "erro",
          campo.intervalo,
          "Use publico, interno, pii, financeiro, credencial ou segredo.",
        ),
      );
    }
  }

  const dados = extrairContratoDados(bloco);
  if (dados.classificacaoPadrao && !CLASSIFICACOES_DADO_SUPORTADAS.has(dados.classificacaoPadrao as (typeof CLASSIFICACOES_DADO_SUPORTADAS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM081",
        `Dados em ${contexto} declarou classificacao_padrao invalida: "${dados.classificacaoPadrao}".`,
        "erro",
        bloco.intervalo,
        "Use publico, interno, pii, financeiro, credencial ou segredo.",
      ),
    );
  }
  if (dados.redacaoLog && !REDACOES_LOG_SUPORTADAS.has(dados.redacaoLog as (typeof REDACOES_LOG_SUPORTADAS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM082",
        `Dados em ${contexto} declarou redacao_log invalida: "${dados.redacaoLog}".`,
        "erro",
        bloco.intervalo,
        "Use livre, parcial, obrigatoria ou proibida.",
      ),
    );
  }

  for (const subbloco of bloco.blocos) {
    if (subbloco.tipo !== "bloco_generico") {
      continue;
    }
    const nomeSubbloco = subbloco.nome ?? subbloco.palavraChave;
    if (nomeSubbloco !== "input" && nomeSubbloco !== "output") {
      diagnosticos.push(
        criarDiagnostico(
          "SEM083",
          `Dados em ${contexto} nao suporta o subbloco "${nomeSubbloco}".`,
          "erro",
          subbloco.intervalo,
          "Use apenas campos diretos ou subblocos input/output para classificar dados.",
        ),
      );
      continue;
    }

    for (const campo of subbloco.campos) {
      const classificacao = valorCampoCompleto(campo);
      if (classificacao && !CLASSIFICACOES_DADO_SUPORTADAS.has(classificacao as (typeof CLASSIFICACOES_DADO_SUPORTADAS extends Set<infer T> ? T : never))) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM081",
            `Dados em ${contexto} declarou classificacao invalida para "${nomeSubbloco}.${campo.nome}": "${classificacao}".`,
            "erro",
            campo.intervalo,
            "Use publico, interno, pii, financeiro, credencial ou segredo.",
          ),
        );
      }
    }
  }
}

function validarAuditBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    if (!CAMPOS_AUDIT_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM084",
          `Campo de audit "${campo.nome}" nao e suportado em ${contexto}.`,
          "erro",
          campo.intervalo,
          "Use evento, ator, correlacao, retencao ou motivo em audit.",
        ),
      );
    }
  }

  const audit = extrairContratoAudit(bloco);
  if (!audit.evento) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM085",
        `Audit em ${contexto} precisa declarar evento.`,
        "erro",
        bloco.intervalo,
        "Explique qual evento auditavel sera registrado para a operacao.",
      ),
    );
  }
  if (audit.motivo && !MOTIVOS_AUDIT_SUPORTADOS.has(audit.motivo as (typeof MOTIVOS_AUDIT_SUPORTADOS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM086",
        `Audit em ${contexto} declarou motivo invalido: "${audit.motivo}".`,
        "erro",
        bloco.intervalo,
        "Use obrigatorio, opcional ou dispensado.",
      ),
    );
  }
}

function validarSegredosBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  const segredos = extrairContratoSegredos(bloco);
  if (segredos.itens.length === 0) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM087",
        `Segredos em ${contexto} precisa declarar ao menos um segredo nomeado.`,
        "erro",
        bloco.intervalo,
        "Use segredos { nome_do_segredo { origem: vault escopo: runtime ... } }.",
      ),
    );
    return;
  }

  for (const item of bloco.blocos) {
    if (item.tipo !== "bloco_generico") {
      continue;
    }

    for (const campo of item.campos) {
      if (!CAMPOS_SEGREDO_SUPORTADOS.has(campo.nome)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM087",
            `Segredo "${item.nome ?? item.palavraChave}" em ${contexto} usa o campo "${campo.nome}", que nao e suportado.`,
            "erro",
            campo.intervalo,
            "Use origem, escopo, acesso, rotacao, nao_logar, nao_retornar ou mascarar.",
          ),
        );
      }
    }

    const nomeSegredo = item.nome ?? item.palavraChave;
    const origem = valorCampoCompleto(localizarCampo(item, "origem"));
    if (!origem) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM088",
          `Segredo "${nomeSegredo}" em ${contexto} precisa declarar origem.`,
          "erro",
          item.intervalo,
          "Explicite a origem do segredo, como vault, env, secret_manager ou runtime.",
        ),
      );
    }

    for (const nomeBooleano of ["nao_logar", "nao_retornar", "mascarar"]) {
      const campo = localizarCampo(item, nomeBooleano);
      const valor = valorCampoCompleto(campo);
      if (campo && valor !== "verdadeiro" && valor !== "true" && valor !== "falso" && valor !== "false") {
        diagnosticos.push(
          criarDiagnostico(
            "SEM089",
            `Segredo "${nomeSegredo}" em ${contexto} declarou "${nomeBooleano}" com valor invalido: "${valor}".`,
            "erro",
            campo.intervalo,
            "Use verdadeiro/falso para campos booleanos de segredos.",
          ),
        );
      }
    }
  }
}

function validarForbiddenBloco(
  bloco: BlocoGenericoAst | undefined,
  efeitos: BlocoGenericoAst["linhas"],
  diagnosticos: Diagnostico[],
  contexto: string,
): ReturnType<typeof extrairContratoForbidden> {
  const forbidden = extrairContratoForbidden(bloco);
  if (!bloco) {
    return forbidden;
  }

  for (const regra of forbidden.regras) {
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/u.test(regra)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM090",
          `Forbidden em ${contexto} declarou regra invalida: "${regra}".`,
          "erro",
          bloco.intervalo,
          "Use regras simples como network.egress, shell.exec, retorno.credencial ou log.segredo.",
        ),
      );
    }
  }

  for (const linha of efeitos) {
    const efeito = parsearEfeitoSemantico(linha.conteudo);
    if (efeito && forbiddenContemRegra(forbidden, efeito.categoria)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM091",
          `Forbidden em ${contexto} proibe "${efeito.categoria}", mas effects ainda declara esse efeito.`,
          "erro",
          linha.intervalo,
          "Remova o efeito proibido ou ajuste o bloco forbidden para refletir a operacao permitida de verdade.",
        ),
      );
    }
  }

  return forbidden;
}

function coletarPerfilSegurancaDeclarado(
  corpo: BlocoGenericoAst,
  effects: BlocoGenericoAst | undefined,
  diagnosticos: Diagnostico[] | undefined,
  contexto: string,
): PerfilSegurancaDeclarado {
  const authBloco = localizarBloco(corpo, "auth");
  const authzBloco = localizarBloco(corpo, "authz");
  const dadosBloco = localizarBloco(corpo, "dados");
  const auditBloco = localizarBloco(corpo, "audit");
  const segredosBloco = localizarBloco(corpo, "segredos");
  const forbiddenBloco = localizarBloco(corpo, "forbidden");

  if (diagnosticos) {
    validarAuthBloco(authBloco, diagnosticos, contexto);
    validarAuthzBloco(authzBloco, diagnosticos, contexto);
    validarDadosBloco(dadosBloco, diagnosticos, contexto);
    validarAuditBloco(auditBloco, diagnosticos, contexto);
    validarSegredosBloco(segredosBloco, diagnosticos, contexto);
  }
  const forbidden = diagnosticos
    ? validarForbiddenBloco(forbiddenBloco, effects?.linhas ?? [], diagnosticos, contexto)
    : extrairContratoForbidden(forbiddenBloco);

  const auth = extrairContratoAuth(authBloco);
  const authz = extrairContratoAuthz(authzBloco);
  const dados = extrairContratoDados(dadosBloco);
  const audit = extrairContratoAudit(auditBloco);
  const segredos = extrairContratoSegredos(segredosBloco);
  const efeitosEstruturados = (effects?.linhas ?? [])
    .map((linha) => parsearEfeitoSemantico(linha.conteudo))
    .filter((efeito): efeito is NonNullable<typeof efeito> => Boolean(efeito));

  return {
    auth,
    authz,
    dados,
    audit,
    segredos,
    forbidden,
    efeitoPrivilegiado: efeitosEstruturados.some((efeito) => efeitoEhPrivilegiado(efeito)),
    dadosSensiveis: contratoDadosTemSensivel(dados),
    exigeSegredos: efeitosEstruturados.some((efeito) => efeitoRequerSegredo(efeito)) || contratoDadosTemSegredoOuCredencial(dados),
  };
}

function emitirGuardrailsSeguranca(
  contexto: string,
  intervalo: CampoAst["intervalo"] | undefined,
  perfil: PerfilSegurancaDeclarado,
  diagnosticos: Diagnostico[],
  opcoes: { publico: boolean; sensivel: boolean },
): void {
  const exigeAuth = opcoes.publico;
  const exigeAuthz = opcoes.publico || opcoes.sensivel || perfil.efeitoPrivilegiado || perfil.dadosSensiveis;
  const exigeDados = opcoes.publico || opcoes.sensivel || perfil.efeitoPrivilegiado;
  const exigeAudit = opcoes.publico || opcoes.sensivel || perfil.efeitoPrivilegiado || perfil.dadosSensiveis;
  const exigeSegredos = perfil.exigeSegredos;
  const exigeForbidden = perfil.efeitoPrivilegiado || perfil.dadosSensiveis;

  if (exigeAuth && !perfil.auth.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM094",
        `${contexto} deveria declarar auth explicita para reduzir ambiguidade de seguranca na borda publica.`,
        "aviso",
        intervalo,
        "Declare auth { modo: obrigatorio|anonimo ... } para deixar a intencao da exposicao publica cristalina.",
      ),
    );
  }
  if (exigeAuthz && !perfil.authz.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM095",
        `${contexto} deveria declarar authz explicita porque opera com risco, privilegio ou exposicao publica.`,
        "aviso",
        intervalo,
        "Declare papeis, escopos ou politica em authz para nao empurrar autorizacao para o limbo do codigo vivo.",
      ),
    );
  }
  if (exigeDados && !perfil.dados.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM096",
        `${contexto} deveria classificar dados de forma explicita em dados { ... }.`,
        "aviso",
        intervalo,
        "Classifique input/output com publico, interno, pii, financeiro, credencial ou segredo.",
      ),
    );
  }
  if (exigeAudit && !perfil.audit.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM097",
        `${contexto} deveria declarar audit explicita para operar com trilha semantica de seguranca.`,
        "aviso",
        intervalo,
        "Declare audit { evento: ... correlacao: ... motivo: ... } para nao depender de adivinhacao operacional.",
      ),
    );
  }
  if (exigeSegredos && !perfil.segredos.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM098",
        `${contexto} deveria declarar segredos explicitos porque toca credencial, segredo ou secret.read.`,
        "aviso",
        intervalo,
        "Use segredos { nome { origem: vault escopo: runtime ... } } para governar acesso sensivel.",
      ),
    );
  }
  if (exigeForbidden && !perfil.forbidden.explicita) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM099",
        `${contexto} deveria declarar forbidden explicito para proibir operacoes perigosas ou vazamento semantico.`,
        "aviso",
        intervalo,
        "Use forbidden { network.egress shell.exec log.segredo retorno.credencial } conforme o risco da operacao.",
      ),
    );
  }
}

function validarErroOperacional(task: TaskAst, diagnosticos: Diagnostico[]): void {
  if (!task.error) {
    return;
  }

  const nomes = new Set<string>();
  for (const campo of task.error.campos) {
    if (nomes.has(campo.nome)) {
      diagnosticos.push(diagnosticoDuplicado(campo.nome, "Erro", campo.intervalo));
    }
    nomes.add(campo.nome);
  }

  for (const bloco of task.error.blocos) {
    if (bloco.tipo !== "bloco_generico") {
      continue;
    }

    const codigo = bloco.nome ?? bloco.palavraChave;
    if (!codigo || codigo === "desconhecido") {
      continue;
    }

    if (nomes.has(codigo)) {
      diagnosticos.push(diagnosticoDuplicado(codigo, "Erro", bloco.intervalo));
    }
    nomes.add(codigo);

    const mensagem = localizarCampo(bloco, "mensagem");
    if (!mensagem) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM067",
          `Erro estruturado "${codigo}" da task "${task.nome}" precisa declarar mensagem.`,
          "erro",
          bloco.intervalo,
          "Use error { codigo { mensagem: \"...\" categoria: dominio ... } }.",
        ),
      );
    }

    for (const campo of bloco.campos) {
      if (!CAMPOS_ERRO_OPERACIONAL.has(campo.nome)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM068",
            `Erro estruturado "${codigo}" da task "${task.nome}" usa o campo "${campo.nome}", que nao e suportado.`,
            "erro",
            campo.intervalo,
            "Use mensagem, categoria, recuperabilidade, acao_chamador, impacta_estado ou requer_compensacao.",
          ),
        );
      }
    }
  }
}

function validarSuperficie(
  superficie: BlocoGenericoAst,
  tipoSuperficie: SimboloSemantico["categoria"],
  tasksConhecidas: Set<string>,
  tiposConhecidos: Set<string>,
  diagnosticos: Diagnostico[],
): void {
  const nomeSuperficie = superficie.nome ?? tipoSuperficie;
  const task = localizarCampo(superficie, "task", "tarefa");
  const input = localizarBloco(superficie, "input");
  const output = localizarBloco(superficie, "output");
  const effects = localizarBloco(superficie, "effects");
  const impl = localizarBloco(superficie, "impl");
  const vinculos = localizarBloco(superficie, "vinculos");
  const execucao = localizarBloco(superficie, "execucao");

  if (!task && !impl && !vinculos) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM069",
        `Superficie ${tipoSuperficie} "${nomeSuperficie}" precisa declarar task, impl ou vinculos para nao virar bloco decorativo.`,
        "erro",
        superficie.intervalo,
        "Declare ao menos uma task associada, um impl explicito ou vinculos rastreaveis com codigo vivo.",
      ),
    );
  }

  if (task && !tasksConhecidas.has(task.valor)) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM070",
        `Superficie ${tipoSuperficie} "${nomeSuperficie}" referencia task "${task.valor}" que nao existe.`,
        "erro",
        task.intervalo,
        "Ajuste a task para apontar para uma task declarada ou importada.",
      ),
    );
  }

  if (input) {
    validarCamposDeTipos(input.campos, tiposConhecidos, diagnosticos, `input da superficie ${tipoSuperficie} ${nomeSuperficie}`);
  }
  if (output) {
    validarCamposDeTipos(output.campos, tiposConhecidos, diagnosticos, `output da superficie ${tipoSuperficie} ${nomeSuperficie}`);
  }
  if (effects) {
    validarEfeitosDeclarados(effects.linhas, diagnosticos, `effects da superficie ${tipoSuperficie} ${nomeSuperficie}`);
  }
  validarExecucaoBloco(execucao, diagnosticos, `superficie ${tipoSuperficie} "${nomeSuperficie}"`);
  validarVinculos(vinculos, diagnosticos, `${tipoSuperficie} ${nomeSuperficie}`);

  const perfilSeguranca = coletarPerfilSegurancaDeclarado(
    superficie,
    effects,
    diagnosticos,
    `superficie ${tipoSuperficie} "${nomeSuperficie}"`,
  );
  emitirGuardrailsSeguranca(
    `Superficie ${tipoSuperficie} "${nomeSuperficie}"`,
    superficie.intervalo,
    perfilSeguranca,
    diagnosticos,
    {
      publico: superficieEhPublica(superficie, tipoSuperficie),
      sensivel: perfilSeguranca.efeitoPrivilegiado || perfilSeguranca.dadosSensiveis,
    },
  );
}

function recomporCaminhoRoute(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }

  return [campo.valor, ...campo.modificadores]
    .join(" ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

function serializarTransicao(origem: string, destino: string): string {
  return `${origem}->${destino}`;
}

function descreverSugestoes(valores: Iterable<string>, prefixo: string): string | undefined {
  const lista = [...new Set([...valores].filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (lista.length === 0) {
    return undefined;
  }
  const recorte = lista.slice(0, 6).join(", ");
  return `${prefixo}: ${recorte}${lista.length > 6 ? ", ..." : ""}.`;
}

function listarCandidatosUseRelativo(moduloAtual: string, caminhoImportado: string): string[] {
  const segmentos = moduloAtual.split(".").filter(Boolean);
  const caminhoNormalizado = caminhoImportado.replace(/^\.+/u, "").trim();
  if (!caminhoNormalizado || segmentos.length <= 1) {
    return [];
  }

  const candidatos: string[] = [];
  for (let tamanho = segmentos.length - 1; tamanho >= 1; tamanho -= 1) {
    const candidato = [...segmentos.slice(0, tamanho), caminhoNormalizado].join(".");
    if (candidato !== caminhoImportado) {
      candidatos.push(candidato);
    }
  }

  return [...new Set(candidatos)];
}

function resolverUseSema(
  moduloAtual: string,
  caminhoImportado: string,
  contextosModulos?: Map<string, ContextoSemantico>,
): { caminhoResolvido?: string; candidatosRelativos: string[] } {
  if (!contextosModulos) {
    return { caminhoResolvido: undefined, candidatosRelativos: [] };
  }

  if (contextosModulos.has(caminhoImportado)) {
    return { caminhoResolvido: caminhoImportado, candidatosRelativos: [] };
  }

  const candidatosRelativos = listarCandidatosUseRelativo(moduloAtual, caminhoImportado);
  const caminhoResolvido = candidatosRelativos.find((candidato) => contextosModulos.has(candidato));
  return { caminhoResolvido, candidatosRelativos };
}

function descreverDicaSintaxeExpressao(texto: string, dicaPadrao: string): string {
  const normalizado = texto.trim();
  if (
    /\sou\s/u.test(normalizado)
    && (
      normalizado.includes("\"")
      || normalizado.includes("'")
      || /^[A-Za-z_][A-Za-z0-9_.]*\s*(==|!=|>|<|>=|<=)\s+.+\s+ou\s+.+$/u.test(normalizado)
    )
    && !/\bem\s+\[/u.test(normalizado)
  ) {
    const alvo = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*(==|!=|>|<|>=|<=)/u)?.[1];
    if (alvo) {
      return `${dicaPadrao} Se a ideia era comparar ${alvo} contra varios valores, repita o campo em cada comparacao ou prefira "${alvo} em [A, B]".`;
    }
    return `${dicaPadrao} Se a ideia era comparar um campo contra varios valores, repita o campo em cada comparacao ou prefira "campo em [A, B]".`;
  }

  return dicaPadrao;
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
    dicaReferenciaPersonalizada?: (raiz: string, linha: string) => string | undefined;
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
          descreverDicaSintaxeExpressao(linha.conteudo, contexto.dicaSintaxe),
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
            contexto.dicaReferenciaPersonalizada?.(raiz, linha.conteudo) ?? contexto.dicaReferencia,
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
          "Use o formato \"categoria alvo\" ou \"categoria alvo detalhe\", podendo adicionar criticidade=..., privilegio=... e isolamento=....",
        ),
      );
      continue;
    }

    if (!ehCategoriaEfeitoSemantico(efeito.categoria)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM048",
          `Categoria de efeito "${efeito.categoria}" nao e suportada em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use categorias como persistencia, consulta, evento, auditoria, db.write, queue.publish, fs.write, network.egress, secret.read ou shell.exec.",
        ),
      );
    }

    if (efeito.criticidadeTexto && !ehCriticidadeEfeitoSemantico(efeito.criticidadeTexto)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM052",
          `Criticidade de efeito "${efeito.criticidadeTexto}" nao e suportada em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use apenas criticidade=baixa, criticidade=media, criticidade=alta ou criticidade=critica.",
        ),
      );
    }

    if (
      efeito.privilegioTexto
      && !["leitura", "escrita", "publicacao", "execucao", "admin", "egress"].includes(efeito.privilegioTexto)
    ) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM092",
          `Privilegio de efeito "${efeito.privilegioTexto}" nao e suportado em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use privilegio=leitura, privilegio=escrita, privilegio=publicacao, privilegio=execucao, privilegio=admin ou privilegio=egress.",
        ),
      );
    }

    if (
      efeito.isolamentoTexto
      && !["tenant", "processo", "host", "vps", "global"].includes(efeito.isolamentoTexto)
    ) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM093",
          `Isolamento de efeito "${efeito.isolamentoTexto}" nao e suportado em ${contexto}.`,
          "erro",
          linha.intervalo,
          "Use isolamento=tenant, isolamento=processo, isolamento=host, isolamento=vps ou isolamento=global.",
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

function validarInvariantesDeCampos(
  bloco: BlocoGenericoAst,
  nomeBloco: string,
  diagnosticos: Diagnostico[],
): void {
  const fields = localizarBloco(bloco, "fields");
  const nomesCampos = new Set([
    ...bloco.campos.map((campo) => campo.nome),
    ...(fields?.campos ?? []).map((campo) => campo.nome),
  ]);

  const invariants = localizarBloco(bloco, "invariants");
  if (!invariants) {
    return;
  }

  validarExpressoesDeclaradas(invariants.linhas, diagnosticos, {
    codigoErroSintaxe: "SEM062",
    codigoErroReferencia: "SEM063",
    nomeBloco: `invariants de ${nomeBloco}`,
    simbolosPermitidos: nomesCampos,
    dicaSintaxe: "Use expressoes como \"campo existe\", \"campo == valor\" ou \"campo em [A, B]\".",
    dicaReferencia: "Referencie apenas campos declarados no proprio bloco ao escrever invariantes de dominio.",
  });
}

function validarFlow(
  flow: FlowAst,
  tasksConhecidas: Set<string>,
  tarefasDetalhadas: Map<string, ResumoTaskSemantico>,
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

  const effects = localizarBloco(flow.corpo, "effects");
  if (effects) {
    validarEfeitosDeclarados(effects.linhas, diagnosticos, `effects do flow ${flow.nome}`);
  }
  validarVinculos(flow.vinculos, diagnosticos, `flow ${flow.nome}`);

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
          "Use o formato \"etapa nome usa task com campo=valor quando expressao depende_de etapa_a, etapa_b em_sucesso proxima em_erro falha\".",
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
      const sugestoesTasks = descreverSugestoes(tasksConhecidas, "Tasks conhecidas no contexto");
      diagnosticos.push(
        criarDiagnostico(
          "SEM034",
          `Etapa "${item.etapa.nome}" do flow "${flow.nome}" usa task "${item.etapa.task}" que nao existe.`,
          "erro",
          item.linha.intervalo,
          sugestoesTasks ?? "Ajuste a task da etapa para apontar para uma task declarada ou importada.",
        ),
      );
    }

    if (item.etapa.task) {
      const detalhesTask = tarefasDetalhadas.get(item.etapa.task);
      if (detalhesTask) {
        const indiceInput = indicesCampos(detalhesTask.input);
        for (const mapeamento of item.etapa.mapeamentos) {
          const campoInput = indiceInput.get(mapeamento.campo);
          if (!campoInput) {
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
          const aceitaLiteralTextual = Boolean(
            campoInput
            && ["Texto", "Id", "Email", "Url"].includes(campoInput.tipo)
            && !mapeamento.valor.includes(".")
            && !contextoFlow.has(raizValor)
            && !nomesEtapas.has(raizValor),
          );
          if (!ehLiteral && !aceitaLiteralTextual && !contextoFlow.has(raizValor) && !nomesEtapas.has(raizValor)) {
            const sugestoesContexto = [
              descreverSugestoes(contextoFlow, "Campos do flow"),
              descreverSugestoes(nomesEtapas, "Etapas conhecidas"),
            ].filter(Boolean).join(" ");
            diagnosticos.push(
              criarDiagnostico(
                "SEM043",
                `Etapa "${item.etapa.nome}" do flow "${flow.nome}" referencia "${mapeamento.valor}" fora do contexto conhecido.`,
                "erro",
                item.linha.intervalo,
                sugestoesContexto || "Mapeie usando campos do proprio flow, saidas de etapas anteriores ou literais simples.",
              ),
            );
          }

          if (mapeamento.valor.includes(".")) {
            const [etapaOrigem, campoSaida] = mapeamento.valor.split(".", 2);
            const etapaReferenciada = etapaOrigem ? etapasValidas.get(etapaOrigem) : undefined;
            const taskReferenciada = etapaReferenciada?.task ? tarefasDetalhadas.get(etapaReferenciada.task) : undefined;
            const indiceOutput = taskReferenciada ? indicesCampos(taskReferenciada.output) : undefined;
            if (etapaOrigem && campoSaida && etapaReferenciada && indiceOutput && !indiceOutput.has(campoSaida)) {
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
        if (!ehMarcadorSemantico(referencia) && !tasksConhecidas.has(referencia) && !nomesEtapas.has(referencia) && !contextoFlow.has(referencia)) {
          diagnosticos.push(
            criarDiagnostico(
              "SEM035",
              `Condicao da etapa "${item.etapa.nome}" em flow "${flow.nome}" referencia "${referencia}" fora do contexto atual.`,
              "erro",
              item.linha.intervalo,
              "No MVP atual, condicoes de flow devem apontar para marcadores semanticos, campos do flow, tasks conhecidas ou etapas anteriores.",
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
        const sugestoesEtapas = descreverSugestoes(nomesEtapas, "Etapas declaradas");
        diagnosticos.push(
          criarDiagnostico(
            "SEM036",
            `Etapa "${item.etapa.nome}" do flow "${flow.nome}" depende de "${dependencia}", que nao foi declarada.`,
            "erro",
            item.linha.intervalo,
            sugestoesEtapas ?? "Declare a etapa dependente no mesmo flow antes de referencia-la.",
          ),
        );
      }
    }

    for (const destino of [item.etapa.emSucesso, item.etapa.emErro].filter(Boolean)) {
      if (destino && !nomesEtapas.has(destino)) {
        const sugestoesEtapas = descreverSugestoes(nomesEtapas, "Etapas declaradas");
        diagnosticos.push(
          criarDiagnostico(
            "SEM045",
            `Etapa "${item.etapa.nome}" do flow "${flow.nome}" aponta para "${destino}" em ramificacao, mas essa etapa nao foi declarada.`,
            "erro",
            item.linha.intervalo,
            sugestoesEtapas ?? "Declare a etapa de destino no mesmo flow antes de usa-la em em_sucesso ou em_erro.",
          ),
        );
      }
    }

    if (item.etapa.task) {
      const detalhesTask = tarefasDetalhadas.get(item.etapa.task);
      const indiceErrors = indiceErros(detalhesTask?.errors ?? []);
      for (const rotaErro of item.etapa.porErro) {
        if (!indiceErrors.has(rotaErro.tipo)) {
          const sugestoesErros = descreverSugestoes(indiceErrors.keys(), "Erros declarados pela task");
          diagnosticos.push(
            criarDiagnostico(
              "SEM046",
              `Etapa "${item.etapa.nome}" do flow "${flow.nome}" roteia o erro "${rotaErro.tipo}", mas esse erro nao pertence ao contrato da task "${item.etapa.task}".`,
              "erro",
              item.linha.intervalo,
              sugestoesErros ?? "Use apenas erros declarados pela task ou cobertos por testes de erro do contrato atual.",
            ),
          );
        }

        if (!nomesEtapas.has(rotaErro.destino)) {
          const sugestoesEtapas = descreverSugestoes(nomesEtapas, "Etapas declaradas");
          diagnosticos.push(
            criarDiagnostico(
              "SEM047",
              `Etapa "${item.etapa.nome}" do flow "${flow.nome}" aponta o erro "${rotaErro.tipo}" para "${rotaErro.destino}", mas essa etapa nao foi declarada.`,
              "erro",
              item.linha.intervalo,
              sugestoesEtapas ?? "Declare a etapa de destino no mesmo flow antes de usa-la em por_erro.",
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

function validarContratoRoute(
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

function validarRoute(
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

function validarGuardrailsSeguranca(modulo: ModuloAst, diagnosticos: Diagnostico[]): void {
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
