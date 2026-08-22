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
  origem: "ts" | "js" | "py" | "dart" | "lua" | "cs" | "java" | "go" | "rust" | "cpp" | "php";
  caminho: string;
}
export interface ImplementacaoTaskSemantica {
  origem: "ts" | "js" | "py" | "dart" | "lua" | "cs" | "java" | "go" | "rust" | "cpp" | "php";
  caminho: string;
  papel?: "rota" | "servico" | "persistencia" | "repositorio";
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
export function ehUseInterop(
  use: ModuloAst["uses"][number],
): use is ModuloAst["uses"][number] & { origem: InteropSemantico["origem"] } {
  return use.origem !== "sema";
}
export const TIPOS_PRIMITIVOS = new Set([
  "Texto",
  "Numero",
  "Inteiro",
  "Decimal",
  "Booleano",
  "Data",
  "DataHora",
  "Timestamp",
  "Id",
  "Email",
  "Url",
  "Json",
  "Objeto",
  "Vazio",
]);
export const TIPOS_COMPOSTOS_SUPORTADOS = new Set(["Lista", "Mapa", "Opcional", "Ou"]);
export const CAMPOS_VINCULO_SUPORTADOS = new Set([
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
export const CAMPOS_EXECUCAO_SUPORTADOS = new Set([
  "idempotencia",
  "timeout",
  "retry",
  "compensacao",
  "criticidade_operacional",
]);
export const CAMPOS_AUTH_SUPORTADOS = new Set([
  "modo",
  "estrategia",
  "principal",
  "origem",
]);
export const CAMPOS_AUTHZ_SUPORTADOS = new Set([
  "papel",
  "papeis",
  "escopo",
  "escopos",
  "politica",
  "tenant",
]);
export const CAMPOS_DADOS_SUPORTADOS = new Set([
  "classificacao_padrao",
  "redacao_log",
  "retencao",
]);
export const CAMPOS_AUDIT_SUPORTADOS = new Set([
  "evento",
  "ator",
  "correlacao",
  "retencao",
  "motivo",
]);
export const CAMPOS_SEGREDO_SUPORTADOS = new Set([
  "origem",
  "escopo",
  "acesso",
  "rotacao",
  "nao_logar",
  "nao_retornar",
  "mascarar",
]);
export const CAMPOS_ERRO_OPERACIONAL = new Set([
  "mensagem",
  "categoria",
  "recuperabilidade",
  "acao_chamador",
  "impacta_estado",
  "requer_compensacao",
]);
export const CRITICIDADES_OPERACIONAIS = new Set(["baixa", "media", "alta", "critica"]);
export type PerfilCompatibilidadeSemantica = "publico" | "interno" | "experimental" | "legado" | "deprecado";
export const PADRAO_CAMINHO_INTEROP = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
export function normalizarOrigemImplementacao(valor: string): ImplementacaoTaskSemantica["origem"] | undefined {
  switch (valor.toLowerCase()) {
    case "ts":
    case "typescript":
      return "ts";
    case "js":
    case "javascript":
      return "js";
    case "py":
    case "python":
      return "py";
    case "dart":
      return "dart";
    case "lua":
      return "lua";
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
    case "php":
      return "php";
    default:
      return undefined;
  }
}
export function extrairReferenciasDeTipos(texto: string): string[] {
  const correspondencias = texto.match(/[A-Z][A-Za-z0-9_]*/g);
  return (correspondencias ?? []).filter((referencia) => !TIPOS_COMPOSTOS_SUPORTADOS.has(referencia));
}
export function extrairRaiz(referencia: string): string {
  return referencia.split(".")[0] ?? referencia;
}
export function ehMarcadorSemantico(referencia: string): boolean {
  return ["persistencia", "sucesso", "estado"].includes(extrairRaiz(referencia));
}
export function diagnosticoDuplicado(nome: string, categoria: string, intervalo?: CampoAst["intervalo"]): Diagnostico {
  return criarDiagnostico(
    "SEM001",
    `${categoria} "${nome}" foi declarado mais de uma vez no mesmo modulo.`,
    "erro",
    intervalo,
    "Use nomes unicos para simbolos do modulo.",
  );
}
export function validarCamposDeTipos(
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
export function localizarBloco(corpo: BlocoGenericoAst | undefined, nome: string): BlocoGenericoAst | undefined {
  if (!corpo) {
    return undefined;
  }
  return corpo.blocos.find((bloco): bloco is BlocoGenericoAst =>
    bloco.tipo === "bloco_generico" && (bloco.palavraChave === nome || bloco.nome === nome));
}
export function localizarCampo(bloco: BlocoGenericoAst | undefined, ...nomes: string[]): CampoAst | undefined {
  if (!bloco) {
    return undefined;
  }
  return bloco.campos.find((campo) => nomes.includes(campo.nome));
}
export function valorCampoCompleto(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }
  return [campo.valor, ...campo.modificadores].join(" ").trim() || undefined;
}
export function parsearBooleanoSemantico(valor?: string): boolean | undefined {
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
export function converterCampoSemantico(campo: CampoAst): CampoSemantico {
  return {
    nome: campo.nome,
    tipo: campo.valor,
    modificadores: [...campo.modificadores],
  };
}
export function indicesCampos(campos: CampoSemantico[]): Map<string, CampoSemantico> {
  return new Map(campos.map((campo) => [campo.nome, campo]));
}
export function indiceErros(erros: ErroSemanticoTask[]): Map<string, ErroSemanticoTask> {
  return new Map(erros.map((erro) => [erro.codigo, erro]));
}
export function coletarErrosTask(task: TaskAst): ErroSemanticoTask[] {
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
export const PAPEIS_IMPLEMENTACAO_SUPORTADOS = new Set(["rota", "servico", "persistencia", "repositorio"] as const);

export interface NomeCampoImplementacao {
  origem: ImplementacaoTaskSemantica["origem"];
  papel?: ImplementacaoTaskSemantica["papel"];
}

export function normalizarNomeCampoImplementacao(valor: string): NomeCampoImplementacao | undefined {
  const segmentos = valor.toLowerCase().split("_");
  if (segmentos.length > 2) {
    return undefined;
  }
  const origem = normalizarOrigemImplementacao(segmentos[0] ?? "");
  if (!origem) {
    return undefined;
  }
  const papel = segmentos[1];
  if (papel === undefined) {
    return { origem };
  }
  if (!PAPEIS_IMPLEMENTACAO_SUPORTADOS.has(papel as (typeof PAPEIS_IMPLEMENTACAO_SUPORTADOS extends Set<infer T> ? T : never))) {
    return undefined;
  }
  return { origem, papel: papel as ImplementacaoTaskSemantica["papel"] };
}

export function coletarResumoTask(task: TaskAst): ResumoTaskSemantico {
  return {
    input: (task.input?.campos ?? []).map(converterCampoSemantico),
    output: (task.output?.campos ?? []).map(converterCampoSemantico),
    errors: coletarErrosTask(task),
    guarantees: (task.guarantees?.linhas ?? []).map((linha) => linha.conteudo),
    implementacoes: (task.impl?.campos ?? [])
      .map((campo) => {
        const nome = normalizarNomeCampoImplementacao(campo.nome);
        return nome
          ? { origem: nome.origem, ...(nome.papel ? { papel: nome.papel } : {}), caminho: campo.valor }
          : undefined;
      })
      .filter((item): item is ImplementacaoTaskSemantica => Boolean(item)),
  };
}
export function validarImplementacoesTask(task: TaskAst, diagnosticos: Diagnostico[]): void {
  if (!task.impl) {
    return;
  }
  const chaves = new Set<string>();
  for (const campo of task.impl.campos) {
    const nome = normalizarNomeCampoImplementacao(campo.nome);
    if (!nome) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM059",
          `Task "${task.nome}" declarou implementacao externa invalida em impl: "${campo.nome}".`,
          "erro",
          campo.intervalo,
          "Use ts, js, py, dart, lua, cs, java, go, rust, cpp ou php, opcionalmente com papel de qualquer origem: <origem>_rota, <origem>_servico, <origem>_persistencia ou <origem>_repositorio (ex.: ts_rota, php_servico, cs_persistencia).",
        ),
      );
      continue;
    }
    const rotulo = nome.papel ? `${nome.origem}_${nome.papel}` : nome.origem;
    const chave = `${nome.origem}:${nome.papel ?? "-"}`;
    if (chaves.has(chave)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM060",
          `Task "${task.nome}" declarou mais de uma implementacao ${rotulo} no bloco impl.`,
          "erro",
          campo.intervalo,
          "Cada combinacao de origem e papel deve aparecer no maximo uma vez; use papeis distintos como ts_rota e ts_servico para camadas diferentes.",
        ),
      );
      continue;
    }
    chaves.add(chave);
    if (!PADRAO_CAMINHO_INTEROP.test(campo.valor)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM061",
          `Task "${task.nome}" declarou caminho invalido para impl ${rotulo}: "${campo.valor}".`,
          "erro",
          campo.intervalo,
          "Use um identificador de implementacao como pacote.modulo.funcao ou app.servico.metodo.",
        ),
      );
    }
  }
}
export function validarVinculos(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
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
export function extrairPerfilCompatibilidade(
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
