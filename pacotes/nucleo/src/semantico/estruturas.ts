export type TipoExpressaoSemantica = "existe" | "comparacao" | "predicado" | "pertencimento";

export interface ExpressaoSemantica {
  tipo: TipoExpressaoSemantica;
  textoOriginal: string;
  alvo: string;
  operador?: "==" | "!=" | ">" | ">=" | "<" | "<=";
  valor?: string;
  predicado?: string;
  argumentos?: string;
  valores?: string[];
}

export interface EfeitoSemantico {
  textoOriginal: string;
  acao: string;
  alvo: string;
  complemento?: string;
}

export interface TransicaoEstadoSemantica {
  textoOriginal: string;
  origem: string;
  destino: string;
}

const OPERADORES_COMPARACAO = new Set(["==", "!=", ">", ">=", "<", "<="]);

export function parsearExpressaoSemantica(texto: string): ExpressaoSemantica | undefined {
  const normalizado = texto.trim();
  if (!normalizado) {
    return undefined;
  }

  const correspondenciaMarcador = normalizado.match(/^(persistencia|estado|sucesso)\s+([A-Za-z_][A-Za-z0-9_]*)$/);
  if (correspondenciaMarcador) {
    return {
      tipo: "predicado",
      textoOriginal: normalizado,
      alvo: correspondenciaMarcador[1]!,
      predicado: correspondenciaMarcador[2]!,
    };
  }

  const correspondenciaExiste = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s+existe$/);
  if (correspondenciaExiste) {
    return {
      tipo: "existe",
      textoOriginal: normalizado,
      alvo: correspondenciaExiste[1]!,
    };
  }

  const correspondenciaPredicado = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s+deve_ser\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+(.+))?$/);
  if (correspondenciaPredicado) {
    return {
      tipo: "predicado",
      textoOriginal: normalizado,
      alvo: correspondenciaPredicado[1]!,
      predicado: correspondenciaPredicado[2]!,
      argumentos: correspondenciaPredicado[3]?.trim(),
    };
  }

  const correspondenciaPertencimento = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s+em\s+\[(.+)\]$/);
  if (correspondenciaPertencimento) {
    const valores = correspondenciaPertencimento[2]!
      .split(",")
      .map((valor) => valor.trim())
      .filter(Boolean);
    if (valores.length === 0) {
      return undefined;
    }
    return {
      tipo: "pertencimento",
      textoOriginal: normalizado,
      alvo: correspondenciaPertencimento[1]!,
      valores,
    };
  }

  const partes = normalizado.split(/\s+/).filter(Boolean);
  if (partes.length >= 3 && OPERADORES_COMPARACAO.has(partes[1]!)) {
    return {
      tipo: "comparacao",
      textoOriginal: normalizado,
      alvo: partes[0]!,
      operador: partes[1] as ExpressaoSemantica["operador"],
      valor: partes.slice(2).join(" "),
    };
  }

  return undefined;
}

export function parsearEfeitoSemantico(texto: string): EfeitoSemantico | undefined {
  const normalizado = texto.trim();
  if (!normalizado) {
    return undefined;
  }

  const partes = normalizado.split(/\s+/).filter(Boolean);
  if (partes.length < 2) {
    return undefined;
  }

  return {
    textoOriginal: normalizado,
    acao: partes[0]!,
    alvo: partes[1]!,
    complemento: partes.slice(2).join(" ").trim() || undefined,
  };
}

export function parsearTransicaoEstado(texto: string): TransicaoEstadoSemantica | undefined {
  const normalizado = texto.trim();
  if (!normalizado) {
    return undefined;
  }

  const correspondencia = normalizado.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*->\s*([A-Za-z_][A-Za-z0-9_.]*)$/);
  if (!correspondencia) {
    return undefined;
  }

  return {
    textoOriginal: normalizado,
    origem: correspondencia[1]!,
    destino: correspondencia[2]!,
  };
}

export function extrairReferenciasDaExpressao(expressao: ExpressaoSemantica): string[] {
  const referencias = [expressao.alvo];

  if (expressao.tipo === "comparacao" && expressao.valor && pareceReferenciaSemantica(expressao.valor)) {
    referencias.push(expressao.valor);
  }

  return referencias;
}

export function pareceReferenciaSemantica(valor: string): boolean {
  const normalizado = valor.trim();
  if (!normalizado) {
    return false;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(normalizado)) {
    return false;
  }

  if (["verdadeiro", "falso", "nulo"].includes(normalizado)) {
    return false;
  }

  if (/^[A-Z][A-Z0-9_]*$/.test(normalizado)) {
    return false;
  }

  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(normalizado);
}
