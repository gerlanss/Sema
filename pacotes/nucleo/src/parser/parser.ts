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
  | "guarantees"
  | "state"
  | "tests"
  | "error"
  | "flow"
  | "route"
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
    const types: TypeAst[] = [];
    const entities: EntityAst[] = [];
    const enums: EnumAst[] = [];
    const tasks: TaskAst[] = [];
    const flows: FlowAst[] = [];
    const routes: RouteAst[] = [];
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
          uses.push(this.parseUse());
          break;
        case "docs":
          docs = this.parseBlocoGenerico("docs");
          break;
        case "comments":
          comments = this.parseBlocoGenerico("comments");
          break;
        case "type":
          types.push(this.parseType());
          break;
        case "entity":
          entities.push(this.parseEntity());
          break;
        case "enum":
          enums.push(this.parseEnum());
          break;
        case "task":
          tasks.push(this.parseTask());
          break;
        case "flow":
          flows.push(this.parseFlow());
          break;
        case "route":
          routes.push(this.parseRoute());
          break;
        case "state":
          states.push(this.parseState());
          break;
        case "tests":
          tests = this.parseBlocoGenerico("tests");
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
      docs,
      comments,
      types,
      entities,
      enums,
      tasks,
      flows,
      routes,
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
    return { tipo: "flow", nome, corpo, intervalo: { inicio, fim: corpo.intervalo?.fim ?? this.anterior().intervalo.fim } };
  }

  private parseRoute(): RouteAst {
    const inicio = this.avancar().intervalo.inicio;
    const nome = this.consumirTipo("identificador", "Era esperado o nome da route.").valor;
    const corpo = this.parseBlocoComNomeOpcional("route");
    return { tipo: "route", nome, corpo, intervalo: { inicio, fim: corpo.intervalo?.fim ?? this.anterior().intervalo.fim } };
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

      if (
        this.atual().tipo === "palavra_chave" &&
        ["docs", "comments", "fields", "invariants", "transitions", "input", "output", "rules", "effects", "impl", "guarantees", "state", "tests", "error", "given", "when", "expect"].includes(this.atual().valor)
      ) {
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
    const valorCompleto = partes.join(" ").trim();
    const segmentos = valorCompleto.split(/\s+/).filter(Boolean);
    const valor = segmentos[0] ?? "";
    const modificadores = segmentos.slice(1);
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
