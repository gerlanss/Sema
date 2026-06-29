export interface SimboloLuaExtraido {
  simbolo: string;
}

function adicionar(simbolos: Map<string, SimboloLuaExtraido>, simbolo?: string): void {
  const valor = simbolo?.trim();
  if (!valor || ["if", "for", "while", "repeat", "return", "function"].includes(valor)) {
    return;
  }
  simbolos.set(valor, { simbolo: valor });
}

export function extrairSimbolosLua(codigo: string): SimboloLuaExtraido[] {
  const simbolos = new Map<string, SimboloLuaExtraido>();

  for (const match of codigo.matchAll(/(?:^|\n)\s*(?:local\s+)?function\s+([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\(/g)) {
    adicionar(simbolos, match[1]);
  }

  for (const match of codigo.matchAll(/(?:^|\n)\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*=\s*function\s*\(/g)) {
    adicionar(simbolos, match[1]);
  }

  for (const match of codigo.matchAll(/[{,]\s*([A-Za-z_]\w*)\s*=\s*function\s*\(/g)) {
    adicionar(simbolos, match[1]);
  }

  return [...simbolos.values()];
}
