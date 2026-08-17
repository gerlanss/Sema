// SEMA-GOVERNED: sema.produto.cli_verificacao
// Descrição: cache incremental de verificação fora do workspace, endereçado por conteúdo do contrato.

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolverRaizCacheSema } from "./driftCacheFilesystem.js";

export const SCHEMA_CACHE_VERIFICACAO = "sema.verificacao-cache/v1";

export interface EntradaCacheVerificacao {
  schemaVersion: typeof SCHEMA_CACHE_VERIFICACAO;
  chave: string;
  versaoCli: string;
  alvo: string;
  modulo: string;
  sucesso: boolean;
  quantidadeTestes: number;
  testesExecutados: boolean;
  arquivosGerados: string[];
  geradoEm: string;
}

export function calcularChaveVerificacao(entradas: {
  versaoCli: string;
  versaoNode: string;
  modulo: string;
  alvo: string;
  framework: string;
  estrutura: string;
  conteudoContrato: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      schemaVersion: SCHEMA_CACHE_VERIFICACAO,
      versaoCli: entradas.versaoCli,
      versaoNode: entradas.versaoNode,
      modulo: entradas.modulo,
      alvo: entradas.alvo,
      framework: entradas.framework,
      estrutura: entradas.estrutura,
      conteudoContrato: entradas.conteudoContrato,
    }))
    .digest("hex");
}

function resolverPastaCacheVerificacao(raizCache?: string): string | undefined {
  const resolucao = resolverRaizCacheSema(raizCache ? { raizCache } : {});
  return resolucao.disponivel ? path.join(resolucao.raiz, "verificacao") : undefined;
}

export async function carregarCacheVerificacao(
  chave: string,
  pastaAlvo: string,
  raizCache?: string,
): Promise<EntradaCacheVerificacao | undefined> {
  const pasta = resolverPastaCacheVerificacao(raizCache);
  if (!pasta) {
    return undefined;
  }
  let entrada: EntradaCacheVerificacao;
  try {
    entrada = JSON.parse(await readFile(path.join(pasta, `${chave}.json`), "utf8")) as EntradaCacheVerificacao;
  } catch {
    return undefined;
  }
  if (entrada.schemaVersion !== SCHEMA_CACHE_VERIFICACAO || entrada.chave !== chave) {
    return undefined;
  }
  for (const relativo of entrada.arquivosGerados) {
    try {
      await stat(path.join(pastaAlvo, relativo));
    } catch {
      return undefined;
    }
  }
  return entrada;
}

export async function carregarManifestoVerificacao(
  chave: string,
  raizCache?: string,
): Promise<EntradaCacheVerificacao | undefined> {
  const pasta = resolverPastaCacheVerificacao(raizCache);
  if (!pasta) {
    return undefined;
  }
  try {
    const entrada = JSON.parse(await readFile(path.join(pasta, `${chave}.json`), "utf8")) as EntradaCacheVerificacao;
    if (entrada.schemaVersion !== SCHEMA_CACHE_VERIFICACAO || entrada.chave !== chave) {
      return undefined;
    }
    return entrada;
  } catch {
    return undefined;
  }
}

export async function gravarCacheVerificacao(
  entrada: EntradaCacheVerificacao,
  raizCache?: string,
): Promise<void> {
  const pasta = resolverPastaCacheVerificacao(raizCache);
  if (!pasta) {
    return;
  }
  try {
    await mkdir(pasta, { recursive: true });
    await writeFile(path.join(pasta, `${entrada.chave}.json`), `${JSON.stringify(entrada, null, 2)}\n`, "utf8");
  } catch {
    // Cache é aceleração: falha de gravação nunca derruba a verificação.
  }
}
