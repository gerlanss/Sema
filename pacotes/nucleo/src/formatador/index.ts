import type {
  BlocoAst,
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
  UseAst,
} from "../ast/tipos.js";
import type { Diagnostico } from "../diagnosticos/index.js";
import { parsear } from "../parser/parser.js";
import { tokenizar } from "../lexer/lexer.js";

const ORDEM_BLOCOS_MODULO = new Map<string, number>([
  ["docs", 0],
  ["comments", 1],
  ["use", 2],
  ["type", 3],
  ["entity", 4],
  ["enum", 5],
  ["state", 6],
  ["task", 7],
  ["flow", 8],
  ["route", 9],
  ["tests", 10],
  ["desconhecido", 11],
]);

const ORDEM_SUBBLOCOS_TASK = new Map<string, number>([
  ["docs", 0],
  ["comments", 1],
  ["input", 2],
  ["output", 3],
  ["rules", 4],
  ["effects", 5],
  ["state", 6],
  ["guarantees", 7],
  ["error", 8],
  ["tests", 9],
  ["desconhecido", 10],
]);

const ORDEM_SUBBLOCOS_ROUTE = new Map<string, number>([
  ["input", 0],
  ["output", 1],
  ["effects", 2],
  ["error", 3],
  ["docs", 4],
  ["comments", 5],
  ["desconhecido", 6],
]);

const ORDEM_SUBBLOCOS_STATE = new Map<string, number>([
  ["fields", 0],
  ["invariants", 1],
  ["transitions", 2],
  ["docs", 3],
  ["comments", 4],
  ["desconhecido", 5],
]);

const ORDEM_SUBBLOCOS_TESTE = new Map<string, number>([
  ["given", 0],
  ["when", 1],
  ["expect", 2],
  ["error", 3],
  ["docs", 4],
  ["comments", 5],
  ["desconhecido", 6],
]);

export interface ResultadoFormatacao {
  modulo?: ModuloAst;
  codigoFormatado?: string;
  diagnosticos: Diagnostico[];
  alterado: boolean;
}

function indentacao(nivel: number): string {
  return "  ".repeat(nivel);
}

function ordenarPorMapa<T>(itens: T[], extrairChave: (item: T) => string, ordem: Map<string, number>): T[] {
  return [...itens].sort((a, b) => {
    const ordemA = ordem.get(extrairChave(a)) ?? Number.MAX_SAFE_INTEGER;
    const ordemB = ordem.get(extrairChave(b)) ?? Number.MAX_SAFE_INTEGER;
    if (ordemA !== ordemB) {
      return ordemA - ordemB;
    }
    return extrairChave(a).localeCompare(extrairChave(b), "pt-BR");
  });
}

function normalizarEspacos(texto: string): string {
  const marcadorSeta = "__SEMA_SETA__";
  return texto
    .trim()
    .replace(/\s*->\s*/g, ` ${marcadorSeta} `)
    .replace(/\s*-\s*>\s*/g, ` ${marcadorSeta} `)
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\[\s+/g, "[")
    .replace(/\s+\]/g, "]")
    .replace(/\s*>=\s*/g, " >= ")
    .replace(/\s*<=\s*/g, " <= ")
    .replace(/\s*==\s*/g, " == ")
    .replace(/\s*!=\s*/g, " != ")
    .replace(/\s*>\s*/g, " > ")
    .replace(/\s*<\s*/g, " < ")
    .replace(new RegExp(`\\s*${marcadorSeta}\\s*`, "g"), " -> ");
}

function normalizarCaminho(texto: string): string {
  return texto
    .trim()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, "");
}

function eLiteralEscalar(texto: string): boolean {
  const normalizado = texto.trim();
  return /^-?\d+(?:\.\d+)?$/.test(normalizado) || ["verdadeiro", "falso", "nulo"].includes(normalizado);
}

function deveColocarAspas(contexto: string, campo: CampoAst, combinado: string): boolean {
  if (campo.nome === "caminho" || campo.nome === "metodo") {
    return false;
  }
  if (contexto === "docs" || contexto === "comments") {
    return true;
  }
  if (contexto === "error") {
    return !eLiteralEscalar(combinado);
  }
  if (contexto === "given" || contexto === "when" || contexto === "expect") {
    return !eLiteralEscalar(combinado);
  }
  return false;
}

function renderizarCampo(campo: CampoAst, nivel: number, contexto: string): string {
  const partes = [campo.valor, ...campo.modificadores].filter(Boolean);
  let combinado = normalizarEspacos(partes.join(" "));

  if (campo.nome === "caminho") {
    combinado = normalizarCaminho(combinado);
  }

  if (deveColocarAspas(contexto, campo, combinado)) {
    combinado = JSON.stringify(combinado);
  }

  return `${indentacao(nivel)}${campo.nome}: ${combinado}`;
}

