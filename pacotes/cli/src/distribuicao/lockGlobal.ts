// SEMA-GOVERNED: sema.produto.distribuicao_global, sema.produto.distribuicao_global.transacao
// Descrição: serializa transações globais por HOME com lease, identidade e nonce verificáveis.

import { randomUUID } from "node:crypto";
import { constants, type BigIntStats } from "node:fs";
import { link, lstat, open, readdir, unlink, type FileHandle } from "node:fs/promises";
import os from "node:os";
import { threadId } from "node:worker_threads";
import {
  FalhaDistribuicaoGlobal,
  caminhosIguais,
  identidadeArquivoSeguro,
  identidadeDiretorioSeguro,
  lstatOuNull,
  mesmaIdentidadeDiretorio,
  removerArquivoSeguro,
  resolverDentroDaHome,
  resolverHomeReal,
} from "./filesystemGlobal.js";
import type { OpcoesAmbienteDistribuicaoGlobal } from "./tipos.js";
import {
  executarComTokenLockDistribuicaoGlobal,
  tokenLockDistribuicaoGlobalAtual,
  type TokenLockDistribuicaoGlobal,
} from "./lockContextGlobal.js";

const ESQUEMA_LOCK = "sema.distribuicao-global-lock/v1";
const NOME_LOCK = ".sema-distribuicao-global.lock";
const PREFIXO_TEMP_LOCK = `${NOME_LOCK}.`;
const LIMITE_LOCK_BYTES = 4096;
const TIMEOUT_LOCK_MS = 30_000;
const LEASE_STALE_MS = 15_000;
const HEARTBEAT_MS = 2_000;
const OBSERVACAO_RECLAIM_MS = HEARTBEAT_MS + 250;
const INTERVALO_MINIMO_MS = 20;
const INTERVALO_VARIACAO_MS = 30;
const filasLocais = new Map<string, Promise<void>>();

interface ReciboLock {
  schema: typeof ESQUEMA_LOCK;
  pid: number;
  threadId: number;
  nonce: string;
  criadoEm: string;
}

interface LockAdquirido extends TokenLockDistribuicaoGlobal {
  caminho: string;
  identidade: { dev: bigint; ino: bigint };
  handle: FileHandle;
  recibo: ReciboLock;
  heartbeat: NodeJS.Timeout;
}

interface InspecaoArquivoLock {
  info: BigIntStats;
  recibo: ReciboLock | null;
}

interface InspecaoLockFinal extends InspecaoArquivoLock {
  tempPublicado?: string;
  reclaimPublicado?: string;
}

function mesmaIdentidade(
  a: { dev: bigint; ino: bigint },
  b: { dev: bigint; ino: bigint },
): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

function chavesExatas(valor: object, esperadas: readonly string[]): boolean {
  const atuais = Object.keys(valor).sort();
  const ordenadas = [...esperadas].sort();
  return atuais.length === ordenadas.length
    && atuais.every((chave, indice) => chave === ordenadas[indice]);
}

function reciboValido(valor: unknown): valor is ReciboLock {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const candidato = valor as Partial<ReciboLock>;
  return chavesExatas(candidato, ["schema", "pid", "threadId", "nonce", "criadoEm"])
    && candidato.schema === ESQUEMA_LOCK
    && Number.isSafeInteger(candidato.pid)
    && (candidato.pid ?? 0) > 0
    && Number.isSafeInteger(candidato.threadId)
    && (candidato.threadId ?? -1) >= 0
    && typeof candidato.nonce === "string"
    && /^[a-f0-9-]{36}$/u.test(candidato.nonce)
    && typeof candidato.criadoEm === "string"
    && Number.isFinite(Date.parse(candidato.criadoEm));
}

function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    const codigo = (erro as NodeJS.ErrnoException).code;
    return codigo !== "ESRCH";
  }
}

