// SEMA-GOVERNED: sema.geradores_codigo_governado
// Descricao: modulo particionado; consulte contratos/sema/geradores_codigo_governado.sema antes de editar.

import path from "node:path";
import type { ExpressaoSemantica, IrBlocoDeclarativo, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  extrairTiposNomeados,
  mapearTipoParaPython,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
  type FrameworkGeracao,
} from "@sema/padroes";

export interface OpcoesGeracaoPython {
  framework?: FrameworkGeracao;
}

export function mapearCampoParaPython(campo: IrCampo): string {
  let anotacao: string;

  if (campo.cardinalidade === "lista") {
    anotacao = `list[${mapearTipoParaPython(campo.tipoItem ?? campo.tipoBase)}]`;
  } else if (campo.cardinalidade === "mapa") {
    anotacao = `dict[${mapearTipoParaPython(campo.chaveMapa ?? "Texto")}, ${mapearTipoParaPython(campo.valorMapa ?? "Json")}]`;
  } else if (campo.cardinalidade === "uniao") {
    anotacao = campo.tiposAlternativos.map((tipo) => mapearTipoParaPython(tipo)).join(" | ");
  } else {
    anotacao = mapearTipoParaPython(campo.tipoBase);
  }

  if (campo.opcional && !/\bNone\b/.test(anotacao)) {
    return `${anotacao} | None`;
  }

  return anotacao;
}

export function gerarDataclass(nome: string, campos: IrCampo[]): string {
  const camposOrdenados = [...campos].sort((a, b) => {
    const obrigatorioA = a.modificadores.includes("required") ? 0 : 1;
    const obrigatorioB = b.modificadores.includes("required") ? 0 : 1;
    return obrigatorioA - obrigatorioB;
  });
  const linhas = camposOrdenados.length === 0
    ? "    pass"
    : camposOrdenados.map((campo) => {
      const tipoBase = mapearCampoParaPython(campo);
      if (campo.modificadores.includes("required")) {
        return `    ${campo.nome}: ${tipoBase}`;
      }
      return `    ${campo.nome}: ${/\bNone\b/.test(tipoBase) ? tipoBase : `${tipoBase} | None`} = None`;
    }).join("\n");
  return `@dataclass\nclass ${nome}:\n${linhas}\n`;
}

export function gerarComentarioInvariantesPython(invariantes: ExpressaoSemantica[]): string {
  if (invariantes.length === 0) {
    return "";
  }
  return `${invariantes.map((invariante) => `# Invariante: ${invariante.textoOriginal}`).join("\n")}\n`;
}

export function gerarListaCamposPython(campos: IrCampo[]): string {
  if (campos.length === 0) {
    return "[]";
  }
  return `[\n${campos.map((campo) => `    {"nome": "${campo.nome}", "tipo": "${campo.tipo}", "obrigatorio": ${campo.modificadores.includes("required") ? "True" : "False"}},`).join("\n")}\n]`;
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

export function gerarMapaErrosPython(erros: Record<string, string>): string {
  const entradas = Object.entries(erros);
  if (entradas.length === 0) {
    return "{}";
  }
  return `{\n${entradas.map(([nome, mensagem]) => `    ${JSON.stringify(nome)}: ${JSON.stringify(mensagem)},`).join("\n")}\n}`;
}

export function formatarValorPython(valor: string, camposConhecidos: Set<string>, variavel: string): string {
  const texto = valor.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(texto)) {
    return texto;
  }
  if (texto === "verdadeiro") {
    return "True";
  }
  if (texto === "falso") {
    return "False";
  }
  if (texto === "nulo") {
    return "None";
  }
  if (camposConhecidos.has(texto.split(".")[0] ?? texto)) {
    return `${variavel}.${texto}`;
  }
  return JSON.stringify(texto);
}

export function extrairReferenciaCampoConhecido(valor: string, camposConhecidos: Set<string>): string[] | null {
  const texto = valor.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/u.test(texto)) {
    return null;
  }

  const partes = texto.split(".");
  return camposConhecidos.has(partes[0] ?? "") ? partes : null;
}

