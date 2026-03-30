export interface ParametroRotaGo {
  nome: string;
  tipoSema: "Texto" | "Inteiro" | "Decimal" | "Id";
}

export interface SimboloGoExtraido {
  simbolo: string;
  retorno?: string;
  parametros: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
}

export interface RotaGoExtraida {
  origem: "go";
  metodo: string;
  caminho: string;
  simbolo: string;
  parametros: ParametroRotaGo[];
  retorno?: string;
}

const METODOS_HTTP = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function normalizarCaminhoGo(caminho: string): string {
  return caminho
    .replace(/:([A-Za-z_]\w*)/g, "{$1}")
    .replace(/\{([^}:]+):[^}]+\}/g, "{$1}")
    .replace(/\/+/g, "/");
}

function mapearTipoGo(tipo?: string): ParametroRotaGo["tipoSema"] {
  const normalizado = (tipo ?? "").toLowerCase();
  if (/^(int|int32|int64|uint|uint64)$/.test(normalizado)) {
    return "Inteiro";
  }
  if (/^(float32|float64|decimal)$/.test(normalizado)) {
    return "Decimal";
  }
  if (/uuid|id$/.test(normalizado)) {
    return "Id";
  }
  return "Texto";
}

function extrairParametrosAssinaturaGo(assinatura: string): Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }> {
  return assinatura.split(",").map((parametroBruto) => {
    const parametro = parametroBruto.trim();
    if (!parametro) {
      return undefined;
    }
    const partes = parametro.split(/\s+/).filter(Boolean);
    if (partes.length < 2) {
      return undefined;
    }
    return {
      nome: partes[0]!,
      tipoTexto: partes.slice(1).join(" "),
      obrigatorio: true,
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function extrairParametrosRotaGo(caminho: string, assinatura: string): ParametroRotaGo[] {
  const assinaturaMap = new Map<string, string>();
  for (const parametro of extrairParametrosAssinaturaGo(assinatura)) {
    assinaturaMap.set(parametro.nome, parametro.tipoTexto ?? "");
  }
  return [...normalizarCaminhoGo(caminho).matchAll(/\{([^}]+)\}/g)].map((match) => ({
    nome: match[1]!,
    tipoSema: mapearTipoGo(assinaturaMap.get(match[1]!)),
  }));
}

export function extrairSimbolosGo(codigo: string): SimboloGoExtraido[] {
  const simbolos = new Map<string, SimboloGoExtraido>();
  for (const match of codigo.matchAll(/func\s+(?:\(([^)]+)\)\s+)?([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:\(([^)]*)\)|([A-Za-z0-9_.*\[\]]+))?\s*\{/g)) {
    const receiver = match[1]?.trim();
    const nome = match[2]!;
    const receiverTipo = receiver?.split(/\s+/).at(-1)?.replace(/^[*]+/, "");
    const simbolo = receiverTipo ? `${receiverTipo}.${nome}` : nome;
    simbolos.set(simbolo, {
      simbolo,
      retorno: (match[4] ?? match[5] ?? "").trim() || undefined,
      parametros: extrairParametrosAssinaturaGo(match[3] ?? ""),
    });
  }
  return [...simbolos.values()];
}

export function extrairRotasGo(codigo: string): RotaGoExtraida[] {
  const rotas = new Map<string, RotaGoExtraida>();

  for (const match of codigo.matchAll(/\b(?:http\.HandleFunc|\w+\.HandleFunc)\(\s*"([^"]+)"\s*,\s*([A-Za-z_]\w*)/g)) {
    const caminho = normalizarCaminhoGo(match[1]!);
    const simbolo = match[2]!;
    rotas.set(`GET:${caminho}:${simbolo}`, {
      origem: "go",
      metodo: "GET",
      caminho,
      simbolo,
      parametros: extrairParametrosRotaGo(caminho, ""),
    });
  }

  for (const match of codigo.matchAll(/\b(?:engine|router|group|\w+)\.(GET|POST|PUT|PATCH|DELETE)\(\s*"([^"]+)"\s*,\s*([A-Za-z_]\w*)/g)) {
    const metodo = match[1]!.toUpperCase();
    const caminho = normalizarCaminhoGo(match[2]!);
    const simbolo = match[3]!;
    rotas.set(`${metodo}:${caminho}:${simbolo}`, {
      origem: "go",
      metodo,
      caminho,
      simbolo,
      parametros: extrairParametrosRotaGo(caminho, ""),
    });
  }

  return [...rotas.values()];
}
