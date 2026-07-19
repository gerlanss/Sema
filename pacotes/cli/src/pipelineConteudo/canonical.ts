// SEMA-GOVERNED: sema.produto.pipeline_conteudo.confianca
// Descricao: serializacao JSON deterministica, digests SHA-256 e envelopes Ed25519 sem persistir chave privada.

import { createHash, sign, verify, type KeyLike } from "node:crypto";
import type { EnvelopeAssinadoConteudo, EnvelopeAssinavelConteudo } from "./types.js";

function falharCanonico(motivo: string, _caminho: string): never {
  throw new TypeError(`json_canonico_invalido:${motivo}`);
}

function serializarCanonico(valor: unknown, caminho: string, visitados: Set<object>): string {
  if (valor === null) return "null";

  if (typeof valor === "string" || typeof valor === "boolean") {
    return JSON.stringify(valor);
  }

  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) falharCanonico("numero_nao_finito", caminho);
    return Object.is(valor, -0) ? "0" : JSON.stringify(valor);
  }

  if (typeof valor !== "object") {
    return falharCanonico(`tipo_${typeof valor}_nao_suportado`, caminho);
  }

  if (visitados.has(valor)) falharCanonico("referencia_ciclica", caminho);
  visitados.add(valor);

  try {
    if (Array.isArray(valor)) {
      const itens: string[] = [];
      for (let indice = 0; indice < valor.length; indice += 1) {
        if (!Object.hasOwn(valor, indice)) falharCanonico("array_esparso", `${caminho}[${indice}]`);
        itens.push(serializarCanonico(valor[indice], `${caminho}[${indice}]`, visitados));
      }
      return `[${itens.join(",")}]`;
    }

    const prototipo = Object.getPrototypeOf(valor);
    if (prototipo !== Object.prototype && prototipo !== null) {
      return falharCanonico("objeto_nao_plano", caminho);
    }

    const objeto = valor as Record<string, unknown>;
    const campos = Object.keys(objeto)
      .sort()
      .map((chave) => `${JSON.stringify(chave)}:${serializarCanonico(objeto[chave], `${caminho}.${chave}`, visitados)}`);
    return `{${campos.join(",")}}`;
  } finally {
    visitados.delete(valor);
  }
}

/**
 * Serializa somente o subconjunto JSON, ordenando chaves recursivamente.
 * Valores que JSON descartaria silenciosamente sao rejeitados para evitar
 * assinaturas ambiguas.
 */
export function canonicalizarJson(valor: unknown): string {
  return serializarCanonico(valor, "$", new Set<object>());
}

export function digestSha256(conteudo: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(conteudo).digest("hex")}`;
}

export function digestJsonCanonico(valor: unknown): string {
  return digestSha256(canonicalizarJson(valor));
}

/** Alias de dominio usado por planner, ledger e projecoes. */
export const hashCanonicoConteudo = digestJsonCanonico;

export function dadosAssinaveisEnvelopeConteudo<TPayload>(
  envelope: EnvelopeAssinavelConteudo<TPayload>,
): EnvelopeAssinavelConteudo<TPayload> {
  return {
    schemaVersion: envelope.schemaVersion,
    payloadType: envelope.payloadType,
    payload: envelope.payload,
    principalId: envelope.principalId,
    keyId: envelope.keyId,
    issuedAt: envelope.issuedAt,
    nonce: envelope.nonce,
    signatureAlgorithm: envelope.signatureAlgorithm,
  };
}

export function serializarEnvelopeAssinavelConteudo<TPayload>(
  envelope: EnvelopeAssinavelConteudo<TPayload>,
): string {
  return canonicalizarJson(dadosAssinaveisEnvelopeConteudo(envelope));
}

/** A chave privada e usada somente nesta chamada e jamais integra o retorno. */
export function assinarEnvelopeConteudo<TPayload>(
  envelope: EnvelopeAssinavelConteudo<TPayload>,
  privateKey: KeyLike,
): EnvelopeAssinadoConteudo<TPayload> {
  if (envelope.signatureAlgorithm !== "Ed25519") {
    throw new TypeError("algoritmo_assinatura_nao_suportado");
  }

  const mensagem = Buffer.from(serializarEnvelopeAssinavelConteudo(envelope), "utf8");
  const signature = sign(null, mensagem, privateKey).toString("base64");
  return { ...dadosAssinaveisEnvelopeConteudo(envelope), signature };
}

export function verificarAssinaturaEnvelopeConteudo<TPayload>(
  envelope: EnvelopeAssinadoConteudo<TPayload>,
  publicKey: KeyLike,
): boolean {
  if (envelope.signatureAlgorithm !== "Ed25519") return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.signature)) return false;

  try {
    const assinatura = Buffer.from(envelope.signature, "base64");
    if (assinatura.length !== 64 || assinatura.toString("base64") !== envelope.signature) return false;
    const mensagem = Buffer.from(serializarEnvelopeAssinavelConteudo(envelope), "utf8");
    return verify(null, mensagem, publicKey, assinatura);
  } catch {
    return false;
  }
}

export function digestEnvelopeConteudo(envelope: EnvelopeAssinadoConteudo<unknown>): string {
  return digestJsonCanonico(envelope);
}
