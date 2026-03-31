import {
  criarDiagnostico,
  type Diagnostico,
  type IntervaloFonte,
} from "../diagnosticos/index.js";
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
import type { Token } from "../lexer/tokens.js";

interface ResultadoParser {
  modulo?: ModuloAst;
  diagnosticos: Diagnostico[];
}

type PalavraBloco =
  | "docs"
  | "comments"
  | "fields"
  | "invariants"
  | "transitions"
  | "input"
  | "output"
  | "rules"
  | "effects"
  | "impl"
  | "vinculos"
  | "execucao"
  | "guarantees"
  | "state"
  | "tests"
  | "error"
  | "flow"
  | "route"
  | "worker"
  | "evento"
  | "fila"
  | "cron"
  | "webhook"
  | "cache"
  | "storage"
  | "policy"
  | "when"
  | "given"
  | "expect";

class Parser {
  private indice = 0;
  private diagnosticos: Diagnostico[] = [];

  public constructor(private readonly tokens: Token[]) {}

  public analisar(): ResultadoParser {
    this.ignorarRuido();
    const modulo = this.parseModulo();
    return { modulo, diagnosticos: this.diagnosticos };
  }

  private atual(): Token {
    return this.tokens[this.indice]!;
  }

  private anterior(): Token {
    return this.tokens[Math.max(0, this.indice - 1)]!;
  }

  private avancar(): Token {
    const token = this.atual();
    if (this.indice < this.tokens.length - 1) {
      this.indice += 1;
    }
    return token;
  }

  private ignorarRuido(): void {
    while (["nova_linha", "comentario"].includes(this.atual().tipo)) {
      this.avancar();
    }
  }

  private tokenNaFrente(distancia = 1): Token | undefined {
    return this.tokens[this.indice + distancia];
  }

  private iniciaBlocoSimples(keyword: string): boolean {
    if (this.atual().valor !== keyword) {
      return false;
    }
    return this.tokenNaFrente()?.valor === "{";
  }

  private iniciaBlocoComNomeObrigatorio(keyword: string): boolean {
    if (this.atual().valor !== keyword) {
      return false;
    }
    return this.tokenNaFrente()?.tipo === "identificador" && this.tokenNaFrente(2)?.valor === "{";
  }

  private iniciaBlocoState(): boolean {
    if (this.atual().valor !== "state") {
      return false;
    }
    return this.tokenNaFrente()?.valor === "{"
      || (this.tokenNaFrente()?.tipo === "identificador" && this.tokenNaFrente(2)?.valor === "{");
  }

  private iniciaSubblocoConhecido(): boolean {
    if (this.atual().tipo !== "palavra_chave") {
      return false;
    }

    if (["state"].includes(this.atual().valor)) {
      return this.iniciaBlocoState();
    }

    return [
      "docs",
      "comments",
      "fields",
      "invariants",
      "transitions",
      "input",
      "output",
      "rules",
      "effects",
      "impl",
      "vinculos",
      "execucao",
      "guarantees",
      "tests",
      "error",
      "given",
      "when",
      "expect",
    ].includes(this.atual().valor) && this.iniciaBlocoSimples(this.atual().valor);
  }

  private consumirValor(valor: string, mensagem: string): Token {
    const token = this.atual();
    if (token.valor === valor) {
      this.avancar();
      return token;
    }
    this.registrarErro("PAR001", mensagem, token.intervalo, `Esperado "${valor}", recebido "${token.valor}".`);
    return token;
  }

  private consumirTipo(tipo: Token["tipo"], mensagem: string): Token {
    const token = this.atual();
    if (token.tipo === tipo) {
      this.avancar();
      return token;
    }
    this.registrarErro("PAR002", mensagem, token.intervalo, `Esperado token do tipo "${tipo}".`);
    return token;
  }

  private registrarErro(codigo: string, mensagem: string, intervalo?: IntervaloFonte, contexto?: string): void {
    this.diagnosticos.push(
      criarDiagnostico(
        codigo,
        mensagem,
        "erro",
        intervalo,
        "Revise a sintaxe do bloco e a ordem das declaracoes.",
        contexto,
      ),
    );
  }