export function gerarInicializacaoReferenciaSaida(partes: string[]): string[] {
  const [raiz, filho] = partes;
  if (!raiz || !filho) {
    return [];
  }

  return [
    `    if saida.${raiz} is None:\n        saida.${raiz} = SimpleNamespace()`,
    `    if getattr(saida.${raiz}, "${filho}", None) is None:\n        saida.${raiz}.${filho} = "valor_garantido"`,
  ];
}

export function resolverExpressaoPython(expressao: ExpressaoSemantica, camposConhecidos: Set<string>, variavel: string): string {
  switch (expressao.tipo) {
    case "existe":
      return `${variavel}.${expressao.alvo} is not None`;
    case "comparacao":
      return `${variavel}.${expressao.alvo} ${expressao.operador} ${formatarValorPython(expressao.valor, camposConhecidos, variavel)}`;
    case "pertencimento":
      return `${variavel}.${expressao.alvo} in [${(expressao.valores ?? []).map((valor) => formatarValorPython(valor, camposConhecidos, variavel)).join(", ")}]`;
    case "predicado":
      return "True";
    case "composta":
      return `(${expressao.termos.map((termo) => resolverExpressaoPython(termo, camposConhecidos, variavel)).join(expressao.operadorLogico === "e" ? " and " : " or ")})`;
    case "negacao":
      return `(not ${resolverExpressaoPython(expressao.termo, camposConhecidos, variavel)})`;
  }
}

