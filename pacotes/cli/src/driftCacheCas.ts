// SEMA-GOVERNED: sema.produto.governanca_ia.drift.cache.store
// Descrição: serializa publicadores concorrentes por chave e recupera locks/temporários sem substituir vencedor válido.

import { constants, type BigIntStats } from "node:fs";
import {
  link,
  lstat,
  open,
  readdir,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as esperar } from "node:timers/promises";
import {
  aplicarPermissaoArquivo,
  capturarGuardaCadeia,
  confirmarGuardaCadeia,
  erroEhAusencia,
  estadoEntrada,
  identidadeArquivoValida,
  identidadeDe,
  lerHandleLimitado,
  lstatOuNull,
  mesmaIdentidade,
  mesmoEstadoEntrada,
  type EstadoEntradaCache,
  type GuardaCadeiaCache,
  type IdentidadeFilesystem,
} from "./driftCacheFilesystem.js";

export type CodigoErroCasCacheDrift =
  | "cache_objeto_corrupto"
  | "cache_objeto_grande"
  | "cache_objeto_hardlink"
  | "cache_objeto_conflitante"
  | "cache_io_indisponivel";

export interface LockPublicacaoCache {
  caminho: string;
  handle: FileHandle;
  identidade: IdentidadeFilesystem;
  guarda: GuardaCadeiaCache;
  token: string;
  contendido: boolean;
}

export class FalhaCasCacheDrift extends Error {
  constructor(readonly codigo: CodigoErroCasCacheDrift) {
    super(codigo);
    this.name = "FalhaCasCacheDrift";
  }
}

const SCHEMA_LOCK_CACHE_DRIFT = "sema.drift-cache-lock/v1" as const;
const TENTATIVAS_LOCK_CACHE_DRIFT = 200;
const INTERVALO_LOCK_CACHE_DRIFT_MS = 10;
const TTL_LOCK_CACHE_DRIFT_MS = 30_000;
const TOKENS_LOCK_ATIVOS = new Set<string>();
const PROCESSO_INICIADO_EM_CACHE_DRIFT = performance.timeOrigin;

export interface OpcoesAdquirirLockPublicacao {
  chave: string;
  pasta: string;
  guardaInicial: GuardaCadeiaCache;
  raiz: string;
  identidadeRaiz: IdentidadeFilesystem;
}

export interface OpcoesPublicarObjetoExclusivo {
  temporario: string;
  destino: string;
  guarda: GuardaCadeiaCache;
  identidadeTemporario: IdentidadeFilesystem;
  estadoDestinoSubstituivel: EstadoEntradaCache | null;
}

export type ResultadoPublicacaoObjetoExclusivo =
  | { estado: "publicado" }
  | { estado: "existente" }
  | { estado: "conflito" };

function processoEstaAtivo(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    const codigo = (erro as NodeJS.ErrnoException).code ?? "";
    return !["ESRCH", "EINVAL"].includes(codigo);
  }
}

function registroObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function registroLockCache(valor: unknown): valor is {
  schema: typeof SCHEMA_LOCK_CACHE_DRIFT;
  pid: number;
  processoIniciadoEm: number;
  token: string;
  criadoEm: number;
} {
  if (!registroObjeto(valor)) return false;
  return valor.schema === SCHEMA_LOCK_CACHE_DRIFT
    && Number.isSafeInteger(valor.pid)
    && Number(valor.pid) > 0
    && typeof valor.processoIniciadoEm === "number"
    && Number.isFinite(valor.processoIniciadoEm)
    && valor.processoIniciadoEm > 0
    && typeof valor.token === "string"
    && /^[a-f0-9-]{36}$/u.test(valor.token)
    && typeof valor.criadoEm === "number"
    && Number.isFinite(valor.criadoEm);
}

export async function capturarEstadoEntradaGuardado(
  caminho: string,
  guarda: GuardaCadeiaCache,
): Promise<EstadoEntradaCache | null> {
  await confirmarGuardaCadeia(guarda);
  const info = await lstatOuNull(caminho);
  await confirmarGuardaCadeia(guarda);
  return info ? estadoEntrada(info) : null;
}

async function vincularExclusivo(
  origem: string,
  destino: string,
  guarda: GuardaCadeiaCache,
): Promise<"vinculado" | "existente"> {
  await confirmarGuardaCadeia(guarda);
  try {
    await link(origem, destino);
  } catch (erro) {
    const codigo = (erro as NodeJS.ErrnoException).code ?? "";
    if (!["EEXIST", "EPERM"].includes(codigo)) throw erro;
    await confirmarGuardaCadeia(guarda);
    if (await lstatOuNull(destino)) return "existente";
    throw erro;
  }
  await confirmarGuardaCadeia(guarda);
  return "vinculado";
}