function idadeMs(info: BigIntStats): number {
  return Math.max(0, Date.now() - Number(info.mtimeMs));
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function entrarFilaLocal(homeReal: string): Promise<() => void> {
  const chave = process.platform === "win32" ? homeReal.toLocaleLowerCase("en-US") : homeReal;
  const anterior = filasLocais.get(chave);
  let resolver!: () => void;
  const atual = new Promise<void>((resolve) => {
    resolver = resolve;
  });
  filasLocais.set(chave, atual);
  if (anterior) await anterior;
  return () => {
    if (filasLocais.get(chave) === atual) filasLocais.delete(chave);
    resolver();
  };
}

async function inspecionarArquivoLock(
  caminho: string,
): Promise<InspecaoArquivoLock> {
  const infoAntes = await lstat(caminho, { bigint: true });
  if (!infoAntes.isFile() || infoAntes.isSymbolicLink()
    || infoAntes.nlink < 1n || infoAntes.nlink > 2n
    || infoAntes.size > BigInt(LIMITE_LOCK_BYTES)) {
    return { info: infoAntes, recibo: null };
  }
  const handle = await open(caminho, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const infoHandle = await handle.stat({ bigint: true });
    if (!mesmaIdentidade(infoAntes, infoHandle) || infoHandle.nlink !== infoAntes.nlink) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
    }
    const bytes = await handle.readFile();
    const infoDepois = await lstat(caminho, { bigint: true });
    if (bytes.byteLength > LIMITE_LOCK_BYTES
      || !mesmaIdentidade(infoAntes, infoDepois)
      || infoDepois.nlink !== infoAntes.nlink) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
    }
    try {
      const valor: unknown = JSON.parse(bytes.toString("utf8"));
      return { info: infoDepois, recibo: reciboValido(valor) ? valor : null };
    } catch {
      return { info: infoDepois, recibo: null };
    }
  } catch {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  } finally {
    await handle.close().catch(() => undefined);
  }
}

function nomeTempLock(nonce: string): string {
  return `${PREFIXO_TEMP_LOCK}${nonce}.tmp`;
}

function nomeReclaimLock(nonce: string): string {
  return `${NOME_LOCK}.reclaim.${nonce}`;
}

async function inspecionarLockFinal(
  homeReal: string,
  caminho: string,
): Promise<InspecaoLockFinal> {
  const inspecao = await inspecionarArquivoLock(caminho);
  if (!inspecao.recibo || inspecao.info.nlink === 1n) return inspecao;
  for (const [tipo, nome] of [
    ["tempPublicado", nomeTempLock(inspecao.recibo.nonce)],
    ["reclaimPublicado", nomeReclaimLock(inspecao.recibo.nonce)],
  ] as const) {
    const auxiliar = resolverDentroDaHome(homeReal, nome);
    const infoAuxiliar = await lstatOuNull(auxiliar);
    if (infoAuxiliar?.isFile() && !infoAuxiliar.isSymbolicLink()
      && infoAuxiliar.nlink === 2n && mesmaIdentidade(inspecao.info, infoAuxiliar)) {
      return { ...inspecao, [tipo]: auxiliar };
    }
  }
  return { ...inspecao, recibo: null };
}

