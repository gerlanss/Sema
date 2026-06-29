// SEMA-GOVERNED: sema.software
// Descricao: parser particionado; consulte contratos/sema/software.sema antes de editar.

import type {
  BlocoGenericoAst,
  EntityAst,
  EnumAst,
  FlowAst,
  RouteAst,
  StateAst,
  TaskAst,
  TypeAst,
  UseAst,
} from "../ast/tipos.js";
import type { Parser } from "./parser.part02.js";
import type { PalavraBloco } from "./parser.part01.js";

export function normalizarOrigemUse(valor: string): UseAst["origem"] | undefined {
  switch (valor.toLowerCase()) {
    case "sema":
      return "sema";
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
    default:
      return undefined;
  }
}

export function parseUseParser(parser: Parser): UseAst {
    const inicio = parser.avancar().intervalo.inicio;
    const primeiro = parser.consumirTipo("identificador", "Era esperado o caminho do use.");
    let origem: UseAst["origem"] = "sema";
    let caminho = primeiro.valor;

    const origemNormalizada = normalizarOrigemUse(primeiro.valor);
    if (origemNormalizada && parser.atual().tipo === "identificador") {
      origem = origemNormalizada;
      caminho = parser.avancar().valor;
    }

    const fim = parser.anterior().intervalo.fim;
    return { tipo: "use", origem, caminho, intervalo: { inicio, fim } };

}

export function parseTypeParser(parser: Parser): TypeAst {
    const inicio = parser.avancar().intervalo.inicio;
    const nome = parser.consumirTipo("identificador", "Era esperado o nome do type.").valor;
    const corpo = parser.parseBlocoComNomeOpcional("type");
    return { tipo: "type", nome, corpo, intervalo: { inicio, fim: corpo.intervalo?.fim ?? parser.anterior().intervalo.fim } };

}

export function parseEntityParser(parser: Parser): EntityAst {
    const inicio = parser.avancar().intervalo.inicio;
    const nome = parser.consumirTipo("identificador", "Era esperado o nome da entity.").valor;
    const corpo = parser.parseBlocoComNomeOpcional("entity");
    return { tipo: "entity", nome, corpo, intervalo: { inicio, fim: corpo.intervalo?.fim ?? parser.anterior().intervalo.fim } };

}

export function parseEnumParser(parser: Parser): EnumAst {
    const inicio = parser.avancar().intervalo.inicio;
    const nome = parser.consumirTipo("identificador", "Era esperado o nome do enum.").valor;
    parser.consumirValor("{", "Era esperado abrir o corpo do enum.");
    const valores: string[] = [];
    let docs: BlocoGenericoAst | undefined;
    while (parser.atual().tipo !== "fim_arquivo" && parser.atual().valor !== "}") {
      parser.ignorarRuido();
      if (parser.atual().valor === "}") {
        break;
      }
      if (parser.atual().valor === "docs") {
        docs = parser.parseBlocoGenerico("docs");
        continue;
      }
      if (["identificador", "palavra_chave"].includes(parser.atual().tipo)) {
        valores.push(parser.avancar().valor);
        if (parser.atual().valor === ",") {
          parser.avancar();
        }
        continue;
      }
      parser.avancar();
    }
    const fim = parser.consumirValor("}", "Era esperado fechar o enum.").intervalo.fim;
    return { tipo: "enum", nome, valores, docs, intervalo: { inicio, fim } };

}

export function parseTaskParser(parser: Parser): TaskAst {
    const inicio = parser.avancar().intervalo.inicio;
    const nome = parser.consumirTipo("identificador", "Era esperado o nome da task.").valor;
    const corpo = parser.parseBlocoComNomeOpcional("task");

    const localizar = (palavraChave: PalavraBloco): BlocoGenericoAst | undefined =>
      corpo.blocos.find((bloco): bloco is BlocoGenericoAst => bloco.tipo === "bloco_generico" && bloco.palavraChave === palavraChave);

    return {
      tipo: "task",
      nome,
      corpo,
      input: localizar("input"),
      output: localizar("output"),
      rules: localizar("rules"),
      effects: localizar("effects"),
      impl: localizar("impl"),
      vinculos: localizar("vinculos"),
      execucao: localizar("execucao"),
      auth: localizar("auth"),
      authz: localizar("authz"),
      dados: localizar("dados"),
      audit: localizar("audit"),
      segredos: localizar("segredos"),
      forbidden: localizar("forbidden"),
      guarantees: localizar("guarantees"),
      state: localizar("state"),
      tests: localizar("tests"),
      error: localizar("error"),
      docs: localizar("docs"),
      comments: localizar("comments"),
      intervalo: { inicio, fim: corpo.intervalo?.fim ?? parser.anterior().intervalo.fim },
    };

}

export function parseFlowParser(parser: Parser): FlowAst {
    const inicio = parser.avancar().intervalo.inicio;
    const nome = parser.consumirTipo("identificador", "Era esperado o nome do flow.").valor;
    const corpo = parser.parseBlocoComNomeOpcional("flow");
    const vinculos = corpo.blocos.find((bloco): bloco is BlocoGenericoAst => bloco.tipo === "bloco_generico" && bloco.palavraChave === "vinculos");
    return { tipo: "flow", nome, corpo, vinculos, intervalo: { inicio, fim: corpo.intervalo?.fim ?? parser.anterior().intervalo.fim } };

}

export function parseRouteParser(parser: Parser): RouteAst {
    const inicio = parser.avancar().intervalo.inicio;
    const nome = parser.consumirTipo("identificador", "Era esperado o nome da route.").valor;
    const corpo = parser.parseBlocoComNomeOpcional("route");
    const vinculos = corpo.blocos.find((bloco): bloco is BlocoGenericoAst => bloco.tipo === "bloco_generico" && bloco.palavraChave === "vinculos");
    return { tipo: "route", nome, corpo, vinculos, intervalo: { inicio, fim: corpo.intervalo?.fim ?? parser.anterior().intervalo.fim } };

}

export function parseStateParser(parser: Parser): StateAst {
    const inicioToken = parser.avancar();
    let nome: string | undefined;
    if (parser.atual().tipo === "identificador") {
      nome = parser.avancar().valor;
    }
    parser.consumirValor("{", "Era esperado abrir o bloco state.");
    const corpo = parser.parseCorpoBloco("state", nome, inicioToken.intervalo.inicio);
    return {
      tipo: "state",
      nome,
      corpo,
      intervalo: { inicio: inicioToken.intervalo.inicio, fim: corpo.intervalo?.fim ?? parser.anterior().intervalo.fim },
    };

}
