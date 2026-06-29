export type AlvoGeracao = "typescript" | "python" | "dart" | "lua" | "javascript" | "html" | "css";
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

const TIPOS_PRIMITIVOS_SEMA = new Set([
  "Texto",
  "Numero",
  "Inteiro",
  "Decimal",
  "Booleano",
  "Data",
  "DataHora",
  "Id",
  "Email",
  "Url",
  "Json",
  "Vazio",
]);

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

function agruparTipoParaColecaoTypeScript(tipo: string): string {
  return tipo.includes(" | ") ? `(${tipo})` : tipo;
}

export function dividirTipoNoNivelRaiz(valor: string, separador: "|" | ","): string[] {
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

export function extrairTiposNomeados(tipo: string): string[] {
  const referencias = new Set<string>();

  const visitar = (valor: string): void => {
    const limpo = valor.trim();
    if (!limpo) {
      return;
    }

    const uniao = dividirTipoNoNivelRaiz(limpo, "|");
    if (uniao.length > 1) {
      uniao.forEach(visitar);
      return;
    }

    if (/^Opcional<.+>$/.test(limpo)) {
      visitar(limpo.slice("Opcional<".length, -1));
      return;
    }

    if (limpo.endsWith("[]")) {
      visitar(limpo.slice(0, -2));
      return;
    }

    if (/^Lista<.+>$/.test(limpo)) {
      visitar(limpo.slice("Lista<".length, -1));
      return;
    }

    if (/^Mapa<.+>$/.test(limpo)) {
      const partesMapa = dividirTipoNoNivelRaiz(limpo.slice("Mapa<".length, -1), ",");
      visitar(partesMapa[0] ?? "");
      visitar(partesMapa[1] ?? "");
      return;
    }

    if (TIPOS_PRIMITIVOS_SEMA.has(limpo)) {
      return;
    }

    referencias.add(limpo);
  };

  visitar(tipo);
  return [...referencias];
}

export function mapearTipoParaTypeScript(tipo: string): string {
  const limpo = tipo.trim();
  if (/^Opcional<.+>$/.test(limpo)) {
    return `${mapearTipoParaTypeScript(limpo.slice("Opcional<".length, -1))} | null`;
  }

  const uniao = dividirTipoNoNivelRaiz(limpo, "|");
  if (uniao.length > 1) {
    return uniao.map((item) => mapearTipoParaTypeScript(item)).join(" | ");
  }

  if (limpo.endsWith("[]")) {
    return `${agruparTipoParaColecaoTypeScript(mapearTipoParaTypeScript(limpo.slice(0, -2)))}[]`;
  }

  if (/^Lista<.+>$/.test(limpo)) {
    return `${agruparTipoParaColecaoTypeScript(mapearTipoParaTypeScript(limpo.slice("Lista<".length, -1)))}[]`;
  }

  if (/^Mapa<.+>$/.test(limpo)) {
    const partesMapa = dividirTipoNoNivelRaiz(limpo.slice("Mapa<".length, -1), ",");
    const chave = mapearTipoParaTypeScript(partesMapa[0] ?? "Texto");
    const valor = mapearTipoParaTypeScript(partesMapa[1] ?? "Json");
    return `Record<${chave}, ${valor}>`;
  }

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
  return tabela[limpo] ?? limpo;
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

  if (limpo.endsWith("[]")) {
    return `list[${mapearTipoParaPython(limpo.slice(0, -2))}]`;
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
  const limpo = tipo.trim();
  if (/^Opcional<.+>$/.test(limpo)) {
    const baseOpcional = mapearTipoParaDart(limpo.slice("Opcional<".length, -1));
    return baseOpcional.endsWith("?") ? baseOpcional : `${baseOpcional}?`;
  }

  const uniao = dividirTipoNoNivelRaiz(limpo, "|");
  if (uniao.length > 1) {
    const tiposUnicos = [...new Set(uniao.map((item) => mapearTipoParaDart(item)).filter(Boolean))];
    return tiposUnicos.length === 1 ? tiposUnicos[0]! : "Object?";
  }

  if (limpo.endsWith("[]")) {
    return `List<${mapearTipoParaDart(limpo.slice(0, -2))}>`;
  }

  if (/^Lista<.+>$/.test(limpo)) {
    return `List<${mapearTipoParaDart(limpo.slice("Lista<".length, -1))}>`;
  }

  if (/^Mapa<.+>$/.test(limpo)) {
    const partesMapa = dividirTipoNoNivelRaiz(limpo.slice("Mapa<".length, -1), ",");
    const chave = mapearTipoParaDart(partesMapa[0] ?? "Texto");
    const valor = mapearTipoParaDart(partesMapa[1] ?? "Json");
    return `Map<${chave}, ${valor}>`;
  }

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
  return tabela[limpo] ?? limpo;
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

  if (limpo.endsWith("[]")) {
    return `table<integer, ${mapearTipoParaLua(limpo.slice(0, -2))}>`;
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

export function mapearTipoParaJavaScript(tipo: string): string {
  const limpo = tipo.trim();
  if (/^Opcional<.+>$/.test(limpo)) {
    return `${mapearTipoParaJavaScript(limpo.slice("Opcional<".length, -1))}|null`;
  }

  const uniao = dividirTipoNoNivelRaiz(limpo, "|");
  if (uniao.length > 1) {
    return uniao.map((item) => mapearTipoParaJavaScript(item)).join("|");
  }

  if (limpo.endsWith("[]")) {
    return `Array.<${mapearTipoParaJavaScript(limpo.slice(0, -2))}>`;
  }

  if (/^Lista<.+>$/.test(limpo)) {
    return `Array.<${mapearTipoParaJavaScript(limpo.slice("Lista<".length, -1))}>`;
  }

  if (/^Mapa<.+>$/.test(limpo)) {
    const partesMapa = dividirTipoNoNivelRaiz(limpo.slice("Mapa<".length, -1), ",");
    const chave = mapearTipoParaJavaScript(partesMapa[0] ?? "Texto");
    const valor = mapearTipoParaJavaScript(partesMapa[1] ?? "Json");
    return `Object.<${chave}, ${valor}>`;
  }

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
    Json: "Object",
    Vazio: "void",
  };
  return tabela[limpo] ?? limpo;
}

export function mapearTipoParaInputHtml(tipo: string): string {
  const tabela: Record<string, string> = {
    Texto: "text",
    Numero: "number",
    Inteiro: "number",
    Decimal: "number",
    Booleano: "checkbox",
    Data: "date",
    DataHora: "datetime-local",
    Id: "text",
    Email: "email",
    Url: "url",
    Json: "textarea",
    Vazio: "hidden",
  };
  return tabela[tipo] ?? "text";
}
