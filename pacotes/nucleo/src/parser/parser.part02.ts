// SEMA-GOVERNED: sema.software
// Descricao: parser particionado; consulte contratos/sema/software.sema antes de editar.

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

import { PALAVRAS_BLOCO_NOMEADO_LIVRE, PalavraBloco, ResultadoParser, decodificarTextoLiteral } from "./parser.part01.js";
import { parseModuloParser } from "./parser.modulo.js";
import {
  parseEntityParser,
  parseEnumParser,
  parseFlowParser,
  parseRouteParser,
  parseStateParser,
  parseTaskParser,
  parseTypeParser,
  parseUseParser,
} from "./parser.declaracoes.js";

export class Parser {
  private indice = 0;
  private diagnosticos: Diagnostico[] = [];

  public constructor(private readonly tokens: Token[]) {}

  public analisar(): ResultadoParser {
      this.ignorarRuido();
      const modulo = this.parseModulo();
      return { modulo, diagnosticos: this.diagnosticos };
    }

  public atual(): Token {
      return this.tokens[this.indice]!;
    }

  public anterior(): Token {
      return this.tokens[Math.max(0, this.indice - 1)]!;
    }

  public avancar(): Token {
      const token = this.atual();
      if (this.indice < this.tokens.length - 1) {
        this.indice += 1;
      }
      return token;
    }

  public ignorarRuido(): void {
      while (["nova_linha", "comentario"].includes(this.atual().tipo)) {
        this.avancar();
      }
    }

  public tokenNaFrente(distancia = 1): Token | undefined {
      return this.tokens[this.indice + distancia];
    }

  public iniciaBlocoSimples(keyword: string): boolean {
      if (this.atual().valor !== keyword) {
        return false;
      }
      return this.tokenNaFrente()?.valor === "{";
    }

  public iniciaBlocoComNomeObrigatorio(keyword: string): boolean {
      if (this.atual().valor !== keyword) {
        return false;
      }
      return this.tokenNaFrente()?.tipo === "identificador" && this.tokenNaFrente(2)?.valor === "{";
    }

  public iniciaBlocoState(): boolean {
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
        "design",
        "tokens",
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
        "auth",
        "authz",
        "dados",
        "audit",
        "segredos",
        "forbidden",
        "guarantees",
        "tests",
        "error",
        "given",
        "when",
        "expect",
      ].includes(this.atual().valor) && this.iniciaBlocoSimples(this.atual().valor);
    }

  public consumirValor(valor: string, mensagem: string): Token {
      const token = this.atual();
      if (token.valor === valor) {
        this.avancar();
        return token;
      }
      this.registrarErro("PAR001", mensagem, token.intervalo, `Esperado "${valor}", recebido "${token.valor}".`);
      return token;
    }

  public consumirTipo(tipo: Token["tipo"], mensagem: string): Token {
      const token = this.atual();
      if (token.tipo === tipo) {
        this.avancar();
        return token;
      }
      this.registrarErro("PAR002", mensagem, token.intervalo, `Esperado token do tipo "${tipo}".`);
      return token;
    }

  public registrarErro(codigo: string, mensagem: string, intervalo?: IntervaloFonte, contexto?: string): void {
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

  public parseModulo(): ModuloAst | undefined {
    return parseModuloParser(this);
  }

  public parseUse(): UseAst {
    return parseUseParser(this);
  }

  public parseType(): TypeAst {
    return parseTypeParser(this);
  }

  public parseEntity(): EntityAst {
    return parseEntityParser(this);
  }

  public parseEnum(): EnumAst {
    return parseEnumParser(this);
  }

  public parseTask(): TaskAst {
    return parseTaskParser(this);
  }

  public parseFlow(): FlowAst {
    return parseFlowParser(this);
  }

  public parseRoute(): RouteAst {
    return parseRouteParser(this);
  }

  public parseState(): StateAst {
    return parseStateParser(this);
  }

  public parseBlocoComNomeOpcional(nomeBloco: string): BlocoGenericoAst {
      this.consumirValor("{", `Era esperado abrir o bloco ${nomeBloco}.`);
      return this.parseCorpoBloco(nomeBloco as PalavraBloco | "type" | "entity" | "task" | "flow" | "route");
    }

  public parseBlocoGenerico(palavraChave: PalavraBloco | "desconhecido"): BlocoGenericoAst {
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

  private parseBlocoNomeadoComPalavraChaveLivre(): BlocoGenericoAst {
      const palavraChaveToken = this.avancar();
      const nomeToken = this.avancar();
      this.consumirValor("{", `Era esperado abrir o bloco ${palavraChaveToken.valor} ${nomeToken.valor}.`);
      return this.parseCorpoBloco(
        palavraChaveToken.valor as PalavraBloco,
        nomeToken.valor,
        palavraChaveToken.intervalo.inicio,
      );
    }

  public parseCorpoBloco(
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

        if (
          ["identificador", "palavra_chave"].includes(this.atual().tipo)
          && PALAVRAS_BLOCO_NOMEADO_LIVRE.has(this.atual().valor as PalavraBloco)
          && ["identificador", "palavra_chave"].includes(this.tokens[this.indice + 1]?.tipo ?? "")
          && this.tokens[this.indice + 2]?.valor === "{"
        ) {
          blocos.push(this.parseBlocoNomeadoComPalavraChaveLivre());
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
      const partes: Token[] = [];
      let profundidade = 0;
      while (this.atual().tipo !== "fim_arquivo" && this.atual().tipo !== "nova_linha" && this.atual().valor !== "}") {
        const proximoToken = this.tokens[this.indice + 1];
        const iniciaNovoCampo =
          profundidade === 0
          && partes.length > 0
          && ["identificador", "palavra_chave"].includes(this.atual().tipo)
          && proximoToken?.valor === ":";

        if (iniciaNovoCampo) {
          break;
        }

        const token = this.avancar();
        partes.push(token);
        if (["<", "[", "("].includes(token.valor)) {
          profundidade += 1;
        } else if ([">", "]", ")"].includes(token.valor)) {
          profundidade = Math.max(0, profundidade - 1);
        }
      }
      const segmentos = partes.filter((token) => token.valor.length > 0);
      const possuiTextoLiteral = segmentos.some((token) => token.tipo === "texto");

      if (possuiTextoLiteral) {
        const valorLiteral = segmentos.map((token) => token.tipo === "texto" ? decodificarTextoLiteral(token.valor) : token.valor).join(" ");
        if (this.atual().tipo === "nova_linha") {
          this.avancar();
        }
        return {
          tipo: "campo",
          nome,
          valor: valorLiteral,
          modificadores: [],
          intervalo: { inicio, fim: this.anterior().intervalo.fim },
        };
      }

      const tipoTokens: string[] = [];
      const modificadores: string[] = [];
      let profundidadeTipo = 0;
      let iniciouModificadores = false;

      for (const token of segmentos) {
        const segmento = token.valor;
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
