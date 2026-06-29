export interface ParametroRotaRust {
  nome: string;
  tipoSema: "Texto" | "Inteiro" | "Decimal" | "Id";
}

export interface SimboloRustExtraido {
  simbolo: string;
  retorno?: string;
  parametros: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
}

export interface RotaRustExtraida {
  origem: "rust";
  metodo: string;
  caminho: string;
  simbolo: string;
  parametros: ParametroRotaRust[];
  retorno?: string;
}

const METODOS_HTTP = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function normalizarCaminhoRust(caminho: string): string {
  return caminho
    .replace(/:([A-Za-z_]\w*)/g, "{$1}")
    .replace(/\/+/g, "/");
}

function mapearTipoRust(tipo?: string): ParametroRotaRust["tipoSema"] {
  const normalizado = (tipo ?? "").toLowerCase();
  if (/^(i8|i16|i32|i64|u8|u16|u32|u64|usize|isize)$/.test(normalizado)) {
    return "Inteiro";
  }
  if (/^(f32|f64|decimal)$/.test(normalizado)) {
    return "Decimal";
  }
  if (/uuid|id$/.test(normalizado)) {
    return "Id";
  }
  return "Texto";
}

function extrairParametrosAssinaturaRust(assinatura: string): Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }> {
  return assinatura.split(",").map((parametroBruto) => {
    const parametro = parametroBruto.trim();
    if (!parametro || parametro === "&self" || parametro === "self") {
      return undefined;
    }
    const [nome, tipo] = parametro.split(":").map((parte) => parte.trim());
    if (!nome) {
      return undefined;
    }
    return {
      nome: nome.replace(/^mut\s+/, ""),
      tipoTexto: tipo,
      obrigatorio: true,
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function extrairParametrosRotaRust(caminho: string, assinatura: string): ParametroRotaRust[] {
  const assinaturaMap = new Map<string, string>();
  for (const parametro of extrairParametrosAssinaturaRust(assinatura)) {
    assinaturaMap.set(parametro.nome, parametro.tipoTexto ?? "");
  }
  return [...normalizarCaminhoRust(caminho).matchAll(/\{([^}]+)\}/g)].map((match) => ({
    nome: match[1]!,
    tipoSema: mapearTipoRust(assinaturaMap.get(match[1]!)),
  }));
}

export function extrairSimbolosRust(codigo: string): SimboloRustExtraido[] {
  const simbolos = new Map<string, SimboloRustExtraido>();
  let implAtual: string | undefined;

  for (const linha of codigo.split(/\r?\n/)) {
    const trim = linha.trim();
    const impl = trim.match(/^impl(?:<[^>]+>)?\s+([A-Za-z_]\w*)/);
    if (impl) {
      implAtual = impl[1]!;
      continue;
    }
    if (trim.startsWith("}")) {
      implAtual = undefined;
    }

    const funcao = trim.match(/^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:->\s*([^ {]+))?/);
    if (!funcao) {
      continue;
    }
    const simbolo = implAtual ? `${implAtual}.${funcao[1]!}` : funcao[1]!;
    simbolos.set(simbolo, {
      simbolo,
      retorno: funcao[3]?.trim(),
      parametros: extrairParametrosAssinaturaRust(funcao[2] ?? ""),
    });
  }

  return [...simbolos.values()];
}

export function extrairRotasRust(codigo: string): RotaRustExtraida[] {
  const rotas = new Map<string, RotaRustExtraida>();

  for (const match of codigo.matchAll(/\.route\(\s*"([^"]+)"\s*,\s*((?:get|post|put|patch|delete)\([A-Za-z_:][A-Za-z0-9_:]*\)(?:\.(?:get|post|put|patch|delete)\([A-Za-z_:][A-Za-z0-9_:]*\))*)\s*\)/g)) {
    const caminho = normalizarCaminhoRust(match[1]!);
    const bloco = match[2]!;
    for (const rota of bloco.matchAll(/\b(get|post|put|patch|delete)\(([A-Za-z_:][A-Za-z0-9_:]*)\)/g)) {
      const metodo = rota[1]!.toUpperCase();
      const simbolo = rota[2]!.replace(/::/g, ".");
      if (!METODOS_HTTP.has(metodo)) {
        continue;
      }
      rotas.set(`${metodo}:${caminho}:${simbolo}`, {
        origem: "rust",
        metodo,
        caminho,
        simbolo,
        parametros: extrairParametrosRotaRust(caminho, ""),
      });
    }
  }

  return [...rotas.values()];
}