export async function removerArquivoGuardadoSeMesmo(
  caminho: string,
  identidade: IdentidadeFilesystem,
  guarda: GuardaCadeiaCache,
  permitirHardlink = false,
): Promise<boolean> {
  try {
    await confirmarGuardaCadeia(guarda);
    const info = await lstat(caminho, { bigint: true });
    if (info.isFile()
      && !info.isSymbolicLink()
      && (permitirHardlink || info.nlink === 1n)
      && mesmaIdentidade(identidade, identidadeDe(info))) {
      await confirmarGuardaCadeia(guarda);
      await unlink(caminho);
      await confirmarGuardaCadeia(guarda);
      return true;
    }
  } catch (erro) {
    if (erroEhAusencia(erro)) return true;
    // Limpeza é best effort; nunca seguimos um caminho cuja cadeia mudou.
  }
  return false;
}

export async function publicarObjetoExclusivo(
  opcoes: OpcoesPublicarObjetoExclusivo,
): Promise<ResultadoPublicacaoObjetoExclusivo> {
  const identidadeSubstituida = opcoes.estadoDestinoSubstituivel
    ? {
      dev: opcoes.estadoDestinoSubstituivel.dev,
      ino: opcoes.estadoDestinoSubstituivel.ino,
    }
    : null;
  let quarentena: { caminho: string; identidade: IdentidadeFilesystem } | null = null;
  let destinoCriado = false;
  try {
    await confirmarGuardaCadeia(opcoes.guarda);
    const infoTemporario = await lstat(opcoes.temporario, { bigint: true });
    if (!infoTemporario.isFile()
      || infoTemporario.isSymbolicLink()
      || infoTemporario.nlink !== 1n
      || !mesmaIdentidade(opcoes.identidadeTemporario, identidadeDe(infoTemporario))) {
      throw new FalhaCasCacheDrift("cache_objeto_hardlink");
    }

    if (opcoes.estadoDestinoSubstituivel) {
      if (opcoes.estadoDestinoSubstituivel.tipo !== "arquivo" || !identidadeSubstituida) {
        return { estado: "conflito" };
      }
      const atual = await capturarEstadoEntradaGuardado(opcoes.destino, opcoes.guarda);
      if (!mesmoEstadoEntrada(opcoes.estadoDestinoSubstituivel, atual)) {
        return { estado: "conflito" };
      }
      const digest = path.basename(opcoes.destino, ".json");
      const caminhoQuarentena = path.join(
        path.dirname(opcoes.destino),
        `.${digest}.${randomUUID()}.replaced`,
      );
      if (await vincularExclusivo(opcoes.destino, caminhoQuarentena, opcoes.guarda) !== "vinculado") {
        return { estado: "conflito" };
      }
      const [infoQuarentena, infoDestino] = await Promise.all([
        lstat(caminhoQuarentena, { bigint: true }),
        lstat(opcoes.destino, { bigint: true }),
      ]);
      quarentena = { caminho: caminhoQuarentena, identidade: identidadeDe(infoQuarentena) };
      if (!infoQuarentena.isFile()
        || infoQuarentena.isSymbolicLink()
        || !mesmaIdentidade(identidadeSubstituida, identidadeDe(infoQuarentena))
        || !mesmaIdentidade(identidadeSubstituida, identidadeDe(infoDestino))) {
        return { estado: "conflito" };
      }
      const removido = await removerArquivoGuardadoSeMesmo(
        opcoes.destino,
        identidadeSubstituida,
        opcoes.guarda,
        true,
      );
      if (!removido) return { estado: "conflito" };
    }

    const vinculo = await vincularExclusivo(opcoes.temporario, opcoes.destino, opcoes.guarda);
    if (vinculo === "existente") return { estado: "existente" };
    destinoCriado = true;
    const [infoDestino, infoTemporarioVinculado] = await Promise.all([
      lstat(opcoes.destino, { bigint: true }),
      lstat(opcoes.temporario, { bigint: true }),
    ]);
    if (!infoDestino.isFile()
      || infoDestino.isSymbolicLink()
      || infoDestino.nlink !== 2n
      || infoTemporarioVinculado.nlink !== 2n
      || !mesmaIdentidade(opcoes.identidadeTemporario, identidadeDe(infoDestino))
      || !mesmaIdentidade(opcoes.identidadeTemporario, identidadeDe(infoTemporarioVinculado))) {
      throw new FalhaCasCacheDrift("cache_objeto_conflitante");
    }
    const temporarioRemovido = await removerArquivoGuardadoSeMesmo(
      opcoes.temporario,
      opcoes.identidadeTemporario,
      opcoes.guarda,
      true,
    );
    if (!temporarioRemovido) throw new FalhaCasCacheDrift("cache_objeto_conflitante");
    const infoFinal = await lstat(opcoes.destino, { bigint: true });
    if (!infoFinal.isFile()
      || infoFinal.isSymbolicLink()
      || infoFinal.nlink !== 1n
      || !mesmaIdentidade(opcoes.identidadeTemporario, identidadeDe(infoFinal))) {
      throw new FalhaCasCacheDrift("cache_objeto_conflitante");
    }
    destinoCriado = false;
    return { estado: "publicado" };
  } catch (erro) {
    if (destinoCriado) {
      await removerArquivoGuardadoSeMesmo(
        opcoes.destino,
        opcoes.identidadeTemporario,
        opcoes.guarda,
        true,
      );
    }
    throw erro;
  } finally {
    if (quarentena) {
      await removerArquivoGuardadoSeMesmo(
        quarentena.caminho,
        quarentena.identidade,
        opcoes.guarda,
        true,
      );
    }
  }
}

