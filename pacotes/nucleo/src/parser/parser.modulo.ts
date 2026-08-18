// SEMA-GOVERNED: sema.software
// Descricao: parser particionado; consulte contratos/sema/software.sema antes de editar.

import type {
  BlocoGenericoAst,
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
import type { Parser } from "./parser.part02.js";

export function parseModuloParser(parser: Parser): ModuloAst | undefined {
    if (parser.atual().valor !== "module") {
      parser.registrarErro("PAR003", "Arquivo .sema deve iniciar com um bloco module.", parser.atual().intervalo);
      return undefined;
    }

    const inicio = parser.avancar().intervalo.inicio;
    const nome = parser.consumirTipo("identificador", "Era esperado o nome do modulo.").valor;
    parser.consumirValor("{", "Era esperado abrir o corpo do modulo com {.");

    const uses: UseAst[] = [];
    let design: BlocoGenericoAst | undefined;
    let vinculos: BlocoGenericoAst | undefined;
    const databases: BlocoGenericoAst[] = [];
    const types: TypeAst[] = [];
    const entities: EntityAst[] = [];
    const enums: EnumAst[] = [];
    const tasks: TaskAst[] = [];
    const flows: FlowAst[] = [];
    const routes: RouteAst[] = [];
    const workers: BlocoGenericoAst[] = [];
    const eventos: BlocoGenericoAst[] = [];
    const filas: BlocoGenericoAst[] = [];
    const crons: BlocoGenericoAst[] = [];
    const webhooks: BlocoGenericoAst[] = [];
    const caches: BlocoGenericoAst[] = [];
    const storages: BlocoGenericoAst[] = [];
    const policies: BlocoGenericoAst[] = [];
    const states: StateAst[] = [];
    const extras: BlocoGenericoAst[] = [];
    let docs: BlocoGenericoAst | undefined;
    let comments: BlocoGenericoAst | undefined;
    let tests: BlocoGenericoAst | undefined;

    while (parser.atual().tipo !== "fim_arquivo" && parser.atual().valor !== "}") {
      parser.ignorarRuido();
      const token = parser.atual();
      if (token.valor === "}") {
        break;
      }

      switch (token.valor) {
        case "use":
          if (parser.tokenNaFrente()?.tipo === "identificador") {
            uses.push(parser.parseUse());
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "docs":
          if (parser.iniciaBlocoSimples("docs")) {
            docs = parser.parseBlocoGenerico("docs");
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "comments":
          if (parser.iniciaBlocoSimples("comments")) {
            comments = parser.parseBlocoGenerico("comments");
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "design":
          if (parser.iniciaBlocoSimples("design")) {
            design = parser.parseBlocoGenerico("design");
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "vinculos":
          if (parser.iniciaBlocoSimples("vinculos")) {
            vinculos = parser.parseBlocoGenerico("vinculos");
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "database":
          if (parser.iniciaBlocoComNomeObrigatorio("database")) {
            databases.push(parser.parseBlocoGenerico("database"));
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "type":
          if (parser.iniciaBlocoComNomeObrigatorio("type")) {
            types.push(parser.parseType());
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "entity":
          if (parser.iniciaBlocoComNomeObrigatorio("entity")) {
            entities.push(parser.parseEntity());
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "enum":
          if (parser.iniciaBlocoComNomeObrigatorio("enum")) {
            enums.push(parser.parseEnum());
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "task":
          if (parser.iniciaBlocoComNomeObrigatorio("task")) {
            tasks.push(parser.parseTask());
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "flow":
          if (parser.iniciaBlocoComNomeObrigatorio("flow")) {
            flows.push(parser.parseFlow());
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "route":
          if (parser.iniciaBlocoComNomeObrigatorio("route")) {
            routes.push(parser.parseRoute());
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "worker":
          if (parser.iniciaBlocoComNomeObrigatorio("worker")) {
            workers.push(parser.parseBlocoGenerico("worker"));
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "evento":
          if (parser.iniciaBlocoComNomeObrigatorio("evento")) {
            eventos.push(parser.parseBlocoGenerico("evento"));
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "fila":
          if (parser.iniciaBlocoComNomeObrigatorio("fila")) {
            filas.push(parser.parseBlocoGenerico("fila"));
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "cron":
          if (parser.iniciaBlocoComNomeObrigatorio("cron")) {
            crons.push(parser.parseBlocoGenerico("cron"));
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "webhook":
          if (parser.iniciaBlocoComNomeObrigatorio("webhook")) {
            webhooks.push(parser.parseBlocoGenerico("webhook"));
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "cache":
          if (parser.iniciaBlocoComNomeObrigatorio("cache")) {
            caches.push(parser.parseBlocoGenerico("cache"));
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "storage":
          if (parser.iniciaBlocoComNomeObrigatorio("storage")) {
            storages.push(parser.parseBlocoGenerico("storage"));
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "policy":
          if (parser.iniciaBlocoComNomeObrigatorio("policy")) {
            policies.push(parser.parseBlocoGenerico("policy"));
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "state":
          if (parser.iniciaBlocoState()) {
            states.push(parser.parseState());
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        case "tests":
          if (parser.iniciaBlocoSimples("tests")) {
            tests = parser.parseBlocoGenerico("tests");
            break;
          }
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
        default:
          extras.push(parser.parseBlocoGenerico("desconhecido"));
          break;
      }
      parser.ignorarRuido();
    }

    const fim = parser.consumirValor("}", "Era esperado fechar o bloco module com }.").intervalo.fim;

    return {
      tipo: "module",
      nome,
      uses,
      design,
      vinculos,
      docs,
      comments,
      databases,
      types,
      entities,
      enums,
      tasks,
      flows,
      routes,
      workers,
      eventos,
      filas,
      crons,
      webhooks,
      caches,
      storages,
      policies,
      states,
      tests,
      extras,
      intervalo: { inicio, fim },
    };

}
