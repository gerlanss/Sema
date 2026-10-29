// SEMA-GOVERNED: sema.produto.parser_integridade
// Descrição: parser com diagnóstico estrutural e recuperação sem sucesso parcial silencioso.

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
import { lerValorComposto } from "./valoresCompostos.js";

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
      this.ignorarRuido();
      if (modulo && this.atual().tipo !== "fim_arquivo") {
        this.registrarErro("PAR005", "Há conteúdo depois do fechamento do module.", this.atual().intervalo, undefined,
          "Mantenha as declarações dentro do único module do arquivo; confira as chaves anteriores. Separe outro módulo em outro .sema.");
        while (this.atual().tipo !== "fim_arquivo") this.avancar();
      }
      return { modulo, diagnosticos: this.diagnosticos };
    }

  public atual(): Token {
      return this.tokens[this.indice]!;
    }

  public temValor(valor: string): boolean {
      return !["texto", "comentario"].includes(this.atual().tipo) && this.atual().valor === valor;
    }

  public descartarBlocoInvalido(): void {
      if (!this.temValor("{")) return;
      let nivel = 0;
      do {
        if (this.temValor("{")) nivel += 1;
        if (this.temValor("}")) nivel -= 1;
        this.avancar();
      } while (nivel > 0 && this.atual().tipo !== "fim_arquivo");
      if (nivel > 0) this.registrarErro("PAR001", "Bloco inválido não foi fechado.", this.atual().intervalo);
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
      if (!this.temValor(keyword)) {
        return false;
      }
      return this.tokenNaFrente()?.valor === "{";
    }

  public iniciaBlocoComNomeObrigatorio(keyword: string): boolean {
      if (!this.temValor(keyword)) {
        return false;
      }
      return this.tokenNaFrente()?.tipo === "identificador" && this.tokenNaFrente(2)?.valor === "{";
    }

  public iniciaBlocoState(): boolean {
      if (!this.temValor("state")) {
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
      if (this.temValor(valor)) {
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

  public registrarErro(codigo: string, mensagem: string, intervalo?: IntervaloFonte, contexto?: string, dica?: string): void {
      this.diagnosticos.push(
        criarDiagnostico(
          codigo,
          mensagem,
          "erro",
          intervalo,
          dica ?? "Revise a sintaxe do bloco e a ordem das declaracoes.",
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
      if (palavraChave === "desconhecido") {
        const token = this.atual();
        this.registrarErro("PAR007", token.valor === "impl" ? "impl só pode ser declarado dentro de uma task." : `Declaração inválida no module: ${token.valor}.`, token.intervalo, undefined,
          token.valor === "impl"
            ? 'Declare impl { js: app.acao } dentro da task e vinculos { arquivo: "app.js" }. HTML/CSS são arquivos vinculados, não símbolos impl.'
            : token.valor === "persistencia"
            ? 'persistencia é um efeito da task: effects { persistencia Tarefa }. Para modelar uma superfície de armazenamento, use storage <nome> { ... }; não existe bloco persistencia no module.'
            : "Use uma declaração documentada com o nome obrigatório, como task cadastrar { ... } ou enum Filtro { todas, pendentes }. Consulte docs/syntax.md.");
      }
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

      while (this.atual().tipo !== "fim_arquivo" && !this.temValor("}")) {
        this.ignorarRuido();
        if (this.temValor("}") || this.atual().tipo === "fim_arquivo") {
          break;
        }

        if (palavraChave === "tests" && this.atual().valor === "caso") {
          blocos.push(this.parseCasoTeste());
          continue;
        }

        if (this.iniciaSubblocoConhecido()) {
          const chave = this.atual().valor;
          if (["impl", "vinculos"].includes(chave) && blocos.some((b) => b.tipo === "bloco_generico" && b.palavraChave === chave)) {
            this.registrarErro("PAR008", `Bloco ${chave} repetido no mesmo escopo.`, this.atual().intervalo, undefined,
              `Reúna os campos em um único bloco ${chave}; blocos repetidos não são mesclados.`);
          }
          if (chave === "impl" && palavraChave !== "task") {
            this.registrarErro("PAR007", "impl só pode ser declarado dentro de uma task.", this.atual().intervalo, undefined,
              'Use task acao { impl { js: app.acao } vinculos { arquivo: "app.js" } } para ligar a operação ao código.');
          }
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
          campos.push(this.parseCampo(palavraChave));
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

  private parseCampo(contexto: BlocoGenericoAst["palavraChave"]): CampoAst {
      const inicio = this.atual().intervalo.inicio;
      const nome = this.avancar().valor;
      this.consumirValor(":", "Era esperado ':' depois do nome do campo.");
      if (this.temValor("[") || this.temValor("{")) {
        const valor = lerValorComposto(this);
        if (contexto === "vinculos" && nome === "arquivo") this.registrarErro("PAR004", "arquivo no vínculo exige um caminho entre aspas, não uma lista ou objeto.",
          { inicio, fim: this.anterior().intervalo.fim }, undefined, 'Repita arquivo: "app.js" para cada arquivo.');
        return { tipo: "campo", nome, valor, modificadores: [], literalComposto: true, intervalo: { inicio, fim: this.anterior().intervalo.fim } };
      }
      const partes: Token[] = [];
      let profundidade = 0;
      while (!["fim_arquivo", "nova_linha", "comentario"].includes(this.atual().tipo) && !this.temValor("}")) {
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
        if (token.tipo !== "texto" && ["<", "[", "("].includes(token.valor)) {
          profundidade += 1;
        } else if (token.tipo !== "texto" && [">", "]", ")"].includes(token.valor)) {
          profundidade = Math.max(0, profundidade - 1);
        }
      }
      const segmentos = partes.filter((token) => token.valor.length > 0);
      const possuiTextoLiteral = segmentos.some((token) => token.tipo === "texto");

      if (contexto === "vinculos" && nome === "arquivo" && (partes.length !== 1 || partes[0]?.tipo !== "texto")) {
        this.registrarErro("PAR004", "arquivo no vínculo exige um único caminho entre aspas.",
          { inicio, fim: this.anterior().intervalo.fim }, undefined, 'Use arquivo: "app.js". Repita arquivo: "outro.css" para outro arquivo.');
      }

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

      if (nome === "arquivo" && segmentos.some((token) => /[\\/]/.test(token.valor))) {
        this.diagnosticos.push(criarDiagnostico("PAR004", "Caminho de arquivo deve estar entre aspas para preservar separadores e espaços.", "erro",
          { inicio, fim: this.anterior().intervalo.fim }, `Use arquivo: ${JSON.stringify(segmentos.map((t) => t.valor).join(""))}`));
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
      while (!["fim_arquivo", "nova_linha", "comentario"].includes(this.atual().tipo) && !this.temValor("}")) {
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

      while (this.atual().tipo !== "fim_arquivo" && !this.temValor("}")) {
        this.ignorarRuido();
        if (this.temValor("}") || this.atual().tipo === "fim_arquivo") {
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
