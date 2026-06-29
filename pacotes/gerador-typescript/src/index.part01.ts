// SEMA-GOVERNED: sema.geradores_codigo_governado
// Descricao: modulo particionado; consulte contratos/sema/geradores_codigo_governado.sema antes de editar.

import path from "node:path";
import type { ExpressaoSemantica, IrBlocoDeclarativo, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  extrairTiposNomeados,
  mapearTipoParaTypeScript,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
  type FrameworkGeracao,
} from "@sema/padroes";

export interface OpcoesGeracaoTypeScript {
  framework?: FrameworkGeracao;
}

export function gerarInterface(nome: string, campos: IrCampo[]): string {
  const propriedades = campos.length === 0
    ? "  // Sem campos declarados.\n"
    : campos.map((campo) => `  ${campo.nome}${campo.modificadores.includes("required") ? "" : "?"}: ${mapearTipoParaTypeScript(campo.tipo)};`).join("\n");
  return `export interface ${nome} {\n${propriedades}\n}\n`;
}

export function gerarComentarioInvariantesTypeScript(invariantes: ExpressaoSemantica[]): string {
  if (invariantes.length === 0) {
    return "";
  }
  return `${invariantes.map((invariante) => `// Invariante: ${invariante.textoOriginal}`).join("\n")}\n`;
}

export function gerarLiteralCamposTypeScript(campos: IrCampo[]): string {
  if (campos.length === 0) {
    return "[]";
  }
  return `[\n${campos.map((campo) => `  { nome: "${campo.nome}", tipo: "${campo.tipo}", obrigatorio: ${campo.modificadores.includes("required") ? "true" : "false"} },`).join("\n")}\n]`;
}

export function coletarTiposExternos(modulo: IrModulo): string[] {
  const locais = new Set([
    ...modulo.types.map((item) => item.nome),
    ...modulo.entities.map((item) => item.nome),
    ...modulo.enums.map((item) => item.nome),
  ]);
  const referenciados = new Set<string>();
  const campos = [
    ...modulo.entities.flatMap((entity) => entity.campos),
    ...modulo.tasks.flatMap((task) => [...task.input, ...task.output]),
    ...modulo.routes.flatMap((route) => [...route.inputPublico, ...route.outputPublico]),
    ...modulo.states.flatMap((state) => state.campos),
  ];

  for (const campo of campos) {
    for (const tipo of extrairTiposNomeados(campo.tipo)) {
      if (!locais.has(tipo)) {
        referenciados.add(tipo);
      }
    }
  }

  return [...referenciados].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function gerarLiteralErrosTypeScript(erros: Record<string, string>): string {
  const entradas = Object.entries(erros);
  if (entradas.length === 0) {
    return "{}";
  }
  return `{\n${entradas.map(([nome, mensagem]) => `  ${JSON.stringify(nome)}: ${JSON.stringify(mensagem)},`).join("\n")}\n}`;
}

export function formatarValorTypeScript(valor: string, camposConhecidos: Set<string>, variavel: string): string {
  const texto = valor.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(texto)) {
    return texto;
  }
  if (texto === "verdadeiro") {
    return "true";
  }
  if (texto === "falso") {
    return "false";
  }
  if (texto === "nulo") {
    return "null";
  }
  if (camposConhecidos.has(texto.split(".")[0] ?? texto)) {
    return `${variavel}.${texto}`;
  }
  return JSON.stringify(texto);
}

export function resolverReferenciaTypeScript(referencia: string, variavel: string): string {
  return `${variavel}.${referencia}`;
}

