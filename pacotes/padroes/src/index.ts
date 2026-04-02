export type AlvoGeracao = "typescript" | "python" | "dart" | "lua";
export type FrameworkGeracao = "base" | "nestjs" | "fastapi";

export interface ArquivoGerado {
  caminhoRelativo: string;
  conteudo: string;
}

export interface EstruturaModuloNormalizada {
  segmentos: string[];
  contextoSegmentos: string[];
  contextoRelativo: string;
  nomeArquivo: string;
  nomeBase: string;
}

export function normalizarNomeParaSimbolo(nome: string): string {
  return nome
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizarNomeModulo(nome: string): string {
  return nome.replace(/[^\w.]+/g, "_");
}

export function normalizarSegmentoModulo(segmento: string): string {
  return segmento.replace(/[^\w]+/g, "_");
}

export function descreverEstruturaModulo(nome: string): EstruturaModuloNormalizada {
  const segmentos = nome
    .split(".")
    .map((segmento) => normalizarSegmentoModulo(segmento.trim()))
    .filter(Boolean);
  const contextoSegmentos = segmentos.slice(0, -1);
  const nomeArquivo = segmentos.at(-1) ?? normalizarSegmentoModulo(nome);

  return {
    segmentos,
    contextoSegmentos,
    contextoRelativo: contextoSegmentos.join("/"),
    nomeArquivo,
    nomeBase: normalizarNomeModulo(nome).replace(/\./g, "_"),
  };
}

export function mapearTipoParaTypeScript(tipo: string): string {
  const tabela: Record<string, string> = {
    Texto: "string",
    Numero: "number",
    Inteiro: "number",
    Decimal: "number",
    Booleano: "boolean",
    Data: "string",
    DataHora: "string",
    Id: "string",
    Email: "string",
    Url: "string",
    Json: "Record<string, unknown>",
    Vazio: "void",
  };
  return tabela[tipo] ?? tipo;
}

function dividirTipoNoNivelRaiz(valor: string, separador: "|" | ","): string[] {
  const partes: string[] = [];
  let atual = "";
  let profundidade = 0;

  for (const caractere of valor) {
    if (caractere === "<") {
      profundidade += 1;
      atual += caractere;
      continue;
    }
    if (caractere === ">") {
      profundidade = Math.max(0, profundidade - 1);
      atual += caractere;
      continue;
    }
    if (caractere === separador && profundidade === 0) {
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

export function mapearTipoParaPython(tipo: string): string {
  const limpo = tipo.trim();
  if (/^Opcional<.+>$/.test(limpo)) {
    return `${mapearTipoParaPython(limpo.slice("Opcional<".length, -1))} | None`;
  }

  const uniao = dividirTipoNoNivelRaiz(limpo, "|");
  if (uniao.length > 1) {
    return uniao.map((item) => mapearTipoParaPython(item)).join(" | ");
  }

  if (/^Lista<.+>$/.test(limpo)) {
    return `list[${mapearTipoParaPython(limpo.slice("Lista<".length, -1))}]`;
  }

  if (/^Mapa<.+>$/.test(limpo)) {
    const partesMapa = dividirTipoNoNivelRaiz(limpo.slice("Mapa<".length, -1), ",");
    const chave = mapearTipoParaPython(partesMapa[0] ?? "Texto");
    const valor = mapearTipoParaPython(partesMapa[1] ?? "Json");
    return `dict[${chave}, ${valor}]`;
  }

  const tabela: Record<string, string> = {
    Texto: "str",
    Numero: "float",
    Inteiro: "int",
    Decimal: "float",
    Booleano: "bool",
    Data: "str",
    DataHora: "str",
    Id: "str",
    Email: "str",
    Url: "str",
    Json: "dict[str, object]",
    Vazio: "None",
  };
  return tabela[limpo] ?? limpo;
}

export function mapearTipoParaDart(tipo: string): string {
  const tabela: Record<string, string> = {
    Texto: "String",
    Numero: "double",
    Inteiro: "int",
    Decimal: "double",
    Booleano: "bool",
    Data: "String",
    DataHora: "String",
    Id: "String",
    Email: "String",
    Url: "String",
    Json: "Map<String, Object?>",
    Vazio: "void",
  };
  return tabela[tipo] ?? tipo;
}

export function mapearTipoParaLua(tipo: string): string {
  const limpo = tipo.trim();
  if (/^Opcional<.+>$/.test(limpo)) {
    return `${mapearTipoParaLua(limpo.slice("Opcional<".length, -1))} | nil`;
  }

  const uniao = dividirTipoNoNivelRaiz(limpo, "|");
  if (uniao.length > 1) {
    return uniao.map((item) => mapearTipoParaLua(item)).join(" | ");
  }

  if (/^Lista<.+>$/.test(limpo)) {
    return `table<integer, ${mapearTipoParaLua(limpo.slice("Lista<".length, -1))}>`;
  }

  if (/^Mapa<.+>$/.test(limpo)) {
    const partesMapa = dividirTipoNoNivelRaiz(limpo.slice("Mapa<".length, -1), ",");
    const chave = mapearTipoParaLua(partesMapa[0] ?? "Texto");
    const valor = mapearTipoParaLua(partesMapa[1] ?? "Json");
    return `table<${chave}, ${valor}>`;
  }

  const tabela: Record<string, string> = {
    Texto: "string",
    Numero: "number",
    Inteiro: "integer",
    Decimal: "number",
    Booleano: "boolean",
    Data: "string",
    DataHora: "string",
    Id: "string",
    Email: "string",
    Url: "string",
    Json: "table",
    Vazio: "nil",
  };
  return tabela[limpo] ?? limpo;
}
