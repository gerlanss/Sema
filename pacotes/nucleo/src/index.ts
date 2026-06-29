// SEMA-GOVERNED
// Módulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descrição: ponto público do núcleo Sema, incluindo compilação, IR e validações semânticas.

import { parsear } from "./parser/parser.js";
import { analisarSemantica, criarContextoLocal } from "./semantico/analisador.js";
import { tokenizar } from "./lexer/lexer.js";
import { converterParaIr } from "./ir/conversor.js";
import { formatarDiagnostico, type Diagnostico } from "./diagnosticos/index.js";
import type { ModuloAst } from "./ast/tipos.js";
import type { IrModulo } from "./ir/modelos.js";

export * from "./diagnosticos/index.js";
export * from "./diagnosticos/melhorador.js";
export * from "./diagnosticos/snippets.js";
export * from "./ast/tipos.js";
export * from "./lexer/tokens.js";
export * from "./lexer/lexer.js";
export * from "./parser/parser.js";
export * from "./semantico/analisador.js";
export * from "./semantico/estruturas.js";
export * from "./semantico/orcamentoSemantico.js";
export * from "./persistencia/contratos.js";
export * from "./ir/modelos.js";
export * from "./ir/conversor.js";
export * from "./formatador/index.js";
export * from "./util/arquivos.js";

export interface ResultadoCompilacao {
  modulo?: ModuloAst;
  ir?: IrModulo;
  diagnosticos: Diagnostico[];
}

export interface FonteProjeto {
  caminho: string;
  codigo: string;
}

export interface ResultadoCompilacaoProjetoModulo extends ResultadoCompilacao {
  caminho: string;
}

export interface ResultadoCompilacaoProjeto {
  modulos: ResultadoCompilacaoProjetoModulo[];
  diagnosticos: Diagnostico[];
}

export function compilarCodigo(codigo: string, arquivo?: string): ResultadoCompilacao {
  const resultadoLexer = tokenizar(codigo, arquivo);
  const resultadoParser = parsear(resultadoLexer.tokens);
  const diagnosticos = [...resultadoLexer.diagnosticos, ...resultadoParser.diagnosticos];

  if (!resultadoParser.modulo) {
    return { diagnosticos };
  }

  const resultadoSemantico = analisarSemantica(resultadoParser.modulo);
  diagnosticos.push(...resultadoSemantico.diagnosticos);

  const ir = converterParaIr(resultadoParser.modulo, diagnosticos, resultadoSemantico.contexto);

  return {
    modulo: resultadoParser.modulo,
    ir,
    diagnosticos,
  };
}

export function compilarProjeto(fontes: FonteProjeto[]): ResultadoCompilacaoProjeto {
  const resultadosBase = fontes.map((fonte) => {
    const resultadoLexer = tokenizar(fonte.codigo, fonte.caminho);
    const resultadoParser = parsear(resultadoLexer.tokens);
    return {
      caminho: fonte.caminho,
      modulo: resultadoParser.modulo,
      diagnosticos: [...resultadoLexer.diagnosticos, ...resultadoParser.diagnosticos],
    };
  });

  const contextosLocais = new Map<string, ReturnType<typeof criarContextoLocal>>();
  const nomesModulos = new Map<string, string>();

  for (const resultado of resultadosBase) {
    if (!resultado.modulo) {
      continue;
    }

    const caminhoAnterior = nomesModulos.get(resultado.modulo.nome);
    if (caminhoAnterior) {
      resultado.diagnosticos.push({
        codigo: "SEM020",
        mensagem: `Modulo "${resultado.modulo.nome}" foi declarado mais de uma vez no mesmo projeto.`,
        severidade: "erro",
        intervalo: resultado.modulo.intervalo,
        dica: "Use nomes de modulo unicos para evitar ambiguidade de importacao.",
        contexto: `Primeira ocorrencia encontrada em ${caminhoAnterior}.`,
      });
      continue;
    }

    nomesModulos.set(resultado.modulo.nome, resultado.caminho);
    contextosLocais.set(resultado.modulo.nome, criarContextoLocal(resultado.modulo));
  }

  const modulos = resultadosBase.map<ResultadoCompilacaoProjetoModulo>((resultado) => {
    if (!resultado.modulo) {
      return {
        caminho: resultado.caminho,
        diagnosticos: resultado.diagnosticos,
      };
    }

    const resultadoSemantico = analisarSemantica(resultado.modulo, { contextosModulos: contextosLocais });
    const diagnosticos = [...resultado.diagnosticos, ...resultadoSemantico.diagnosticos];
    const ir = converterParaIr(resultado.modulo, diagnosticos, resultadoSemantico.contexto);

    return {
      caminho: resultado.caminho,
      modulo: resultado.modulo,
      ir,
      diagnosticos,
    };
  });

  return {
    modulos,
    diagnosticos: modulos.flatMap((modulo) => modulo.diagnosticos),
  };
}

export function temErros(diagnosticos: Diagnostico[]): boolean {
  return diagnosticos.some((diagnostico) => diagnostico.severidade === "erro");
}

export function formatarDiagnosticos(diagnosticos: Diagnostico[]): string {
  if (diagnosticos.length === 0) {
    return "Nenhum diagnostico encontrado.";
  }
  return diagnosticos.map(formatarDiagnostico).join("\n");
}

export interface RespostaValidacao {
  valido: boolean;
  bloqueia_acao: boolean;
  erros: Array<{
    codigo: string;
    mensagem: string;
    dica?: string;
    contexto?: string;
  }>;
  advertencias: Array<{
    codigo: string;
    mensagem: string;
    dica?: string;
  }>;
  proximo_passo_obrigatorio: string;
}

export function gerarRespostaValidacao(diagnosticos: Diagnostico[]): RespostaValidacao {
  const erros = diagnosticos
    .filter((d) => d.severidade === "erro")
    .map((d) => ({
      codigo: d.codigo,
      mensagem: d.mensagem,
      dica: d.dica,
      contexto: d.contexto,
    }));

  const advertencias = diagnosticos
    .filter((d) => d.severidade === "aviso")
    .map((d) => ({
      codigo: d.codigo,
      mensagem: d.mensagem,
      dica: d.dica,
    }));

  const temErros = erros.length > 0;
  const proximo_passo_obrigatorio = temErros
    ? "corrigir_contrato_e_chamar_sema_validar_novamente"
    : "pode_chamar_profile_ou_ir";

  return {
    valido: !temErros,
    bloqueia_acao: temErros,
    erros,
    advertencias,
    proximo_passo_obrigatorio,
  };
}