export function gerarExpressaoTypeScript(expressao: ExpressaoSemantica, camposConhecidos: Set<string>, variavel: string): string {
  switch (expressao.tipo) {
    case "existe":
      return `(${resolverReferenciaTypeScript(expressao.alvo, variavel)} !== undefined && ${resolverReferenciaTypeScript(expressao.alvo, variavel)} !== null)`;
    case "comparacao":
      return `(${resolverReferenciaTypeScript(expressao.alvo, variavel)} ${expressao.operador} ${formatarValorTypeScript(expressao.valor, camposConhecidos, variavel)})`;
    case "pertencimento":
      return `([${(expressao.valores ?? []).map((valor) => formatarValorTypeScript(valor, camposConhecidos, variavel)).join(", ")}].includes(${resolverReferenciaTypeScript(expressao.alvo, variavel)}))`;
    case "predicado":
      return "true";
    case "composta":
      return `(${expressao.termos.map((termo) => gerarExpressaoTypeScript(termo, camposConhecidos, variavel)).join(expressao.operadorLogico === "e" ? " && " : " || ")})`;
    case "negacao":
      return `(!${gerarExpressaoTypeScript(expressao.termo, camposConhecidos, variavel)})`;
  }
}

export function valorPadraoTypeScript(tipo: string, nomeCampo: string): string {
  switch (tipo) {
    case "Texto":
    case "Id":
    case "Email":
    case "Url":
      return JSON.stringify(`${nomeCampo}_exemplo`);
    case "Numero":
    case "Inteiro":
    case "Decimal":
      return "1";
    case "Booleano":
      return "false";
    case "Json":
      return "{}";
    default:
      return "{} as any";
  }
}

export function removerAspasExternas(valor: string): string {
  const texto = valor.trim();
  if (
    (texto.startsWith("\"") && texto.endsWith("\""))
    || (texto.startsWith("'") && texto.endsWith("'"))
  ) {
    return texto.slice(1, -1);
  }
  return texto;
}

export function dividirLiteralNoNivelRaiz(valor: string, separador: "," | ":"): string[] {
  const partes: string[] = [];
  let atual = "";
  let profundidadeAngular = 0;
  let profundidadeLista = 0;
  let profundidadeMapa = 0;
  let aspas: "\"" | "'" | null = null;

  for (let indice = 0; indice < valor.length; indice += 1) {
    const caractere = valor[indice]!;
    const anterior = indice > 0 ? valor[indice - 1] : "";

    if (aspas) {
      atual += caractere;
      if (caractere === aspas && anterior !== "\\") {
        aspas = null;
      }
      continue;
    }

    if (caractere === "\"" || caractere === "'") {
      aspas = caractere;
      atual += caractere;
      continue;
    }
    if (caractere === "<") {
      profundidadeAngular += 1;
      atual += caractere;
      continue;
    }
    if (caractere === ">") {
      profundidadeAngular = Math.max(0, profundidadeAngular - 1);
      atual += caractere;
      continue;
    }
    if (caractere === "[") {
      profundidadeLista += 1;
      atual += caractere;
      continue;
    }
    if (caractere === "]") {
      profundidadeLista = Math.max(0, profundidadeLista - 1);
      atual += caractere;
      continue;
    }
    if (caractere === "{") {
      profundidadeMapa += 1;
      atual += caractere;
      continue;
    }
    if (caractere === "}") {
      profundidadeMapa = Math.max(0, profundidadeMapa - 1);
      atual += caractere;
      continue;
    }

    if (
      caractere === separador
      && profundidadeAngular === 0
      && profundidadeLista === 0
      && profundidadeMapa === 0
    ) {
      if (atual.trim()) {
        partes.push(atual.trim());
      }
      atual = "";
      continue;
    }

    atual += caractere;
  }

  if (atual.trim()) {
    partes.push(atual.trim());
  }

  return partes;
}

export function resolverTipoItemTeste(tipoDeclarado?: string): string | undefined {
  const tipo = (tipoDeclarado ?? "").trim();
  if (!tipo) {
    return undefined;
  }
  if (tipo.endsWith("[]")) {
    return tipo.slice(0, -2).trim();
  }
  const lista = tipo.match(/^Lista<(.+)>$/);
  if (lista?.[1]) {
    return lista[1].trim();
  }
  return undefined;
}