  private parseModulo(): ModuloAst | undefined {
    if (this.atual().valor !== "module") {
      this.registrarErro("PAR003", "Arquivo .sema deve iniciar com um bloco module.", this.atual().intervalo);
      return undefined;
    }

    const inicio = this.avancar().intervalo.inicio;
    const nome = this.consumirTipo("identificador", "Era esperado o nome do modulo.").valor;
    this.consumirValor("{", "Era esperado abrir o corpo do modulo com {.");

    const uses: UseAst[] = [];
    let vinculos: BlocoGenericoAst | undefined;
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

    while (this.atual().tipo !== "fim_arquivo" && this.atual().valor !== "}") {
      this.ignorarRuido();
      const token = this.atual();
      if (token.valor === "}") {
        break;
      }

      switch (token.valor) {
        case "use":
          if (this.tokenNaFrente()?.tipo === "identificador") {
            uses.push(this.parseUse());
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "docs":
          if (this.iniciaBlocoSimples("docs")) {
            docs = this.parseBlocoGenerico("docs");
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "comments":
          if (this.iniciaBlocoSimples("comments")) {
            comments = this.parseBlocoGenerico("comments");
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "vinculos":
          if (this.iniciaBlocoSimples("vinculos")) {
            vinculos = this.parseBlocoGenerico("vinculos");
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "type":
          if (this.iniciaBlocoComNomeObrigatorio("type")) {
            types.push(this.parseType());
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "entity":
          if (this.iniciaBlocoComNomeObrigatorio("entity")) {
            entities.push(this.parseEntity());
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "enum":
          if (this.iniciaBlocoComNomeObrigatorio("enum")) {
            enums.push(this.parseEnum());
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "task":
          if (this.iniciaBlocoComNomeObrigatorio("task")) {
            tasks.push(this.parseTask());
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "flow":
          if (this.iniciaBlocoComNomeObrigatorio("flow")) {
            flows.push(this.parseFlow());
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "route":
          if (this.iniciaBlocoComNomeObrigatorio("route")) {
            routes.push(this.parseRoute());
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "worker":
          if (this.iniciaBlocoComNomeObrigatorio("worker")) {
            workers.push(this.parseBlocoGenerico("worker"));
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "evento":
          if (this.iniciaBlocoComNomeObrigatorio("evento")) {
            eventos.push(this.parseBlocoGenerico("evento"));
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "fila":
          if (this.iniciaBlocoComNomeObrigatorio("fila")) {
            filas.push(this.parseBlocoGenerico("fila"));
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "cron":
          if (this.iniciaBlocoComNomeObrigatorio("cron")) {
            crons.push(this.parseBlocoGenerico("cron"));
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "webhook":
          if (this.iniciaBlocoComNomeObrigatorio("webhook")) {
            webhooks.push(this.parseBlocoGenerico("webhook"));
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "cache":
          if (this.iniciaBlocoComNomeObrigatorio("cache")) {
            caches.push(this.parseBlocoGenerico("cache"));
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "storage":
          if (this.iniciaBlocoComNomeObrigatorio("storage")) {
            storages.push(this.parseBlocoGenerico("storage"));
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "policy":
          if (this.iniciaBlocoComNomeObrigatorio("policy")) {
            policies.push(this.parseBlocoGenerico("policy"));
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "state":
          if (this.iniciaBlocoState()) {
            states.push(this.parseState());
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        case "tests":
          if (this.iniciaBlocoSimples("tests")) {
            tests = this.parseBlocoGenerico("tests");
            break;
          }
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
        default:
          extras.push(this.parseBlocoGenerico("desconhecido"));
          break;
      }
      this.ignorarRuido();
    }

    const fim = this.consumirValor("}", "Era esperado fechar o bloco module com }.").intervalo.fim;

    return {
      tipo: "module",
      nome,
      uses,
      vinculos,
      docs,
      comments,
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

  private parseUse(): UseAst {
    const inicio = this.avancar().intervalo.inicio;
    const primeiro = this.consumirTipo("identificador", "Era esperado o caminho do use.");
    let origem: UseAst["origem"] = "sema";
    let caminho = primeiro.valor;

    const origemNormalizada = normalizarOrigemUse(primeiro.valor);
    if (origemNormalizada && this.atual().tipo === "identificador") {
      origem = origemNormalizada;
      caminho = this.avancar().valor;
    }

    const fim = this.anterior().intervalo.fim;
    return { tipo: "use", origem, caminho, intervalo: { inicio, fim } };
  }

  private parseType(): TypeAst {
    const inicio = this.avancar().intervalo.inicio;
    const nome = this.consumirTipo("identificador", "Era esperado o nome do type.").valor;
    const corpo = this.parseBlocoComNomeOpcional("type");
    return { tipo: "type", nome, corpo, intervalo: { inicio, fim: corpo.intervalo?.fim ?? this.anterior().intervalo.fim } };
  }

  private parseEntity(): EntityAst {
    const inicio = this.avancar().intervalo.inicio;
    const nome = this.consumirTipo("identificador", "Era esperado o nome da entity.").valor;
    const corpo = this.parseBlocoComNomeOpcional("entity");
    return { tipo: "entity", nome, corpo, intervalo: { inicio, fim: corpo.intervalo?.fim ?? this.anterior().intervalo.fim } };
  }

  private parseEnum(): EnumAst {
    const inicio = this.avancar().intervalo.inicio;
    const nome = this.consumirTipo("identificador", "Era esperado o nome do enum.").valor;
    this.consumirValor("{", "Era esperado abrir o corpo do enum.");
    const valores: string[] = [];
    let docs: BlocoGenericoAst | undefined;
    while (this.atual().tipo !== "fim_arquivo" && this.atual().valor !== "}") {
      this.ignorarRuido();
      if (this.atual().valor === "}") {
        break;
      }
      if (this.atual().valor === "docs") {
        docs = this.parseBlocoGenerico("docs");
        continue;
      }
      if (["identificador", "palavra_chave"].includes(this.atual().tipo)) {
        valores.push(this.avancar().valor);
        if (this.atual().valor === ",") {
          this.avancar();
        }
        continue;
      }
      this.avancar();
    }
    const fim = this.consumirValor("}", "Era esperado fechar o enum.").intervalo.fim;
    return { tipo: "enum", nome, valores, docs, intervalo: { inicio, fim } };
  }

  private parseTask(): TaskAst {
    const inicio = this.avancar().intervalo.inicio;
    const nome = this.consumirTipo("identificador", "Era esperado o nome da task.").valor;
    const corpo = this.parseBlocoComNomeOpcional("task");

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
      guarantees: localizar("guarantees"),
      state: localizar("state"),
      tests: localizar("tests"),
      error: localizar("error"),
      docs: localizar("docs"),
      comments: localizar("comments"),
      intervalo: { inicio, fim: corpo.intervalo?.fim ?? this.anterior().intervalo.fim },
    };
  }

  private parseFlow(): FlowAst {
    const inicio = this.avancar().intervalo.inicio;
    const nome = this.consumirTipo("identificador", "Era esperado o nome do flow.").valor;
    const corpo = this.parseBlocoComNomeOpcional("flow");
    const vinculos = corpo.blocos.find((bloco): bloco is BlocoGenericoAst => bloco.tipo === "bloco_generico" && bloco.palavraChave === "vinculos");
    return { tipo: "flow", nome, corpo, vinculos, intervalo: { inicio, fim: corpo.intervalo?.fim ?? this.anterior().intervalo.fim } };
  }

  private parseRoute(): RouteAst {
    const inicio = this.avancar().intervalo.inicio;
    const nome = this.consumirTipo("identificador", "Era esperado o nome da route.").valor;
    const corpo = this.parseBlocoComNomeOpcional("route");
    const vinculos = corpo.blocos.find((bloco): bloco is BlocoGenericoAst => bloco.tipo === "bloco_generico" && bloco.palavraChave === "vinculos");
    return { tipo: "route", nome, corpo, vinculos, intervalo: { inicio, fim: corpo.intervalo?.fim ?? this.anterior().intervalo.fim } };
  }

  private parseState(): StateAst {
    const inicioToken = this.avancar();
    let nome: string | undefined;
    if (this.atual().tipo === "identificador") {
      nome = this.avancar().valor;
    }
    this.consumirValor("{", "Era esperado abrir o bloco state.");
    const corpo = this.parseCorpoBloco("state", nome, inicioToken.intervalo.inicio);
    return {
      tipo: "state",
      nome,
      corpo,
      intervalo: { inicio: inicioToken.intervalo.inicio, fim: corpo.intervalo?.fim ?? this.anterior().intervalo.fim },
    };
  }

  private parseBlocoComNomeOpcional(nomeBloco: string): BlocoGenericoAst {
    this.consumirValor("{", `Era esperado abrir o bloco ${nomeBloco}.`);
    return this.parseCorpoBloco(nomeBloco as PalavraBloco | "type" | "entity" | "task" | "flow" | "route");
  }

  private parseBlocoGenerico(palavraChave: PalavraBloco | "desconhecido"): BlocoGenericoAst {
    const inicioToken = this.avancar();
    let nome: string | undefined;
    if (this.atual().tipo === "identificador") {
      nome = this.avancar().valor;
    }
    this.consumirValor("{", `Era esperado abrir o bloco ${inicioToken.valor}.`);
    return this.parseCorpoBloco((palavraChave === "desconhecido" ? "desconhecido" : inicioToken.valor) as BlocoGenericoAst["palavraChave"], nome, inicioToken.intervalo.inicio);
  }

  private parseBlocoNomeadoLivre(): BlocoGenericoAst {
    const inicioToken = this.avancar();
    const nome = inicioToken.valor;
    this.consumirValor("{", `Era esperado abrir o bloco ${nome}.`);
    return this.parseCorpoBloco("desconhecido", nome, inicioToken.intervalo.inicio);
  }

  private parseCorpoBloco(
    palavraChave: BlocoGenericoAst["palavraChave"],
    nome?: string,
    inicioManual?: IntervaloFonte["inicio"],
  ): BlocoGenericoAst {
    const inicio = inicioManual ?? this.anterior().intervalo.inicio;
    const campos: CampoAst[] = [];
    const linhas: BlocoGenericoAst["linhas"] = [];
    const blocos: BlocoAst[] = [];

    while (this.atual().tipo !== "fim_arquivo" && this.atual().valor !== "}") {
      this.ignorarRuido();
      if (this.atual().valor === "}") {
        break;
      }

      if (palavraChave === "tests" && this.atual().valor === "caso") {
        blocos.push(this.parseCasoTeste());
        continue;
      }

      if (this.iniciaSubblocoConhecido()) {
        blocos.push(this.parseBlocoGenerico(this.atual().valor as PalavraBloco));
        continue;
      }

      if (["identificador", "palavra_chave"].includes(this.atual().tipo) && this.tokens[this.indice + 1]?.valor === "{") {
        blocos.push(this.parseBlocoNomeadoLivre());
        continue;
      }

      if (["identificador", "palavra_chave"].includes(this.atual().tipo) && this.tokens[this.indice + 1]?.valor === ":") {
        campos.push(this.parseCampo());
        continue;
      }

      const linha = this.parseLinhaDeclarativa();
      if (linha.conteudo.trim().length > 0) {
        linhas.push(linha);
      }
    }

    const fim = this.consumirValor("}", "Era esperado fechar o bloco com }.").intervalo.fim;
    return {
      tipo: "bloco_generico",
      palavraChave,
      nome,
      campos,
      linhas,
      blocos,
      intervalo: { inicio, fim },
    };
  }

  private parseCampo(): CampoAst {
    const inicio = this.atual().intervalo.inicio;
    const nome = this.avancar().valor;
    this.consumirValor(":", "Era esperado ':' depois do nome do campo.");
    const partes: string[] = [];
    while (this.atual().tipo !== "fim_arquivo" && this.atual().tipo !== "nova_linha" && this.atual().valor !== "}") {
      partes.push(this.avancar().valor);
    }
    const segmentos = partes.filter(Boolean);
    const tipoTokens: string[] = [];
    const modificadores: string[] = [];
    let profundidadeTipo = 0;
    let iniciouModificadores = false;

    for (const segmento of segmentos) {
      if (!iniciouModificadores) {
        if (["<", "[", "("].includes(segmento)) {
          profundidadeTipo += 1;
          tipoTokens.push(segmento);
          continue;
        }
        if ([">", "]", ")"].includes(segmento)) {
          profundidadeTipo = Math.max(0, profundidadeTipo - 1);
          tipoTokens.push(segmento);
          continue;
        }

        const pareceModificador =
          profundidadeTipo === 0
          && tipoTokens.length > 0
          && /^[a-z_][a-z0-9_]*$/u.test(segmento);

        if (pareceModificador) {
          iniciouModificadores = true;
          modificadores.push(segmento);
          continue;
        }

        tipoTokens.push(segmento);
        continue;
      }

      modificadores.push(segmento);
    }

    let valor = tipoTokens
      .join(" ")
      .replace(/\s*([<>\[\](),|?])\s*/g, "$1")
      .trim();
    if (valor.includes("/")) {
      valor = valor.replace(/\s*\/\s*/g, "/");
    }
    if (this.atual().tipo === "nova_linha") {
      this.avancar();
    }
    return {
      tipo: "campo",
      nome,
      valor,
      modificadores,
      intervalo: { inicio, fim: this.anterior().intervalo.fim },
    };
  }

  private parseLinhaDeclarativa() {
    const inicio = this.atual().intervalo.inicio;
    const partes: string[] = [];
    while (this.atual().tipo !== "fim_arquivo" && this.atual().tipo !== "nova_linha" && this.atual().valor !== "}") {
      partes.push(this.avancar().valor);
    }
    if (this.atual().tipo === "nova_linha") {
      this.avancar();
    }
    return {
      tipo: "linha_declarativa" as const,
      conteudo: partes.join(" ").trim(),
      intervalo: { inicio, fim: this.anterior().intervalo.fim },
    };
  }

  private parseCasoTeste(): BlocoCasoTesteAst {
    const inicio = this.avancar().intervalo.inicio;
    const nomeToken = this.atual();
    const nome =
      nomeToken.tipo === "texto"
        ? this.avancar().valor
        : this.consumirTipo("identificador", "Era esperado o nome textual do caso de teste.").valor;
    this.consumirValor("{", "Era esperado abrir o bloco do caso de teste.");
    let given: BlocoGenericoAst | undefined;
    let when: BlocoGenericoAst | undefined;
    let expect: BlocoGenericoAst | undefined;
    let error: BlocoGenericoAst | undefined;
    let docs: BlocoGenericoAst | undefined;
    let comments: BlocoGenericoAst | undefined;

    while (this.atual().tipo !== "fim_arquivo" && this.atual().valor !== "}") {
      this.ignorarRuido();
      if (this.atual().valor === "}") {
        break;
      }
      switch (this.atual().valor) {
        case "given":
          given = this.parseBlocoGenerico("given");
          break;
        case "when":
          when = this.parseBlocoGenerico("when");
          break;
        case "expect":
          expect = this.parseBlocoGenerico("expect");
          break;
        case "error":
          error = this.parseBlocoGenerico("error");
          break;
        case "docs":
          docs = this.parseBlocoGenerico("docs");
          break;
        case "comments":
          comments = this.parseBlocoGenerico("comments");
          break;
        default:
          this.avancar();
          break;
      }
    }

    const fim = this.consumirValor("}", "Era esperado fechar o caso de teste.").intervalo.fim;
    return {
      tipo: "caso_teste",
      nome,
      given,
      when,
      expect,
      error,
      docs,
      comments,
      intervalo: { inicio, fim },
    };
  }
}

function normalizarOrigemUse(valor: string): UseAst["origem"] | undefined {
  switch (valor.toLowerCase()) {
    case "sema":
      return "sema";
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

export function parsear(tokens: Token[]): ResultadoParser {
  const parser = new Parser(tokens);
  return parser.analisar();
}
