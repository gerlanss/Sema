// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: valida versões SemVer de pacotes e recibos sem rede ou dependência externa.

interface VersaoSemantica {
  major: bigint;
  minor: bigint;
  patch: bigint;
  prerelease: string[] | null;
}

const PADRAO_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

function analisar(valor: string): VersaoSemantica | null {
  if (valor.length > 256) return null;
  const match = valor.match(PADRAO_SEMVER);
  if (!match) return null;
  return {
    major: BigInt(match[1] ?? "0"),
    minor: BigInt(match[2] ?? "0"),
    patch: BigInt(match[3] ?? "0"),
    prerelease: match[4]?.split(".") ?? null,
  };
}

export function versaoSemanticaValida(valor: unknown): valor is string {
  return typeof valor === "string" && analisar(valor) !== null;
}

function compararIdentificador(a: string, b: string): -1 | 0 | 1 {
  const numericoA = /^\d+$/u.test(a);
  const numericoB = /^\d+$/u.test(b);
  if (numericoA && numericoB) {
    const inteiroA = BigInt(a);
    const inteiroB = BigInt(b);
    return inteiroA === inteiroB ? 0 : inteiroA > inteiroB ? 1 : -1;
  }
  if (numericoA !== numericoB) return numericoA ? -1 : 1;
  return a === b ? 0 : a > b ? 1 : -1;
}

/** Retorna -1, 0 ou 1. Build metadata não participa da precedência SemVer. */
export function compararVersoesSemanticas(a: string, b: string): -1 | 0 | 1 {
  const versaoA = analisar(a);
  const versaoB = analisar(b);
  if (!versaoA || !versaoB) throw new Error("VERSAO_SEMANTICA_INVALIDA");
  for (const chave of ["major", "minor", "patch"] as const) {
    if (versaoA[chave] !== versaoB[chave]) return versaoA[chave] > versaoB[chave] ? 1 : -1;
  }
  if (versaoA.prerelease === null || versaoB.prerelease === null) {
    if (versaoA.prerelease === versaoB.prerelease) return 0;
    return versaoA.prerelease === null ? 1 : -1;
  }
  const limite = Math.max(versaoA.prerelease.length, versaoB.prerelease.length);
  for (let indice = 0; indice < limite; indice += 1) {
    const itemA = versaoA.prerelease[indice];
    const itemB = versaoB.prerelease[indice];
    if (itemA === undefined || itemB === undefined) {
      if (itemA === itemB) return 0;
      return itemA === undefined ? -1 : 1;
    }
    const comparacao = compararIdentificador(itemA, itemB);
    if (comparacao !== 0) return comparacao;
  }
  return 0;
}