export function valorPadraoPython(campo: IrCampo): string {
  const tipo = campo.tipoBase;
  const nomeCampo = campo.nome;
  if (campo.cardinalidade === "lista") {
    return "[]";
  }
  if (campo.cardinalidade === "mapa") {
    return "{}";
  }
  if (campo.opcional) {
    return "None";
  }
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
      return "False";
    case "Json":
      return "{}";
    default:
      return "SimpleNamespace()";
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

export function formatarLiteralTestePython(valor: string, tipoDeclarado?: string): string {
  const bruto = valor.trim();
  if (bruto.startsWith("[") && bruto.endsWith("]")) {
    const interior = bruto.slice(1, -1).trim();
    const tipoItem = resolverTipoItemTeste(tipoDeclarado);
    if (!interior) {
      return "[]";
    }
    return `[${dividirLiteralNoNivelRaiz(interior, ",").map((item) => formatarLiteralTestePython(item, tipoItem)).join(", ")}]`;
  }
  if (bruto.startsWith("{") && bruto.endsWith("}")) {
    const interior = bruto.slice(1, -1).trim();
    if (!interior) {
      return "{}";
    }
    const pares = dividirLiteralNoNivelRaiz(interior, ",")
      .map((par) => {
        const [chaveBruta, ...valorBruto] = dividirLiteralNoNivelRaiz(par, ":");
        if (!chaveBruta || valorBruto.length === 0) {
          return "";
        }
        return `${JSON.stringify(removerAspasExternas(chaveBruta))}: ${formatarLiteralTestePython(valorBruto.join(":"))}`;
      })
      .filter(Boolean);
    return `{${pares.join(", ")}}`;
  }

  const texto = removerAspasExternas(bruto);
  if (["Texto", "Id", "Email", "Url"].includes(tipoDeclarado ?? "")) {
    return JSON.stringify(texto);
  }
  if (["Numero", "Inteiro", "Decimal"].includes(tipoDeclarado ?? "") && /^-?\d+(?:\.\d+)?$/.test(texto)) {
    return texto;
  }
  if ((tipoDeclarado ?? "") === "Booleano") {
    if (texto === "verdadeiro") {
      return "True";
    }
    if (texto === "falso") {
      return "False";
    }
  }
  if (/^-?\d+(?:\.\d+)?$/.test(texto)) {
    return texto;
  }
  if (texto === "verdadeiro") {
    return "True";
  }
  if (texto === "falso") {
    return "False";
  }
  if (texto === "nulo") {
    return "None";
  }
  return JSON.stringify(texto);
}

export function gerarMapaLiteralPython(campos: Array<{ nome: string; valor: string }>): string {
  return `{${campos.map((campo) => `${JSON.stringify(campo.nome)}: ${campo.valor}`).join(", ")}}`;
}

export function coletarTiposCompostos(modulo: IrModulo): Map<string, Map<string, string>> {
  const tipos = new Map<string, Map<string, string>>();

  for (const type of modulo.types) {
    tipos.set(type.nome, new Map(type.definicao.campos.map((campo) => [campo.nome, campo.tipo])));
  }

  for (const entity of modulo.entities) {
    tipos.set(entity.nome, new Map(entity.campos.map((campo) => [campo.nome, campo.tipo])));
  }

  return tipos;
}

export function gerarLiteralBlocoTestePython(
  bloco: IrBlocoDeclarativo,
  tiposCompostos?: Map<string, Map<string, string>>,
  tiposDeclarados?: Map<string, string>,
  tipoAtual?: string,
): string {
  const entradas: Array<{ nome: string; valor: string }> = [];
  const tiposAtuais = tipoAtual ? tiposCompostos?.get(tipoAtual) : undefined;

  for (const campo of bloco.campos) {
    entradas.push({
      nome: campo.nome,
      valor: formatarLiteralTestePython(campo.tipo, tiposDeclarados?.get(campo.nome) ?? tiposAtuais?.get(campo.nome)),
    });
  }

  for (const subbloco of bloco.blocos) {
    const tipoSubbloco = tiposDeclarados?.get(subbloco.nome) ?? tiposAtuais?.get(subbloco.nome);
    entradas.push({
      nome: subbloco.nome,
      valor: gerarLiteralBlocoTestePython(subbloco.conteudo, tiposCompostos, undefined, tipoSubbloco),
    });
  }

  if (tipoAtual && tiposCompostos?.has(tipoAtual)) {
    return `${tipoAtual}(${entradas.map((campo) => `${campo.nome}=${campo.valor}`).join(", ")})`;
  }

  return gerarMapaLiteralPython(entradas);
}

export function paraPascalCase(valor: string): string {
  return valor
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((parte) => parte[0]!.toUpperCase() + parte.slice(1))
    .join("");
}

export function gerarPreparacaoSaida(task: IrTask): string {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const argumentos = task.output.map((campo) => `${campo.nome}=${valorPadraoPython(campo)}`).join(", ");
  const ajustes: string[] = [];

  for (const garantia of task.garantiasEstruturadas) {
    if (garantia.tipo === "pertencimento" && garantia.valores && camposSaida.has(garantia.alvo)) {
      ajustes.push(`    saida.${garantia.alvo} = ${formatarValorPython(garantia.valores[0] ?? "", camposSaida, "saida")}`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && camposSaida.has(garantia.alvo.split(".")[0] ?? garantia.alvo) && !garantia.alvo.includes(".")) {
      ajustes.push(`    saida.${garantia.alvo} = ${formatarValorPython(garantia.valor, camposSaida, "saida")}`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && garantia.alvo.includes(".")) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (raiz && filho && camposSaida.has(raiz)) {
        const referenciaValor = extrairReferenciaCampoConhecido(garantia.valor, camposSaida);
        if (referenciaValor) {
          ajustes.push(...gerarInicializacaoReferenciaSaida(referenciaValor));
        }
        ajustes.push(`    if saida.${raiz} is None:\n        saida.${raiz} = SimpleNamespace()`);
        ajustes.push(`    saida.${raiz}.${filho} = ${formatarValorPython(garantia.valor, camposSaida, "saida")}`);
      }
    }
    if (garantia.tipo === "existe" && garantia.alvo.includes(".")) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (raiz && filho && camposSaida.has(raiz)) {
        ajustes.push(`    if saida.${raiz} is None:\n        saida.${raiz} = SimpleNamespace()`);
        ajustes.push(`    if getattr(saida.${raiz}, "${filho}", None) is None:\n        saida.${raiz}.${filho} = "valor_garantido"`);
      }
    }
  }

  return `    saida = ${task.nome}Saida(${argumentos})\n${ajustes.join("\n")}`;
}