function renderizarLinha(linha: string, nivel: number): string {
  return `${indentacao(nivel)}${normalizarEspacos(linha)}`;
}

function renderizarCasoTeste(caso: BlocoCasoTesteAst, nivel: number): string {
  const partes: string[] = [];
  if (caso.given) {
    partes.push(renderizarBlocoGenerico(caso.given, nivel + 1));
  }
  if (caso.when) {
    partes.push(renderizarBlocoGenerico(caso.when, nivel + 1));
  }
  if (caso.expect) {
    partes.push(renderizarBlocoGenerico(caso.expect, nivel + 1));
  }
  if (caso.error) {
    partes.push(renderizarBlocoGenerico(caso.error, nivel + 1));
  }
  if (caso.docs) {
    partes.push(renderizarBlocoGenerico(caso.docs, nivel + 1));
  }
  if (caso.comments) {
    partes.push(renderizarBlocoGenerico(caso.comments, nivel + 1));
  }

  return `${indentacao(nivel)}caso ${JSON.stringify(caso.nome)} {\n${partes.join("\n\n")}\n${indentacao(nivel)}}`;
}

function renderizarBlocoAst(bloco: BlocoAst, nivel: number): string {
  switch (bloco.tipo) {
    case "caso_teste":
      return renderizarCasoTeste(bloco, nivel);
    case "bloco_generico":
      return renderizarBlocoGenerico(bloco, nivel);
    case "use":
      return `${indentacao(nivel)}use ${bloco.caminho}`;
    case "enum":
      return renderizarEnum(bloco, nivel);
    case "type":
      return renderizarTipo(bloco, nivel);
    case "entity":
      return renderizarEntity(bloco, nivel);
    case "task":
      return renderizarTask(bloco, nivel);
    case "flow":
      return renderizarFlow(bloco, nivel);
    case "route":
      return renderizarRoute(bloco, nivel);
    case "state":
      return renderizarState(bloco, nivel);
  }
}

function ordenarSubblocos(bloco: BlocoGenericoAst): BlocoAst[] {
  if (bloco.palavraChave === "task") {
    return ordenarPorMapa(bloco.blocos, (item) => item.tipo === "bloco_generico" ? item.palavraChave : item.tipo, ORDEM_SUBBLOCOS_TASK);
  }
  if (bloco.palavraChave === "route") {
    return ordenarPorMapa(bloco.blocos, (item) => item.tipo === "bloco_generico" ? item.palavraChave : item.tipo, ORDEM_SUBBLOCOS_ROUTE);
  }
  if (bloco.palavraChave === "state") {
    return ordenarPorMapa(bloco.blocos, (item) => item.tipo === "bloco_generico" ? item.palavraChave : item.tipo, ORDEM_SUBBLOCOS_STATE);
  }
  if (bloco.palavraChave === "tests") {
    return ordenarPorMapa(bloco.blocos, (item) => item.tipo === "caso_teste" ? "case" : item.tipo === "bloco_generico" ? item.palavraChave : item.tipo, ORDEM_SUBBLOCOS_TESTE);
  }
  return bloco.blocos;
}

function renderizarBlocoGenerico(bloco: BlocoGenericoAst, nivel: number): string {
  const cabecalho = `${indentacao(nivel)}${bloco.palavraChave}${bloco.nome ? ` ${bloco.nome}` : ""} {`;
  const linhasCampos = bloco.campos.map((campo) => renderizarCampo(campo, nivel + 1, bloco.palavraChave));
  const linhasDeclarativas = bloco.linhas.map((linha) => renderizarLinha(linha.conteudo, nivel + 1));
  const blocosInternos = ordenarSubblocos(bloco).map((subbloco) => renderizarBlocoAst(subbloco, nivel + 1));
  const corpo = [...linhasCampos, ...linhasDeclarativas, ...blocosInternos];
  if (corpo.length === 0) {
    return `${cabecalho}\n${indentacao(nivel)}}`;
  }
  return `${cabecalho}\n${corpo.join("\n")}\n${indentacao(nivel)}}`;
}

function renderizarEnum(enumeracao: EnumAst, nivel: number): string {
  const corpo = enumeracao.valores.map((valor, indice) => `${indentacao(nivel + 1)}${valor}${indice < enumeracao.valores.length - 1 ? "," : ""}`);
  return `${indentacao(nivel)}enum ${enumeracao.nome} {\n${corpo.join("\n")}\n${indentacao(nivel)}}`;
}

function renderizarTipo(type: TypeAst, nivel: number): string {
  return `${indentacao(nivel)}type ${type.nome} {\n${renderizarCorpoSimples(type.corpo, nivel + 1)}\n${indentacao(nivel)}}`;
}