export function formatarLiteralTesteTypeScript(valor: string, tipoDeclarado?: string): unknown {
  const bruto = valor.trim();
  if (bruto.startsWith("[") && bruto.endsWith("]")) {
    const interior = bruto.slice(1, -1).trim();
    const tipoItem = resolverTipoItemTeste(tipoDeclarado);
    if (!interior) {
      return [];
    }
    return dividirLiteralNoNivelRaiz(interior, ",").map((item) => formatarLiteralTesteTypeScript(item, tipoItem));
  }
  if (bruto.startsWith("{") && bruto.endsWith("}")) {
    const interior = bruto.slice(1, -1).trim();
    if (!interior) {
      return {};
    }
    const literal: Record<string, unknown> = {};
    for (const par of dividirLiteralNoNivelRaiz(interior, ",")) {
      const [chaveBruta, ...valorBruto] = dividirLiteralNoNivelRaiz(par, ":");
      if (!chaveBruta || valorBruto.length === 0) {
        continue;
      }
      literal[removerAspasExternas(chaveBruta)] = formatarLiteralTesteTypeScript(valorBruto.join(":"));
    }
    return literal;
  }

  const texto = removerAspasExternas(bruto);
  if (["Texto", "Id", "Email", "Url"].includes(tipoDeclarado ?? "")) {
    return texto;
  }
  if (["Numero", "Inteiro", "Decimal"].includes(tipoDeclarado ?? "") && /^-?\d+(?:\.\d+)?$/.test(texto)) {
    return Number(texto);
  }
  if ((tipoDeclarado ?? "") === "Booleano") {
    if (texto === "verdadeiro") {
      return true;
    }
    if (texto === "falso") {
      return false;
    }
  }
  if (/^-?\d+(?:\.\d+)?$/.test(texto)) {
    return Number(texto);
  }
  if (texto === "verdadeiro") {
    return true;
  }
  if (texto === "falso") {
    return false;
  }
  if (texto === "nulo") {
    return null;
  }
  return texto;
}

export function converterBlocoTesteParaValorTypeScript(
  bloco: IrBlocoDeclarativo,
  tiposDeclarados?: Map<string, string>,
): Record<string, unknown> {
  const literal: Record<string, unknown> = {};

  for (const campo of bloco.campos) {
    literal[campo.nome] = formatarLiteralTesteTypeScript(campo.tipo, tiposDeclarados?.get(campo.nome));
  }

  for (const subbloco of bloco.blocos) {
    literal[subbloco.nome] = converterBlocoTesteParaValorTypeScript(subbloco.conteudo);
  }

  return literal;
}

export function gerarPreparacaoSaida(task: IrTask): string {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const linhas: string[] = [];

  for (const campo of task.output) {
    linhas.push(`    ${campo.nome}: ${valorPadraoTypeScript(campo.tipo, campo.nome)},`);
  }

  const ajustes: string[] = [];
  for (const garantia of task.garantiasEstruturadas) {
    if (garantia.tipo === "pertencimento" && garantia.valores && camposSaida.has(garantia.alvo)) {
      ajustes.push(`  saida.${garantia.alvo} = ${formatarValorTypeScript(garantia.valores[0] ?? "", camposSaida, "saida")} as any;`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && camposSaida.has(garantia.alvo.split(".")[0] ?? garantia.alvo)) {
      ajustes.push(`  ${resolverReferenciaTypeScript(garantia.alvo, "saida")} = ${formatarValorTypeScript(garantia.valor, camposSaida, "saida")} as any;`);
    }
    if (garantia.tipo === "existe" && garantia.alvo.includes(".")) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (raiz && filho && camposSaida.has(raiz)) {
        ajustes.push(`  saida.${raiz} = (saida.${raiz} ?? {}) as any;`);
        ajustes.push(`  (saida.${raiz} as any).${filho} = (saida.${raiz} as any).${filho} ?? "valor_garantido";`);
      }
    }
  }

  return `  const saida = {\n${linhas.join("\n")}\n  } as ${task.nome}Saida;\n${ajustes.join("\n")}`;
}

