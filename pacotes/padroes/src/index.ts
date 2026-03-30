export type AlvoGeracao = "typescript" | "python" | "dart";
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

export function mapearTipoParaPython(tipo: string): string {
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
  return tabela[tipo] ?? tipo;
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