async function lerLockSeguro(
  caminho: string,
  guarda: GuardaCadeiaCache,
): Promise<{ info: BigIntStats; valor: unknown } | null> {
  await confirmarGuardaCadeia(guarda);
  const infoAntes = await lstatOuNull(caminho);
  if (!infoAntes) return null;
  if (!infoAntes.isFile() || infoAntes.isSymbolicLink()) {
    throw new FalhaCasCacheDrift("cache_objeto_corrupto");
  }
  if (infoAntes.nlink !== 1n) throw new FalhaCasCacheDrift("cache_objeto_hardlink");
  if (infoAntes.size > 4096n) throw new FalhaCasCacheDrift("cache_objeto_grande");
  let handle: FileHandle;
  try {
    handle = await open(caminho, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch (erro) {
    if (erroEhAusencia(erro)) return null;
    throw erro;
  }
  try {
    await confirmarGuardaCadeia(guarda);
    const infoHandle = await handle.stat({ bigint: true });
    if (!identidadeArquivoValida(caminho, infoAntes, infoHandle)) {
      const atual = await lstatOuNull(caminho);
      if (!atual
        || !mesmaIdentidade(identidadeDe(infoAntes), identidadeDe(atual))) return null;
      throw new FalhaCasCacheDrift("cache_objeto_corrupto");
    }
    const bytes = await lerHandleLimitado(handle, 4096);
    const infoHandleFinal = await handle.stat({ bigint: true });
    const infoFinal = await lstatOuNull(caminho);
    await confirmarGuardaCadeia(guarda);
    if (!infoFinal
      || !mesmaIdentidade(identidadeDe(infoAntes), identidadeDe(infoFinal))) return null;
    if (bytes.byteLength > 4096
      || !identidadeArquivoValida(caminho, infoFinal, infoHandleFinal)) {
      throw new FalhaCasCacheDrift("cache_objeto_corrupto");
    }
    let valor: unknown = null;
    try {
      valor = JSON.parse(bytes.toString("utf8"));
    } catch {
      // Lock incompleto só pode ser removido após a janela de segurança.
    }
    return { info: infoFinal, valor };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function removerLockOrfao(
  caminho: string,
  guarda: GuardaCadeiaCache,
): Promise<boolean> {
  const leitura = await lerLockSeguro(caminho, guarda);
  if (!leitura) return true;
  const lock = registroLockCache(leitura.valor) ? leitura.valor : null;
  const idadeMs = Math.max(0, Date.now() - Number(leitura.info.mtimeMs));
  const pertenceInstanciaAtual = lock?.pid === process.pid
    && lock.processoIniciadoEm === PROCESSO_INICIADO_EM_CACHE_DRIFT;
  const orfao = lock
    ? (!TOKENS_LOCK_ATIVOS.has(lock.token)
      && !pertenceInstanciaAtual
      && (!processoEstaAtivo(lock.pid) || idadeMs >= TTL_LOCK_CACHE_DRIFT_MS))
    : idadeMs >= TTL_LOCK_CACHE_DRIFT_MS;
  if (!orfao) return false;
  await removerArquivoGuardadoSeMesmo(caminho, identidadeDe(leitura.info), guarda);
  return await lstatOuNull(caminho) === null;
}

export async function adquirirLockPublicacao(
  opcoes: OpcoesAdquirirLockPublicacao,
): Promise<LockPublicacaoCache> {
  const caminho = path.join(opcoes.pasta, `.${opcoes.chave.slice("sha256:".length)}.lock`);
  const token = randomUUID();
  let contendido = false;
  let guarda = opcoes.guardaInicial;
  for (let tentativa = 0; tentativa < TENTATIVAS_LOCK_CACHE_DRIFT; tentativa += 1) {
    let handle: FileHandle | undefined;
    let identidade: IdentidadeFilesystem | undefined;
    try {
      await confirmarGuardaCadeia(guarda);
      handle = await open(caminho, "wx", 0o600);
      await confirmarGuardaCadeia(guarda);
      const [infoHandle, infoCaminho] = await Promise.all([
        handle.stat({ bigint: true }),
        lstat(caminho, { bigint: true }),
      ]);
      if (!identidadeArquivoValida(caminho, infoCaminho, infoHandle)) {
        throw new FalhaCasCacheDrift("cache_objeto_hardlink");
      }
      identidade = identidadeDe(infoHandle);
      await aplicarPermissaoArquivo(handle);
      await confirmarGuardaCadeia(guarda);
      await handle.writeFile(JSON.stringify({
        schema: SCHEMA_LOCK_CACHE_DRIFT,
        pid: process.pid,
        processoIniciadoEm: PROCESSO_INICIADO_EM_CACHE_DRIFT,
        token,
        criadoEm: Date.now(),
      }), "utf8");
      await handle.sync();
      const [infoHandleFinal, infoCaminhoFinal] = await Promise.all([
        handle.stat({ bigint: true }),
        lstat(caminho, { bigint: true }),
      ]);
      if (!identidadeArquivoValida(caminho, infoCaminhoFinal, infoHandleFinal)
        || !mesmaIdentidade(identidade, identidadeDe(infoHandleFinal))) {
        throw new FalhaCasCacheDrift("cache_objeto_corrupto");
      }
      await confirmarGuardaCadeia(guarda);
      TOKENS_LOCK_ATIVOS.add(token);
      return { caminho, handle, identidade, guarda, token, contendido };
    } catch (erro) {
      await handle?.close().catch(() => undefined);
      if (identidade) await removerArquivoGuardadoSeMesmo(caminho, identidade, guarda);
      if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro;
      contendido = true;
      guarda = await capturarGuardaCadeia(opcoes.raiz, opcoes.identidadeRaiz, opcoes.pasta);
      const removido = await removerLockOrfao(caminho, guarda);
      if (!removido) await esperar(INTERVALO_LOCK_CACHE_DRIFT_MS);
    }
  }
  throw new FalhaCasCacheDrift("cache_io_indisponivel");
}

export async function confirmarLockPublicacao(lock: LockPublicacaoCache): Promise<void> {
  await confirmarGuardaCadeia(lock.guarda);
  const [infoHandle, infoCaminho] = await Promise.all([
    lock.handle.stat({ bigint: true }),
    lstat(lock.caminho, { bigint: true }),
  ]);
  if (!identidadeArquivoValida(lock.caminho, infoCaminho, infoHandle)
    || !mesmaIdentidade(lock.identidade, identidadeDe(infoHandle))) {
    throw new FalhaCasCacheDrift("cache_objeto_conflitante");
  }
  await confirmarGuardaCadeia(lock.guarda);
}

export async function liberarLockPublicacao(lock: LockPublicacaoCache): Promise<void> {
  await lock.handle.close().catch(() => undefined);
  try {
    await removerArquivoGuardadoSeMesmo(lock.caminho, lock.identidade, lock.guarda);
  } finally {
    TOKENS_LOCK_ATIVOS.delete(lock.token);
  }
}

export async function limparTemporariosOrfaos(
  chave: string,
  pasta: string,
  guarda: GuardaCadeiaCache,
): Promise<void> {
  const digest = chave.slice("sha256:".length);
  const padrao = new RegExp(`^\\.${digest}\\.[a-f0-9-]{36}\\.(?:tmp|replaced)$`, "u");
  await confirmarGuardaCadeia(guarda);
  const entradas = await readdir(pasta, { withFileTypes: true });
  await confirmarGuardaCadeia(guarda);
  for (const entrada of entradas) {
    if (entrada.isSymbolicLink() || !padrao.test(entrada.name)) continue;
    const caminho = path.join(pasta, entrada.name);
    const info = await lstatOuNull(caminho);
    if (info?.isFile() && !info.isSymbolicLink()) {
      await removerArquivoGuardadoSeMesmo(caminho, identidadeDe(info), guarda, true);
    }
  }
}