export function gerarValidacoes(task: IrTask): string {
  const linhas: string[] = [];
  const camposEntrada = new Set(task.input.map((campo) => campo.nome));
  for (const campo of task.input) {
    if (campo.modificadores.includes("required")) {
      linhas.push(`  if (entrada.${campo.nome} === undefined || entrada.${campo.nome} === null) throw new Error("Campo obrigatorio ausente: ${campo.nome}");`);
    }
  }
  for (const regra of task.regrasEstruturadas) {
    switch (regra.tipo) {
      case "predicado":
        linhas.push(`  // Predicado declarado em Sema: ${regra.textoOriginal}`);
        break;
      default:
        linhas.push(`  if (!${gerarExpressaoTypeScript(regra, camposEntrada, "entrada")}) throw new Error("Regra violada: ${regra.textoOriginal}");`);
        break;
    }
  }
  for (const regra of task.rules.filter((regra) => !task.regrasEstruturadas.some((estruturada) => estruturada.textoOriginal === regra))) {
    linhas.push(`  // Regra declarada em Sema: ${regra}`);
  }
  return linhas.join("\n");
}

export function gerarGarantias(task: IrTask): string {
  return `  verificar_garantias_${normalizarNomeParaSimbolo(task.nome)}(saida);\n  return saida;`;
}

export function gerarFuncaoGarantias(task: IrTask): string {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const linhas: string[] = [];
  for (const garantia of task.garantiasEstruturadas) {
    switch (garantia.tipo) {
      case "predicado":
        linhas.push(`  // Predicado de garantia declarado em Sema: ${garantia.textoOriginal}`);
        break;
      default:
        linhas.push(`  if (!${gerarExpressaoTypeScript(garantia, camposSaida, "saida")}) throw new Error("Garantia violada: ${garantia.textoOriginal}");`);
        break;
    }
  }
  for (const garantia of task.guarantees.filter((texto) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === texto))) {
    linhas.push(`  // Garantia declarada em Sema: ${garantia}`);
  }
  if (linhas.length === 0) {
    linhas.push("  // Nenhuma garantia declarada.");
  }
  return `export function verificar_garantias_${normalizarNomeParaSimbolo(task.nome)}(saida: ${task.nome}Saida): void {\n${linhas.join("\n")}\n}\n`;
}

export function gerarMetadadosTask(task: IrTask): string {
  const efeitos = task.efeitosEstruturados.length === 0
    ? "[]"
    : `[\n${task.efeitosEstruturados.map((efeito) => `  { categoria: "${efeito.categoria}", alvo: "${efeito.alvo}"${efeito.detalhe ? `, detalhe: ${JSON.stringify(efeito.detalhe)}` : ""}${efeito.criticidade ? `, criticidade: "${efeito.criticidade}"` : ""} },`).join("\n")}\n]`;
  const implementacoes = task.implementacoesExternas.length === 0
    ? "[]"
    : `[\n${task.implementacoesExternas.map((impl) => `  { origem: "${impl.origem}", caminho: "${impl.caminho}", resolucaoImpl: "${impl.resolucaoImpl ?? impl.caminho}", statusImpl: "${impl.statusImpl ?? "nao_verificado"}" },`).join("\n")}\n]`;

  return `export const contrato_${normalizarNomeParaSimbolo(task.nome)} = {
  nome: "${task.nome}",
  input: ${gerarLiteralCamposTypeScript(task.input)},
  output: ${gerarLiteralCamposTypeScript(task.output)},
  effects: ${efeitos},
  impl: ${implementacoes},
  errors: ${gerarLiteralErrosTypeScript(task.errors)},
  guarantees: ${JSON.stringify(task.guarantees, null, 2)},
} as const;
`;
}

export function gerarMapeamentoSaidaPublicaTypeScript(nomeVariavel: string, campos: IrCampo[]): string {
  if (campos.length === 0) {
    return "{}";
  }
  return `{\n${campos.map((campo) => `      ${campo.nome}: ${nomeVariavel}.${campo.nome},`).join("\n")}\n    }`;
}