async function removerTempPublicado(
  homeReal: string,
  caminhoFinal: string,
  caminhoTemp: string,
  identidade: { dev: bigint; ino: bigint },
): Promise<void> {
  const identidadePai = await identidadeDiretorioSeguro(homeReal);
  const [finalAntes, tempAntes] = await Promise.all([
    lstat(caminhoFinal, { bigint: true }),
    lstat(caminhoTemp, { bigint: true }),
  ]);
  if (!finalAntes.isFile() || finalAntes.isSymbolicLink()
    || !tempAntes.isFile() || tempAntes.isSymbolicLink()
    || finalAntes.nlink !== 2n || tempAntes.nlink !== 2n
    || !mesmaIdentidade(finalAntes, tempAntes)
    || !mesmaIdentidade(finalAntes, identidade)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
  await unlink(caminhoTemp);
  const [finalDepois, paiDepois] = await Promise.all([
    lstat(caminhoFinal, { bigint: true }),
    identidadeDiretorioSeguro(homeReal),
  ]);
  if (finalDepois.nlink !== 1n
    || !mesmaIdentidade(finalDepois, identidade)
    || !mesmaIdentidadeDiretorio(identidadePai, paiDepois)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
}

async function removerAuxiliarCriado(
  homeReal: string,
  caminho: string,
): Promise<void> {
  const identidadePai = await identidadeDiretorioSeguro(homeReal);
  const antes = await lstat(caminho, { bigint: true });
  if (!antes.isFile() || antes.isSymbolicLink()
    || antes.nlink < 1n || antes.nlink > 2n) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
  await unlink(caminho);
  const paiDepois = await identidadeDiretorioSeguro(homeReal);
  if (!mesmaIdentidadeDiretorio(identidadePai, paiDepois)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
}

async function limparTemporariosObsoletos(homeReal: string): Promise<void> {
  const padroes = [
    /^\.sema-distribuicao-global\.lock\.([a-f0-9-]{36})\.tmp$/u,
    /^\.sema-distribuicao-global\.lock\.reclaim\.([a-f0-9-]{36})$/u,
  ];
  const entradas = await readdir(homeReal, { withFileTypes: true });
  for (const entrada of entradas) {
    const nonceNome = padroes.map((padrao) => entrada.name.match(padrao)?.[1])
      .find((nonce) => nonce !== undefined);
    if (!nonceNome || !entrada.isFile()) continue;
    const caminho = resolverDentroDaHome(homeReal, entrada.name);
    const info = await lstatOuNull(caminho);
    if (!info || info.nlink !== 1n) continue;
    let inspecao: InspecaoArquivoLock;
    try {
      inspecao = await inspecionarArquivoLock(caminho);
    } catch {
      continue;
    }
    const receiptDoProprioTemp = inspecao.recibo?.nonce === nonceNome;
    if (!receiptDoProprioTemp) continue;
    const expirado = idadeMs(inspecao.info) >= LEASE_STALE_MS;
    const donoMorto = !processoVivo(inspecao.recibo!.pid);
    if (!donoMorto && !expirado) continue;
    await removerArquivoSeguro(homeReal, caminho, {
      dev: inspecao.info.dev,
      ino: inspecao.info.ino,
    }).catch(() => undefined);
  }
}

async function removerFinalCercado(
  homeReal: string,
  caminhoFinal: string,
  caminhoCerca: string,
  identidade: { dev: bigint; ino: bigint },
): Promise<void> {
  const identidadePai = await identidadeDiretorioSeguro(homeReal);
  const [finalAntes, cercaAntes] = await Promise.all([
    lstat(caminhoFinal, { bigint: true }),
    lstat(caminhoCerca, { bigint: true }),
  ]);
  if (!finalAntes.isFile() || finalAntes.isSymbolicLink()
    || !cercaAntes.isFile() || cercaAntes.isSymbolicLink()
    || finalAntes.nlink !== 2n || cercaAntes.nlink !== 2n
    || !mesmaIdentidade(finalAntes, cercaAntes)
    || !mesmaIdentidade(finalAntes, identidade)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
  await unlink(caminhoFinal);
  const [cercaDepois, paiDepois] = await Promise.all([
    lstat(caminhoCerca, { bigint: true }),
    identidadeDiretorioSeguro(homeReal),
  ]);
  if (cercaDepois.nlink !== 1n
    || !mesmaIdentidade(cercaDepois, identidade)
    || !mesmaIdentidadeDiretorio(identidadePai, paiDepois)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
  await removerArquivoSeguro(homeReal, caminhoCerca, identidade);
}

async function cercarLockParaReclaim(
  homeReal: string,
  caminho: string,
  inspecao: InspecaoLockFinal,
): Promise<InspecaoLockFinal> {
  const recibo = inspecao.recibo!;
  const reclaim = resolverDentroDaHome(homeReal, nomeReclaimLock(recibo.nonce));
  let criado = false;
  try {
    await link(caminho, reclaim);
    criado = true;
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro;
    const existente = await lstatOuNull(reclaim);
    if (!existente || existente.nlink !== 2n
      || !mesmaIdentidade(existente, inspecao.info)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CONTEUDO_NAO_GERENCIADO");
    }
  }
  try {
    const cercado = await inspecionarLockFinal(homeReal, caminho);
    if (!cercado.reclaimPublicado || !mesmaIdentidade(cercado.info, inspecao.info)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
    }
    return cercado;
  } catch (erro) {
    if (criado && await lstatOuNull(reclaim)) {
      await removerAuxiliarCriado(homeReal, reclaim).catch(() => undefined);
    }
    throw erro;
  }
}

async function concluirReclaimCercado(
  homeReal: string,
  caminho: string,
  inspecao: InspecaoLockFinal,
  mtimeObservado: number,
  observarHeartbeat: boolean,
): Promise<boolean> {
  if (!inspecao.reclaimPublicado) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
  if (Number(inspecao.info.mtimeMs) > mtimeObservado) {
    await removerTempPublicado(
      homeReal,
      caminho,
      inspecao.reclaimPublicado,
      { dev: inspecao.info.dev, ino: inspecao.info.ino },
    );
    return false;
  }
  if (observarHeartbeat) await esperar(OBSERVACAO_RECLAIM_MS);
  let depois: InspecaoLockFinal;
  try {
    depois = await inspecionarLockFinal(homeReal, caminho);
  } catch (erro) {
    if (["ENOENT", "ENOTDIR"].includes((erro as NodeJS.ErrnoException).code ?? "")) return true;
    throw erro;
  }
  if (!mesmaIdentidade(depois.info, inspecao.info)) return false;
  if (!depois.reclaimPublicado) return false;
  if (Number(depois.info.mtimeMs) > mtimeObservado) {
    await removerTempPublicado(
      homeReal,
      caminho,
      depois.reclaimPublicado,
      { dev: depois.info.dev, ino: depois.info.ino },
    );
    return false;
  }
  await removerFinalCercado(
    homeReal,
    caminho,
    depois.reclaimPublicado,
    { dev: depois.info.dev, ino: depois.info.ino },
  );
  return true;
}

async function removerLockObsoleto(
  homeReal: string,
  caminho: string,
): Promise<boolean> {
  let inspecao: InspecaoLockFinal;
  try {
    inspecao = await inspecionarLockFinal(homeReal, caminho);
  } catch (erro) {
    if (["ENOENT", "ENOTDIR"].includes((erro as NodeJS.ErrnoException).code ?? "")) return true;
    throw erro;
  }
  if (!inspecao.recibo) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "CONTEUDO_NAO_GERENCIADO");
  }
  const expirado = idadeMs(inspecao.info) >= LEASE_STALE_MS;
  const donoVivo = processoVivo(inspecao.recibo.pid);
  if (!expirado && donoVivo) {
    if (inspecao.reclaimPublicado) {
      await removerTempPublicado(
        homeReal,
        caminho,
        inspecao.reclaimPublicado,
        { dev: inspecao.info.dev, ino: inspecao.info.ino },
      );
    }
    return false;
  }
  if (inspecao.tempPublicado) {
    await removerFinalCercado(
      homeReal,
      caminho,
      inspecao.tempPublicado,
      { dev: inspecao.info.dev, ino: inspecao.info.ino },
    );
    return true;
  }
  const mtimeObservado = Number(inspecao.info.mtimeMs);
  const cercado = inspecao.reclaimPublicado
    ? inspecao
    : await cercarLockParaReclaim(homeReal, caminho, inspecao);
  return concluirReclaimCercado(
    homeReal,
    caminho,
    cercado,
    mtimeObservado,
    donoVivo,
  );
}

async function publicarLock(
  homeReal: string,
  caminhoFinal: string,
  caminhoTemp: string,
  identidade: { dev: bigint; ino: bigint },
): Promise<void> {
  const identidadePai = await identidadeDiretorioSeguro(homeReal);
  await link(caminhoTemp, caminhoFinal);
  const paiDepoisLink = await identidadeDiretorioSeguro(homeReal);
  if (!mesmaIdentidadeDiretorio(identidadePai, paiDepoisLink)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
  await removerTempPublicado(homeReal, caminhoFinal, caminhoTemp, identidade);
}

async function confirmarOwnershipLock(lock: LockAdquirido, homeReal: string): Promise<void> {
  if (!lock.ativo || !caminhosIguais(lock.homeReal, homeReal)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
  try {
    const inspecao = await inspecionarLockFinal(lock.homeReal, lock.caminho);
    if (inspecao.info.nlink !== 1n
      || !mesmaIdentidade(lock.identidade, inspecao.info)
      || inspecao.recibo?.nonce !== lock.nonce
      || inspecao.recibo.pid !== process.pid
      || inspecao.recibo.threadId !== threadId) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
    }
  } catch {
    lock.ativo = false;
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
}

async function tentarAdquirir(
  homeReal: string,
  caminho: string,
): Promise<LockAdquirido | null> {
  const nonce = randomUUID();
  const caminhoTemp = resolverDentroDaHome(homeReal, nomeTempLock(nonce));
  const handle = await open(
    caminhoTemp,
    constants.O_CREAT | constants.O_EXCL | constants.O_RDWR,
    0o600,
  );
  let identidade: { dev: bigint; ino: bigint } | undefined;
  let publicado = false;
  try {
    const infoHandle = await handle.stat({ bigint: true });
    identidade = { dev: infoHandle.dev, ino: infoHandle.ino };
    const recibo: ReciboLock = {
      schema: ESQUEMA_LOCK,
      pid: process.pid,
      threadId,
      nonce,
      criadoEm: new Date().toISOString(),
    };
    await handle.writeFile(`${JSON.stringify(recibo)}\n`, "utf8");
    await handle.sync();
    const tempValidado = await inspecionarArquivoLock(caminhoTemp);
    if (!tempValidado.recibo
      || tempValidado.recibo.nonce !== nonce
      || !mesmaIdentidade(identidade, tempValidado.info)) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
    }
    try {
      await publicarLock(homeReal, caminho, caminhoTemp, identidade);
      publicado = true;
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro;
      await handle.close().catch(() => undefined);
      await removerArquivoSeguro(homeReal, caminhoTemp, identidade);
      try {
        await removerLockObsoleto(homeReal, caminho);
      } catch (falha) {
        if (!(falha instanceof FalhaDistribuicaoGlobal)
          || falha.codigo !== "LOCK_PERDIDO") throw falha;
        // Troca legítima de owner entre EEXIST e inspeção: volta ao loop.
      }
      return null;
    }
    let lock!: LockAdquirido;
    const heartbeat = setInterval(() => {
      if (!lock.ativo) return;
      const agora = new Date();
      void handle.utimes(agora, agora).catch(() => {
        lock.ativo = false;
      });
    }, HEARTBEAT_MS);
    heartbeat.unref();
    lock = {
      homeReal,
      caminho,
      identidade,
      handle,
      recibo,
      nonce: recibo.nonce,
      ativo: true,
      encerrado: false,
      confirmar: async (homeConfirmada) => confirmarOwnershipLock(lock, homeConfirmada),
      heartbeat,
    };
    return lock;
  } catch (erro) {
    await handle.close().catch(() => undefined);
    if (publicado && identidade) {
      await removerArquivoSeguro(homeReal, caminho, identidade).catch(() => undefined);
    } else if (identidade) {
      await removerArquivoSeguro(homeReal, caminhoTemp, identidade).catch(() => undefined);
    }
    throw erro;
  }
}

async function adquirirLock(homeReal: string): Promise<LockAdquirido> {
  const caminho = resolverDentroDaHome(homeReal, NOME_LOCK);
  const limite = Date.now() + TIMEOUT_LOCK_MS;
  while (Date.now() < limite) {
    await limparTemporariosObsoletos(homeReal);
    const adquirido = await tentarAdquirir(homeReal, caminho);
    if (adquirido) return adquirido;
    await esperar(INTERVALO_MINIMO_MS + Math.floor(Math.random() * INTERVALO_VARIACAO_MS));
  }
  throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_TIMEOUT");
}

async function liberarLock(lock: LockAdquirido): Promise<void> {
  clearInterval(lock.heartbeat);
  try {
    try {
      const inspecao = await inspecionarLockFinal(lock.homeReal, lock.caminho);
      if (!mesmaIdentidade(lock.identidade, inspecao.info)
        || inspecao.info.nlink !== 1n
        || inspecao.recibo?.nonce !== lock.nonce
        || inspecao.recibo.pid !== process.pid
        || inspecao.recibo.threadId !== threadId) {
        throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
      }
    } catch (erro) {
      if (erro instanceof FalhaDistribuicaoGlobal && erro.codigo === "LOCK_PERDIDO") throw erro;
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
    }
  } finally {
    await lock.handle.close().catch(() => undefined);
  }
  const identidadePai = await identidadeDiretorioSeguro(lock.homeReal);
  const antesUnlink = await lstat(lock.caminho, { bigint: true });
  if (!antesUnlink.isFile() || antesUnlink.isSymbolicLink()
    || antesUnlink.nlink !== 1n
    || !mesmaIdentidade(antesUnlink, lock.identidade)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
  await unlink(lock.caminho);
  const paiDepois = await identidadeDiretorioSeguro(lock.homeReal);
  if (!mesmaIdentidadeDiretorio(identidadePai, paiDepois)) {
    throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
  }
}

export async function comLockDistribuicaoGlobal<T>(
  opcoes: Pick<OpcoesAmbienteDistribuicaoGlobal, "diretorioUsuario">,
  operacao: (opcoesCanonicas: { diretorioUsuario: string }) => Promise<T>,
): Promise<T> {
  const homeReal = await resolverHomeReal(opcoes.diretorioUsuario ?? os.homedir());
  const atual = tokenLockDistribuicaoGlobalAtual();
  if (atual && caminhosIguais(atual.homeReal, homeReal)) {
    if (atual.ativo) return operacao({ diretorioUsuario: homeReal });
    if (!atual.encerrado) {
      throw new FalhaDistribuicaoGlobal("BROKEN_TARGET", "LOCK_PERDIDO");
    }
  }
  const sairFila = await entrarFilaLocal(homeReal);
  try {
    const lock = await adquirirLock(homeReal);
    let resultado: T;
    let erroOperacao: unknown;
    try {
      resultado = await executarComTokenLockDistribuicaoGlobal(lock, async () => (
        operacao({ diretorioUsuario: homeReal })
      ));
    } catch (erro) {
      erroOperacao = erro;
    }
    lock.ativo = false;
    lock.encerrado = true;
    try {
      await liberarLock(lock);
    } catch (erro) {
      if (erroOperacao === undefined) throw erro;
    }
    if (erroOperacao !== undefined) throw erroOperacao;
    return resultado!;
  } finally {
    sairFila();
  }
}

/** Nome fixo exportado apenas para testes de crash/stale sem revelar caminhos reais. */
export function nomeLockDistribuicaoGlobal(): string {
  return NOME_LOCK;
}
