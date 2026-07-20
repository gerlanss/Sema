// SEMA-GOVERNED: sema.produto.sistemas_interativos
// Descricao: canonicalizacao JSON e digests locais para planos e bundles nao autoritativos.

import { createHash } from "node:crypto";

function serializarCanonico(valor: unknown, visitados: Set<object>): string {
  if (valor === null) return "null";
  if (typeof valor === "string" || typeof valor === "boolean") return JSON.stringify(valor);
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new TypeError("json_canonico_numero_invalido");
    return Object.is(valor, -0) ? "0" : JSON.stringify(valor);
  }
  if (typeof valor !== "object") throw new TypeError(`json_canonico_tipo_invalido:${typeof valor}`);
  if (visitados.has(valor)) throw new TypeError("json_canonico_referencia_ciclica");
  visitados.add(valor);
  try {
    if (Array.isArray(valor)) {
      return `[${valor.map((item) => serializarCanonico(item, visitados)).join(",")}]`;
    }
    const prototipo = Object.getPrototypeOf(valor);
    if (prototipo !== Object.prototype && prototipo !== null) {
      throw new TypeError("json_canonico_objeto_nao_plano");
    }
    const objeto = valor as Record<string, unknown>;
    return `{${Object.keys(objeto).sort().map((chave) => (
      `${JSON.stringify(chave)}:${serializarCanonico(objeto[chave], visitados)}`
    )).join(",")}}`;
  } finally {
    visitados.delete(valor);
  }
}

export function canonicalizarJsonSistemaInterativo(valor: unknown): string {
  return serializarCanonico(valor, new Set<object>());
}

export function digestJsonSistemaInterativo(valor: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalizarJsonSistemaInterativo(valor)).digest("hex")}`;
}

export function digestSha256Valido(valor: unknown): valor is string {
  return typeof valor === "string" && /^sha256:[a-f0-9]{64}$/.test(valor);
}
