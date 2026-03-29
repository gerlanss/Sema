export type AlvoGeracao = "typescript" | "python";

export interface ArquivoGerado {
  caminhoRelativo: string;
  conteudo: string;
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