function renderizarEntity(entity: EntityAst, nivel: number): string {
  return `${indentacao(nivel)}entity ${entity.nome} {\n${renderizarCorpoSimples(entity.corpo, nivel + 1)}\n${indentacao(nivel)}}`;
}

function renderizarTask(task: TaskAst, nivel: number): string {
  return `${indentacao(nivel)}task ${task.nome} {\n${renderizarCorpoSimples(task.corpo, nivel + 1)}\n${indentacao(nivel)}}`;
}

function renderizarFlow(flow: FlowAst, nivel: number): string {
  return `${indentacao(nivel)}flow ${flow.nome} {\n${renderizarCorpoSimples(flow.corpo, nivel + 1)}\n${indentacao(nivel)}}`;
}

function renderizarRoute(route: RouteAst, nivel: number): string {
  return `${indentacao(nivel)}route ${route.nome} {\n${renderizarCorpoSimples(route.corpo, nivel + 1)}\n${indentacao(nivel)}}`;
}

function renderizarState(state: StateAst, nivel: number): string {
  return `${indentacao(nivel)}state${state.nome ? ` ${state.nome}` : ""} {\n${renderizarCorpoSimples(state.corpo, nivel + 1)}\n${indentacao(nivel)}}`;
}

function renderizarCorpoSimples(bloco: BlocoGenericoAst, nivel: number): string {
  const conteudo = ordenarSubblocos(bloco).map((subbloco) => renderizarBlocoAst(subbloco, nivel));
  const campos = bloco.campos.map((campo) => renderizarCampo(campo, nivel, bloco.palavraChave));
  const linhas = bloco.linhas.map((linha) => renderizarLinha(linha.conteudo, nivel));
  const corpo = [...campos, ...linhas, ...conteudo];
  return corpo.join("\n");
}

function renderizarModulo(modulo: ModuloAst): string {
  const blocos: Array<{ chave: string; conteudo: string }> = [];

  if (modulo.docs) {
    blocos.push({ chave: "docs", conteudo: renderizarBlocoGenerico(modulo.docs, 1) });
  }
  if (modulo.comments) {
    blocos.push({ chave: "comments", conteudo: renderizarBlocoGenerico(modulo.comments, 1) });
  }
  for (const use of modulo.uses) {
    blocos.push({ chave: "use", conteudo: renderizarBlocoAst(use, 1) });
  }
  for (const type of modulo.types) {
    blocos.push({ chave: "type", conteudo: renderizarBlocoAst(type, 1) });
  }
  for (const entity of modulo.entities) {
    blocos.push({ chave: "entity", conteudo: renderizarBlocoAst(entity, 1) });
  }
  for (const enumeracao of modulo.enums) {
    blocos.push({ chave: "enum", conteudo: renderizarBlocoAst(enumeracao, 1) });
  }
  for (const state of modulo.states) {
    blocos.push({ chave: "state", conteudo: renderizarBlocoAst(state, 1) });
  }
  for (const task of modulo.tasks) {
    blocos.push({ chave: "task", conteudo: renderizarBlocoAst(task, 1) });
  }
  for (const flow of modulo.flows) {
    blocos.push({ chave: "flow", conteudo: renderizarBlocoAst(flow, 1) });
  }
  for (const route of modulo.routes) {
    blocos.push({ chave: "route", conteudo: renderizarBlocoAst(route, 1) });
  }
  if (modulo.tests) {
    blocos.push({ chave: "tests", conteudo: renderizarBlocoGenerico(modulo.tests, 1) });
  }
  for (const extra of modulo.extras) {
    blocos.push({ chave: "desconhecido", conteudo: renderizarBlocoGenerico(extra, 1) });
  }

  const ordenados = ordenarPorMapa(blocos, (item) => item.chave, ORDEM_BLOCOS_MODULO);
  return `module ${modulo.nome} {\n${ordenados.map((item) => item.conteudo).join("\n\n")}\n}\n`;
}

export function formatarCodigo(codigo: string, arquivo?: string): ResultadoFormatacao {
  const resultadoLexer = tokenizar(codigo, arquivo);
  const resultadoParser = parsear(resultadoLexer.tokens);
  const diagnosticos = [...resultadoLexer.diagnosticos, ...resultadoParser.diagnosticos];

  if (!resultadoParser.modulo) {
    return { diagnosticos, alterado: false };
  }

  const codigoFormatado = renderizarModulo(resultadoParser.modulo);
  return {
    modulo: resultadoParser.modulo,
    codigoFormatado,
    diagnosticos,
    alterado: codigoFormatado !== codigo,
  };
}
